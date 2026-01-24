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

// 🔥 Services Sitemap V10 (Température)
import { SitemapV10Service } from './services/sitemap-v10.service';
import { SitemapV10ScoringService } from './services/sitemap-v10-scoring.service';
import { SitemapV10HubsService } from './services/sitemap-v10-hubs.service';

// 📊 Services Dashboard Enterprise (Crawl/Index/Risk)
import { GooglebotDetectorService } from './services/googlebot-detector.service';
import { RiskFlagsEngineService } from './services/risk-flags-engine.service';

// 📊 Service Keywords Dashboard (V-Level par gamme)
import { KeywordsDashboardService } from './services/keywords-dashboard.service';

// 🎯 Service Validation Rôles de Pages (Phase 0 SEO)
import { PageRoleValidatorService } from './services/page-role-validator.service';

// 📖 Service Pages Référence (R4)
import { ReferenceService } from './services/reference.service';

// 🩺 Service Pages Diagnostic (R5 - Observable Pro)
import { DiagnosticService } from './services/diagnostic.service';

// 📊 Service Pilotage SEO (hebdo + mensuel)
import { SeoPilotageService } from './services/seo-pilotage.service';

// 📖 Contrôleur Pages Référence (R4)
import { ReferenceController } from './controllers/reference.controller';

// 🩺 Contrôleur Pages Diagnostic (R5 - Observable Pro)
import { DiagnosticController } from './controllers/diagnostic.controller';

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

// 🔥 Contrôleur Sitemap V10 (Température)
import { SitemapV10Controller } from './controllers/sitemap-v10.controller';

// 📊 Contrôleur Dashboard Enterprise
import { SeoDashboardController } from './controllers/seo-dashboard.controller';

// 📊 Contrôleur Keywords Dashboard (V-Level par gamme)
import { KeywordsDashboardController } from './controllers/keywords-dashboard.controller';

// 📊 Contrôleur Pilotage SEO (hebdo + mensuel + diagnostics)
import { SeoPilotageController } from './controllers/seo-pilotage.controller';

// 📊 Contrôleur SEO Logs (Meilisearch)
import { SeoLogsController } from './controllers/seo-logs.controller';

// 🛡️ Interceptor Headers SEO
import { SeoHeadersInterceptor } from './interceptors/seo-headers.interceptor';

// 🎯 Interceptor Validation Rôles de Pages (Phase B - Enforcement)
import { PageRoleValidationInterceptor } from './interceptors/page-role-validation.interceptor';

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
    SitemapV10Controller, // 🔥 Contrôleur Sitemap V10 (Température)
    SeoDashboardController, // 📊 Dashboard Enterprise (Crawl/Index/Risk)
    KeywordsDashboardController, // 📊 Dashboard Keywords SEO (V-Level par gamme)
    ReferenceController, // 📖 Contrôleur Pages Référence (R4)
    DiagnosticController, // 🩺 Contrôleur Pages Diagnostic (R5)
    SeoPilotageController, // 📊 Pilotage SEO (hebdo + mensuel + diagnostics)
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
    SitemapV10Service, // 🔥 Service Sitemap V10 (Température)
    SitemapV10ScoringService, // 🔥 Service Scoring V10
    SitemapV10HubsService, // 🔥 Service Hubs Crawl V10
    GooglebotDetectorService, // 📊 Service Detection Googlebot
    RiskFlagsEngineService, // 📊 Service Risk Flags Engine
    KeywordsDashboardService, // 📊 Service Keywords Dashboard (V-Level par gamme)
    PageRoleValidatorService, // 🎯 Service Validation Rôles de Pages (Phase 0 SEO)
    ReferenceService, // 📖 Service Pages Référence (R4)
    DiagnosticService, // 🩺 Service Pages Diagnostic (R5)
    SeoPilotageService, // 📊 Service Pilotage SEO (hebdo + mensuel)

    // 🛡️ Interceptor Headers SEO (activé globalement)
    {
      provide: APP_INTERCEPTOR,
      useClass: SeoHeadersInterceptor,
    },

    // 🎯 Interceptor Validation Rôles de Pages (Phase B - Monitoring)
    {
      provide: APP_INTERCEPTOR,
      useClass: PageRoleValidationInterceptor,
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
    RobotsTxtService, // 🤖 Service Robots.txt exporté
    SeoHeadersService, // 📄 Service Headers SEO exporté
    UrlCompatibilityService, // 🔍 Service Compatibilité URLs exporté
    SitemapVehiclePiecesValidator, // 🛡️ Service Validation Sitemap exporté
    SeoLinkTrackingService, // 📊 Service Tracking Liens Internes exporté
    InternalLinkingService, // 🔗 Service Maillage Interne Centralisé exporté
    PurchaseGuideValidatorService, // 🛡️ Service Validation SEO Guides d'Achat exporté
    SitemapV10Service, // 🔥 Service Sitemap V10 exporté
    SitemapV10ScoringService, // 🔥 Service Scoring V10 exporté
    SitemapV10HubsService, // 🔥 Service Hubs Crawl V10 exporté
    GooglebotDetectorService, // 📊 Service Detection Googlebot exporté
    RiskFlagsEngineService, // 📊 Service Risk Flags Engine exporté
    PageRoleValidatorService, // 🎯 Service Validation Rôles de Pages exporté
    ReferenceService, // 📖 Service Pages Référence (R4) exporté
    DiagnosticService, // 🩺 Service Pages Diagnostic (R5) exporté
    SeoPilotageService, // 📊 Service Pilotage SEO exporté
  ],
})
export class SeoModule {
  private readonly logger = new Logger(SeoModule.name);

  constructor() {
    this.logger.log('🔥 SEO Module V10 Unified activé (V9 supprimé)');
    this.logger.log('📊 Architecture Sitemap V10:');
    this.logger.log('   • Source: __sitemap_p_link (714k URLs)');
    this.logger.log('   • Temperature buckets: hot/stable/cold');
    this.logger.log('   • Sharding 50k URLs par fichier');
    this.logger.log('✅ Service principal: SitemapV10Service');
    this.logger.log('📋 Sitemaps générés:');
    this.logger.log('   1. sitemap-racine.xml (Homepage)');
    this.logger.log('   2. sitemap-categories.xml (~123 gammes INDEX)');
    this.logger.log(
      '   3. sitemap-vehicules.xml (~13.8k marques+modèles+types)',
    );
    this.logger.log('   4. sitemap-blog.xml (~109 articles)');
    this.logger.log('   5. sitemap-pages.xml (~9 pages)');
    this.logger.log(
      '   6. sitemap-{hot,stable,cold}-pieces-*.xml (~714k pièces)',
    );
    this.logger.log('   7. sitemap.xml (Index principal)');
    this.logger.log('🔧 Endpoint: POST /api/sitemap/generate-all (→ V10)');
    this.logger.log('🔧 Endpoint: POST /api/sitemap/v10/generate-all');
    this.logger.log('📊 Dashboard Enterprise (Crawl/Index/Risk):');
    this.logger.log('   • GooglebotDetectorService (logging passif)');
    this.logger.log(
      '   • RiskFlagsEngineService (ORPHAN/DUPLICATE/WEAK_CLUSTER/LOW_CRAWL/CONFUSION)',
    );
    this.logger.log('🔧 Endpoint: GET /api/seo/dashboard/stats');
  }
}

/**
 * 📊 EXPORTS POUR V4 ULTIMATE
 */
export { SeoVariables } from './dynamic-seo-v4-ultimate.service';

/**
 * 🎯 EXPORTS POUR RÔLES DE PAGES (Phase 0)
 */
export {
  PageRole,
  PAGE_ROLE_META,
  PAGE_ROLE_HIERARCHY,
  ALLOWED_LINKS,
  URL_ROLE_PATTERNS,
  getPageRoleFromUrl,
  isLinkAllowed,
} from './types/page-role.types';
