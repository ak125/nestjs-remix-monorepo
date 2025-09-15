// 📁 backend/src/modules/catalog/controllers/gamme-unified.controller.ts
// 🎯 Controller unifié pour les gammes - API simple et claire

import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { GammeUnifiedService } from '../services/gamme-unified.service';

@Controller('api/catalog/gammes')
export class GammeUnifiedController {
  private readonly logger = new Logger(GammeUnifiedController.name);

  constructor(private readonly gammeService: GammeUnifiedService) {}

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
   */
  @Get('hierarchy')
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
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string
  ) {
    this.logger.log(`🔍 [GET] /api/catalog/gammes/search?q=${query}`);
    
    if (!query) {
      return { gammes: [], total: 0, query: '' };
    }

    const limitNum = limit ? parseInt(limit) : 20;
    const gammes = await this.gammeService.searchGammes(query, limitNum);
    
    return {
      gammes,
      total: gammes.length,
      query
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
      timestamp: new Date().toISOString()
    };
  }
}