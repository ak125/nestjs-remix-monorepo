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
   * GET /api/sitemap ou /api/sitemap/index.xml - Index des sitemaps
   */
  @Get(['', 'index.xml'])
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
      const xmlContent =
        await this.sitemapService.generateConstructeursSitemap();
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
   * GET /sitemap/modeles.xml - Sitemap des modèles de véhicules partie 1
   */
  @Get('modeles.xml')
  @Header('Content-Type', 'application/xml')
  async getModelesSitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateModelesSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap modèles:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap modèles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/modeles-2.xml - Sitemap des modèles de véhicules partie 2
   */
  @Get('modeles-2.xml')
  @Header('Content-Type', 'application/xml')
  async getModeles2Sitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateModeles2Sitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap modèles-2:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap modèles partie 2',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/types-1.xml - Sitemap des types partie 1
   */
  @Get('types-1.xml')
  @Header('Content-Type', 'application/xml')
  async getTypes1Sitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateTypes1Sitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap types-1:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap types partie 1',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /sitemap/types-2.xml - Sitemap des types partie 2
   */
  @Get('types-2.xml')
  @Header('Content-Type', 'application/xml')
  async getTypes2Sitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateTypes2Sitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap types-2:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap types partie 2',
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
      const marqueId = parseInt(marque, 10);
      if (isNaN(marqueId)) {
        throw new HttpException(
          `ID de marque invalide: ${marque}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const xmlContent =
        await this.sitemapService.generateConstructeurSitemap(marqueId);
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
  @Get('debug/types')
  @Header('Content-Type', 'application/json')
  async debugTypes() {
    return this.sitemapService.debugTypesMatching();
  }

  @Get('debug/gammes')
  @Header('Content-Type', 'application/json')
  async debugGammes() {
    return this.sitemapService.debugGammes();
  }

  @Get('stats')
  async getSitemapStats() {
    return this.sitemapService.getSitemapStats();
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

  /**
   * 🛡️ NOUVEAU: GET /sitemap/vehicle-pieces-validated.xml
   * Sitemap des URLs véhicule-pièces VALIDÉES (filtre les invalides)
   *
   * Paramètres query:
   * - limit: Nombre max d'URLs (défaut: 10000)
   *
   * Exemple: /api/sitemap/vehicle-pieces-validated.xml?limit=1000
   */
  @Get('vehicle-pieces-validated.xml')
  @Header('Content-Type', 'application/xml')
  async getVehiclePiecesValidatedSitemap(@Res() res: Response) {
    try {
      const limit = 5000; // Production: 5k combinaisons uniques (x50 = 250k lignes)
      this.logger.log(
        `🔍 Génération sitemap véhicule-pièces validé (limit=${limit})...`,
      );

      const xmlContent =
        await this.sitemapService.generateVehiclePiecesSitemap(limit);

      const urlCount = xmlContent.split('<url>').length - 1;
      this.logger.log(`✅ Sitemap généré avec ${urlCount} URLs valides`);

      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap véhicule-pièces:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap véhicule-pièces',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 GET /sitemap/vehicle-pieces-quality-report
   * Rapport de qualité des URLs véhicule-pièces
   *
   * Analyse un échantillon pour identifier les raisons d'exclusion
   */
  @Get('vehicle-pieces-quality-report')
  async getVehiclePiecesQualityReport() {
    try {
      const sampleSize = 1000;
      this.logger.log(
        `📊 Génération rapport qualité (échantillon=${sampleSize})...`,
      );

      const report =
        await this.sitemapService.generateVehiclePiecesQualityReport(
          sampleSize,
        );

      this.logger.log(
        `✅ Rapport généré: ${report.valid}/${report.total} URLs valides (${((report.valid / report.total) * 100).toFixed(1)}%)`,
      );

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      this.logger.error('Erreur génération rapport qualité:', error);
      throw new HttpException(
        'Erreur lors de la génération du rapport',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🚀 GET /sitemap/vehicle-pieces-from-cache.xml
   * Sitemap utilisant la table pré-calculée __sitemap_p_link (714k URLs)
   */
  @Get('vehicle-pieces-from-cache.xml')
  @Header('Content-Type', 'application/xml')
  async getVehiclePiecesFromCache(@Res() res: Response) {
    try {
      const limit = 50000; // 50k URLs (Google recommande max 50k par sitemap)
      this.logger.log(
        `🚀 Génération sitemap depuis __sitemap_p_link (limit=${limit})...`,
      );

      const xmlContent =
        await this.sitemapService.generateVehiclePiecesSitemapFromCache(limit);

      const urlCount = xmlContent.split('<url>').length - 1;
      this.logger.log(`✅ Sitemap généré avec ${urlCount} URLs depuis cache`);

      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap depuis cache:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📄 GET /sitemap/pieces-page-:page.xml
   * Sitemap paginé (1000 URLs par page)
   */
  @Get('pieces-page-:page.xml')
  @Header('Content-Type', 'application/xml')
  async getPiecesSitemapPage(
    @Param('page') page: string,
    @Res() res: Response,
  ) {
    try {
      const pageNum = parseInt(page, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        throw new HttpException(
          'Numéro de page invalide',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`🔍 Génération sitemap page ${pageNum}...`);

      const xmlContent = await this.sitemapService.generatePaginatedSitemap(
        pageNum,
        1000,
      );

      const urlCount = xmlContent.split('<url>').length - 1;
      this.logger.log(`✅ Page ${pageNum}: ${urlCount} URLs`);

      res.send(xmlContent);
    } catch (error) {
      this.logger.error(`Erreur page ${page}:`, error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📋 GET /sitemap/pieces-index.xml
   * Index des sitemaps pièces (liste tous les sitemaps paginés)
   */
  @Get('pieces-index.xml')
  @Header('Content-Type', 'application/xml')
  async getPiecesSitemapIndex(@Res() res: Response) {
    try {
      this.logger.log('📋 Génération sitemap index pièces...');

      const xmlContent = await this.sitemapService.generatePiecesSitemapIndex();

      const sitemapCount = xmlContent.split('<sitemap>').length - 1;
      this.logger.log(`✅ Index généré avec ${sitemapCount} sitemaps`);

      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération index:', error);
      throw new HttpException(
        "Erreur lors de la génération de l'index",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔍 GET /sitemap/debug-cache-table
   * Diagnostic: Voir la structure de __sitemap_p_link
   */
  @Get('debug-cache-table')
  async debugCacheTable() {
    try {
      const { data, error } = await this.sitemapService['client']
        .from('__sitemap_p_link')
        .select('*')
        .limit(5);

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        sample_count: data?.length || 0,
        columns: data && data.length > 0 ? Object.keys(data[0]) : [],
        sample_data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 🔍 GET /sitemap/debug-xml-table
   * Diagnostic: Voir la structure de __sitemap_p_xml (sitemaps pré-générés)
   */
  @Get('debug-xml-table')
  async debugXmlTable() {
    try {
      const { data, error } = await this.sitemapService['client']
        .from('__sitemap_p_xml')
        .select('*')
        .limit(10);

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      // Analyser les données
      const analysis = {
        total_rows: data?.length || 0,
        columns: data && data.length > 0 ? Object.keys(data[0]) : [],
        sample: data?.map((row) => ({
          ...row,
          map_file_preview: row.map_file?.substring(0, 200) + '...' || 'null',
        })),
      };

      return {
        success: true,
        ...analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 🔍 GET /sitemap/debug-all-tables
   * Diagnostic: Analyser TOUTES les tables sitemap et leur structure
   */
  @Get('debug-all-tables')
  async debugAllSitemapTables() {
    try {
      const tables = [
        '__sitemap_blog',
        '__sitemap_gamme',
        '__sitemap_marque',
        '__sitemap_motorisation',
        '__sitemap_p_link',
        '__sitemap_p_xml',
        '__sitemap_search_link',
      ];

      const results = {};

      for (const table of tables) {
        const { data, error, count } = await this.sitemapService['client']
          .from(table)
          .select('*', { count: 'exact' })
          .limit(2);

        results[table] = {
          success: !error,
          error: error?.message,
          total_rows: count || 0,
          columns: data && data.length > 0 ? Object.keys(data[0]) : [],
          sample: data?.slice(0, 1), // 1 seul exemple pour économiser la bande passante
        };
      }

      return {
        success: true,
        tables: results,
        summary: {
          total_tables: tables.length,
          total_rows: Object.values(results).reduce(
            (sum: number, t: any) => sum + (t.total_rows || 0),
            0,
          ),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
