// backend/src/modules/admin/services/r1-keyword-plan-batch.service.test.ts

// SupabaseBaseService vérifie les env vars dans son constructor — stub minimal
// (canon, cf. rm-alternatives.service.test.ts).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { R1KeywordPlanBatchService } from './r1-keyword-plan-batch.service';
import { CACHE_STRATEGIES } from '../../../config/cache-ttl.config';

/**
 * Contrat de `getTopVehicles(pgId)` (A4, plan massdoc 2026-09-02).
 *
 * Avant : `this.client.rpc('get_alternative_vehicles_for_gamme' as never,
 * {...} as never)` — le double cast défait le typage ET le parseur d'allowlist
 * (`scripts/ci/check-rpc-allowlist-coverage.sh` ne voit que `callRpc(...)`),
 * et le fichier est dans la liste de contournement du RPC-gate (ci.yml), d'où
 * l'invisibilité. Un appel séquentiel par gamme, jusqu'à 200 par requête
 * `POST /api/admin/keyword-planner/batch-r1`, sans aucun cache — alors que le
 * résultat ne dépend que de `pgId` (compatibilité TecDoc, stable entre imports).
 *
 * Après : `callRpc()` gouverné (nom littéral, `source: 'admin'`), résultat mis
 * en cache sous `CACHE_STRATEGIES.KEYWORD_PLAN.R1_TOP_VEHICLES` (clé = pgId
 * seul), erreur RPC observable (warn) et JAMAIS mise en cache.
 */

type TopVehicle = { marque_name: string; modele_name: string; cnt: number };

const STRATEGY = CACHE_STRATEGIES.KEYWORD_PLAN.R1_TOP_VEHICLES;

// Constructeur typé lâchement : le test décrit le contrat cible (4e dépendance
// CacheService) sans dépendre de la signature courante.
const ServiceCtor = R1KeywordPlanBatchService as unknown as new (
  ...args: unknown[]
) => R1KeywordPlanBatchService;

function buildService() {
  const configService = { get: (k: string) => process.env[k] };
  const yamlParser = {};
  const gatesService = {};
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ServiceCtor(
    configService,
    yamlParser,
    gatesService,
    cache,
  );
  const callRpc = jest.fn();
  (service as unknown as { callRpc: jest.Mock }).callRpc = callRpc;
  const getTopVehicles = (pgId: number): Promise<TopVehicle[]> =>
    (
      service as unknown as {
        getTopVehicles: (id: number) => Promise<TopVehicle[]>;
      }
    ).getTopVehicles(pgId);
  return { service, cache, callRpc, getTopVehicles };
}

const rpcRows = [
  {
    type_id: '11836',
    type_name: '530 d',
    type_alias: '530-d',
    modele_name: 'Série 5 (E60)',
    modele_alias: 'serie-5-e60',
    modele_id: 33053,
    marque_name: 'BMW',
    marque_alias: 'bmw',
    marque_id: 33,
  },
  {
    type_id: '57414',
    type_name: '1.9 TDI',
    type_alias: '1-9-tdi',
    modele_name: 'Golf V',
    modele_alias: 'golf-v',
    modele_id: 1201,
    marque_name: 'Volkswagen',
    marque_alias: 'volkswagen',
    marque_id: 120,
  },
];

describe('R1KeywordPlanBatchService.getTopVehicles — RPC gouvernée + cache (A4)', () => {
  it('cache miss → un seul callRpc gouverné (nom littéral, params nommés, source admin), mappé en TopVehicle', async () => {
    const { callRpc, getTopVehicles } = buildService();
    callRpc.mockResolvedValue({ data: rpcRows, error: null });

    const result = await getTopVehicles(402);

    expect(callRpc).toHaveBeenCalledTimes(1);
    expect(callRpc).toHaveBeenCalledWith(
      'get_alternative_vehicles_for_gamme',
      { p_gamme_id: 402, p_exclude_type_id: 0, p_limit: 6 },
      { source: 'admin' },
    );
    expect(result).toEqual([
      { marque_name: 'BMW', modele_name: 'Série 5 (E60)', cnt: 1 },
      { marque_name: 'Volkswagen', modele_name: 'Golf V', cnt: 1 },
    ]);
  });

  it('cache miss → écrit le résultat mappé sous la clé pgId seul, avec le TTL déclaré dans CACHE_STRATEGIES', async () => {
    const { cache, callRpc, getTopVehicles } = buildService();
    callRpc.mockResolvedValue({ data: rpcRows, error: null });

    const result = await getTopVehicles(402);

    expect(cache.get).toHaveBeenCalledWith('r1kp:top-vehicles:402');
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(
      'r1kp:top-vehicles:402',
      result,
      STRATEGY.ttl,
    );
    // La donnée dérive de la compatibilité TecDoc : stable entre imports.
    expect(STRATEGY.ttl).toBe(86400);
  });

  it('cache hit → aucun appel RPC, résultat rejoué depuis le cache', async () => {
    const { cache, callRpc, getTopVehicles } = buildService();
    const cached: TopVehicle[] = [
      { marque_name: 'Peugeot', modele_name: '308', cnt: 1 },
    ];
    cache.get.mockResolvedValue(cached);

    const result = await getTopVehicles(7);

    expect(callRpc).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(result).toEqual(cached);
  });

  it('erreur RPC → [] observable (warn), et RIEN n’est mis en cache (anti-poisoning)', async () => {
    const { service, cache, callRpc, getTopVehicles } = buildService();
    callRpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied', name: 'SupabaseRpcError' },
    });
    const warnSpy = jest
      .spyOn(
        (service as unknown as { logger: { warn: (m: string) => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => {});

    const result = await getTopVehicles(402);

    expect(result).toEqual([]);
    expect(cache.set).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/permission denied/);
  });

  it('résultat vide (RPC ok, 0 ligne) → [] mis en cache : c’est un état réel, pas une erreur', async () => {
    const { cache, callRpc, getTopVehicles } = buildService();
    callRpc.mockResolvedValue({ data: [], error: null });

    const result = await getTopVehicles(9999);

    expect(result).toEqual([]);
    expect(cache.set).toHaveBeenCalledWith(
      'r1kp:top-vehicles:9999',
      [],
      STRATEGY.ttl,
    );
  });
});
