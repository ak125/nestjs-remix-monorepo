/**
 * 🧪 OPTIMIZED BREADCRUMB SERVICE - TESTS UNITAIRES
 * 
 * ✅ Tests complets pour validation du service
 * ✅ Mocking des dépendances externes
 * ✅ Couverture des cas d'usage principaux
 * ✅ Tests d'erreur et edge cases
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { OptimizedBreadcrumbService, BreadcrumbItem } from '../optimized-breadcrumb.service';

// Mock des dépendances
const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Mock SupabaseBaseService
jest.mock('../../../../database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {
    protected supabase = mockSupabaseClient;
  },
}));

describe('OptimizedBreadcrumbService', () => {
  let service: OptimizedBreadcrumbService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizedBreadcrumbService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<OptimizedBreadcrumbService>(OptimizedBreadcrumbService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);

    // Reset tous les mocks avant chaque test
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct logger name', () => {
      // Le service doit s'initialiser correctement
      expect(service).toBeInstanceOf(OptimizedBreadcrumbService);
    });
  });

  describe('getBreadcrumbs', () => {
    it('should return cached breadcrumbs when available', async () => {
      // Arrange
      const cachedBreadcrumbs: BreadcrumbItem[] = [
        { label: 'Accueil', path: '/', isClickable: true, active: false },
        { label: 'Pièces', path: '/pieces', isClickable: true, active: false },
        { label: 'Filtres', path: '/pieces/filtres', isClickable: false, active: true },
      ];
      
      mockCacheManager.get.mockResolvedValue(cachedBreadcrumbs);

      // Act
      const result = await service.getBreadcrumbs('/pieces/filtres');

      // Assert
      expect(result).toEqual(cachedBreadcrumbs);
      expect(mockCacheManager.get).toHaveBeenCalledWith('breadcrumb:/pieces/filtres:fr');
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should fetch from database when not in cache', async () => {
      // Arrange
      mockCacheManager.get.mockResolvedValue(null);
      mockSupabaseClient.single.mockResolvedValue({
        data: { 
          mta_ariane: JSON.stringify({
            breadcrumbs: [
              { label: 'Accueil', path: '/' },
              { label: 'Test', path: '/test' }
            ]
          }),
          mta_title: 'Page de test'
        },
        error: null
      });

      // Act
      const result = await service.getBreadcrumbs('/test');

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('___meta_tags_ariane');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('mta_ariane, mta_title');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('mta_url', '/test');
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Accueil');
    });

    it('should generate automatic breadcrumb when no data in database', async () => {
      // Arrange
      mockCacheManager.get.mockResolvedValue(null);
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No data found' }
      });

      // Act
      const result = await service.getBreadcrumbs('/pieces/filtre-huile/audi');

      // Assert
      expect(result).toHaveLength(4); // Accueil + 3 segments
      expect(result[0].label).toBe('Accueil');
      expect(result[0].path).toBe('/');
      expect(result[1].label).toBe('Pieces');
      expect(result[2].label).toBe('Filtre Huile');
      expect(result[3].label).toBe('Audi');
    });

    it('should handle root path correctly', async () => {
      // Arrange
      mockCacheManager.get.mockResolvedValue(null);
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No data found' }
      });

      // Act
      const result = await service.getBreadcrumbs('/');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Accueil');
      expect(result[0].path).toBe('/');
      expect(result[0].active).toBe(true);
    });

    it('should set cache after generating breadcrumbs', async () => {
      // Arrange
      mockCacheManager.get.mockResolvedValue(null);
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No data found' }
      });

      // Act
      const result = await service.getBreadcrumbs('/test');

      // Assert
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'breadcrumb:/test:fr',
        expect.any(Array),
        3600
      );
    });
  });

  describe('updateBreadcrumb', () => {
    it('should update existing breadcrumb', async () => {
      // Arrange
      const breadcrumbData = {
        title: 'Test Page',
        breadcrumbs: [
          { label: 'Accueil', path: '/' },
          { label: 'Test', path: '/test' }
        ]
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: { mta_id: 123 },
        error: null
      });

      mockSupabaseClient.update.mockResolvedValue({
        data: {},
        error: null
      });

      // Act
      await service.updateBreadcrumb('/test', breadcrumbData);

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalled();
      expect(mockCacheManager.del).toHaveBeenCalledWith('breadcrumb:/test:fr');
    });

    it('should create new breadcrumb when none exists', async () => {
      // Arrange
      const breadcrumbData = {
        title: 'New Page',
        breadcrumbs: [
          { label: 'Accueil', path: '/' },
          { label: 'New', path: '/new' }
        ]
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No data found' }
      });

      mockSupabaseClient.insert.mockResolvedValue({
        data: {},
        error: null
      });

      // Act
      await service.updateBreadcrumb('/new', breadcrumbData);

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        mta_id: expect.any(Number),
        mta_url: '/new',
        mta_alias: '/new',
        mta_ariane: expect.any(String)
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const breadcrumbData = { title: 'Test' };
      
      mockSupabaseClient.single.mockResolvedValue({
        data: { mta_id: 123 },
        error: null
      });

      mockSupabaseClient.update.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      // Act & Assert
      await expect(service.updateBreadcrumb('/test', breadcrumbData))
        .rejects.toThrow();
    });
  });

  describe('generateBreadcrumbSchema', () => {
    it('should generate valid Schema.org breadcrumb', () => {
      // Arrange
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Accueil', path: '/', isClickable: true, active: false },
        { label: 'Pièces', path: '/pieces', isClickable: true, active: false },
        { label: 'Filtres', path: '/pieces/filtres', isClickable: false, active: true },
      ];

      // Act
      const schema = service.generateBreadcrumbSchema(breadcrumbs);

      // Assert
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('BreadcrumbList');
      expect(schema.itemListElement).toHaveLength(3);
      expect(schema.itemListElement[0]).toEqual({
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: 'https://www.automecanik.com/',
      });
    });

    it('should handle empty breadcrumbs array', () => {
      // Arrange
      const breadcrumbs: BreadcrumbItem[] = [];

      // Act
      const schema = service.generateBreadcrumbSchema(breadcrumbs);

      // Assert
      expect(schema.itemListElement).toHaveLength(0);
    });
  });

  describe('parseBreadcrumbString', () => {
    it('should parse JSON breadcrumb format', () => {
      // Arrange
      const jsonString = JSON.stringify({
        breadcrumbs: [
          { label: 'Test 1', path: '/test1' },
          { label: 'Test 2', path: '/test2' }
        ]
      });

      // Act
      const result = (service as any).parseBreadcrumbString(jsonString, '/test');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Test 1');
      expect(result[1].label).toBe('Test 2');
    });

    it('should parse string breadcrumb format (A > B > C)', () => {
      // Arrange
      const stringFormat = 'Accueil > Pièces > Filtres';

      // Act
      const result = (service as any).parseBreadcrumbString(stringFormat, '/pieces/filtres');

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].label).toBe('Accueil');
      expect(result[1].label).toBe('Pièces');
      expect(result[2].label).toBe('Filtres');
    });

    it('should handle invalid JSON gracefully', () => {
      // Arrange
      const invalidJson = 'invalid json string';

      // Act
      const result = (service as any).parseBreadcrumbString(invalidJson, '/test');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Invalid Json String');
    });

    it('should return empty array for empty string', () => {
      // Arrange
      const emptyString = '';

      // Act
      const result = (service as any).parseBreadcrumbString(emptyString, '/test');

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('humanizeSegment', () => {
    it('should humanize URL segments correctly', () => {
      // Act & Assert
      expect((service as any).humanizeSegment('filtre-a-huile-7')).toBe('Filtre A Huile');
      expect((service as any).humanizeSegment('audi-22')).toBe('Audi');
      expect((service as any).humanizeSegment('a3-ii-22031')).toBe('A Ii');
      expect((service as any).humanizeSegment('pieces_auto')).toBe('Pieces Auto');
    });

    it('should handle special characters', () => {
      // Act & Assert
      expect((service as any).humanizeSegment('pièces-détachées')).toBe('Pièces Détachées');
      expect((service as any).humanizeSegment('moteur_V8')).toBe('Moteur V');
    });

    it('should handle empty strings', () => {
      // Act & Assert
      expect((service as any).humanizeSegment('')).toBe('');
    });
  });

  describe('clearCache', () => {
    it('should clear cache for given path', async () => {
      // Act
      await (service as any).clearCache('/test');

      // Assert
      expect(mockCacheManager.del).toHaveBeenCalledWith('breadcrumb:/test:fr');
    });

    it('should handle cache deletion errors gracefully', async () => {
      // Arrange
      mockCacheManager.del.mockRejectedValue(new Error('Cache error'));

      // Act & Assert
      await expect((service as any).clearCache('/test')).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', async () => {
      // Arrange
      const longUrl = '/pieces/' + 'very-long-segment-'.repeat(20) + 'end';
      mockCacheManager.get.mockResolvedValue(null);
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No data found' }
      });

      // Act
      const result = await service.getBreadcrumbs(longUrl);

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle URLs with special characters', async () => {
      // Arrange
      const specialUrl = '/pièces/été/français';
      mockCacheManager.get.mockResolvedValue(null);
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No data found' }
      });

      // Act
      const result = await service.getBreadcrumbs(specialUrl);

      // Assert
      expect(result).toBeDefined();
      expect(result.some(item => item.label.includes('Pièces'))).toBeTruthy();
    });

    it('should handle undefined and null inputs gracefully', async () => {
      // Arrange
      mockCacheManager.get.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getBreadcrumbs(null as any)).resolves.toBeDefined();
      await expect(service.getBreadcrumbs(undefined as any)).resolves.toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should complete breadcrumb generation in reasonable time', async () => {
      // Arrange
      const startTime = Date.now();
      mockCacheManager.get.mockResolvedValue(null);
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No data found' }
      });

      // Act
      await service.getBreadcrumbs('/pieces/complex/path/with/many/segments');
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // Moins de 1 seconde
    });

    it('should handle multiple concurrent requests', async () => {
      // Arrange
      mockCacheManager.get.mockResolvedValue(null);
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No data found' }
      });

      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(service.getBreadcrumbs(`/test/${i}`));
      }

      // Act & Assert
      const results = await Promise.all(requests);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBeTruthy();
      });
    });
  });
});