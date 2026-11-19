process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

// Le mock partagé de @repo/database-types ne porte pas ces trois tables.
jest.mock('@repo/database-types', () => ({
  TABLES: {
    auto_type: 'auto_type',
    auto_type_motor_code: 'auto_type_motor_code',
    pieces_relation_type: 'pieces_relation_type',
  },
}));

import { R2TitleCollisionService } from '../r2-title-collision.service';

/**
 * Complément 1 du mandat DW (2026-11-19) : code moteur des seuls titres R2 en
 * collision. Données = paires relevées dans `auto_type` le 2026-11-19
 * (modèle 58030, FIAT DUCATO V Fourgon (250-290)).
 */
type Row = Record<string, unknown>;
interface Tables {
  auto_type: Row[];
  pieces_relation_type: Row[];
  auto_type_motor_code: Row[];
}

/** Client minimal : filtres eq / neq / in, limit, maybeSingle. */
function fakeClient(tables: Tables, failOn?: keyof Tables) {
  return {
    from(table: keyof Tables) {
      const filters: Array<(r: Row) => boolean> = [];
      let max = Infinity;
      const run = () => {
        if (table === failOn) {
          return { data: null, error: new Error(`${table} unavailable`) };
        }
        return {
          data: tables[table]
            .filter((r) => filters.every((f) => f(r)))
            .slice(0, max),
          error: null,
        };
      };
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (
          filters.push((r) => String(r[c]) === String(v)),
          q
        ),
        neq: (c: string, v: unknown) => (
          filters.push((r) => String(r[c]) !== String(v)),
          q
        ),
        in: (c: string, vs: unknown[]) => (
          filters.push((r) => vs.map(String).includes(String(r[c]))),
          q
        ),
        limit: (n: number) => ((max = n), q),
        returns: () => q,
        maybeSingle: async () => {
          const r = run();
          return { data: r.data?.[0] ?? null, error: r.error };
        },
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(run()).then(ok, ko),
      };
      return q;
    },
  };
}

const type = (id: string, power: string, extra: Partial<Row> = {}): Row => ({
  type_id: id,
  type_modele_id: '58030',
  type_name: '2.3 D Multijet',
  type_power_ps: power,
  type_fuel: 'Diesel',
  type_display: '1',
  ...extra,
});

const BASE: Tables = {
  auto_type: [
    type('10207', '150'),
    type('65976', '150'),
    type('15958', '110'),
    type('65978', '110'),
    type('65977', '180'),
  ],
  pieces_relation_type: [
    { rtp_pg_id: 10, rtp_type_id: 10207 },
    { rtp_pg_id: 10, rtp_type_id: 65976 },
    { rtp_pg_id: 10, rtp_type_id: 15958 },
    { rtp_pg_id: 10, rtp_type_id: 65978 },
    { rtp_pg_id: 10, rtp_type_id: 65977 },
  ],
  auto_type_motor_code: [
    { tmc_type_id: '10207', tmc_code: 'F1AE3481E' },
    { tmc_type_id: '65976', tmc_code: 'F1AGL411C' },
    { tmc_type_id: '65976', tmc_code: 'F1AGL411A' },
    { tmc_type_id: '15958', tmc_code: 'F1AE3481G' },
    { tmc_type_id: '65978', tmc_code: 'F1AE3481G' },
    { tmc_type_id: '65977', tmc_code: 'F1AGL4111' },
  ],
};

function build(tables: Tables, failOn?: keyof Tables) {
  const svc = new R2TitleCollisionService();
  (svc as unknown as { supabase: unknown }).supabase = fakeClient(
    tables,
    failOn,
  );
  const warn = jest
    .spyOn((svc as unknown as { logger: { warn: () => void } }).logger, 'warn')
    .mockImplementation(() => undefined);
  return { svc, warn };
}

describe('R2TitleCollisionService (complément 1 DW)', () => {
  it('collision départagée : chaque page reçoit son premier code', async () => {
    const { svc } = build(BASE);
    expect(await svc.resolveMotorCode(10, 10207)).toBe('F1AE3481E');
    // Codes reçus dans le désordre : ordre stable par point de code.
    expect(await svc.resolveMotorCode(10, 65976)).toBe('F1AGL411A');
  });

  it('aucun type de même libellé : pas de code', async () => {
    const { svc } = build(BASE);
    expect(await svc.resolveMotorCode(10, 65977)).toBe('');
  });

  it('type voisin sans pièces dans la gamme : pas de collision', async () => {
    const { svc } = build({
      ...BASE,
      pieces_relation_type: BASE.pieces_relation_type.filter(
        (r) => r.rtp_type_id !== 65976,
      ),
    });
    expect(await svc.resolveMotorCode(10, 10207)).toBe('');
    // Autre gamme : aucune pièce pour ces types.
    expect(await svc.resolveMotorCode(316, 65976)).toBe('');
  });

  it('type voisin masqué (type_display ≠ 1) : pas de collision', async () => {
    const { svc } = build({
      ...BASE,
      auto_type: BASE.auto_type.map((t) =>
        t.type_id === '65976' ? { ...t, type_display: '0' } : t,
      ),
    });
    expect(await svc.resolveMotorCode(10, 10207)).toBe('');
  });

  it('mêmes codes : collision non départagée, signalée, pas de code', async () => {
    const { svc, warn } = build(BASE);
    expect(await svc.resolveMotorCode(10, 15958)).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('65978'));
  });

  it('carburant de graphie différente : même libellé, donc collision', async () => {
    // Cas construit (identifiants et codes fictifs) : deux graphies du même
    // carburant ne doivent pas suffire à départager deux titres.
    const hybrid = (id: string, fuel: string): Row =>
      type(id, '122', { type_name: '1.8 Hybrid', type_fuel: fuel });
    const { svc } = build({
      auto_type: [
        hybrid('1', 'Essence-Electrique'),
        hybrid('2', 'Essence-Électrique'),
      ],
      pieces_relation_type: [
        { rtp_pg_id: 10, rtp_type_id: 1 },
        { rtp_pg_id: 10, rtp_type_id: 2 },
      ],
      auto_type_motor_code: [
        { tmc_type_id: '1', tmc_code: '2ZR-FXE' },
        { tmc_type_id: '2', tmc_code: '2ZR-FXE' },
      ],
    });
    expect(await svc.resolveMotorCode(10, 1)).toBe('');
  });

  it('erreur de lecture : levée, pas de titre dégradé', async () => {
    for (const table of [
      'auto_type',
      'pieces_relation_type',
      'auto_type_motor_code',
    ] as const) {
      const { svc } = build(BASE, table);
      await expect(svc.resolveMotorCode(10, 10207)).rejects.toThrow(
        'unavailable',
      );
    }
  });
});
