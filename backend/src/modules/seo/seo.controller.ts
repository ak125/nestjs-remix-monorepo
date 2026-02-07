import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { SeoService } from './seo.service';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';
import { UrlCompatibilityService } from './services/url-compatibility.service';
import { SeoKpisService } from './services/seo-kpis.service';
import { OperationFailedException } from '../../common/exceptions';

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

  constructor(
    private readonly seoService: SeoService,
    private readonly urlCompatibilityService: UrlCompatibilityService,
    private readonly seoKpisService: SeoKpisService,
  ) {}

  /**
   * GET /seo/metadata/:url - Récupère les métadonnées SEO d'une page
   */
  @Get('metadata/:url(.*)')
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
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des métadonnées',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour des métadonnées',
      });
    }
  }

  /**
   * GET /seo/redirect/:url - Vérifie les redirections pour une URL
   */
  @Get('redirect/:url(.*)')
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
      this.logger.error(
        `Erreur lors de la vérification des redirections pour ${url}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la vérification des redirections',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération de la configuration SEO',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des analytics SEO',
      });
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
      this.logger.error(
        'Erreur lors de la récupération des pages sans SEO:',
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des pages sans SEO',
      });
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

      this.logger.log(
        `Batch update terminé: ${successCount} succès, ${errorCount} erreurs`,
      );

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
      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour en lot',
      });
    }
  }

  /**
   * GET /seo/url-compatibility/report - Génère un rapport de compatibilité des URLs
   * Vérifie que les URLs générées sont identiques à l'ancien format nginx
   */
  @Get('url-compatibility/report')
  async getUrlCompatibilityReport() {
    try {
      const report =
        await this.urlCompatibilityService.generateCompatibilityReport();

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la génération du rapport de compatibilité:',
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la génération du rapport',
      });
    }
  }

  /**
   * GET /seo/url-compatibility/verify - Vérifie la compatibilité des URLs
   * Query params: type (gammes|constructeurs|modeles|all), sampleSize (number)
   */
  @Get('url-compatibility/verify')
  async verifyUrlCompatibility(
    @Query('type') type?: 'gammes' | 'constructeurs' | 'modeles' | 'all',
    @Query('sampleSize') sampleSize?: number,
  ) {
    try {
      const result = await this.urlCompatibilityService.verifyUrlCompatibility({
        type: type || 'gammes',
        sampleSize: sampleSize ? parseInt(sampleSize.toString(), 10) : 100,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la vérification de compatibilité:',
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la vérification',
      });
    }
  }

  /**
   * GET /seo/url-compatibility/gammes - Liste toutes les URLs de gammes
   * Query params: limit, offset
   */
  @Get('url-compatibility/gammes')
  async getGammeUrls(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      const urls = await this.urlCompatibilityService.getAllGammeUrls({
        limit: limit ? parseInt(limit.toString(), 10) : 100,
        offset: offset ? parseInt(offset.toString(), 10) : 0,
      });

      return {
        success: true,
        count: urls.length,
        data: urls,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des URLs gammes:',
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des URLs',
      });
    }
  }

  /**
   * GET /seo/url-compatibility/constructeurs - Liste toutes les URLs de constructeurs
   */
  @Get('url-compatibility/constructeurs')
  async getConstructeurUrls(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      const urls = await this.urlCompatibilityService.getAllConstructeurUrls({
        limit: limit ? parseInt(limit.toString(), 10) : 100,
        offset: offset ? parseInt(offset.toString(), 10) : 0,
      });

      return {
        success: true,
        count: urls.length,
        data: urls,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des URLs constructeurs:',
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des URLs',
      });
    }
  }

  /**
   * GET /seo/url-compatibility/modeles - Liste toutes les URLs de modèles
   */
  @Get('url-compatibility/modeles')
  async getModeleUrls(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('marqueId') marqueId?: number,
  ) {
    try {
      const urls = await this.urlCompatibilityService.getAllModeleUrls({
        limit: limit ? parseInt(limit.toString(), 10) : 100,
        offset: offset ? parseInt(offset.toString(), 10) : 0,
        marqueId: marqueId ? parseInt(marqueId.toString(), 10) : undefined,
      });

      return {
        success: true,
        count: urls.length,
        data: urls,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des URLs modèles:',
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des URLs',
      });
    }
  }

  /**
   * GET /seo/url-compatibility/test-vehicule - Teste la génération d'URL avec véhicule
   * Pour vérifier le format : /pieces/{pg_alias}-{pg_id}/{marque}-{id}/{modele}-{id}/{type}-{id}.html
   */
  @Get('url-compatibility/test-vehicule')
  async testVehiculeUrl(
    @Query('pgId') pgId?: number,
    @Query('pgAlias') pgAlias?: string,
    @Query('marqueId') marqueId?: number,
    @Query('marqueAlias') marqueAlias?: string,
    @Query('modeleId') modeleId?: number,
    @Query('modeleAlias') modeleAlias?: string,
    @Query('typeId') typeId?: number,
    @Query('typeAlias') typeAlias?: string,
  ) {
    try {
      // Valeurs par défaut pour le test
      const testPgId = pgId ? parseInt(pgId.toString(), 10) : 402;
      const testPgAlias = pgAlias || 'plaquette-de-frein';
      const testMarqueId = marqueId ? parseInt(marqueId.toString(), 10) : 140;
      const testMarqueAlias = marqueAlias || 'renault';
      const testModeleId = modeleId
        ? parseInt(modeleId.toString(), 10)
        : 140049;
      const testModeleAlias = modeleAlias || 'megane-iii';
      const testTypeId = typeId ? parseInt(typeId.toString(), 10) : 100413;
      const testTypeAlias = typeAlias || '1-5-dci';

      const generatedUrl =
        this.urlCompatibilityService.generateGammeVehiculeUrl(
          testPgId,
          testPgAlias,
          testMarqueId,
          testMarqueAlias,
          testModeleId,
          testModeleAlias,
          testTypeId,
          testTypeAlias,
        );

      const expectedUrl = `/pieces/${testPgAlias}-${testPgId}/${testMarqueAlias}-${testMarqueId}/${testModeleAlias}-${testModeleId}/${testTypeAlias}-${testTypeId}.html`;

      return {
        success: true,
        data: {
          input: {
            pgId: testPgId,
            pgAlias: testPgAlias,
            marqueId: testMarqueId,
            marqueAlias: testMarqueAlias,
            modeleId: testModeleId,
            modeleAlias: testModeleAlias,
            typeId: testTypeId,
            typeAlias: testTypeAlias,
          },
          generated_url: generatedUrl,
          expected_url: expectedUrl,
          match: generatedUrl === expectedUrl,
          segments: {
            pieces: generatedUrl.split('/')[1] === 'pieces',
            gamme: generatedUrl.split('/')[2] === `${testPgAlias}-${testPgId}`,
            marque:
              generatedUrl.split('/')[3] ===
              `${testMarqueAlias}-${testMarqueId}`,
            modele:
              generatedUrl.split('/')[4] ===
              `${testModeleAlias}-${testModeleId}`,
            type:
              generatedUrl.split('/')[5] ===
              `${testTypeAlias}-${testTypeId}.html`,
          },
        },
      };
    } catch (error) {
      this.logger.error('Erreur test URL véhicule:', error);
      throw new OperationFailedException({
        message: 'Erreur lors du test',
      });
    }
  }

  /**
   * GET /seo/url-compatibility/test-constructeur - Tester génération URL constructeur+type
   */
  @Get('url-compatibility/test-constructeur')
  async testConstructeurUrl(
    @Query('marqueId') marqueId?: number,
    @Query('marqueAlias') marqueAlias?: string,
    @Query('modeleId') modeleId?: number,
    @Query('modeleAlias') modeleAlias?: string,
    @Query('typeId') typeId?: number,
    @Query('typeAlias') typeAlias?: string,
  ) {
    try {
      const testMarqueId = marqueId ? parseInt(marqueId.toString(), 10) : 13;
      const testMarqueAlias = marqueAlias || 'alfa-romeo';
      const testModeleId = modeleId ? parseInt(modeleId.toString(), 10) : 13000;
      const testModeleAlias = modeleAlias || '145';
      const testTypeId = typeId ? parseInt(typeId.toString(), 10) : 27087;
      const testTypeAlias = typeAlias || '1-9-d';

      const generatedUrl = this.urlCompatibilityService.generateTypeUrl(
        testMarqueId,
        testMarqueAlias,
        testModeleId,
        testModeleAlias,
        testTypeId,
        testTypeAlias,
      );

      const expectedUrl = `/constructeurs/${testMarqueAlias}-${testMarqueId}/${testModeleAlias}-${testModeleId}/${testTypeAlias}-${testTypeId}.html`;

      return {
        success: true,
        data: {
          type: 'constructeur_type',
          input: {
            marqueId: testMarqueId,
            marqueAlias: testMarqueAlias,
            modeleId: testModeleId,
            modeleAlias: testModeleAlias,
            typeId: testTypeId,
            typeAlias: testTypeAlias,
          },
          generated_url: generatedUrl,
          expected_url: expectedUrl,
          match: generatedUrl === expectedUrl,
          segments: {
            constructeurs: generatedUrl.split('/')[1] === 'constructeurs',
            marque:
              generatedUrl.split('/')[2] ===
              `${testMarqueAlias}-${testMarqueId}`,
            modele:
              generatedUrl.split('/')[3] ===
              `${testModeleAlias}-${testModeleId}`,
            type:
              generatedUrl.split('/')[4] ===
              `${testTypeAlias}-${testTypeId}.html`,
          },
        },
      };
    } catch (error) {
      this.logger.error('Erreur test URL constructeur:', error);
      throw new OperationFailedException({
        message: 'Erreur lors du test',
      });
    }
  }

  /**
   * GET /seo/kpis/dashboard - KPIs critiques pour dashboard SEO
   */
  @Get('kpis/dashboard')
  async getDashboardKPIs() {
    try {
      const kpis = await this.seoKpisService.getDashboardKPIs();

      return {
        success: true,
        data: kpis,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération KPIs dashboard:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des KPIs',
      });
    }
  }
}
