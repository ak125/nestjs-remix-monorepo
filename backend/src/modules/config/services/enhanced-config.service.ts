import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import * as crypto from 'crypto';

export interface ConfigItem {
  cnf_id: string;
  cnf_name: string;
  cnf_logo?: string;
  cnf_domain?: string;
  cnf_slogan?: string;
  cnf_address?: string;
  cnf_mail?: string;
  cnf_phone?: string;
  [key: string]: any; // Pour les autres colonnes
}

export interface ConfigBackup {
  timestamp: string;
  configs: ConfigItem[];
  metadata: {
    total: number;
    exported_by: string;
    version: string;
  };
}

@Injectable()
export class EnhancedConfigService extends SupabaseBaseService {
  protected readonly logger = new Logger(EnhancedConfigService.name);
  private readonly CACHE_PREFIX = 'config:';
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly ENCRYPTION_KEY =
    process.env.CONFIG_ENCRYPTION_KEY || 'default-key-change-in-production';

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * Charge la configuration principale depuis la table ___config
   */
  async loadAppConfig(): Promise<ConfigItem | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}app_config`;

      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<ConfigItem>(cacheKey);
      if (cached) {
        this.logger.debug('App configuration loaded from cache');
        return cached;
      }

      // Charger depuis la base de données
      const { data, error } = await this.supabase
        .from('___config')
        .select('*')
        .eq('cnf_id', '1')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Pas trouvé
          return null;
        }
        this.logger.error('Error loading app configuration:', error);
        throw new Error(`Failed to load app configuration: ${error.message}`);
      }

      // Mettre en cache
      await this.cacheService.set(cacheKey, data, this.CACHE_TTL);
      this.logger.debug('App configuration loaded from database');

      return data;
    } catch (error) {
      this.logger.error('Error in loadAppConfig:', error);
      throw error;
    }
  }

  /**
   * Récupère une configuration par clé
   */
  async get(key: string): Promise<string | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;

      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<string>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Charger depuis la base de données
      const { data, error } = await this.supabase
        .from('___config')
        .select('config_value')
        .eq('config_key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Pas trouvé
          return null;
        }
        this.logger.error(`Error getting config ${key}:`, error);
        throw new Error(`Failed to get config ${key}: ${error.message}`);
      }

      // Mettre en cache
      await this.cacheService.set(cacheKey, data.config_value, this.CACHE_TTL);

      return data.config_value;
    } catch (error) {
      this.logger.error(`Error in get(${key}):`, error);
      throw error;
    }
  }

  /**
   * Définit une configuration
   */
  async set(key: string, value: string, description?: string): Promise<void> {
    try {
      const { error } = await this.supabase.from('___config').upsert({
        config_key: key,
        config_value: value,
        description: description || '',
        updated_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error(`Error setting config ${key}:`, error);
        throw new Error(`Failed to set config ${key}: ${error.message}`);
      }

      // Invalider le cache
      await this.invalidateCache(key);

      this.logger.debug(`Config ${key} set successfully`);
    } catch (error) {
      this.logger.error(`Error in set(${key}):`, error);
      throw error;
    }
  }

  /**
   * Supprime une configuration
   */
  async delete(key: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('___config')
        .delete()
        .eq('config_key', key);

      if (error) {
        this.logger.error(`Error deleting config ${key}:`, error);
        throw new Error(`Failed to delete config ${key}: ${error.message}`);
      }

      // Invalider le cache
      await this.invalidateCache(key);

      this.logger.debug(`Config ${key} deleted successfully`);
    } catch (error) {
      this.logger.error(`Error in delete(${key}):`, error);
      throw error;
    }
  }

  /**
   * Recherche des configurations par motif
   */
  async search(pattern: string): Promise<ConfigItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('___config')
        .select('*')
        .or(`config_key.ilike.%${pattern}%,description.ilike.%${pattern}%`)
        .order('config_key');

      if (error) {
        this.logger.error(
          `Error searching configs with pattern ${pattern}:`,
          error,
        );
        throw new Error(`Failed to search configs: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error(`Error in search(${pattern}):`, error);
      throw error;
    }
  }

  /**
   * Récupère les configurations par catégorie (basé sur le préfixe)
   */
  async getByCategory(category: string): Promise<ConfigItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('___config')
        .select('*')
        .like('config_key', `${category}.%`)
        .order('config_key');

      if (error) {
        this.logger.error(
          `Error getting configs for category ${category}:`,
          error,
        );
        throw new Error(`Failed to get configs for category: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error(`Error in getByCategory(${category}):`, error);
      throw error;
    }
  }

  /**
   * Sauvegarde toutes les configurations
   */
  async backup(): Promise<ConfigBackup> {
    try {
      const configs = await this.loadAllConfigs();

      const backup: ConfigBackup = {
        timestamp: new Date().toISOString(),
        configs,
        metadata: {
          total: configs.length,
          exported_by: 'EnhancedConfigService',
          version: '1.0.0',
        },
      };

      this.logger.log(`Created backup with ${configs.length} configurations`);
      return backup;
    } catch (error) {
      this.logger.error('Error in backup:', error);
      throw error;
    }
  }

  /**
   * Restaure les configurations depuis une sauvegarde
   */
  async restore(backup: ConfigBackup): Promise<void> {
    try {
      const { configs } = backup;

      for (const config of configs) {
        await this.set(
          config.config_key,
          config.config_value,
          config.description,
        );
      }

      this.logger.log(`Restored ${configs.length} configurations from backup`);
    } catch (error) {
      this.logger.error('Error in restore:', error);
      throw error;
    }
  }

  /**
   * Chiffre une valeur sensible
   */
  encryptValue(value: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = this.ENCRYPTION_KEY;
      const cipher = crypto.createCipher('aes-256-cbc', key);

      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Format: iv:encryptedData pour compatibilité future
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Error encrypting value:', error);
      throw new Error('Failed to encrypt value');
    }
  }

  /**
   * Déchiffre une valeur
   */
  decryptValue(encryptedValue: string): string {
    try {
      const parts = encryptedValue.split(':');
      let encrypted = encryptedValue;

      // Si nouveau format avec IV, utiliser la partie encrypted
      if (parts.length === 2) {
        encrypted = parts[1];
      }

      const key = this.ENCRYPTION_KEY;
      const decipher = crypto.createDecipher('aes-256-cbc', key);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error('Error decrypting value:', error);
      throw new Error('Failed to decrypt value');
    }
  }

  /**
   * Invalide le cache pour une clé
   */
  private async invalidateCache(key?: string): Promise<void> {
    try {
      if (key) {
        await this.cacheService.del(`${this.CACHE_PREFIX}${key}`);
      }
      // Invalider le cache global
      await this.cacheService.del(`${this.CACHE_PREFIX}all`);
    } catch (error) {
      this.logger.warn('Error invalidating cache:', error);
    }
  }

  /**
   * Statistiques sur les configurations
   */
  async getStats(): Promise<{
    total: number;
    categories: Record<string, number>;
    lastUpdated: string | null;
  }> {
    try {
      const configs = await this.loadAllConfigs();

      const categories: Record<string, number> = {};
      let lastUpdated: string | null = null;

      for (const config of configs) {
        // Extraire la catégorie (partie avant le premier point)
        const category = config.config_key.split('.')[0];
        categories[category] = (categories[category] || 0) + 1;

        // Trouver la dernière mise à jour
        if (
          config.updated_at &&
          (!lastUpdated || config.updated_at > lastUpdated)
        ) {
          lastUpdated = config.updated_at;
        }
      }

      return {
        total: configs.length,
        categories,
        lastUpdated,
      };
    } catch (error) {
      this.logger.error('Error getting stats:', error);
      throw error;
    }
  }
}
