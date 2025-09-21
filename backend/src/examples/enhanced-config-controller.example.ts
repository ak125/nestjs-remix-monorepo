import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EnhancedConfigService } from '../modules/config/services/enhanced-config.service';
import { ConfigAnalyticsService } from '../modules/config/services/config-analytics.service';
import { OptimizedBreadcrumbService } from '../modules/config/services/optimized-breadcrumb.service';
import { ConfigValidationService } from '../modules/config/services/config-validation.service';
import {
  CreateConfigSchema,
  UpdateConfigSchema,
  ConfigQuerySchema,
  type CreateConfigDto,
  type UpdateConfigDto,
  type ConfigQueryDto,
} from '../modules/config/schemas/config.schemas';

@ApiTags('Enhanced Config')
@Controller('api/enhanced-config')
export class EnhancedConfigExampleController {
  constructor(
    private readonly configService: EnhancedConfigService,
    private readonly analyticsService: ConfigAnalyticsService,
    private readonly breadcrumbService: OptimizedBreadcrumbService,
    private readonly validationService: ConfigValidationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les configurations' })
  @ApiResponse({
    status: 200,
    description: 'Configurations récupérées avec succès',
  })
  async getAllConfigs(@Query() query: ConfigQueryDto) {
    try {
      // Valider les paramètres de requête
      const validatedQuery = ConfigQuerySchema.parse(query);

      // Récupérer les configurations
      const configs = await this.configService.getAll(validatedQuery);

      // Tracker l'événement
      await this.analyticsService.trackConfigEvent({
        type: 'config_access',
        category: 'api',
        action: 'list_configs',
        label: 'all_configs',
        route: '/api/enhanced-config',
        metadata: { queryParams: validatedQuery },
      });

      return {
        success: true,
        data: configs,
        meta: {
          count: configs.length,
          query: validatedQuery,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la récupération des configurations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':key')
  @ApiOperation({ summary: 'Récupérer une configuration par clé' })
  async getConfigByKey(@Param('key') key: string) {
    try {
      // Valider la clé
      const keyValidation = this.validationService.validateConfigKey(key);
      if (!keyValidation.isValid) {
        throw new HttpException(
          `Clé invalide: ${keyValidation.errors.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const config = await this.configService.get(key);

      // Tracker l'accès
      await this.analyticsService.trackConfigEvent({
        type: 'config_access',
        category: 'api',
        action: 'get_config',
        label: key,
        route: `/api/enhanced-config/${key}`,
        metadata: { configKey: key },
      });

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      throw new HttpException(
        `Configuration non trouvée: ${error.message}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle configuration' })
  async createConfig(@Body() createDto: CreateConfigDto) {
    try {
      // Valider les données
      const validatedData = CreateConfigSchema.parse(createDto);

      // Créer la configuration
      const newConfig = await this.configService.create(validatedData);

      // Tracker la création
      await this.analyticsService.trackConfigEvent({
        type: 'config_change',
        category: 'api',
        action: 'create_config',
        label: validatedData.key,
        route: '/api/enhanced-config',
        metadata: {
          configKey: validatedData.key,
          configType: validatedData.type,
          category: validatedData.category,
        },
      });

      return {
        success: true,
        data: newConfig,
        message: 'Configuration créée avec succès',
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la création: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':key')
  @ApiOperation({ summary: 'Mettre à jour une configuration' })
  async updateConfig(
    @Param('key') key: string,
    @Body() updateDto: UpdateConfigDto,
  ) {
    try {
      // Valider la clé et les données
      const keyValidation = this.validationService.validateConfigKey(key);
      if (!keyValidation.isValid) {
        throw new HttpException(
          `Clé invalide: ${keyValidation.errors.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const validatedData = UpdateConfigSchema.parse(updateDto);

      // Mettre à jour
      const updatedConfig = await this.configService.update(key, validatedData);

      // Tracker la modification
      await this.analyticsService.trackConfigEvent({
        type: 'config_change',
        category: 'api',
        action: 'update_config',
        label: key,
        route: `/api/enhanced-config/${key}`,
        metadata: {
          configKey: key,
          changes: validatedData,
        },
      });

      return {
        success: true,
        data: updatedConfig,
        message: 'Configuration mise à jour avec succès',
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la mise à jour: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Supprimer une configuration' })
  async deleteConfig(@Param('key') key: string) {
    try {
      await this.configService.delete(key);

      // Tracker la suppression
      await this.analyticsService.trackConfigEvent({
        type: 'config_change',
        category: 'api',
        action: 'delete_config',
        label: key,
        route: `/api/enhanced-config/${key}`,
        metadata: { configKey: key },
      });

      return {
        success: true,
        message: 'Configuration supprimée avec succès',
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la suppression: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/metrics')
  @ApiOperation({ summary: 'Récupérer les métriques analytics' })
  async getAnalyticsMetrics(
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' = 'week',
  ) {
    try {
      const metrics = await this.analyticsService.getConfigMetrics(timeframe);

      return {
        success: true,
        data: metrics,
        meta: { timeframe },
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la récupération des métriques: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('breadcrumb/:path(*)')
  @ApiOperation({ summary: 'Générer un breadcrumb pour une route' })
  async getBreadcrumb(
    @Param('path') path: string,
    @Query('lang') lang: string = 'fr',
  ) {
    try {
      const breadcrumb = await this.breadcrumbService.generateBreadcrumb(
        `/${path}`,
        lang,
      );

      return {
        success: true,
        data: breadcrumb,
        meta: {
          path: `/${path}`,
          lang,
          itemsCount: breadcrumb.length,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la génération du breadcrumb: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
