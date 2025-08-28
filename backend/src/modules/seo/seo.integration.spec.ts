import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SeoService } from './seo.service';
import { SitemapService } from './sitemap.service';

describe('SEO Services Integration Test', () => {
  let seoService: SeoService;
  let sitemapService: SitemapService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
      ],
      providers: [SeoService, SitemapService],
    }).compile();

    seoService = module.get<SeoService>(SeoService);
    sitemapService = module.get<SitemapService>(SitemapService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('SeoService', () => {
    it('should be defined', () => {
      expect(seoService).toBeDefined();
    });

    it('should retrieve metadata for a page', async () => {
      const metadata = await seoService.getMetadata('/');
      expect(metadata).toBeDefined();
    });

    it('should get SEO configuration', async () => {
      const config = await seoService.getSeoConfig('default');
      expect(config).toBeDefined();
    });

    it('should get pages without SEO', async () => {
      const result = await seoService.getPagesWithoutSeo(5);
      expect(result).toHaveProperty('pages');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('timestamp');
      expect(Array.isArray(result.pages)).toBeTruthy();
    });
  });

  describe('SitemapService', () => {
    it('should be defined', () => {
      expect(sitemapService).toBeDefined();
    });

    it('should generate sitemap index', async () => {
      const sitemapIndex = await sitemapService.generateSitemapIndex();
      expect(sitemapIndex).toContain('<?xml version="1.0"');
      expect(sitemapIndex).toContain('<sitemapindex');
      expect(sitemapIndex).toContain('https://automecanik.com');
    });

    it('should generate main sitemap', async () => {
      const mainSitemap = await sitemapService.generateMainSitemap();
      expect(mainSitemap).toContain('<?xml version="1.0"');
      expect(mainSitemap).toContain('<urlset');
      expect(mainSitemap).toContain('https://automecanik.com');
    });

    it('should generate constructeurs sitemap', async () => {
      const constructeursSitemap = await sitemapService.generateConstructeursSitemap();
      expect(constructeursSitemap).toContain('<?xml version="1.0"');
      expect(constructeursSitemap).toContain('<urlset');
    });

    it('should generate robots.txt', async () => {
      const robotsTxt = await sitemapService.generateRobotsTxt();
      expect(robotsTxt).toContain('User-agent: *');
      expect(robotsTxt).toContain('Sitemap:');
    });

    it('should get sitemap stats', async () => {
      const stats = await sitemapService.getSitemapStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });
  });

  describe('Integration Tests', () => {
    it('should update metadata and reflect in pages without SEO', async () => {
      const testUrl = '/test-seo-integration';
      
      // Update metadata
      const metadata = {
        meta_title: 'Test SEO Integration',
        meta_description: 'Test description for SEO integration',
        meta_keywords: 'test,seo,integration',
      };

      const updateResult = await seoService.updateMetadata(testUrl, metadata);
      expect(updateResult).toBeDefined();

      // Check if it appears in pages without SEO (should not appear now)
      const pagesWithoutSeo = await seoService.getPagesWithoutSeo(100);
      const foundPage = pagesWithoutSeo.pages.find(
        (page: any) => page.url_path === testUrl,
      );
      
      // If the page was created, it should not be in "pages without SEO" list
      // since we just added metadata to it
      expect(foundPage).toBeUndefined();
    });
  });
});
