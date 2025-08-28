import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { SeoService } from './seo.service';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';

interface MetadataDto {
  page_url: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  schema_markup?: any;
}

interface SeoAnalyticsResponse {
  totalPages: number;
  pagesWithSeo: number;
  pagesWithoutSeo: number;
  completionRate: number;
  recentErrors: any[];
  seoConfig: any;
}

@Controller('api/seo')
export class SeoController {
  private readonly logger = new Logger(SeoController.name);

  constructor(private readonly seoService: SeoService) {}

  /**
   * GET /seo/metadata/:url - Récupère les métadonnées SEO d'une page
   */
  @Get('metadata/:url(*)')
  async getMetadata(@Param('url') url: string) {
    try {
      const decodedUrl = decodeURIComponent(url);
      const metadata = await this.seoService.getMetadata(decodedUrl);
      
      if (!metadata) {
        return {
          page_url: decodedUrl,
          meta_title: `Page ${decodedUrl} | Automecanik`,
          meta_description: 'Description générée automatiquement',
          hasCustomMetadata: false,
        };
      }

      return {
        ...metadata,
        hasCustomMetadata: true,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des métadonnées pour ${url}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /seo/metadata - Met à jour les métadonnées SEO d'une page
   */
  @Put('metadata')
  @UseGuards(AuthenticatedGuard)
  async updateMetadata(@Body() metadataDto: MetadataDto) {
    try {
      const result = await this.seoService.updateMetadata(
        metadataDto.page_url,
        metadataDto,
      );
      
      this.logger.log(`Métadonnées mises à jour pour ${metadataDto.page_url}`);
      
      return {
        success: true,
        message: 'Métadonnées mises à jour avec succès',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour des métadonnées:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la mise à jour des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /seo/redirect/:url - Vérifie les redirections pour une URL
   */
  @Get('redirect/:url(*)')
  async getRedirect(@Param('url') url: string) {
    try {
      const decodedUrl = decodeURIComponent(url);
      const redirect = await this.seoService.getRedirect(decodedUrl);
      
      if (!redirect) {
        return { hasRedirect: false };
      }

      return {
        hasRedirect: true,
        ...redirect,
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la vérification des redirections pour ${url}:`, error);
      throw new HttpException(
        'Erreur lors de la vérification des redirections',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /seo/config - Récupère la configuration SEO
   */
  @Get('config')
  async getSeoConfig() {
    try {
      const config = await this.seoService.getSeoConfig('default');
      return config;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération de la configuration SEO:',
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération de la configuration SEO',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /seo/analytics - Récupère les statistiques SEO
   */
  @Get('analytics')
  @UseGuards(AuthenticatedGuard)
  async getSeoAnalytics(
    @Query('limit') limit?: number,
  ): Promise<SeoAnalyticsResponse> {
    try {
      const pagesWithoutSeo = await this.seoService.getPagesWithoutSeo(
        limit || 100,
      );
      const seoConfig = await this.seoService.getSeoConfig('default');
      
      // Calculs basiques pour les analytics
      const totalPages = 50000; // Estimation basée sur les 714k entrées sitemap
      const pagesWithSeoCount = totalPages - pagesWithoutSeo.count;
      const completionRate = (pagesWithSeoCount / totalPages) * 100;

      return {
        totalPages,
        pagesWithSeo: pagesWithSeoCount,
        pagesWithoutSeo: pagesWithoutSeo.count,
        completionRate: Math.round(completionRate * 100) / 100,
        recentErrors: pagesWithoutSeo.pages.slice(0, 10), // Les 10 dernières erreurs
        seoConfig,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des analytics SEO:',
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des analytics SEO',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /seo/pages-without-seo - Liste des pages sans SEO optimisé
   */
  @Get('pages-without-seo')
  @UseGuards(AuthenticatedGuard)
  async getPagesWithoutSeo(@Query('limit') limit?: number) {
    try {
      const pages = await this.seoService.getPagesWithoutSeo(limit || 50);
      
      return {
        count: pages.count,
        pages: pages.pages,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des pages sans SEO:', error);
      throw new HttpException(
        'Erreur lors de la récupération des pages sans SEO',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /seo/batch-update - Met à jour les métadonnées en lot
   */
  @Post('batch-update')
  @UseGuards(AuthenticatedGuard)
  async batchUpdateMetadata(@Body() metadataList: MetadataDto[]) {
    try {
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const metadata of metadataList) {
        try {
          const result = await this.seoService.updateMetadata(
            metadata.page_url,
            metadata,
          );
          results.push({ url: metadata.page_url, success: true, data: result });
          successCount++;
        } catch (error) {
          results.push({
            url: metadata.page_url,
            success: false,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          });
          errorCount++;
        }
      }

      this.logger.log(`Batch update terminé: ${successCount} succès, ${errorCount} erreurs`);

      return {
        success: true,
        summary: {
          total: metadataList.length,
          successful: successCount,
          errors: errorCount,
        },
        results,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la mise à jour en lot:', error);
      throw new HttpException(
        'Erreur lors de la mise à jour en lot',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
