/**
 * 📝 BLOG METADATA CONTROLLER
 * 
 * API REST pour les métadonnées SEO des pages blog
 * Routes: /api/blog/metadata/*
 */

import {
  Controller,
  Get,
  Param,
  Delete,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BlogMetadataService } from './blog-metadata.service';

@Controller('api/blog/metadata')
export class BlogMetadataController {
  private readonly logger = new Logger(BlogMetadataController.name);

  constructor(private readonly metadataService: BlogMetadataService) {}

  /**
   * GET /api/blog/metadata/:alias
   * Récupérer les métadonnées d'une page spécifique
   * 
   * Exemples:
   * - /api/blog/metadata/constructeurs
   * - /api/blog/metadata/advice
   * - /api/blog/metadata/home
   */
  @Get(':alias')
  async getMetadata(@Param('alias') alias: string) {
    this.logger.log(`GET /api/blog/metadata/${alias}`);
    
    const metadata = await this.metadataService.getMetadata(alias);

    return {
      success: true,
      data: metadata,
      alias,
      message: `Métadonnées récupérées pour "${alias}"`,
    };
  }

  /**
   * GET /api/blog/metadata
   * Récupérer toutes les métadonnées
   * Utile pour générer des sitemaps ou des index
   */
  @Get()
  async getAllMetadata() {
    this.logger.log('GET /api/blog/metadata (all)');
    
    const allMetadata = await this.metadataService.getAllMetadata();

    return {
      success: true,
      data: allMetadata,
      total: allMetadata.length,
      message: `${allMetadata.length} métadonnées récupérées`,
    };
  }

  /**
   * GET /api/blog/metadata-aliases
   * Récupérer la liste de tous les alias disponibles
   */
  @Get('aliases/list')
  async getAliases() {
    this.logger.log('GET /api/blog/metadata-aliases');
    
    const aliases = await this.metadataService.getAvailableAliases();

    return {
      success: true,
      data: aliases,
      total: aliases.length,
      message: `${aliases.length} alias disponibles`,
    };
  }

  /**
   * DELETE /api/blog/metadata/cache/:alias
   * Invalider le cache d'un alias spécifique
   * Utile après mise à jour des données dans Supabase
   */
  @Delete('cache/:alias')
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidateCache(@Param('alias') alias: string) {
    this.logger.log(`DELETE /api/blog/metadata/cache/${alias}`);
    
    await this.metadataService.invalidateCache(alias);

    return {
      success: true,
      message: `Cache invalidé pour "${alias}"`,
    };
  }

  /**
   * DELETE /api/blog/metadata/cache
   * Invalider tout le cache des métadonnées
   */
  @Delete('cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidateAllCache() {
    this.logger.log('DELETE /api/blog/metadata/cache (all)');
    
    await this.metadataService.invalidateAllCache();

    return {
      success: true,
      message: 'Tout le cache des métadonnées invalidé',
    };
  }
}
