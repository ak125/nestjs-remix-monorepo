import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ExportRelationSchema } from './diagnostic-projection.types';
import {
  DiagnosticExportsInvalidError,
  loadDiagnosticExports,
} from './diagnostic-projection-exports-loader';

const WIKI_COMMIT = 'a'.repeat(40);
const CATALOG_COMMIT = 'c'.repeat(40);

// Même sérialisation que le builder WIKI : indent 2, newline final.
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (text: string | Buffer) =>
  `sha256:${createHash('sha256').update(text).digest('hex')}`;

function envelope(slug: string, relationCount = 1) {
  return {
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_gamme',
    gamme_slug: slug,
    wiki_path: `wiki/gamme/${slug}.md`,
    source_wiki_commit: WIKI_COMMIT,
    source_catalog_commit: CATALOG_COMMIT,
    content_hash: `sha256:${'d'.repeat(64)}`,
    relations: Array.from({ length: relationCount }, (_, i) => ({
      relation_index: i,
    })),
  };
}

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'diag-exports-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** Écrit un export cohérent : l'index hache les octets réellement écrits. */
async function writeExports(
  gammes: Array<{ slug: string; body?: unknown; relationCount?: number }>,
  indexOverrides: Record<string, unknown> = {},
) {
  await fs.mkdir(path.join(root, 'gamme'), { recursive: true });
  const files = [];
  for (const gamme of gammes) {
    const text = serialize(gamme.body ?? envelope(gamme.slug));
    await fs.writeFile(path.join(root, 'gamme', `${gamme.slug}.json`), text);
    files.push({
      path: `gamme/${gamme.slug}.json`,
      sha256: sha256(text),
      source_wiki_commit: WIKI_COMMIT,
      relation_count: gamme.relationCount ?? 1,
    });
  }
  const index = {
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_index',
    source_catalog_commit: CATALOG_COMMIT,
    files,
    ...indexOverrides,
  };
  const text = serialize(index);
  await fs.writeFile(path.join(root, '_index.json'), text);
  return { index, indexText: text };
}

async function expectCode(code: string) {
  const error = await loadDiagnosticExports(root).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DiagnosticExportsInvalidError);
  expect((error as DiagnosticExportsInvalidError).code).toBe(code);
}

describe('loadDiagnosticExports', () => {
  it('loads a consistent export and hashes the raw index bytes', async () => {
    const { indexText } = await writeExports([
      { slug: 'filtre-a-air' },
      { slug: 'filtre-d-habitacle' },
    ]);
    const loaded = await loadDiagnosticExports(root);
    expect(loaded.indexSha256).toBe(sha256(indexText));
    expect(loaded.builderVersion).toBe('1.0.0');
    expect(loaded.files.map((file) => file.path)).toEqual([
      'gamme/filtre-a-air.json',
      'gamme/filtre-d-habitacle.json',
    ]);
    expect(loaded.files[0].envelope.wiki_path).toBe(
      'wiki/gamme/filtre-a-air.md',
    );
  });

  it('accepts an index with zero files and no gamme directory', async () => {
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({
        schema_version: '1.0.0',
        builder_version: '1.0.0',
        export_kind: 'diagnostic_index',
        source_catalog_commit: CATALOG_COMMIT,
        files: [],
      }),
    );
    const loaded = await loadDiagnosticExports(root);
    expect(loaded.files).toEqual([]);
  });

  it('exports_root_missing', async () => {
    await fs.rm(root, { recursive: true, force: true });
    await expectCode('exports_root_missing');
  });

  it('a stat failure other than ENOENT propagates, never "exports_root_missing"', async () => {
    const blocker = path.join(root, '_index.json');
    await fs.writeFile(blocker, '{}');
    // Un fichier au milieu du chemin → ENOTDIR, pas ENOENT.
    const failure = await loadDiagnosticExports(
      path.join(blocker, 'diagnostic'),
    ).catch((error: unknown) => error);
    expect(failure).not.toBeInstanceOf(DiagnosticExportsInvalidError);
    expect((failure as NodeJS.ErrnoException).code).toBe('ENOTDIR');
  });

  it('index_invalid: missing, unreadable JSON, other major version', async () => {
    await expectCode('index_invalid');
    await fs.writeFile(path.join(root, '_index.json'), '{');
    await expectCode('index_invalid');
    await writeExports([{ slug: 'filtre-a-air' }], { schema_version: '2.0.0' });
    await expectCode('index_invalid');
  });

  it('duplicate_index_path', async () => {
    const { index } = await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({ ...index, files: [index.files[0], index.files[0]] }),
    );
    await expectCode('duplicate_index_path');
  });

  it('listed_file_missing', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.rm(path.join(root, 'gamme', 'filtre-a-air.json'));
    await expectCode('listed_file_missing');
  });

  it('listed_file_missing when the gamme directory is absent but the index lists files', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.rm(path.join(root, 'gamme'), { recursive: true });
    await expectCode('listed_file_missing');
  });

  it('unlisted_file_present', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.writeFile(path.join(root, 'gamme', 'orpheline.json'), '{}\n');
    await expectCode('unlisted_file_present');
  });

  it('non_regular_file: a symlink in gamme/ or as the index', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    const target = path.join(root, 'gamme', 'filtre-a-air.json');
    const moved = path.join(root, 'ailleurs.json');
    await fs.rename(target, moved);
    await fs.symlink(moved, target);
    await expectCode('non_regular_file');

    await fs.rm(target);
    await fs.rename(moved, target);
    const index = path.join(root, '_index.json');
    await fs.rename(index, path.join(root, 'index-reel.json'));
    await fs.symlink(path.join(root, 'index-reel.json'), index);
    await expectCode('non_regular_file');
  });

  it('sha256_mismatch when a file changed after the index was written', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.appendFile(path.join(root, 'gamme', 'filtre-a-air.json'), ' ');
    await expectCode('sha256_mismatch');
  });

  it('envelope_invalid', async () => {
    await writeExports([
      {
        slug: 'filtre-a-air',
        body: { ...envelope('filtre-a-air'), relations: [] },
      },
    ]);
    await expectCode('envelope_invalid');
  });

  it.each([
    [
      'gamme_slug',
      {
        gamme_slug: 'filtre-a-huile',
        wiki_path: 'wiki/gamme/filtre-a-huile.md',
      },
    ],
    ['wiki_path', { wiki_path: 'wiki/gamme/autre.md' }],
    ['source_wiki_commit', { source_wiki_commit: 'e'.repeat(40) }],
    ['source_catalog_commit', { source_catalog_commit: 'e'.repeat(40) }],
    ['builder_version', { builder_version: '1.0.1' }],
  ])('envelope_mismatch: %s', async (_field, overrides) => {
    await writeExports([
      {
        slug: 'filtre-a-air',
        body: { ...envelope('filtre-a-air'), ...overrides },
      },
    ]);
    await expectCode('envelope_mismatch');
  });

  it('envelope_mismatch: relation_count', async () => {
    await writeExports([{ slug: 'filtre-a-air', relationCount: 2 }]);
    await expectCode('envelope_mismatch');
  });
});

describe('ExportRelationSchema (contrat WIKI frontmatter.schema.json)', () => {
  const relation = {
    relation_index: 0,
    symptom_slug: 'bruit_moteur',
    system_slug: 'freinage',
    relation_to_part: 'possible_cause',
    part_role: 'Filtre colmaté qui réduit le débit.',
    evidence: {
      confidence: 'high',
      source_policy: '1_high',
      reviewed: false,
      diagnostic_safe: false,
    },
    confidence_score_computed: 0.5,
    sources: [{ slug: 'src-a', raw_proven: true }],
  };
  const withEvidence = (evidence: Record<string, unknown>) => ({
    ...relation,
    evidence: { ...relation.evidence, ...evidence },
  });

  it('accepts a valid relation', () => {
    expect(ExportRelationSchema.safeParse(relation).success).toBe(true);
  });

  it('requires relation_index as a non-negative integer', () => {
    const { relation_index: _omit, ...without } = relation;
    expect(ExportRelationSchema.safeParse(without).success).toBe(false);
    expect(
      ExportRelationSchema.safeParse({ ...relation, relation_index: -1 })
        .success,
    ).toBe(false);
  });
  it('accepts a hyphenated symptom_slug', () => {
    expect(
      ExportRelationSchema.safeParse({
        ...relation,
        symptom_slug: 'bruit-moteur',
      }).success,
    ).toBe(true);
  });
  it('rejects a symptom_slug starting with a digit', () => {
    expect(
      ExportRelationSchema.safeParse({ ...relation, symptom_slug: '1bruit' })
        .success,
    ).toBe(false);
  });
  it('rejects an unknown confidence', () => {
    expect(
      ExportRelationSchema.safeParse(withEvidence({ confidence: 'bogus' }))
        .success,
    ).toBe(false);
  });
  it('rejects an unknown source_policy and accepts 2_medium_concordant', () => {
    expect(
      ExportRelationSchema.safeParse(
        withEvidence({ source_policy: 'oem_or_two_independent' }),
      ).success,
    ).toBe(false);
    expect(
      ExportRelationSchema.safeParse(
        withEvidence({ source_policy: '2_medium_concordant' }),
      ).success,
    ).toBe(true);
  });
});

describe('loadDiagnosticExports: additional branches', () => {
  it('envelope_invalid when a listed file is not JSON', async () => {
    await fs.mkdir(path.join(root, 'gamme'), { recursive: true });
    const text = 'pas du json\n';
    await fs.writeFile(path.join(root, 'gamme', 'filtre-a-air.json'), text);
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({
        schema_version: '1.0.0',
        builder_version: '1.0.0',
        export_kind: 'diagnostic_index',
        source_catalog_commit: CATALOG_COMMIT,
        files: [
          {
            path: 'gamme/filtre-a-air.json',
            sha256: sha256(text),
            source_wiki_commit: WIKI_COMMIT,
            relation_count: 1,
          },
        ],
      }),
    );
    await expectCode('envelope_invalid');
  });

  it('non_regular_file: a subdirectory inside gamme/', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.mkdir(path.join(root, 'gamme', 'sous-dossier'));
    await expectCode('non_regular_file');
  });

  it('non_regular_file: gamme/ itself a symlink', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    const real = path.join(root, 'gamme-reel');
    await fs.rename(path.join(root, 'gamme'), real);
    await fs.symlink(real, path.join(root, 'gamme'));
    await expectCode('non_regular_file');
  });

  it('index_invalid: an index entry path failing the path regex', async () => {
    const { index } = await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({
        ...index,
        files: [{ ...index.files[0], path: '../evasion.json' }],
      }),
    );
    await expectCode('index_invalid');
  });
});
