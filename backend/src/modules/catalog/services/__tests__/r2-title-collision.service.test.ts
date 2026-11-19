process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

// Le mock partagé de @repo/database-types ne porte pas ces quatre tables.
jest.mock('@repo/database-types', () => ({
  TABLES: {
    auto_modele: 'auto_modele',
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
  auto_modele?: Row[];
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
          data: (tables[table] ?? [])
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

/** Modèles relevés le 2026-11-19 (auto_modele), tous affichés. */
const MODELS: Row[] = [
  ['58030', 58, 'DUCATO V Fourgon (250-290)', 'DUCATO V Fourgon (250-290)'],
  ['76083', 76, 'TUCSON I', 'TUCSON I'],
  ['173138', 173, 'TIGUAN I', 'TIGUAN I'],
  ['173094', 173, 'PASSAT VII B7', 'PASSAT VII'],
  ['173095', 173, 'PASSAT VII B7 (A32-A33)', 'PASSAT VII'],
].map(([id, brand, name, meta]) => ({
  modele_id: Number(id),
  modele_marque_id: brand,
  modele_name: name,
  modele_name_meta: meta,
  modele_display: 1,
}));

function build(tables: Tables, failOn?: keyof Tables) {
  const svc = new R2TitleCollisionService();
  (svc as unknown as { supabase: unknown }).supabase = fakeClient(
    { auto_modele: MODELS, ...tables },
    failOn,
  );
  const warn = jest
    .spyOn((svc as unknown as { logger: { warn: () => void } }).logger, 'warn')
    .mockImplementation(() => undefined);
  return { svc, warn };
}

const code = async (
  svc: R2TitleCollisionService,
  ...a: [number, number, boolean?]
) => (await svc.resolveTitle(...a)).motorCode;

describe('R2TitleCollisionService (complément 1 DW)', () => {
  it('collision départagée : chaque page reçoit son premier code', async () => {
    const { svc } = build(BASE);
    expect(await code(svc, 10, 10207)).toBe('F1AE3481E');
    // Codes reçus dans le désordre : ordre stable par point de code.
    expect(await code(svc, 10, 65976)).toBe('F1AGL411A');
  });

  it('aucun type de même libellé : pas de code', async () => {
    const { svc } = build(BASE);
    expect(await code(svc, 10, 65977)).toBe('');
  });

  it('type voisin sans pièces dans la gamme : pas de collision', async () => {
    const { svc } = build({
      ...BASE,
      pieces_relation_type: BASE.pieces_relation_type.filter(
        (r) => r.rtp_type_id !== 65976,
      ),
    });
    expect(await code(svc, 10, 10207)).toBe('');
    // Autre gamme : aucune pièce pour ces types.
    expect(await code(svc, 316, 65976)).toBe('');
  });

  it('type voisin masqué (type_display ≠ 1) : pas de collision', async () => {
    const { svc } = build({
      ...BASE,
      auto_type: BASE.auto_type.map((t) =>
        t.type_id === '65976' ? { ...t, type_display: '0' } : t,
      ),
    });
    expect(await code(svc, 10, 10207)).toBe('');
  });

  it('mêmes codes : collision non départagée, signalée, pas de code', async () => {
    const { svc, warn } = build(BASE);
    expect(await code(svc, 10, 15958)).toBe('');
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
    expect(await code(svc, 10, 1)).toBe('');
  });

  describe("noms d'affichage (complément 2 DW)", () => {
    // Types relevés le 2026-11-19 : noms bruts identiques, noms d'affichage
    // différents (15958 « 2.3 D », 65978 « 2.3 JTD »).
    const META: Tables = {
      ...BASE,
      auto_type: BASE.auto_type.map((t) => ({
        ...t,
        type_name_meta: t.type_id === '65978' ? '2.3 JTD' : '2.3 D',
      })),
    };

    it("libellés d'affichage distincts : plus de collision", async () => {
      const { svc, warn } = build(META);
      expect(await code(svc, 10, 15958, true)).toBe('');
      expect(warn).not.toHaveBeenCalled();
      // Noms bruts (RPC non branché) : collision non départagée, comme avant.
      expect(await code(svc, 10, 15958, false)).toBe('');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('65978'));
    });

    it("libellés d'affichage identiques : collision départagée", async () => {
      // Modèle 173138, types 82550 « 1.4 TSI (Phase 2) » et 29996
      // « 1.4 TSI (Phase 1) », tous deux « 1.4 TSI » 150 ch Essence.
      const tsi = (id: string, name: string): Row => ({
        type_id: id,
        type_modele_id: '173138',
        type_name: name,
        type_name_meta: '1.4 TSI',
        type_power_ps: '150',
        type_fuel: 'Essence',
        type_display: '1',
      });
      const tables: Tables = {
        auto_type: [
          tsi('82550', '1.4 TSI (Phase 2)'),
          tsi('29996', '1.4 TSI (Phase 1)'),
        ],
        pieces_relation_type: [
          { rtp_pg_id: 10, rtp_type_id: 82550 },
          { rtp_pg_id: 10, rtp_type_id: 29996 },
        ],
        auto_type_motor_code: [
          { tmc_type_id: '82550', tmc_code: 'CZDA' },
          { tmc_type_id: '29996', tmc_code: 'BWK' },
          { tmc_type_id: '29996', tmc_code: 'CAVA' },
          { tmc_type_id: '29996', tmc_code: 'CTHA' },
        ],
      };
      const { svc } = build(tables);
      expect(await code(svc, 10, 82550, true)).toBe('CZDA');
      expect(await code(svc, 10, 29996, true)).toBe('BWK');
      // Noms bruts : libellés distincts, aucun code.
      expect(await code(svc, 10, 82550, false)).toBe('');
    });

    it("noms d'affichage confondus, mêmes codes : nom brut, sans code", async () => {
      // Modèle 76083 (HYUNDAI TUCSON I), relevé le 2026-11-19 : 19623
      // « 2.0 CRDI » et 19624 « 2.0 CRDI Traction Intégrale », tous deux
      // « 2.0 CRDi » 140 ch Diesel, code D4EA.
      const crdi = (id: string, name: string): Row => ({
        type_id: id,
        type_modele_id: '76083',
        type_name: name,
        type_name_meta: '2.0 CRDi',
        type_power_ps: '140',
        type_fuel: 'Diesel',
        type_display: '1',
      });
      const { svc, warn } = build({
        auto_type: [
          crdi('19623', '2.0 CRDI'),
          crdi('19624', '2.0 CRDI Traction Intégrale'),
        ],
        pieces_relation_type: [
          { rtp_pg_id: 4, rtp_type_id: 19623 },
          { rtp_pg_id: 4, rtp_type_id: 19624 },
        ],
        auto_type_motor_code: [
          { tmc_type_id: '19623', tmc_code: 'D4EA' },
          { tmc_type_id: '19624', tmc_code: 'D4EA' },
        ],
      });
      for (const id of [19623, 19624]) {
        expect(await svc.resolveTitle(4, id, true)).toEqual({
          motorCode: '',
          rawNames: true,
        });
      }
      expect(warn).not.toHaveBeenCalled();
    });

    it("modèles distincts, même nom d'affichage : collision entre modèles", async () => {
      // Relevé le 2026-11-19 : types 294 (modèle 173094, code CFFB) et 56884
      // (modèle 173095, codes CFFB, CKRA), « 2.0 TDI » 140 ch Diesel, modèles
      // affichés tous deux « PASSAT VII ». Premier code identique : noms bruts,
      // qui diffèrent par le modèle.
      const tdi = (id: string, model: string): Row => ({
        type_id: id,
        type_modele_id: model,
        type_name: '2.0 TDI',
        type_name_meta: '2.0 TDI',
        type_power_ps: '140',
        type_fuel: 'Diesel',
        type_display: '1',
      });
      const { svc, warn } = build({
        auto_type: [tdi('294', '173094'), tdi('56884', '173095')],
        pieces_relation_type: [
          { rtp_pg_id: 10, rtp_type_id: 294 },
          { rtp_pg_id: 10, rtp_type_id: 56884 },
        ],
        auto_type_motor_code: [
          { tmc_type_id: '294', tmc_code: 'CFFB' },
          { tmc_type_id: '56884', tmc_code: 'CFFB' },
          { tmc_type_id: '56884', tmc_code: 'CKRA' },
        ],
      });
      expect(await svc.resolveTitle(10, 294, true)).toEqual({
        motorCode: '',
        rawNames: true,
      });
      // Noms bruts d'emblée : modèles distincts, aucune collision.
      expect(await svc.resolveTitle(10, 294, false)).toEqual({
        motorCode: '',
        rawNames: false,
      });
      expect(warn).not.toHaveBeenCalled();
    });

    it('nom brut encore confondu : départagé par code si possible', async () => {
      // Repli sur le nom brut, puis départage par code du libellé brut.
      const t = (id: string, meta: string): Row => ({
        type_id: id,
        type_modele_id: '58030',
        type_name: '2.3 D Multijet',
        type_name_meta: meta,
        type_power_ps: '150',
        type_fuel: 'Diesel',
        type_display: '1',
      });
      const tables: Tables = {
        auto_type: [t('10207', '2.3 D'), t('65976', '2.3 D'), t('1', '2.3 D')],
        pieces_relation_type: [
          { rtp_pg_id: 10, rtp_type_id: 10207 },
          { rtp_pg_id: 10, rtp_type_id: 65976 },
          { rtp_pg_id: 10, rtp_type_id: 1 },
        ],
        auto_type_motor_code: [
          { tmc_type_id: '10207', tmc_code: 'F1AE3481E' },
          { tmc_type_id: '65976', tmc_code: 'F1AE3481E' },
          { tmc_type_id: '1', tmc_code: 'F1AGL411A' },
        ],
      };
      // Cas construit : type « 1 » fictif ; 10207 et 65976 partagent un code.
      const { svc, warn } = build(tables);
      expect(await svc.resolveTitle(10, 1, true)).toEqual({
        motorCode: 'F1AGL411A',
        rawNames: false,
      });
      expect(await svc.resolveTitle(10, 10207, true)).toEqual({
        motorCode: '',
        rawNames: true,
      });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('65976'));
    });

    it('casse seule différente : même libellé', async () => {
      const { svc } = build({
        ...BASE,
        auto_type: BASE.auto_type.map((t) =>
          t.type_id === '65976' ? { ...t, type_name: '2.3 D MULTIJET' } : t,
        ),
      });
      expect(await code(svc, 10, 10207)).toBe('F1AE3481E');
    });
  });

  it('erreur de lecture : levée, pas de titre dégradé', async () => {
    for (const table of [
      'auto_modele',
      'auto_type',
      'pieces_relation_type',
      'auto_type_motor_code',
    ] as const) {
      const { svc } = build(BASE, table);
      await expect(svc.resolveTitle(10, 10207)).rejects.toThrow('unavailable');
    }
  });
});
