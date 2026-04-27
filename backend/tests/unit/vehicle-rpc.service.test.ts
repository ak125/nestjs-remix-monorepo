/**
 * VehicleRpcService Unit Tests — ADR-016 Phase 2
 *
 * Tests the single-path cache-first architecture :
 *   - Redis L1 (1h TTL) devant la DB
 *   - DB cache (__vehicle_page_cache) via get_vehicle_page_data_cached RPC
 *   - Timeout unique 2000ms (couvre le rebuild on-miss)
 *   - Plus de stale fallback, plus de timeout adaptatif, plus de flag
 *
 * @see backend/src/modules/vehicles/services/vehicle-rpc.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { VehicleRpcService } from '../../src/modules/vehicles/services/vehicle-rpc.service';
import { CacheService } from '@cache/cache.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { ConfigService } from '@nestjs/config';
import { DomainNotFoundException } from '@common/exceptions';

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
    get: jest.fn((_key: string, defaultValue?: any) => defaultValue),
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
  // TEST 1: Cache key v2 (ADR-016 Phase 2)
  // ═══════════════════════════════════════════════════════════════
  it('should generate correct cache key v2 for vehicle type', () => {
    const cacheKey = service['getCacheKey'](33302);
    expect(cacheKey).toBe('vehicle:rpc:v2:33302');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Cache hit returns cached data without calling RPC
  // ═══════════════════════════════════════════════════════════════
  it('should return Redis L1 cached data on hit without calling RPC', async () => {
    const cachedData = {
      vehicle: { type_id: 33302, type_name: 'Clio III Diesel' },
      gammes: [{ pg_id: 402, pg_name: 'Plaquettes de frein' }],
      success: true,
    };

    mockCacheService.get.mockResolvedValueOnce(cachedData);

    const rpcSpy = jest.spyOn(service as any, 'callRpc');

    const result = await service.getVehiclePageDataOptimized(33302);

    expect(result.vehicle).toEqual(cachedData.vehicle);
    expect(result._cache.hit).toBe(true);
    expect(mockCacheService.get).toHaveBeenCalledWith('vehicle:rpc:v2:33302');
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Cache miss routes to get_vehicle_page_data_cached
  // ═══════════════════════════════════════════════════════════════
  it('should call get_vehicle_page_data_cached RPC on L1 miss', async () => {
    mockCacheService.get.mockResolvedValueOnce(null);

    const rpcData = {
      vehicle: { type_id: 33302, type_name: 'Clio III Diesel' },
      gammes: [],
      success: true,
    };

    const rpcSpy = jest
      .spyOn(service as any, 'callRpc')
      .mockResolvedValueOnce({ data: rpcData, error: null });

    const result = await service.getVehiclePageDataOptimized(33302);

    expect(result.vehicle).toEqual(rpcData.vehicle);
    expect(result._performance.cacheHit).toBe(false);
    expect(rpcSpy).toHaveBeenCalledWith(
      'get_vehicle_page_data_cached',
      { p_type_id: 33302 },
      { source: 'api' },
    );
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Vehicle not found throws DomainNotFoundException
  // ═══════════════════════════════════════════════════════════════
  it('should throw DomainNotFoundException when vehicle not found in RPC', async () => {
    mockCacheService.get.mockResolvedValueOnce(null);

    jest.spyOn(service as any, 'callRpc').mockResolvedValueOnce({
      data: { vehicle: null, success: false },
      error: null,
    });

    await expect(
      service.getVehiclePageDataOptimized(99999),
    ).rejects.toThrow(DomainNotFoundException);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: TTL/timeout constants match ADR-016 Phase 2 targets
  // ═══════════════════════════════════════════════════════════════
  it('should expose single-path timeout constants', () => {
    // Redis L1 TTL: 1 heure (TecDoc sync quotidien)
    expect(service['CACHE_TTL_SECONDS']).toBe(3600);
    // Timeout unique RPC: 2s (cache hit <10ms, rebuild on-miss ~4s)
    expect(service['RPC_TIMEOUT_MS']).toBe(2000);
    // Overlay R8: 500ms (SEO bonus non-bloquant)
    expect(service['R8_TIMEOUT_MS']).toBe(500);
    // Les constantes adaptatives ont été supprimées (ADR-016 Phase 2)
    expect(service['RPC_COLD_TIMEOUT_MS']).toBeUndefined();
    expect(service['STALE_TTL_SECONDS']).toBeUndefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: Redis L1 is populated after successful RPC
  // ═══════════════════════════════════════════════════════════════
  it('should persist result to Redis L1 after successful RPC', async () => {
    mockCacheService.get.mockResolvedValueOnce(null);

    const rpcData = { vehicle: { type_id: 33302 }, success: true };
    jest
      .spyOn(service as any, 'callRpc')
      .mockResolvedValueOnce({ data: rpcData, error: null });

    await service.getVehiclePageDataOptimized(33302);

    // Attente micro pour laisser la promesse non-bloquante .set() s'exécuter
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockCacheService.set).toHaveBeenCalled();
    const call = mockCacheService.set.mock.calls[0];
    expect(call[0]).toBe('vehicle:rpc:v2:33302');
    expect(call[2]).toBe(3600); // TTL 1h
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: RPC error propagates (no stale fallback anymore)
  // ═══════════════════════════════════════════════════════════════
  it('should propagate RPC error (no stale fallback in Phase 2)', async () => {
    mockCacheService.get.mockResolvedValue(null);

    jest
      .spyOn(service as any, 'callRpc')
      .mockRejectedValueOnce(new Error('DB_DOWN'));

    await expect(
      service.getVehiclePageDataOptimized(33302),
    ).rejects.toThrow('DB_DOWN');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: invalidateCache removes L1 Redis entry
  // ═══════════════════════════════════════════════════════════════
  it('should invalidate Redis L1 cache for a type_id', async () => {
    await service.invalidateCache(33302);
    expect(mockCacheService.del).toHaveBeenCalledWith('vehicle:rpc:v2:33302');
  });
});
