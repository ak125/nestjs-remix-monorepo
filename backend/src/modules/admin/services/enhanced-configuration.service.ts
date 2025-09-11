/**
 * 🔧 SERVICE CONFIGURATION AVANCÉ - Module Admin
 * 
 * Gestion centralisée des paramètres avec fonctionnalités enterprise :
 * - Historique des modifications
 * - Sauvegarde et restauration  
 * - Validation des valeurs
 * - Chiffrement des données sensibles
 * - Multi-environnement
 * - Audit trail
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import * as crypto from 'crypto';

export interface ConfigItem {
  id?: string;
  key: string;
  value: any;
  category: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array' | 'encrypted';
  description?: string;
  isSensitive?: boolean;
  requiresRestart?: boolean;
  isRequired?: boolean;
  defaultValue?: any;
  validationRules?: ConfigValidationRules;
  environment?: string;
  lastUpdated?: string;
  updatedBy?: string;
  version?: number;
  tags?: string[];
  isActive?: boolean;
}

export interface ConfigValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  allowedValues?: any[];
  customValidator?: string;
}

export interface ConfigHistory {
  id: string;
  configKey: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changeReason?: string;
  timestamp: string;
  environment: string;
  action: 'create' | 'update' | 'delete' | 'restore';
}

export interface ConfigBackup {
  id: string;
  name: string;
  description?: string;
  environment: string;
  configCount: number;
  createdBy: string;
  createdAt: string;
  size: number;
  checksum: string;
  configs: ConfigItem[];
}

export interface ConfigAudit {
  id: string;
  action: string;
  resource: string;
  userId: string;
  userEmail: string;
  timestamp: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class EnhancedConfigurationService extends SupabaseBaseService {
  protected readonly logger = new Logger(EnhancedConfigurationService.name);
  protected readonly tableName = '___config_enhanced';
  private readonly historyTableName = '___config_history';
  private readonly backupTableName = '___config_backup';
  private readonly auditTableName = '___config_audit';
  private readonly encryptionKey: string;
  private readonly cachePrefix = 'config:enhanced:';
  private readonly cacheTTL = 3600; // 1 heure

  constructor(private readonly cacheService: CacheService) {
    super();
    this.encryptionKey = process.env.CONFIG_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  }

  /**
   * 🔐 CHIFFREMENT ET SÉCURITÉ
   */
  private encrypt(value: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decrypt(encryptedValue: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private processValueForStorage(config: ConfigItem): any {
    if (config.isSensitive || config.type === 'encrypted') {
      return this.encrypt(String(config.value));
    }
    return config.value;
  }

  private processValueFromStorage(config: ConfigItem): any {
    if (config.isSensitive || config.type === 'encrypted') {
      try {
        return this.decrypt(config.value);
      } catch (error) {
        this.logger.warn(`Erreur déchiffrement pour ${config.key}:`, error);
        return config.value; // Retourner la valeur non déchiffrée en cas d'erreur
      }
    }
    return config.value;
  }

  /**
   * 📊 CONFIGURATION - CRUD AVANCÉ
   */
  async getAllConfigs(environment = 'production'): Promise<ConfigItem[]> {
    try {
      const cacheKey = `${this.cachePrefix}all:${environment}`;
      
      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Configurations récupérées du cache pour ${environment}`);
        return cached;
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('environment', environment)
        .eq('isActive', true)
        .order('category, key');

      if (error) {
        throw new Error(`Erreur récupération configurations: ${error.message}`);
      }

      // Déchiffrer les valeurs sensibles
      const configs = data.map(config => ({
        ...config,
        value: this.processValueFromStorage(config)
      }));

      // Mettre en cache
      await this.cacheService.set(cacheKey, configs, this.cacheTTL);

      this.logger.log(`${configs.length} configurations récupérées pour ${environment}`);
      return configs;
    } catch (error) {
      this.logger.error('Erreur getAllConfigs:', error);
      throw error;
    }
  }

  async getConfig(key: string, environment = 'production'): Promise<ConfigItem | null> {
    try {
      const cacheKey = `${this.cachePrefix}${environment}:${key}`;
      
      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('key', key)
        .eq('environment', environment)
        .eq('isActive', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Erreur récupération configuration: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const config = {
        ...data,
        value: this.processValueFromStorage(data)
      };

      // Mettre en cache
      await this.cacheService.set(cacheKey, config, this.cacheTTL);

      return config;
    } catch (error) {
      this.logger.error(`Erreur getConfig pour ${key}:`, error);
      throw error;
    }
  }

  async updateConfig(
    key: string, 
    value: any, 
    updatedBy: string,
    environment = 'production',
    changeReason?: string
  ): Promise<ConfigItem> {
    try {
      // Récupérer la configuration actuelle pour l'historique
      const currentConfig = await this.getConfig(key, environment);
      
      if (!currentConfig) {
        throw new Error(`Configuration ${key} non trouvée`);
      }

      // Valider la nouvelle valeur
      await this.validateConfigValue(currentConfig, value);

      // Préparer la nouvelle configuration
      const updatedConfig: Partial<ConfigItem> = {
        value: this.processValueForStorage({ ...currentConfig, value }),
        lastUpdated: new Date().toISOString(),
        updatedBy,
        version: (currentConfig.version || 0) + 1
      };

      // Mettre à jour la configuration
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update(updatedConfig)
        .eq('key', key)
        .eq('environment', environment)
        .select()
        .single();

      if (error) {
        throw new Error(`Erreur mise à jour configuration: ${error.message}`);
      }

      // Enregistrer dans l'historique
      await this.addToHistory({
        configKey: key,
        oldValue: currentConfig.value,
        newValue: value,
        changedBy: updatedBy,
        changeReason,
        timestamp: new Date().toISOString(),
        environment,
        action: 'update'
      });

      // Invalider le cache
      await this.invalidateCache(key, environment);

      const result = {
        ...data,
        value: this.processValueFromStorage(data)
      };

      this.logger.log(`Configuration ${key} mise à jour par ${updatedBy}`);
      return result;
    } catch (error) {
      this.logger.error(`Erreur updateConfig pour ${key}:`, error);
      throw error;
    }
  }

  /**
   * ✅ VALIDATION DES CONFIGURATIONS
   */
  private async validateConfigValue(config: ConfigItem, value: any): Promise<void> {
    const rules = config.validationRules;
    if (!rules) return;

    // Validation required
    if (rules.required && (value === null || value === undefined || value === '')) {
      throw new Error(`La configuration ${config.key} est requise`);
    }

    // Validation par type
    switch (config.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`${config.key} doit être une chaîne de caractères`);
        }
        if (rules.minLength && value.length < rules.minLength) {
          throw new Error(`${config.key} doit contenir au moins ${rules.minLength} caractères`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          throw new Error(`${config.key} doit contenir au maximum ${rules.maxLength} caractères`);
        }
        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          throw new Error(`${config.key} ne respecte pas le format requis`);
        }
        break;

      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new Error(`${config.key} doit être un nombre`);
        }
        if (rules.min !== undefined && numValue < rules.min) {
          throw new Error(`${config.key} doit être supérieur ou égal à ${rules.min}`);
        }
        if (rules.max !== undefined && numValue > rules.max) {
          throw new Error(`${config.key} doit être inférieur ou égal à ${rules.max}`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          throw new Error(`${config.key} doit être un booléen`);
        }
        break;

      case 'json':
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          }
        } catch {
          throw new Error(`${config.key} doit être un JSON valide`);
        }
        break;
    }

    // Validation des valeurs autorisées
    if (rules.allowedValues && !rules.allowedValues.includes(value)) {
      throw new Error(`${config.key} doit être l'une des valeurs: ${rules.allowedValues.join(', ')}`);
    }
  }

  /**
   * 📚 HISTORIQUE DES MODIFICATIONS
   */
  private async addToHistory(historyEntry: Omit<ConfigHistory, 'id'>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.historyTableName)
        .insert({
          id: crypto.randomUUID(),
          ...historyEntry
        });

      if (error) {
        this.logger.warn('Erreur ajout historique:', error);
      }
    } catch (error) {
      this.logger.warn('Erreur addToHistory:', error);
    }
  }

  async getConfigHistory(key: string, environment = 'production', limit = 50): Promise<ConfigHistory[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.historyTableName)
        .select('*')
        .eq('configKey', key)
        .eq('environment', environment)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Erreur récupération historique: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Erreur getConfigHistory pour ${key}:`, error);
      throw error;
    }
  }

  /**
   * 💾 SAUVEGARDE ET RESTAURATION
   */
  async createBackup(
    name: string,
    createdBy: string,
    environment = 'production',
    description?: string
  ): Promise<string> {
    try {
      const configs = await this.getAllConfigs(environment);
      const backupId = crypto.randomUUID();
      
      const backup: ConfigBackup = {
        id: backupId,
        name,
        description,
        environment,
        configCount: configs.length,
        createdBy,
        createdAt: new Date().toISOString(),
        size: JSON.stringify(configs).length,
        checksum: crypto.createHash('md5').update(JSON.stringify(configs)).digest('hex'),
        configs
      };

      const { error } = await this.supabase
        .from(this.backupTableName)
        .insert(backup);

      if (error) {
        throw new Error(`Erreur création sauvegarde: ${error.message}`);
      }

      this.logger.log(`Sauvegarde ${name} créée avec ${configs.length} configurations`);
      return backupId;
    } catch (error) {
      this.logger.error('Erreur createBackup:', error);
      throw error;
    }
  }

  async restoreBackup(
    backupId: string,
    restoredBy: string,
    environment = 'production'
  ): Promise<void> {
    try {
      // Récupérer la sauvegarde
      const { data: backup, error: backupError } = await this.supabase
        .from(this.backupTableName)
        .select('*')
        .eq('id', backupId)
        .single();

      if (backupError || !backup) {
        throw new Error(`Sauvegarde ${backupId} non trouvée`);
      }

      // Vérifier le checksum
      const currentChecksum = crypto.createHash('md5').update(JSON.stringify(backup.configs)).digest('hex');
      if (currentChecksum !== backup.checksum) {
        throw new Error('Intégrité de la sauvegarde compromise');
      }

      // Désactiver toutes les configurations actuelles
      await this.supabase
        .from(this.tableName)
        .update({ isActive: false })
        .eq('environment', environment);

      // Restaurer les configurations
      for (const config of backup.configs) {
        const configToRestore = {
          ...config,
          id: crypto.randomUUID(),
          value: this.processValueForStorage(config),
          lastUpdated: new Date().toISOString(),
          updatedBy: restoredBy,
          version: (config.version || 0) + 1,
          isActive: true
        };

        await this.supabase
          .from(this.tableName)
          .insert(configToRestore);

        // Ajouter à l'historique
        await this.addToHistory({
          configKey: config.key,
          oldValue: null,
          newValue: config.value,
          changedBy: restoredBy,
          changeReason: `Restauration depuis sauvegarde ${backup.name}`,
          timestamp: new Date().toISOString(),
          environment,
          action: 'restore'
        });
      }

      // Invalider le cache
      await this.invalidateAllCache(environment);

      this.logger.log(`Sauvegarde ${backup.name} restaurée avec ${backup.configCount} configurations`);
    } catch (error) {
      this.logger.error('Erreur restoreBackup:', error);
      throw error;
    }
  }

  async getBackups(environment = 'production'): Promise<Omit<ConfigBackup, 'configs'>[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.backupTableName)
        .select('id, name, description, environment, configCount, createdBy, createdAt, size')
        .eq('environment', environment)
        .order('createdAt', { ascending: false });

      if (error) {
        throw new Error(`Erreur récupération sauvegardes: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur getBackups:', error);
      throw error;
    }
  }

  /**
   * 📊 STATISTIQUES ET MONITORING
   */
  async getStats(environment = 'production'): Promise<any> {
    try {
      const configs = await this.getAllConfigs(environment);
      
      const stats = {
        totalConfigs: configs.length,
        configsByCategory: configs.reduce((acc, config) => {
          acc[config.category] = (acc[config.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        configsByType: configs.reduce((acc, config) => {
          acc[config.type] = (acc[config.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        sensitiveConfigsCount: configs.filter(c => c.isSensitive).length,
        requiredConfigsCount: configs.filter(c => c.isRequired).length,
        lastUpdate: configs.reduce((latest, config) => {
          return config.lastUpdated && config.lastUpdated > latest ? config.lastUpdated : latest;
        }, ''),
        environment
      };

      return stats;
    } catch (error) {
      this.logger.error('Erreur getStats:', error);
      throw error;
    }
  }

  /**
   * 🗑️ GESTION DU CACHE
   */
  private async invalidateCache(key: string, environment: string): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.del(`${this.cachePrefix}${environment}:${key}`),
        this.cacheService.del(`${this.cachePrefix}all:${environment}`)
      ]);
    } catch (error) {
      this.logger.warn('Erreur invalidation cache:', error);
    }
  }

  private async invalidateAllCache(environment: string): Promise<void> {
    try {
      // Supprimer tous les caches pour cet environnement
      const pattern = `${this.cachePrefix}${environment}:*`;
      await this.cacheService.del(pattern);
      await this.cacheService.del(`${this.cachePrefix}all:${environment}`);
    } catch (error) {
      this.logger.warn('Erreur invalidation cache global:', error);
    }
  }

  /**
   * 🔍 AUDIT ET SÉCURITÉ
   */
  async logAudit(auditEntry: Omit<ConfigAudit, 'id' | 'timestamp'>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.auditTableName)
        .insert({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          ...auditEntry
        });

      if (error) {
        this.logger.warn('Erreur audit log:', error);
      }
    } catch (error) {
      this.logger.warn('Erreur logAudit:', error);
    }
  }
}
