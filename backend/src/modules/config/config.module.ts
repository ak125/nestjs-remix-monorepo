/**
 * 🔧 CONFIG MODULE - Module de Configuration Avancé
 *
 * Architecture alignée sur les meilleures pratiques du projet :
 * ✅ Module global avec configuration dynamique
 * ✅ Services spécialisés par domaine (config, enhanced-config)
 * ✅ Cache intégré pour les performances
 * ✅ Support multi-environnements
 * ✅ Encryption/Decryption pour les données sensibles
 * ✅ Integration avec DatabaseModule et CacheModule
 * ✅ Configuration centralisée cohérente avec app.config.ts
 * ✅ Analytics intégrés pour monitoring des configurations
 * ✅ Services Enhanced et Simple pour flexibilité maximale
 */

import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

// Controllers - Mix optimisé Enhanced + Simple
import { EnhancedConfigController } from './controllers/enhanced-config.controller';
import { EnhancedMetadataController } from './controllers/enhanced-metadata.controller';
import { SimpleConfigController } from './controllers/simple-config.controller';
import { SimpleDatabaseConfigController } from './controllers/simple-database-config.controller';
// import { ConfigController } from './config.controller'; // SUPPRIMÉ - Guards manquants

// Services - Services Enhanced optimisés + fallback Simple
import { EnhancedConfigService } from './services/enhanced-config.service';
import { EnhancedMetadataService } from './services/enhanced-metadata.service';
import { BreadcrumbService } from './services/breadcrumb.service';
// import { ConfigAnalyticsService } from './services/config-analytics.service'; // SUPPRIMÉ - executeQuery n'existe pas
import { DatabaseConfigService } from './services/database-config.service';
import { SimpleConfigService } from './services/simple-config.service';
import { SimpleDatabaseConfigService } from './services/simple-database-config.service';

// Modules externes
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../cache/cache.module';
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
    CacheModule,
    AnalyticsModule,
  ],
  controllers: [
    // Controllers Enhanced pour fonctionnalités avancées
    EnhancedConfigController,
    EnhancedMetadataController,
    // Controllers Simple pour compatibilité
    SimpleConfigController,
    SimpleDatabaseConfigController,
    // ConfigController - SUPPRIMÉ (Guards manquants)
  ],
  providers: [
    // Services Enhanced principaux
    EnhancedConfigService,
    EnhancedMetadataService,
    BreadcrumbService,
    // ConfigAnalyticsService, // SUPPRIMÉ - executeQuery n'existe pas
    DatabaseConfigService,
    // Services Simple pour fallback
    SimpleConfigService,
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
  exports: [
    // Services Enhanced exportés en priorité
    EnhancedConfigService,
    EnhancedMetadataService,
    BreadcrumbService,
    // ConfigAnalyticsService, // SUPPRIMÉ
    DatabaseConfigService,
    // Services Simple pour compatibilité
    SimpleConfigService,
    SimpleDatabaseConfigService,
  ],
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
