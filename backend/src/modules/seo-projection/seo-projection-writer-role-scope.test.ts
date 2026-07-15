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
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import type { SeoProjectionExport } from './seo-projection.types';

// ── Client Supabase chaînable mocké ───────────────────────────────────────────
interface MockState {
  factsActive: Map<string, { content_hash: string }>;
  blocksActive: Map<
    string,
    { content_hash: string; confidence_base: number | null }
  >;
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
    maybeSingle() {
      return Promise.resolve({ data: this.resolveActive(), error: null });
    }
    single() {
      if (this.op === 'insert') {
        insertSeq += 1;
        return Promise.resolve({
          data: { version_id: `v-${insertSeq}` },
          error: null,
        });
      }
      return Promise.resolve({ data: this.resolveActive(), error: null });
    }
    // Rend Q awaitable pour les chaînes update/insert-conflict sans terminal explicite.
    then(onF: (v: { data: null; error: null }) => unknown) {
      return Promise.resolve({ data: null, error: null }).then(onF);
    }
    private resolveActive(): {
      content_hash: string;
      confidence_base?: number | null;
    } | null {
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
) => Promise<{ factsOutcome: string; roleOutcome: string }>;

function makeWriter(client: { from: (t: string) => unknown }): {
  writeEntity: WriteEntityFn;
} {
  // Bypass du constructeur SupabaseBaseService (I/O lourde) : on greffe supabase + log sur le proto.
  const writer = Object.create(SeoProjectionWriterService.prototype);
  writer.supabase = client;
  writer.log = { warn() {}, error() {}, log() {} };
  return writer as { writeEntity: WriteEntityFn };
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
});
