import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MetadataService } from '../services/metadata.service';
import { BreadcrumbService } from '../services/breadcrumb.service';

@ApiTags('Metadata')
@Controller('metadata')
export class MetadataController {
  private readonly logger = new Logger(MetadataController.name);

  constructor(
    private readonly metadataService: MetadataService,
    private readonly breadcrumbService: BreadcrumbService,
  ) {}

  @Get('page/:route')
  @ApiOperation({ summary: 'Récupérer les métadonnées d\'une page' })
  @ApiResponse({
    status: 200,
    description: 'Métadonnées récupérées avec succès',
  })
  async getPageMetadata(@Param('route') route: string, @Query('lang') lang?: string) {
    try {
      const metadata = await this.metadataService.getPageMetadata(route, lang);
      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des métadonnées pour la route: ${route}`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('seo/:route')
  @ApiOperation({ summary: 'Récupérer les données SEO d\'une page' })
  @ApiResponse({
    status: 200,
    description: 'Données SEO récupérées avec succès',
  })
  async getPageSEO(@Param('route') route: string, @Query('lang') lang?: string) {
    try {
      const seoData = await this.metadataService.getPageSEO(route, lang);
      return {
        success: true,
        data: seoData,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des données SEO pour la route: ${route}`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des données SEO',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('breadcrumb/:route')
  @ApiOperation({ summary: 'Récupérer le fil d\'Ariane d\'une page' })
  @ApiResponse({
    status: 200,
    description: 'Fil d\'Ariane récupéré avec succès',
  })
  async getBreadcrumb(@Param('route') route: string, @Query('lang') lang?: string) {
    try {
      const breadcrumb = await this.breadcrumbService.generateBreadcrumb(route, lang);
      return {
        success: true,
        data: breadcrumb,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération du fil d'Ariane pour la route: ${route}`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la génération du fil d\'Ariane',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sitemap')
  @ApiOperation({ summary: 'Récupérer le sitemap du site' })
  @ApiResponse({
    status: 200,
    description: 'Sitemap récupéré avec succès',
  })
  async getSitemap(@Query('lang') lang?: string) {
    try {
      const sitemap = await this.metadataService.generateSitemap(lang);
      return {
        success: true,
        data: sitemap,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la génération du sitemap', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('robots')
  @ApiOperation({ summary: 'Récupérer le fichier robots.txt' })
  @ApiResponse({
    status: 200,
    description: 'Robots.txt récupéré avec succès',
  })
  async getRobotsTxt() {
    try {
      const robots = await this.metadataService.generateRobotsTxt();
      return {
        success: true,
        data: robots,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la génération du robots.txt', error);
      throw new HttpException(
        'Erreur lors de la génération du robots.txt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
