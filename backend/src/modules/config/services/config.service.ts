/**
 * 🔧 CONFIG SERVICE - Service Principal de Configuration Avancé
 * 
 * Service centralisé unifiant configuration environnement + base de données
 * Intègre les meilleures pratiques : cache, sécurité, validation, monitoring
 */

import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigModuleOptions, FullConfigSchema, ConfigEnvironment } from '../interfaces/config.interfaces';
import { ConfigCacheService } from './config-cache.service';
import { ConfigValidationService } from './config-validation.service';
import { ConfigSecurityService } from './config-security.service';
import { ConfigMonitoringService } from './config-monitoring.service';
import { ConfigValidator } from '../validators/config.validator';
import { getAppConfig } from '../../../config/app.config';
import { z } from 'zod';
import * as crypto from 'crypto';

// 📋 Schémas de validation Zod améliorés
const ConfigValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.any()),
  z.record(z.any()),
  z.null(),
]);

const ConfigSetSchema = z.object({
  key: z.string().min(1, 'La clé ne peut pas être vide'),
  value: ConfigValueSchema,
  type: z.enum(['string', 'number', 'boolean', 'json', 'array']).optional(),
  category: z.string().default('general'),
  isSensitive: z.boolean().default(false),
  description: z.string().optional(),
});

export interface ConfigValue {
  key: string;
  value: any;
  type: string;
  category: string;
  description?: string;
  isSensitive?: boolean;
  requiresRestart?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
}

@Injectable()
export class ConfigService extends SupabaseBaseService implements OnModuleInit {
  protected readonly logger = new Logger(ConfigService.name);
  private configCache = new Map<string, any>();
  private encryptionKey: string;
  protected readonly tableName = '___config';

  constructor(
    private readonly nestConfigService: NestConfigService,
    private readonly cacheService: ConfigCacheService,
    private readonly validationService: ConfigValidationService,
    private readonly securityService: ConfigSecurityService,
    private readonly monitoringService: ConfigMonitoringService,
    private readonly validator: ConfigValidator,
    @Inject('CONFIG_OPTIONS') private readonly options: ConfigModuleOptions,
    @Inject('CONFIG_ENVIRONMENT') private readonly environment: ConfigEnvironment,
  ) {
    super();
    this.encryptionKey = process.env.CONFIG_ENCRYPTION_KEY || 'default-key';
  }

  async onModuleInit() {
    this.logger.log(`🔧 ConfigService initialisé pour l'environnement: ${this.environment}`);
    
    // Charger les configurations depuis ___config
    await this.loadAllConfigs();
    
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
   * Définit une valeur de configuration avec validation Zod
   */
  async set<T = any>(key: string, value: T, persistent = false): Promise<void> {
    try {
      // 🔍 Validation Zod améliorée
      const validationResult = this.validateConfigWithZod(key, value);
      if (!validationResult.success) {
        throw new Error(`Validation échouée pour '${key}': ${validationResult.errors.join(', ')}`);
      }

      // Valider la valeur si activé
      if (this.options.validationEnabled) {
        // Utilisation du service de validation existant
        const configValidator = new ConfigValidator();
        const isValid = configValidator.validateConfigValue(key, value);
        if (!isValid) {
          throw new Error(`Valeur invalide pour la clé '${key}'`);
        }
      }

      // Chiffrer si nécessaire
      let finalValue = value;
      if (this.shouldEncrypt(key) && this.options.securityEnabled) {
        // Conversion sécurisée pour le chiffrement
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        const encrypted = await this.securityService.encrypt(stringValue);
        finalValue = encrypted as T;
      }

      // Mettre à jour le cache local
      this.configCache.set(key, finalValue);

      // Mettre à jour le cache distribué
      if (this.options.cacheEnabled) {
        await this.cacheService.set(key, finalValue, this.options.cacheTTL);
      }

      // Persister en base si demandé
      if (persistent) {
        await this.persistConfig(key, finalValue, {
          type: this.inferType(value),
          category: this.inferCategory(key),
          isSensitive: this.shouldEncrypt(key),
        });
      }

      // Logger le changement si monitoring activé
      if (this.options.monitoringEnabled) {
        await this.trackConfigChange(key, value, finalValue);
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
      this.logger.error("Erreur lors de l'invalidation du cache:", error);
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

  getEnvironmentInfo(): any {
    return {
      nodeEnv: this.nestConfigService.get<string>('NODE_ENV'),
      port: this.nestConfigService.get<number>('PORT'),
      supabaseUrl: this.nestConfigService.get<string>('SUPABASE_URL') ? '[CONFIGURED]' : '[NOT SET]',
      supabaseServiceKey: this.nestConfigService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ? '[CONFIGURED]' : '[NOT SET]',
      redisUrl: this.nestConfigService.get<string>('REDIS_URL') ? '[CONFIGURED]' : '[NOT SET]',
      jwtSecret: this.nestConfigService.get<string>('JWT_SECRET') ? '[CONFIGURED]' : '[NOT SET]',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Charge toutes les configurations depuis ___config au démarrage
   */
  async loadAllConfigs(): Promise<void> {
    try {
      const { data: configs, error } = await this.client
        .from(this.tableName)
        .select('*');

      if (error) {
        this.logger.error('Erreur lors du chargement des configurations', error);
        return;
      }

      let loadedCount = 0;
      for (const config of configs || []) {
        try {
          // Pour ___config, config_value est déjà en JSON
          const value = typeof config.config_value === 'string' 
            ? JSON.parse(config.config_value)
            : config.config_value;
          
          this.configCache.set(config.config_key, value);
          await this.cacheService.set(`config:${config.config_key}`, value, 3600);
          loadedCount++;
        } catch (parseError) {
          this.logger.warn(`Erreur lors du parsing de ${config.config_key}:`, parseError);
          // Stocker la valeur brute en cas d'erreur de parsing
          this.configCache.set(config.config_key, config.config_value);
        }
      }

      this.logger.log(`✅ Chargé ${loadedCount} configurations depuis ___config`);
    } catch (error) {
      this.logger.error('Échec du chargement des configurations:', error);
    }
  }

  /**
   * Récupère une configuration avec cache intelligent
   */
  async getConfig<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      // 1. Vérifier le cache local
      if (this.configCache.has(key)) {
        return this.configCache.get(key) as T;
      }

      // 2. Vérifier le cache Redis
      const cached = await this.cacheService.get(`config:${key}`);
      if (cached) {
        this.configCache.set(key, cached);
        return cached as T;
      }

      // 3. Charger depuis la base de données (___config)
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('config_key', key)
        .single();

      if (error || !data) {
        return defaultValue as T;
      }

      // Traiter la valeur
      const value = typeof data.config_value === 'string' 
        ? JSON.parse(data.config_value)
        : data.config_value;

      // Mettre en cache
      this.configCache.set(key, value);
      await this.cacheService.set(`config:${key}`, value, 3600);

      return value as T;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de ${key}:`, error);
      return defaultValue as T;
    }
  }

  /**
   * Définit une configuration (compatible avec ___config)
   */
  async setConfig(key: string, value: any, description?: string): Promise<void> {
    try {
      // Préparer la valeur pour stockage
      const configValue = typeof value === 'object' 
        ? JSON.stringify(value)
        : String(value);

      // Tenter de mettre à jour d'abord
      const { data: updateResult, error: updateError } = await this.client
        .from(this.tableName)
        .update({
          config_value: configValue,
          description: description,
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', key)
        .select();

      // Si pas de résultat, créer une nouvelle entrée
      if (!updateResult || updateResult.length === 0) {
        const { error: insertError } = await this.client
          .from(this.tableName)
          .insert({
            config_key: key,
            config_value: configValue,
            description: description || `Configuration pour ${key}`,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          throw insertError;
        }
      } else if (updateError) {
        throw updateError;
      }

      // Invalider le cache
      this.configCache.delete(key);
      await this.cacheService.delete(`config:${key}`);

      this.logger.log(`✅ Configuration ${key} mise à jour`);
    } catch (error) {
      this.logger.error(`Erreur lors de la définition de ${key}:`, error);
      throw error;
    }
  }

  /**
   * Récupère toutes les configurations d'une catégorie (basé sur le préfixe de clé)
   */
  async getByCategory(category: string): Promise<ConfigValue[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .ilike('config_key', `${category}.%`)
        .order('config_key');

      if (error) {
        throw error;
      }

      return (data || []).map(config => ({
        key: config.config_key,
        value: typeof config.config_value === 'string' 
          ? JSON.parse(config.config_value)
          : config.config_value,
        type: this.detectType(config.config_value),
        category: category,
        description: config.description,
        createdAt: config.created_at ? new Date(config.created_at) : undefined,
        updatedAt: config.updated_at ? new Date(config.updated_at) : undefined,
      }));
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de la catégorie ${category}:`, error);
      return [];
    }
  }

  /**
   * Sauvegarde de la configuration (backup simple en cache)
   */
  async backup(description?: string): Promise<string> {
    try {
      const { data: configs } = await this.client
        .from(this.tableName)
        .select('*');

      const backup = {
        timestamp: new Date().toISOString(),
        description: description || 'Sauvegarde automatique',
        configs: configs || [],
      };

      const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.cacheService.set(`backup:${backupId}`, backup, 86400); // 24h

      this.logger.log(`✅ Backup créé: ${backupId}`);
      return backupId;
    } catch (error) {
      this.logger.error('Erreur lors du backup:', error);
      throw error;
    }
  }

  /**
   * Détecte le type d'une valeur
   */
  private detectType(value: any): string {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'boolean') return 'boolean';
        if (typeof parsed === 'number') return 'number';
        if (Array.isArray(parsed)) return 'array';
        if (typeof parsed === 'object') return 'object';
      } catch {
        return 'string';
      }
    }
    return typeof value;
  }

  /**
   * 🔍 Validation Zod pour les configurations
   */
  private validateConfigWithZod(key: string, value: any): { success: boolean; errors: string[] } {
    try {
      // Validation basique de la clé
      z.string().min(1).parse(key);
      
      // Validation de la valeur selon ConfigValueSchema
      ConfigValueSchema.parse(value);
      
      return { success: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
        };
      }
      return { 
        success: false, 
        errors: [(error as Error).message || 'Erreur de validation inconnue'],
      };
    }
  }

  /**
   * 🎯 Inférer le type d'une valeur
   */
  private inferType(value: any): string {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'json';
    return 'string';
  }

  /**
   * 📂 Inférer la catégorie d'une clé
   */
  private inferCategory(key: string): string {
    if (key.startsWith('database.')) return 'database';
    if (key.startsWith('email.')) return 'email';
    if (key.startsWith('auth.')) return 'auth';
    if (key.startsWith('ui.')) return 'ui';
    if (key.startsWith('cache.')) return 'cache';
    if (key.startsWith('security.')) return 'security';
    return 'general';
  }

  /**
   * 💾 Persister une configuration en base
   */
  private async persistConfig(key: string, value: any, options: {
    type: string;
    category: string;
    isSensitive: boolean;
  }): Promise<void> {
    try {
      // Préparer la valeur pour stockage
      let storedValue = value;
      if (typeof value === 'object' && value !== null) {
        storedValue = JSON.stringify(value);
      }

      const { error } = await this.supabase
        .from('___config')
        .upsert({
          config_key: key,
          config_value: storedValue,
          config_type: options.type,
          category: options.category,
          is_sensitive: options.isSensitive,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      this.logger.debug(`Configuration '${key}' persistée en base`);
    } catch (error) {
      this.logger.error(`Erreur persistance '${key}':`, error);
      throw error;
    }
  }

  /**
   * 📊 Tracker les changements de configuration
   */
  private async trackConfigChange(key: string, oldValue: any, newValue: any): Promise<void> {
    try {
      // Log simple pour le tracking
      this.logger.log(`🔄 Config '${key}' changed`, {
        key,
        oldValue: typeof oldValue,
        newValue: typeof newValue,
        timestamp: new Date().toISOString(),
      });

      // Si un service de monitoring avancé est disponible, l'utiliser
      if (this.options.monitoringEnabled) {
        // Tracking basique intégré
        const trackingData = {
          config_key: key,
          action: 'update',
          old_value: typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue),
          new_value: typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue),
          timestamp: new Date().toISOString(),
        };

        // Tentative d'insertion dans une table de tracking (optionnel)
        try {
          await this.supabase
            .from('config_tracking')
            .insert(trackingData);
        } catch (error) {
          // Le tracking ne doit pas faire échouer l'opération principale
          this.logger.debug('Tracking table non disponible');
        }
      }
    } catch (error) {
      // Le tracking ne doit jamais faire échouer l'opération principale
      this.logger.debug(`Erreur tracking pour '${key}':`, error);
    }
  }
}
