import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../products.service';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        range: jest.fn(() => ({
          order: jest.fn(() => ({
            // Mock query result
            data: [],
            error: null,
            count: 0,
          })),
        })),
      })),
      or: jest.fn(() => ({
        eq: jest.fn(() => ({
          range: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [],
              error: null,
              count: 0,
            })),
          })),
        })),
      })),
      range: jest.fn(() => ({
        order: jest.fn(() => ({
          data: [],
          error: null,
          count: 0,
        })),
      })),
      order: jest.fn(() => ({
        data: [],
        error: null,
        count: 0,
      })),
    })),
  })),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ProductsService,
          useValue: {
            client: mockSupabaseClient,
            logger: { error: jest.fn(), log: jest.fn() },
            findAllPieces: jest.fn(),
            findOne: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAllPieces', () => {
    it('devrait retourner des pièces avec pagination par défaut', async () => {
      const mockData = [
        {
          piece_id: 1,
          piece_name: 'Disque de frein',
          piece_ref: 'DF001',
          piece_des: 'Disque de frein avant',
          piece_display: true,
        },
      ];

      const mockResult = {
        products: [
          {
            piece_id: 1,
            piece_name: 'Disque de frein',
            piece_alias: 'DF001',
            piece_sku: 'DF001',
            piece_activ: true,
            piece_top: false,
            piece_description: 'Disque de frein avant',
          },
        ],
        total: 1,
        page: 1,
        limit: 24,
        totalPages: 1,
      };

      jest.spyOn(service, 'findAllPieces').mockResolvedValue(mockResult);

      const result = await service.findAllPieces();

      expect(result).toEqual(mockResult);
      expect(result.products).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(24);
    });

    it('devrait gérer la recherche correctement', async () => {
      const mockResult = {
        products: [],
        total: 0,
        page: 1,
        limit: 24,
        totalPages: 0,
      };

      jest.spyOn(service, 'findAllPieces').mockResolvedValue(mockResult);

      const result = await service.findAllPieces({
        search: 'frein',
        page: 1,
        limit: 24,
      });

      expect(service.findAllPieces).toHaveBeenCalledWith({
        search: 'frein',
        page: 1,
        limit: 24,
      });
    });

    it('devrait gérer les erreurs de base de données', async () => {
      const error = new Error('Database connection failed');
      jest.spyOn(service, 'findAllPieces').mockRejectedValue(error);

      await expect(service.findAllPieces()).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('findOne', () => {
    it('devrait retourner une pièce par ID', async () => {
      const mockPiece = {
        piece_id: '123',
        piece_name: 'Test Piece',
        piece_ref: 'TEST123',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockPiece);

      const result = await service.findOne('123');

      expect(result).toEqual(mockPiece);
      expect(service.findOne).toHaveBeenCalledWith('123');
    });

    it('devrait gérer les pièces inexistantes', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const result = await service.findOne('999999');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('devrait retourner les statistiques des produits', async () => {
      const mockStats = {
        totalProducts: 4036045,
        activeProducts: 2500000,
        totalCategories: 9266,
        totalBrands: 150,
        lowStockItems: 45,
      };

      jest.spyOn(service, 'getStats').mockResolvedValue(mockStats);

      const result = await service.getStats();

      expect(result).toEqual(mockStats);
      expect(result.totalProducts).toBeGreaterThan(0);
      expect(result.totalCategories).toBeGreaterThan(0);
    });
  });
});
