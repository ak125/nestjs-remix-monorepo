import { Module } from '@nestjs/common';
import { GammeRestOptimizedController } from './gamme-rest-optimized.controller';
import { GammeRestRpcV2Controller } from './gamme-rest-rpc-v2.controller';
import { AdminGammeCacheController } from './controllers/admin-gamme-cache.controller'; // 🗄️ ADR-024 __gamme_page_cache
import { CatalogModule } from '../catalog/catalog.module';
import { DatabaseModule } from '../../database/database.module';
import { SeoModule } from '../seo/seo.module';
import { AdminModule } from '../admin/admin.module';
import {
  GammeDataTransformerService,
  GammeRpcService,
  GammeResponseBuilderService,
  GammePageDataService,
  BuyingGuideDataService,
} from './services';
import { R1RelatedResourcesService } from './services/r1-related-resources.service';

/**
 * 🚀 Module Gamme REST - Architecture modulaire
 *
 * - GammeRestRpcV2Controller: Endpoint ultra-optimisé (~75ms)
 * - GammeRestOptimizedController: Fallback classique (~680ms)
 * - AdminGammeCacheController: Admin endpoints pour __gamme_page_cache (ADR-024 Phase 1)
 * - Services réutilisables pour transformation de données
 */
@Module({
  imports: [CatalogModule, DatabaseModule, SeoModule, AdminModule],
  controllers: [
    GammeRestOptimizedController, // Fallback automatique
    GammeRestRpcV2Controller, // RPC V2 ultra-optimisé
    AdminGammeCacheController, // ADR-024 admin /api/admin/gamme-cache/*
  ],
  providers: [
    GammeDataTransformerService,
    GammeRpcService,
    GammeResponseBuilderService,
    GammePageDataService,
    BuyingGuideDataService,
    R1RelatedResourcesService,
  ],
})
export class GammeRestModule {}
