/**
 * CONFIG MODULE - Configuration globale
 *
 * DatabaseConfigService : CRUD sur table ___config (KV, types, pagination, cache)
 * SimpleDatabaseConfigService : configs connexion DB (env vars)
 */

import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

// Controllers
import { SimpleDatabaseConfigController } from './controllers/simple-database-config.controller';

// Services
import { DatabaseConfigService } from './services/database-config.service';
import { SimpleDatabaseConfigService } from './services/simple-database-config.service';

// Modules externes
import { DatabaseModule } from '../../database/database.module';
import { AnalyticsModule } from '../analytics/analytics.module';

// Interfaces et types
interface ConfigModuleOptions {
  environment?: 'development' | 'production' | 'test';
  cacheTTL?: number;
  enableValidation?: boolean;
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      expandVariables: true,
    }),
    DatabaseModule,
    AnalyticsModule,
  ],
  controllers: [SimpleDatabaseConfigController],
  providers: [
    DatabaseConfigService,
    SimpleDatabaseConfigService,
    // Providers par défaut
    {
      provide: 'ANALYTICS_ENABLED',
      useValue: process.env.NODE_ENV !== 'test',
    },
    {
      provide: 'CONFIG_OPTIONS',
      useValue: {
        cacheTTL: 3600,
        environment: process.env.NODE_ENV || 'development',
        enableValidation: true,
      },
    },
  ],
  exports: [DatabaseConfigService, SimpleDatabaseConfigService],
})
export class ConfigModule {
  /**
   * Configuration dynamique du module
   * Permet de personnaliser le comportement selon l'environnement
   */
  static forRoot(options?: ConfigModuleOptions): DynamicModule {
    const defaultOptions: ConfigModuleOptions = {
      cacheTTL: 3600, // 1 heure par défaut
      environment:
        (process.env.NODE_ENV as 'development' | 'production' | 'test') ||
        'development',
      enableValidation: true,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    return {
      module: ConfigModule,
      providers: [
        {
          provide: 'CONFIG_OPTIONS',
          useValue: mergedOptions,
        },
        {
          provide: 'CONFIG_ENVIRONMENT',
          useValue: mergedOptions.environment,
        },
        {
          provide: 'ANALYTICS_ENABLED',
          useValue: mergedOptions.environment !== 'test',
        },
      ],
    };
  }

  /**
   * Configuration optimisée pour la production
   * Cache long, analytics activés, validation renforcée
   */
  static forProduction(): DynamicModule {
    return ConfigModule.forRoot({
      cacheTTL: 7200, // 2 heures en production
      enableValidation: true,
      environment: 'production',
    });
  }

  /**
   * Configuration pour les tests
   * Désactive le cache et la validation pour les performances
   */
  static forTesting(): DynamicModule {
    return ConfigModule.forRoot({
      cacheTTL: 0,
      enableValidation: false,
      environment: 'test',
    });
  }

  /**
   * Configuration pour le développement
   * Cache court, validation activée
   */
  static forDevelopment(): DynamicModule {
    return ConfigModule.forRoot({
      cacheTTL: 300, // 5 minutes en dev
      enableValidation: true,
      environment: 'development',
    });
  }
}
