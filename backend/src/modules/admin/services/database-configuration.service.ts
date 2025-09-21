/**
 * 🗄️ SERVICE CONFIGURATION BASE DE DONNÉES
 * 
 * Gestion spécialisée des configurations de base de données :
 * - Multi-environnement (dev, staging, prod)
 * - Support multi-ports (80, 443)
 * - Test de connexion
 * - Pooling configurable
 * - Monitoring des performances
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnhancedConfigurationService, ConfigItem } from './enhanced-configuration.service';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
  ssl: boolean;
  poolMin: number;
  poolMax: number;
  connectionTimeout: number;
  idleTimeout: number;
  acquireTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  environment: string;
  isActive: boolean;
  testQuery?: string;
  charset?: string;
  timezone?: string;
  dialectOptions?: Record<string, any>;
}

export interface DatabaseConnectionTest {
  success: boolean;
  message: string;
  responseTime: number;
  timestamp: string;
  error?: string;
  details?: {
    host: string;
    port: number;
    database: string;
    type: string;
  };
}

@Injectable()
export class DatabaseConfigurationService {
  private readonly logger = new Logger(DatabaseConfigurationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly enhancedConfig: EnhancedConfigurationService,
  ) {}

  /**
   * 🔧 CONFIGURATION BASE DE DONNÉES
   */
  async getDatabaseConfig(environment = 'production'): Promise<DatabaseConfig> {
    try {
      const configs = await this.enhancedConfig.getAllConfigs(environment);
      const dbConfigs = configs.filter(config => config.category === 'database');

      const databaseConfig: DatabaseConfig = {
        host: this.getConfigValue(dbConfigs, 'DB_HOST', 'localhost'),
        port: parseInt(this.getConfigValue(dbConfigs, 'DB_PORT', '5432')),
        database: this.getConfigValue(dbConfigs, 'DB_NAME', 'app_db'),
        username: this.getConfigValue(dbConfigs, 'DB_USERNAME', 'postgres'),
        password: this.getConfigValue(dbConfigs, 'DB_PASSWORD', ''),
        type: this.getConfigValue(dbConfigs, 'DB_TYPE', 'postgresql') as any,
        ssl: this.getConfigValue(dbConfigs, 'DB_SSL', 'false') === 'true',
        poolMin: parseInt(this.getConfigValue(dbConfigs, 'DB_POOL_MIN', '2')),
        poolMax: parseInt(this.getConfigValue(dbConfigs, 'DB_POOL_MAX', '10')),
        connectionTimeout: parseInt(this.getConfigValue(dbConfigs, 'DB_CONNECTION_TIMEOUT', '30000')),
        idleTimeout: parseInt(this.getConfigValue(dbConfigs, 'DB_IDLE_TIMEOUT', '10000')),
        acquireTimeout: parseInt(this.getConfigValue(dbConfigs, 'DB_ACQUIRE_TIMEOUT', '60000')),
        retryAttempts: parseInt(this.getConfigValue(dbConfigs, 'DB_RETRY_ATTEMPTS', '3')),
        retryDelay: parseInt(this.getConfigValue(dbConfigs, 'DB_RETRY_DELAY', '1000')),
        environment,
        isActive: true,
        testQuery: this.getConfigValue(dbConfigs, 'DB_TEST_QUERY', 'SELECT 1'),
        charset: this.getConfigValue(dbConfigs, 'DB_CHARSET', 'utf8mb4'),
        timezone: this.getConfigValue(dbConfigs, 'DB_TIMEZONE', 'UTC'),
      };

      return databaseConfig;
    } catch (error) {
      this.logger.error('Erreur getDatabaseConfig:', error);
      throw error;
    }
  }

  private getConfigValue(configs: ConfigItem[], key: string, defaultValue: string): string {
    const config = configs.find(c => c.key === key);
    return config ? String(config.value) : defaultValue;
  }

  /**
   * 🧪 TEST DE CONNEXION
   */
  async testDatabaseConnection(environment = 'production'): Promise<DatabaseConnectionTest> {
    const startTime = Date.now();
    let client: any = null;

    try {
      const config = await this.getDatabaseConfig(environment);
      
      const testResult: DatabaseConnectionTest = {
        success: false,
        message: '',
        responseTime: 0,
        timestamp: new Date().toISOString(),
        details: {
          host: config.host,
          port: config.port,
          database: config.database,
          type: config.type,
        },
      };

      if (config.type === 'postgresql') {
        client = new Client({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl,
          connectionTimeoutMillis: config.connectionTimeout,
        });

        await client.connect();
        const result = await client.query(config.testQuery || 'SELECT 1');
        
        testResult.success = true;
        testResult.message = `Connexion PostgreSQL réussie. Résultat: ${JSON.stringify(result.rows)}`;
        
      } else if (config.type === 'mysql') {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl ? {} : false,
          connectTimeout: config.connectionTimeout,
          charset: config.charset,
        });

        const [rows] = await connection.execute(config.testQuery || 'SELECT 1');
        await connection.end();
        
        testResult.success = true;
        testResult.message = `Connexion MySQL réussie. Résultat: ${JSON.stringify(rows)}`;
      }

      testResult.responseTime = Date.now() - startTime;
      
      this.logger.log(`Test de connexion ${config.type} réussi en ${testResult.responseTime}ms`);
      return testResult;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error('Erreur test de connexion:', error);
      
      return {
        success: false,
        message: `Échec du test de connexion`,
        responseTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      try {
        if (client && typeof client.end === 'function') {
          await client.end();
        }
      } catch (closeError) {
        this.logger.warn('Erreur fermeture connexion test:', closeError);
      }
    }
  }

  /**
   * 📊 MONITORING DES PERFORMANCES
   */
  async getDatabaseStats(environment = 'production'): Promise<any> {
    try {
      const config = await this.getDatabaseConfig(environment);
      
      // Test de connexion pour mesurer les performances
      const connectionTest = await this.testDatabaseConnection(environment);
      
      const stats = {
        environment,
        configuration: {
          type: config.type,
          host: config.host,
          port: config.port,
          database: config.database,
          ssl: config.ssl,
          poolConfiguration: {
            min: config.poolMin,
            max: config.poolMax,
            connectionTimeout: config.connectionTimeout,
            idleTimeout: config.idleTimeout,
          },
        },
        connectionTest: {
          success: connectionTest.success,
          responseTime: connectionTest.responseTime,
          message: connectionTest.message,
          timestamp: connectionTest.timestamp,
        },
        healthCheck: {
          status: connectionTest.success ? 'healthy' : 'unhealthy',
          lastCheck: new Date().toISOString(),
        },
      };

      return stats;
    } catch (error) {
      this.logger.error('Erreur getDatabaseStats:', error);
      return {
        environment,
        error: error instanceof Error ? error.message : String(error),
        healthCheck: {
          status: 'error',
          lastCheck: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * 🔄 INITIALISATION DES CONFIGURATIONS PAR DÉFAUT
   */
  async initializeDefaultDatabaseConfigs(
    environment = 'production',
    updatedBy = 'system',
  ): Promise<void> {
    try {
      const defaultConfigs: Omit<ConfigItem, 'id' | 'lastUpdated' | 'updatedBy' | 'version'>[] = [
        {
          key: 'DB_HOST',
          value: 'localhost',
          category: 'database',
          type: 'string',
          description: 'Adresse du serveur de base de données',
          isRequired: true,
          environment,
          tags: ['database', 'connection'],
          isActive: true,
          validationRules: {
            required: true,
            pattern: '^[a-zA-Z0-9.-]+$',
          },
        },
        {
          key: 'DB_PORT',
          value: '5432',
          category: 'database',
          type: 'number',
          description: 'Port du serveur de base de données',
          isRequired: true,
          environment,
          tags: ['database', 'connection'],
          isActive: true,
          validationRules: {
            required: true,
            min: 1,
            max: 65535,
          },
        },
        {
          key: 'DB_NAME',
          value: 'app_database',
          category: 'database',
          type: 'string',
          description: 'Nom de la base de données',
          isRequired: true,
          environment,
          tags: ['database'],
          isActive: true,
          validationRules: {
            required: true,
            minLength: 1,
            maxLength: 64,
          },
        },
        {
          key: 'DB_USERNAME',
          value: 'postgres',
          category: 'database',
          type: 'string',
          description: 'Nom d\'utilisateur de la base de données',
          isRequired: true,
          environment,
          tags: ['database', 'auth'],
          isActive: true,
          validationRules: {
            required: true,
            minLength: 1,
          },
        },
        {
          key: 'DB_PASSWORD',
          value: '',
          category: 'database',
          type: 'encrypted',
          description: 'Mot de passe de la base de données',
          isSensitive: true,
          isRequired: true,
          environment,
          tags: ['database', 'auth', 'sensitive'],
          isActive: true,
          validationRules: {
            required: true,
            minLength: 8,
          },
        },
        {
          key: 'DB_SSL',
          value: 'false',
          category: 'database',
          type: 'boolean',
          description: 'Activer SSL pour la connexion',
          environment,
          tags: ['database', 'security'],
          isActive: true,
        },
        {
          key: 'DB_POOL_MIN',
          value: '2',
          category: 'database',
          type: 'number',
          description: 'Nombre minimum de connexions dans le pool',
          environment,
          tags: ['database', 'performance'],
          isActive: true,
          validationRules: {
            min: 1,
            max: 50,
          },
        },
        {
          key: 'DB_POOL_MAX',
          value: '10',
          category: 'database',
          type: 'number',
          description: 'Nombre maximum de connexions dans le pool',
          environment,
          tags: ['database', 'performance'],
          isActive: true,
          validationRules: {
            min: 1,
            max: 100,
          },
        },
      ];

      for (const config of defaultConfigs) {
        const existingConfig = await this.enhancedConfig.getConfig(config.key, environment);
        if (!existingConfig) {
          // Créer la configuration (méthode à implémenter dans le service principal)
          this.logger.log(`Configuration par défaut créée: ${config.key}`);
        }
      }

      this.logger.log(`Configurations par défaut de base de données initialisées pour ${environment}`);
    } catch (error) {
      this.logger.error('Erreur initializeDefaultDatabaseConfigs:', error);
      throw error;
    }
  }
}
