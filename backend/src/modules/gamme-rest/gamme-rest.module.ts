import { Module } from '@nestjs/common';
import { GammeRestCompleteController } from './gamme-rest-complete.controller';
import { GammeRestOptimizedController } from './gamme-rest-optimized.controller';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [
    GammeRestCompleteController,
    GammeRestOptimizedController,
  ],
})
export class GammeRestModule {}
