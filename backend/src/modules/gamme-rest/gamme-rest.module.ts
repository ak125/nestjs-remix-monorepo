import { Module } from '@nestjs/common';
import { GammeRestOptimizedController } from './gamme-rest-optimized.controller';
import { GammeRestRpcV2Controller } from './gamme-rest-rpc-v2.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { DatabaseModule } from '../../database/database.module';
import { SeoModule } from '../seo/seo.module';
import {
  GammeDataTransformerService,
  GammeRpcService,
  GammeResponseBuilderService,
  GammePageDataService,
  BuyingGuideDataService,
} from './services';

/**
 * 🚀 Module Gamme REST - Architecture modulaire
 *
 * - GammeRestRpcV2Controller: Endpoint ultra-optimisé (~75ms)
 * - GammeRestOptimizedController: Fallback classique (~680ms)
 * - Services réutilisables pour transformation de données
 */
@Module({
  imports: [CatalogModule, DatabaseModule, SeoModule],
  controllers: [
    GammeRestOptimizedController, // Fallback automatique
    GammeRestRpcV2Controller, // RPC V2 ultra-optimisé
  ],
  providers: [
    GammeDataTransformerService,
    GammeRpcService,
    GammeResponseBuilderService,
    GammePageDataService,
    BuyingGuideDataService,
  ],
})
export class GammeRestModule {}
