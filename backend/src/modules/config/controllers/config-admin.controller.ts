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
import { ConfigService } from '../services/config.service';
import { DatabaseConfigService } from '../services/database-config.service';
import { ConfigValidator } from '../validators/config.validator';

@ApiTags('Configuration Admin')
@Controller('admin/config')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @ApiBearerAuth()
export class ConfigAdminController {
  private readonly logger = new Logger(ConfigAdminController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dbConfigService: DatabaseConfigService,
    private readonly configValidator: ConfigValidator,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Vérifier la santé des configurations' })
  @ApiResponse({
    status: 200,
    description: 'État de santé des configurations',
  })
  async getConfigHealth() {
    try {
      const envInfo = this.configService.getEnvironmentInfo();
      return {
        success: true,
        data: {
          environment: envInfo,
          timestamp: new Date().toISOString(),
          status: 'healthy',
        },
      };
    } catch (error) {
      this.logger.error('Erreur lors de la vérification de santé', error);
      throw new HttpException(
        'Erreur lors de la vérification de santé',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reload')
  @ApiOperation({ summary: 'Recharger toutes les configurations' })
  @ApiResponse({
    status: 200,
    description: 'Configurations rechargées avec succès',
  })
  async reloadConfigurations() {
    try {
      await this.dbConfigService.clearCache();
      return {
        success: true,
        message: 'Configurations rechargées avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors du rechargement des configurations',
        error,
      );
      throw new HttpException(
        'Erreur lors du rechargement des configurations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques des configurations' })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
  })
  async getConfigStats() {
    try {
      const allConfigs = await this.dbConfigService.getAllConfigs();

      const stats = {
        total: allConfigs.length,
        byType: this.groupByType(allConfigs),
        byCategory: this.groupByCategory(allConfigs),
        public: allConfigs.filter((config) => config.isPublic).length,
        private: allConfigs.filter((config) => !config.isPublic).length,
        readOnly: allConfigs.filter((config) => config.isReadOnly).length,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des statistiques',
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('validate')
  @ApiOperation({ summary: 'Valider toutes les configurations' })
  @ApiResponse({
    status: 200,
    description: 'Validation terminée',
  })
  async validateAllConfigurations() {
    try {
      const allConfigs = await this.dbConfigService.getAllConfigs();
      const validationResults = [];

      for (const config of allConfigs) {
        const validation = this.configValidator.validateValueByType(
          config.value,
          config.type,
        );

        if (!validation.isValid) {
          validationResults.push({
            key: config.key,
            errors: validation.errors,
          });
        }
      }

      return {
        success: true,
        data: {
          total: allConfigs.length,
          valid: allConfigs.length - validationResults.length,
          invalid: validationResults.length,
          errors: validationResults,
        },
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la validation des configurations',
        error,
      );
      throw new HttpException(
        'Erreur lors de la validation des configurations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private groupByType(configs: any[]): Record<string, number> {
    return configs.reduce((acc, config) => {
      acc[config.type] = (acc[config.type] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByCategory(configs: any[]): Record<string, number> {
    return configs.reduce((acc, config) => {
      const category = config.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
  }
}
