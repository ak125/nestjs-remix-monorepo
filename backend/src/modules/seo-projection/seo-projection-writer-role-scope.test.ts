/**
 * Régression writer NON-NÉGOCIABLE (P2-R3-B) : le résultat des FACTS partagés est découplé du
 * résultat du RÔLE demandé. Un facts no-op ne DOIT JAMAIS court-circuiter l'écriture des blocs du
 * rôle ; une canary mono-rôle n'écrit QUE ses blocs (les autres rôles restent intacts).
 *
 * Méthode : on instancie le service via `Object.create(prototype)` (bypass du constructeur
 * SupabaseBaseService lourd) + un client Supabase chaînable mocké qui enregistre chaque opération
 * et résout les versions "active" depuis un état pilotable. On appelle directement `writeEntity`
 * (le cœur du découplage) sans I/O.
 */
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { zstdDecompressSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import Bull, { type Queue, type Job } from 'bull';
import { SeoProjectionWriteProcessor } from './seo-projection-write.processor';
import {
  PROJECTION_WRITE_JOB,
  type ProjectionRunResult,
  type ProjectionWriteJobData,
} from './seo-projection.types';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import { SeoProjectionGateService } from './seo-projection-gate.service';
import type { SeoProjectionExport } from './seo-projection.types';

// ── Client Supabase chaînable mocké ───────────────────────────────────────────
interface MockState {
  factsActive: Map<string, { content_hash: string }>;
  blocksActive: Map<
    string,
    { content_hash: string; confidence_base: number | null }
  >;
  legacyLookupError?: string;
  blockLookupError?: string;
  activeLookupError?: string;
  eventLookupError?: string;
  snapshotAttachError?: string;
  snapshotAttachMissing?: boolean;
  blockOverride?: Record<string, unknown>;
  previousEventId?: number;
  rpcError?: string;
  rpcResult?: unknown;
  createBlockError?: string;
  /** Drafts existants keyés `${block_id}::${content_hash}` (test d'idempotence de régression). */
  draftsByHash?: Set<string>;
}
interface RecordedOp {
  table: string;
  op: 'upsert' | 'insert' | 'update';
  payload: Record<string, unknown>;
}

function makeSupabase(state: MockState) {
  const ops: RecordedOp[] = [];
  let insertSeq = 0;
  const rpc = jest.fn(async () => ({
    data: state.rpcResult ?? [
      { event_id: 12, active_version_id: 'new-version', replayed: false },
    ],
    error: state.rpcError ? { message: state.rpcError } : null,
  }));

  class Q {
    private op: 'select' | 'upsert' | 'insert' | 'update' = 'select';
    private filters: Record<string, unknown> = {};
    private payload: Record<string, unknown> = {};
    constructor(private readonly table: string) {}
    upsert(payload: Record<string, unknown>) {
      ops.push({ table: this.table, op: 'upsert', payload });
      return Promise.resolve({ data: null, error: null });
    }
    insert(payload: Record<string, unknown>) {
      this.op = 'insert';
      ops.push({ table: this.table, op: 'insert', payload });
      return this;
    }
    update(payload: Record<string, unknown>) {
      this.op = 'update';
      this.payload = payload;
      ops.push({ table: this.table, op: 'update', payload });
      return this;
    }
    select() {
      return this;
    }
    eq(k: string, v: unknown) {
      this.filters[k] = v;
      return this;
    }
    in(k: string, v: string[]) {
      this.filters[`in_${k}`] = v;
      return this;
    }
    neq(k: string, v: unknown) {
      this.filters[`neq_${k}`] = v;
      return this;
    }
    not() {
      return this;
    }
    order() {
      return this;
    }
    limit(_n: number) {
      return this;
    }
    maybeSingle() {
      const lookupError =
        this.table === '__seo_content_blocks'
          ? state.blockLookupError
          : this.table === '__rag_change_events'
            ? state.eventLookupError
            : this.table === '__seo_content_block_versions' &&
                !this.filters.in_block_id
              ? state.activeLookupError
              : undefined;
      if (lookupError)
        return Promise.resolve({ data: null, error: { message: lookupError } });
      if (this.filters.in_block_id && state.legacyLookupError) {
        return Promise.resolve({
          data: null,
          error: { message: state.legacyLookupError },
        });
      }
      return Promise.resolve({ data: this.resolve(), error: null });
    }
    single() {
      if (this.op === 'update' && this.table === '__seo_projection_runs') {
        return Promise.resolve({
          data: state.snapshotAttachMissing
            ? null
            : { run_id: this.filters.run_id, ...this.payload },
          error: state.snapshotAttachError
            ? { message: state.snapshotAttachError }
            : null,
        });
      }
      if (this.op === 'insert') {
        insertSeq += 1;
        // run_id sert à openRun (`.select('run_id')`) ; version_id aux inserts de versions.
        return Promise.resolve({
          data: { version_id: `v-${insertSeq}`, run_id: `run-${insertSeq}` },
          error: null,
        });
      }
      return Promise.resolve({ data: this.resolve(), error: null });
    }
    // Rend Q awaitable pour les chaînes update/insert-conflict sans terminal explicite.
    then(
      onF: (v: { data: null; error: { message: string } | null }) => unknown,
    ) {
      return Promise.resolve({
        data: null,
        error:
          this.table === '__seo_content_blocks' &&
          this.op === 'insert' &&
          state.createBlockError
            ? { message: state.createBlockError }
            : null,
      }).then(onF);
    }
    private resolve(): Record<string, unknown> | null {
      if (this.table === '__seo_content_blocks') {
        if (state.blockOverride) return state.blockOverride;
        const id = String(this.filters.block_id);
        // These fixture identities are explicitly built from entity#role#kind.
        const [entity_id, role, block_kind] = id.split('#');
        return state.blocksActive.has(id)
          ? { entity_id, role, block_kind, active_version_id: 'old-version' }
          : null;
      }
      if (this.table === '__rag_change_events') {
        return state.previousEventId == null
          ? null
          : { rce_id: state.previousEventId };
      }
      // Query de dédup draft (status='draft' + content_hash) : idempotence de régression.
      if (
        this.table === '__seo_content_block_versions' &&
        this.filters.status === 'draft' &&
        typeof this.filters.content_hash === 'string'
      ) {
        const key = `${String(this.filters.block_id)}::${String(this.filters.content_hash)}`;
        return state.draftsByHash?.has(key)
          ? { version_id: 'existing-draft' }
          : null;
      }
      if (this.filters.status !== 'active') return null;
      if (this.table === '__seo_entity_fact_versions') {
        return state.factsActive.get(this.filters.entity_id as string) ?? null;
      }
      if (this.table === '__seo_content_block_versions') {
        const legacyIds = this.filters.in_block_id as string[] | undefined;
        if (legacyIds) {
          const blockId = legacyIds.find((id) => state.blocksActive.has(id));
          return blockId ? { block_id: blockId } : null;
        }
        const value = state.blocksActive.get(this.filters.block_id as string);
        return value ? { ...value, version_id: 'old-version' } : null;
      }
      return null;
    }
  }
  return { client: { from: (t: string) => new Q(t), rpc }, ops };
}

type WriteEntityFn = (
  e: SeoProjectionExport,
  r: string | null,
  role?: string,
) => Promise<{
  factsOutcome: string;
  roleOutcome: string;
  blocksWritten?: number;
  conflicts?: number;
}>;

interface TestWriter {
  writeEntity: WriteEntityFn;
  projectExports: SeoProjectionWriterService['projectExports'];
}

function makeWriter(client: { from: (t: string) => unknown }): TestWriter {
  // Bypass du constructeur SupabaseBaseService (I/O lourde) : on greffe supabase + log sur le proto.
  const writer = Object.create(SeoProjectionWriterService.prototype);
  writer.supabase = client;
  writer.log = { warn() {}, error() {}, log() {} };
  writer.readOnly = false;
  return writer as TestWriter;
}

const exportFixture = (): SeoProjectionExport => ({
  entity_id: 'gamme:filtre-a-huile',
  entity_type: 'gamme',
  schema_version: '2.0.0',
  projection_contract_version: '1.0.0',
  source_wiki_commit: 'abc1234',
  wiki_path: 'wiki/gamme/filtre-a-huile.md',
  content_hash: 'FACTS_H1',
  generated_at: '2026-07-15T00:00:00Z',
  facts: [{ k: 'v' }],
  sources: [],
  roles_allowed: ['R3_CONSEILS', 'R4_REFERENCE'],
  consumers_allowed: ['seo'],
  blocks: [
    {
      role: 'R3_CONSEILS',
      content_md: 'r3',
      source_ids: [],
      truth_level: 'sourced',
      section: 'Diagnostic',
      content_hash: 'R3_H1',
    },
    {
      role: 'R4_REFERENCE',
      content_md: 'r4',
      source_ids: [],
      truth_level: 'sourced',
      section: 'Reference',
      content_hash: 'R4_H1',
    },
  ],
});

const R3_BLOCK_ID = 'gamme:filtre-a-huile#R3_CONSEILS#diagnostic';

const inserts = (ops: RecordedOp[], table: string) =>
  ops.filter((o) => o.table === table && o.op === 'insert');
const blockVersionInserts = (ops: RecordedOp[]) =>
  inserts(ops, '__seo_content_block_versions');
const factVersionInserts = (ops: RecordedOp[]) =>
  inserts(ops, '__seo_entity_fact_versions');

describe('writeEntity — facts/role decouple + role-scoping (non-negotiable)', () => {
  it('trigger R3 (entité neuve) → facts written + SEULS blocs R3 écrits (jamais R4)', async () => {
    const state: MockState = {
      factsActive: new Map(),
      blocksActive: new Map(),
    };
    const { client, ops } = makeSupabase(state);
    const writer = makeWriter(client);

    const out = await writer.writeEntity(
      exportFixture(),
      'run-1',
      'R3_CONSEILS',
    );

    expect(out.factsOutcome).toBe('written');
    expect(out.roleOutcome).toBe('written');
    expect(factVersionInserts(ops)).toHaveLength(1);
    const bvi = blockVersionInserts(ops);
    expect(bvi).toHaveLength(1);
    expect(bvi[0].payload.block_id).toContain('R3_CONSEILS');
    expect(
      bvi.some((o) => String(o.payload.block_id).includes('R4_REFERENCE')),
    ).toBe(false);
    // content_blocks upsert : uniquement le rôle R3.
    const cbUpserts = ops.filter(
      (o) => o.table === '__seo_content_blocks' && o.op === 'insert',
    );
    expect(cbUpserts).toHaveLength(1);
    expect(cbUpserts[0].payload.role).toBe('R3_CONSEILS');
  });

  it('facts NO-OP ne saute PAS un nouveau rôle : re-trigger R4 sur export inchangé → facts noop + blocs R4 écrits, R3 intact', async () => {
    // État après un trigger R3 : facts déjà actifs (même hash) + bloc R3 actif.
    const state: MockState = {
      factsActive: new Map([
        ['gamme:filtre-a-huile', { content_hash: 'FACTS_H1' }],
      ]),
      blocksActive: new Map([
        [R3_BLOCK_ID, { content_hash: 'R3_H1', confidence_base: null }],
      ]),
    };
    const { client, ops } = makeSupabase(state);
    const writer = makeWriter(client);

    const out = await writer.writeEntity(
      exportFixture(),
      'run-2',
      'R4_REFERENCE',
    );

    // Le facts est un no-op…
    expect(out.factsOutcome).toBe('noop');
    expect(factVersionInserts(ops)).toHaveLength(0);
    // …MAIS les blocs R4 sont écrits (la régression : un facts noop les sautait).
    expect(out.roleOutcome).toBe('written');
    const bvi = blockVersionInserts(ops);
    expect(bvi).toHaveLength(1);
    expect(bvi[0].payload.block_id).toContain('R4_REFERENCE');
    // R3 n'est JAMAIS retouché (ni version, ni upsert de ligne bloc).
    expect(
      bvi.some((o) => String(o.payload.block_id).includes('R3_CONSEILS')),
    ).toBe(false);
    const cbUpserts = ops.filter(
      (o) => o.table === '__seo_content_blocks' && o.op === 'insert',
    );
    expect(cbUpserts.every((o) => o.payload.role === 'R4_REFERENCE')).toBe(
      true,
    );
  });

  it('slurp (role absent) → facts written + TOUS les blocs (R3 + R4) écrits', async () => {
    const state: MockState = {
      factsActive: new Map(),
      blocksActive: new Map(),
    };
    const { client, ops } = makeSupabase(state);
    const writer = makeWriter(client);
    await writer.writeEntity(exportFixture(), 'run-3');
    expect(factVersionInserts(ops)).toHaveLength(1);
    expect(blockVersionInserts(ops)).toHaveLength(2);
  });

  it('facts noop + bloc du rôle noop → factsOutcome=noop ET roleOutcome=noop (0 écriture de version)', async () => {
    const state: MockState = {
      factsActive: new Map([
        ['gamme:filtre-a-huile', { content_hash: 'FACTS_H1' }],
      ]),
      blocksActive: new Map([
        [
          'gamme:filtre-a-huile#R4_REFERENCE#reference',
          { content_hash: 'R4_H1', confidence_base: null },
        ],
      ]),
    };
    const { client, ops } = makeSupabase(state);
    const writer = makeWriter(client);
    const out = await writer.writeEntity(
      exportFixture(),
      'run-4',
      'R4_REFERENCE',
    );
    expect(out.factsOutcome).toBe('noop');
    expect(out.roleOutcome).toBe('noop');
    expect(factVersionInserts(ops)).toHaveLength(0);
    expect(blockVersionInserts(ops)).toHaveLength(0);
  });

  // Bloc régressant : contenu différent MAIS confiance strictement inférieure à l'active.
  const regressExport = (): SeoProjectionExport => ({
    ...exportFixture(),
    roles_allowed: ['R3_CONSEILS'],
    blocks: [
      {
        role: 'R3_CONSEILS',
        content_md: 'r3 moins fiable',
        source_ids: [],
        truth_level: 'sourced',
        section: 'Diagnostic',
        content_hash: 'NEW_H',
        confidence_base: 0.5,
      },
    ],
  });
  const conflictInserts = (ops: RecordedOp[]) =>
    inserts(ops, '__seo_projection_conflicts');

  it('régression : 1er run insère 1 draft + 1 conflit (active plus fiable préservée)', async () => {
    const state: MockState = {
      factsActive: new Map([
        ['gamme:filtre-a-huile', { content_hash: 'FACTS_H1' }],
      ]),
      blocksActive: new Map([
        [R3_BLOCK_ID, { content_hash: 'ACTIVE_H', confidence_base: 0.9 }],
      ]),
      draftsByHash: new Set(),
    };
    const { client, ops } = makeSupabase(state);
    const out = await makeWriter(client).writeEntity(
      regressExport(),
      'run-1',
      'R3_CONSEILS',
    );
    expect(out.roleOutcome).toBe('regressed_draft');
    expect(blockVersionInserts(ops)).toHaveLength(1);
    expect(conflictInserts(ops)).toHaveLength(1);
  });

  it('régression IDEMPOTENTE : re-projeter un export régressant inchangé (draft déjà présent) → no-op, 0 draft dupliqué, 0 conflit', async () => {
    const state: MockState = {
      factsActive: new Map([
        ['gamme:filtre-a-huile', { content_hash: 'FACTS_H1' }],
      ]),
      blocksActive: new Map([
        [R3_BLOCK_ID, { content_hash: 'ACTIVE_H', confidence_base: 0.9 }],
      ]),
      draftsByHash: new Set([`${R3_BLOCK_ID}::NEW_H`]),
    };
    const { client, ops } = makeSupabase(state);
    const out = await makeWriter(client).writeEntity(
      regressExport(),
      'run-2',
      'R3_CONSEILS',
    );
    expect(out.roleOutcome).toBe('noop');
    expect(blockVersionInserts(ops)).toHaveLength(0); // pas de draft dupliqué
    expect(conflictInserts(ops)).toHaveLength(0); // pas de conflit dupliqué
  });

  it('projectExports([]) → no-op observable, aucun run ouvert (job malformé/stale)', async () => {
    const { client } = makeSupabase({
      factsActive: new Map(),
      blocksActive: new Map(),
    });
    const res = await makeWriter(client).projectExports([]);
    expect(res.runId).toBeNull();
    expect(res.snapshot).toBeNull();
  });

  // Atomicité ADR-059 « active content ⇒ durable replay snapshot » : le snapshot durable est publié
  // AVANT tout flip de version active. Export LISIBLE (writeEntity écrirait) MAIS publication snapshot
  // en échec (object-store KO / ENOSPC) → AUCUNE version écrite/flippée, run `failed`, hash null, conflit
  // loggé. Régression corrigée : l'ancien ordre flippait l'actif PUIS tentait le snapshot → contenu actif
  // sans snapshot de replay, et le refresh MV était quand même enqueue (guard entitiesWritten>0).
  it('atomicité snapshot-first : export LISIBLE mais publication snapshot ÉCHOUE → 0 flip actif, run failed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'p2r3b-atomic-'));
    const exportPath = join(dir, 'filtre-a-huile.json');
    writeFileSync(exportPath, JSON.stringify(exportFixture()), 'utf-8');
    try {
      const { client, ops } = makeSupabase({
        factsActive: new Map(),
        blocksActive: new Map(),
      });
      const writer = makeWriter(client);
      // gate pass (sinon projectOne bloque AVANT writeEntity) + publication snapshot en échec dur.
      (
        writer as unknown as {
          gate: { evaluate: () => { ok: boolean; verdicts: [] } };
        }
      ).gate = { evaluate: () => ({ ok: true, verdicts: [] }) };
      (
        writer as unknown as { buildSnapshotForRun: () => Promise<never> }
      ).buildSnapshotForRun = () =>
        Promise.reject(new Error('object-store write failed (ENOSPC)'));

      const res = await writer.projectExports(
        [exportPath],
        'manual',
        {},
        'R3_CONSEILS',
      );

      // Snapshot-first : le flip des versions actives ne précède JAMAIS la publication durable.
      expect(factVersionInserts(ops)).toHaveLength(0);
      expect(blockVersionInserts(ops)).toHaveLength(0);
      expect(
        ops.filter(
          (o) => o.table === '__seo_content_blocks' && o.op === 'insert',
        ),
      ).toHaveLength(0);
      // Run ouvert PUIS fermé failed, hash de snapshot null.
      const runUpdates = ops.filter(
        (o) => o.table === '__seo_projection_runs' && o.op === 'update',
      );
      expect(runUpdates).toHaveLength(1);
      expect(runUpdates[0].payload.status).toBe('failed');
      expect(runUpdates[0].payload.exports_snapshot_hash).toBeNull();
      // Échec observable (conflit), pas de repli silencieux.
      const conflicts = inserts(ops, '__seo_projection_conflicts');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].payload.conflict_kind).toBe(
        'snapshot_publish_failed',
      );
      // Résultat : 0 écriture, pas de snapshot.
      expect(res.entitiesWritten).toBe(0);
      expect(res.rolesWritten).toBe(0);
      expect(res.snapshot).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Mechanical role isolation only; source admissibility belongs to the upstream
// gate. These fixtures do not activate consumers or certify public rendering.
describe('all requested canonical roles — isolated projection and replay', () => {
  const cases = [
    ['R1_ROUTER', 'gamme', 'R6_GUIDE_ACHAT'],
    ['R2_PRODUCT', 'gamme', 'R3_CONSEILS'],
    ['R3_CONSEILS', 'gamme', 'R6_GUIDE_ACHAT'],
    ['R6_GUIDE_ACHAT', 'gamme', 'R3_CONSEILS'],
    ['R7_BRAND', 'constructeur', 'R0_HOME'],
    ['R8_VEHICLE', 'vehicle', 'R2_PRODUCT'],
  ] as const;

  it.each(cases)(
    '%s writes only its block when shared facts are unchanged',
    async (role, entityType, peer) => {
      const entity = `${entityType}:fixture`;
      const exp: SeoProjectionExport = {
        ...exportFixture(),
        entity_id: entity,
        entity_type: entityType,
        wiki_path: `wiki/${entityType}/fixture.md`,
        roles_allowed: [role, peer],
        blocks: [role, peer].map((r) => ({
          role: r,
          content_md: `Fixture ${r}`,
          source_ids: [],
          truth_level: 'sourced',
          section: 'Fixture',
          content_hash: `${r}_H1`,
        })),
      };
      const { client, ops } = makeSupabase({
        factsActive: new Map([[entity, { content_hash: exp.content_hash }]]),
        blocksActive: new Map(),
      });
      const out = await makeWriter(client).writeEntity(
        exp,
        'fixture-run',
        role,
      );
      expect(out.factsOutcome).toBe('noop');
      expect(out.roleOutcome).toBe('written');
      expect(factVersionInserts(ops)).toHaveLength(0);
      expect(blockVersionInserts(ops)).toHaveLength(1);
      expect(blockVersionInserts(ops)[0].payload.block_id).toBe(
        `${entity}#${role}#fixture`,
      );
    },
  );

  it.each(cases)(
    '%s unchanged replay creates no new content version',
    async (role, entityType) => {
      const entity = `${entityType}:fixture`;
      const exp: SeoProjectionExport = {
        ...exportFixture(),
        entity_id: entity,
        entity_type: entityType,
        wiki_path: `wiki/${entityType}/fixture.md`,
        roles_allowed: [role],
        blocks: [
          {
            role,
            content_md: 'Fixture',
            source_ids: [],
            truth_level: 'sourced',
            section: 'Fixture',
            content_hash: `${role}_H1`,
          },
        ],
      };
      const { client, ops } = makeSupabase({
        factsActive: new Map([[entity, { content_hash: exp.content_hash }]]),
        blocksActive: new Map([
          [
            `${entity}#${role}#fixture`,
            { content_hash: `${role}_H1`, confidence_base: null },
          ],
        ]),
      });
      const out = await makeWriter(client).writeEntity(
        exp,
        'fixture-replay',
        role,
      );
      expect(out.roleOutcome).toBe('noop');
      expect(factVersionInserts(ops)).toHaveLength(0);
      expect(blockVersionInserts(ops)).toHaveLength(0);
    },
  );
});

describe('identité des octets archivés et projetés', () => {
  it.each(['after-open-run', 'after-snapshot'])(
    'un changement du fichier %s ne remplace pas les octets capturés',
    async (timing) => {
      const root = mkdtempSync(join(tmpdir(), 'projection-input-race-'));
      try {
        const input = join(root, 'export.json');
        const original = exportFixture();
        const changed = {
          ...original,
          source_wiki_commit: 'changed-commit',
          content_hash: 'CHANGED',
        };
        writeFileSync(input, JSON.stringify(original));
        const { client } = makeSupabase({
          factsActive: new Map(),
          blocksActive: new Map(),
        });
        const writer = makeWriter(client) as TestWriter & {
          gate: { evaluate: () => { ok: boolean; verdicts: [] } };
          configService: { get: () => string };
          openRun: (...args: unknown[]) => Promise<string>;
          buildSnapshotForRun: (
            ...args: unknown[]
          ) => Promise<{ hash: string; uri: string }>;
        };
        writer.gate = { evaluate: () => ({ ok: true, verdicts: [] }) };
        writer.configService = { get: () => root };
        const written: SeoProjectionExport[] = [];
        writer.writeEntity = async (value) => {
          written.push(value);
          return { factsOutcome: 'written', roleOutcome: 'written' };
        };
        if (timing === 'after-open-run') {
          const open = writer.openRun.bind(writer);
          writer.openRun = async (...args) => {
            const run = await open(...args);
            writeFileSync(input, JSON.stringify(changed));
            return run;
          };
        } else {
          const publish = writer.buildSnapshotForRun.bind(writer);
          writer.buildSnapshotForRun = async (...args) => {
            const snapshot = await publish(...args);
            writeFileSync(input, JSON.stringify(changed));
            return snapshot;
          };
        }
        const result = await writer.projectExports([input], 'test');
        const snapshot = result.snapshot as { uri: string };
        const tar = zstdDecompressSync(readFileSync(snapshot.uri));
        const size = parseInt(tar.toString('ascii', 124, 135), 8);
        const archived = JSON.parse(tar.toString('utf8', 512, 512 + size));
        expect(archived).toEqual(original);
        expect(written).toEqual([archived]);
        expect(JSON.parse(readFileSync(input, 'utf8'))).toEqual(changed);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});

describe('capture incomplète ou archive ambiguë', () => {
  it.each(['missing-later-input', 'duplicate-basename'])(
    '%s refuse le lot avant toute version active',
    async (failure) => {
      const root = mkdtempSync(join(tmpdir(), 'projection-input-failure-'));
      try {
        const first = join(root, 'export.json');
        const secondDir = join(root, 'other');
        mkdirSync(secondDir);
        const second = join(secondDir, 'export.json');
        writeFileSync(first, JSON.stringify(exportFixture()));
        if (failure === 'duplicate-basename') {
          writeFileSync(second, JSON.stringify(exportFixture()));
        }
        const { client, ops } = makeSupabase({
          factsActive: new Map(),
          blocksActive: new Map(),
        });
        const writer = makeWriter(client) as TestWriter & {
          gate: { evaluate: () => { ok: boolean; verdicts: [] } };
          configService: { get: () => string };
        };
        writer.gate = { evaluate: () => ({ ok: true, verdicts: [] }) };
        writer.configService = { get: () => root };
        const result = await writer.projectExports([first, second], 'test');
        expect(result.snapshot).toBeNull();
        expect(result.entitiesWritten).toBe(0);
        expect(result.rolesWritten).toBe(0);
        expect(factVersionInserts(ops)).toHaveLength(0);
        expect(blockVersionInserts(ops)).toHaveLength(0);
        const closed = ops.filter(
          (o) => o.table === '__seo_projection_runs' && o.op === 'update',
        );
        expect(closed).toHaveLength(1);
        expect(closed[0].payload.status).toBe('failed');
        expect(
          ops.filter(
            (o) =>
              o.table === '__seo_projection_conflicts' && o.op === 'insert',
          ),
        ).toHaveLength(1);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});

describe('identité non ambiguë des blocs avant toute écriture', () => {
  const block = (role: string, section?: string) => ({
    role,
    section,
    content_md: 'Contenu sourcé',
    source_ids: ['web:fixture'],
    truth_level: 'sourced' as const,
  });

  it.each([
    [
      'sections normalisées',
      [block('R3_CONSEILS', 'Symptômes'), block('R3_CONSEILS', 'symptomes')],
    ],
    [
      'section et index positionnel',
      [block('R3_CONSEILS'), block('R3_CONSEILS', 'b0')],
    ],
    [
      'block_kind explicite',
      [
        { ...block('R3_CONSEILS', 'A'), block_kind: 'commun' },
        { ...block('R3_CONSEILS', 'B'), block_kind: 'commun' },
      ],
    ],
    [
      'identifiant explicite partagé entre rôles',
      [
        { ...block('R3_CONSEILS', 'A'), block_id: 'shared-id' },
        { ...block('R6_GUIDE_ACHAT', 'B'), block_id: 'shared-id' },
      ],
    ],
  ])(
    '%s : refus sans upsert ni version, même en mode mono-rôle',
    async (_label, blocks) => {
      const exp = { ...exportFixture(), blocks };
      const { client, ops } = makeSupabase({
        factsActive: new Map(),
        blocksActive: new Map(),
      });
      await expect(
        makeWriter(client).writeEntity(exp, 'test-identity', 'R3_CONSEILS'),
      ).rejects.toThrow('ambiguous block identity');
      expect(ops).toHaveLength(0);
    },
  );

  it('deux sections de même nom dans des rôles différents gardent des identifiants distincts', async () => {
    const exp = {
      ...exportFixture(),
      blocks: [
        block('R3_CONSEILS', 'Symptômes'),
        block('R6_GUIDE_ACHAT', 'Symptômes'),
      ],
    };
    const { client, ops } = makeSupabase({
      factsActive: new Map(),
      blocksActive: new Map(),
    });
    await makeWriter(client).writeEntity(exp, 'test-identity', 'R3_CONSEILS');
    const rows = ops.filter(
      (o) => o.table === '__seo_content_blocks' && o.op === 'insert',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.block_id).toBe(
      `${exp.entity_id}#R3_CONSEILS#symptomes`,
    );
  });

  it('un doublon limité à un autre rôle ne bloque pas le rôle demandé', async () => {
    const exp = {
      ...exportFixture(),
      blocks: [
        block('R3_CONSEILS', 'A'),
        block('R6_GUIDE_ACHAT', 'B'),
        block('R6_GUIDE_ACHAT', 'B'),
      ],
    };
    const { client, ops } = makeSupabase({
      factsActive: new Map(),
      blocksActive: new Map(),
    });
    await makeWriter(client).writeEntity(exp, 'test-identity', 'R3_CONSEILS');
    expect(blockVersionInserts(ops)).toHaveLength(1);
  });

  it('le mode tous rôles refuse aussi le doublon présent en fin de tableau', async () => {
    const exp = {
      ...exportFixture(),
      blocks: [
        block('R3_CONSEILS', 'A'),
        block('R6_GUIDE_ACHAT', 'B'),
        block('R6_GUIDE_ACHAT', 'B'),
      ],
    };
    const { client, ops } = makeSupabase({
      factsActive: new Map(),
      blocksActive: new Map(),
    });
    await expect(
      makeWriter(client).writeEntity(exp, 'test-identity'),
    ).rejects.toThrow('ambiguous block identity');
    expect(ops).toHaveLength(0);
  });
});

it('un export ambigu conserve sa preuve mais clôt le run en échec sans version active', async () => {
  const root = mkdtempSync(join(tmpdir(), 'projection-identity-run-'));
  try {
    const exp = exportFixture();
    exp.blocks = [
      {
        role: 'R3_CONSEILS',
        section: 'Symptômes',
        content_md: 'Première preuve',
        source_ids: ['web:a'],
        truth_level: 'sourced',
      },
      {
        role: 'R3_CONSEILS',
        section: 'symptomes',
        content_md: 'Deuxième preuve',
        source_ids: ['web:b'],
        truth_level: 'sourced',
      },
    ];
    const input = join(root, 'export.json');
    writeFileSync(input, JSON.stringify(exp));
    const { client, ops } = makeSupabase({
      factsActive: new Map(),
      blocksActive: new Map(),
    });
    const writer = makeWriter(client) as TestWriter & {
      gate: SeoProjectionGateService;
      configService: { get: () => string };
    };
    writer.gate = new SeoProjectionGateService();
    writer.configService = { get: () => root };
    const result = await writer.projectExports(
      [input],
      'test',
      {},
      'R3_CONSEILS',
    );
    expect(result.snapshot).not.toBeNull();
    expect(result.entitiesWritten).toBe(0);
    expect(result.rolesBlocked).toBe(1);
    expect(factVersionInserts(ops)).toHaveLength(0);
    expect(blockVersionInserts(ops)).toHaveLength(0);
    const conflicts = ops.filter(
      (o) => o.table === '__seo_projection_conflicts' && o.op === 'insert',
    );
    expect(conflicts).toHaveLength(1);
    expect(JSON.stringify(conflicts[0].payload)).toContain(
      'ambiguous block identity',
    );
    const close = ops.find(
      (o) =>
        o.table === '__seo_projection_runs' &&
        o.op === 'update' &&
        o.payload.status != null,
    );
    expect(close?.payload.status).toBe('failed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('R8 Scénic : quatre axes/sections distincts sont conservés et rejouables sans doublon', async () => {
  const exp: SeoProjectionExport = {
    ...exportFixture(),
    entity_id: 'vehicle:renault-scenic-ii',
    entity_type: 'vehicle',
    wiki_path: 'wiki/vehicle/renault-scenic-ii.md',
    roles_allowed: ['R8_VEHICLE'],
    blocks: [
      ['known_issues', 'engine_family:f4r'],
      ['known_issues', 'engine_family:k9k'],
      ['maintenance', 'fuel:diesel'],
      ['maintenance', 'fuel:essence'],
    ].map(([section, usefulness_target]) => ({
      role: 'R8_VEHICLE',
      section,
      usefulness_target,
      content_md: `Preuve fixture ${usefulness_target}`,
      source_ids: ['web:fixture'],
      truth_level: 'sourced' as const,
    })),
  };
  const first = makeSupabase({
    factsActive: new Map(),
    blocksActive: new Map(),
  });
  const result = await makeWriter(first.client).writeEntity(
    exp,
    'r8-first',
    'R8_VEHICLE',
  );
  expect(result.roleOutcome).toBe('written');
  const versions = blockVersionInserts(first.ops);
  expect(versions).toHaveLength(4);
  expect(new Set(versions.map((v) => v.payload.block_id)).size).toBe(4);
  const replay = makeSupabase({
    factsActive: new Map([[exp.entity_id, { content_hash: exp.content_hash }]]),
    blocksActive: new Map(
      versions.map((v) => [
        String(v.payload.block_id),
        { content_hash: String(v.payload.content_hash), confidence_base: null },
      ]),
    ),
  });
  const replayed = await makeWriter(replay.client).writeEntity(
    { ...exp, blocks: [...exp.blocks].reverse() },
    'r8-replay',
    'R8_VEHICLE',
  );
  expect(replayed.roleOutcome).toBe('noop');
  expect(blockVersionInserts(replay.ops)).toHaveLength(0);
});

it('R8 : deux blocs du même axe et de la même section restent refusés avant écriture', async () => {
  const exp: SeoProjectionExport = {
    ...exportFixture(),
    entity_id: 'vehicle:renault-scenic-ii',
    entity_type: 'vehicle',
    wiki_path: 'wiki/vehicle/renault-scenic-ii.md',
    roles_allowed: ['R8_VEHICLE'],
    blocks: ['Maintenance', 'maintenance'].map((section) => ({
      role: 'R8_VEHICLE',
      section,
      usefulness_target: 'fuel:diesel',
      content_md: 'Preuve fixture',
      source_ids: ['web:fixture'],
      truth_level: 'sourced' as const,
    })),
  };
  const { client, ops } = makeSupabase({
    factsActive: new Map(),
    blocksActive: new Map(),
  });
  await expect(
    makeWriter(client).writeEntity(exp, 'r8-duplicate', 'R8_VEHICLE'),
  ).rejects.toThrow('ambiguous block identity');
  expect(ops).toHaveLength(0);
});

it.each(['legacy active', 'lookup failure'])(
  'R8 : %s refuse le rejeu avant facts et blocs',
  async (scenario) => {
    const exp = exportFixture();
    exp.entity_id = 'vehicle:renault-scenic-ii';
    exp.entity_type = 'vehicle';
    exp.blocks = [
      {
        role: 'R8_VEHICLE',
        section: 'Known issues',
        usefulness_target: 'engine_family:k9k',
        content_md: 'Contenu moteur conserve',
        source_ids: [],
        truth_level: 'sourced',
      },
    ];
    const legacyId = `${exp.entity_id}#R8_VEHICLE#known-issues`;
    const { client, ops } = makeSupabase({
      factsActive: new Map(),
      blocksActive: new Map(
        scenario === 'legacy active'
          ? [
              [
                legacyId,
                {
                  content_hash: 'OLD',
                  confidence_base: null,
                },
              ],
            ]
          : [],
      ),
      legacyLookupError:
        scenario === 'lookup failure' ? 'DB unavailable' : undefined,
    });
    await expect(
      makeWriter(client).writeEntity(exp, 'r8-legacy', 'R8_VEHICLE'),
    ).rejects.toThrow(
      scenario === 'legacy active'
        ? `legacy R8 block requires reconciliation: ${legacyId}`
        : 'R8 legacy identity check failed: DB unavailable',
    );
    expect(ops).toHaveLength(0);
  },
);

it('R8 : le controle historique respecte le role selectionne et les ID explicites', async () => {
  const exp = exportFixture();
  exp.blocks.push({
    role: 'R8_VEHICLE',
    section: 'Maintenance',
    usefulness_target: 'fuel:diesel',
    content_md: 'Entretien',
    source_ids: [],
    truth_level: 'sourced',
  });
  const state: MockState = {
    factsActive: new Map(),
    blocksActive: new Map(),
    legacyLookupError: 'must not query',
  };
  const first = makeSupabase(state);
  await expect(
    makeWriter(first.client).writeEntity(exp, 'r3-only', 'R3_CONSEILS'),
  ).resolves.toMatchObject({ roleOutcome: 'written' });
  exp.blocks[2].block_id = 'explicit-r8-id';
  const second = makeSupabase(state);
  await expect(
    makeWriter(second.client).writeEntity(exp, 'explicit', 'R8_VEHICLE'),
  ).resolves.toMatchObject({ roleOutcome: 'written' });
  expect(blockVersionInserts(second.ops)[0].payload.block_id).toBe(
    'explicit-r8-id',
  );
});

it.each([200, 503])(
  'R8 : le SDK reel ne transmet aucune mutation si le preflight repond %s',
  async (status) => {
    const exp = exportFixture();
    exp.entity_id = 'vehicle:renault-scenic-ii';
    exp.blocks = [
      {
        role: 'R8_VEHICLE',
        section: 'Maintenance',
        usefulness_target: 'fuel:diesel',
        content_md: 'Entretien diesel',
        source_ids: [],
        truth_level: 'sourced',
      },
    ];
    const legacyId = `${exp.entity_id}#R8_VEHICLE#maintenance`;
    const requests: Array<{ method: string; url: URL }> = [];
    const client = createClient('https://projection.invalid', 'test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, init) => {
          requests.push({
            method: init?.method ?? 'GET',
            url: new URL(String(input)),
          });
          return new Response(
            JSON.stringify(
              status === 200
                ? [{ block_id: legacyId }]
                : { message: 'DB unavailable', code: 'TEST' },
            ),
            {
              status,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        },
      },
    });
    await expect(
      makeWriter(client).writeEntity(exp, 'sdk-legacy', 'R8_VEHICLE'),
    ).rejects.toThrow(
      status === 200 ? 'requires reconciliation' : 'identity check failed',
    );
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.method).toBe('GET');
      expect(request.url.pathname).toBe(
        '/rest/v1/__seo_content_block_versions',
      );
      expect(request.url.searchParams.get('block_id')).toBe(`in.(${legacyId})`);
      expect(request.url.searchParams.get('status')).toBe('eq.active');
    }
  },
);

describe('writer transactional replacement hookup', () => {
  const existing = (overrides: Partial<MockState> = {}): MockState => ({
    factsActive: new Map([
      ['gamme:filtre-a-huile', { content_hash: 'FACTS_H1' }],
    ]),
    blocksActive: new Map([
      [R3_BLOCK_ID, { content_hash: 'OLD_H', confidence_base: 0.5 }],
    ]),
    ...overrides,
  });

  it('uses the guarded native RPC with exact source, provenance, version and predecessor; no direct version/pointer mutation', async () => {
    const { client, ops } = makeSupabase(existing({ previousEventId: 9 }));
    const writer = makeWriter(client);
    const out = await writer.writeEntity(
      exportFixture(),
      'run-transaction',
      'R3_CONSEILS',
    );
    expect(out.roleOutcome).toBe('written');
    expect(client.rpc).toHaveBeenCalledWith(
      'transition_seo_projection_block',
      expect.objectContaining({
        p_block_id: R3_BLOCK_ID,
        p_entity_id: 'gamme:filtre-a-huile',
        p_role: 'R3_CONSEILS',
        p_run_id: 'run-transaction',
        p_expected_version_id: 'old-version',
        p_expected_event_id: 9,
        p_operation: 'replace',
        p_wiki_source: exportFixture().wiki_path,
        p_source_type: 'sourced',
        p_content_hash: 'R3_H1',
        p_content: expect.objectContaining({
          content_md: 'r3',
          truth_level: 'sourced',
        }),
      }),
    );
    expect(blockVersionInserts(ops)).toHaveLength(0);
    expect(ops.filter((o) => o.table === '__seo_content_blocks')).toHaveLength(
      0,
    );
    expect(ops.filter((o) => o.table === '__rag_change_events')).toHaveLength(
      0,
    );
  });

  it.each([
    ['missing RPC', { rpcError: 'function unavailable' }],
    ['stale version', { rpcError: 'STALE_BLOCK_TRANSITION' }],
    ['empty RPC result', { rpcResult: [] }],
    [
      'false commit',
      {
        rpcResult: [
          { event_id: 0, active_version_id: 'old-version', replayed: false },
        ],
      },
    ],
    ['event read failure', { eventLookupError: '503' }],
    ['active read failure', { activeLookupError: '503' }],
    ['identity read failure', { blockLookupError: '503' }],
  ])('%s fails without direct-write fallback', async (_label, overrides) => {
    const { client, ops } = makeSupabase(
      existing(overrides as Partial<MockState>),
    );
    await expect(
      makeWriter(client).writeEntity(
        exportFixture(),
        'run-transaction',
        'R3_CONSEILS',
      ),
    ).rejects.toThrow();
    expect(blockVersionInserts(ops)).toHaveLength(0);
    expect(ops.filter((o) => o.table === '__seo_content_blocks')).toHaveLength(
      0,
    );
  });

  it.each([
    {
      entity_id: 'other',
      role: 'R3_CONSEILS',
      block_kind: 'diagnostic',
      active_version_id: 'old-version',
    },
    {
      entity_id: 'gamme:filtre-a-huile',
      role: 'R3_CONSEILS',
      block_kind: 'diagnostic',
      active_version_id: null,
    },
    {
      entity_id: 'gamme:filtre-a-huile',
      role: 'R3_CONSEILS',
      block_kind: 'diagnostic',
      active_version_id: 'different-version',
    },
  ])(
    'refuses changed ownership, retained withdrawn rows and inconsistent pointers',
    async (blockOverride) => {
      const { client, ops } = makeSupabase(existing({ blockOverride }));
      await expect(
        makeWriter(client).writeEntity(
          exportFixture(),
          'run-transaction',
          'R3_CONSEILS',
        ),
      ).rejects.toThrow();
      expect(client.rpc).not.toHaveBeenCalled();
      expect(blockVersionInserts(ops)).toHaveLength(0);
      expect(
        ops.filter((o) => o.table === '__seo_content_blocks'),
      ).toHaveLength(0);
    },
  );

  it('honors the native RPC guard and never bypasses its rejection', async () => {
    const { client, ops } = makeSupabase(existing());
    const writer = makeWriter(client);
    const evaluate = jest.fn(() => ({
      decision: 'BLOCK',
      reason: 'TEST_GUARD_DENIAL',
    }));
    Object.assign(writer, { rpcGate: { evaluate, log: jest.fn() } });
    await expect(
      writer.writeEntity(exportFixture(), 'run-transaction', 'R3_CONSEILS'),
    ).rejects.toThrow();
    expect(evaluate).toHaveBeenCalledWith('transition_seo_projection_block', {
      source: 'internal',
    });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(blockVersionInserts(ops)).toHaveLength(0);
  });

  it('a concurrent creation conflict cannot overwrite an existing block', async () => {
    const { client, ops } = makeSupabase(
      existing({ blocksActive: new Map(), createBlockError: 'duplicate key' }),
    );
    await expect(
      makeWriter(client).writeEntity(
        exportFixture(),
        'run-transaction',
        'R3_CONSEILS',
      ),
    ).rejects.toThrow('duplicate key');
    expect(blockVersionInserts(ops)).toHaveLength(0);
  });

  it.each(['attached', 'error', 'missing-row', 'rpc-error'])(
    'snapshot attachment %s is checked before content writes through public writer',
    async (mode) => {
      const root = mkdtempSync(join(tmpdir(), 'writer-transaction-'));
      try {
        const exportPath = join(root, 'fixture.json');
        writeFileSync(exportPath, JSON.stringify(exportFixture()));
        const { client, ops } = makeSupabase(
          existing({
            snapshotAttachError:
              mode === 'error' ? 'snapshot DB unavailable' : undefined,
            snapshotAttachMissing: mode === 'missing-row',
            rpcError:
              mode === 'rpc-error' ? 'STALE_BLOCK_TRANSITION' : undefined,
          }),
        );
        const writer = makeWriter(client);
        Object.assign(writer, {
          gate: new SeoProjectionGateService(),
          configService: { get: () => root },
        });
        const order: string[] = [];
        const nativeFrom = client.from;
        client.from = (table: string) => {
          order.push(table);
          return nativeFrom(table);
        };
        const result = await writer.projectExports(
          [exportPath],
          'manual',
          {},
          'R3_CONSEILS',
        );
        const updates = ops.filter(
          (o) => o.table === '__seo_projection_runs' && o.op === 'update',
        );
        expect(updates[0].payload.exports_snapshot_hash).toMatch(/^sha256:/);
        if (mode === 'attached') {
          expect(result.rolesWritten).toBe(1);
          expect(client.rpc).toHaveBeenCalledTimes(1);
          expect(order.slice(0, 2)).toEqual([
            '__seo_projection_runs',
            '__seo_projection_runs',
          ]);
          expect(updates.at(-1)?.payload.status).toBe('succeeded');
        } else if (mode === 'rpc-error') {
          expect(result.rolesBlocked).toBe(1);
          expect(result.rolesWritten).toBe(0);
          expect(client.rpc).toHaveBeenCalledTimes(1);
          expect(blockVersionInserts(ops)).toHaveLength(0);
          expect(updates.at(-1)?.payload.status).toBe('failed');
          expect(result.outcomes[0].reasons?.join(' ')).toContain(
            'STALE_BLOCK_TRANSITION',
          );
        } else {
          expect(result.rolesWritten).toBe(0);
          expect(client.rpc).not.toHaveBeenCalled();
          expect(
            ops.filter((o) => o.table === '__seo_entity_facts'),
          ).toHaveLength(0);
          expect(blockVersionInserts(ops)).toHaveLength(0);
          expect(updates.at(-1)?.payload.status).toBe('failed');
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});

describe('partial write progress reaches the refresh queue and Bull failure state', () => {
  it.each(['facts', 'blocks'])(
    'preserves committed %s when the next block fails',
    async (mode) => {
      const root = mkdtempSync(join(tmpdir(), 'writer-partial-'));
      try {
        const exp = exportFixture();
        exp.roles_allowed = ['R3_CONSEILS'];
        exp.blocks = [
          exp.blocks[0],
          { ...exp.blocks[0], section: 'Controle', content_hash: 'CONTROL_H2' },
        ];
        const state: MockState = {
          factsActive:
            mode === 'facts'
              ? new Map()
              : new Map([[exp.entity_id, { content_hash: exp.content_hash }]]),
          blocksActive: new Map([
            [R3_BLOCK_ID, { content_hash: 'OLD_H1', confidence_base: null }],
            [
              exp.entity_id + '#R3_CONSEILS#controle',
              { content_hash: 'OLD_H2', confidence_base: null },
            ],
          ]),
        };
        const { client, ops } = makeSupabase(state);
        if (mode === 'blocks')
          client.rpc.mockResolvedValueOnce({
            data: [
              {
                event_id: 12,
                active_version_id: 'new-version',
                replayed: false,
              },
            ],
            error: null,
          });
        client.rpc.mockResolvedValue({
          data: null,
          error: { message: 'SECOND_WRITE_FAILED' },
        });
        const writer = makeWriter(client);
        Object.assign(writer, {
          gate: new SeoProjectionGateService(),
          configService: { get: () => root },
        });
        const exportPath = join(root, 'partial.json');
        writeFileSync(exportPath, JSON.stringify(exp));
        const result = await writer.projectExports(
          [exportPath],
          'manual',
          {},
          'R3_CONSEILS',
        );
        expect(result.rolesBlocked).toBe(1);
        expect(result.rolesWritten).toBe(0); // Status partition stays truthful.
        expect(result.entitiesWritten).toBe(mode === 'facts' ? 1 : 0);
        expect(result.outcomes[0].blocksWritten ?? 0).toBe(
          mode === 'blocks' ? 1 : 0,
        );
        expect(result.outcomes[0].factsOutcome).toBe(
          mode === 'facts' ? 'written' : 'noop',
        );
        const close = ops.find(
          (o) =>
            o.table === '__seo_projection_runs' &&
            o.payload.status === 'failed',
        );
        expect(close?.payload.entities_written).toBe(mode === 'facts' ? 1 : 0);
        const conflict = ops.find(
          (o) =>
            o.table === '__seo_projection_conflicts' &&
            o.payload.conflict_kind === 'write_error',
        );
        expect(conflict?.payload.detail).toMatchObject({
          factsOutcome: result.outcomes[0].factsOutcome,
          blocksWritten: mode === 'blocks' ? 1 : 0,
        });

        const add = jest.fn().mockResolvedValue({ id: 'refresh-fixture' });
        const processor = new SeoProjectionWriteProcessor(
          {
            projectExports: jest.fn().mockResolvedValue(result),
            hasPendingProjectionRefresh: jest.fn().mockResolvedValue(false),
          } as unknown as SeoProjectionWriterService,
          { add } as unknown as Queue,
        );
        const moveToCompleted = jest.fn().mockResolvedValue(null);
        const moveToFailed = jest.fn().mockResolvedValue(null);
        const queue = Object.assign(Object.create(Bull.prototype), {
          handlers: {
            [PROJECTION_WRITE_JOB]: (job: Job<ProjectionWriteJobData>) =>
              processor.handle(job),
          },
          timers: { set: jest.fn(), clear: jest.fn() },
          settings: { lockRenewTime: 1000 },
          emit: jest.fn(),
        });
        await queue.processJob(
          {
            name: PROJECTION_WRITE_JOB,
            data: { exportPaths: [exportPath] },
            opts: {},
            moveToCompleted,
            moveToFailed,
          },
          true,
        );
        expect(add).toHaveBeenCalledTimes(1);
        expect(result.refreshEnqueued).toBe(true);
        expect(moveToCompleted).not.toHaveBeenCalled();
        expect(moveToFailed).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('blocked=1'),
          }),
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it.each([
    'blocked',
    'snapshot-failed',
    'open-run-failed',
    'readonly',
    'empty',
    'noop',
  ])('%s is reported without a false refresh', async (mode) => {
    const result: ProjectionRunResult = {
      runId:
        mode === 'open-run-failed' || mode === 'empty' || mode === 'readonly'
          ? null
          : 'fixture-run',
      triggeredBy: 'manual',
      entitiesWritten: 0,
      rolesWritten: 0,
      rolesBlocked: mode === 'blocked' ? 1 : 0,
      rolesNoop: mode === 'noop' ? 1 : 0,
      rolesRegressed: 0,
      outcomes: [],
      refreshEnqueued: false,
      snapshot:
        mode === 'snapshot-failed' ||
        mode === 'open-run-failed' ||
        mode === 'empty' ||
        mode === 'readonly'
          ? null
          : { hash: 'H', uri: 'fixture://snapshot' },
      readOnlySkipped: mode === 'readonly',
    };
    const add = jest.fn();
    const processor = new SeoProjectionWriteProcessor(
      {
        projectExports: jest.fn().mockResolvedValue(result),
        hasPendingProjectionRefresh: jest.fn().mockResolvedValue(false),
      } as unknown as SeoProjectionWriterService,
      { add } as unknown as Queue,
    );
    const promise = processor.handle({
      data: { exportPaths: mode === 'empty' ? [] : ['fixture.json'] },
    } as Job<ProjectionWriteJobData>);
    if (['blocked', 'snapshot-failed', 'open-run-failed'].includes(mode))
      await expect(promise).rejects.toThrow();
    else await expect(promise).resolves.toEqual(result);
    expect(add).not.toHaveBeenCalled();
  });
});
