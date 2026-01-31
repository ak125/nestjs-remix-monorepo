/**
 * SeoContentModule
 *
 * Sous-module dédié à la génération de contenu SEO :
 * - Dynamic SEO V4 Ultimate (title, description, h1, content, keywords)
 * - Hreflang multilingual
 * - Pages Référence (R4) et Diagnostic (R5)
 *
 * @see .spec/00-canon/architecture.md - SEO Module refactoring
 */
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';

// 🚀 Database Module pour Supabase
import { DatabaseModule } from '../../../database/database.module';

// 🔄 Import cross-module pour dépendances SeoController
import { SeoSitemapModule } from '../sitemap';
import { SeoMonitoringModule } from '../monitoring';

// =====================================================
// SERVICES - Génération contenu SEO
// =====================================================

// Core SEO
import { SeoService } from '../seo.service';
import { SeoEnhancedService } from '../seo-enhanced.service';
import { DynamicSeoV4UltimateService } from '../dynamic-seo-v4-ultimate.service';

// Hreflang
import { HreflangService } from '../services/hreflang.service';

// R4 Référence & R5 Diagnostic
import { ReferenceService } from '../services/reference.service';
import { DiagnosticService } from '../services/diagnostic.service';

// =====================================================
// CONTROLLERS - API contenu SEO
// =====================================================

import { SeoController } from '../seo.controller';
import { SeoEnhancedController } from '../seo-enhanced.controller';
import { DynamicSeoController } from '../dynamic-seo.controller';
import { ReferenceController } from '../controllers/reference.controller';
import { DiagnosticController } from '../controllers/diagnostic.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,

    // 🎯 Cache @nestjs/cache-manager pour SEO V4 Ultimate (in-memory fallback)
    NestCacheModule.register({
      ttl: 3600, // 1 heure par défaut
      max: 500, // 500 entrées max pour content
      isGlobal: false,
    }),

    // 🔄 Cross-module imports pour dépendances SeoController
    forwardRef(() => SeoSitemapModule), // Pour UrlCompatibilityService
    forwardRef(() => SeoMonitoringModule), // Pour SeoKpisService
  ],

  controllers: [
    SeoController, // GET /api/seo/metadata, POST /api/seo/save
    SeoEnhancedController, // POST /api/seo-enhanced/generate
    DynamicSeoController, // POST /api/seo-dynamic-v4/generate-complete
    ReferenceController, // GET /api/seo/reference/:slug
    DiagnosticController, // GET /api/seo/diagnostic/:slug
  ],

  providers: [
    // Core SEO services
    SeoService,
    SeoEnhancedService,
    DynamicSeoV4UltimateService,

    // Hreflang
    HreflangService,

    // R4 & R5 pages
    ReferenceService,
    DiagnosticService,
  ],

  exports: [
    // Exported for use by other modules (parent SeoModule, etc.)
    SeoService,
    SeoEnhancedService,
    DynamicSeoV4UltimateService,
    HreflangService,
    ReferenceService,
    DiagnosticService,
  ],
})
export class SeoContentModule {}
