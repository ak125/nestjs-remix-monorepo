/**
 * L0 — Golda tariff store: index, placement and provenance (pure, zero I/O).
 *
 * Downloaded publications live under `<root>/<slug>/<applicationDate>/<variant>/`
 * (`variant` = `complet`, or a sibling when that folder is taken), each folder
 * holding the zip, its `extrait/` CSV and one `SOURCE.jsonl` provenance line per
 * downloaded file. From the existing provenance lines and one parsed fiche
 * publication, `planGoldaStore` answers:
 *   - `present`: that publication version is already stored — nothing to fetch;
 *   - `fetch`: the folder to write it to — never one that already exists;
 *   - `conflict`: the store cannot place it without a guess (the worker reports it).
 * The worker does the file-system work; nothing here reads or writes a file.
 */
import { parseGoldaDownloadUrl, type GoldaPublication } from './golda-portal';

/** One `SOURCE.jsonl`, path relative to the store root with `/` separators. */
export interface GoldaSourceFile {
  path: string;
  content: string;
}

export interface GoldaStoredVersion {
  /** Folder holding the `SOURCE.jsonl`, relative to the store root. */
  dir: string;
  idt: number;
  idv: number;
  fetchedAt: string;
  /**
   * Fiche "Dernière mise à jour" at download time. `undefined` = a line written
   * before this field existed (the fiche date was not recorded).
   */
  lastUpdated: string | null | undefined;
}

export interface GoldaStoreIndex {
  slugsByIdt: ReadonlyMap<number, ReadonlySet<string>>;
  idtsBySlug: ReadonlyMap<string, ReadonlySet<number>>;
  versions: readonly GoldaStoredVersion[];
}

/** A provenance file the index cannot read: the store is not what the worker expects. */
export class GoldaStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoldaStoreError';
  }
}

const SOURCE_PATH =
  /^([a-z0-9][a-z0-9-]{0,79})\/(\d{4}-\d{2}-\d{2})\/([a-z0-9][a-z0-9-]{0,79})\/SOURCE\.jsonl$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ZIP_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.zip$/i;

const addTo = <K, V>(m: Map<K, Set<V>>, k: K, v: V): void => {
  const s = m.get(k);
  if (s) s.add(v);
  else m.set(k, new Set([v]));
};

/**
 * Index the CSV downloads recorded in the store. Lines without a CSV download
 * URL (Excel delta files, documents) and failed downloads (not HTTP 200, or an
 * HTML answer) are ignored. A line that is not JSON, or a CSV download whose
 * fields are malformed or whose folder is not `<slug>/<date>/<variant>`, throws:
 * the index never guesses what is stored.
 */
export function indexGoldaStore(
  files: readonly GoldaSourceFile[],
): GoldaStoreIndex {
  const slugsByIdt = new Map<number, Set<string>>();
  const idtsBySlug = new Map<string, Set<number>>();
  const versions: GoldaStoredVersion[] = [];
  for (const f of files) {
    f.content.split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      const where = `${f.path}:${i + 1}`;
      let r: Record<string, unknown>;
      try {
        r = JSON.parse(line) as Record<string, unknown>;
      } catch {
        throw new GoldaStoreError(`${where}: not JSON`);
      }
      if (r === null || typeof r !== 'object' || Array.isArray(r))
        throw new GoldaStoreError(`${where}: not an object`);
      const dl =
        typeof r.url === 'string' ? parseGoldaDownloadUrl(r.url) : null;
      if (!dl || r.http_status !== 200 || r.html !== false) return;
      const m = SOURCE_PATH.exec(f.path);
      if (!m)
        throw new GoldaStoreError(
          `${where}: CSV download outside <slug>/<date>/<variant>/`,
        );
      if (typeof r.fetched_at !== 'string' || !ISO_INSTANT.test(r.fetched_at))
        throw new GoldaStoreError(`${where}: fetched_at is not an ISO instant`);
      if (typeof r.sha256 !== 'string' || !SHA256.test(r.sha256))
        throw new GoldaStoreError(`${where}: bad sha256`);
      let lastUpdated: string | null | undefined;
      if ('golda_last_updated' in r) {
        const v = r.golda_last_updated;
        if (v === null) lastUpdated = null;
        else if (typeof v === 'string' && ISO_DAY.test(v)) lastUpdated = v;
        else
          throw new GoldaStoreError(
            `${where}: golda_last_updated is not a day or null`,
          );
      }
      const slug = m[1];
      addTo(slugsByIdt, dl.idt, slug);
      addTo(idtsBySlug, slug, dl.idt);
      versions.push({
        dir: f.path.slice(0, -'/SOURCE.jsonl'.length),
        idt: dl.idt,
        idv: dl.idv,
        fetchedAt: r.fetched_at,
        lastUpdated,
      });
    });
  }
  return { slugsByIdt, idtsBySlug, versions };
}

/**
 * Folder name for a fiche the store has never seen: its title without a trailing
 * "- Tarif Public", accents removed, lower case, `-` between words.
 * `ACME - FREINAGE - Tarif Public` → `acme-freinage`.
 */
export function goldaSlugFromTitle(title: string): string {
  return title
    .replace(/\s+-\s+tarif public\s*$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export type GoldaStorePlan =
  | { action: 'present'; dir: string }
  | { action: 'fetch'; dir: string }
  | { action: 'conflict'; reason: string };

/**
 * Where `pub` (a publication of fiche `ficheId`, with a CSV link) goes.
 *
 * Already stored when a line for the same (fiche, version) carries the same fiche
 * update date. A line written before that date was recorded counts as stored when
 * the fiche shows no update, or an update dated strictly before the download day.
 *
 * Otherwise the publication goes under `<slug>/<applicationDate>/`: `complet` for
 * a version the store has never seen, else (or when `complet` is taken) a sibling
 * named after the version (`complet-v<idv>`) or the update date (`complet-maj-<day>`).
 * `dirExists` answers for a folder relative to the store root.
 */
export function planGoldaStore(
  index: GoldaStoreIndex,
  ficheId: number,
  title: string,
  pub: GoldaPublication,
  dirExists: (relDir: string) => boolean,
): GoldaStorePlan {
  if (!pub.csv)
    throw new Error('planGoldaStore: publication without a CSV link');
  const { idv } = pub.csv;
  const known = index.slugsByIdt.get(ficheId);
  if (known && known.size > 1)
    return { action: 'conflict', reason: 'fiche stored under several folders' };
  const slug = known ? [...known][0] : goldaSlugFromTitle(title);
  if (!slug)
    return { action: 'conflict', reason: 'title gives no folder name' };
  const owners = index.idtsBySlug.get(slug);
  if (owners && [...owners].some((idt) => idt !== ficheId))
    return { action: 'conflict', reason: 'folder used by another fiche' };

  const same = index.versions.filter((v) => v.idt === ficheId && v.idv === idv);
  const stored = same.find((v) =>
    v.lastUpdated !== undefined
      ? v.lastUpdated === pub.lastUpdated
      : pub.lastUpdated === null || pub.lastUpdated < v.fetchedAt.slice(0, 10),
  );
  if (stored) return { action: 'present', dir: stored.dir };

  const base = `${slug}/${pub.applicationDate}`;
  const variants =
    same.length === 0
      ? ['complet', `complet-v${idv}`]
      : [
          'complet',
          ...(pub.lastUpdated ? [`complet-maj-${pub.lastUpdated}`] : []),
        ];
  const free = variants.find((v) => !dirExists(`${base}/${v}`));
  return free
    ? { action: 'fetch', dir: `${base}/${free}` }
    : { action: 'conflict', reason: 'every candidate folder already exists' };
}

/**
 * Zip file name from a `Content-Disposition` header: a plain `.zip` name or
 * `null` (no header, no file name, a path, any other character).
 */
export function goldaZipFileName(
  contentDisposition: string | null | undefined,
): string | null {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(
    contentDisposition ?? '',
  );
  return m && ZIP_NAME.test(m[1]) ? m[1] : null;
}

export interface GoldaSourceInput {
  url: string;
  httpStatus: number;
  contentType: string | null;
  contentDispositionFilename: string;
  file: string;
  bytes: number;
  sha256: string;
  fetchedAt: string;
  publication: GoldaPublication;
  extractFile: string;
  extractSha256: string;
}

/** One `SOURCE.jsonl` line for a stored CSV download (newline included). */
export function goldaSourceLine(i: GoldaSourceInput): string {
  return (
    JSON.stringify({
      source: 'golda',
      url: i.url,
      http_status: i.httpStatus,
      content_type: i.contentType,
      content_disposition_filename: i.contentDispositionFilename,
      file: i.file,
      bytes: i.bytes,
      sha256: i.sha256,
      fetched_at: i.fetchedAt,
      html: false,
      golda_application_date: i.publication.applicationDate,
      golda_last_updated: i.publication.lastUpdated,
      extract_file: i.extractFile,
      extract_sha256: i.extractSha256,
    }) + '\n'
  );
}
