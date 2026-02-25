/**
 * SEO MODULE - Module unifie
 *
 * Regroupe tous les services SEO :
 * - Core: SeoService, DynamicSeoV4Ultimate, Hreflang, RobotsTxt, Headers, ProductImage
 * - Validation: PageRole, Quality, PurchaseGuide validators
 * - Linking: InternalLinking, LinkTracking, BreadcrumbCache
 * - Monitoring: KPIs, Pilotage, RiskFlags, Googlebot, LogIngestion
 * - Sitemap: V10 (7 types, 714k URLs), Hubs, Scoring, Delta, Streaming, Hygiene
 * - Content: Reference R4, Diagnostic R5, SeoGenerator
 */

import { Module, Logger, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';

// ═══════════════════════════════════════════════════════════════════════════
// MODULES EXTERNES
// ═══════════════════════════════════════════════════════════════════════════
import { DatabaseModule } from '../../database/database.module';
import { WorkerModule } from '../../workers/worker.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AiContentModule } from '../ai-content/ai-content.module';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES CORE
// ═══════════════════════════════════════════════════════════════════════════
import { SeoService } from './seo.service';
import { DynamicSeoV4UltimateService } from './dynamic-seo-v4-ultimate.service';
import { SeoV4SwitchEngineService } from './services/seo-v4-switch-engine.service';
import { SeoV4MonitoringService } from './services/seo-v4-monitoring.service';
import { HreflangService } from './services/hreflang.service';
import { ProductImageService } from './services/product-image.service';
import { RobotsTxtService } from './services/robots-txt.service';
import { SeoHeadersService } from './services/seo-headers.service';
import { UrlCompatibilityService } from './services/url-compatibility.service';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES VALIDATION (ex seo-validation)
// ═══════════════════════════════════════════════════════════════════════════
import { PageRoleValidatorService } from './services/page-role-validator.service';
import { QualityValidatorService } from './services/quality-validator.service';
import { PurchaseGuideValidatorService } from './validation/purchase-guide-validator.service';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES LINKING (ex seo-linking)
// ═══════════════════════════════════════════════════════════════════════════
import { InternalLinkingService } from './internal-linking.service';
import { SeoLinkTrackingService } from './seo-link-tracking.service';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES MONITORING (ex seo-monitoring)
// ═══════════════════════════════════════════════════════════════════════════
import { SeoMonitoringService } from './services/seo-monitoring.service';
import { SeoPilotageService } from './services/seo-pilotage.service';
import { SeoKpisService } from './services/seo-kpis.service';
import { RiskFlagsEngineService } from './services/risk-flags-engine.service';
import { GooglebotDetectorService } from './services/googlebot-detector.service';
import { KeywordsDashboardService } from './services/keywords-dashboard.service';
import { LogIngestionService } from './services/log-ingestion.service';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES SITEMAP (ex seo-sitemap)
// ═══════════════════════════════════════════════════════════════════════════
import { SitemapV10Service } from './services/sitemap-v10.service';
import { SitemapV10XmlService } from './services/sitemap-v10-xml.service';
import { SitemapV10DataService } from './services/sitemap-v10-data.service';
import { SitemapV10StaticService } from './services/sitemap-v10-static.service';
import { SitemapV10PiecesService } from './services/sitemap-v10-pieces.service';
import { SitemapV10HubsService } from './services/sitemap-v10-hubs.service';
import { HubsClusterService } from './services/sitemap-v10-hubs-cluster.service';
import { HubsPriorityService } from './services/sitemap-v10-hubs-priority.service';
import { HubsVehicleService } from './services/sitemap-v10-hubs-vehicle.service';
import { SitemapV10ScoringService } from './services/sitemap-v10-scoring.service';
import { SitemapDeltaService } from './services/sitemap-delta.service';
import { SitemapStreamingService } from './services/sitemap-streaming.service';
import { SitemapHygieneService } from './services/sitemap-hygiene.service';
import { SitemapVehiclePiecesValidator } from './services/sitemap-vehicle-pieces-validator.service';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES CONTENT (ex seo-content)
// ═══════════════════════════════════════════════════════════════════════════
import { ReferenceService } from './services/reference.service';
import { DiagnosticService } from './services/diagnostic.service';
import { SeoGeneratorService } from './services/seo-generator.service';

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLEURS CORE
// ═══════════════════════════════════════════════════════════════════════════
import { SeoController } from './seo.controller';
import { DynamicSeoController } from './dynamic-seo.controller';
import { RobotsTxtController } from './controllers/robots-txt.controller';
import { SeoVariationsController } from './seo-variations.controller';
import { SeoMonitorController } from './controllers/seo-monitor.controller';

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLEURS LINKING (ex seo-linking)
// ═══════════════════════════════════════════════════════════════════════════
import { SeoLinkTrackingController } from './seo-link-tracking.controller';

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLEURS MONITORING (ex seo-monitoring)
// ═══════════════════════════════════════════════════════════════════════════
import { SeoMonitoringController } from './controllers/seo-monitoring.controller';
import { SeoDashboardController } from './controllers/seo-dashboard.controller';
import { KeywordsDashboardController } from './controllers/keywords-dashboard.controller';
import { SeoPilotageController } from './controllers/seo-pilotage.controller';
import { SeoLogsController } from './controllers/seo-logs.controller';

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLEURS SITEMAP (ex seo-sitemap)
// ═══════════════════════════════════════════════════════════════════════════
import { SitemapV10Controller } from './controllers/sitemap-v10.controller';
import { SitemapUnifiedController } from './controllers/sitemap-unified.controller';
import { SitemapStreamingController } from './controllers/sitemap-streaming.controller';
import { SitemapDeltaController } from './controllers/sitemap-delta.controller';

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLEURS CONTENT (ex seo-content)
// ═══════════════════════════════════════════════════════════════════════════
import { ReferenceController } from './controllers/reference.controller';
import { DiagnosticController } from './controllers/diagnostic.controller';
import { SeoGeneratorController } from './controllers/seo-generator.controller';

// ═══════════════════════════════════════════════════════════════════════════
// INTERCEPTORS
// ═══════════════════════════════════════════════════════════════════════════
import { SeoHeadersInterceptor } from './interceptors/seo-headers.interceptor';
import { PageRoleValidationInterceptor } from './interceptors/page-role-validation.interceptor';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,

    // Modules externes
    WorkerModule,
    forwardRef(() => CatalogModule),
    forwardRef(() => AiContentModule),

    // Cache in-memory pour SEO V4 Ultimate
    NestCacheModule.register({
      ttl: 3600,
      max: 1000,
      isGlobal: false,
    }),
  ],

  controllers: [
    // Core
    SeoController,
    DynamicSeoController,
    RobotsTxtController,
    SeoVariationsController,
    SeoMonitorController,
    // Linking
    SeoLinkTrackingController,
    // Monitoring
    SeoMonitoringController,
    SeoDashboardController,
    KeywordsDashboardController,
    SeoPilotageController,
    SeoLogsController,
    // Sitemap
    SitemapV10Controller,
    SitemapUnifiedController,
    SitemapStreamingController,
    SitemapDeltaController,
    // Content
    ReferenceController,
    DiagnosticController,
    SeoGeneratorController,
  ],

  providers: [
    // Core
    SeoService,
    SeoV4SwitchEngineService,
    SeoV4MonitoringService,
    DynamicSeoV4UltimateService,
    HreflangService,
    ProductImageService,
    RobotsTxtService,
    SeoHeadersService,
    UrlCompatibilityService,
    // Validation
    PageRoleValidatorService,
    QualityValidatorService,
    PurchaseGuideValidatorService,
    // Linking
    InternalLinkingService,
    SeoLinkTrackingService,
    // Monitoring
    SeoMonitoringService,
    SeoPilotageService,
    SeoKpisService,
    RiskFlagsEngineService,
    GooglebotDetectorService,
    KeywordsDashboardService,
    LogIngestionService,
    // Sitemap
    SitemapV10XmlService,
    SitemapV10DataService,
    SitemapV10StaticService,
    SitemapV10PiecesService,
    SitemapV10Service,
    HubsClusterService,
    HubsPriorityService,
    HubsVehicleService,
    SitemapV10HubsService,
    SitemapV10ScoringService,
    SitemapDeltaService,
    SitemapStreamingService,
    SitemapHygieneService,
    SitemapVehiclePiecesValidator,
    // Content
    ReferenceService,
    DiagnosticService,
    SeoGeneratorService,

    // Interceptors globaux
    {
      provide: APP_INTERCEPTOR,
      useClass: SeoHeadersInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PageRoleValidationInterceptor,
    },

    // Logger V4
    {
      provide: 'SEO_V4_LOGGER',
      useFactory: () => new Logger('SeoModuleV4Ultimate'),
    },
  ],

  exports: [
    // Core
    SeoService,
    DynamicSeoV4UltimateService,
    HreflangService,
    ProductImageService,
    RobotsTxtService,
    SeoHeadersService,
    UrlCompatibilityService,
    // Validation
    PageRoleValidatorService,
    QualityValidatorService,
    PurchaseGuideValidatorService,
    // Linking
    InternalLinkingService,
    SeoLinkTrackingService,
    // Monitoring
    SeoMonitoringService,
    SeoPilotageService,
    SeoKpisService,
    RiskFlagsEngineService,
    GooglebotDetectorService,
    KeywordsDashboardService,
    LogIngestionService,
    // Sitemap
    SitemapV10Service,
    SitemapV10HubsService,
    SitemapV10ScoringService,
    SitemapDeltaService,
    SitemapStreamingService,
    SitemapHygieneService,
    SitemapVehiclePiecesValidator,
    // Content
    ReferenceService,
    DiagnosticService,
    SeoGeneratorService,
  ],
})
export class SeoModule {
  private readonly logger = new Logger(SeoModule.name);

  constructor() {
    this.logger.log('SEO Module unifie actif');
  }
}

/**
 * EXPORTS POUR V4 ULTIMATE
 */
export { SeoVariables } from './seo-v4.types';

/**
 * EXPORTS POUR ROLES DE PAGES (Phase 0)
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
