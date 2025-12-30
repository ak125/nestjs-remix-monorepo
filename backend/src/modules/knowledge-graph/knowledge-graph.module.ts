/**
 * 🧠 Knowledge Graph Module - AI-COS v2.8.0
 *
 * Module NestJS pour le Knowledge Graph et le Reasoning Engine
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KgController } from './kg.controller';
import { KgService } from './kg.service';
import { KgDataService } from './kg-data.service';
import { KgSeedService } from './seed/kg-seed.service';

@Module({
  imports: [ConfigModule],
  controllers: [KgController],
  providers: [KgService, KgDataService, KgSeedService],
  exports: [KgService, KgDataService, KgSeedService],
})
export class KnowledgeGraphModule {}
