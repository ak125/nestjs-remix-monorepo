/**
 * 🔥 SEO MODULE - FACADE PATTERN (P3.2 Decomposition)
 *
 * Ce module est une facade qui importe les sous-modules SEO spécialisés:
 * - SeoValidationModule: Validators (PageRole, Quality, PurchaseGuide)
 * - SeoLinkingModule: Maillage interne (Links, Tracking, Breadcrumbs)
 * - SeoMonitoringModule: Analytics & KPIs (Dashboard, Risk, Googlebot)
 * - SeoSitemapModule: Sitemaps V10 (Generation, Scoring, Hubs)
 * - SeoContentModule: Contenu RAG (Reference R4, Diagnostic R5, Generator)
 *
 * Services CORE restants dans ce module:
 * - SeoService, SeoEnhancedService, DynamicSeoV4UltimateService
 * - HreflangService, RobotsTxtService, SeoHeadersService, ProductImageService
 * - UrlCompatibilityService
 */

import { Module, Logger, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';

// ═══════════════════════════════════════════════════════════════════════════
// 📦 SOUS-MODULES SEO (P3.2 Decomposition)
// ═══════════════════════════════════════════════════════════════════════════
import { SeoValidationModule } from '../seo-validation/seo-validation.module';
import { SeoLinkingModule } from '../seo-linking/seo-linking.module';
import { SeoMonitoringModule } from '../seo-monitoring/seo-monitoring.module';
import { SeoSitemapModule } from '../seo-sitemap/seo-sitemap.module';
import { SeoContentModule } from '../seo-content/seo-content.module';

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 MODULES EXTERNES
// ═══════════════════════════════════════════════════════════════════════════
import { WorkerModule } from '../../workers/worker.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AiContentModule } from '../ai-content/ai-content.module';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 SERVICES CORE (restent dans ce module)
// ═══════════════════════════════════════════════════════════════════════════
import { SeoService } from './seo.service';
import { SeoEnhancedService } from './seo-enhanced.service';
import { DynamicSeoV4UltimateService } from './dynamic-seo-v4-ultimate.service';
import { SeoV4SwitchEngineService } from './services/seo-v4-switch-engine.service';
import { SeoV4MonitoringService } from './services/seo-v4-monitoring.service';
import { HreflangService } from './services/hreflang.service';
import { ProductImageService } from './services/product-image.service';
import { RobotsTxtService } from './services/robots-txt.service';
import { SeoHeadersService } from './services/seo-headers.service';
import { UrlCompatibilityService } from './services/url-compatibility.service';

// ═══════════════════════════════════════════════════════════════════════════
// 🎮 CONTRÔLEURS CORE (restent dans ce module)
// ═══════════════════════════════════════════════════════════════════════════
import { SeoController } from './seo.controller';
import { SeoEnhancedController } from './seo-enhanced.controller';
import { DynamicSeoController } from './dynamic-seo.controller';
import { RobotsTxtController } from './controllers/robots-txt.controller';
import { SeoVariationsController } from './seo-variations.controller';
import { SeoMonitorController } from './controllers/seo-monitor.controller';

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ INTERCEPTORS GLOBAUX
// ═══════════════════════════════════════════════════════════════════════════
import { SeoHeadersInterceptor } from './interceptors/seo-headers.interceptor';
import { PageRoleValidationInterceptor } from './interceptors/page-role-validation.interceptor';

@Module({
  imports: [
    ConfigModule,

    // 📦 Sous-modules SEO (P3.2 Decomposition)
    forwardRef(() => SeoValidationModule),
    forwardRef(() => SeoLinkingModule),
    forwardRef(() => SeoMonitoringModule),
    forwardRef(() => SeoSitemapModule),
    forwardRef(() => SeoContentModule),

    // 🔧 Modules externes
    WorkerModule,
    forwardRef(() => CatalogModule),
    forwardRef(() => AiContentModule),

    // 🎯 Cache in-memory pour SEO V4 Ultimate
    NestCacheModule.register({
      ttl: 3600,
      max: 1000,
      isGlobal: false,
    }),
  ],

  controllers: [
    // 🎮 Contrôleurs CORE uniquement
    SeoController,
    SeoEnhancedController,
    DynamicSeoController,
    RobotsTxtController,
    SeoVariationsController,
    SeoMonitorController,
  ],

  providers: [
    // 🎯 Services CORE uniquement
    SeoService,
    SeoEnhancedService,
    SeoV4SwitchEngineService,
    SeoV4MonitoringService,
    DynamicSeoV4UltimateService,
    HreflangService,
    ProductImageService,
    RobotsTxtService,
    SeoHeadersService,
    UrlCompatibilityService,

    // 🛡️ Interceptors globaux
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
    // ═══════════════════════════════════════════════════════════════════════
    // 📦 RE-EXPORT SOUS-MODULES (pour accès via SeoModule)
    // ═══════════════════════════════════════════════════════════════════════
    SeoValidationModule,
    SeoLinkingModule,
    SeoMonitoringModule,
    SeoSitemapModule,
    SeoContentModule,

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 SERVICES CORE
    // ═══════════════════════════════════════════════════════════════════════
    SeoService,
    SeoEnhancedService,
    DynamicSeoV4UltimateService,
    HreflangService,
    ProductImageService,
    RobotsTxtService,
    SeoHeadersService,
    UrlCompatibilityService,
  ],
})
export class SeoModule {
  private readonly logger = new Logger(SeoModule.name);

  constructor() {
    this.logger.log('🔥 SEO Module V10 Facade activé (P3.2 Decomposition)');
    this.logger.log('📦 Sous-modules importés:');
    this.logger.log('   • SeoValidationModule (3 validators)');
    this.logger.log('   • SeoLinkingModule (3 services)');
    this.logger.log('   • SeoMonitoringModule (7 services)');
    this.logger.log('   • SeoSitemapModule (7 services)');
    this.logger.log('   • SeoContentModule (3 services)');
    this.logger.log(
      '🎯 Services CORE: 8 (SeoService, DynamicSeoV4Ultimate, etc.)',
    );
  }
}

/**
 * 📊 EXPORTS POUR V4 ULTIMATE
 */
export { SeoVariables } from './seo-v4.types';

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
