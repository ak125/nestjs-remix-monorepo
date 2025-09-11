/**
 * 🎛️ CONTRÔLEUR SYSTÈME CONFIGURATION UNIFIÉ
 *
 * API complète pour la gestion centralisée de toutes les configurations :
 * - Base de données (multi-environnement, tests connexion)
 * - Analytics (multi-providers, scripts optimisés)
 * - Email (SMTP, SendGrid, Mailgun, SES)
 * - Sécurité (chiffrement, politiques, audit)
 * - Monitoring et validation globale
 */

import {
  Controller,
  Get,
  Post,
  Put,
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
import { EnhancedConfigurationService } from '../services/enhanced-configuration.service';
import { DatabaseConfigurationService } from '../services/database-configuration.service';
import { AnalyticsConfigurationService } from '../services/analytics-configuration.service';
import { EmailConfigurationService } from '../services/email-configuration.service';
import { SecurityConfigurationService } from '../services/security-configuration.service';

export interface SystemConfigSummary {
  environment: string;
  lastUpdate: string;
  totalConfigurations: number;
  modules: {
    database: { enabled: boolean; status: string; };
    analytics: { enabled: boolean; providers: number; };
    email: { enabled: boolean; providers: number; };
    security: { enabled: boolean; score: number; };
  };
  health: {
    overall: 'healthy' | 'warning' | 'error';
    database: 'healthy' | 'warning' | 'error';
    analytics: 'healthy' | 'warning' | 'error';
    email: 'healthy' | 'warning' | 'error';
    security: 'healthy' | 'warning' | 'error';
  };
}

@Controller('api/admin/system-config')
@UseGuards(AdminAuthGuard)
export class SystemConfigurationController {
  private readonly logger = new Logger(SystemConfigurationController.name);

  constructor(
    private readonly enhancedConfig: EnhancedConfigurationService,
    private readonly databaseConfig: DatabaseConfigurationService,
    private readonly analyticsConfig: AnalyticsConfigurationService,
    private readonly emailConfig: EmailConfigurationService,
    private readonly securityConfig: SecurityConfigurationService,
  ) {}

  /**
   * 📊 VUE D'ENSEMBLE DU SYSTÈME
   */
  @Get('overview')
  async getSystemOverview(
    @Query('environment') environment = 'production',
    @Req() req: Request,
  ) {
    try {
      const userId = (req.user as any)?.id || 'anonymous';

      // Audit log
      await this.enhancedConfig.logAudit({
        action: 'system.overview',
        resource: 'system-configuration',
        userId,
        userEmail: (req.user as any)?.email || '',
        details: { environment },
        ipAddress: req.ip || '',
        userAgent: req.get('User-Agent') || '',
      });

      // Récupérer toutes les configurations
      const [
        allConfigs,
        databaseStats,
        analyticsValidation,
        emailValidation,
        securityValidation
      ] = await Promise.all([
        this.enhancedConfig.getAllConfigs(environment),
        this.databaseConfig.getDatabaseStats(environment),
        this.analyticsConfig.validateAnalyticsConfig(environment),
        this.emailConfig.validateEmailConfig(environment),
        this.securityConfig.validateSecurityConfig(environment),
      ]);

      const summary: SystemConfigSummary = {
        environment,
        lastUpdate: allConfigs.reduce((latest, config) => {
          return config.lastUpdated && config.lastUpdated > latest 
            ? config.lastUpdated 
            : latest;
        }, ''),
        totalConfigurations: allConfigs.length,
        modules: {
          database: {
            enabled: databaseStats.healthCheck?.status === 'healthy',
            status: databaseStats.healthCheck?.status || 'unknown',
          },
          analytics: {
            enabled: analyticsValidation.summary?.enabled || false,
            providers: analyticsValidation.summary?.enabledProvidersCount || 0,
          },
          email: {
            enabled: emailValidation.summary?.enabled || false,
            providers: emailValidation.summary?.enabledProvidersCount || 0,
          },
          security: {
            enabled: securityValidation.summary?.enabled || false,
            score: securityValidation.securityScore || 0,
          },
        },
        health: {
          overall: this.calculateOverallHealth([
            databaseStats.healthCheck?.status,
            analyticsValidation.valid ? 'healthy' : 'error',
            emailValidation.valid ? 'healthy' : 'error',
            securityValidation.valid ? 'healthy' : 'error',
          ]),
          database: this.mapHealthStatus(databaseStats.healthCheck?.status),
          analytics: analyticsValidation.valid ? 'healthy' : 'error',
          email: emailValidation.valid ? 'healthy' : 'error',
          security: securityValidation.valid ? 'healthy' : 'error',
        },
      };

      return {
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur getSystemOverview:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la vue d\'ensemble',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗄️ CONFIGURATION BASE DE DONNÉES
   */
  @Get('database')
  async getDatabaseConfiguration(
    @Query('environment') environment = 'production',
  ) {
    try {
      const config = await this.databaseConfig.getDatabaseConfig(environment);
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error('Erreur getDatabaseConfiguration:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la configuration base de données',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('database/test')
  async testDatabaseConnection(
    @Query('environment') environment = 'production',
  ) {
    try {
      const result = await this.databaseConfig.testDatabaseConnection(environment);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Erreur testDatabaseConnection:', error);
      throw new HttpException(
        'Erreur lors du test de connexion',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('database/stats')
  async getDatabaseStats(
    @Query('environment') environment = 'production',
  ) {
    try {
      const stats = await this.databaseConfig.getDatabaseStats(environment);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Erreur getDatabaseStats:', error);
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 CONFIGURATION ANALYTICS
   */
  @Get('analytics')
  async getAnalyticsConfiguration(
    @Query('environment') environment = 'production',
  ) {
    try {
      const config = await this.analyticsConfig.getAnalyticsConfig(environment);
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error('Erreur getAnalyticsConfiguration:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la configuration analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/scripts')
  async getAnalyticsScripts(
    @Query('environment') environment = 'production',
  ) {
    try {
      const scripts = await this.analyticsConfig.generateAnalyticsScripts(environment);
      return {
        success: true,
        data: { scripts },
      };
    } catch (error) {
      this.logger.error('Erreur getAnalyticsScripts:', error);
      throw new HttpException(
        'Erreur lors de la génération des scripts analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('analytics/validate')
  async validateAnalyticsConfiguration(
    @Query('environment') environment = 'production',
  ) {
    try {
      const validation = await this.analyticsConfig.validateAnalyticsConfig(environment);
      return {
        success: true,
        data: validation,
      };
    } catch (error) {
      this.logger.error('Erreur validateAnalyticsConfiguration:', error);
      throw new HttpException(
        'Erreur lors de la validation analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📧 CONFIGURATION EMAIL
   */
  @Get('email')
  async getEmailConfiguration(
    @Query('environment') environment = 'production',
  ) {
    try {
      const config = await this.emailConfig.getEmailConfig(environment);
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error('Erreur getEmailConfiguration:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la configuration email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('email/test')
  async testEmailConnection(
    @Body('provider') provider?: string,
    @Query('environment') environment = 'production',
  ) {
    try {
      const result = await this.emailConfig.testEmailConnection(provider, environment);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Erreur testEmailConnection:', error);
      throw new HttpException(
        'Erreur lors du test email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('email/validate')
  async validateEmailConfiguration(
    @Query('environment') environment = 'production',
  ) {
    try {
      const validation = await this.emailConfig.validateEmailConfig(environment);
      return {
        success: true,
        data: validation,
      };
    } catch (error) {
      this.logger.error('Erreur validateEmailConfiguration:', error);
      throw new HttpException(
        'Erreur lors de la validation email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔒 CONFIGURATION SÉCURITÉ
   */
  @Get('security')
  async getSecurityConfiguration(
    @Query('environment') environment = 'production',
  ) {
    try {
      const config = await this.securityConfig.getSecurityConfig(environment);
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error('Erreur getSecurityConfiguration:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la configuration sécurité',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('security/validate')
  async validateSecurityConfiguration(
    @Query('environment') environment = 'production',
  ) {
    try {
      const validation = await this.securityConfig.validateSecurityConfig(environment);
      return {
        success: true,
        data: validation,
      };
    } catch (error) {
      this.logger.error('Erreur validateSecurityConfiguration:', error);
      throw new HttpException(
        'Erreur lors de la validation sécurité',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔧 ACTIONS SYSTÈME GLOBALES
   */
  @Post('initialize')
  async initializeSystemConfigurations(
    @Query('environment') environment = 'production',
    @Req() req: Request,
  ) {
    try {
      const userId = (req.user as any)?.id || 'anonymous';
      const userEmail = (req.user as any)?.email || '';

      // Initialiser toutes les configurations par défaut
      await Promise.all([
        this.databaseConfig.initializeDefaultDatabaseConfigs(environment, userEmail),
        this.analyticsConfig.initializeDefaultAnalyticsConfigs(environment, userEmail),
        this.emailConfig.initializeDefaultEmailConfigs(environment, userEmail),
        this.securityConfig.initializeDefaultSecurityConfigs(environment, userEmail),
      ]);

      // Audit log
      await this.enhancedConfig.logAudit({
        action: 'system.initialize',
        resource: 'system-configuration',
        userId,
        userEmail,
        details: { environment },
        ipAddress: req.ip || '',
        userAgent: req.get('User-Agent') || '',
      });

      return {
        success: true,
        message: 'Configurations système initialisées avec succès',
        data: { environment },
      };
    } catch (error) {
      this.logger.error('Erreur initializeSystemConfigurations:', error);
      throw new HttpException(
        'Erreur lors de l\'initialisation du système',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('validate-all')
  async validateAllConfigurations(
    @Query('environment') environment = 'production',
  ) {
    try {
      const [
        databaseStats,
        analyticsValidation,
        emailValidation,
        securityValidation
      ] = await Promise.all([
        this.databaseConfig.getDatabaseStats(environment),
        this.analyticsConfig.validateAnalyticsConfig(environment),
        this.emailConfig.validateEmailConfig(environment),
        this.securityConfig.validateSecurityConfig(environment),
      ]);

      const overallValid = 
        databaseStats.healthCheck?.status === 'healthy' &&
        analyticsValidation.valid &&
        emailValidation.valid &&
        securityValidation.valid;

      const allErrors = [
        ...(databaseStats.error ? [`Database: ${databaseStats.error}`] : []),
        ...analyticsValidation.errors,
        ...emailValidation.errors,
        ...securityValidation.errors,
      ];

      const allWarnings = [
        ...analyticsValidation.warnings,
        ...emailValidation.warnings,
        ...securityValidation.warnings,
      ];

      return {
        success: true,
        data: {
          valid: overallValid,
          environment,
          modules: {
            database: {
              valid: databaseStats.healthCheck?.status === 'healthy',
              details: databaseStats,
            },
            analytics: {
              valid: analyticsValidation.valid,
              details: analyticsValidation,
            },
            email: {
              valid: emailValidation.valid,
              details: emailValidation,
            },
            security: {
              valid: securityValidation.valid,
              details: securityValidation,
            },
          },
          summary: {
            totalErrors: allErrors.length,
            totalWarnings: allWarnings.length,
            errors: allErrors,
            warnings: allWarnings,
          },
        },
      };
    } catch (error) {
      this.logger.error('Erreur validateAllConfigurations:', error);
      throw new HttpException(
        'Erreur lors de la validation globale',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📈 MONITORING ET SANTÉ
   */
  @Get('health')
  async getSystemHealth(
    @Query('environment') environment = 'production',
  ) {
    try {
      const [
        databaseTest,
        analyticsValidation,
        emailValidation,
        securityValidation
      ] = await Promise.all([
        this.databaseConfig.testDatabaseConnection(environment),
        this.analyticsConfig.validateAnalyticsConfig(environment),
        this.emailConfig.validateEmailConfig(environment),
        this.securityConfig.validateSecurityConfig(environment),
      ]);

      const health = {
        timestamp: new Date().toISOString(),
        environment,
        overall: 'healthy',
        modules: {
          database: {
            status: databaseTest.success ? 'healthy' : 'error',
            responseTime: databaseTest.responseTime,
            message: databaseTest.message,
          },
          analytics: {
            status: analyticsValidation.valid ? 'healthy' : 'error',
            providersCount: analyticsValidation.summary?.enabledProvidersCount || 0,
            errors: analyticsValidation.errors.length,
          },
          email: {
            status: emailValidation.valid ? 'healthy' : 'error',
            providersCount: emailValidation.summary?.enabledProvidersCount || 0,
            errors: emailValidation.errors.length,
          },
          security: {
            status: securityValidation.valid ? 'healthy' : 'error',
            score: securityValidation.securityScore || 0,
            errors: securityValidation.errors.length,
          },
        },
      };

      // Calculer le statut global
      const allStatuses = Object.values(health.modules).map(m => m.status);
      if (allStatuses.includes('error')) {
        health.overall = 'error';
      } else if (allStatuses.includes('warning')) {
        health.overall = 'warning';
      }

      return {
        success: true,
        data: health,
      };
    } catch (error) {
      this.logger.error('Erreur getSystemHealth:', error);
      return {
        success: false,
        data: {
          timestamp: new Date().toISOString(),
          environment,
          overall: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * 🛠️ UTILITAIRES PRIVÉS
   */
  private calculateOverallHealth(statuses: (string | undefined)[]): 'healthy' | 'warning' | 'error' {
    const validStatuses = statuses.filter(s => s) as string[];
    
    if (validStatuses.includes('error')) {
      return 'error';
    }
    if (validStatuses.includes('warning')) {
      return 'warning';
    }
    return 'healthy';
  }

  private mapHealthStatus(status?: string): 'healthy' | 'warning' | 'error' {
    switch (status) {
      case 'healthy':
        return 'healthy';
      case 'warning':
        return 'warning';
      case 'error':
      case 'unhealthy':
        return 'error';
      default:
        return 'error';
    }
  }
}
