import { Module } from '@nestjs/common';
import { GammeRestCompleteController } from './gamme-rest-complete.controller';
import { GammeRestOptimizedController } from './gamme-rest-optimized.controller';
import { GammeRestRpcV2Controller } from './gamme-rest-rpc-v2.controller';
import { CacheModule } from '../../cache/cache.module';
import {
  GammeDataTransformerService,
  GammeRpcService,
  GammeResponseBuilderService,
} from './services';

/**
 * 🚀 Module Gamme REST - Architecture modulaire
 *
 * - GammeRestRpcV2Controller: Endpoint ultra-optimisé (~75ms)
 * - GammeRestOptimizedController: Fallback classique (~680ms)
 * - Services réutilisables pour transformation de données
 */
@Module({
  imports: [CacheModule],
  controllers: [
    GammeRestCompleteController,
    GammeRestOptimizedController, // Fallback automatique
    GammeRestRpcV2Controller, // RPC V2 ultra-optimisé
  ],
  providers: [
    GammeDataTransformerService,
    GammeRpcService,
    GammeResponseBuilderService,
  ],
})
export class GammeRestModule {}
