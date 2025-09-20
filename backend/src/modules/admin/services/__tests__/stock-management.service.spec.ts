/**
 * 🧪 Test simple StockManagementService
 * Vérification que le service s'initialise correctement
 */

import { Test, TestingModule } from '@nestjs/testing';
import { StockManagementService } from '../stock-management.service';
import { CacheService } from '../../../../cache/cache.service';

// Mock du CacheService
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

// Mock de SupabaseBaseService
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({
          limit: jest.fn(),
        })),
      })),
      lte: jest.fn(() => ({
        order: jest.fn(),
      })),
      order: jest.fn(),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  })),
};

describe('StockManagementService', () => {
  let service: StockManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockManagementService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<StockManagementService>(StockManagementService);

    // Mock du client Supabase
    (service as any).client = mockSupabaseClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with logger', () => {
    expect((service as any).logger).toBeDefined();
    expect((service as any).cacheService).toBeDefined();
  });

  describe('getStockDashboard', () => {
    it('should return dashboard structure', async () => {
      // Mock de retour Supabase
      mockSupabaseClient.from().select().order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.getStockDashboard();

      expect(result).toEqual({
        success: true,
        data: {
          items: [],
          stats: {
            totalProducts: 0,
            outOfStock: 0,
            lowStock: 0,
            overstock: 0,
            avgStockLevel: 0,
          },
          totalItems: 0,
        },
        message: 'Dashboard stock récupéré avec succès',
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock d'erreur Supabase
      mockSupabaseClient
        .from()
        .select()
        .order.mockResolvedValue({
          data: null,
          error: { message: 'Test error' },
        });

      const result = await service.getStockDashboard();

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('message');
      expect((result as any).message).toContain('Erreur');
    });
  });

  describe('reserveStock', () => {
    it('should handle insufficient stock', async () => {
      // Mock stock insuffisant
      mockSupabaseClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValue({
          data: { available: 5, reserved: 0 },
          error: null,
        });

      const result = await service.reserveStock('test-id', 10, 'order-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Stock insuffisant');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
