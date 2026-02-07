import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { SeoEnhancedService } from './seo-enhanced.service';
import { getErrorMessage } from '../../common/utils/error.utils';

// Interfaces pour les requêtes
interface SeoGenerationRequest {
  pgId: number;
  typeId: number;
  variables: {
    gamme?: string;
    marque?: string;
    modele?: string;
    type?: string;
    annee?: string;
    nbCh?: string;
    minPrice?: number;
    prixPasCher?: string;
  };
}

interface PiecesSeoRequest {
  marque: string;
  modele: string;
  type: string;
  gamme: string;
  annee?: string;
  nbCh?: string;
  minPrice?: number;
}

@Controller('seo-enhanced')
export class SeoEnhancedController {
  private readonly logger = new Logger(SeoEnhancedController.name);

  constructor(private readonly seoEnhancedService: SeoEnhancedService) {}

  /**
   * Génération de contenu SEO avancé
   * POST /api/seo-enhanced/generate
   */
  @Post('generate')
  async generateSeoEnhanced(@Body() body: SeoGenerationRequest) {
    try {
      this.logger.log(
        `🎯 Génération SEO: pgId=${body.pgId}, typeId=${body.typeId}`,
      );

      const result = await this.seoEnhancedService.generateSeoContent(
        body.pgId,
        body.typeId,
        body.variables,
      );

      return {
        success: true,
        data: result,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur génération SEO: ${getErrorMessage(error)}`);
      return {
        success: false,
        error: 'Erreur lors de la génération SEO',
        details: getErrorMessage(error),
      };
    }
  }

  /**
   * Génération SEO spécifique aux pièces détachées
   * POST /api/seo-enhanced/pieces
   */
  @Post('pieces')
  async generatePiecesSeo(@Body() body: PiecesSeoRequest) {
    try {
      this.logger.log(
        `🔧 SEO Pièces: ${body.marque} ${body.modele} ${body.type}`,
      );

      const result =
        await this.seoEnhancedService.generatePiecesSeoContent(body);

      return {
        success: true,
        data: result,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur SEO pièces: ${getErrorMessage(error)}`);
      return {
        success: false,
        error: 'Erreur lors de la génération SEO pièces',
        details: getErrorMessage(error),
      };
    }
  }

  /**
   * Génération SEO par véhicule (URL friendly)
   * GET /api/seo-enhanced/vehicle/:marque/:modele/:type
   */
  @Get('vehicle/:marque/:modele/:type')
  async generateVehicleSeo(
    @Param('marque') marque: string,
    @Param('modele') modele: string,
    @Param('type') type: string,
  ) {
    try {
      const request: PiecesSeoRequest = {
        marque: decodeURIComponent(marque),
        modele: decodeURIComponent(modele),
        type: decodeURIComponent(type),
        gamme: 'Pièces détachées', // Gamme par défaut
      };

      const result =
        await this.seoEnhancedService.generatePiecesSeoContent(request);

      return {
        success: true,
        data: result,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur SEO véhicule: ${getErrorMessage(error)}`);
      return {
        success: false,
        error: 'Erreur lors de la génération SEO véhicule',
        details: getErrorMessage(error),
      };
    }
  }

  /**
   * Analytics et statistiques SEO
   * GET /api/seo-enhanced/analytics
   */
  @Get('analytics')
  async getSeoAnalytics() {
    try {
      const analytics = await this.seoEnhancedService.getSeoAnalytics();

      // Ajout de statistiques supplémentaires
      const enhancedAnalytics = {
        ...analytics,
        totalPages: 0, // À calculer depuis la base
        pagesWithSeo: 0, // À calculer
        pagesWithoutSeo: 0, // À calculer
        completionRate: 0, // Pourcentage de pages avec SEO
        seoConfig: {
          templatesEnabled: true,
          switchesEnabled: true,
          variablesEnabled: true,
          priceVariationsEnabled: true,
        },
        recentErrors: [], // Logs des erreurs récentes
      };

      return {
        success: true,
        data: enhancedAnalytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur analytics SEO: ${getErrorMessage(error)}`);
      return {
        success: false,
        error: 'Erreur lors de la récupération des analytics',
        details: getErrorMessage(error),
      };
    }
  }

  /**
   * Aperçu d'un template SEO avant génération
   * GET /api/seo-enhanced/preview/:pgId/:typeId
   */
  @Get('preview/:pgId/:typeId')
  async previewSeoContent(
    @Param('pgId') pgId: number,
    @Param('typeId') typeId: number,
    @Query() queryParams: any,
  ) {
    try {
      // Variables d'exemple depuis les paramètres de requête
      const variables = {
        gamme: queryParams.gamme || 'Freinage',
        marque: queryParams.marque || 'Peugeot',
        modele: queryParams.modele || '308',
        type: queryParams.type || 'II (2013-2021)',
        annee: queryParams.annee || '2018',
        nbCh: queryParams.nbCh || '130',
        minPrice: queryParams.minPrice
          ? parseFloat(queryParams.minPrice)
          : 25.99,
      };

      const result = await this.seoEnhancedService.generateSeoContent(
        Number(pgId),
        Number(typeId),
        variables,
      );

      return {
        success: true,
        preview: true,
        data: result,
        variables: variables,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur preview SEO: ${getErrorMessage(error)}`);
      return {
        success: false,
        error: "Erreur lors de la génération de l'aperçu",
        details: getErrorMessage(error),
      };
    }
  }
}
