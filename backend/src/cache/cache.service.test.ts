// backend/src/cache/cache.service.test.ts

import { CacheService } from './cache.service';

/**
 * Génération de cache (A3, plan massdoc 2026-09-02).
 *
 * Levier d'invalidation gouverné, O(1) : un entier Redis par périmètre
 * (`cache:gen:catalog`), lu par les consommateurs pour composer leurs clés et
 * incrémenté (INCR atomique, sans expiration) depuis le chemin d'activation
 * pricing. Un bump rend toutes les entrées de la génération précédente
 * inatteignables ; elles expirent par leur TTL. NO-GO `clearByPattern()`
 * (Redis KEYS, O(N) bloquant).
 *
 * Redis indisponible : jamais silencieux — génération 0 + warn en lecture,
 * -1 + error au bump (le chemin d'activation ne doit pas échouer pour un
 * cache dérivé, mais l'absence de bump doit être visible).
 */

type RedisMock = { get: jest.Mock; incr: jest.Mock };

function build(ready = true) {
  const service = new CacheService();
  const redis: RedisMock = { get: jest.fn(), incr: jest.fn() };
  (service as unknown as { redisClient: unknown }).redisClient = redis;
  (service as unknown as { redisReady: boolean }).redisReady = ready;
  const gen = {
    getGeneration: (scope: 'catalog') => service.getGeneration(scope),
    bumpGeneration: (scope: 'catalog', reason: string) =>
      service.bumpGeneration(scope, reason),
  };
  const logger = (
    service as unknown as {
      logger: {
        log: (m: string) => void;
        warn: (m: string) => void;
        error: (m: string) => void;
      };
    }
  ).logger;
  return { service, redis, gen, logger };
}

describe('CacheService — génération de cache par périmètre (A3)', () => {
  it('getGeneration lit cache:gen:catalog et renvoie l’entier stocké', async () => {
    const { redis, gen } = build();
    redis.get.mockResolvedValue('12');

    await expect(gen.getGeneration('catalog')).resolves.toBe(12);
    expect(redis.get).toHaveBeenCalledWith('cache:gen:catalog');
  });

  it('getGeneration → 0 quand la clé est absente (première génération)', async () => {
    const { redis, gen } = build();
    redis.get.mockResolvedValue(null);

    await expect(gen.getGeneration('catalog')).resolves.toBe(0);
  });

  it('getGeneration → 0 + warn quand Redis est indisponible (jamais silencieux)', async () => {
    const { redis, gen, logger } = build(false);
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await expect(gen.getGeneration('catalog')).resolves.toBe(0);
    expect(redis.get).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('bumpGeneration incrémente atomiquement (INCR, sans expiration) et journalise périmètre, génération, raison', async () => {
    const { redis, gen, logger } = build();
    redis.incr.mockResolvedValue(13);
    const log = jest.spyOn(logger, 'log').mockImplementation(() => {});

    await expect(
      gen.bumpGeneration('catalog', 'pricing_activate:b42'),
    ).resolves.toBe(13);
    expect(redis.incr).toHaveBeenCalledWith('cache:gen:catalog');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/scope=catalog/);
    expect(log.mock.calls[0][0]).toMatch(/generation=13/);
    expect(log.mock.calls[0][0]).toMatch(/reason=pricing_activate:b42/);
  });

  it('bumpGeneration → -1 + error quand Redis est indisponible (le bump manqué est visible)', async () => {
    const { redis, gen, logger } = build(false);
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(gen.bumpGeneration('catalog', 'x')).resolves.toBe(-1);
    expect(redis.incr).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
