/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

import { Module } from '@nestjs/common';
import { MyspaceAccountOutController } from './myspace-account-out.controller';
import { MyspaceAccountOutService } from './myspace-account-out.service';

@Module({
  controllers: [MyspaceAccountOutController],
  providers: [MyspaceAccountOutService],
  exports: [MyspaceAccountOutService]
})
export class MyspaceAccountOutModule {}
