import { Module } from '@nestjs/common';
// import { GammeRestController } from './gamme-rest.controller';
import { GammeRestCompleteController } from './gamme-rest-complete.controller';
import { GammeRestOptimizedController } from './gamme-rest-optimized.controller';

@Module({
  controllers: [
    // GammeRestController,
    GammeRestCompleteController,
    GammeRestOptimizedController,
  ],
})
export class GammeRestModule {}
