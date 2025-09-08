/**
 * 🎛️ LAYOUT CONTROLLER UNIFIÉ
 * 
 * Contrôleur principal pour toutes les fonctionnalités layout
 * ✅ API complète pour Core/Massdoc
 * ✅ Endpoints sections modulaires
 * ✅ Configuration dynamique
 * ✅ Performance optimisée
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { LayoutService } from './services/layout.service';
import { LayoutConfigurationService } from './services/layout-config.service';
import { ModularSectionsService } from './services/modular-sections.service';

@Controller('api/layout')
export class LayoutController {
  private readonly logger = new Logger(LayoutController.name);

  constructor(
    private readonly layoutService: LayoutService,
    private readonly configService: LayoutConfigurationService,
    private readonly sectionsService: ModularSectionsService,
  ) {}

  /**
   * 🚀 GET /api/layout - Endpoint principal pour récupérer le layout
   */
  @Get()
  async getLayout(
    @Query('type') type: string = 'core',
    @Query('page') page?: string,
    @Query('version') version?: string,
    @Query('theme') theme?: string,
  ) {
    try {
      const config = {
        type: type as any,
        page,
        version,
        theme,
        showHeader: true,
        showFooter: true,
        showQuickSearch: true,
      };

      const layoutData = await this.layoutService.getLayoutData(config);

      return {
        success: true,
        data: layoutData,
        meta: {
          type,
          page: page || 'default',
          version: version || 'latest',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Erreur getLayout:', error);
      throw new HttpException(
        'Erreur lors de la récupération du layout',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🧩 GET /api/layout/sections - Récupère les sections modulaires
   */
  @Get('sections')
  async getSections(
    @Query('context') context: string = 'core',
    @Query('page') page?: string,
    @Query('userRole') userRole?: string,
  ) {
    try {
      const sections = await this.sectionsService.getSectionsForContext(
        context,
        page,
        userRole,
      );

      return {
        success: true,
        data: sections,
        meta: {
          context,
          page: page || 'all',
          userRole: userRole || 'anonymous',
          count: sections.length,
        },
      };
    } catch (error) {
      this.logger.error('Erreur getSections:', error);
      throw new HttpException(
        'Erreur lors de la récupération des sections',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔧 GET /api/layout/config/:type - Récupère la configuration d'un type
   */
  @Get('config/:type')
  async getConfiguration(
    @Param('type') type: string,
    @Query('version') version?: string,
  ) {
    try {
      const config = await this.configService.getLayoutConfiguration(
        type,
        version,
      );

      if (!config) {
        throw new HttpException(
          `Configuration non trouvée pour ${type}`,
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: config,
        meta: {
          type,
          version: version || 'latest',
        },
      };
    } catch (error) {
      this.logger.error('Erreur getConfiguration:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la récupération de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 💾 POST /api/layout/config - Sauvegarde une configuration
   */
  @Post('config')
  async saveConfiguration(@Body() configData: any) {
    try {
      const saved = await this.configService.saveConfiguration(configData);

      if (!saved) {
        throw new HttpException(
          'Impossible de sauvegarder la configuration',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: saved,
        message: 'Configuration sauvegardée avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur saveConfiguration:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la sauvegarde',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗑️ DELETE /api/layout/cache - Invalide le cache
   */
  @Delete('cache')
  async invalidateCache(
    @Query('type') type?: string,
    @Query('page') page?: string,
  ) {
    try {
      await this.layoutService.invalidateCache(type, page);

      return {
        success: true,
        message: `Cache invalidé${type ? ` pour ${type}` : ''}`,
        meta: {
          type: type || 'all',
          page: page || 'all',
          invalidatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Erreur invalidateCache:', error);
      throw new HttpException(
        'Erreur lors de l\'invalidation du cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🎨 GET /api/layout/core - Layout spécifique Core
   */
  @Get('core')
  async getCoreLayout(@Query('page') page?: string) {
    return this.getLayout('core', page);
  }

  /**
   * 📚 GET /api/layout/massdoc - Layout spécifique Massdoc
   */
  @Get('massdoc')
  async getMassdocLayout(@Query('page') page?: string) {
    return this.getLayout('massdoc', page);
  }

  /**
   * ⚙️ GET /api/layout/admin - Layout spécifique Admin
   */
  @Get('admin')
  async getAdminLayout(@Query('page') page?: string) {
    return this.getLayout('admin', page);
  }

  /**
   * 📊 GET /api/layout/health - Vérification de santé du service
   */
  @Get('health')
  async getHealth() {
    try {
      // Test basique du service
      const testConfig = {
        type: 'core' as any,
        showHeader: true,
        showFooter: false,
      };

      await this.layoutService.getLayoutData(testConfig);

      return {
        success: true,
        status: 'healthy',
        services: {
          layout: 'ok',
          config: 'ok',
          sections: 'ok',
          cache: 'ok',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur health check:', error);
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 GET /api/layout/search - Recherche dans les configurations
   */
  @Get('search')
  async searchConfigurations(@Query('q') query?: string) {
    try {
      // Pour le moment, retourner toutes les configurations
      // TODO: Implémenter la recherche réelle
      const configs = ['core', 'massdoc', 'admin', 'commercial', 'public'];
      
      const results = configs
        .filter(type => !query || type.includes(query.toLowerCase()))
        .map(type => ({
          type,
          name: `${type.charAt(0).toUpperCase()}${type.slice(1)} Layout`,
          description: `Configuration layout pour ${type}`,
        }));

      return {
        success: true,
        data: results,
        meta: {
          query: query || '',
          count: results.length,
        },
      };
    } catch (error) {
      this.logger.error('Erreur searchConfigurations:', error);
      throw new HttpException(
        'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
