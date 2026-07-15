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
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import type { SeoProjectionExport } from './seo-projection.types';

// ── Client Supabase chaînable mocké ───────────────────────────────────────────
interface MockState {
  factsActive: Map<string, { content_hash: string }>;
  blocksActive: Map<
    string,
    { content_hash: string; confidence_base: number | null }
  >;
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

  class Q {
    private op: 'select' | 'upsert' | 'insert' | 'update' = 'select';
    private filters: Record<string, unknown> = {};
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
    neq(k: string, v: unknown) {
      this.filters[`neq_${k}`] = v;
      return this;
    }
    limit(_n: number) {
      return this;
    }
    maybeSingle() {
      return Promise.resolve({ data: this.resolve(), error: null });
    }
    single() {
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
    then(onF: (v: { data: null; error: null }) => unknown) {
      return Promise.resolve({ data: null, error: null }).then(onF);
    }
    private resolve(): {
      content_hash?: string;
      confidence_base?: number | null;
      version_id?: string;
    } | null {
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
        return state.blocksActive.get(this.filters.block_id as string) ?? null;
      }
      return null;
    }
  }
  return { client: { from: (t: string) => new Q(t) }, ops };
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
  projectExports: (
    paths: string[],
    t?: string,
    m?: Record<string, unknown>,
    role?: string,
  ) => Promise<{
    runId: string | null;
    entitiesWritten: number;
    rolesWritten: number;
    snapshot: unknown;
  }>;
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
      (o) => o.table === '__seo_content_blocks' && o.op === 'upsert',
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
      (o) => o.table === '__seo_content_blocks' && o.op === 'upsert',
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
          (o) => o.table === '__seo_content_blocks' && o.op === 'upsert',
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
