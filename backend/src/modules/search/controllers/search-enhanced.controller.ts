import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SearchService, SearchParams } from '../services/search.service';
@Controller('api/search-enhanced')
export class SearchEnhancedController {
  private readonly logger = new Logger(SearchEnhancedController.name);
  constructor(private readonly searchService: SearchService) {}
  /**   * 🔍 Recherche enrichie avec détection automatique des marques   */ @Get(
    'products',
  )
  async searchProducts(
    @Query('q') query: string,
    @Query('brand') brand?: string,
    @Query('equipment') equipment?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    try {
      const searchParams: SearchParams = {
        query: query || '',
        type: (type as any) || 'v8',
        filters: { ...(brand && { brand }), ...(equipment && { equipment }) },
        pagination: {
          page: parseInt(page || '1', 10),
          limit: parseInt(limit || '20', 10),
        },
        options: { includeBrands: true, facets: true, suggestions: true },
      };
      this.logger.log(
        `🔍 Recherche enrichie: "${query}" avec marque: ${brand || equipment || 'auto-détection'}`,
      );
      const results = await this.searchService.search(searchParams);
      return {
        success: true,
        data: results,
        debug: {
          originalQuery: query,
          manualBrand: brand || equipment || null,
          searchParams,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche enrichie:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
  /**   * 🚗 Démonstration : Recherche complexe de pièce auto   */ @Get(
    'demo-piece-auto',
  )
  async demoPieceAuto(
    @Query('q')
    query: string = 'Filtre à air pour RENAULT CLIO II 1.2 16V 75 ch de 2001 à 2016',
    @Query('limit') limit?: string,
  ) {
    try {
      const searchParams: SearchParams = {
        query: query,
        type: 'v8' as any,
        filters: {},
        pagination: { page: 1, limit: parseInt(limit || '10', 10) },
        options: { includeBrands: true, facets: true, suggestions: true },
      };
      this.logger.log(`🚗 Démo recherche pièce auto: "${query}"`);
      const results = await this.searchService.search(searchParams);
      const analysis = {
        queryLength: query.length,
        containsVehicle:
          /renault|peugeot|citroën|volkswagen|bmw|mercedes/i.test(query),
        containsPart: /filtre|plaquette|disque|courroie|amortisseur/i.test(
          query,
        ),
        containsSpecs: /ch|cv|16v|tdi|hdi|dci/i.test(query),
        containsYear: /\d{4}/g.test(query),
        brandDetected: results.items.some((item) =>
          ['BOSCH', 'MANN-FILTER', 'PURFLUX', 'MAHLE'].includes(item.brand),
        ),
      };
      return {
        success: true,
        demo: {
          originalQuery: query,
          analysis,
          results,
          summary: {
            totalFound: results.total,
            hasFilters: results.items.filter((item) => item.isFilter).length,
            uniqueBrands: [...new Set(results.items.map((item) => item.brand))],
            executionTime: results.executionTime,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur démo pièce auto:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
  /**   * 🔍 Test direct de détection de marques   */ @Get(
    'test-brand-detection',
  )
  async testBrandDetection(@Query('q') query: string = 'bosch filtre') {
    try {
      const testQueries = [
        'bosch filtre',
        'filtre bosch',
        'mann filter',
        'mahle oil',
        'purflux air',
        'champion spark',
        'filtre à air bosch',
        query,
      ];
      const results = testQueries.map((testQuery) => {
        const brandPatterns = [
          { pattern: /\b(bosch)\b/i, brand: 'BOSCH' },
          { pattern: /\b(mann[-\s]?filter|mann)\b/i, brand: 'MANN-FILTER' },
          { pattern: /\b(mahle)\b/i, brand: 'MAHLE' },
          { pattern: /\b(fram)\b/i, brand: 'FRAM' },
          { pattern: /\b(purflux)\b/i, brand: 'PURFLUX' },
          { pattern: /\b(knecht)\b/i, brand: 'KNECHT' },
          { pattern: /\b(champion)\b/i, brand: 'CHAMPION' },
          { pattern: /\b(febi)\b/i, brand: 'FEBI' },
          { pattern: /\b(sachs)\b/i, brand: 'SACHS' },
          { pattern: /\b(valeo)\b/i, brand: 'VALEO' },
        ];
        let detected = false;
        let brand = '';
        let cleanedQuery = testQuery;
        for (const { pattern, brand: brandName } of brandPatterns) {
          if (pattern.test(testQuery)) {
            detected = true;
            brand = brandName;
            cleanedQuery = testQuery
              .replace(pattern, '')
              .replace(/\s+/g, ' ')
              .trim();
            break;
          }
        }
        return { originalQuery: testQuery, detected, brand, cleanedQuery };
      });
      return {
        success: true,
        data: {
          tests: results,
          summary: {
            totalTests: results.length,
            detectedCount: results.filter((r) => r.detected).length,
            detectedBrands: [
              ...new Set(results.filter((r) => r.detected).map((r) => r.brand)),
            ],
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
