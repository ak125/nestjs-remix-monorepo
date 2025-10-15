import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import * as crypto from 'crypto';

export interface DatabaseConfig {
  id?: string;
  environment: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  sslEnabled: boolean;
  poolSize: number;
  isActive: boolean;
  connectionTimeout?: number;
  maxConnections?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DatabaseConnectionTest {
  isValid: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

@Injectable()
export class EnhancedDatabaseConfigService extends SupabaseBaseService {
  protected readonly logger = new Logger(EnhancedDatabaseConfigService.name);
  private readonly CACHE_PREFIX = 'db_config:';
  private readonly CACHE_TTL = 1800; // 30 minutes pour les configs DB
  private readonly ENCRYPTION_KEY =
    process.env.DB_ENCRYPTION_KEY || 'default-db-key-change-in-production';
  private readonly TABLE_NAME = '___config'; // Utilise la table existante

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * Récupère la configuration de base de données pour un environnement
   * Remplace sql.conf.php, sql.conf.443.php, sql.conf.80.php
   */
  async getConfig(
    environment?: string,
    port?: number,
  ): Promise<DatabaseConfig> {
    try {
      const env = environment || process.env.NODE_ENV || 'development';
      const dbPort = port || this.getDefaultPort(env);
      const cacheKey = `${this.CACHE_PREFIX}${env}:${dbPort}`;

      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<DatabaseConfig>(cacheKey);
      if (cached) {
        this.logger.debug(
          `Database config loaded from cache for ${env}:${dbPort}`,
        );
        return cached;
      }

      // Chercher dans la table database_configs
      const { data, error } = await this.supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('environment', env)
        .eq('port', dbPort)
        .eq('is_active', true)
        .single();

      let config: DatabaseConfig;

      if (error && error.code === 'PGRST116') {
        // Configuration non trouvée, utiliser la configuration par défaut
        this.logger.warn(
          `No database config found for ${env}:${dbPort}, using defaults`,
        );
        config = this.getDefaultConfig(env, dbPort);
      } else if (error) {
        this.logger.error('Error loading database config:', error);
        throw new Error(`Failed to load database config: ${error.message}`);
      } else {
        // Formatter la configuration depuis la base
        config = this.formatDatabaseConfig(data);
      }

      // Mettre en cache
      await this.cacheService.set(cacheKey, config, this.CACHE_TTL);

      return config;
    } catch (error) {
      this.logger.error(`Error in getConfig(${environment}, ${port}):`, error);
      throw error;
    }
  }

  /**
   * Crée ou met à jour une configuration de base de données
   */
  async upsertConfig(config: DatabaseConfig): Promise<DatabaseConfig> {
    try {
      const configData = {
        environment: config.environment,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password_encrypted: config.password
          ? this.encryptPassword(config.password)
          : null,
        ssl_enabled: config.sslEnabled,
        pool_size: config.poolSize,
        connection_timeout: config.connectionTimeout || 30,
        max_connections: config.maxConnections || 10,
        is_active: config.isActive,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from(this.TABLE_NAME)
        .upsert(configData, { onConflict: 'environment,port' })
        .select()
        .single();

      if (error) {
        this.logger.error('Error upserting database config:', error);
        throw new Error(`Failed to upsert database config: ${error.message}`);
      }

      const savedConfig = this.formatDatabaseConfig(data);

      // Invalider le cache
      await this.invalidateCache(config.environment, config.port);

      this.logger.log(
        `Database config upserted for ${config.environment}:${config.port}`,
      );
      return savedConfig;
    } catch (error) {
      this.logger.error('Error in upsertConfig:', error);
      throw error;
    }
  }

  /**
   * Teste une connexion de base de données
   */
  async testDatabaseConnection(
    config: DatabaseConfig,
  ): Promise<DatabaseConnectionTest> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      // Simulation d'un test de connexion
      // En réalité, il faudrait créer une vraie connexion de test

      // Vérifications basiques
      if (
        !config.host ||
        !config.port ||
        !config.database ||
        !config.username
      ) {
        return {
          isValid: false,
          responseTime: Date.now() - startTime,
          error: 'Missing required connection parameters',
          timestamp,
        };
      }

      // Test de connexion basique avec Supabase (simulation)
      const testQuery = await this.supabase
        .from('___config') // Table existante pour tester
        .select('cnf_id')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (testQuery.error) {
        return {
          isValid: false,
          responseTime,
          error: testQuery.error.message,
          timestamp,
        };
      }

      return {
        isValid: true,
        responseTime,
        timestamp,
      };
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      return {
        isValid: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      };
    }
  }

  /**
   * Liste toutes les configurations par environnement
   */
  async listConfigs(environment?: string): Promise<DatabaseConfig[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}list:${environment || 'all'}`;

      // Vérifier le cache
      const cached = await this.cacheService.get<DatabaseConfig[]>(cacheKey);
      if (cached) {
        return cached;
      }

      let query = this.supabase.from(this.TABLE_NAME).select('*');

      if (environment) {
        query = query.eq('environment', environment);
      }

      const { data, error } = await query.order('environment').order('port');

      if (error) {
        this.logger.error('Error listing database configs:', error);
        throw new Error(`Failed to list database configs: ${error.message}`);
      }

      const configs = (data || []).map((item) =>
        this.formatDatabaseConfig(item),
      );

      // Mettre en cache
      await this.cacheService.set(cacheKey, configs, this.CACHE_TTL);

      return configs;
    } catch (error) {
      this.logger.error('Error in listConfigs:', error);
      throw error;
    }
  }

  /**
   * Supprime une configuration
   */
  async deleteConfig(environment: string, port: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('environment', environment)
        .eq('port', port);

      if (error) {
        this.logger.error(
          `Error deleting database config ${environment}:${port}:`,
          error,
        );
        throw new Error(`Failed to delete database config: ${error.message}`);
      }

      // Invalider le cache
      await this.invalidateCache(environment, port);

      this.logger.log(`Database config deleted for ${environment}:${port}`);
    } catch (error) {
      this.logger.error(
        `Error in deleteConfig(${environment}, ${port}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Configuration par défaut selon l'environnement
   */
  private getDefaultConfig(environment: string, port: number): DatabaseConfig {
    const configs = {
      development: {
        environment: 'development',
        host: 'localhost',
        port: port || 5432,
        database: 'dev_db',
        username: 'dev_user',
        password: 'dev_password',
        sslEnabled: false,
        poolSize: 5,
        connectionTimeout: 10,
        maxConnections: 5,
        isActive: true,
      },
      staging: {
        environment: 'staging',
        host: process.env.DB_HOST || 'staging.db.com',
        port: port || parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'staging_db',
        username: process.env.DB_USER || 'staging_user',
        password: process.env.DB_PASS,
        sslEnabled: true,
        poolSize: 10,
        connectionTimeout: 15,
        maxConnections: 10,
        isActive: true,
      },
      production: {
        environment: 'production',
        host: process.env.DB_HOST!,
        port: port || parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME!,
        username: process.env.DB_USER!,
        password: process.env.DB_PASS,
        sslEnabled: true,
        poolSize: 20,
        connectionTimeout: 30,
        maxConnections: 20,
        isActive: true,
      },
    };

    return configs[environment] || configs.development;
  }

  private getDefaultPort(environment: string): number {
    return environment === 'production' ? 443 : 5432;
  }

  private formatDatabaseConfig(data: any): DatabaseConfig {
    return {
      id: data.id,
      environment: data.environment,
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username,
      password: data.password_encrypted
        ? this.decryptPassword(data.password_encrypted)
        : undefined,
      sslEnabled: data.ssl_enabled,
      poolSize: data.pool_size,
      connectionTimeout: data.connection_timeout,
      maxConnections: data.max_connections,
      isActive: data.is_active,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
  }

  private encryptPassword(password: string): string {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.ENCRYPTION_KEY);
      let encrypted = cipher.update(password, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      this.logger.error('Error encrypting password:', error);
      throw new Error('Failed to encrypt password');
    }
  }

  private decryptPassword(encrypted: string): string {
    try {
      const decipher = crypto.createDecipher(
        'aes-256-cbc',
        this.ENCRYPTION_KEY,
      );
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error('Error decrypting password:', error);
      throw new Error('Failed to decrypt password');
    }
  }

  private async invalidateCache(
    environment?: string,
    port?: number,
  ): Promise<void> {
    try {
      if (environment && port) {
        await this.cacheService.del(
          `${this.CACHE_PREFIX}${environment}:${port}`,
        );
      }

      // Invalider les listes
      await this.cacheService.del(`${this.CACHE_PREFIX}list:all`);
      if (environment) {
        await this.cacheService.del(`${this.CACHE_PREFIX}list:${environment}`);
      }
    } catch (error) {
      this.logger.warn('Error invalidating cache:', error);
    }
  }
}
