// backend/src/modules/admin/services/r1-keyword-plan-gates.service.test.ts

// SupabaseBaseService vérifie les env vars dans son constructor — stub minimal
// (canon, cf. rm-alternatives.service.test.ts).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import {
  R1KeywordPlanGatesService,
  type RkpRow,
} from './r1-keyword-plan-gates.service';

/**
 * Contrat « une panne n'est jamais un verdict » des gates R1.
 *
 * Avant : RG7 lisait le plan R3 avec `.single()` sans regarder l'erreur — panne,
 * ou plusieurs plans R3 validés pour la gamme, donnaient un risque de 0 et un
 * « pass ». RG5 enveloppait ses lectures dans un `catch` qui rendait « pass ».
 */
type DbResult = { data: unknown; error: { message: string } | null };

function chain(result: DbResult) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const method of ['select', 'eq']) {
    builder[method] = jest.fn(self);
  }
  builder.upsert = jest.fn(() => Promise.resolve(result));
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.then = (
    onFulfilled: (value: DbResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

const FAILURE: DbResult = {
  data: null,
  error: { message: 'upstream unavailable' },
};
const NO_ROW: DbResult = { data: null, error: null };

const r3Plan = (...terms: string[]) => ({
  skp_section_terms: { S1: { include_terms: terms } },
});

const ROW: RkpRow = {
  rkp_pg_id: 7,
  rkp_pg_alias: 'filtre-a-huile',
  rkp_section_terms: {
    R1_S0_SERP: { include_terms: ['filtre a huile', 'acheter filtre a huile'] },
  },
};

const DB_OK: Record<string, DbResult> = {
  __seo_r3_keyword_plan: { data: [], error: null },
  __seo_gamme_purchase_guide: NO_ROW,
  __seo_gamme_conseil: NO_ROW,
};

function buildGates(overrides: Partial<Record<string, DbResult>> = {}) {
  const tables = { ...DB_OK, ...overrides };
  const GatesCtor = R1KeywordPlanGatesService as unknown as new (
    ...args: unknown[]
  ) => R1KeywordPlanGatesService;
  const gates = new GatesCtor({ get: (k: string) => process.env[k] });
  Object.defineProperty(gates, 'client', {
    value: { from: (table: string) => chain(tables[table] as DbResult) },
  });
  const logger = (gates as unknown as { logger: Record<string, jest.Mock> })
    .logger;
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  return gates;
}

describe('R1KeywordPlanGatesService.upsertR1KeywordPlan', () => {
  it('propage l’échec d’écriture au lieu de le journaliser seulement', async () => {
    const gates = buildGates({ __seo_r1_keyword_plan: FAILURE });

    await expect(gates.upsertR1KeywordPlan('7', {})).rejects.toThrow(/plan R1/);
  });
});

describe('R1KeywordPlanGatesService.computeR3RiskScore (RG7)', () => {
  it('aucun plan R3 validé → risque 0, état réel', async () => {
    const gates = buildGates();

    await expect(gates.computeR3RiskScore(ROW)).resolves.toBe(0);
  });

  it('plans R3 illisibles → erreur, jamais un risque 0', async () => {
    const gates = buildGates({ __seo_r3_keyword_plan: FAILURE });

    await expect(gates.computeR3RiskScore(ROW)).rejects.toThrow(/plans R3/);
  });

  it('plusieurs plans R3 validés → le recouvrement le plus élevé est retenu', async () => {
    const gates = buildGates({
      __seo_r3_keyword_plan: {
        data: [
          r3Plan('vidange', 'colmatage'),
          r3Plan('filtre a huile', 'acheter filtre a huile'),
        ],
        error: null,
      },
    });

    await expect(gates.computeR3RiskScore(ROW)).resolves.toBe(1);
  });
});

describe('R1KeywordPlanGatesService.runR1Gates — RG5 FAQ', () => {
  const FAQ: DbResult = {
    data: { sgpg_faq: [{ question: 'Quel filtre à huile choisir ?' }] },
    error: null,
  };

  it('aucune FAQ R1 → pass', async () => {
    const gates = buildGates();

    const { gateReport } = await gates.runR1Gates(ROW);

    expect(gateReport.RG5_FAQ_DEDUP.status).toBe('pass');
  });

  it('FAQ R1 illisible → erreur, jamais « pass »', async () => {
    const gates = buildGates({ __seo_gamme_purchase_guide: FAILURE });

    await expect(gates.runR1Gates(ROW)).rejects.toThrow(/FAQ R1/);
  });

  it('FAQ R3 illisible → erreur, jamais « pass »', async () => {
    const gates = buildGates({
      __seo_gamme_purchase_guide: FAQ,
      __seo_gamme_conseil: FAILURE,
    });

    await expect(gates.runR1Gates(ROW)).rejects.toThrow(/FAQ R3/);
  });
});
