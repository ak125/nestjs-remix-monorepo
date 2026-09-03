// backend/src/config/cache-ttl.config.test.ts

import {
  CACHE_GENERATIONS,
  CACHE_STRATEGIES,
  getCacheKey,
} from './cache-ttl.config';

/**
 * Jeton de version + génération de cache (A3, plan massdoc 2026-09-02).
 *
 * Deux jetons, deux causes :
 *   - `keyVersion` (statique, code) : la FORME de la valeur cachée change
 *     (ex. alt v3 → v4 : payload RPC brut au lieu de la réponse construite) ;
 *   - `generation` (runtime, Redis `cache:gen:{scope}`) : la DONNÉE change
 *     (import / activation pricing) — invalidation O(1) sans KEYS.
 * Clé = `{prefix}{keyVersion}:g{generation}:{id}`.
 */
describe('cache-ttl.config — jeton de version + génération (A3)', () => {
  it('stratégie sans version ni génération : clé = prefix + id (rétro-compat)', () => {
    expect(getCacheKey(CACHE_STRATEGIES.VEHICLES.BRANDS, 'x')).toBe(
      'vehicles:brands:x',
    );
  });

  it('RM.ALTERNATIVES déclare keyVersion v4 et generation catalog', () => {
    expect(CACHE_STRATEGIES.RM.ALTERNATIVES.keyVersion).toBe('v4');
    expect(CACHE_STRATEGIES.RM.ALTERNATIVES.generation).toBe('catalog');
  });

  it('RM.PAGE_V2 déclare keyVersion v1 et generation catalog', () => {
    expect(CACHE_STRATEGIES.RM.PAGE_V2.keyVersion).toBe('v1');
    expect(CACHE_STRATEGIES.RM.PAGE_V2.generation).toBe('catalog');
  });

  it('la clé porte version puis génération puis id : alt:v4:g7:11836:3859', () => {
    expect(getCacheKey(CACHE_STRATEGIES.RM.ALTERNATIVES, '11836:3859', 7)).toBe(
      'alt:v4:g7:11836:3859',
    );
  });

  it('deux générations produisent deux clés distinctes (invalidation O(1))', () => {
    const g7 = getCacheKey(CACHE_STRATEGIES.RM.PAGE_V2, '402:100413', 7);
    const g8 = getCacheKey(CACHE_STRATEGIES.RM.PAGE_V2, '402:100413', 8);
    expect(g7).toBe('rm:page-v2:v1:g7:402:100413');
    expect(g8).toBe('rm:page-v2:v1:g8:402:100413');
  });

  it('CACHE_GENERATIONS.catalog désigne la clé Redis cache:gen:catalog', () => {
    expect(CACHE_GENERATIONS.catalog.key).toBe('cache:gen:catalog');
  });
});
