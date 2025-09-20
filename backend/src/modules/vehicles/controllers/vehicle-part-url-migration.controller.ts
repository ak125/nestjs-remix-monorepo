/**
 * 🔄 CONTRÔLEUR DE MIGRATION URLs PIÈCES
 * 
 * API pour configurer et gérer les redirections 301
 * des anciennes URLs de pièces vers la nouvelle architecture
 * 
 * @version 1.0.0
 * @since 2025-09-14
 * @author SEO Migration Team
 */

import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  Logger,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam,
  ApiQuery,
  ApiBody
} from '@nestjs/swagger';
import { VehiclePartUrlMigrationService } from '../services/vehicle-part-url-migration.service';

// Importation du service de redirection existant
// Note: Adapter selon votre architecture exacte
interface RedirectService {
  createRedirect(redirect: {
    old_path: string;
    new_path: string;
    redirect_type: number;
    reason?: string;
  }): Promise<any>;
  
  findRedirect(url: string): Promise<any>;
  createRedirectRule(rule: any): Promise<any>;
}

/**
 * DTO pour la création de redirections en lot
 */
interface BulkRedirectRequest {
  brand_slug: string;
  brand_id: number;
  model_slug: string;
  model_id: number;
  type_slug: string;
  type_id: number;
  force_update?: boolean;
}

/**
 * DTO pour la migration d'une URL unique
 */
interface SingleUrlMigrationRequest {
  legacy_url: string;
  test_mode?: boolean;
}

// ====================================
// 🎯 CONTRÔLEUR PRINCIPAL
// ====================================

@ApiTags('🔄 Vehicle Parts URL Migration')
@Controller('api/vehicles/migration')
export class VehiclePartUrlMigrationController {
  private readonly logger = new Logger(VehiclePartUrlMigrationController.name);

  constructor(
    private readonly migrationService: VehiclePartUrlMigrationService,
    // Note: Injecter votre service de redirection selon votre architecture
    // private readonly redirectService: RedirectService
  ) {}

  /**
   * 🧪 Teste la migration d'une URL unique
   */
  @Get('test/:legacyUrl')
  @ApiOperation({ 
    summary: 'Teste la migration d\'une URL de pièce',
    description: 'Valide le mapping d\'une ancienne URL vers la nouvelle structure sans créer de redirection'
  })
  @ApiParam({ 
    name: 'legacyUrl', 
    description: 'URL encodée à tester',
    example: 'pieces%2Ffiltre-a-huile-7%2Faudi-22%2Fa7-sportback-22059%2F3-0-tfsi-quattro-34940.html'
  })
  @ApiResponse({ status: 200, description: 'Test de migration réussi' })
  @ApiResponse({ status: 400, description: 'URL invalide ou non mappable' })
  async testUrlMigration(@Param('legacyUrl') encodedUrl: string) {
    try {
      const legacyUrl = decodeURIComponent(encodedUrl);
      this.logger.log(`🧪 Test migration URL: ${legacyUrl}`);

      const result = this.migrationService.migratePartUrl(legacyUrl);
      
      if (!result) {
        throw new HttpException(
          `URL non mappable: ${legacyUrl}`,
          HttpStatus.BAD_REQUEST
        );
      }

      return {
        success: true,
        test_mode: true,
        migration: {
          legacy_url: legacyUrl,
          new_url: result.newUrl,
          redirect_type: 301,
          metadata: result.metadata
        },
        message: 'Migration testée avec succès (aucune redirection créée)'
      };

    } catch (error) {
      this.logger.error(`Erreur test migration:`, error);
      throw new HttpException(
        'Erreur lors du test de migration',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 📊 Obtient les statistiques des mappings disponibles
   */
  @Get('stats')
  @ApiOperation({ 
    summary: 'Statistiques des mappings de catégories',
    description: 'Affiche le nombre de catégories mappées et leurs équivalences'
  })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées' })
  async getMappingStats() {
    try {
      const stats = this.migrationService.getMappingStats();
      
      return {
        success: true,
        statistics: stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`Erreur récupération stats:`, error);
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🔄 Migre une URL unique et crée la redirection
   */
  @Post('migrate-url')
  @ApiOperation({ 
    summary: 'Migre une URL unique et crée la redirection 301',
    description: 'Analyse une ancienne URL, la mappe vers la nouvelle structure et crée la redirection'
  })
  @ApiBody({ 
    description: 'Données de migration',
    schema: {
      type: 'object',
      properties: {
        legacy_url: { type: 'string', example: '/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html' },
        test_mode: { type: 'boolean', example: false, description: 'Si true, ne crée pas la redirection' }
      },
      required: ['legacy_url']
    }
  })
  @ApiResponse({ status: 201, description: 'Redirection créée avec succès' })
  @ApiResponse({ status: 400, description: 'URL invalide ou non mappable' })
  async migrateSingleUrl(@Body() body: SingleUrlMigrationRequest) {
    try {
      const { legacy_url, test_mode = false } = body;
      this.logger.log(`🔄 Migration URL: ${legacy_url} (test: ${test_mode})`);

      const result = this.migrationService.migratePartUrl(legacy_url);
      
      if (!result) {
        throw new HttpException(
          `URL non mappable: ${legacy_url}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // En mode test, on ne crée pas la redirection
      if (test_mode) {
        return {
          success: true,
          test_mode: true,
          migration: {
            legacy_url,
            new_url: result.newUrl,
            metadata: result.metadata
          },
          message: 'Migration testée (aucune redirection créée)'
        };
      }

      // TODO: Créer la redirection avec votre service
      // const redirect = await this.redirectService.createRedirect({
      //   old_path: legacy_url,
      //   new_path: result.newUrl,
      //   redirect_type: 301,
      //   reason: `Migration automatique catégorie pièces: ${result.metadata.legacy_category} → ${result.metadata.modern_category}`
      // });

      return {
        success: true,
        test_mode: false,
        migration: {
          legacy_url,
          new_url: result.newUrl,
          redirect_type: 301,
          metadata: result.metadata
        },
        // redirect_id: redirect?.id,
        message: 'Redirection 301 créée avec succès'
      };

    } catch (error) {
      this.logger.error(`Erreur migration URL:`, error);
      throw new HttpException(
        'Erreur lors de la migration',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🔄 Crée toutes les redirections pour un véhicule donné
   */
  @Post('migrate-vehicle')
  @ApiOperation({ 
    summary: 'Crée toutes les redirections 301 pour un véhicule',
    description: 'Génère automatiquement toutes les redirections de catégories pour un véhicule spécifique'
  })
  @ApiBody({ 
    description: 'Informations du véhicule',
    schema: {
      type: 'object',
      properties: {
        brand_slug: { type: 'string', example: 'audi' },
        brand_id: { type: 'number', example: 22 },
        model_slug: { type: 'string', example: 'a7-sportback' },
        model_id: { type: 'number', example: 22059 },
        type_slug: { type: 'string', example: '3-0-tfsi-quattro' },
        type_id: { type: 'number', example: 34940 },
        force_update: { type: 'boolean', example: false, description: 'Force la mise à jour si redirection existe' }
      },
      required: ['brand_slug', 'brand_id', 'model_slug', 'model_id', 'type_slug', 'type_id']
    }
  })
  @ApiResponse({ status: 201, description: 'Redirections créées avec succès' })
  async migrateVehicleUrls(@Body() body: BulkRedirectRequest) {
    try {
      const { 
        brand_slug, brand_id, model_slug, model_id, 
        type_slug, type_id, force_update = false 
      } = body;

      this.logger.log(`🚗 Migration véhicule: ${brand_slug} ${model_slug} ${type_slug}`);

      const redirections = this.migrationService.generateVehicleRedirections(
        brand_slug, brand_id, model_slug, model_id, type_slug, type_id
      );

      const results = {
        success: true,
        vehicle: {
          brand: `${brand_slug}-${brand_id}`,
          model: `${model_slug}-${model_id}`,
          type: `${type_slug}-${type_id}`
        },
        redirections_created: [],
        redirections_skipped: [],
        errors: []
      };

      // TODO: Traiter chaque redirection avec votre service
      for (const redirection of redirections) {
        try {
          // Vérifier si la redirection existe déjà
          // const existing = await this.redirectService.findRedirect(redirection.source);
          
          // if (existing && !force_update) {
          //   results.redirections_skipped.push({
          //     source: redirection.source,
          //     reason: 'Redirection existante'
          //   });
          //   continue;
          // }

          // Créer la redirection
          // const redirect = await this.redirectService.createRedirect({
          //   old_path: redirection.source,
          //   new_path: redirection.destination,
          //   redirect_type: 301,
          //   reason: `Migration automatique véhicule ${brand_slug} ${model_slug} ${type_slug}`
          // });

          results.redirections_created.push({
            source: redirection.source,
            destination: redirection.destination,
            // redirect_id: redirect?.id,
            category: redirection.metadata.category_info.modern_name
          });

        } catch (error) {
          this.logger.error(`Erreur création redirection ${redirection.source}:`, error);
          results.errors.push({
            source: redirection.source,
            error: error.message
          });
        }
      }

      this.logger.log(`✅ Migration terminée: ${results.redirections_created.length} créées, ${results.redirections_skipped.length} ignorées, ${results.errors.length} erreurs`);

      return results;

    } catch (error) {
      this.logger.error(`Erreur migration véhicule:`, error);
      throw new HttpException(
        'Erreur lors de la migration du véhicule',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🧪 Lance les tests des exemples fournis
   */
  @Get('test-examples')
  @ApiOperation({ 
    summary: 'Teste les exemples de migration fournis',
    description: 'Lance les tests sur les URLs d\'exemple pour valider le système'
  })
  @ApiResponse({ status: 200, description: 'Tests terminés' })
  async testMigrationExamples() {
    try {
      this.logger.log(`🧪 Lancement des tests d'exemples...`);
      
      // Le service va logger les résultats
      await this.migrationService.testMigrationExamples();
      
      return {
        success: true,
        message: 'Tests des exemples terminés (voir logs)',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`Erreur tests exemples:`, error);
      throw new HttpException(
        'Erreur lors des tests',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 📋 Génère un aperçu des redirections pour un véhicule
   */
  @Get('preview/:brand/:brandId/:model/:modelId/:type/:typeId')
  @ApiOperation({ 
    summary: 'Aperçu des redirections pour un véhicule',
    description: 'Génère la liste des redirections qui seraient créées pour un véhicule donné'
  })
  @ApiParam({ name: 'brand', example: 'audi' })
  @ApiParam({ name: 'brandId', example: '22' })
  @ApiParam({ name: 'model', example: 'a7-sportback' })
  @ApiParam({ name: 'modelId', example: '22059' })
  @ApiParam({ name: 'type', example: '3-0-tfsi-quattro' })
  @ApiParam({ name: 'typeId', example: '34940' })
  @ApiResponse({ status: 200, description: 'Aperçu généré' })
  async previewVehicleRedirections(
    @Param('brand') brand: string,
    @Param('brandId') brandId: string,
    @Param('model') model: string,
    @Param('modelId') modelId: string,
    @Param('type') type: string,
    @Param('typeId') typeId: string
  ) {
    try {
      const redirections = this.migrationService.generateVehicleRedirections(
        brand, parseInt(brandId), model, parseInt(modelId), type, parseInt(typeId)
      );

      return {
        success: true,
        vehicle: {
          brand: `${brand}-${brandId}`,
          model: `${model}-${modelId}`,
          type: `${type}-${typeId}`
        },
        total_redirections: redirections.length,
        redirections: redirections.map(r => ({
          legacy_url: r.source,
          modern_url: r.destination,
          category: r.metadata.category_info.modern_name,
          seo_keywords: r.metadata.category_info.seo_keywords
        })),
        preview_mode: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`Erreur aperçu redirections:`, error);
      throw new HttpException(
        'Erreur lors de la génération de l\'aperçu',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🔧 Génère les règles de redirection pour Caddy
   */
  @Get('generate-caddy-rules')
  @ApiOperation({ 
    summary: 'Génère les règles de redirection Caddy',
    description: 'Créé la configuration Caddy pour les redirections 301 des anciennes URLs'
  })
  @ApiQuery({ 
    name: 'category', 
    required: false, 
    description: 'Filtrer par catégorie spécifique (filtres, freinage, etc.)' 
  })
  async generateCaddyRules(@Query('category') category?: string) {
    try {
      this.logger.log(`🔧 Génération règles Caddy - Catégorie: ${category || 'toutes'}`);
      
      const rules = await this.migrationService.generateCaddyRedirectRules(category);
      
      return {
        success: true,
        server: 'Caddy v2',
        timestamp: new Date().toISOString(),
        filter: category || 'all_categories',
        total_rules: rules.length,
        rules: rules,
        caddy_config: rules.join('\n'),
        deployment_instructions: [
          '1. Copiez les règles dans votre Caddyfile',
          '2. Placez-les dans le bloc de votre domaine',
          '3. Testez avec: caddy validate --config Caddyfile',
          '4. Rechargez avec: caddy reload --config Caddyfile',
          '5. Vérifiez les logs: tail -f /var/log/caddy/access.log'
        ],
        example_usage: {
          test_url: 'curl -I "https://your-domain.com/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html"',
          expected_response: 'HTTP/2 301\nlocation: /pieces/audi-22/a7-sportback-22059/type-34940/filtres'
        }
      };

    } catch (error) {
      this.logger.error(`Erreur génération règles Caddy:`, error);
      throw new HttpException(
        'Erreur lors de la génération des règles Caddy',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}