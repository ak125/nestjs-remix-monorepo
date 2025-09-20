/**
 * 🔧 ENHANCED CONFIG MODULE - Module de Configuration Optimisé
 *
 * Architecture alignée sur les meilleures pratiques du projet :
 * ✅ Module global avec configuration dynamique
 * ✅ Services spécialisés par domaine avec inheritance SupabaseBaseService
 * ✅ Cache intégré pour performances optimales
 * ✅ Support multi-environnements avec validation
 * ✅ Encryption/Decryption pour données sensibles
 * ✅ Integration avec modules existants (Analytics, Database, Cache)
 * ✅ Configuration centralisée avec monitoring
 * ✅ Services Enhanced vs Simple pour flexibilité
 */

import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

// Controllers - Utilise les meilleurs existants
import { EnhancedConfigController } from './controllers/enhanced-config.controller';
import { EnhancedMetadataController } from './controllers/enhanced-metadata.controller';
import { OptimizedBreadcrumbController } from './controllers/optimized-breadcrumb.controller';

// Services - Services Enhanced optimisés
import { EnhancedConfigService } from './services/enhanced-config.service';
import { EnhancedMetadataService } from './services/enhanced-metadata.service';
import { BreadcrumbService } from './services/breadcrumb.service';
import { OptimizedBreadcrumbService } from './services/optimized-breadcrumb.service';
import { ConfigAnalyticsService } from './services/config-analytics.service';
import { ConfigSecurityService } from './services/config-security.service';
import { ConfigValidationService } from './services/config-validation.service';
import { ConfigMonitoringService } from './services/config-monitoring.service';

// Modules externes optimisés
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { AnalyticsModule } from '../analytics/analytics.module';

// Interfaces et types
interface EnhancedConfigModuleOptions {
  environment?: 'development' | 'production' | 'test';
  cacheTTL?: number;
  enableValidation?: boolean;
  enableSecurity?: boolean;
  enableMonitoring?: boolean;
  enableAnalytics?: boolean;
}

@Global()
@Module({
  imports: [
    // Configuration NestJS globale
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      expandVariables: true,
    }),
    // Modules essentiels
    DatabaseModule,
    CacheModule,
    AnalyticsModule,
  ],
  controllers: [
    // Controllers Enhanced optimisés
    EnhancedConfigController,
    EnhancedMetadataController,
    OptimizedBreadcrumbController,
  ],
  providers: [
    // Services principaux Enhanced
    EnhancedConfigService,
    EnhancedMetadataService,
    BreadcrumbService,
    OptimizedBreadcrumbService,
    ConfigAnalyticsService,
    
    // Services de sécurité et validation
    ConfigSecurityService,
    ConfigValidationService,
    ConfigMonitoringService,
  ],
  exports: [
    // Services principaux exportés
    EnhancedConfigService,
    EnhancedMetadataService,
    BreadcrumbService,
    OptimizedBreadcrumbService,
    ConfigAnalyticsService,
    ConfigSecurityService,
    ConfigValidationService,
    ConfigMonitoringService,
  ],
})
export class EnhancedConfigModule {
  /**
   * Configuration dynamique du module Enhanced
   * Permet personnalisation avancée selon l'environnement
   */
  static forRoot(options?: EnhancedConfigModuleOptions): DynamicModule {
    const defaultOptions: EnhancedConfigModuleOptions = {
      cacheTTL: 3600, // 1 heure par défaut
      environment:
        (process.env.NODE_ENV as 'development' | 'production' | 'test') ||
        'development',
      enableValidation: true,
      enableSecurity: true,
      enableMonitoring: process.env.NODE_ENV === 'production',
      enableAnalytics: true,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // Providers conditionnels selon options
    const conditionalProviders = [
      {
        provide: 'ENHANCED_CONFIG_OPTIONS',
        useValue: mergedOptions,
      },
      {
        provide: 'CONFIG_ENVIRONMENT',
        useValue: mergedOptions.environment,
      },
    ];

    // Ajouter provider d'analytics si activé
    if (mergedOptions.enableAnalytics) {
      conditionalProviders.push({
        provide: 'ANALYTICS_ENABLED',
        useValue: mergedOptions.enableAnalytics,
      });
    }

    return {
      module: EnhancedConfigModule,
      providers: conditionalProviders,
      global: true,
    };
  }

  /**
   * Configuration optimisée pour la production
   * Cache long, sécurité renforcée, monitoring activé
   */
  static forProduction(): DynamicModule {
    return EnhancedConfigModule.forRoot({
      cacheTTL: 7200, // 2 heures en production
      enableValidation: true,
      enableSecurity: true,
      enableMonitoring: true,
      enableAnalytics: true,
      environment: 'production',
    });
  }

  /**
   * Configuration pour les tests
   * Cache court, sécurité simplifiée, monitoring désactivé
   */
  static forTesting(): DynamicModule {
    return EnhancedConfigModule.forRoot({
      cacheTTL: 60, // 1 minute en test
      enableValidation: false,
      enableSecurity: false,
      enableMonitoring: false,
      enableAnalytics: false,
      environment: 'test',
    });
  }

  /**
   * Configuration légère pour développement
   * Cache court, validation activée, monitoring optionnel
   */
  static forDevelopment(): DynamicModule {
    return EnhancedConfigModule.forRoot({
      cacheTTL: 300, // 5 minutes en dev
      enableValidation: true,
      enableSecurity: true,
      enableMonitoring: false,
      enableAnalytics: true,
      environment: 'development',
    });
  }
}
