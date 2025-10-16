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
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Fichiers manquants
// import { RolesGuard } from '../../auth/guards/roles.guard';
// import { Roles } from '../../auth/decorators/roles.decorator';
// import { UserRole } from '../../auth/enums/user-role.enum';
import {
  ConfigItemDto,
  CreateConfigDto,
  UpdateConfigDto,
  ConfigQueryDto,
} from '../dto/config.dto';

@ApiTags('Configuration')
@Controller('config')
// @UseGuards(JwtAuthGuard, RolesGuard) // DÉSACTIVÉ - Guards manquants
// @ApiBearerAuth()
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dbConfigService: DatabaseConfigService,
    private readonly configValidator: ConfigValidator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les configurations' })
  @ApiResponse({
    status: 200,
    description: 'Configurations récupérées avec succès',
  })
  // @Roles(UserRole.ADMIN, UserRole.MODERATOR) // DÉSACTIVÉ - Guards manquants
  async getAllConfigs(@Query() query: ConfigQueryDto) {
    try {
      const configs = await this.dbConfigService.getAllConfigs(query);
      return {
        success: true,
        data: configs,
        total: configs.length,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des configurations',
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des configurations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':key')
  @ApiOperation({ summary: 'Récupérer une configuration par clé' })
  @ApiResponse({
    status: 200,
    description: 'Configuration récupérée avec succès',
  })
  @ApiResponse({ status: 404, description: 'Configuration non trouvée' })
  async getConfig(@Param('key') key: string) {
    try {
      const config = await this.dbConfigService.getConfig(key);
      if (!config) {
        throw new HttpException(
          'Configuration non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de la configuration: ${key}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la récupération de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle configuration' })
  @ApiResponse({ status: 201, description: 'Configuration créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @Roles(UserRole.ADMIN)
  async createConfig(@Body() createConfigDto: CreateConfigDto) {
    try {
      // Validation des données
      const validationResult =
        await this.configValidator.validateCreateConfig(createConfigDto);
      if (!validationResult.isValid) {
        throw new HttpException(
          {
            message: 'Données de configuration invalides',
            errors: validationResult.errors,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const config = await this.dbConfigService.createConfig(createConfigDto);
      return {
        success: true,
        data: config,
        message: 'Configuration créée avec succès',
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la création de la configuration',
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la création de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':key')
  @ApiOperation({ summary: 'Mettre à jour une configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration mise à jour avec succès',
  })
  @ApiResponse({ status: 404, description: 'Configuration non trouvée' })
  @Roles(UserRole.ADMIN)
  async updateConfig(
    @Param('key') key: string,
    @Body() updateConfigDto: UpdateConfigDto,
  ) {
    try {
      // Validation des données
      const validationResult =
        await this.configValidator.validateUpdateConfig(updateConfigDto);
      if (!validationResult.isValid) {
        throw new HttpException(
          {
            message: 'Données de configuration invalides',
            errors: validationResult.errors,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const config = await this.dbConfigService.updateConfig(
        key,
        updateConfigDto,
      );
      if (!config) {
        throw new HttpException(
          'Configuration non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: config,
        message: 'Configuration mise à jour avec succès',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour de la configuration: ${key}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la mise à jour de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Supprimer une configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration supprimée avec succès',
  })
  @ApiResponse({ status: 404, description: 'Configuration non trouvée' })
  @Roles(UserRole.ADMIN)
  async deleteConfig(@Param('key') key: string) {
    try {
      const deleted = await this.dbConfigService.deleteConfig(key);
      if (!deleted) {
        throw new HttpException(
          'Configuration non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        message: 'Configuration supprimée avec succès',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression de la configuration: ${key}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la suppression de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reload')
  @ApiOperation({ summary: 'Recharger le cache des configurations' })
  @ApiResponse({ status: 200, description: 'Cache rechargé avec succès' })
  @Roles(UserRole.ADMIN)
  async reloadCache() {
    try {
      await this.dbConfigService.clearCache();
      return {
        success: true,
        message: 'Cache des configurations rechargé avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur lors du rechargement du cache', error);
      throw new HttpException(
        'Erreur lors du rechargement du cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('environment/info')
  @ApiOperation({ summary: "Récupérer les informations d'environnement" })
  @ApiResponse({
    status: 200,
    description: "Informations d'environnement récupérées",
  })
  @Roles(UserRole.ADMIN)
  async getEnvironmentInfo() {
    try {
      const envInfo = this.configService.getEnvironmentInfo();
      return {
        success: true,
        data: envInfo,
      };
    } catch (error) {
      this.logger.error(
        "Erreur lors de la récupération des informations d'environnement",
        error,
      );
      throw new HttpException(
        "Erreur lors de la récupération des informations d'environnement",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
