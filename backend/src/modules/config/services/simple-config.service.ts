import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';

export interface AppConfig {
  cnf_id: string;
  cnf_name: string;
  cnf_logo?: string;
  cnf_domain?: string;
  cnf_slogan?: string;
  cnf_address?: string;
  cnf_mail?: string;
  cnf_phone?: string;
  cnf_phone_call?: string;
  cnf_group_name?: string;
  cnf_group_domain?: string;
  cnf_tva?: string;
  cnf_shipping?: string;
  [key: string]: any; // Pour les autres colonnes dynamiques
}

@Injectable()
export class SimpleConfigService extends SupabaseBaseService {
  protected readonly logger = new Logger(SimpleConfigService.name);
  private readonly CACHE_PREFIX = 'app_config:';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * Récupère la configuration principale de l'application
   */
  async getAppConfig(): Promise<AppConfig | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}main`;

      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<AppConfig>(cacheKey);
      if (cached) {
        this.logger.debug('App configuration loaded from cache');
        return cached;
      }

      // Charger depuis la base de données
      const { data, error } = await this.supabase
        .from(TABLES.config)
        .select('*')
        .eq('cnf_id', '1')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.logger.warn('App configuration not found');
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
      this.logger.error('Error in getAppConfig:', error);
      throw error;
    }
  }

  /**
   * Récupère une valeur spécifique de configuration
   */
  async getConfigValue(key: keyof AppConfig): Promise<string | null> {
    try {
      const config = await this.getAppConfig();
      if (!config) {
        return null;
      }

      return config[key] || null;
    } catch (error) {
      this.logger.error(
        `Error getting config value for key ${String(key)}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Met à jour une valeur de configuration
   */
  async updateConfigValue(key: keyof AppConfig, value: string): Promise<void> {
    try {
      const updateData = { [key]: value };

      const { error } = await this.supabase
        .from(TABLES.config)
        .update(updateData)
        .eq('cnf_id', '1');

      if (error) {
        this.logger.error(`Error updating config ${String(key)}:`, error);
        throw new Error(
          `Failed to update config ${String(key)}: ${error.message}`,
        );
      }

      // Invalider le cache
      await this.invalidateCache();

      this.logger.debug(`Config ${String(key)} updated successfully`);
    } catch (error) {
      this.logger.error(`Error in updateConfigValue(${String(key)}):`, error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques de configuration
   */
  async getConfigStats(): Promise<{
    total_fields: number;
    filled_fields: number;
    last_updated: string | null;
  }> {
    try {
      const config = await this.getAppConfig();
      if (!config) {
        return { total_fields: 0, filled_fields: 0, last_updated: null };
      }

      const fields = Object.keys(config);
      const filledFields = fields.filter(
        (key) =>
          config[key] !== null &&
          config[key] !== undefined &&
          config[key] !== '',
      );

      return {
        total_fields: fields.length,
        filled_fields: filledFields.length,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting config stats:', error);
      throw error;
    }
  }

  /**
   * Invalide le cache
   */
  private async invalidateCache(): Promise<void> {
    try {
      await this.cacheService.del(`${this.CACHE_PREFIX}main`);
    } catch (error) {
      this.logger.warn('Error invalidating cache:', error);
    }
  }

  /**
   * Test de connexion à la base de données
   */
  async testDatabaseConnection(): Promise<{ status: string; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.config)
        .select('cnf_id')
        .limit(1);

      if (error) {
        return {
          status: 'error',
          message: `Database connection failed: ${error.message}`,
        };
      }

      return {
        status: 'success',
        message: `Database connection successful. Found ${data?.length || 0} records.`,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Connection test failed: ${error}`,
      };
    }
  }
}
