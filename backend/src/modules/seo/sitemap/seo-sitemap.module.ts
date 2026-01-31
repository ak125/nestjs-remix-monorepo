/**
 * SeoSitemapModule
 *
 * Sous-module dédié à la génération et gestion des sitemaps :
 * - Sitemap V10 (température hot/stable/cold, 714k URLs)
 * - Streaming & Delta sitemaps
 * - Hygiène et scoring des URLs
 * - Hubs de crawl (money/new-pages/gammes/vehicules)
 *
 * @see .spec/00-canon/architecture.md - SEO Module refactoring
 */
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// 🛡️ Module Catalog (pour CatalogDataIntegrityService)
import { CatalogModule } from '../../catalog/catalog.module';

// 🚀 Cache Redis personnalisé
import { CacheModule } from '../../../cache/cache.module';

// =====================================================
// SERVICES - Génération Sitemaps
// =====================================================

// V10 Core
import { SitemapV10Service } from '../services/sitemap-v10.service';
import { SitemapV10ScoringService } from '../services/sitemap-v10-scoring.service';
import { SitemapV10HubsService } from '../services/sitemap-v10-hubs.service';

// Streaming & Delta
import { SitemapStreamingService } from '../services/sitemap-streaming.service';
import { SitemapDeltaService } from '../services/sitemap-delta.service';

// Hygiène & Validation
import { SitemapHygieneService } from '../services/sitemap-hygiene.service';
import { SitemapVehiclePiecesValidator } from '../services/sitemap-vehicle-pieces-validator.service';

// URL Compatibility
import { UrlCompatibilityService } from '../services/url-compatibility.service';

// Product Images (pour sitemaps images)
import { ProductImageService } from '../services/product-image.service';

// =====================================================
// CONTROLLERS - API Sitemaps
// =====================================================

import { SitemapV10Controller } from '../controllers/sitemap-v10.controller';
import { SitemapUnifiedController } from '../controllers/sitemap-unified.controller';
import { SitemapStreamingController } from '../controllers/sitemap-streaming.controller';
import { SitemapDeltaController } from '../controllers/sitemap-delta.controller';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => CatalogModule), // Pour CatalogDataIntegrityService
    CacheModule, // Cache Redis pour delta/streaming
  ],

  controllers: [
    SitemapV10Controller, // POST /api/sitemap/v10/generate-all
    SitemapUnifiedController, // POST /api/sitemap/generate-all (legacy → V10)
    SitemapStreamingController, // POST /sitemap-v2/streaming/generate
    SitemapDeltaController, // POST /api/sitemap/delta/generate
  ],

  providers: [
    // V10 Core services
    SitemapV10Service,
    SitemapV10ScoringService,
    SitemapV10HubsService,

    // Streaming & Delta
    SitemapStreamingService,
    SitemapDeltaService,

    // Hygiène & Validation
    SitemapHygieneService,
    SitemapVehiclePiecesValidator,

    // URL compatibility
    UrlCompatibilityService,

    // Images
    ProductImageService,
  ],

  exports: [
    // Exported for use by other modules
    SitemapV10Service,
    SitemapV10ScoringService,
    SitemapV10HubsService,
    SitemapStreamingService,
    SitemapDeltaService,
    SitemapHygieneService,
    SitemapVehiclePiecesValidator,
    UrlCompatibilityService,
    ProductImageService,
  ],
})
export class SeoSitemapModule {}
