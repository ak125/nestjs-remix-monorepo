import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  MetadataService,
  PageMetadata,
} from '../services/optimized-metadata.service';

interface UpdateMetadataDto {
  title?: string;
  description?: string;
  keywords?: string[];
  h1?: string;
  breadcrumb?: string;
  robots?: string;
}

@Controller('api/seo')
export class OptimizedMetadataController {
  private readonly logger = new Logger(OptimizedMetadataController.name);

  constructor(private readonly metadataService: MetadataService) {}

  /**
   * Récupérer les métadonnées d'une page
   * GET /api/seo/metadata/:route
   */
  @Get('metadata/:route(*)')
  async getMetadata(
    @Param('route') route: string,
    @Query('lang') lang?: string,
  ): Promise<{ success: boolean; data: PageMetadata }> {
    try {
      this.logger.log(`Récupération métadonnées pour: ${route}`);

      const metadata = await this.metadataService.getPageMetadata(route, lang);

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(
        `Erreur récupération métadonnées pour ${route}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les données SEO formatées pour Remix
   * GET /api/seo/page/:route
   */
  @Get('page/:route(*)')
  async getPageSEO(
    @Param('route') route: string,
    @Query('lang') lang?: string,
  ): Promise<{ success: boolean; data: any }> {
    try {
      this.logger.log(`Récupération SEO pour: ${route}`);

      const seoData = await this.metadataService.getPageSEO(route, lang);

      return {
        success: true,
        data: seoData,
      };
    } catch (error) {
      this.logger.error(`Erreur récupération SEO pour ${route}:`, error);
      throw new HttpException(
        'Erreur lors de la récupération des données SEO',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour les métadonnées d'une page
   * PUT /api/seo/metadata/:route
   */
  @Put('metadata/:route(*)')
  async updateMetadata(
    @Param('route') route: string,
    @Body() updateData: UpdateMetadataDto,
  ): Promise<{ success: boolean; data: PageMetadata }> {
    try {
      this.logger.log(`Mise à jour métadonnées pour: ${route}`);

      const metadata = await this.metadataService.updatePageMetadata(
        route,
        updateData,
      );

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(`Erreur mise à jour métadonnées pour ${route}:`, error);
      throw new HttpException(
        'Erreur lors de la mise à jour des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Générer le sitemap XML
   * GET /api/seo/sitemap.xml
   */
  @Get('sitemap.xml')
  async getSitemap(@Query('lang') lang?: string): Promise<any> {
    try {
      this.logger.log(`Génération sitemap pour: ${lang || 'fr'}`);

      const sitemap = await this.metadataService.generateSitemap(lang);

      return {
        success: true,
        data: sitemap,
        count: sitemap.length,
      };
    } catch (error) {
      this.logger.error('Erreur génération sitemap:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Générer le fichier robots.txt
   * GET /api/seo/robots.txt
   */
  @Get('robots.txt')
  async getRobotsTxt(): Promise<{ success: boolean; data: string }> {
    try {
      this.logger.log('Génération robots.txt');

      const robotsTxt = await this.metadataService.generateRobotsTxt();

      return {
        success: true,
        data: robotsTxt,
      };
    } catch (error) {
      this.logger.error('Erreur génération robots.txt:', error);
      throw new HttpException(
        'Erreur lors de la génération du robots.txt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Générer les balises meta HTML pour une page
   * GET /api/seo/meta-tags/:route
   */
  @Get('meta-tags/:route(*)')
  async getMetaTags(
    @Param('route') route: string,
    @Query('lang') lang?: string,
  ): Promise<{
    success: boolean;
    data: { html: string; metadata: PageMetadata };
  }> {
    try {
      this.logger.log(`Génération meta tags pour: ${route}`);

      const metadata = await this.metadataService.getPageMetadata(route, lang);
      const html = this.metadataService.generateMetaTags(metadata);

      return {
        success: true,
        data: {
          html,
          metadata,
        },
      };
    } catch (error) {
      this.logger.error(`Erreur génération meta tags pour ${route}:`, error);
      throw new HttpException(
        'Erreur lors de la génération des meta tags',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
