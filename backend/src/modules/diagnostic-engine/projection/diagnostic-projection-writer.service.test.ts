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
        raw_ref: {
          repo: 'automecanik-raw',
          manifest_id: 'rec-oem-doc',
          expected_sha256: `sha256:${'c'.repeat(64)}`,
        },
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
    schema_version: '2.0.0',
    builder_version: '2.0.0',
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
    schema_version: '2.0.0',
    builder_version: '2.0.0',
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

type RpcReply = { data: unknown; error: { message: string } | null };

const APPLY = '__diag_projection_apply';
const RECORD_FAILURE = '__diag_projection_record_failure';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Clés lues par les deux fonctions SQL (migration 20261010_diag_link_provenance).
const APPLY_KEYS = [
  'builder_version',
  'conflicts',
  'exported_count',
  'index_sha256',
  'projections',
  'run_key',
  'runtime_env',
  'started_at',
  'triggered_by',
];
const FAILURE_KEYS = [
  'builder_version',
  'error',
  'exported_count',
  'index_sha256',
  'run_key',
  'runtime_env',
  'started_at',
  'triggered_by',
];

function makeWriter(
  options: {
    readOnly?: boolean;
    apply?: RpcReply;
    record?: RpcReply;
    reference?: jest.Mock;
  } = {},
) {
  const replies: Record<string, RpcReply> = {
    [APPLY]: options.apply ?? {
      data: {
        run_id: 7,
        projected_count: 1,
        conflict_count: 0,
        retired_count: 0,
      },
      error: null,
    },
    [RECORD_FAILURE]: options.record ?? {
      data: { run_id: 9, status: 'failed' },
      error: null,
    },
  };
  const rpc = jest.fn((name: string) =>
    replies[name]
      ? Promise.resolve(replies[name])
      : Promise.reject(new Error(`unexpected rpc ${name}`)),
  );
  // Aucune écriture directe : les deux RPC SECURITY DEFINER sont les seules voies.
  const from = jest.fn();
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
  const runs = (name: string) =>
    rpc.mock.calls
      .filter(([called]) => called === name)
      .map(
        (call) =>
          (call as unknown as [string, { p_run: Record<string, unknown> }])[1]
            .p_run,
      );
  return { writer, rpc, from, evaluate, logger, runs };
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
    const { writer, rpc, evaluate, from, runs } = makeWriter();

    const result = await writer.run('repeatable');

    expect(result).toEqual({
      status: 'applied',
      exportedCount: 1,
      run_id: 7,
      projected_count: 1,
      conflict_count: 0,
      retired_count: 0,
    });
    expect(evaluate).toHaveBeenCalledWith(APPLY, {
      source: 'internal',
      isServiceRole: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
    const [payload] = runs(APPLY);
    expect(Object.keys(payload).sort()).toEqual(APPLY_KEYS);
    expect(payload).toMatchObject({
      run_key: expect.stringMatching(UUID_RE),
      triggered_by: 'repeatable',
      runtime_env: expect.any(String),
      index_sha256: sha256(indexText),
      builder_version: '2.0.0',
      exported_count: 1,
      conflicts: [],
    });
    expect(payload.projections).toEqual([
      expect.objectContaining({
        link_id: 113,
        wiki_path: 'wiki/gamme/filtre-a-air.md',
      }),
    ]);
    expect(Date.parse(String(payload.started_at))).not.toBeNaN();
  });

  it('draws a fresh run_key for every run', async () => {
    await writeExports(true);
    const { writer, runs } = makeWriter();
    await writer.run('admin');
    await writer.run('admin');
    const [first, second] = runs(APPLY).map((payload) => payload.run_key);
    expect(first).toMatch(UUID_RE);
    expect(second).toMatch(UUID_RE);
    expect(first).not.toBe(second);
  });

  it('launch state: sends the unproven relation as a conflict, never as a projection', async () => {
    await writeExports(false);
    const { writer, runs } = makeWriter({
      apply: {
        data: {
          run_id: 7,
          projected_count: 0,
          conflict_count: 1,
          retired_count: 0,
        },
        error: null,
      },
    });
    await writer.run('admin');
    const [payload] = runs(APPLY);
    expect(payload.projections).toEqual([]);
    expect(payload.conflicts).toEqual([
      expect.objectContaining({
        reason: 'source_not_raw_proven',
        detail: { link_id: 113, unproven_sources: ['oem_doc'] },
      }),
    ]);
  });

  it('pre-validation failure: records the failure by RPC, never calls apply', async () => {
    const { writer, from, evaluate, runs, logger } = makeWriter();
    const result = await writer.run('admin');
    expect(result).toEqual({
      status: 'failed',
      runId: 9,
      error: expect.stringContaining('index_invalid'),
    });
    expect(runs(APPLY)).toEqual([]);
    expect(from).not.toHaveBeenCalled();
    expect(evaluate).toHaveBeenCalledWith(RECORD_FAILURE, {
      source: 'internal',
      isServiceRole: true,
    });
    const failures = runs(RECORD_FAILURE);
    expect(failures).toHaveLength(1);
    expect(Object.keys(failures[0]).sort()).toEqual(FAILURE_KEYS);
    expect(failures[0]).toMatchObject({
      run_key: expect.stringMatching(UUID_RE),
      triggered_by: 'admin',
      // Index illisible : rien n'est connu de l'export.
      exported_count: null,
      index_sha256: null,
      builder_version: null,
      error: expect.stringContaining('index_invalid'),
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'diagnostic_projection.failed',
        run_id: 9,
      }),
      expect.any(String),
    );
  });

  it('reference read failure: the failure keeps what the loaded export says', async () => {
    await writeExports(true);
    const { writer, runs } = makeWriter({
      reference: jest
        .fn()
        .mockRejectedValue(new Error('__diag_cause truncated')),
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'failed',
    });
    expect(runs(APPLY)).toEqual([]);
    expect(runs(RECORD_FAILURE)).toEqual([
      expect.objectContaining({
        index_sha256: sha256(indexText),
        builder_version: '2.0.0',
        exported_count: 1,
        error: '__diag_cause truncated',
      }),
    ]);
  });

  it('blank error message: records "unknown error" (the base refuses a blank error)', async () => {
    await writeExports(true);
    const { writer, runs } = makeWriter({
      reference: jest.fn().mockRejectedValue(new Error('   ')),
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'failed',
      error: 'unknown error',
    });
    expect(runs(RECORD_FAILURE)[0].error).toBe('unknown error');
  });

  it('apply failure: records the failure under the SAME run_key', async () => {
    await writeExports(true);
    const { writer, runs } = makeWriter({
      apply: {
        data: null,
        error: { message: '1 lien(s) à projeter, 0 encore actif(s)' },
      },
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'failed',
      runId: 9,
    });
    const [applied] = runs(APPLY);
    const [failure] = runs(RECORD_FAILURE);
    expect(failure.run_key).toBe(applied.run_key);
    expect(failure).toMatchObject({
      index_sha256: sha256(indexText),
      builder_version: '2.0.0',
      exported_count: 1,
      started_at: applied.started_at,
      error: expect.stringContaining('encore actif'),
    });
  });

  it('apply committed but its answer was lost: reports applied_unconfirmed, not a failure', async () => {
    await writeExports(true);
    const { writer, logger } = makeWriter({
      apply: { data: null, error: { message: 'fetch failed' } },
      record: { data: { run_id: 7, status: 'applied' }, error: null },
    });
    await expect(writer.run('admin')).resolves.toEqual({
      status: 'applied_unconfirmed',
      runId: 7,
      error: expect.stringContaining('fetch failed'),
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'diagnostic_projection.applied_unconfirmed',
        run_id: 7,
      }),
      expect.any(String),
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'diagnostic_projection.failed' }),
      expect.anything(),
    );
  });

  it('throws when the failure itself cannot be recorded', async () => {
    const { writer, logger } = makeWriter({
      record: {
        data: null,
        error: { message: 'permission denied for function' },
      },
    });
    await expect(writer.run('admin')).rejects.toThrow(
      'could not be recorded: permission denied',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'diagnostic_projection.failed',
        recorded: false,
      }),
      expect.any(String),
    );
  });

  it('throws DiagnosticProjectionContractError when the failure RPC answers outside its contract', async () => {
    const { writer } = makeWriter({
      record: { data: { run_id: 9, status: 'pending' }, error: null },
    });
    await expect(writer.run('admin')).rejects.toBeInstanceOf(
      DiagnosticProjectionContractError,
    );
  });

  it('throws when the apply RPC answers outside its contract', async () => {
    await writeExports(true);
    const { writer } = makeWriter({
      apply: { data: { run_id: 'x' }, error: null },
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
        apply: {
          data: { run_id: 7, retired_count: 0, ...counts },
          error: null,
        },
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
        schema_version: '2.0.0',
        builder_version: '2.0.0',
        export_kind: 'diagnostic_index',
        source_catalog_commit: COMMIT,
        files: [],
      }),
    );
    const { writer, logger } = makeWriter({
      apply: {
        data: {
          run_id: 8,
          projected_count: 0,
          conflict_count: 0,
          retired_count: 3,
        },
        error: null,
      },
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

  it('raw fs error from the loader: records the failure, never calls apply', async () => {
    // Valid index whose single entry has a 300-char file name; the parent
    // directory exists (empty), so lstat fails with a raw ENAMETOOLONG
    // (not ENOENT, which the loader types).
    await fs.mkdir(path.join(root, 'gamme'));
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({
        schema_version: '2.0.0',
        builder_version: '2.0.0',
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
    const { writer, runs } = makeWriter();

    const result = await writer.run('admin');

    expect(result).toEqual({
      status: 'failed',
      runId: 9,
      error: expect.stringContaining('ENAMETOOLONG'),
    });
    expect(runs(APPLY)).toEqual([]);
    expect(runs(RECORD_FAILURE)).toEqual([
      expect.objectContaining({ index_sha256: null, exported_count: null }),
    ]);
  });

  it('resolver integrity breach: records the failure, never calls apply', async () => {
    await writeExports(true);
    const duplicatedPair = {
      ...reference.links[0],
      id: 114,
    };
    const { writer, runs } = makeWriter({
      reference: jest.fn().mockResolvedValue({
        ...reference,
        links: [...reference.links, duplicatedPair],
      }),
    });

    const result = await writer.run('admin');

    expect(result).toEqual({
      status: 'failed',
      runId: 9,
      error: expect.stringContaining('dupliquée (liens 113 et 114)'),
    });
    expect(runs(APPLY)).toEqual([]);
    // The loader succeeded before the resolver threw: its hash is recorded.
    expect(runs(RECORD_FAILURE)).toEqual([
      expect.objectContaining({
        index_sha256: sha256(indexText),
        builder_version: '2.0.0',
        exported_count: 1,
      }),
    ]);
  });
});
