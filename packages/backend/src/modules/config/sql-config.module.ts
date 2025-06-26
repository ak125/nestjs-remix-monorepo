/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: core
 */

import { Module } from '@nestjs/common';
import { SqlConfController } from './sql.conf.controller';
import { SqlConfService } from './sql.conf.service';

@Module({
  controllers: [SqlConfController],
  providers: [SqlConfService],
  exports: [SqlConfService]
})
export class SqlConfModule {}
