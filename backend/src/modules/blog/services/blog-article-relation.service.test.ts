import { BlogArticleRelationService } from './blog-article-relation.service';

/**
 * Unit coverage for the cache-aside + single-flight layer added on top of
 * getCompatibleVehicles(). The heavy 5-7-query fan-out (computeCompatibleVehicles)
 * is spied/stubbed so these tests assert ONLY the caching contract:
 *   - miss → compute once → set with the right TTL
 *   - hit → no recompute
 *   - empty result → short negative-cache TTL
 *   - single-flight → N concurrent cold-key callers share ONE compute
 *   - best-effort set → a Redis write error never bubbles into the response
 *   - key scoping → pg_id + limit + pg_alias each segment the cache
 */

/** Stateful in-memory CacheService double (get/set backed by a Map). */
function makeCache(overrides: Partial<{ failSet: boolean }> = {}) {
  const store = new Map<string, unknown>();
  const get = jest.fn(async (key: string) =>
    store.has(key) ? store.get(key) : null,
  );
  const set = jest.fn(async (key: string, val: unknown, _ttl?: number) => {
    if (overrides.failSet) {
      throw new Error('redis down');
    }
    store.set(key, val);
  });
  return { store, cache: { get, set } as any, get, set };
}

function makeService(cache: any) {
  // supabase/transform deps are never reached: compute() is spied per-test.
  return new BlogArticleRelationService({} as any, {} as any, cache);
}

const VEHICLES = [{ type_id: 1 }, { type_id: 2 }];

describe('BlogArticleRelationService — getCompatibleVehicles cache layer', () => {
  it('cache miss → computes once and stores with the 1h TTL (non-empty)', async () => {
    const { cache, get, set } = makeCache();
    const service = makeService(cache);
    const compute = jest
      .spyOn(service as any, 'computeCompatibleVehicles')
      .mockResolvedValue(VEHICLES);

    const result = await service.getCompatibleVehicles(42, 1000, 'filtre');

    expect(result).toEqual(VEHICLES);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    const [key, value, ttl] = set.mock.calls[0];
    expect(key).toBe('blog:compat-vehicles:v1:pg=42:lim=1000:alias=filtre');
    expect(value).toEqual(VEHICLES);
    expect(ttl).toBe(60 * 60);
  });

  it('cache hit → returns cached value WITHOUT recomputing', async () => {
    const { cache, set } = makeCache();
    const service = makeService(cache);
    const compute = jest
      .spyOn(service as any, 'computeCompatibleVehicles')
      .mockResolvedValue(VEHICLES);

    const first = await service.getCompatibleVehicles(42, 1000, 'filtre');
    const second = await service.getCompatibleVehicles(42, 1000, 'filtre');

    expect(first).toEqual(VEHICLES);
    expect(second).toEqual(VEHICLES);
    expect(compute).toHaveBeenCalledTimes(1); // 2nd call served from cache
    expect(set).toHaveBeenCalledTimes(1); // only the miss writes
  });

  it('empty result → negative-cached with the short 5min TTL', async () => {
    const { cache, set } = makeCache();
    const service = makeService(cache);
    jest
      .spyOn(service as any, 'computeCompatibleVehicles')
      .mockResolvedValue([]);

    const result = await service.getCompatibleVehicles(99, 1000, '');

    expect(result).toEqual([]);
    const [, value, ttl] = set.mock.calls[0];
    expect(value).toEqual([]);
    expect(ttl).toBe(5 * 60);
  });

  it('single-flight → concurrent cold-key callers share ONE compute', async () => {
    const { cache } = makeCache();
    const service = makeService(cache);
    let resolveCompute: (v: unknown[]) => void = () => {};
    const compute = jest
      .spyOn(service as any, 'computeCompatibleVehicles')
      .mockImplementation(
        () => new Promise((res) => (resolveCompute = res as any)),
      );

    const p1 = service.getCompatibleVehicles(7, 1000, 'frein');
    const p2 = service.getCompatibleVehicles(7, 1000, 'frein');
    const p3 = service.getCompatibleVehicles(7, 1000, 'frein');
    // let both reach the inflight check before compute resolves
    await Promise.resolve();
    resolveCompute(VEHICLES);
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(VEHICLES);
    expect(r2).toEqual(VEHICLES);
    expect(r3).toEqual(VEHICLES);
  });

  it('inflight slot is released → a later call recomputes on cold cache', async () => {
    const { cache, get } = makeCache();
    // simulate a non-persisting cache (get always misses) to prove the
    // inflight Map does not pin a stale promise after completion
    get.mockResolvedValue(null);
    const service = makeService(cache);
    const compute = jest
      .spyOn(service as any, 'computeCompatibleVehicles')
      .mockResolvedValue(VEHICLES);

    await service.getCompatibleVehicles(7, 1000, 'frein');
    await service.getCompatibleVehicles(7, 1000, 'frein');

    expect(compute).toHaveBeenCalledTimes(2); // slot freed between calls
  });

  it('best-effort set → a Redis write error never bubbles into the response', async () => {
    const { cache } = makeCache({ failSet: true });
    const service = makeService(cache);
    jest
      .spyOn(service as any, 'computeCompatibleVehicles')
      .mockResolvedValue(VEHICLES);

    await expect(
      service.getCompatibleVehicles(42, 1000, 'filtre'),
    ).resolves.toEqual(VEHICLES);
  });

  it('cache key is segmented by pg_id + limit + pg_alias', async () => {
    const { cache, set } = makeCache();
    const service = makeService(cache);
    jest
      .spyOn(service as any, 'computeCompatibleVehicles')
      .mockResolvedValue(VEHICLES);

    await service.getCompatibleVehicles(1, 1000, 'a'); // by-gamme caller
    await service.getCompatibleVehicles(1, 24, 'b'); // r3-guide caller

    const keys = set.mock.calls.map((c) => c[0]);
    expect(keys).toContain('blog:compat-vehicles:v1:pg=1:lim=1000:alias=a');
    expect(keys).toContain('blog:compat-vehicles:v1:pg=1:lim=24:alias=b');
  });
});
