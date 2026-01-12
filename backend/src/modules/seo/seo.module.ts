import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';

// Module Workers (pour accès à SeoMonitorSchedulerService)
import { WorkerModule } from '../../workers/worker.module';

// 🛡️ Module Catalog (pour accès à CatalogDataIntegrityService)
import { CatalogModule } from '../catalog/catalog.module';

// 🚀 Module Cache Redis personnalisé (CacheService avec TTL intelligent)
import { CacheModule } from '../../cache/cache.module';

// Services SEO existants
import { SeoService } from './seo.service';
import { SeoEnhancedService } from './seo-enhanced.service';

// 🎯 Service V4 Ultimate
import { DynamicSeoV4UltimateService } from './dynamic-seo-v4-ultimate.service';

// 🧹 Service Hygiène Sitemap
import { SitemapHygieneService } from './services/sitemap-hygiene.service';

// 🌍 Service Hreflang
import { HreflangService } from './services/hreflang.service';

// 🖼️ Service Images Produits
import { ProductImageService } from './services/product-image.service';

// 🔄 Service Delta Sitemap
import { SitemapDeltaService } from './services/sitemap-delta.service';

// 🗜️ Service Streaming Sitemap
import { SitemapStreamingService } from './services/sitemap-streaming.service';

// 🗺️ Service Unifié Sitemap SEO 2026
import { SitemapUnifiedService } from './services/sitemap-unified.service';

// 🤖 Service Robots.txt
import { RobotsTxtService } from './services/robots-txt.service';

// 📄 Service Headers SEO
import { SeoHeadersService } from './services/seo-headers.service';

// 📊 Service Monitoring SEO
import { SeoMonitoringService } from './services/seo-monitoring.service';

// 📊 Service Ingestion Logs (Loki + Meilisearch)
import { LogIngestionService } from './services/log-ingestion.service';

// � Service URL Compatibility
import { UrlCompatibilityService } from './services/url-compatibility.service';

// 📊 Service SEO KPIs Dashboard
import { SeoKpisService } from './services/seo-kpis.service';

// 🛡️ Service Validation Sitemap Véhicule-Pièces
import { SitemapVehiclePiecesValidator } from './services/sitemap-vehicle-pieces-validator.service';

// 📊 Service Tracking Liens Internes (Maillage SEO)
import { SeoLinkTrackingService } from './seo-link-tracking.service';

// 🔗 Service Maillage Interne Centralisé
import { InternalLinkingService } from './internal-linking.service';

// 🛡️ Service Validation SEO Guides d'Achat
import { PurchaseGuideValidatorService } from './validation/purchase-guide-validator.service';

// 📊 Service Matrice SEO (exporté pour AdminModule)
import { SeoMatriceService } from './services/seo-matrice.service';

// 📝 Contrôleur Variations SEO
import { SeoVariationsController } from './seo-variations.controller';

// 📊 Contrôleur Tracking Liens Internes
import { SeoLinkTrackingController } from './seo-link-tracking.controller';

// Contrôleurs existants
import { SeoController } from './seo.controller';
import { SeoEnhancedController } from './seo-enhanced.controller';

// 🎯 Contrôleur V4 Ultimate
import { DynamicSeoController } from './dynamic-seo.controller';

// 🔄 Contrôleur Delta Sitemap
import { SitemapDeltaController } from './controllers/sitemap-delta.controller';

// 🗜️ Contrôleur Streaming Sitemap
import { SitemapStreamingController } from './controllers/sitemap-streaming.controller';

// 🗺️ Contrôleur Unifié Sitemap SEO 2026
import { SitemapUnifiedController } from './controllers/sitemap-unified.controller';

// 🤖 Contrôleur Robots.txt
import { RobotsTxtController } from './controllers/robots-txt.controller';

// 📊 Contrôleur Monitoring SEO
import { SeoMonitoringController } from './controllers/seo-monitoring.controller';

// 🛡️ Contrôleur SEO Monitor (BullMQ)
import { SeoMonitorController } from './controllers/seo-monitor.controller';

// 📊 Contrôleur SEO Logs (Meilisearch)
import { SeoLogsController } from './controllers/seo-logs.controller';

// �🛡️ Interceptor Headers SEO
import { SeoHeadersInterceptor } from './interceptors/seo-headers.interceptor';

@Module({
  imports: [
    ConfigModule,
    WorkerModule, // 🔄 Import pour accès à SeoMonitorSchedulerService (exporté)
    CatalogModule, // 🛡️ Import pour accès à CatalogDataIntegrityService
    CacheModule, // 🚀 Cache Redis personnalisé pour sitemap V2
    // Note: ScheduleModule.forRoot() est dans AppModule (global)

    // 🎯 Cache @nestjs/cache-manager pour SEO V4 Ultimate (in-memory fallback)
    NestCacheModule.register({
      ttl: 3600, // 1 heure par défaut
      max: 1000, // 1000 entrées max
      isGlobal: false,
    }),
  ],

  controllers: [
    SeoController,
    SeoEnhancedController, // 🎯 Contrôleur pour templates dynamiques
    DynamicSeoController, // 🎯 Contrôleur V4 Ultimate
    SitemapDeltaController, // 🔄 Contrôleur Delta Sitemap
    SitemapStreamingController, // 🗜️ Contrôleur Streaming Sitemap
    SitemapUnifiedController, // 🗺️ Contrôleur Unifié SEO V5
    RobotsTxtController, // 🤖 Contrôleur Robots.txt
    SeoMonitoringController, // 📊 Contrôleur Monitoring SEO
    SeoMonitorController, // 🛡️ Contrôleur SEO Monitor (BullMQ)
    SeoLogsController, // 📊 Contrôleur SEO Logs (Meilisearch)
    SeoVariationsController, // 📝 Contrôleur Variations SEO
    SeoLinkTrackingController, // 📊 Contrôleur Tracking Liens Internes
    // SeoMatriceController déplacé vers AdminModule → /api/admin/seo-matrice
  ],

  providers: [
    SeoService,
    SeoEnhancedService, // 🎯 Service enrichi avec templates dynamiques
    DynamicSeoV4UltimateService, // 🎯 Service V4 Ultimate
    SitemapHygieneService, // 🧹 Service Hygiène Sitemap
    HreflangService, // 🌍 Service Hreflang
    ProductImageService, // 🖼️ Service Images Produits
    SitemapDeltaService, // 🔄 Service Delta Sitemap
    SitemapStreamingService, // 🗜️ Service Streaming Sitemap
    SitemapUnifiedService, // 🗺️ Service Unifié SEO V5
    RobotsTxtService, // 🤖 Service Robots.txt
    SeoHeadersService, // 📄 Service Headers SEO
    SeoMonitoringService, // 📊 Service Monitoring SEO
    LogIngestionService, // 📊 Service Ingestion Logs (Loki + Meilisearch)
    UrlCompatibilityService, // 🔍 Service Compatibilité URLs
    SeoKpisService, // 📊 Service KPIs Dashboard
    SitemapVehiclePiecesValidator, // 🛡️ Service Validation Sitemap Véhicule-Pièces
    SeoLinkTrackingService, // 📊 Service Tracking Liens Internes
    InternalLinkingService, // 🔗 Service Maillage Interne Centralisé
    PurchaseGuideValidatorService, // 🛡️ Service Validation SEO Guides d'Achat
    SeoMatriceService, // 📊 Service Matrice SEO (n8n workflow)

    // 🛡️ Interceptor Headers SEO (activé globalement)
    {
      provide: APP_INTERCEPTOR,
      useClass: SeoHeadersInterceptor,
    },

    // Logger spécialisé pour V4
    {
      provide: 'SEO_V4_LOGGER',
      useFactory: () => new Logger('SeoModuleV4Ultimate'),
    },
  ],

  exports: [
    SeoService,
    SeoEnhancedService, // 🎯 Exporté pour utilisation dans autres modules
    DynamicSeoV4UltimateService, // 🎯 Service V4 Ultimate exporté
    SitemapHygieneService, // 🧹 Service Hygiène Sitemap exporté
    HreflangService, // 🌍 Service Hreflang exporté
    ProductImageService, // 🖼️ Service Images Produits exporté
    SitemapDeltaService, // 🔄 Service Delta Sitemap exporté
    SitemapStreamingService, // 🗜️ Service Streaming Sitemap exporté
    SitemapUnifiedService, // 🗺️ Service Unifié SEO V5 exporté
    RobotsTxtService, // 🤖 Service Robots.txt exporté
    SeoHeadersService, // 📄 Service Headers SEO exporté
    UrlCompatibilityService, // 🔍 Service Compatibilité URLs exporté
    SitemapVehiclePiecesValidator, // 🛡️ Service Validation Sitemap exporté
    SeoLinkTrackingService, // 📊 Service Tracking Liens Internes exporté
    InternalLinkingService, // 🔗 Service Maillage Interne Centralisé exporté
    PurchaseGuideValidatorService, // 🛡️ Service Validation SEO Guides d'Achat exporté
    SeoMatriceService, // 📊 Service Matrice SEO exporté
  ],
})
export class SeoModule {
  private readonly logger = new Logger(SeoModule.name);

  constructor() {
    this.logger.log('🗺️ SEO Module V5 Unified activé');
    this.logger.log('📊 Architecture Sitemap Consolidée:');
    this.logger.log('   • 9 types de sitemaps thématiques');
    this.logger.log('   • Support 700k+ URLs avec pagination');
    this.logger.log('   • Sharding 50k URLs par fichier');
    this.logger.log('✅ Services principaux:');
    this.logger.log('   • SitemapUnifiedService (🗺️ V5 - Service principal)');
    this.logger.log('   • DynamicSeoV4UltimateService (🎯 SEO dynamique)');
    this.logger.log('   • SeoService / SeoEnhancedService');
    this.logger.log('📋 Sitemaps générés:');
    this.logger.log('   1. sitemap-racine.xml (Homepage)');
    this.logger.log('   2. sitemap-categories.xml (~105 catégories)');
    this.logger.log('   3. sitemap-constructeurs.xml (~35 marques)');
    this.logger.log('   4. sitemap-modeles.xml (~1k modèles)');
    this.logger.log('   5. sitemap-types.xml (~12.7k motorisations)');
    this.logger.log('   6. sitemap-pieces-*.xml (~714k pièces shardées)');
    this.logger.log('   7. sitemap-blog.xml (~109 articles)');
    this.logger.log('   8. sitemap-pages.xml (~9 pages)');
    this.logger.log('   9. sitemap.xml (Index principal)');
    this.logger.log('🔧 Endpoint: POST /api/sitemap/generate-all');
  }
}

/**
 * 📊 EXPORTS POUR V4 ULTIMATE
 */
export { SeoVariables } from './dynamic-seo-v4-ultimate.service';
