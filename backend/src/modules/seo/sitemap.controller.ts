import {
  Controller,
  Get,
  Param,
  Res,
  HttpException,
  HttpStatus,
  Logger,
  Header,
  Inject,
  Optional,
} from '@nestjs/common';
import { Response } from 'express';
import { SitemapService } from './sitemap.service';
import { SitemapScalableService } from './services/sitemap-scalable.service';
import { SitemapDeltaService } from './services/sitemap-delta.service';
import { SitemapStreamingService } from './services/sitemap-streaming.service';

/**
 * 🗺️ SITEMAP CONTROLLER UNIFIÉ
 *
 * Routes legacy (/api/sitemap/*) maintenues pour compatibilité
 * mais redirigent vers le système v2 scalable pour:
 * - Delta journalier (sitemap-latest.xml)
 * - Streaming gzip pour gros volumes
 * - Sharding intelligent (types, modèles)
 * - Filtres SEO (relfollow, display)
 */
@Controller('api/sitemap')
export class SitemapController {
  private readonly logger = new Logger(SitemapController.name);

  constructor(
    private readonly sitemapService: SitemapService,
    @Optional()
    @Inject(SitemapScalableService)
    private readonly scalableService?: SitemapScalableService,
    @Optional()
    @Inject(SitemapDeltaService)
    private readonly deltaService?: SitemapDeltaService,
    @Optional()
    @Inject(SitemapStreamingService)
    private readonly streamingService?: SitemapStreamingService,
  ) {
    this.logger.log('🗺️ SitemapController initialized');
    if (this.scalableService) this.logger.log('  ✅ ScalableService available');
    if (this.deltaService) this.logger.log('  ✅ DeltaService available');
    if (this.streamingService)
      this.logger.log('  ✅ StreamingService available');
  }

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
   * 🏠 GET /sitemap/racine.xml - Homepage uniquement (aligné PHP: https-sitemap-racine.xml)
   */
  @Get('racine.xml')
  @Header('Content-Type', 'application/xml')
  async getRacineSitemap(@Res() res: Response) {
    try {
      const xmlContent = await this.sitemapService.generateRacineSitemap();
      res.send(xmlContent);
    } catch (error) {
      this.logger.error('Erreur génération sitemap racine:', error);
      throw new HttpException(
        'Erreur lors de la génération du sitemap racine',
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
   * GET /sitemap/stats - Statistiques des sitemaps
   */
  @Get('stats')
  async getSitemapStats() {
    return this.sitemapService.getSitemapStats();
  }

  /**
   * 🔄 GET /api/sitemap/regenerate - Regénère TOUS les sitemaps via système v2
   *
   * Stratégie optimale:
   * 1. Génère delta journalier (URLs modifiées)
   * 2. Regénère sitemaps complets via v2 scalable
   * 3. Nettoie les caches expirés
   */
  @Get('regenerate')
  async regenerateSitemaps() {
    try {
      this.logger.log('🔄 Début regénération des sitemaps (système v2)...');
      const startTime = Date.now();

      const results: any = {
        timestamp: new Date().toISOString(),
        v2_enabled: !!this.scalableService,
        delta_enabled: !!this.deltaService,
        streaming_enabled: !!this.streamingService,
      };

      // 1. Générer delta si service disponible
      if (this.deltaService?.isEnabled()) {
        this.logger.log('  📊 Génération delta journalier...');
        await this.deltaService.nightlyDeltaGeneration();
        results.delta = { success: true };
      }

      // 2. Générer sitemaps via v2 scalable si disponible
      if (this.scalableService) {
        this.logger.log('  🗺️ Génération sitemaps v2 scalable...');

        const sitemapsToGenerate = [
          'pages',
          'constructeurs',
          'modeles-a-m',
          'modeles-n-z',
          'products-niveau1',
          'products-niveau2',
        ];

        const v2Results: Record<
          string,
          { success: boolean; urlCount?: number; error?: string }
        > = {};

        for (const name of sitemapsToGenerate) {
          try {
            const xml = await this.scalableService.generateSitemap(name);
            const urlCount = xml.split('<url>').length - 1;
            v2Results[name] = { success: true, urlCount };
            this.logger.log(`    ✅ ${name}: ${urlCount} URLs`);
          } catch (error) {
            v2Results[name] = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown',
            };
            this.logger.warn(
              `    ⚠️ ${name}: échec - ${v2Results[name].error}`,
            );
          }
        }

        results.v2 = v2Results;
      } else {
        // Fallback vers v1 si v2 non disponible
        this.logger.log('  📋 Fallback vers v1 (v2 non disponible)...');

        const v1Results = {
          main:
            (await this.sitemapService.generateMainSitemap()).split('<url>')
              .length - 1,
          constructeurs:
            (await this.sitemapService.generateConstructeursSitemap()).split(
              '<url>',
            ).length - 1,
          products:
            (await this.sitemapService.generateProductsSitemap()).split('<url>')
              .length - 1,
          blog:
            (await this.sitemapService.generateBlogSitemap()).split('<url>')
              .length - 1,
          modeles:
            (await this.sitemapService.generateModelesSitemap()).split('<url>')
              .length - 1,
          types1:
            (await this.sitemapService.generateTypes1Sitemap()).split('<url>')
              .length - 1,
          types2:
            (await this.sitemapService.generateTypes2Sitemap()).split('<url>')
              .length - 1,
        };

        results.v1 = v1Results;
      }

      // 3. Générer index principal
      await this.sitemapService.generateSitemapIndex();
      results.index = { success: true };

      const duration = Date.now() - startTime;
      results.duration_ms = duration;

      this.logger.log(`✅ Regénération terminée en ${duration}ms`);

      return {
        success: true,
        message: 'Sitemaps regénérés avec succès',
        ...results,
      };
    } catch (error) {
      this.logger.error('❌ Erreur regénération sitemaps:', error);
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
