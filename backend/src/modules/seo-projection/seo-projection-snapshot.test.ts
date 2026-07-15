/**
 * Tests du builder de snapshot reproductible (P2-R3-B). Prouve les invariants dont dépend le replay :
 * reproductibilité bit-à-bit (ordre-indépendant), sensibilité au contenu, validité tar (roundtrip zstd),
 * publication atomique archive→manifest, et cohérence du manifest sidecar.
 */
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import {
  buildDeterministicTar,
  buildTarZst,
  sha256Hex,
  digestEntries,
  buildAndPublishSnapshot,
  type SnapshotEntry,
} from './seo-projection-snapshot';

const e = (name: string, body: string): SnapshotEntry => ({
  name,
  data: Buffer.from(body, 'utf-8'),
});

const VERSIONS = {
  projection_contract_version: '1.0.0',
  builder_version: '1.0.0',
  pipeline_version: '1.0.0',
  extractor_version: '1.0.0',
  runner_version: '1.0.0',
};

describe('seo-projection-snapshot builder', () => {
  it('reproductible : deux ensembles identiques (ordre différent) → même sha256', () => {
    const a = [e('b.json', '{"x":2}'), e('a.json', '{"x":1}')];
    const b = [e('a.json', '{"x":1}'), e('b.json', '{"x":2}')];
    expect(sha256Hex(buildTarZst(a))).toBe(sha256Hex(buildTarZst(b)));
  });

  it('sensible au contenu : un octet différent → hash différent', () => {
    const a = [e('a.json', '{"x":1}')];
    const b = [e('a.json', '{"x":2}')];
    expect(sha256Hex(buildTarZst(a))).not.toBe(sha256Hex(buildTarZst(b)));
  });

  it('déterministe : deux compressions du même input → mêmes octets', () => {
    const a = [e('a.json', '{"x":1}'), e('b.json', '{"y":2}')];
    expect(Buffer.compare(buildTarZst(a), buildTarZst(a))).toBe(0);
  });

  it('tar USTAR valide : roundtrip zstd == tar, headers normalisés (2 blocs nuls de fin)', () => {
    const entries = [e('a.json', 'hello'), e('b.json', 'world!!')];
    const tar = buildDeterministicTar(entries);
    const rt = zstdDecompressSync(buildTarZst(entries));
    expect(Buffer.compare(rt, tar)).toBe(0);
    // Taille multiple de 512 (blocs padés) + au moins 2 blocs nuls de fin.
    expect(tar.length % 512).toBe(0);
    const tail = tar.subarray(tar.length - 1024);
    expect(tail.every((byte) => byte === 0)).toBe(true);
    // uid/gid = 0 (offset 108/116), mtime = 0 (offset 136) → reproductibilité.
    expect(tar.toString('ascii', 108, 115)).toBe('0000000');
    expect(tar.toString('ascii', 136, 147)).toBe('00000000000');
  });

  it('digestEntries : inventaire trié {name, sha256(64hex), size}', () => {
    const digests = digestEntries([e('b.json', 'BB'), e('a.json', 'A')]);
    expect(digests.map((d) => d.name)).toEqual(['a.json', 'b.json']);
    expect(digests[0]).toMatchObject({ name: 'a.json', size: 1 });
    expect(digests[0].sha256).toHaveLength(64);
    expect(digests[1]).toMatchObject({ name: 'b.json', size: 2 });
  });

  describe('buildAndPublishSnapshot (I/O durable)', () => {
    let root: string;
    beforeEach(async () => {
      root = await fs.mkdtemp(path.join(os.tmpdir(), 'snap-test-'));
    });
    afterEach(async () => {
      await fs.rm(root, { recursive: true, force: true });
    });

    it('publie archive + manifest ; hash = sha256 des octets PERSISTÉS ; manifest = commit marker', async () => {
      const entries = [e('a.json', '{"entity_id":"gamme:a"}')];
      const pub = await buildAndPublishSnapshot({
        objectStoreRoot: root,
        entries,
        runId: 'run-xyz',
        wikiCommitSha: 'abc1234',
        versions: VERSIONS,
      });

      // hash format sha256:<hex> et fichiers écrits sous exports-snapshots/.
      expect(pub.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      const hex = pub.hash.split(':')[1];
      expect(pub.uri).toBe(
        path.join(root, 'exports-snapshots', `${hex}.tar.zst`),
      );

      // hash == sha256 des octets réellement persistés (pas d'une repr. mémoire divergente).
      const persisted = await fs.readFile(pub.uri);
      expect(`sha256:${sha256Hex(persisted)}`).toBe(pub.hash);

      // Manifest sidecar présent + cohérent.
      const manifest = JSON.parse(await fs.readFile(pub.manifestUri, 'utf-8'));
      expect(manifest.snapshot_hash).toBe(pub.hash);
      expect(manifest.versions).toEqual(VERSIONS);
      expect(manifest.wiki_commit_sha).toBe('abc1234');
      expect(manifest.entry_count).toBe(1);
      expect(manifest.entries[0]).toMatchObject({ name: 'a.json' });
      expect(manifest.entries[0].sha256).toHaveLength(64);
      // Pas de fichiers temporaires résiduels (rename atomique).
      const files = await fs.readdir(path.join(root, 'exports-snapshots'));
      expect(files.some((f) => f.includes('.tmp-'))).toBe(false);
    });

    it('deux publications du même input → même hash + même chemin (idempotence de contenu)', async () => {
      const entries = [e('a.json', '{"k":1}'), e('b.json', '{"k":2}')];
      const p1 = await buildAndPublishSnapshot({
        objectStoreRoot: root,
        entries,
        runId: 'run-1',
        wikiCommitSha: null,
        versions: VERSIONS,
      });
      const p2 = await buildAndPublishSnapshot({
        objectStoreRoot: root,
        entries: [entries[1], entries[0]], // ordre inversé
        runId: 'run-2',
        wikiCommitSha: null,
        versions: VERSIONS,
      });
      expect(p2.hash).toBe(p1.hash);
      expect(p2.uri).toBe(p1.uri);
    });
  });
});
