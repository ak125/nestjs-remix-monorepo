import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { sleep } from '../../../utils/promise-helpers';

export interface DatabaseConfig {
  environment: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  sslEnabled: boolean;
  poolSize: number;
  connectionTimeout: number;
  maxConnections: number;
  isActive: boolean;
}

export interface DatabaseConnectionTest {
  isValid: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

@Injectable()
export class SimpleDatabaseConfigService {
  private readonly logger = new Logger(SimpleDatabaseConfigService.name);
  private readonly CACHE_PREFIX = 'db_config:';
  private readonly CACHE_TTL = 1800; // 30 minutes

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Récupère la configuration de base de données pour un environnement
   * Utilise les variables d'environnement et configurations par défaut
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

      // Utiliser la configuration basée sur l'environnement
      const config = this.buildConfigFromEnvironment(env, dbPort);

      // Mettre en cache
      await this.cacheService.set(cacheKey, config, this.CACHE_TTL);

      this.logger.debug(`Database config built for ${env}:${dbPort}`);
      return config;
    } catch (error) {
      this.logger.error(`Error in getConfig(${environment}, ${port}):`, error);
      throw error;
    }
  }

  /**
   * Liste toutes les configurations disponibles
   */
  async listConfigs(): Promise<DatabaseConfig[]> {
    const environments = ['development', 'staging', 'production'];
    const configs: DatabaseConfig[] = [];

    for (const env of environments) {
      try {
        const config = await this.getConfig(env);
        configs.push(config);
      } catch (error) {
        this.logger.warn(`Failed to get config for environment: ${env}`, error);
      }
    }

    return configs;
  }

  /**
   * Teste une connexion de base de données (simulation)
   */
  async testDatabaseConnection(
    config: DatabaseConfig,
  ): Promise<DatabaseConnectionTest> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
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

      // Simulation d'un test de connexion
      // Dans un vrai système, on créerait une vraie connexion
      await sleep(50); // Simulate network delay

      const responseTime = Date.now() - startTime;

      // Simulation de succès basée sur la validité des paramètres
      const isValid = config.host !== 'invalid-host' && config.port > 0;

      return {
        isValid,
        responseTime,
        error: !isValid ? 'Connection failed - invalid parameters' : undefined,
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
   * Récupère les statistiques de configuration
   */
  async getStats(): Promise<{
    total: number;
    byEnvironment: Record<string, number>;
    active: number;
    withSsl: number;
  }> {
    try {
      const configs = await this.listConfigs();

      const byEnvironment: Record<string, number> = {};
      let active = 0;
      let withSsl = 0;

      configs.forEach((config) => {
        byEnvironment[config.environment] =
          (byEnvironment[config.environment] || 0) + 1;
        if (config.isActive) active++;
        if (config.sslEnabled) withSsl++;
      });

      return {
        total: configs.length,
        byEnvironment,
        active,
        withSsl,
      };
    } catch (error) {
      this.logger.error('Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Construit une configuration à partir de l'environnement
   */
  private buildConfigFromEnvironment(
    environment: string,
    port: number,
  ): DatabaseConfig {
    const configs: Record<string, Partial<DatabaseConfig>> = {
      development: {
        host: process.env.DEV_DB_HOST || 'localhost',
        port: port || parseInt(process.env.DEV_DB_PORT || '5432'),
        database: process.env.DEV_DB_NAME || 'dev_db',
        username: process.env.DEV_DB_USER || 'dev_user',
        password: process.env.DEV_DB_PASS || 'dev_password',
        sslEnabled: false,
        poolSize: 5,
        connectionTimeout: 10,
        maxConnections: 5,
      },
      staging: {
        host:
          process.env.STAGING_DB_HOST ||
          process.env.DB_HOST ||
          'staging.db.com',
        port:
          port ||
          parseInt(
            process.env.STAGING_DB_PORT || process.env.DB_PORT || '5432',
          ),
        database:
          process.env.STAGING_DB_NAME || process.env.DB_NAME || 'staging_db',
        username:
          process.env.STAGING_DB_USER || process.env.DB_USER || 'staging_user',
        password: process.env.STAGING_DB_PASS || process.env.DB_PASS,
        sslEnabled: true,
        poolSize: 10,
        connectionTimeout: 15,
        maxConnections: 10,
      },
      production: {
        host:
          process.env.PROD_DB_HOST ||
          process.env.DB_HOST ||
          'db.cxpojprgwgubzjyqzmoq.supabase.co',
        port:
          port ||
          parseInt(process.env.PROD_DB_PORT || process.env.DB_PORT || '5432'),
        database: process.env.PROD_DB_NAME || process.env.DB_NAME || 'postgres',
        username: process.env.PROD_DB_USER || process.env.DB_USER || 'postgres',
        password: process.env.PROD_DB_PASS || process.env.DB_PASS,
        sslEnabled: true,
        poolSize: 20,
        connectionTimeout: 30,
        maxConnections: 20,
      },
    };

    const baseConfig = configs[environment] || configs.development;

    return {
      environment,
      host: baseConfig.host!,
      port: baseConfig.port!,
      database: baseConfig.database!,
      username: baseConfig.username!,
      password: baseConfig.password,
      sslEnabled: baseConfig.sslEnabled!,
      poolSize: baseConfig.poolSize!,
      connectionTimeout: baseConfig.connectionTimeout!,
      maxConnections: baseConfig.maxConnections!,
      isActive: true,
    };
  }

  private getDefaultPort(environment: string): number {
    switch (environment) {
      case 'production':
        return 5432;
      case 'staging':
        return 5432;
      default:
        return 5432;
    }
  }

  /**
   * Invalide le cache pour un environnement
   */
  async invalidateCache(environment?: string): Promise<void> {
    try {
      if (environment) {
        await this.cacheService.del(`${this.CACHE_PREFIX}${environment}:*`);
      } else {
        // Invalider tout le cache de configurations DB
        this.logger.debug('Invalidating all database config cache');
      }
    } catch (error) {
      this.logger.warn('Error invalidating cache:', error);
    }
  }
}
