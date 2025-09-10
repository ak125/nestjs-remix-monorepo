/**
 * 🔧 CONFIG MODULE - Module de Configuration Avancé
 * 
 * Architecture alignée sur les meilleures pratiques du projet :
 * ✅ Module global avec configuration dynamique
 * ✅ Services spécialisés par domaine (config, metadata, database-config)
 * ✅ Cache intégré pour les performances
 * ✅ Validation des configurations
 * ✅ Support multi-environnements
 * ✅ Encryption/Decryption pour les données sensibles
 * ✅ Integration avec DatabaseModule et CacheModule
 * ✅ Breadcrumb service pour navigation
 * ✅ Configuration centralisée cohérente avec app.config.ts
 * 
 * Cohérent avec l'architecture des modules :
 * - AdminModule, SupportModule, NavigationModule, SystemModule
 * - Utilise DatabaseModule et CacheModule existants
 * - Pattern Global + DynamicModule pour flexibilité
 */

import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

// Controllers
import { ConfigController } from './controllers/config.controller';
import { MetadataController } from './controllers/metadata.controller';
import { ConfigAdminController } from './controllers/config-admin.controller';

// Services
import { ConfigService } from './services/config.service';
import { DatabaseConfigService } from './services/database-config.service';
import { MetadataService } from './services/metadata.service';
import { BreadcrumbService } from './services/breadcrumb.service';
import { ConfigSecurityService } from './services/config-security.service';
import { ConfigValidationService } from './services/config-validation.service';
import { ConfigCacheService } from './services/config-cache.service';
import { ConfigMonitoringService } from './services/config-monitoring.service';

// Validators
import { ConfigValidator } from './validators/config.validator';
import { EnvironmentValidator } from './validators/environment.validator';

// Modules externes
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';

// Interfaces et types
import { ConfigModuleOptions, ConfigEnvironment } from './interfaces/config.interfaces';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: null, // Sera défini dynamiquement
    }),
    DatabaseModule,
    CacheModule,
  ],
  controllers: [
    ConfigController,
    MetadataController,
    ConfigAdminController,
  ],
  providers: [
    // Services principaux
    ConfigService,
    DatabaseConfigService,
    MetadataService,
    BreadcrumbService,
    
    // Services avancés
    ConfigSecurityService,
    ConfigValidationService,
    ConfigCacheService,
    ConfigMonitoringService,
    
    // Validators
    ConfigValidator,
    EnvironmentValidator,
  ],
  exports: [
    // Services principaux exportés
    ConfigService,
    DatabaseConfigService,
    MetadataService,
    BreadcrumbService,
    
    // Services utilitaires exportés
    ConfigSecurityService,
    ConfigValidationService,
    ConfigCacheService,
    ConfigMonitoringService,
  ],
})
export class ConfigModule {
  /**
   * Configuration dynamique du module
   * Permet de personnaliser le comportement selon l'environnement
   */
  static forRoot(options?: ConfigModuleOptions): DynamicModule {
    const defaultOptions: ConfigModuleOptions = {
      cacheEnabled: true,
      cacheTTL: 3600, // 1 heure par défaut
      encryptionKey: process.env.CONFIG_ENCRYPTION_KEY,
      environment: (process.env.NODE_ENV as ConfigEnvironment) || 'development',
      validationEnabled: true,
      monitoringEnabled: process.env.NODE_ENV === 'production',
      securityEnabled: process.env.NODE_ENV === 'production',
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
      ],
    };
  }

  /**
   * Configuration pour les tests
   * Désactive le cache et la validation pour les performances
   */
  static forTesting(): DynamicModule {
    return ConfigModule.forRoot({
      cacheEnabled: false,
      cacheTTL: 0,
      validationEnabled: false,
      monitoringEnabled: false,
      securityEnabled: false,
      environment: 'test',
    });
  }

  /**
   * Configuration pour la production
   * Active toutes les fonctionnalités de sécurité et monitoring
   */
  static forProduction(): DynamicModule {
    return ConfigModule.forRoot({
      cacheEnabled: true,
      cacheTTL: 7200, // 2 heures
      validationEnabled: true,
      monitoringEnabled: true,
      securityEnabled: true,
      environment: 'production',
      encryptionKey: process.env.CONFIG_ENCRYPTION_KEY,
    });
  }
}
