import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search-optimized.service';
import { MeilisearchService } from './meilisearch.service';
import { ProductSheetService } from './product-sheet.service';
import { SearchCacheService } from './search-cache.service';
import { SearchAnalyticsService } from './search-analytics.service';
import { VehicleSearchService } from './vehicle-search.service';

describe('SearchService v3.0 - Tests de Compatibilité et Performance', () => {
  let service: SearchService;
  let meilisearchService: MeilisearchService;
  let vehicleSearchService: VehicleSearchService;
  let cacheService: SearchCacheService;
  let analyticsService: SearchAnalyticsService;

  const mockMeilisearchService = {
    searchVehicles: jest.fn(),
    searchProducts: jest.fn(),
    getSuggestions: jest.fn(),
    getIndexStats: jest.fn(),
  };

  const mockVehicleSearchService = {
    searchByCode: jest.fn(),
    getCompatibleParts: jest.fn(),
  };

  const mockCacheService = {
    generateKey: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    getStats: jest.fn(),
  };

  const mockAnalyticsService = {
    recordSearch: jest.fn(),
    recordError: jest.fn(),
    getPersonalizedSuggestions: jest.fn(),
    getUserPreferences: jest.fn(),
    getStats: jest.fn(),
  };

  const mockProductSheetService = {
    getByReference: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: MeilisearchService, useValue: mockMeilisearchService },
        { provide: VehicleSearchService, useValue: mockVehicleSearchService },
        { provide: SearchCacheService, useValue: mockCacheService },
        { provide: SearchAnalyticsService, useValue: mockAnalyticsService },
        { provide: ProductSheetService, useValue: mockProductSheetService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    meilisearchService = module.get<MeilisearchService>(MeilisearchService);
    vehicleSearchService =
      module.get<VehicleSearchService>(VehicleSearchService);
    cacheService = module.get<SearchCacheService>(SearchCacheService);
    analyticsService = module.get<SearchAnalyticsService>(
      SearchAnalyticsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('🔍 Tests de Compatibilité API', () => {
    it('should maintain compatibility with legacy search interface', async () => {
      // Arrange
      const mockResults = {
        hits: [
          { id: 1, brand: 'BMW', model: 'X5', price: 45000 },
          { id: 2, brand: 'Audi', model: 'Q7', price: 55000 },
        ],
        estimatedTotalHits: 2,
        processingTimeMs: 10,
      };

      mockCacheService.generateKey.mockReturnValue('test-cache-key');
      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchVehicles.mockResolvedValue(mockResults);
      mockMeilisearchService.searchProducts.mockResolvedValue({
        hits: [],
        estimatedTotalHits: 0,
      });

      // Act
      const result = await service.search({
        query: 'BMW X5',
        type: 'v8',
        pagination: { page: 1, limit: 10 },
      });

      // Assert
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('version');
      expect(result.version).toBe('v8');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should support V7 compatibility mode', async () => {
      // Arrange
      const mockResults = {
        hits: [{ id: 1, reference: 'REF123', designation: 'Pièce test' }],
        estimatedTotalHits: 1,
      };

      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchProducts.mockResolvedValue(mockResults);

      // Act
      const result = await service.search({
        query: 'REF123',
        type: 'v7',
      });

      // Assert
      expect(result.version).toBe('v7');
      expect(result.items.length).toBe(1);
    });

    it('should handle MINE search correctly', async () => {
      // Arrange
      const mockVehicle = {
        id: 1,
        mine: 'VF1BA0A0555123456',
        brand: 'Renault',
        model: 'Clio',
      };
      const mockParts = [
        { id: 1, reference: 'PART001', designation: 'Filtre à air' },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockVehicleSearchService.searchByCode.mockResolvedValue(mockVehicle);
      mockVehicleSearchService.getCompatibleParts.mockResolvedValue(mockParts);

      // Act
      const result = await service.search({
        query: 'VF1BA0A0555123456',
        type: 'mine',
      });

      // Assert
      expect(result.vehicle).toBeDefined();
      expect(result.vehicle.mine).toBe('VF1BA0A0555123456');
      expect(result.items).toBe(mockParts);
    });
  });

  describe('⚡ Tests de Performance', () => {
    it('should complete search in under 100ms (cached)', async () => {
      // Arrange
      const cachedResult = {
        items: [{ id: 1, brand: 'BMW' }],
        total: 1,
        page: 1,
        limit: 20,
        timestamp: Date.now(),
      };

      mockCacheService.get.mockResolvedValue(cachedResult);

      // Act
      const startTime = Date.now();
      const result = await service.search({ query: 'BMW', type: 'v8' });
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.fromCache).toBe(true);
    });

    it('should handle concurrent searches efficiently', async () => {
      // Arrange
      const mockResults = {
        hits: [{ id: 1, brand: 'BMW' }],
        estimatedTotalHits: 1,
      };

      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchVehicles.mockResolvedValue(mockResults);
      mockMeilisearchService.searchProducts.mockResolvedValue({
        hits: [],
        estimatedTotalHits: 0,
      });

      // Act
      const searches = Array(10)
        .fill(null)
        .map(() =>
          service.search({ query: `BMW-${Math.random()}`, type: 'v8' }),
        );

      const startTime = Date.now();
      const results = await Promise.all(searches);
      const endTime = Date.now();

      // Assert
      expect(results.length).toBe(10);
      expect(endTime - startTime).toBeLessThan(1000); // Toutes en moins d'1 seconde
      results.forEach((result) => {
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('total');
      });
    });
  });

  describe('🎯 Tests Fonctionnalités Avancées', () => {
    it('should provide smart suggestions based on results and user history', async () => {
      // Arrange
      const mockResults = {
        hits: [
          { id: 1, brand: 'BMW', model: 'X5' },
          { id: 2, brand: 'BMW', model: 'X3' },
        ],
        estimatedTotalHits: 2,
      };

      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchVehicles.mockResolvedValue(mockResults);
      mockMeilisearchService.searchProducts.mockResolvedValue({
        hits: [],
        estimatedTotalHits: 0,
      });
      mockMeilisearchService.getSuggestions.mockResolvedValue({
        hits: [{ suggestion: 'BMW Serie 3', brand: 'BMW', model: 'Serie 3' }],
      });
      mockAnalyticsService.getPersonalizedSuggestions.mockResolvedValue([
        'BMW X1',
        'BMW i3',
      ]);

      // Act
      const result = await service.search(
        {
          query: 'BM',
          type: 'v8',
          options: { suggestions: true },
        },
        'user123',
      );

      // Assert
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should apply personalized scoring when userId provided', async () => {
      // Arrange
      const mockResults = {
        hits: [
          { id: 1, brand: 'BMW', model: 'X5', _rankingScore: 0.8 },
          { id: 2, brand: 'Audi', model: 'Q7', _rankingScore: 0.9 },
        ],
        estimatedTotalHits: 2,
      };

      const mockPreferences = {
        preferredBrands: ['BMW'],
        preferredCategories: ['SUV'],
        priceRange: { min: 30000, max: 60000 },
      };

      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchVehicles.mockResolvedValue(mockResults);
      mockMeilisearchService.searchProducts.mockResolvedValue({
        hits: [],
        estimatedTotalHits: 0,
      });
      mockAnalyticsService.getUserPreferences.mockResolvedValue(
        mockPreferences,
      );

      // Act
      const result = await service.search(
        {
          query: 'SUV',
          type: 'v8',
        },
        'user123',
      );

      // Assert
      expect(result.items.length).toBeGreaterThan(0);
      // Le premier résultat devrait être BMW (préféré) même si Audi avait un score plus élevé
      expect(result.items[0].brand).toBe('BMW');
    });

    it('should handle instant search with ultra-fast response', async () => {
      // Arrange
      const mockSuggestions = {
        hits: [{ suggestion: 'BMW X5', brand: 'BMW', model: 'X5' }],
      };
      const mockQuickResults = {
        hits: [
          { id: 1, reference: 'BMW001', designation: 'BMW X5 2023' },
          { id: 2, brand: 'BMW', model: 'X3', year: 2023 },
        ],
      };

      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.getSuggestions.mockResolvedValue(mockSuggestions);
      mockMeilisearchService.searchProducts.mockResolvedValue(mockQuickResults);
      mockMeilisearchService.searchVehicles.mockResolvedValue(mockQuickResults);

      // Act
      const startTime = Date.now();
      const result = await service.search({
        query: 'BMW',
        type: 'instant',
      });
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(50); // Moins de 50ms
      expect(result.items.length).toBeLessThanOrEqual(5); // Limité pour l'instant search
      expect(result.suggestions).toBeDefined();
    });
  });

  describe('🛡️ Tests de Robustesse', () => {
    it('should handle Meilisearch service errors gracefully', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchVehicles.mockRejectedValue(
        new Error('Meilisearch unavailable'),
      );
      mockMeilisearchService.searchProducts.mockRejectedValue(
        new Error('Meilisearch unavailable'),
      );

      // Act
      const result = await service.search({
        query: 'BMW',
        type: 'v8',
      });

      // Assert
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Erreur lors de la recherche');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should validate and normalize search parameters', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchProducts.mockResolvedValue({
        hits: [],
        estimatedTotalHits: 0,
      });

      // Act
      const result = await service.search({
        query: '  BMW X5  ', // Espaces en début/fin
        pagination: { page: -1, limit: 1000 }, // Valeurs invalides
      });

      // Assert
      expect(result.page).toBe(1); // Normalisé à 1 minimum
      expect(result.limit).toBe(100); // Normalisé à 100 maximum
    });

    it('should handle empty query appropriately', async () => {
      // Act
      const result = await service.search({
        query: '',
        type: 'v8',
      });

      // Assert
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.message).toBe('Aucun résultat trouvé');
    });
  });

  describe('🔄 Tests de Compatibilité Legacy', () => {
    it('should support legacy searchLegacy interface', async () => {
      // Arrange
      const legacyQuery = {
        query: 'BMW',
        category: 'vehicles' as const,
        page: 1,
        limit: 10,
        filters: { brandId: 1 },
      };

      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchVehicles.mockResolvedValue({
        hits: [],
        estimatedTotalHits: 0,
      });
      mockMeilisearchService.searchProducts.mockResolvedValue({
        hits: [],
        estimatedTotalHits: 0,
      });

      // Act
      const result = await service.searchLegacy(legacyQuery);

      // Assert
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('facets'); // Activé par défaut dans legacy
      expect(result).toHaveProperty('suggestions'); // Activé par défaut dans legacy
    });

    it('should support simpleSearch method', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockMeilisearchService.searchVehicles.mockResolvedValue({
        hits: [{ id: 1, brand: 'BMW' }],
        estimatedTotalHits: 1,
      });
      mockMeilisearchService.searchProducts.mockResolvedValue({
        hits: [],
        estimatedTotalHits: 0,
      });

      // Act
      const items = await service.simpleSearch('BMW', 5);

      // Assert
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeLessThanOrEqual(5);
    });

    it('should support searchMine shortcut method', async () => {
      // Arrange
      const mockVehicle = { id: 1, mine: 'TEST123', brand: 'BMW' };
      const mockParts = [{ id: 1, reference: 'PART001' }];

      mockCacheService.get.mockResolvedValue(null);
      mockVehicleSearchService.searchByCode.mockResolvedValue(mockVehicle);
      mockVehicleSearchService.getCompatibleParts.mockResolvedValue(mockParts);

      // Act
      const result = await service.searchMine('TEST123');

      // Assert
      expect(result).toHaveProperty('vehicle');
      expect(result).toHaveProperty('parts');
      expect(result).toHaveProperty('count');
      expect(result.vehicle).toBe(mockVehicle);
      expect(result.parts).toBe(mockParts);
    });
  });

  describe('📊 Tests de Monitoring', () => {
    it('should provide comprehensive search statistics', async () => {
      // Arrange
      const mockVehicleStats = { numberOfDocuments: 1000, memoryUsage: 123456 };
      const mockProductStats = { numberOfDocuments: 5000, memoryUsage: 654321 };
      const mockCacheStats = { hitRate: 0.85, totalRequests: 1000 };
      const mockAnalyticsStats = { totalSearches: 10000, avgResponseTime: 150 };

      mockMeilisearchService.getIndexStats.mockImplementation((index) => {
        if (index === 'vehicles') return Promise.resolve(mockVehicleStats);
        if (index === 'products') return Promise.resolve(mockProductStats);
        return Promise.resolve({});
      });
      mockCacheService.getStats.mockResolvedValue(mockCacheStats);
      mockAnalyticsService.getStats.mockResolvedValue(mockAnalyticsStats);

      // Act
      const stats = await service.getSearchStats();

      // Assert
      expect(stats).toHaveProperty('indices');
      expect(stats.indices).toHaveProperty('vehicles');
      expect(stats.indices).toHaveProperty('products');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('analytics');
      expect(stats).toHaveProperty('totalIndexedItems');
      expect(stats).toHaveProperty('timestamp');
      expect(stats.totalIndexedItems).toBe(6000); // 1000 + 5000
    });
  });
});

/**
 * 🧪 Tests d'Intégration pour Migration
 *
 * Ces tests vérifient que la nouvelle version peut remplacer
 * l'ancienne sans interruption de service
 */
describe('🔄 Tests de Migration', () => {
  it('should be a drop-in replacement for existing SearchService', () => {
    // Test que toutes les méthodes publiques de l'ancien service
    // sont présentes dans le nouveau
    const service = new SearchService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // Méthodes publiques critiques
    expect(typeof service.search).toBe('function');
    expect(typeof service.searchByMine).toBe('function');
    expect(typeof service.getProductSheet).toBe('function');
    expect(typeof service.instantSearch).toBe('function');
    expect(typeof service.getSearchStats).toBe('function');
    expect(typeof service.searchLegacy).toBe('function');
    expect(typeof service.simpleSearch).toBe('function');

    // Nouvelles méthodes bonus
    expect(typeof service.searchMine).toBe('function');
  });

  it('should maintain same return structure for critical methods', async () => {
    // Ce test vérifie que la structure de retour reste identique
    // pour éviter de casser les clients API
    const service = new SearchService(
      {
        searchVehicles: () =>
          Promise.resolve({ hits: [], estimatedTotalHits: 0 }),
        searchProducts: () =>
          Promise.resolve({ hits: [], estimatedTotalHits: 0 }),
      } as any,
      { getByReference: () => Promise.resolve({}) } as any,
      {
        generateKey: () => 'key',
        get: () => Promise.resolve(null),
        set: () => Promise.resolve(),
      } as any,
      {
        recordSearch: () => Promise.resolve(),
        recordError: () => Promise.resolve(),
      } as any,
      {} as any,
    );

    const result = await service.search({ query: 'test', type: 'v8' });

    // Structure de retour requise
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('executionTime');

    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(typeof result.page).toBe('number');
    expect(typeof result.limit).toBe('number');
  });
});
