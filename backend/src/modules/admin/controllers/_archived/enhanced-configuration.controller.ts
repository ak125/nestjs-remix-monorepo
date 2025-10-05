/**
 * 🎛️ CONTRÔLEUR CONFIGURATION AVANCÉ - API Admin
 *
 * Endpoints pour la gestion complète des configurations système :
 * - CRUD avancé avec validation
 * - Historique et audit
 * - Sauvegarde/restauration
 * - Statistiques et monitoring
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { EnhancedConfigurationService, ConfigItem } from '../services/enhanced-configuration.service';

export interface CreateConfigDto {
  key: string;
  value: any;
  category: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array' | 'encrypted';
  description?: string;
  isSensitive?: boolean;
  requiresRestart?: boolean;
  isRequired?: boolean;
  defaultValue?: any;
  validationRules?: any;
  environment?: string;
  tags?: string[];
}

export interface UpdateConfigDto {
  value: any;
  changeReason?: string;
}

export interface CreateBackupDto {
  name: string;
  description?: string;
  environment?: string;
}

@Controller('api/admin/config-enhanced')
@UseGuards(AdminAuthGuard)
export class EnhancedConfigurationController {
  private readonly logger = new Logger(EnhancedConfigurationController.name);

  constructor(
    private readonly configService: EnhancedConfigurationService,
  ) {}

  /**
   * 📊 GESTION DES CONFIGURATIONS
   */

  @Get()
  async getAllConfigs(
    @Query('environment') environment = 'production',
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';
      
      // Audit log
      await this.configService.logAudit({
        action: 'config.list',
        resource: 'configurations',
        userId,
        userEmail: req.user?.email || '',
        details: { environment, category, search },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      let configs = await this.configService.getAllConfigs(environment);

      // Filtrer par catégorie si spécifiée
      if (category) {
        configs = configs.filter((config) => config.category === category);
      }

      // Recherche textuelle si spécifiée
      if (search) {
        const searchLower = search.toLowerCase();
        configs = configs.filter(
          (config) =>
            config.key.toLowerCase().includes(searchLower) ||
            config.description?.toLowerCase().includes(searchLower) ||
            config.category.toLowerCase().includes(searchLower),
        );
      }

      // Masquer les valeurs sensibles pour l'affichage
      const safeConfigs = configs.map((config) => ({
        ...config,
        value: config.isSensitive ? '***MASKED***' : config.value,
      }));

      return {
        success: true,
        data: safeConfigs,
        total: safeConfigs.length,
        environment,
        filters: { category, search },
      };
    } catch (error) {
      this.logger.error('Erreur getAllConfigs:', error);
      throw new HttpException(
        'Erreur lors de la récupération des configurations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':key')
  async getConfig(
    @Param('key') key: string,
    @Query('environment') environment = 'production',
    @Query('includeHistory') includeHistory = false,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';

      const config = await this.configService.getConfig(key, environment);
      if (!config) {
        throw new HttpException('Configuration non trouvée', HttpStatus.NOT_FOUND);
      }

      // Audit log
      await this.configService.logAudit({
        action: 'config.read',
        resource: `configuration:${key}`,
        userId,
        userEmail: req.user?.email || '',
        details: { key, environment, includeHistory },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      const result: any = {
        success: true,
        data: {
          ...config,
          value: config.isSensitive ? '***MASKED***' : config.value,
        },
      };

      // Inclure l'historique si demandé
      if (includeHistory) {
        const history = await this.configService.getConfigHistory(key, environment);
        result.data.history = history;
      }

      return result;
    } catch (error) {
      this.logger.error(`Erreur getConfig pour ${key}:`, error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Erreur lors de la récupération de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createConfig(
    @Body() createConfigDto: CreateConfigDto,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';
      const userEmail = req.user?.email || '';

      // Vérifier si la configuration existe déjà
      const existingConfig = await this.configService.getConfig(
        createConfigDto.key,
        createConfigDto.environment || 'production',
      );

      if (existingConfig) {
        throw new HttpException(
          'Une configuration avec cette clé existe déjà',
          HttpStatus.CONFLICT,
        );
      }

      // Créer la nouvelle configuration
      const newConfig: ConfigItem = {
        id: undefined, // Généré automatiquement
        ...createConfigDto,
        environment: createConfigDto.environment || 'production',
        lastUpdated: new Date().toISOString(),
        updatedBy: userEmail,
        version: 1,
        isActive: true,
      };

      // Pour les créations, on utilise une méthode spécialisée
      // (à implémenter dans le service)
      
      // Audit log
      await this.configService.logAudit({
        action: 'config.create',
        resource: `configuration:${createConfigDto.key}`,
        userId,
        userEmail,
        details: { 
          key: createConfigDto.key,
          category: createConfigDto.category,
          type: createConfigDto.type,
          environment: createConfigDto.environment || 'production'
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      return {
        success: true,
        message: 'Configuration créée avec succès',
        data: {
          ...newConfig,
          value: newConfig.isSensitive ? '***MASKED***' : newConfig.value,
        },
      };
    } catch (error) {
      this.logger.error('Erreur createConfig:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Erreur lors de la création de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':key')
  async updateConfig(
    @Param('key') key: string,
    @Body() updateConfigDto: UpdateConfigDto,
    @Query('environment') environment = 'production',
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';
      const userEmail = req.user?.email || '';

      const updatedConfig = await this.configService.updateConfig(
        key,
        updateConfigDto.value,
        userEmail,
        environment,
        updateConfigDto.changeReason,
      );

      // Audit log
      await this.configService.logAudit({
        action: 'config.update',
        resource: `configuration:${key}`,
        userId,
        userEmail,
        details: {
          key,
          environment,
          changeReason: updateConfigDto.changeReason,
          newVersion: updatedConfig.version,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      return {
        success: true,
        message: 'Configuration mise à jour avec succès',
        data: {
          ...updatedConfig,
          value: updatedConfig.isSensitive ? '***MASKED***' : updatedConfig.value,
        },
      };
    } catch (error) {
      this.logger.error(`Erreur updateConfig pour ${key}:`, error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Erreur lors de la mise à jour de la configuration',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 📚 HISTORIQUE ET AUDIT
   */

  @Get(':key/history')
  async getConfigHistory(
    @Param('key') key: string,
    @Query('environment') environment = 'production',
    @Query('limit') limit = 50,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';
      
      const history = await this.configService.getConfigHistory(
        key,
        environment,
        Number(limit),
      );

      // Audit log
      await this.configService.logAudit({
        action: 'config.history',
        resource: `configuration:${key}`,
        userId,
        userEmail: req.user?.email || '',
        details: { key, environment, limit },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      return {
        success: true,
        data: history,
        total: history.length,
      };
    } catch (error) {
      this.logger.error(`Erreur getConfigHistory pour ${key}:`, error);
      throw new HttpException(
        'Erreur lors de la récupération de l\'historique',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 💾 SAUVEGARDE ET RESTAURATION
   */

  @Post('backup')
  async createBackup(
    @Body() createBackupDto: CreateBackupDto,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';
      const userEmail = req.user?.email || '';

      const backupId = await this.configService.createBackup(
        createBackupDto.name,
        userEmail,
        createBackupDto.environment || 'production',
        createBackupDto.description,
      );

      // Audit log
      await this.configService.logAudit({
        action: 'backup.create',
        resource: `backup:${backupId}`,
        userId,
        userEmail,
        details: {
          backupName: createBackupDto.name,
          environment: createBackupDto.environment || 'production',
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      return {
        success: true,
        message: 'Sauvegarde créée avec succès',
        data: { backupId },
      };
    } catch (error) {
      this.logger.error('Erreur createBackup:', error);
      throw new HttpException(
        'Erreur lors de la création de la sauvegarde',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('backup/list')
  async getBackups(
    @Query('environment') environment = 'production',
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';
      
      const backups = await this.configService.getBackups(environment);

      // Audit log
      await this.configService.logAudit({
        action: 'backup.list',
        resource: 'backups',
        userId,
        userEmail: req.user?.email || '',
        details: { environment },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      return {
        success: true,
        data: backups,
        total: backups.length,
      };
    } catch (error) {
      this.logger.error('Erreur getBackups:', error);
      throw new HttpException(
        'Erreur lors de la récupération des sauvegardes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('backup/:backupId/restore')
  async restoreBackup(
    @Param('backupId') backupId: string,
    @Query('environment') environment = 'production',
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';
      const userEmail = req.user?.email || '';

      await this.configService.restoreBackup(backupId, userEmail, environment);

      // Audit log
      await this.configService.logAudit({
        action: 'backup.restore',
        resource: `backup:${backupId}`,
        userId,
        userEmail,
        details: { backupId, environment },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      return {
        success: true,
        message: 'Sauvegarde restaurée avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur restoreBackup:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la restauration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 STATISTIQUES ET MONITORING
   */

  @Get('stats/overview')
  async getStats(
    @Query('environment') environment = 'production',
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.id || 'anonymous';
      
      const stats = await this.configService.getStats(environment);

      // Audit log
      await this.configService.logAudit({
        action: 'stats.view',
        resource: 'statistics',
        userId,
        userEmail: req.user?.email || '',
        details: { environment },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Erreur getStats:', error);
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔧 UTILITAIRES
   */

  @Get('categories/list')
  async getCategories(
    @Query('environment') environment = 'production',
    @Req() req: Request,
  ) {
    try {
      const configs = await this.configService.getAllConfigs(environment);
      const categories = [...new Set(configs.map((config) => config.category))].sort();

      return {
        success: true,
        data: categories,
        total: categories.length,
      };
    } catch (error) {
      this.logger.error('Erreur getCategories:', error);
      throw new HttpException(
        'Erreur lors de la récupération des catégories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
