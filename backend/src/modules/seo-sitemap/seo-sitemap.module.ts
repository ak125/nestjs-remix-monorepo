/**
 * 🗺️ MODULE SEO SITEMAP
 *
 * Regroupe tous les services de génération de sitemaps V10:
 * - SitemapV10Service: Génération principale (7 types, 714k URLs)
 * - SitemapV10HubsService: Hubs de crawl pour Googlebot
 * - SitemapV10ScoringService: Scoring température (hot/stable/cold)
 * - SitemapDeltaService: Diffs journaliers (sitemap-latest.xml)
 * - SitemapStreamingService: Compression GZIP pour gros sitemaps
 * - SitemapHygieneService: Validation & nettoyage (duplicates, broken links)
 * - SitemapVehiclePiecesValidator: Cross-validation véhicule/pièces
 *
 * Contrôleurs:
 * - SitemapV10Controller, SitemapUnifiedController
 * - SitemapStreamingController, SitemapDeltaController
 */

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Module Cache Redis pour sitemap delta
import { CacheModule } from '../../cache/cache.module';

// Module Catalog pour validation véhicule-pièces
import { CatalogModule } from '../catalog/catalog.module';

// Services sitemap (import depuis seo/ pour compatibilité)
import { SitemapV10Service } from '../seo/services/sitemap-v10.service';
import { SitemapV10XmlService } from '../seo/services/sitemap-v10-xml.service';
import { SitemapV10DataService } from '../seo/services/sitemap-v10-data.service';
import { SitemapV10StaticService } from '../seo/services/sitemap-v10-static.service';
import { SitemapV10PiecesService } from '../seo/services/sitemap-v10-pieces.service';
import { SitemapV10HubsService } from '../seo/services/sitemap-v10-hubs.service';
import { HubsClusterService } from '../seo/services/sitemap-v10-hubs-cluster.service';
import { HubsPriorityService } from '../seo/services/sitemap-v10-hubs-priority.service';
import { HubsVehicleService } from '../seo/services/sitemap-v10-hubs-vehicle.service';
import { SitemapV10ScoringService } from '../seo/services/sitemap-v10-scoring.service';
import { SitemapDeltaService } from '../seo/services/sitemap-delta.service';
import { SitemapStreamingService } from '../seo/services/sitemap-streaming.service';
import { SitemapHygieneService } from '../seo/services/sitemap-hygiene.service';
import { SitemapVehiclePiecesValidator } from '../seo/services/sitemap-vehicle-pieces-validator.service';

// Contrôleurs
import { SitemapV10Controller } from '../seo/controllers/sitemap-v10.controller';
import { SitemapUnifiedController } from '../seo/controllers/sitemap-unified.controller';
import { SitemapStreamingController } from '../seo/controllers/sitemap-streaming.controller';
import { SitemapDeltaController } from '../seo/controllers/sitemap-delta.controller';

@Module({
  imports: [
    ConfigModule,
    CacheModule, // Redis cache pour delta
    forwardRef(() => CatalogModule), // Pour CatalogDataIntegrityService
  ],

  controllers: [
    SitemapV10Controller,
    SitemapUnifiedController,
    SitemapStreamingController,
    SitemapDeltaController,
  ],

  providers: [
    // Leaf services (no cross-dependencies)
    SitemapV10XmlService,
    SitemapV10DataService,
    // Generator services (depend on leaf services)
    SitemapV10StaticService,
    SitemapV10PiecesService,
    // Orchestrator (depends on all above)
    SitemapV10Service,
    // Hub services
    HubsClusterService,
    HubsPriorityService,
    HubsVehicleService,
    SitemapV10HubsService,
    SitemapV10ScoringService,
    SitemapDeltaService,
    SitemapStreamingService,
    SitemapHygieneService,
    SitemapVehiclePiecesValidator,
  ],

  exports: [
    SitemapV10Service,
    SitemapV10HubsService,
    SitemapV10ScoringService,
    SitemapDeltaService,
    SitemapStreamingService,
    SitemapHygieneService,
    SitemapVehiclePiecesValidator,
  ],
})
export class SeoSitemapModule {}

// Re-export types
export { TemperatureBucket } from '../seo/services/sitemap-v10.types';
