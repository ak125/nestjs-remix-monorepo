import { describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiContentService } from '../ai-content.service';

describe('AiContentService', () => {
  let service: AiContentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiContentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null), // Use mock provider
          },
        },
      ],
    }).compile();

    service = module.get<AiContentService>(AiContentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateContent', () => {
    it('should generate product description', async () => {
      const result = await service.generateContent({
        type: 'product_description',
        prompt: 'Generate description for a butterfly valve',
        tone: 'professional',
        language: 'fr',
        maxLength: 500,
        useCache: false,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
      expect(result.type).toBe('product_description');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.language).toBe('fr');
    });

    it('should generate SEO meta description', async () => {
      const result = await service.generateContent({
        type: 'seo_meta',
        prompt: 'Generate SEO meta for butterfly valves catalog',
        tone: 'professional',
        language: 'fr',
        maxLength: 200,
        useCache: false,
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('seo_meta');
      expect(result.content.length).toBeLessThanOrEqual(200);
    });

    it('should respect temperature parameter', async () => {
      const result = await service.generateContent({
        type: 'marketing_copy',
        prompt: 'Marketing text for industrial valves',
        tone: 'persuasive',
        temperature: 0.9,
        useCache: false,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
    });
  });

  describe('generateProductDescription', () => {
    it('should generate short description', async () => {
      const result = await service.generateProductDescription({
        productName: 'Butterfly Valve DN50',
        category: 'Valves',
        features: ['Cast iron body', 'Stainless steel disc'],
        tone: 'professional',
        length: 'short',
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('product_description');
      expect(result.content).toBeTruthy();
    });

    it('should include specifications in context', async () => {
      const result = await service.generateProductDescription({
        productName: 'Motorized Butterfly Valve',
        specifications: {
          DN: '50',
          PN: '16',
          material: 'Cast iron GGG40',
        },
        length: 'medium',
      });

      expect(result).toBeDefined();
    });
  });

  describe('generateSEOMeta', () => {
    it('should generate meta description with keywords', async () => {
      const result = await service.generateSEOMeta({
        pageTitle: 'Butterfly Valves - 2025 Catalog',
        keywords: ['industrial valve', 'butterfly valve', 'motorized'],
        targetKeyword: 'butterfly valve',
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('seo_meta');
    });

    it('should respect language parameter', async () => {
      const result = await service.generateSEOMeta({
        pageTitle: 'Vannes papillon',
        language: 'fr',
      });

      expect(result).toBeDefined();
      expect(result.metadata.language).toBe('fr');
    });
  });

  describe('batchGenerate', () => {
    it('should generate multiple contents', async () => {
      const requests = [
        {
          type: 'product_description' as const,
          prompt: 'Product 1',
          tone: 'professional' as const,
          useCache: false,
        },
        {
          type: 'seo_meta' as const,
          prompt: 'Page 1',
          tone: 'professional' as const,
          useCache: false,
        },
      ];

      const results = await service.batchGenerate(requests);

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('product_description');
      expect(results[1].type).toBe('seo_meta');
    });
  });
});
