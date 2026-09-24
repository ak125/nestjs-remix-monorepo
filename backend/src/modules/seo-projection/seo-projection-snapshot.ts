/**
 * Reproducible export-snapshot builder — SEO forward-writer (ADR-059 §Versioning, P2-R3-B).
 *
 * Produit + publie l'archive `tar.zst` DÉTERMINISTE qui est la **seule autorité de replay**
 * (ADR-059 : « exports_snapshot_uri = seule autorité replay, PAS git »). Le hash stocké dans
 * `__seo_projection_runs.exports_snapshot_hash` est calculé sur les **octets persistés** de cette
 * archive, jamais sur une représentation en mémoire divergente.
 *
 * Reproductible bit-à-bit — deux ensembles d'exports identiques ⇒ même `sha256` :
 *   - entrées triées par nom (indépendant de l'ordre de découverte) ;
 *   - header USTAR normalisé : mtime=0, uid=gid=0, uname/gname vides, permissions fixes 0644 ;
 *   - zstd à niveau figé (zstd n'embarque PAS de timestamp, contrairement à gzip).
 * (invariant prouvé par `seo-projection-snapshot.test.ts`).
 *
 * Publication ATOMIQUE, durable et WRITE-ONCE (ADR-099 D4) : temp voisin → `fsync(fichier)` →
 * `link` (échoue si la cible existe, contrairement à `rename` qui écrase) → `fsync(dir parent)`.
 * Un objet déjà publié n'est jamais réécrit : octets identiques → écriture sautée ; différents →
 * throw (run `failed`). La racine object-store n'est jamais créée ici : elle est provisionnée sur
 * l'hôte (ADR-099 D3) ; absente → throw (fail-closed).
 * Le manifest sidecar `<hash>.manifest.json` est écrit **en dernier** (commit marker : sa présence
 * prouve que l'archive est complète et durable). Aucune dépendance tar externe (le backend n'en
 * embarque pas) : writer USTAR minimal, déterministe, relu par `tar`/`bsdtar` standard.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { zstdCompressSync, constants as zlibConstants } from 'node:zlib';

const BLOCK = 512;
/** rw-r--r-- — 7 chiffres octaux (champ mode USTAR = 8 bytes avec le NUL final). */
const FIXED_MODE = '0000644';
/** Niveau zstd figé → sortie reproductible (déterministe pour une version de lib donnée). */
const ZSTD_LEVEL = 19;

/** Sous-répertoire object-store des snapshots (miroir de `replay_projection.py:SNAPSHOTS_SUBDIR`). */
export const SNAPSHOTS_SUBDIR = 'exports-snapshots';
/** Version du schéma de manifest sidecar (bumpée si la forme change). */
export const SNAPSHOT_MANIFEST_SCHEMA = 'seo-projection-snapshot/1';

export interface SnapshotEntry {
  /** Nom d'entrée tar (relatif, stable ; typiquement le basename du fichier d'export). */
  name: string;
  /** Octets bruts du fichier d'export — JAMAIS réencodés (byte-exact). */
  data: Buffer;
}

export interface SnapshotEntryDigest {
  name: string;
  sha256: string;
  size: number;
}

export interface SnapshotManifest {
  schema: typeof SNAPSHOT_MANIFEST_SCHEMA;
  /** `sha256:<hex>` des octets tar.zst persistés (identité de l'archive). */
  snapshot_hash: string;
  tar_zst_size: number;
  created_from_run_id: string | null;
  wiki_commit_sha: string | null;
  /** Les 5 versions canoniques du run (replay determinism). */
  versions: Record<string, string | null>;
  entry_count: number;
  entries: SnapshotEntryDigest[];
}

export interface PublishedSnapshot {
  /** `sha256:<hex>` — valeur stockée dans `exports_snapshot_hash`. */
  hash: string;
  /** Chemin absolu de l'archive persistée — valeur stockée dans `exports_snapshot_uri`. */
  uri: string;
  manifestUri: string;
  entryCount: number;
}

function writeOctal(
  buf: Buffer,
  offset: number,
  value: number,
  len: number,
): void {
  // len-1 chiffres octaux zero-paddés + NUL final.
  const str = value.toString(8).padStart(len - 1, '0') + '\0';
  buf.write(str, offset, len, 'ascii');
}

function writeString(
  buf: Buffer,
  offset: number,
  value: string,
  len: number,
): void {
  buf.write(value.slice(0, len), offset, len, 'ascii');
}

/** Header USTAR déterministe (512 bytes) pour un fichier régulier. */
function ustarHeader(name: string, size: number): Buffer {
  // Le champ `name` USTAR fait 100 octets : un nom plus long serait TRONQUÉ silencieusement →
  // divergence entre l'entrée tar et l'inventaire du manifest (digestEntries garde le nom complet).
  // Fail-loud plutôt que corruption silencieuse (no-silent-fallback). Les noms réels = slugs bornés.
  if (Buffer.byteLength(name, 'utf-8') > 100) {
    throw new Error(
      `snapshot entry name exceeds 100 bytes (USTAR limit): ${name}`,
    );
  }
  const h = Buffer.alloc(BLOCK, 0);
  writeString(h, 0, name, 100); // name
  h.write(FIXED_MODE + '\0', 100, 8, 'ascii'); // mode
  h.write('0000000\0', 108, 8, 'ascii'); // uid = 0
  h.write('0000000\0', 116, 8, 'ascii'); // gid = 0
  writeOctal(h, 124, size, 12); // size
  h.write('00000000000\0', 136, 12, 'ascii'); // mtime = 0 (epoch)
  h.write('        ', 148, 8, 'ascii'); // chksum : espaces pour le calcul
  h.write('0', 156, 1, 'ascii'); // typeflag = fichier régulier
  h.write('ustar\0', 257, 6, 'ascii'); // magic
  h.write('00', 263, 2, 'ascii'); // version
  // uname/gname/devmajor/devminor/prefix : laissés à 0.

  let sum = 0;
  for (let i = 0; i < BLOCK; i += 1) sum += h[i];
  const chk = sum.toString(8).padStart(6, '0') + '\0 ';
  h.write(chk, 148, 8, 'ascii');
  return h;
}

function pad512(size: number): number {
  const rem = size % BLOCK;
  return rem === 0 ? 0 : BLOCK - rem;
}

const byName = (a: { name: string }, b: { name: string }): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

/**
 * Construit un tar USTAR déterministe (entrées triées, headers normalisés, 2 blocs nuls de fin).
 * Sans compression. Exporté pour test (validité tar + reproductibilité).
 */
export function buildDeterministicTar(entries: SnapshotEntry[]): Buffer {
  const sorted = [...entries].sort(byName);
  const chunks: Buffer[] = [];
  for (const e of sorted) {
    chunks.push(ustarHeader(e.name, e.data.length));
    chunks.push(e.data);
    const p = pad512(e.data.length);
    if (p) chunks.push(Buffer.alloc(p, 0));
  }
  chunks.push(Buffer.alloc(BLOCK * 2, 0)); // fin d'archive
  return Buffer.concat(chunks);
}

/** tar.zst déterministe (zstd niveau figé). Exporté pour test. */
export function buildTarZst(entries: SnapshotEntry[]): Buffer {
  const tar = buildDeterministicTar(entries);
  return zstdCompressSync(tar, {
    params: { [zlibConstants.ZSTD_c_compressionLevel]: ZSTD_LEVEL },
  });
}

export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** Inventaire trié {name, sha256, size} des entrées (pour le manifest + la validation replay). */
export function digestEntries(entries: SnapshotEntry[]): SnapshotEntryDigest[] {
  return entries
    .map((e) => ({
      name: e.name,
      sha256: sha256Hex(e.data),
      size: e.data.length,
    }))
    .sort(byName);
}

const errnoCode = (e: unknown): string | undefined =>
  (e as NodeJS.ErrnoException)?.code;

/**
 * Objet déjà publié en `finalPath` : re-hash de ses octets. Identiques → rien à écrire ; différents
 * → throw (write-once violé : un objet publié n'est jamais écrasé, ADR-099 D4).
 */
async function assertPublishedBytesMatch(
  finalPath: string,
  bytes: Buffer,
): Promise<void> {
  const existingHex = sha256Hex(await fs.readFile(finalPath));
  const newHex = sha256Hex(bytes);
  if (existingHex !== newHex) {
    throw new Error(
      `write-once violation: ${finalPath} already published with different content ` +
        `(existing sha256:${existingHex}, new sha256:${newHex})`,
    );
  }
}

/**
 * Publie `bytes` en `finalPath` ATOMIQUEMENT, durablement et en WRITE-ONCE : temp voisin unique →
 * `fsync(fichier)` → `link(temp, final)` → `unlink(temp)` → `fsync(dir parent)`. `link` échoue
 * (EEXIST) au lieu d'écraser : même un publieur concurrent ne peut pas remplacer un objet publié.
 * Cible déjà présente (avant ou pendant la publication) → `assertPublishedBytesMatch`.
 * Le répertoire parent doit exister (jamais créé ici). Le suffixe `uniq` (runId) évite toute
 * collision de temp inter-runs.
 */
export async function writeOnce(
  finalPath: string,
  bytes: Buffer,
  uniq: string,
): Promise<'written' | 'already_present'> {
  try {
    await assertPublishedBytesMatch(finalPath, bytes);
    return 'already_present';
  } catch (e) {
    if (errnoCode(e) !== 'ENOENT') throw e;
  }

  const tmp = `${finalPath}.tmp-${uniq}`;
  const fh = await fs.open(tmp, 'w');
  try {
    await fh.write(bytes);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await fs.link(tmp, finalPath);
  } catch (e) {
    await fs.unlink(tmp);
    if (errnoCode(e) !== 'EEXIST') throw e;
    // Publié par un run concurrent entre la vérification et le link.
    await assertPublishedBytesMatch(finalPath, bytes);
    return 'already_present';
  }
  await fs.unlink(tmp);
  // fsync du répertoire parent → rend le link durable (POSIX).
  const dir = path.dirname(finalPath);
  const dh = await fs.open(dir, 'r');
  try {
    await dh.sync();
  } finally {
    await dh.close();
  }
  return 'written';
}

/**
 * Répertoire des snapshots sous une racine object-store EXISTANTE. La racine n'est jamais créée :
 * elle est provisionnée sur l'hôte et montée dans le conteneur (ADR-099 D3). La créer ici ferait
 * publier, sur un hôte non provisionné dont le parent est inscriptible, un snapshot hors du volume
 * sauvegardé que le run déclarerait pourtant durable. Absente → throw (run `failed`).
 */
async function ensureSnapshotDir(objectStoreRoot: string): Promise<string> {
  const root = await fs.stat(objectStoreRoot).catch((e: unknown) => {
    if (errnoCode(e) === 'ENOENT') {
      throw new Error(
        `object-store root missing: ${objectStoreRoot} (must be provisioned on the host, ` +
          `never created by the writer — ADR-099 D3)`,
      );
    }
    throw e;
  });
  if (!root.isDirectory()) {
    throw new Error(`object-store root is not a directory: ${objectStoreRoot}`);
  }
  const snapDir = path.join(objectStoreRoot, SNAPSHOTS_SUBDIR);
  try {
    await fs.mkdir(snapDir); // non récursif : ne recrée jamais la racine
  } catch (e) {
    if (errnoCode(e) !== 'EEXIST') throw e;
  }
  return snapDir;
}

/**
 * Construit + publie le snapshot d'un run : archive `<hex>.tar.zst` PUIS manifest sidecar
 * `<hex>.manifest.json` (en dernier = commit marker), tous deux en write-once. Le `hash` retourné
 * est calculé sur les octets réellement écrits (ou re-hashés s'ils étaient déjà publiés).
 * Fail-loud : racine absente, write-once violé ou erreur d'I/O remontent (run `failed`).
 */
export async function buildAndPublishSnapshot(params: {
  objectStoreRoot: string;
  entries: SnapshotEntry[];
  runId: string;
  wikiCommitSha: string | null;
  versions: Record<string, string | null>;
}): Promise<PublishedSnapshot> {
  const { objectStoreRoot, entries, runId, wikiCommitSha, versions } = params;
  const tarZst = buildTarZst(entries);
  const hex = sha256Hex(tarZst);
  const hashFull = `sha256:${hex}`;

  const snapDir = await ensureSnapshotDir(objectStoreRoot);
  const archivePath = path.join(snapDir, `${hex}.tar.zst`);
  // Manifest keyé PAR RUN (`<hex>.<runId>.manifest.json`), pas seulement par hash : l'archive est
  // content-addressed (dédup — 2 runs d'exports identiques partagent le `.tar.zst`), MAIS les 5
  // versions sont per-run. Un manifest partagé serait écrasé par un run ultérieur d'exports identiques
  // mais de versions bumpées → un run antérieur échouerait ensuite la validation replay (versions
  // divergentes). Le manifest per-run garantit versions==run + reste le commit marker (écrit en dernier).
  const manifestPath = path.join(snapDir, `${hex}.${runId}.manifest.json`);

  // 1. Archive d'abord (durable). Content-addressed : déjà publiée par un run d'exports identiques
  // → re-hash égal, écriture sautée.
  await writeOnce(archivePath, tarZst, runId);

  // 2. Manifest EN DERNIER (commit marker : sa présence prouve l'archive complète).
  const manifest: SnapshotManifest = {
    schema: SNAPSHOT_MANIFEST_SCHEMA,
    snapshot_hash: hashFull,
    tar_zst_size: tarZst.length,
    created_from_run_id: runId,
    wiki_commit_sha: wikiCommitSha,
    versions,
    entry_count: entries.length,
    entries: digestEntries(entries),
  };
  await writeOnce(
    manifestPath,
    Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf-8'),
    runId,
  );

  return {
    hash: hashFull,
    uri: archivePath,
    manifestUri: manifestPath,
    entryCount: entries.length,
  };
}
