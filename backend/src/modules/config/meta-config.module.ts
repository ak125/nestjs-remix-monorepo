/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: core
 */

import { Module } from '@nestjs/common';
import { MetaConfController } from './meta.conf.controller';
import { MetaConfService } from './meta.conf.service';

@Module({
  controllers: [MetaConfController],
  providers: [MetaConfService],
  exports: [MetaConfService]
})
export class MetaConfModule {}
