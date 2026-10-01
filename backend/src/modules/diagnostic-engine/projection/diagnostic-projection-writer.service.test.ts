import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DiagnosticProjectionReference } from '../diagnostic-engine.data-service';
import {
  DiagnosticProjectionContractError,
  DiagnosticProjectionWriterService,
} from './diagnostic-projection-writer.service';

const COMMIT = 'a'.repeat(40);
const HASH = `sha256:${'b'.repeat(64)}`;
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (text: string) =>
  `sha256:${createHash('sha256').update(text).digest('hex')}`;

const reference: DiagnosticProjectionReference = {
  systems: [
    {
      id: 1,
      slug: 'filtration',
      label: 'Filtration',
      description: null,
      display_order: 1,
      active: true,
    },
  ],
  symptoms: [
    {
      id: 10,
      slug: 'perte_puissance_filtration',
      system_id: 1,
      label: 'Perte de puissance',
      description: null,
      signal_mode: 'symptom_slugs',
      urgency: 'moyenne',
      active: true,
    },
  ],
  causes: [
    {
      id: 20,
      slug: 'filtre_air_colmate',
      system_id: 1,
      label: 'Filtre à air colmaté',
      cause_type: 'maintenance_related',
      description: null,
      verification_method: null,
      urgency: 'moyenne',
      active: true,
    },
  ],
  links: [
    {
      id: 113,
      symptom_id: 10,
      cause_id: 20,
      relative_score: 60,
      evidence_for: [],
      evidence_against: [],
      requires_verification: true,
      active: true,
    },
  ],
};

function relation(rawProven: boolean) {
  return {
    relation_index: 0,
    relation_sha256: HASH,
    symptom_slug: 'perte_puissance_filtration',
    system_slug: 'filtration',
    relation_to_part: 'possible_cause',
    part_role: 'Un filtre colmaté réduit le débit disponible.',
    evidence: {
      confidence: 'medium',
      source_policy: '2_medium_concordant',
      reviewed: true,
      diagnostic_safe: false,
    },
    confidence_score_computed: 0.6,
    sources: [
      {
        slug: 'oem_doc',
        catalog_slug: 'oem_doc',
        type: 'oem',
        status: 'active',
        raw_ref: null,
        raw_proven: rawProven,
      },
    ],
  };
}

let root: string;
let indexText: string;

async function writeExports(rawProven: boolean) {
  await fs.mkdir(path.join(root, 'gamme'), { recursive: true });
  const text = serialize({
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_gamme',
    gamme_slug: 'filtre-a-air',
    wiki_path: 'wiki/gamme/filtre-a-air.md',
    source_wiki_commit: COMMIT,
    source_catalog_commit: COMMIT,
    content_hash: HASH,
    relations: [relation(rawProven)],
  });
  await fs.writeFile(path.join(root, 'gamme', 'filtre-a-air.json'), text);
  indexText = serialize({
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_index',
    source_catalog_commit: COMMIT,
    files: [
      {
        path: 'gamme/filtre-a-air.json',
        sha256: sha256(text),
        source_wiki_commit: COMMIT,
        relation_count: 1,
      },
    ],
  });
  await fs.writeFile(path.join(root, '_index.json'), indexText);
}

function makeWriter(
  options: {
    readOnly?: boolean;
    rpc?: jest.Mock;
    insertError?: { message: string } | null;
    reference?: jest.Mock;
  } = {},
) {
  const rpc =
    options.rpc ??
    jest.fn().mockResolvedValue({
      data: {
        run_id: 7,
        projected_count: 1,
        conflict_count: 0,
        retired_count: 0,
      },
      error: null,
    });
  const insert = jest
    .fn()
    .mockResolvedValue({ error: options.insertError ?? null });
  const from = jest.fn().mockReturnValue({ insert });
  const evaluate = jest
    .fn()
    .mockReturnValue({ decision: 'ALLOW', reason: 'INTERNAL_SERVICE_ROLE' });
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const writer = Object.create(
    DiagnosticProjectionWriterService.prototype,
  ) as DiagnosticProjectionWriterService;
  Object.assign(writer, {
    logger,
    supabase: { rpc, from },
    rpcGate: { evaluate, log: jest.fn() },
    isReadOnlyMode: options.readOnly ?? false,
    configService: { get: jest.fn().mockReturnValue(root) },
    referenceData: {
      getProjectionReference:
        options.reference ?? jest.fn().mockResolvedValue(reference),
    },
  });
  return { writer, rpc, insert, from, evaluate, logger };
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'diag-writer-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('DiagnosticProjectionWriterService.run', () => {
  it('READ_ONLY: skips before reading anything', async () => {
    const { writer, rpc, from, logger } = makeWriter({ readOnly: true });
    await expect(writer.run('admin')).resolves.toEqual({
      status: 'skipped',
      reason: 'READ_ONLY',
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'readonly.skipped', operation: 'run' }),
      expect.any(String),
    );
  });

  it('calls the apply RPC once, as an internal service_role caller, with the full payload', async () => {
    await writeExports(true);
    const { writer, rpc, evaluate, from } = makeWriter();

    const result = await writer.run('repeatable');

    expect(result).toEqual({
      status: 'applied',
      exportedCount: 1,
      run_id: 7,
      projected_count: 1,
      conflict_count: 0,
      retired_count: 0,
    });
    expect(evaluate).toHaveBeenCalledWith('__diag_projection_apply', {
      source: 'internal',
      isServiceRole: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    // Portée du rôle : un run appliqué n'écrit QUE par la RPC, jamais par .from().
    expect(from).not.toHaveBeenCalled();
    const payload = rpc.mock.calls[0][1].p_run;
    expect(payload).toMatchObject({
      triggered_by: 'repeatable',
      runtime_env: expect.any(String),
      index_sha256: sha256(indexText),
      builder_version: '1.0.0',
      exported_count: 1,
      conflicts: [],
    });
    expect(payload.projections).toEqual([
      expect.objectContaining({
        link_id: 113,
        wiki_path: 'wiki/gamme/filtre-a-air.md',
      }),
    ]);
    expect(Date.parse(payload.started_at)).not.toBeNaN();
  });

  it('launch state: sends the unproven relation as a conflict, never as a projection', async () => {
    await writeExports(false);
    const { writer, rpc } = makeWriter({
      rpc: jest.fn().mockResolvedValue({
        data: {
          run_id: 7,
          projected_count: 0,
          conflict_count: 1,
          retired_count: 0,
        },
        error: null,
      }),
    });
    await writer.run('admin');
    const payload = rpc.mock.calls[0][1].p_run;
    expect(payload.projections).toEqual([]);
    expect(payload.conflicts).toEqual([
      expect.objectContaining({
        reason: 'source_not_raw_proven',
        detail: { link_id: 113, unproven_sources: ['oem_doc'] },
      }),
    ]);
  });

  it('pre-validation failure: records a failed run, never calls the RPC', async () => {
    const { writer, rpc, from, insert } = makeWriter();
    const result = await writer.run('admin');
    expect(result).toEqual({
      status: 'failed',
      error: expect.stringContaining('index_invalid'),
    });
    expect(rpc).not.toHaveBeenCalled();
    // Portée du rôle : la seule écriture directe est la ligne de run en échec.
    expect(from.mock.calls).toEqual([['__diag_projection_runs']]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        triggered_by: 'admin',
        status: 'failed',
        exported_count: 0,
        index_sha256: null,
        error: expect.stringContaining('index_invalid'),
      }),
    );
  });

  it('reference read failure: failed run keeps the index hash that was loaded', async () => {
    await writeExports(true);
    const { writer, rpc, insert } = makeWriter({
      reference: jest
        .fn()
        .mockRejectedValue(new Error('__diag_cause truncated')),
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'failed',
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        index_sha256: sha256(indexText),
        builder_version: '1.0.0',
        error: '__diag_cause truncated',
      }),
    );
  });

  it('RPC failure: records a failed run with the exported count', async () => {
    await writeExports(true);
    const { writer, insert } = makeWriter({
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: '1 lien(s) à projeter, 0 encore actif(s)' },
      }),
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'failed',
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        exported_count: 1,
        error: expect.stringContaining('encore actif'),
      }),
    );
  });

  it('throws when the failed run itself cannot be recorded', async () => {
    const { writer } = makeWriter({
      insertError: {
        message: 'permission denied for table __diag_projection_runs',
      },
    });
    await expect(writer.run('admin')).rejects.toThrow(
      'could not be recorded: permission denied',
    );
  });

  it('throws when the RPC answers outside its contract', async () => {
    await writeExports(true);
    const { writer } = makeWriter({
      rpc: jest.fn().mockResolvedValue({ data: { run_id: 'x' }, error: null }),
    });
    await expect(writer.run('admin')).rejects.toBeInstanceOf(
      DiagnosticProjectionContractError,
    );
  });

  it.each([
    ['projected_count', { projected_count: 2, conflict_count: 0 }],
    ['conflict_count', { projected_count: 1, conflict_count: 1 }],
  ])(
    'throws DiagnosticProjectionContractError when the committed %s disagrees with the payload',
    async (_field, counts) => {
      await writeExports(true);
      const { writer } = makeWriter({
        rpc: jest.fn().mockResolvedValue({
          data: { run_id: 7, retired_count: 0, ...counts },
          error: null,
        }),
      });
      await expect(writer.run('admin')).rejects.toBeInstanceOf(
        DiagnosticProjectionContractError,
      );
    },
  );

  it('empty index: warns with the retired count', async () => {
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({
        schema_version: '1.0.0',
        builder_version: '1.0.0',
        export_kind: 'diagnostic_index',
        source_catalog_commit: COMMIT,
        files: [],
      }),
    );
    const { writer, logger } = makeWriter({
      rpc: jest.fn().mockResolvedValue({
        data: {
          run_id: 8,
          projected_count: 0,
          conflict_count: 0,
          retired_count: 3,
        },
        error: null,
      }),
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'applied',
      retired_count: 3,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ retired_count: 3 }),
      expect.stringContaining('3 provenance(s) retirée(s)'),
    );
  });

  it('raw fs error from the loader: records a failed run, never calls the RPC', async () => {
    // Valid index whose single entry has a 300-char file name; the parent
    // directory exists (empty), so lstat fails with a raw ENAMETOOLONG
    // (not ENOENT, which the loader types).
    await fs.mkdir(path.join(root, 'gamme'));
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({
        schema_version: '1.0.0',
        builder_version: '1.0.0',
        export_kind: 'diagnostic_index',
        source_catalog_commit: COMMIT,
        files: [
          {
            path: `gamme/${'a'.repeat(300)}.json`,
            sha256: HASH,
            source_wiki_commit: COMMIT,
            relation_count: 1,
          },
        ],
      }),
    );
    const { writer, rpc, insert } = makeWriter();

    const result = await writer.run('admin');

    expect(result).toEqual({
      status: 'failed',
      error: expect.stringContaining('ENAMETOOLONG'),
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        index_sha256: null,
      }),
    );
  });

  it('resolver integrity breach: records a failed run, never calls the RPC', async () => {
    await writeExports(true);
    const duplicatedPair = {
      ...reference.links[0],
      id: 114,
    };
    const { writer, rpc, insert } = makeWriter({
      reference: jest.fn().mockResolvedValue({
        ...reference,
        links: [...reference.links, duplicatedPair],
      }),
    });

    const result = await writer.run('admin');

    expect(result).toEqual({
      status: 'failed',
      error: expect.stringContaining('dupliquée (liens 113 et 114)'),
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
    // The loader succeeded before the resolver threw: its hash is recorded.
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        index_sha256: sha256(indexText),
        builder_version: '1.0.0',
      }),
    );
  });
});
