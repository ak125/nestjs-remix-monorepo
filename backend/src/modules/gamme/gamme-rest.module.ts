/**
 * 🎯 GAMME REST MODULE
 */

import { Module } from '@nestjs/common';
import { GammeRestController } from './gamme-rest.controller';

@Module({
  controllers: [GammeRestController],
  providers: [],
  exports: [],
})
export class GammeRestModule {}
