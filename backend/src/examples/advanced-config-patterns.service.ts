import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnhancedConfigService } from '../modules/config/services/enhanced-config.service';
import { ConfigAnalyticsService } from '../modules/config/services/config-analytics.service';
import { ConfigValidationService } from '../modules/config/services/config-validation.service';
import { ConfigType } from '../modules/config/schemas/config.schemas';

@Injectable()
export class AdvancedConfigPatternsService implements OnModuleInit {
  private readonly logger = new Logger(AdvancedConfigPatternsService.name);

  constructor(
    private readonly configService: EnhancedConfigService,
    private readonly analyticsService: ConfigAnalyticsService,
    private readonly validationService: ConfigValidationService,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultConfigs();
    await this.setupConfigWatchers();
  }

  /**
   * 🚀 Pattern 1: Initialisation automatique des configurations par défaut
   */
  private async initializeDefaultConfigs() {
    const defaultConfigs = [
      {
        key: 'app.maintenance_mode',
        value: false,
        type: ConfigType.BOOLEAN,
        description: "Mode maintenance de l'application",
        category: 'system',
        isPublic: true,
      },
      {
        key: 'features.new_dashboard',
        value: true,
        type: ConfigType.BOOLEAN,
        description: 'Activer le nouveau tableau de bord',
        category: 'features',
        isPublic: false,
      },
      {
        key: 'api.rate_limit',
        value: 1000,
        type: ConfigType.NUMBER,
        description: 'Limite de requêtes par heure',
        category: 'api',
        isPublic: false,
      },
      {
        key: 'ui.theme_config',
        value: {
          primaryColor: '#3B82F6',
          secondaryColor: '#10B981',
          darkMode: true,
          animations: true,
        },
        type: ConfigType.JSON,
        description: "Configuration du thème de l'interface",
        category: 'ui',
        isPublic: true,
      },
    ];

    for (const config of defaultConfigs) {
      try {
        const existing = await this.configService.get(config.key, null);
        if (!existing) {
          await this.configService.create(config);
          this.logger.log(`✅ Configuration par défaut créée: ${config.key}`);
        }
      } catch (error) {
        this.logger.warn(
          `⚠️ Erreur lors de l'initialisation de ${config.key}:`,
          error.message,
        );
      }
    }
  }

  /**
   * 🔍 Pattern 2: Configuration avec validation en temps réel
   */
  async updateConfigWithValidation(key: string, value: any, userId?: string) {
    try {
      // Validation personnalisée selon la clé
      await this.validateConfigByKey(key, value);

      // Mettre à jour la configuration
      const updatedConfig = await this.configService.update(key, { value });

      // Tracker l'événement avec validation réussie
      await this.analyticsService.trackConfigEvent({
        type: 'config_change',
        category: 'validated_update',
        action: 'config_updated',
        label: key,
        userId,
        metadata: {
          configKey: key,
          newValue: value,
          validationPassed: true,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log(`✅ Configuration ${key} mise à jour avec validation`);
      return updatedConfig;
    } catch (error) {
      // Tracker l'échec de validation
      await this.analyticsService.trackConfigEvent({
        type: 'config_change',
        category: 'validation_error',
        action: 'validation_failed',
        label: key,
        userId,
        metadata: {
          configKey: key,
          attemptedValue: value,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      });

      throw error;
    }
  }

  /**
   * 🎯 Pattern 3: Configuration conditionnelle par environnement
   */
  async getEnvironmentSpecificConfig(key: string, defaultValue?: any) {
    const env = process.env.NODE_ENV || 'development';
    const envKey = `${key}.${env}`;

    // Essayer d'abord la configuration spécifique à l'environnement
    let value = await this.configService.get(envKey, null);

    if (value === null) {
      // Fallback vers la configuration générale
      value = await this.configService.get(key, defaultValue);
    }

    // Tracker l'accès avec information d'environnement
    await this.analyticsService.trackConfigEvent({
      type: 'config_access',
      category: 'environment_specific',
      action: 'config_retrieved',
      label: key,
      metadata: {
        environment: env,
        usedEnvSpecific: value !== null,
        configKey: envKey,
        fallbackKey: key,
      },
    });

    return value;
  }

  /**
   * 🔄 Pattern 4: Configuration avec cache intelligent et TTL dynamique
   */
  async getConfigWithDynamicCache(key: string, defaultValue?: any) {
    // TTL dynamique basé sur la criticité de la configuration
    const criticalConfigs = ['app.maintenance_mode', 'api.rate_limit'];
    const cacheTTL = criticalConfigs.includes(key) ? 300 : 3600; // 5 min vs 1h

    const value = await this.configService.get(key, defaultValue, cacheTTL);

    // Tracker l'utilisation du cache dynamique
    await this.analyticsService.trackConfigEvent({
      type: 'config_access',
      category: 'dynamic_cache',
      action: 'cache_access',
      label: key,
      metadata: {
        configKey: key,
        cacheTTL,
        isCritical: criticalConfigs.includes(key),
      },
    });

    return value;
  }

  /**
   * 📊 Pattern 5: Monitoring et alertes automatiques
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async monitorCriticalConfigs() {
    const criticalConfigs = [
      { key: 'app.maintenance_mode', expectedType: 'boolean' },
      { key: 'api.rate_limit', expectedType: 'number', min: 100, max: 10000 },
      { key: 'features.new_dashboard', expectedType: 'boolean' },
    ];

    for (const config of criticalConfigs) {
      try {
        const value = await this.configService.get(config.key);

        // Vérifier le type
        if (typeof value !== config.expectedType) {
          await this.sendConfigAlert(
            config.key,
            `Type incorrect: attendu ${config.expectedType}, reçu ${typeof value}`,
            'type_mismatch',
          );
        }

        // Vérifier les limites pour les nombres
        if (config.expectedType === 'number' && typeof value === 'number') {
          if (config.min && value < config.min) {
            await this.sendConfigAlert(
              config.key,
              `Valeur trop basse: ${value} < ${config.min}`,
              'value_too_low',
            );
          }
          if (config.max && value > config.max) {
            await this.sendConfigAlert(
              config.key,
              `Valeur trop élevée: ${value} > ${config.max}`,
              'value_too_high',
            );
          }
        }

        // Tracker le monitoring
        await this.analyticsService.trackConfigEvent({
          type: 'config_access',
          category: 'monitoring',
          action: 'health_check',
          label: config.key,
          metadata: {
            configKey: config.key,
            value,
            expectedType: config.expectedType,
            isHealthy: true,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        await this.sendConfigAlert(
          config.key,
          `Erreur de récupération: ${error.message}`,
          'retrieval_error',
        );
      }
    }
  }

  /**
   * 🔔 Pattern 6: Système d'alertes pour configurations
   */
  private async sendConfigAlert(
    key: string,
    message: string,
    alertType: string,
  ) {
    this.logger.error(`🚨 ALERTE CONFIG [${alertType}]: ${key} - ${message}`);

    // Tracker l'alerte
    await this.analyticsService.trackConfigEvent({
      type: 'config_access',
      category: 'alert',
      action: 'config_alert',
      label: key,
      metadata: {
        configKey: key,
        alertType,
        message,
        severity: 'high',
        timestamp: new Date().toISOString(),
      },
    });

    // Ici vous pourriez intégrer avec votre système d'alertes
    // (Slack, email, SMS, etc.)
  }

  /**
   * 🛡️ Pattern 7: Configuration avec rollback automatique
   */
  async updateConfigWithRollback(
    key: string,
    newValue: any,
    userId?: string,
    rollbackDelay = 300000, // 5 minutes
  ) {
    // Sauvegarder la valeur actuelle
    const currentValue = await this.configService.get(key);

    try {
      // Mettre à jour la configuration
      await this.configService.update(key, { value: newValue });

      this.logger.log(
        `✅ Configuration ${key} mise à jour, rollback programmé dans ${rollbackDelay}ms`,
      );

      // Programmer le rollback automatique
      setTimeout(async () => {
        try {
          const currentVal = await this.configService.get(key);

          // Vérifier si la valeur n'a pas été modifiée entre temps
          if (JSON.stringify(currentVal) === JSON.stringify(newValue)) {
            await this.configService.update(key, { value: currentValue });

            this.logger.warn(`🔄 Rollback automatique effectué pour ${key}`);

            await this.analyticsService.trackConfigEvent({
              type: 'config_change',
              category: 'auto_rollback',
              action: 'rollback_executed',
              label: key,
              userId,
              metadata: {
                configKey: key,
                rolledBackFrom: newValue,
                rolledBackTo: currentValue,
                reason: 'automatic_timeout',
              },
            });
          }
        } catch (error) {
          this.logger.error(
            `❌ Erreur lors du rollback automatique pour ${key}:`,
            error,
          );
        }
      }, rollbackDelay);

      return { success: true, rollbackScheduled: true };
    } catch (error) {
      this.logger.error(`❌ Erreur lors de la mise à jour de ${key}:`, error);
      throw error;
    }
  }

  /**
   * 🔍 Validation personnalisée par clé
   */
  private async validateConfigByKey(key: string, value: any) {
    switch (key) {
      case 'api.rate_limit':
        if (typeof value !== 'number' || value < 100 || value > 10000) {
          throw new Error('Rate limit doit être un nombre entre 100 et 10000');
        }
        break;

      case 'ui.theme_config':
        const themeValidation = this.validationService.validateConfigValue(
          value,
          // Schéma Zod pour thème
          require('zod').z.object({
            primaryColor: require('zod')
              .z.string()
              .regex(/^#[0-9A-F]{6}$/i),
            secondaryColor: require('zod')
              .z.string()
              .regex(/^#[0-9A-F]{6}$/i),
            darkMode: require('zod').z.boolean(),
            animations: require('zod').z.boolean(),
          }),
        );

        if (!themeValidation.isValid) {
          throw new Error(
            `Configuration thème invalide: ${themeValidation.errors.join(', ')}`,
          );
        }
        break;
    }
  }

  /**
   * 📈 Pattern 8: Métriques et rapports automatiques
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyConfigReport() {
    try {
      const metrics = await this.analyticsService.getConfigMetrics('day');

      const report = {
        date: new Date().toISOString().split('T')[0],
        totalEvents: metrics.totalEvents,
        configAccess: metrics.configAccess,
        configChanges: metrics.configChanges,
        uniqueUsers: metrics.uniqueUsers,
        topConfigs: await this.getTopAccessedConfigs(),
        healthStatus: await this.getConfigHealthStatus(),
      };

      this.logger.log(
        '📊 Rapport quotidien des configurations:',
        JSON.stringify(report, null, 2),
      );

      // Sauvegarder le rapport
      await this.configService.create({
        key: `reports.daily_config_${report.date}`,
        value: report,
        type: ConfigType.JSON,
        description: `Rapport quotidien des configurations du ${report.date}`,
        category: 'reports',
        isPublic: false,
      });
    } catch (error) {
      this.logger.error(
        '❌ Erreur lors de la génération du rapport quotidien:',
        error,
      );
    }
  }

  /**
   * 🔧 Watchers de configuration en temps réel
   */
  private async setupConfigWatchers() {
    // Watcher pour le mode maintenance
    setInterval(async () => {
      const maintenanceMode = await this.configService.get(
        'app.maintenance_mode',
        false,
      );
      if (maintenanceMode) {
        this.logger.warn('⚠️ Application en mode maintenance');
      }
    }, 30000); // Vérifier toutes les 30 secondes

    this.logger.log('👁️ Watchers de configuration initialisés');
  }

  private async getTopAccessedConfigs() {
    // Logique pour récupérer les configs les plus accédées
    return [
      'app.maintenance_mode',
      'features.new_dashboard',
      'ui.theme_config',
    ];
  }

  private async getConfigHealthStatus() {
    // Logique pour évaluer la santé des configurations
    return 'healthy';
  }
}
