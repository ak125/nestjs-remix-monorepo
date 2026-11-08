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
type Op = 'select' | 'upsert' | 'insert' | 'update';
interface MockState {
  factsActive: Map<string, { content_hash: string; version_id?: string }>;
  blocksActive: Map<
    string,
    {
      content_hash: string;
      confidence_base: number | null;
      version_id?: string;
    }
  >;
  /** Drafts existants keyés `${block_id}::${content_hash}` (test d'idempotence de régression). */
  draftsByHash?: Set<string>;
  /** `active_version_id` keyé entity_id / block_id ; défaut = la version active (pointeur cohérent). */
  pointers?: Map<string, string | null>;
  /** Erreur PostgREST injectée sur l'opération qui correspond (filtres complets au terminal). */
  failOn?: (table: string, op: Op, filters: Record<string, unknown>) => boolean;
}
interface RecordedOp {
  table: string;
  op: 'upsert' | 'insert' | 'update';
  payload: Record<string, unknown>;
}

/** Identifiant de la version active d'un état mocké (défaut `active:<clé>`). */
const activeVersionId = (key: string, active: { version_id?: string }) =>
  active.version_id ?? `active:${key}`;

function makeSupabase(state: MockState) {
  const ops: RecordedOp[] = [];
  let insertSeq = 0;

  class Q {
    private op: Op = 'select';
    private payload: Record<string, unknown> = {};
    private filters: Record<string, unknown> = {};
    constructor(private readonly table: string) {}
    upsert(payload: Record<string, unknown>) {
      this.op = 'upsert';
      this.payload = payload;
      ops.push({ table: this.table, op: 'upsert', payload });
      return this;
    }
    insert(payload: Record<string, unknown>) {
      this.op = 'insert';
      this.payload = payload;
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
    neq(k: string, v: unknown) {
      this.filters[`neq_${k}`] = v;
      return this;
    }
    limit(_n: number) {
      return this;
    }
    maybeSingle() {
      return this.result(() => this.resolve());
    }
    single() {
      if (this.op === 'insert') {
        return this.result(() => {
          insertSeq += 1;
          // run_id sert à openRun (`.select('run_id')`) ; version_id aux inserts de versions.
          return { version_id: `v-${insertSeq}`, run_id: `run-${insertSeq}` };
        });
      }
      // Upsert de la ligne entity/bloc : le writer relit son pointeur.
      if (this.op === 'upsert') {
        return this.result(() => ({ active_version_id: this.pointer() }));
      }
      return this.result(() => this.resolve());
    }
    // Rend Q awaitable pour les chaînes update/insert/upsert sans terminal explicite.
    then(onF: (v: { data: unknown; error: unknown }) => unknown) {
      return this.result(() => null).then(onF);
    }
    private result<T>(
      data: () => T,
    ): Promise<{ data: T | null; error: { message: string } | null }> {
      if (state.failOn?.(this.table, this.op, this.filters)) {
        return Promise.resolve({
          data: null,
          error: { message: `injected ${this.op} ${this.table}` },
        });
      }
      return Promise.resolve({ data: data(), error: null });
    }
    private pointer(): string | null {
      const isFacts = this.table === '__seo_entity_facts';
      const key = String(
        isFacts ? this.payload.entity_id : this.payload.block_id,
      );
      if (state.pointers?.has(key)) return state.pointers.get(key) ?? null;
      const active = isFacts
        ? state.factsActive.get(key)
        : state.blocksActive.get(key);
      return active ? activeVersionId(key, active) : null;
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
      const key = String(
        this.table === '__seo_entity_fact_versions'
          ? this.filters.entity_id
          : this.filters.block_id,
      );
      const active =
        this.table === '__seo_entity_fact_versions'
          ? state.factsActive.get(key)
          : this.table === '__seo_content_block_versions'
            ? state.blocksActive.get(key)
            : undefined;
      return active
        ? { ...active, version_id: activeVersionId(key, active) }
        : null;
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

/** Allowlist d'écriture — miroir des défauts de `FeatureFlagsService` (gamme roles overridable). */
function makeFeatureFlags(gammeRoles?: string[]) {
  return {
    seoProjectionWritableTypes: ['gamme', 'constructeur', 'vehicle'],
    seoProjectionWritableRoles: (entityType: string): string[] => {
      switch (entityType) {
        case 'gamme':
          return (
            gammeRoles ?? ['R3_CONSEILS', 'R4_REFERENCE', 'R6_GUIDE_ACHAT']
          );
        case 'constructeur':
          return ['R7_BRAND'];
        case 'vehicle':
          return ['R8_VEHICLE'];
        default:
          return [];
      }
    },
  };
}

function makeWriter(
  client: { from: (t: string) => unknown },
  opts: { gammeRoles?: string[] } = {},
): TestWriter {
  // Bypass du constructeur SupabaseBaseService (I/O lourde) : on greffe supabase + log sur le proto.
  const writer = Object.create(SeoProjectionWriterService.prototype);
  writer.supabase = client;
  writer.log = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  writer.readOnly = false;
  writer.featureFlags = makeFeatureFlags(opts.gammeRoles);
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
const conflictInserts = (ops: RecordedOp[]) =>
  inserts(ops, '__seo_projection_conflicts');

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

// Allowlist d'écriture gouvernée (`seoProjectionWritableTypes` / `seoProjectionWritableRoles`)
// appliquée AU WRITER, quel que soit le déclencheur. Régression corrigée : le slurp nocturne écrivait
// tout export découvert, avec tous ses rôles — l'allowlist n'était vérifiée que par le trigger
// single-entity du feeder.
describe('allowlist d’écriture — appliquée au seul point d’écriture (writer)', () => {
  type ProjectOneFn = (
    p: string,
    r: string | null,
    role?: string,
  ) => Promise<{
    roleOutcome: string;
    factsOutcome: string;
    reasons?: string[];
  }>;

  async function projectOneFromFile(
    exp: SeoProjectionExport,
    role?: string,
  ): Promise<{
    out: Awaited<ReturnType<ProjectOneFn>>;
    ops: RecordedOp[];
  }> {
    const dir = mkdtempSync(join(tmpdir(), 'seo-proj-scope-'));
    const exportPath = join(dir, 'export.json');
    writeFileSync(exportPath, JSON.stringify(exp), 'utf-8');
    try {
      const { client, ops } = makeSupabase({
        factsActive: new Map(),
        blocksActive: new Map(),
      });
      const writer = makeWriter(client) as unknown as {
        gate: { evaluate: () => { ok: boolean; verdicts: [] } };
        projectOne: ProjectOneFn;
      };
      writer.gate = { evaluate: () => ({ ok: true, verdicts: [] }) };
      const out = await writer.projectOne(exportPath, 'run-scope', role);
      return { out, ops };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('slurp avec rôles gamme restreints (R3 seul) → SEULS les blocs R3 écrits, R4 jamais', async () => {
    const { client, ops } = makeSupabase({
      factsActive: new Map(),
      blocksActive: new Map(),
    });
    const writer = makeWriter(client, { gammeRoles: ['R3_CONSEILS'] });
    const out = await writer.writeEntity(exportFixture(), 'run-s1');
    expect(out.roleOutcome).toBe('written');
    const bvi = blockVersionInserts(ops);
    expect(bvi).toHaveLength(1);
    expect(bvi[0].payload.block_id).toContain('R3_CONSEILS');
    expect(
      ops.some(
        (o) =>
          o.table === '__seo_content_blocks' &&
          o.payload.role === 'R4_REFERENCE',
      ),
    ).toBe(false);
  });

  it('slurp d’un export vehicle portant un bloc R3 → bloc R3 NON écrit (R8 seul autorisé)', async () => {
    const { client, ops } = makeSupabase({
      factsActive: new Map(),
      blocksActive: new Map(),
    });
    const writer = makeWriter(client);
    const exp: SeoProjectionExport = {
      ...exportFixture(),
      entity_id: 'vehicle:renault-clio-3',
      entity_type: 'vehicle',
      roles_allowed: ['R8_VEHICLE', 'R3_CONSEILS'],
      blocks: [
        {
          role: 'R8_VEHICLE',
          content_md: 'r8',
          source_ids: [],
          truth_level: 'sourced',
          section: 'Presentation',
          content_hash: 'R8_H1',
        },
        {
          role: 'R3_CONSEILS',
          content_md: 'r3',
          source_ids: [],
          truth_level: 'sourced',
          section: 'Diagnostic',
          content_hash: 'R3_H1',
        },
      ],
    };
    await writer.writeEntity(exp, 'run-s2');
    const bvi = blockVersionInserts(ops);
    expect(bvi).toHaveLength(1);
    expect(bvi[0].payload.block_id).toContain('R8_VEHICLE');
  });

  it('type hors allowlist (diagnostic) → conflit type_not_writable, rien écrit', async () => {
    const { out, ops } = await projectOneFromFile({
      ...exportFixture(),
      entity_id: 'diagnostic:bruit-freinage',
      entity_type: 'diagnostic',
    });
    expect(out.roleOutcome).toBe('blocked');
    expect(out.factsOutcome).toBe('noop');
    expect(factVersionInserts(ops)).toHaveLength(0);
    expect(blockVersionInserts(ops)).toHaveLength(0);
    const conflicts = inserts(ops, '__seo_projection_conflicts');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].payload.conflict_kind).toBe('type_not_writable');
  });

  it('rôle demandé non autorisé pour le type (R7 sur gamme) → conflit role_not_writable, rien écrit', async () => {
    const { out, ops } = await projectOneFromFile(
      { ...exportFixture(), roles_allowed: ['R3_CONSEILS', 'R7_BRAND'] },
      'R7_BRAND',
    );
    expect(out.roleOutcome).toBe('blocked');
    expect(factVersionInserts(ops)).toHaveLength(0);
    expect(blockVersionInserts(ops)).toHaveLength(0);
    const conflicts = inserts(ops, '__seo_projection_conflicts');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].payload.conflict_kind).toBe('role_not_writable');
  });

  it('type + rôle autorisés → la garde laisse passer (écriture R3)', async () => {
    const { out, ops } = await projectOneFromFile(
      exportFixture(),
      'R3_CONSEILS',
    );
    expect(out.roleOutcome).toBe('written');
    expect(inserts(ops, '__seo_projection_conflicts')).toHaveLength(0);
  });
});

// Intégrité des écritures : une erreur PostgREST sur l'upsert, la lecture de l'active, la dépréciation
// ou le flip du pointeur remonte (conflit `write_error`, rôle bloqué, run `failed`). Régression
// corrigée : ces résultats n'étaient pas lus, et un flip perdu après dépréciation retirait le bloc des
// vues servies (qui joignent `active_version_id` ET `status='active'`) sans aucun signal.
describe('intégrité des écritures — erreur remontée, pointeur réparé', () => {
  const noFailure = (): MockState => ({
    factsActive: new Map(),
    blocksActive: new Map(),
  });
  const regressState = (): MockState => ({
    factsActive: new Map([
      ['gamme:filtre-a-huile', { content_hash: 'FACTS_H1' }],
    ]),
    blocksActive: new Map([
      [R3_BLOCK_ID, { content_hash: 'ACTIVE_H', confidence_base: 0.9 }],
    ]),
    draftsByHash: new Set(),
  });
  const writes = (ops: RecordedOp[], table: string, op: RecordedOp['op']) =>
    ops.filter((o) => o.table === table && o.op === op);

  it.each<{
    name: string;
    failOn: NonNullable<MockState['failOn']>;
    regress?: boolean;
    untouched?: [string, RecordedOp['op']];
  }>([
    {
      name: 'upsert entity_facts',
      failOn: (t, op) => t === '__seo_entity_facts' && op === 'upsert',
      untouched: ['__seo_entity_fact_versions', 'insert'],
    },
    {
      name: 'lecture fact_version active',
      failOn: (t, op, f) =>
        t === '__seo_entity_fact_versions' &&
        op === 'select' &&
        f.status === 'active',
      untouched: ['__seo_entity_fact_versions', 'insert'],
    },
    {
      name: 'dépréciation fact_version',
      failOn: (t, op) => t === '__seo_entity_fact_versions' && op === 'update',
      untouched: ['__seo_entity_facts', 'update'],
    },
    {
      name: 'flip pointeur entity_facts',
      failOn: (t, op) => t === '__seo_entity_facts' && op === 'update',
      untouched: ['__seo_content_blocks', 'upsert'],
    },
    {
      name: 'upsert content_blocks',
      failOn: (t, op) => t === '__seo_content_blocks' && op === 'upsert',
      untouched: ['__seo_content_block_versions', 'insert'],
    },
    {
      // Plusieurs actives = erreur PGRST116 : `active` nul contournerait la no-rétro-régression.
      name: 'lecture block_version active (garde de régression)',
      failOn: (t, op, f) =>
        t === '__seo_content_block_versions' &&
        op === 'select' &&
        f.status === 'active',
      regress: true,
      untouched: ['__seo_content_block_versions', 'insert'],
    },
    {
      name: 'dédup draft régressant',
      failOn: (t, op, f) =>
        t === '__seo_content_block_versions' &&
        op === 'select' &&
        f.status === 'draft',
      regress: true,
      untouched: ['__seo_content_block_versions', 'insert'],
    },
    {
      name: 'dépréciation block_version',
      failOn: (t, op) =>
        t === '__seo_content_block_versions' && op === 'update',
      untouched: ['__seo_content_blocks', 'update'],
    },
    {
      name: 'flip pointeur content_blocks',
      failOn: (t, op) => t === '__seo_content_blocks' && op === 'update',
    },
  ])(
    'erreur sur $name → writeEntity rejette, écriture suivante non tentée',
    async ({ failOn, regress, untouched }) => {
      const { client, ops } = makeSupabase({
        ...(regress ? regressState() : noFailure()),
        failOn,
      });
      await expect(
        makeWriter(client).writeEntity(
          regress ? regressExport() : exportFixture(),
          'run-err',
          'R3_CONSEILS',
        ),
      ).rejects.toThrow(/injected/);
      if (untouched) expect(writes(ops, ...untouched)).toHaveLength(0);
    },
  );

  it('flip perdu en cours de run → conflit write_error, rôle bloqué, run fermé failed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'seo-proj-integrity-'));
    const exportPath = join(dir, 'filtre-a-huile.json');
    writeFileSync(exportPath, JSON.stringify(exportFixture()), 'utf-8');
    try {
      const { client, ops } = makeSupabase({
        ...noFailure(),
        failOn: (t, op) => t === '__seo_content_blocks' && op === 'update',
      });
      const writer = makeWriter(client) as unknown as TestWriter & {
        gate: { evaluate: () => { ok: boolean; verdicts: [] } };
        buildSnapshotForRun: () => Promise<{ hash: string; uri: string }>;
      };
      writer.gate = { evaluate: () => ({ ok: true, verdicts: [] }) };
      writer.buildSnapshotForRun = () =>
        Promise.resolve({ hash: 'snap-h', uri: 'file:///snap' });

      const res = await writer.projectExports(
        [exportPath],
        'manual',
        {},
        'R3_CONSEILS',
      );

      expect(res.rolesWritten).toBe(0);
      const conflicts = conflictInserts(ops);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].payload.conflict_kind).toBe('write_error');
      const runUpdates = writes(ops, '__seo_projection_runs', 'update');
      expect(runUpdates).toHaveLength(1);
      expect(runUpdates[0].payload.status).toBe('failed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('facts : active à jour mais non pointée → pointeur réparé, 0 nouvelle version', async () => {
    const { client, ops } = makeSupabase({
      factsActive: new Map([
        [
          'gamme:filtre-a-huile',
          { content_hash: 'FACTS_H1', version_id: 'fv-2' },
        ],
      ]),
      blocksActive: new Map(),
      pointers: new Map([['gamme:filtre-a-huile', 'fv-1']]),
    });
    const writer = makeWriter(client);
    const out = await writer.writeEntity(
      exportFixture(),
      'run-r1',
      'R3_CONSEILS',
    );

    expect(out.factsOutcome).toBe('written');
    expect(factVersionInserts(ops)).toHaveLength(0);
    const flips = writes(ops, '__seo_entity_facts', 'update');
    expect(flips).toHaveLength(1);
    expect(flips[0].payload.active_version_id).toBe('fv-2');
    expect(
      (writer as unknown as { log: { warn: jest.Mock } }).log.warn,
    ).toHaveBeenCalledWith(expect.stringContaining('pointeur réparé'));
  });

  it('bloc : active à jour mais non pointée → pointeur réparé, 0 nouvelle version, rôle written', async () => {
    const { client, ops } = makeSupabase({
      factsActive: new Map([
        ['gamme:filtre-a-huile', { content_hash: 'FACTS_H1' }],
      ]),
      blocksActive: new Map([
        [
          R3_BLOCK_ID,
          { content_hash: 'R3_H1', confidence_base: null, version_id: 'bv-2' },
        ],
      ]),
      pointers: new Map([[R3_BLOCK_ID, null]]),
    });
    const out = await makeWriter(client).writeEntity(
      exportFixture(),
      'run-r2',
      'R3_CONSEILS',
    );

    expect(out.factsOutcome).toBe('noop');
    // `written` déclenche le refresh des vues : le bloc y réapparaît.
    expect(out.roleOutcome).toBe('written');
    expect(blockVersionInserts(ops)).toHaveLength(0);
    const deprecations = writes(ops, '__seo_content_block_versions', 'update');
    expect(deprecations).toHaveLength(1);
    expect(deprecations[0].payload.status).toBe('deprecated');
    const flips = writes(ops, '__seo_content_blocks', 'update');
    expect(flips).toHaveLength(1);
    expect(flips[0].payload.active_version_id).toBe('bv-2');
  });

  it('bloc régressant dont l’active conservée est non pointée → pointeur réparé + draft', async () => {
    const state = regressState();
    state.pointers = new Map([[R3_BLOCK_ID, 'bv-old']]);
    const { client, ops } = makeSupabase(state);
    const out = await makeWriter(client).writeEntity(
      regressExport(),
      'run-r3',
      'R3_CONSEILS',
    );

    expect(out.roleOutcome).toBe('written');
    const flips = writes(ops, '__seo_content_blocks', 'update');
    expect(flips).toHaveLength(1);
    expect(flips[0].payload.active_version_id).toBe(`active:${R3_BLOCK_ID}`);
    const bvi = blockVersionInserts(ops);
    expect(bvi).toHaveLength(1);
    expect(bvi[0].payload.status).toBe('draft');
    expect(conflictInserts(ops)).toHaveLength(1);
  });

  it('pointeurs cohérents → no-op strict (0 dépréciation, 0 flip)', async () => {
    const { client, ops } = makeSupabase({
      factsActive: new Map([
        ['gamme:filtre-a-huile', { content_hash: 'FACTS_H1' }],
      ]),
      blocksActive: new Map([
        [R3_BLOCK_ID, { content_hash: 'R3_H1', confidence_base: null }],
      ]),
    });
    const out = await makeWriter(client).writeEntity(
      exportFixture(),
      'run-r4',
      'R3_CONSEILS',
    );
    expect(out.factsOutcome).toBe('noop');
    expect(out.roleOutcome).toBe('noop');
    expect(ops.filter((o) => o.op === 'update')).toHaveLength(0);
  });

  it('insert de conflit ou fermeture de run en échec → journalisé, sans exception', async () => {
    const { client } = makeSupabase({
      ...noFailure(),
      failOn: (t) =>
        t === '__seo_projection_conflicts' || t === '__seo_projection_runs',
    });
    const writer = makeWriter(client) as unknown as {
      log: { error: jest.Mock };
      recordConflict: (...a: unknown[]) => Promise<void>;
      closeRun: (...a: unknown[]) => Promise<void>;
    };
    await expect(
      writer.recordConflict('gamme:x', null, 'gate_blocked', {}, 'run-1'),
    ).resolves.toBeUndefined();
    await expect(
      writer.closeRun('run-1', {
        entitiesWritten: 0,
        failed: true,
        snapshot: null,
      }),
    ).resolves.toBeUndefined();
    expect(writer.log.error).toHaveBeenCalledTimes(2);
  });
});
