import {
  Controller,
  Get,
  Param,
  Res,
  HttpException,
  HttpStatus,
  Logger,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { SitemapService } from './sitemap.service';

@Controller('api/sitemap')
export class SitemapController {
  private readonly logger = new Logger(SitemapController.name);

  constructor(private readonly sitemapService: SitemapService) {}

  /**
   * GET /sitemap - Index des sitemaps
   */
  @Get()
  @Header('Content-Type', 'application/xml')
  async getSitemapIndex(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateSitemapIndex();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération index sitemap:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap index',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/main.xml - Sitemap principal
   */
  @Get('main.xml')
  @Header('Content-Type', 'application/xml')
  async getMainSitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateMainSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap principal:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap principal',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/constructeurs.xml - Sitemap des constructeurs
   */
  @Get('constructeurs.xml')
  @Header('Content-Type', 'application/xml')
  async getConstructeursSitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateConstructeursSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap constructeurs:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap constructeurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/products.xml - Sitemap des produits
   */
  @Get('products.xml')
  @Header('Content-Type', 'application/xml')
  async getProductsSitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateProductsSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap produits:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap produits',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/blog.xml - Sitemap du blog
   */
  @Get('blog.xml')
  @Header('Content-Type', 'application/xml')
  async getBlogSitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateBlogSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap blog:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap blog',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/constructeur/:marque.xml - Sitemap par constructeur
   */
  @Get('constructeur/:marque.xml')
  @Header('Content-Type', 'application/xml')
  async getConstructeurSitemap(
    @Param('marque') marque: string,
    @Res() res: Response,
  ) {
    try {
      const xmlContent = await this.sitemapService.generateConstructeurSitemap(marque);
      res.send(xmlContent);
    } catch (error) {
      this.logger.error(
        `Erreur génération sitemap constructeur ${marque}:`,
        error,
      );
      throw new HttpException(
        `Erreur lors de la génération du sitemap pour ${marque}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /robots.txt - Fichier robots.txt
   */
  @Get('/robots.txt')
  @Header('Content-Type', 'text/plain')
  async getRobotsTxt(@Res() res: Response) {
    try {
      const robotsContent = await this.sitemapService.generateRobotsTxt();
      res.send(robotsContent);
    } catch (error) {
      this.logger.error('Erreur génération robots.txt:', error);
      throw new HttpException(
        'Erreur lors de la génération du fichier robots.txt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/stats - Statistiques des sitemaps (pour debug)
   */
  @Get('stats')
  async getSitemapStats() {
    try {
      // Récupération des stats depuis les tables existantes
      const stats = await this.sitemapService.getSitemapStats();
      
      return {
        success: true,
        stats,
        lastGenerated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération stats sitemap:', error);
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /sitemap/regenerate - Regénère les sitemaps (admin only)
   */
  @Get('regenerate')
  async regenerateSitemaps() {
    try {
      this.logger.log('Début regénération des sitemaps...');

      const results = {
        main: await this.sitemapService.generateMainSitemap(),
        constructeurs: await this.sitemapService.generateConstructeursSitemap(),
        products: await this.sitemapService.generateProductsSitemap(),
        blog: await this.sitemapService.generateBlogSitemap(),
        index: await this.sitemapService.generateSitemapIndex(),
      };

      this.logger.log('Regénération des sitemaps terminée avec succès');

      return {
        success: true,
        message: 'Sitemaps regénérés avec succès',
        results: {
          mainEntries: results.main.split('<url>').length - 1,
          constructeursEntries: results.constructeurs.split('<url>').length - 1,
          productsEntries: results.products.split('<url>').length - 1,
          blogEntries: results.blog.split('<url>').length - 1,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur regénération sitemaps:', error);
      throw new HttpException(
        'Erreur lors de la regénération des sitemaps',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
