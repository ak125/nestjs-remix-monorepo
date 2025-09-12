import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  EnhancedMetadataService,
  PageMetadata,
} from '../services/enhanced-metadata.service';

interface UpdateMetadataDto {
  title?: string;
  description?: string;
  keywords?: string[];
  h1?: string;
  breadcrumb?: string;
  robots?: string;
  schemaMarkup?: any;
}

@Controller('api/metadata')
export class EnhancedMetadataController {
  private readonly logger = new Logger(EnhancedMetadataController.name);

  constructor(
    private readonly metadataService: EnhancedMetadataService,
  ) {}

  /**
   * Analytics SEO
   * GET /api/metadata/analytics/seo
   */
  @Get('analytics/seo')
  async getSeoAnalytics(
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; data: any }> {
    try {
      this.logger.log('Récupération analytics SEO');
      
      const limitValue = limit ? parseInt(limit.toString(), 10) : 1000;
      const analytics = await this.metadataService.getSeoAnalytics(limitValue);
      
      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Erreur récupération analytics SEO:', error);
      throw new HttpException(
        'Erreur lors de la récupération des analytics SEO',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lister les pages sans métadonnées
   * GET /api/metadata/pages/without-seo
   */
  @Get('pages/without-seo')
  async getPagesWithoutMetadata(
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; data: { pages: string[]; count: number; timestamp: string } }> {
    try {
      this.logger.log('Récupération pages sans métadonnées');
      
      const limitValue = limit ? parseInt(limit.toString(), 10) : 100;
      const data = await this.metadataService.getPagesWithoutMetadata(limitValue);
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error('Erreur récupération pages sans métadonnées:', error);
      throw new HttpException(
        'Erreur lors de la récupération des pages sans métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Recherche de métadonnées
   * GET /api/metadata/search
   */
  @Get('search')
  async searchMetadata(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; data: { results: any[]; count: number } }> {
    try {
      if (!query || query.trim().length < 2) {
        throw new HttpException(
          'La requête de recherche doit contenir au moins 2 caractères',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Recherche métadonnées: "${query}"`);
      
      const limitValue = limit ? parseInt(limit.toString(), 10) : 50;
      
      // Note: Cette recherche utilise la table existante ___meta_tags_ariane
      // On peut rechercher dans les titres, descriptions et mots-clés
      const results = await this.searchInMetadata(query, limitValue);
      
      return {
        success: true,
        data: {
          results,
          count: results.length,
        },
      };
    } catch (error) {
      this.logger.error(`Erreur recherche métadonnées pour "${query}":`, error);
      throw new HttpException(
        'Erreur lors de la recherche des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mise à jour en lot
   * POST /api/metadata/batch
   */
  @Post('batch')
  async batchUpdateMetadata(
    @Body() batch: { path: string; metadata: UpdateMetadataDto }[],
  ): Promise<{ success: boolean; data: { updated: number; errors: any[] } }> {
    try {
      this.logger.log(`Mise à jour en lot de ${batch.length} pages`);
      
      const results = {
        updated: 0,
        errors: [] as any[],
      };

      for (const item of batch) {
        try {
          await this.metadataService.updatePageMetadata(item.path, item.metadata);
          results.updated++;
        } catch (error) {
          results.errors.push({
            path: item.path,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      this.logger.error('Erreur mise à jour en lot:', error);
      throw new HttpException(
        'Erreur lors de la mise à jour en lot',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les métadonnées d'une page
   * GET /api/metadata/:path
   */
  @Get(':path(*)')
  async getMetadata(@Param('path') path: string): Promise<{ success: boolean; data: PageMetadata }> {
    try {
      this.logger.log(`Récupération métadonnées pour: ${path}`);
      
      const decodedPath = decodeURIComponent(path);
      const metadata = await this.metadataService.getPageMetadata(decodedPath);
      
      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(`Erreur récupération métadonnées pour ${path}:`, error);
      throw new HttpException(
        'Erreur lors de la récupération des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour les métadonnées d'une page
   * PUT /api/metadata/:path
   */
  @Put(':path(*)')
  async updateMetadata(
    @Param('path') path: string,
    @Body() updateData: UpdateMetadataDto,
  ): Promise<{ success: boolean; data: PageMetadata }> {
    try {
      this.logger.log(`Mise à jour métadonnées pour: ${path}`);
      
      const decodedPath = decodeURIComponent(path);
      const metadata = await this.metadataService.updatePageMetadata(decodedPath, updateData);
      
      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(`Erreur mise à jour métadonnées pour ${path}:`, error);
      throw new HttpException(
        'Erreur lors de la mise à jour des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Supprimer les métadonnées d'une page
   * DELETE /api/metadata/:path
   */
  @Delete(':path(*)')
  async deleteMetadata(@Param('path') path: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Suppression métadonnées pour: ${path}`);
      
      const decodedPath = decodeURIComponent(path);
      await this.metadataService.deletePageMetadata(decodedPath);
      
      return {
        success: true,
        message: 'Métadonnées supprimées avec succès',
      };
    } catch (error) {
      this.logger.error(`Erreur suppression métadonnées pour ${path}:`, error);
      throw new HttpException(
        'Erreur lors de la suppression des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Méthode privée pour rechercher dans les métadonnées
   */
  private async searchInMetadata(query: string, limit: number): Promise<any[]> {
    try {
      // Pour l'instant, retourne un tableau vide
      // TODO: Implémenter la recherche directe dans la base de données
      this.logger.log(`Recherche "${query}" - fonctionnalité en développement`);
      
      return [];
    } catch (error) {
      this.logger.error('Erreur recherche dans métadonnées:', error);
      return [];
    }
  }
}