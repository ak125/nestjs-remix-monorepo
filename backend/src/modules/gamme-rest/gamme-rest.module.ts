import { Module } from '@nestjs/common';
import { GammeRestController } from './gamme-rest.controller';

@Module({
  controllers: [GammeRestController],
})
export class GammeRestModule {}