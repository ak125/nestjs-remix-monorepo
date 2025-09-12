import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EnhancedMetadataService } from '../services/enhanced-metadata.service';
import { CacheService } from '../../cache/cache.service';

describe('EnhancedMetadataService', () => {
  let service: EnhancedMetadataService;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedMetadataService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'SUPABASE_URL':
                  return 'https://test.supabase.co';
                case 'SUPABASE_ANON_KEY':
                  return 'test-key';
                case 'SITE_BASE_URL':
                  return 'https://www.automecanik.com';
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EnhancedMetadataService>(EnhancedMetadataService);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPageMetadata', () => {
    it('should return default metadata for unknown pages', async () => {
      const metadata = await service.getPageMetadata('/unknown-page');
      
      expect(metadata).toBeDefined();
      expect(metadata.title).toBeDefined();
      expect(metadata.description).toBeDefined();
      expect(metadata.keywords).toBeInstanceOf(Array);
    });

    it('should generate proper canonical URL', async () => {
      const metadata = await service.getPageMetadata('/test-page');
      
      expect(metadata.canonicalUrl).toBe('https://www.automecanik.com/test-page');
    });

    it('should clean path properly', async () => {
      const metadata1 = await service.getPageMetadata('/test-page?param=1');
      const metadata2 = await service.getPageMetadata('/test-page');
      
      // Both should have the same canonical URL (without query params)
      expect(metadata1.canonicalUrl).toBe(metadata2.canonicalUrl);
    });
  });

  describe('generateMetaTags', () => {
    it('should generate proper HTML meta tags', () => {
      const metadata = {
        title: 'Test Page',
        description: 'Test Description',
        keywords: ['test', 'page'],
        ogTitle: 'Test OG Title',
        ogDescription: 'Test OG Description',
        canonicalUrl: 'https://www.automecanik.com/test',
        robots: 'index,follow'
      };

      const html = service.generateMetaTags(metadata);
      
      expect(html).toContain('<title>Test Page</title>');
      expect(html).toContain('name="description" content="Test Description"');
      expect(html).toContain('name="keywords" content="test, page"');
      expect(html).toContain('property="og:title" content="Test OG Title"');
      expect(html).toContain('rel="canonical" href="https://www.automecanik.com/test"');
    });

    it('should escape HTML properly', () => {
      const metadata = {
        title: 'Test & Title <script>',
        description: 'Test "Description" with quotes',
        keywords: [],
      };

      const html = service.generateMetaTags(metadata);
      
      expect(html).toContain('&amp;');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;');
    });
  });

  describe('cache integration', () => {
    it('should use cache for repeated requests', async () => {
      const cacheKey = 'metadata:/test-cache';
      const cachedData = {
        title: 'Cached Title',
        description: 'Cached Description',
        keywords: [],
      };

      jest.spyOn(cacheService, 'get').mockResolvedValue(cachedData);

      const metadata = await service.getPageMetadata('/test-cache');
      
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(metadata.title).toBe('Cached Title');
    });
  });
});
