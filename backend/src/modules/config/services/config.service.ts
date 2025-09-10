/**
 * 🔧 CONFIG SERVICE - Service Principal de Configuration
 * 
 * Service centralisé pour la gestion des configurations applicatives
 * Cohérent avec l'architecture des autres services du projet
 */

import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ConfigModuleOptions, FullConfigSchema, ConfigEnvironment } from '../interfaces/config.interfaces';
import { ConfigCacheService } from './config-cache.service';
import { ConfigValidationService } from './config-validation.service';
import { ConfigSecurityService } from './config-security.service';
import { ConfigMonitoringService } from './config-monitoring.service';
import { getAppConfig } from '../../../config/app.config';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private configCache = new Map<string, any>();

  constructor(
    private readonly nestConfigService: NestConfigService,
    private readonly cacheService: ConfigCacheService,
    private readonly validationService: ConfigValidationService,
    private readonly securityService: ConfigSecurityService,
    private readonly monitoringService: ConfigMonitoringService,
    @Inject('CONFIG_OPTIONS') private readonly options: ConfigModuleOptions,
    @Inject('CONFIG_ENVIRONMENT') private readonly environment: ConfigEnvironment,
  ) {}

  async onModuleInit() {
    this.logger.log(`🔧 ConfigService initialisé pour l'environnement: ${this.environment}`);
    
    // Charger les configurations par défaut
    await this.loadDefaultConfigurations();
    
    // Valider les configurations critiques
    if (this.options.validationEnabled) {
      await this.validateCriticalConfigurations();
    }
    
    // Démarrer le monitoring si activé
    if (this.options.monitoringEnabled) {
      await this.monitoringService.startMonitoring();
    }
  }

  /**
   * Récupère une valeur de configuration
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      // Vérifier le cache local d'abord
      if (this.configCache.has(key)) {
        return this.configCache.get(key);
      }

      // Vérifier le cache distribué si activé
      if (this.options.cacheEnabled) {
        const cached = await this.cacheService.get<T>(key);
        if (cached !== null) {
          this.configCache.set(key, cached);
          return cached;
        }
      }

      // Récupérer depuis NestJS Config
      let value = this.nestConfigService.get<T>(key, defaultValue);

      // Si pas trouvé, essayer la config centralisée
      if (value === undefined || value === null) {
        const appConfig = getAppConfig();
        value = this.getNestedValue(appConfig, key) || defaultValue;
      }

      // Mettre en cache si trouvé
      if (value !== undefined && value !== null) {
        this.configCache.set(key, value);
        
        if (this.options.cacheEnabled) {
          await this.cacheService.set(key, value, this.options.cacheTTL);
        }
      }

      return value;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de la config '${key}':`, error);
      return defaultValue;
    }
  }

  /**
   * Définit une valeur de configuration
   */
  async set<T = any>(key: string, value: T, persistent = false): Promise<void> {
    try {
      // Valider la valeur si activé
      if (this.options.validationEnabled) {
        const isValid = await this.validationService.validateValue(key, value);
        if (!isValid) {
          throw new Error(`Valeur invalide pour la clé '${key}'`);
        }
      }

      // Chiffrer si nécessaire
      let finalValue = value;
      if (this.shouldEncrypt(key) && this.options.securityEnabled) {
        finalValue = await this.securityService.encrypt(value) as T;
      }

      // Mettre à jour le cache local
      this.configCache.set(key, finalValue);

      // Mettre à jour le cache distribué
      if (this.options.cacheEnabled) {
        await this.cacheService.set(key, finalValue, this.options.cacheTTL);
      }

      // Persister en base si demandé
      if (persistent) {
        // TODO: Implémenter la persistance via DatabaseConfigService
      }

      // Logger le changement si monitoring activé
      if (this.options.monitoringEnabled) {
        await this.monitoringService.logConfigChange(key, value, finalValue);
      }

      this.logger.debug(`Configuration '${key}' mise à jour`);
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour de la config '${key}':`, error);
      throw error;
    }
  }

  /**
   * Supprime une configuration
   */
  async delete(key: string): Promise<void> {
    try {
      // Supprimer du cache local
      this.configCache.delete(key);

      // Supprimer du cache distribué
      if (this.options.cacheEnabled) {
        await this.cacheService.delete(key);
      }

      // Logger la suppression
      if (this.options.monitoringEnabled) {
        await this.monitoringService.logConfigDeletion(key);
      }

      this.logger.debug(`Configuration '${key}' supprimée`);
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression de la config '${key}':`, error);
      throw error;
    }
  }

  /**
   * Récupère toutes les configurations
   */
  async getAll(): Promise<FullConfigSchema> {
    try {
      const appConfig = getAppConfig();
      
      const config: FullConfigSchema = {
        app: {
          name: await this.get('APP_NAME', 'NestJS Remix Monorepo'),
          version: await this.get('APP_VERSION', '1.0.0'),
          port: await this.get('PORT', appConfig.app.port),
          host: await this.get('HOST', '0.0.0.0'),
          environment: this.environment,
          debug: await this.get('DEBUG', this.environment === 'development'),
          corsEnabled: await this.get('CORS_ENABLED', true),
          allowedOrigins: await this.get('ALLOWED_ORIGINS', ['http://localhost:3000']),
        },
        database: {
          url: await this.get('SUPABASE_URL', appConfig.supabase.url),
          serviceKey: await this.get('SUPABASE_SERVICE_ROLE_KEY', appConfig.supabase.serviceKey),
          poolSize: await this.get('DATABASE_POOL_SIZE', 10),
          timeout: await this.get('DATABASE_TIMEOUT', 30000),
          ssl: await this.get('DATABASE_SSL', true),
        },
        cache: {
          type: await this.get('CACHE_TYPE', 'redis'),
          url: await this.get('REDIS_URL', appConfig.redis.url),
          host: await this.get('REDIS_HOST', appConfig.redis.host),
          port: await this.get('REDIS_PORT', appConfig.redis.port),
          defaultTTL: await this.get('CACHE_DEFAULT_TTL', 3600),
          maxSize: await this.get('CACHE_MAX_SIZE', 1000),
        },
        security: {
          encryptionKey: await this.get('CONFIG_ENCRYPTION_KEY', ''),
          algorithm: await this.get('ENCRYPTION_ALGORITHM', 'aes-256-gcm'),
          salt: await this.get('ENCRYPTION_SALT', ''),
          tokenLength: await this.get('TOKEN_LENGTH', 32),
        },
        monitoring: {
          enabled: this.options.monitoringEnabled || false,
          interval: await this.get('MONITORING_INTERVAL', 60000),
          verbose: await this.get('MONITORING_VERBOSE', false),
          alertOnError: await this.get('MONITORING_ALERT_ON_ERROR', true),
        },
        metadata: {
          defaultTitle: await this.get('DEFAULT_TITLE', 'NestJS Remix Monorepo'),
          defaultDescription: await this.get('DEFAULT_DESCRIPTION', 'Application moderne avec NestJS et Remix'),
          defaultKeywords: await this.get('DEFAULT_KEYWORDS', ['nestjs', 'remix', 'typescript']),
          author: await this.get('AUTHOR', 'Development Team'),
          defaultLanguage: await this.get('DEFAULT_LANGUAGE', 'fr'),
        },
        breadcrumb: {
          separator: await this.get('BREADCRUMB_SEPARATOR', ' > '),
          showHome: await this.get('BREADCRUMB_SHOW_HOME', true),
          homeText: await this.get('BREADCRUMB_HOME_TEXT', 'Accueil'),
          homeUrl: await this.get('BREADCRUMB_HOME_URL', '/'),
          maxItems: await this.get('BREADCRUMB_MAX_ITEMS', 5),
        },
      };

      return config;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de toutes les configurations:', error);
      throw error;
    }
  }

  /**
   * Invalide le cache
   */
  async invalidateCache(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        // Invalider selon le pattern
        for (const key of this.configCache.keys()) {
          if (key.includes(pattern)) {
            this.configCache.delete(key);
          }
        }
        
        if (this.options.cacheEnabled) {
          await this.cacheService.deletePattern(pattern);
        }
      } else {
        // Invalider tout le cache
        this.configCache.clear();
        
        if (this.options.cacheEnabled) {
          await this.cacheService.clear();
        }
      }

      this.logger.log(`Cache invalidé ${pattern ? `pour le pattern '${pattern}'` : 'entièrement'}`);
    } catch (error) {
      this.logger.error('Erreur lors de l\\'invalidation du cache:', error);
      throw error;
    }
  }

  /**
   * Recharge les configurations
   */
  async reload(): Promise<void> {
    try {
      await this.invalidateCache();
      await this.loadDefaultConfigurations();
      
      this.logger.log('Configurations rechargées avec succès');
    } catch (error) {
      this.logger.error('Erreur lors du rechargement des configurations:', error);
      throw error;
    }
  }

  /**
   * Méthodes privées
   */
  private async loadDefaultConfigurations(): Promise<void> {
    if (this.options.defaults) {
      for (const [key, value] of Object.entries(this.options.defaults)) {
        await this.set(key, value);
      }
    }
  }

  private async validateCriticalConfigurations(): Promise<void> {
    const criticalKeys = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    for (const key of criticalKeys) {
      const value = await this.get(key);
      if (!value) {
        throw new Error(`Configuration critique manquante: ${key}`);
      }
    }
  }

  private shouldEncrypt(key: string): boolean {
    const sensitiveKeys = [
      'password',
      'secret',
      'key',
      'token',
      'credential',
    ];

    return sensitiveKeys.some(sensitiveKey => 
      key.toLowerCase().includes(sensitiveKey)
    );
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}
