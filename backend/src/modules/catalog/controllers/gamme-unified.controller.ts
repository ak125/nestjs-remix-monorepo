// 📁 backend/src/modules/catalog/controllers/gamme-unified.controller.ts
// 🎯 Controller unifié pour les gammes - API simple et claire

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Logger,
  Header,
} from '@nestjs/common';
import { GammeUnifiedService } from '../services/gamme-unified.service';
import { GammePricePreviewService } from '../services/gamme-price-preview.service';
import { UnifiedPageDataService } from '../services/unified-page-data.service';

@Controller('api/catalog/gammes')
export class GammeUnifiedController {
  private readonly logger = new Logger(GammeUnifiedController.name);

  constructor(
    private readonly gammeService: GammeUnifiedService,
    private readonly unifiedPageDataService: UnifiedPageDataService,
    private readonly pricePreviewService: GammePricePreviewService,
  ) {}

  /**
   * 🎯 GET /api/catalog/gammes - Toutes les gammes
   */
  @Get()
  async getAllGammes() {
    this.logger.log('🎯 [GET] /api/catalog/gammes');
    return this.gammeService.getAllGammes();
  }

  /**
   * 🏗️ GET /api/catalog/gammes/hierarchy - Hiérarchie familles → gammes
   * 🚀 Cache: 1h (données quasi-statiques)
   */
  @Get('hierarchy')
  @Header(
    'Cache-Control',
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600',
  )
  async getHierarchy() {
    this.logger.log('🏗️ [GET] /api/catalog/gammes/hierarchy');
    return this.gammeService.getHierarchy();
  }

  /**
   * ⭐ GET /api/catalog/gammes/featured - Gammes en vedette
   */
  @Get('featured')
  async getFeatured(@Query('limit') limit?: string) {
    this.logger.log('⭐ [GET] /api/catalog/gammes/featured');
    const limitNum = limit ? parseInt(limit) : 8;
    return this.gammeService.getFeaturedGammes(limitNum);
  }

  /**
   * 🔍 GET /api/catalog/gammes/search - Recherche de gammes
   */
  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit?: string) {
    this.logger.log(`🔍 [GET] /api/catalog/gammes/search?q=${query}`);

    if (!query) {
      return { gammes: [], total: 0, query: '' };
    }

    const limitNum = limit ? parseInt(limit) : 20;
    const gammes = await this.gammeService.searchGammes(query, limitNum);

    return {
      gammes,
      total: gammes.length,
      query,
    };
  }

  /**
   * 📊 GET /api/catalog/gammes/stats - Statistiques des gammes
   */
  @Get('stats')
  async getStats() {
    this.logger.log('📊 [GET] /api/catalog/gammes/stats');

    const hierarchy = await this.gammeService.getHierarchy();
    const featured = await this.gammeService.getFeaturedGammes();

    return {
      success: true,
      data: hierarchy.stats,
      featured_count: featured.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 🔍 GET /api/catalog/gammes/by-alias/:alias - Récupère gamme par alias
   * Pour migration SEO des anciennes URLs sans ID
   */
  @Get('by-alias/:alias')
  async getGammeByAlias(@Param('alias') alias: string) {
    this.logger.log(`🔍 [GET] /api/catalog/gammes/by-alias/${alias}`);

    const gamme = await this.gammeService.getGammeByAlias(alias);

    if (!gamme) {
      return {
        success: false,
        data: null,
        message: `Gamme avec alias "${alias}" non trouvée`,
      };
    }

    return {
      success: true,
      data: gamme,
      message: `Gamme trouvée: ${gamme.name}`,
    };
  }

  /**
   * 💰 GET /api/catalog/gammes/:id/price-preview - Prix indicatifs pour une gamme
   * Retourne min/max/avg + produits représentatifs (1 par marque)
   */
  @Get(':id/price-preview')
  @Header(
    'Cache-Control',
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600',
  )
  async getPricePreview(
    @Param('id') gammeId: string,
    @Query('limit') limit?: string,
  ) {
    const pgId = parseInt(gammeId, 10);
    if (isNaN(pgId) || pgId <= 0) {
      return { success: false, data: null };
    }
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 6, 12) : 6;
    const data = await this.pricePreviewService.getPricePreview(pgId, limitNum);
    return { success: !!data?.min_price, data };
  }

  /**
   * 📄 POST /api/catalog/gammes/:id/seo - Contenu SEO pour une gamme
   * Utilise RPC V3 avec SEO intégré côté PostgreSQL
   */
  @Post(':id/seo')
  async getGammeSeo(
    @Param('id') gammeId: string,
    @Body() body: { type_id: number; marque_id?: number; modele_id?: number },
  ) {
    this.logger.log(`📄 [POST] /api/catalog/gammes/${gammeId}/seo (RPC V3)`);

    const pageData = await this.unifiedPageDataService.getPageData(
      body.type_id || 0,
      parseInt(gammeId),
    );

    // Retourner uniquement le SEO pour compatibilité
    return {
      success: pageData.seo?.success ?? false,
      h1: pageData.seo?.h1 || null,
      content: pageData.seo?.content || null,
      title: pageData.seo?.title || null,
      description: pageData.seo?.description || null,
      keywords: pageData.seo?.keywords || null,
    };
  }
}
