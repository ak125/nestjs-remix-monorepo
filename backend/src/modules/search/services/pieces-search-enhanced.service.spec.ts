import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PiecesSearchEnhancedService } from './pieces-search-enhanced.service';
import { CacheService } from '@/shared/cache/cache.service';
import { SearchAnalyticsService } from './search-analytics.service';

describe('PiecesSearchEnhancedService', () => {
  let service: PiecesSearchEnhancedService;
  let cacheService: jest.Mocked<CacheService>;
  let analyticsService: jest.Mocked<SearchAnalyticsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PiecesSearchEnhancedService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                SUPABASE_URL: 'https://test.supabase.co',
                SUPABASE_ANON_KEY: 'test-key',
                FRONTEND_URL: 'https://test.com',
              };
              return config[key];
            }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            getStats: jest.fn().mockResolvedValue({ hitRate: 85 }),
          },
        },
        {
          provide: SearchAnalyticsService,
          useValue: {
            recordSearch: jest.fn(),
            recordError: jest.fn(),
            getUserPreferences: jest.fn(),
            getSearchStats: jest.fn().mockResolvedValue({
              trends: [],
              errorRate: 0.01,
            }),
            enrichSearchContext: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PiecesSearchEnhancedService>(PiecesSearchEnhancedService);
    cacheService = module.get(CacheService);
    analyticsService = module.get(SearchAnalyticsService);
  });

  describe('searchPieces', () => {
    it('should perform basic search successfully', async () => {
      // Mock Supabase response
      const mockSupabaseData = [
        {
          piece_id: 1,
          piece_ref: 'ABC123',
          piece_name: 'Filtre à huile',
          piece_name_side: '',
          piece_name_comp: '',
          piece_qty_sale: 10,
          piece_display: true,
          pieces_gamme: {
            pg_id: 1,
            pg_name: 'Filtration',
            pg_alias: 'filtration',
          },
          pieces_marque: {
            pm_id: 1,
            pm_name: 'MANN-FILTER',
            pm_alias: 'mann-filter',
            pm_logo: 'mann.jpg',
            pm_oes: 'A',
            pm_nb_stars: 5,
          },
          pieces_price: [
            {
              pri_vente_ttc: 15.99,
              pri_consigne_ttc: 0,
              pri_dispo: true,
            },
          ],
          pieces_media_img: [
            {
              pmi_folder: 'filters',
              pmi_name: 'abc123',
            },
          ],
          pieces_criteria: [
            {
              pc_cri_value: '75mm',
              pieces_criteria_link: {
                pcl_cri_criteria: 'Diamètre',
                pcl_cri_unit: 'mm',
              },
            },
          ],
        },
      ];

      // Mock Supabase RPC call
      jest.spyOn(service as any, 'supabase', 'get').mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: mockSupabaseData,
          error: null,
        }),
      });

      cacheService.get.mockResolvedValue(null); // Cache miss

      const result = await service.searchPieces({
        searchTerm: 'filtre huile',
        pagination: { page: 1, limit: 20 },
      });

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].pieceRef).toBe('ABC123');
      expect(result.results[0].pieceName).toBe('Filtre à huile');
      expect(result.results[0].manufacturer.name).toBe('MANN-FILTER');
      expect(result.results[0].price.ttc).toBe(159.9); // 15.99 * 10
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.searchId).toBeDefined();
    });

    it('should return cached results when available', async () => {
      const cachedResult = {
        results: [],
        filters: {
          gammes: [],
          qualities: [],
          stars: [],
          manufacturers: [],
          priceRanges: [],
          availability: [],
        },
        count: 0,
        totalCount: 0,
        page: 1,
        limit: 20,
        executionTime: 50,
      };

      cacheService.get.mockResolvedValue(cachedResult);

      const result = await service.searchPieces({
        searchTerm: 'test',
      });

      expect(result.fromCache).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(cacheService.get).toHaveBeenCalled();
    });

    it('should handle search with filters', async () => {
      jest.spyOn(service as any, 'supabase', 'get').mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      cacheService.get.mockResolvedValue(null);

      const result = await service.searchPieces({
        searchTerm: 'filtre',
        filters: {
          manufacturers: ['mann-filter'],
          minPrice: 10,
          maxPrice: 50,
          availability: ['available'],
        },
        sort: {
          field: 'price',
          order: 'asc',
        },
      });

      expect(result).toBeDefined();
      expect(result.results).toEqual([]);
    });
  });

  describe('autocomplete', () => {
    it('should return autocomplete suggestions', async () => {
      const suggestions = [
        { suggestion: 'filtre à huile', type: 'reference', score: 10 },
        { suggestion: 'MANN-FILTER', type: 'brand', score: 8 },
      ];

      jest.spyOn(service as any, 'getReferenceSuggestions').mockResolvedValue([
        { suggestion: 'filtre à huile', type: 'reference', score: 10 },
      ]);
      jest.spyOn(service as any, 'getBrandSuggestions').mockResolvedValue([
        { suggestion: 'MANN-FILTER', type: 'brand', score: 8 },
      ]);
      jest.spyOn(service as any, 'getCategorySuggestions').mockResolvedValue([]);
      jest.spyOn(service as any, 'getPopularSuggestions').mockResolvedValue([]);

      cacheService.get.mockResolvedValue(null);

      const result = await service.autocomplete('fil', { limit: 5 });

      expect(result).toEqual(suggestions);
    });

    it('should return empty array for short terms', async () => {
      const result = await service.autocomplete('f');
      expect(result).toEqual([]);
    });
  });

  describe('searchByOEM', () => {
    it('should search by OEM codes', async () => {
      const mockOEMData = [
        {
          piece_id: 1,
          piece_ref: 'OEM123',
          piece_name: 'Pièce OEM',
          // ... autres propriétés
        },
      ];

      jest.spyOn(service as any, 'supabase', 'get').mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: mockOEMData,
          error: null,
        }),
      });

      cacheService.get.mockResolvedValue(null);

      const result = await service.searchByOEM(['1234567890'], {
        includeAlternatives: true,
        limit: 50,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSearchMetrics', () => {
    it('should return search metrics', async () => {
      const metrics = await service.getSearchMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalSearches');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('avgResponseTime');
      expect(metrics).toHaveProperty('popularTerms');
      expect(metrics).toHaveProperty('recentTrends');
      expect(metrics).toHaveProperty('errorRate');
    });
  });

  describe('utility methods', () => {
    it('should clean search terms correctly', () => {
      const cleanTerm = (service as any).cleanSearchTerm('  Filtre à Huile @#$  ');
      expect(cleanTerm).toBe('filtre huile');
    });

    it('should generate URL titles correctly', () => {
      const urlTitle = (service as any).urlTitle('Filtre à Huile - MANN');
      expect(urlTitle).toBe('filtre-a-huile-mann');
    });

    it('should calculate price data correctly', () => {
      const item = {
        pieces_price: [{ pri_vente_ttc: 10, pri_consigne_ttc: 5 }],
        piece_qty_sale: 2,
      };

      const priceData = (service as any).calculatePriceData(item);
      expect(priceData).toEqual({
        ttc: 20,
        consigne: 10,
        total: 30,
      });
    });

    it('should determine availability status correctly', () => {
      const availableItem = { piece_qty_sale: 5, piece_display: true };
      const orderItem = { piece_qty_sale: 0, piece_display: true };
      const unavailableItem = { piece_qty_sale: 0, piece_display: false };

      expect((service as any).determineAvailabilityStatus(availableItem)).toBe('available');
      expect((service as any).determineAvailabilityStatus(orderItem)).toBe('on-order');
      expect((service as any).determineAvailabilityStatus(unavailableItem)).toBe('unavailable');
    });
  });

  describe('error handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      jest.spyOn(service as any, 'supabase', 'get').mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      cacheService.get.mockResolvedValue(null);

      await expect(
        service.searchPieces({ searchTerm: 'test' })
      ).rejects.toThrow('Database error');

      expect(analyticsService.recordError).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));

      jest.spyOn(service as any, 'supabase', 'get').mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      // Should not throw and continue with normal search
      const result = await service.searchPieces({ searchTerm: 'test' });
      expect(result).toBeDefined();
    });
  });
});

// =================================
// TESTS D'INTÉGRATION
// =================================

describe('PiecesSearchEnhancedService Integration', () => {
  let service: PiecesSearchEnhancedService;

  beforeEach(async () => {
    // Configuration pour tests d'intégration avec vraies dépendances
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PiecesSearchEnhancedService,
        // ... vrais providers pour tests d'intégration
      ],
    }).compile();

    service = module.get<PiecesSearchEnhancedService>(PiecesSearchEnhancedService);
  });

  it('should perform end-to-end search workflow', async () => {
    // Test complet du workflow de recherche
    const searchParams = {
      searchTerm: 'filtre à huile peugeot 308',
      filters: {
        manufacturers: ['mann-filter', 'bosch'],
        minPrice: 10,
        maxPrice: 100,
      },
      sort: {
        field: 'relevance' as const,
        order: 'desc' as const,
      },
      pagination: {
        page: 1,
        limit: 20,
      },
      options: {
        includeAlternatives: true,
        fuzzySearch: true,
        boostPopular: true,
      },
    };

    const result = await service.searchPieces(searchParams, 'test-user-123');

    // Vérifications complètes
    expect(result.results).toBeDefined();
    expect(result.filters).toBeDefined();
    expect(result.filters.manufacturers.length).toBeGreaterThanOrEqual(0);
    expect(result.filters.gammes.length).toBeGreaterThanOrEqual(0);
    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.searchId).toMatch(/^search_\d+_[a-z0-9]+$/);

    // Vérifier la structure des résultats
    if (result.results.length > 0) {
      const firstResult = result.results[0];
      expect(firstResult.pieceId).toBeDefined();
      expect(firstResult.pieceRef).toBeDefined();
      expect(firstResult.pieceName).toBeDefined();
      expect(firstResult.manufacturer).toBeDefined();
      expect(firstResult.price).toBeDefined();
      expect(firstResult.availability).toBeDefined();
      expect(firstResult.seo).toBeDefined();
    }
  });

  it('should handle personalized search correctly', async () => {
    const userId = 'test-user-456';
    
    const result = await service.searchPersonalized(
      'plaquettes de frein',
      userId,
      {
        boostFactor: 0.3,
        includeHistory: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.results.every(r => r.score !== undefined)).toBe(true);
  });
});

// =================================
// EXEMPLES D'UTILISATION
// =================================

/**
 * 📚 EXEMPLES D'UTILISATION DU SERVICE
 */
export class PiecesSearchUsageExamples {
  constructor(private readonly searchService: PiecesSearchEnhancedService) {}

  /**
   * 🔍 Recherche simple
   */
  async simpleSearch() {
    const result = await this.searchService.searchPieces({
      searchTerm: 'filtre à huile',
      pagination: { page: 1, limit: 20 },
    });

    console.log(`Trouvé ${result.count} résultats`);
    result.results.forEach(piece => {
      console.log(`- ${piece.pieceName} (${piece.pieceRef}) - ${piece.price.total}€`);
    });
  }

  /**
   * 🎛️ Recherche avancée avec filtres
   */
  async advancedSearch() {
    const result = await this.searchService.searchPieces({
      searchTerm: 'plaquettes frein',
      filters: {
        manufacturers: ['bosch', 'ferodo'],
        minPrice: 20,
        maxPrice: 80,
        availability: ['available'],
      },
      sort: {
        field: 'price',
        order: 'asc',
      },
      options: {
        includeAlternatives: true,
        fuzzySearch: true,
        boostPopular: true,
      },
    });

    console.log('Filtres disponibles:', result.filters);
    console.log('Suggestions:', result.suggestions);
  }

  /**
   * 🔮 Auto-complétion
   */
  async autocompletExample() {
    const suggestions = await this.searchService.autocomplete('fil', {
      limit: 10,
      includePopular: true,
      userBias: true,
    }, 'user-123');

    suggestions.forEach(suggestion => {
      console.log(`${suggestion.suggestion} (${suggestion.type}) - Score: ${suggestion.score}`);
    });
  }

  /**
   * 🔧 Recherche par codes OEM
   */
  async oemSearch() {
    const results = await this.searchService.searchByOEM(
      ['1234567890', '0987654321'],
      {
        includeAlternatives: true,
        limit: 30,
      }
    );

    console.log(`Trouvé ${results.length} pièces pour les codes OEM`);
  }

  /**
   * 👤 Recherche personnalisée
   */
  async personalizedSearch() {
    const result = await this.searchService.searchPersonalized(
      'amortisseurs',
      'user-123',
      {
        boostFactor: 0.25,
        includeHistory: true,
      }
    );

    console.log('Résultats personnalisés basés sur l\'historique');
    result.results.slice(0, 5).forEach(piece => {
      console.log(`- ${piece.pieceName} (Score: ${piece.score})`);
    });
  }

  /**
   * 📊 Métriques et analytics
   */
  async getMetrics() {
    const metrics = await this.searchService.getSearchMetrics();
    
    console.log('=== MÉTRIQUES DE RECHERCHE ===');
    console.log(`Total recherches: ${metrics.totalSearches}`);
    console.log(`Taux cache hit: ${metrics.cacheHitRate.toFixed(1)}%`);
    console.log(`Temps réponse moyen: ${metrics.avgResponseTime}ms`);
    console.log(`Taux d'erreur: ${(metrics.errorRate * 100).toFixed(2)}%`);
    
    console.log('\nTermes populaires:');
    metrics.popularTerms.slice(0, 5).forEach(term => {
      console.log(`- "${term.term}": ${term.count} recherches`);
    });
  }

  /**
   * 🔄 Recherche avec analytics complets
   */
  async searchWithFullAnalytics() {
    const result = await this.searchService.searchWithAnalytics(
      {
        searchTerm: 'pneus michelin',
        filters: { manufacturers: ['michelin'] },
      },
      {
        userId: 'user-123',
        sessionId: 'session-456',
        source: 'website',
        userAgent: 'Mozilla/5.0...',
        ip: '192.168.1.1',
      }
    );

    console.log(`Recherche trackée avec ID: ${result.searchId}`);
  }
}