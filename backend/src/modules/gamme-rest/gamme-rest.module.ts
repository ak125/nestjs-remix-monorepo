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

@Module({
  imports: [CacheModule],
  controllers: [
    GammeRestCompleteController,
    GammeRestOptimizedController,
    GammeRestRpcV2Controller, // Nouveau contrôleur léger pour RPC V2
  ],
  providers: [
    GammeDataTransformerService,
    GammeRpcService,
    GammeResponseBuilderService,
  ],
})
export class GammeRestModule {}
