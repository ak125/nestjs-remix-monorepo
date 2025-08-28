import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Header,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { SeoService } from './seo.service';
import { SitemapService } from './sitemap.service';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';

interface MetadataDto {
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  h1?: string;
  content?: string;
  breadcrumb?: string;
  rel_follow?: string;
}

/**
 * Contrôleur SEO Hybride - Combine SEO et Sitemap
 * Utilise le meilleur de l'existant avec votre structure préférée
 */
@Controller('api/seo')
export class SeoHybridController {
  private readonly logger = new Logger(SeoHybridController.name);

  constructor(
    private readonly seoService: SeoService,
    private readonly sitemapService: SitemapService,
  ) {}

  /**
   * GET /api/seo/metadata/:path - Récupère les métadonnées SEO
   * Amélioration: Gestion d'erreurs + logging + réponse structurée
   */
  @Get('metadata/:path(*)')
  async getMetadata(@Param('path') path: string) {
    try {
      const fullPath = `/${path}`;
      this.logger.log(`Récupération métadonnées pour: ${fullPath}`);
      
      const metadata = await this.seoService.getMetadata(fullPath);
      
      if (!metadata) {
        return {
          success: false,
          path: fullPath,
          message: 'Aucune métadonnée trouvée',
          defaultMetadata: this.seoService.getDefaultMetadata(fullPath),
        };
      }

      return {
        success: true,
        path: fullPath,
        data: metadata,
        hasCustomMetadata: true,
      };
    } catch (error) {
      this.logger.error(`Erreur métadonnées pour ${path}:`, error);
      throw new HttpException(
        'Erreur lors de la récupération des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/seo/metadata/:path - Met à jour les métadonnées SEO
   * Amélioration: Authentification + validation + logging
   */
  @Put('metadata/:path(*)')
  @UseGuards(AuthenticatedGuard)
  async updateMetadata(
    @Param('path') path: string,
    @Body() metadata: MetadataDto,
  ) {
    try {
      const fullPath = `/${path}`;
      this.logger.log(`Mise à jour métadonnées pour: ${fullPath}`);

      // Validation basique
      if (!metadata.meta_title && !metadata.meta_description) {
        throw new HttpException(
          'Au moins un titre ou une description est requis',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.seoService.updateMetadata(fullPath, metadata);
      
      return {
        success: true,
        path: fullPath,
        message: 'Métadonnées mises à jour avec succès',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Erreur mise à jour métadonnées pour ${path}:`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Erreur lors de la mise à jour des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/seo/sitemap/index - Index des sitemaps
   * Amélioration: Gestion d'erreurs + logging + réponse optimisée
   */
  @Get('sitemap/index')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600') // Cache 1h
  async getSitemapIndex(@Res() res: Response) {
    try {
      this.logger.log('Génération index sitemap');
      const xmlContent = await this.sitemapService.generateSitemapIndex();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération index sitemap:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(
        '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap temporairement indisponible</error>'
      );
    }
  }

  /**
   * GET /api/seo/sitemap/main - Sitemap principal
   * Amélioration: Cache + gestion d'erreurs
   */
  @Get('sitemap/main')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=1800') // Cache 30min
  async getMainSitemap(@Res() res: Response) {
    try {
      this.logger.log('Génération sitemap principal');
      const xmlContent = await this.sitemapService.generateMainSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap principal:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(
        '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap temporairement indisponible</error>'
      );
    }
  }

  /**
   * GET /api/seo/sitemap/constructeurs - Sitemap des constructeurs
   * Amélioration: Cache long pour données stables
   */
  @Get('sitemap/constructeurs')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=7200') // Cache 2h
  async getConstructeursSitemap(@Res() res: Response) {
    try {
      this.logger.log('Génération sitemap constructeurs (117 marques)');
      const xmlContent = await this.sitemapService.generateConstructeursSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap constructeurs:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(
        '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap temporairement indisponible</error>'
      );
    }
  }

  /**
   * GET /api/seo/sitemap/products - Sitemap des produits (714K+ entrées)
   * Nouveau: Endpoint manquant dans votre version
   */
  @Get('sitemap/products')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600') // Cache 1h
  async getProductsSitemap(@Res() res: Response) {
    try {
      this.logger.log('Génération sitemap produits (714K+ entrées)');
      const xmlContent = await this.sitemapService.generateProductsSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap produits:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(
        '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap temporairement indisponible</error>'
      );
    }
  }

  /**
   * GET /api/seo/sitemap/blog - Sitemap du blog
   * Nouveau: Endpoint manquant dans votre version
   */
  @Get('sitemap/blog')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=1800') // Cache 30min
  async getBlogSitemap(@Res() res: Response) {
    try {
      this.logger.log('Génération sitemap blog');
      const xmlContent = await this.sitemapService.generateBlogSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap blog:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(
        '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap temporairement indisponible</error>'
      );
    }
  }

  /**
   * GET /api/seo/robots.txt - Fichier robots.txt
   * Nouveau: Fonctionnalité SEO essentielle
   */
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400') // Cache 24h
  async getRobotsTxt(@Res() res: Response) {
    try {
      this.logger.log('Génération robots.txt');
      const robotsContent = await this.sitemapService.generateRobotsTxt();
      res.send(robotsContent);
    } catch (error) {
      this.logger.error('Erreur génération robots.txt:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(
        'User-agent: *\nDisallow: /\n# Robots.txt temporairement indisponible'
      );
    }
  }

  /**
   * GET /api/seo/config - Configuration SEO
   * Nouveau: Endpoint de configuration manquant
   */
  @Get('config')
  async getSeoConfig() {
    try {
      this.logger.log('Récupération configuration SEO');
      const config = await this.seoService.getSeoConfig('default');
      
      return {
        success: true,
        config: config || {
          default_title_suffix: ' | Automecanik',
          default_description: 'Pièces automobiles et accessoires',
          default_keywords: 'auto, pièces, automobile, mécanique',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération config SEO:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/seo/stats - Statistiques SEO
   * Nouveau: Endpoint de monitoring
   */
  @Get('stats')
  async getSeoStats() {
    try {
      this.logger.log('Récupération statistiques SEO');
      
      const pagesWithoutSeo = await this.seoService.getPagesWithoutSeo(10);
      const sitemapStats = await this.sitemapService.getSitemapStats();
      
      return {
        success: true,
        seo: {
          pagesWithoutSeo: pagesWithoutSeo.count,
          recentPages: pagesWithoutSeo.pages.slice(0, 5),
        },
        sitemaps: sitemapStats,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération stats SEO:', error);
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
