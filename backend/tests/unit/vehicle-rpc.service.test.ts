/**
 * VehicleRpcService Unit Tests
 *
 * Tests the cache-first + stale-while-revalidate pattern
 * for vehicle page data optimized RPC calls.
 *
 * 8 tests: cache hit, cache miss, stale fallback, timeout, not found, cache keys, TTL, error handling
 *
 * @see backend/src/modules/vehicles/services/vehicle-rpc.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { VehicleRpcService } from '../../src/modules/vehicles/services/vehicle-rpc.service';
import { CacheService } from '../../src/cache/cache.service';
import { RpcGateService } from '../../src/security/rpc-gate/rpc-gate.service';
import { ConfigService } from '@nestjs/config';
import { DomainNotFoundException } from '../../src/common/exceptions';

describe('VehicleRpcService', () => {
  let service: VehicleRpcService;

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const mockRpcGate = {
    check: jest.fn().mockReturnValue({ allowed: true }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => defaultValue),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleRpcService,
        { provide: CacheService, useValue: mockCacheService },
        { provide: RpcGateService, useValue: mockRpcGate },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<VehicleRpcService>(VehicleRpcService);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Cache key generation
  // ═══════════════════════════════════════════════════════════════
  it('should generate correct cache keys for vehicle type', () => {
    // Access private methods via bracket notation
    const cacheKey = service['getCacheKey'](33302);
    const staleKey = service['getStaleCacheKey'](33302);

    expect(cacheKey).toBe('vehicle:rpc:v1:33302');
    expect(staleKey).toBe('vehicle:rpc:v1:stale:33302');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Cache hit returns cached data immediately
  // ═══════════════════════════════════════════════════════════════
  it('should return cached data on cache hit without calling RPC', async () => {
    const cachedData = {
      vehicle: { type_id: 33302, type_name: 'Clio III Diesel' },
      gammes: [{ pg_id: 402, pg_name: 'Plaquettes de frein' }],
      success: true,
    };

    mockCacheService.get.mockResolvedValueOnce(cachedData);

    const result = await service.getVehiclePageDataOptimized(33302);

    expect(result.vehicle).toEqual(cachedData.vehicle);
    expect(result._cache.hit).toBe(true);
    expect(mockCacheService.get).toHaveBeenCalledWith('vehicle:rpc:v1:33302');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Cache miss triggers RPC call
  // ═══════════════════════════════════════════════════════════════
  it('should call RPC when cache misses', async () => {
    // Cache miss
    mockCacheService.get.mockResolvedValueOnce(null);

    // Mock the Supabase RPC call via the service's internal method
    const rpcData = {
      vehicle: { type_id: 33302, type_name: 'Clio III Diesel' },
      gammes: [],
      success: true,
    };

    // Mock callRpc (inherited from SupabaseBaseService)
    jest.spyOn(service as any, 'callRpc').mockResolvedValueOnce({
      data: rpcData,
      error: null,
    });

    const result = await service.getVehiclePageDataOptimized(33302);

    expect(result.vehicle).toEqual(rpcData.vehicle);
    expect(result._performance.cacheHit).toBe(false);
    // Cache should be set after RPC success
    expect(mockCacheService.set).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Stale cache fallback on RPC error
  // ═══════════════════════════════════════════════════════════════
  it('should fall back to stale cache when RPC fails', async () => {
    // Cache miss
    mockCacheService.get
      .mockResolvedValueOnce(null) // Fresh cache miss
      .mockResolvedValueOnce({
        // Stale cache hit
        vehicle: { type_id: 33302, type_name: 'Clio III Diesel (stale)' },
        success: true,
      });

    // RPC fails
    jest
      .spyOn(service as any, 'callRpc')
      .mockRejectedValueOnce(new Error('DB_TIMEOUT'));

    const result = await service.getVehiclePageDataOptimized(33302);

    // Should return stale data
    expect(result.vehicle.type_name).toContain('stale');
    // Should have checked stale cache key
    expect(mockCacheService.get).toHaveBeenCalledWith(
      'vehicle:rpc:v1:stale:33302',
    );
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Vehicle not found throws DomainNotFoundException
  // ═══════════════════════════════════════════════════════════════
  it('should throw DomainNotFoundException when vehicle not found in RPC', async () => {
    // Cache miss
    mockCacheService.get.mockResolvedValueOnce(null);

    // RPC returns empty/null vehicle
    jest.spyOn(service as any, 'callRpc').mockResolvedValueOnce({
      data: { vehicle: null, success: false },
      error: null,
    });

    await expect(
      service.getVehiclePageDataOptimized(99999),
    ).rejects.toThrow(DomainNotFoundException);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: TTL constants are reasonable
  // ═══════════════════════════════════════════════════════════════
  it('should have reasonable TTL constants', () => {
    // Fresh cache: 1 hour
    expect(service['CACHE_TTL_SECONDS']).toBe(3600);
    // Stale cache: 24 hours
    expect(service['STALE_TTL_SECONDS']).toBe(86400);
    // RPC timeout: 1.5 seconds
    expect(service['RPC_TIMEOUT_MS']).toBe(1500);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: Double cache strategy (fresh + stale)
  // ═══════════════════════════════════════════════════════════════
  it('should store both fresh and stale cache after successful RPC', async () => {
    mockCacheService.get.mockResolvedValueOnce(null);

    const rpcData = {
      vehicle: { type_id: 33302 },
      success: true,
    };

    jest.spyOn(service as any, 'callRpc').mockResolvedValueOnce({
      data: rpcData,
      error: null,
    });

    await service.getVehiclePageDataOptimized(33302);

    // Wait for async cache operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should have set both fresh and stale cache
    const setCalls = mockCacheService.set.mock.calls;
    const freshCall = setCalls.find(
      (c: any[]) => c[0] === 'vehicle:rpc:v1:33302',
    );
    const staleCall = setCalls.find(
      (c: any[]) => c[0] === 'vehicle:rpc:v1:stale:33302',
    );

    expect(freshCall).toBeTruthy();
    expect(staleCall).toBeTruthy();
    // Fresh TTL = 1h, Stale TTL = 24h
    if (freshCall) expect(freshCall[2]).toBe(3600);
    if (staleCall) expect(staleCall[2]).toBe(86400);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: No stale cache = throw error
  // ═══════════════════════════════════════════════════════════════
  it('should throw when RPC fails and no stale cache exists', async () => {
    // No fresh cache, no stale cache
    mockCacheService.get.mockResolvedValue(null);

    // RPC fails
    jest
      .spyOn(service as any, 'callRpc')
      .mockRejectedValueOnce(new Error('DB_DOWN'));

    await expect(
      service.getVehiclePageDataOptimized(33302),
    ).rejects.toThrow();
  });
});
