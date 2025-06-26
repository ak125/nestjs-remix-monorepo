/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

import { Module } from '@nestjs/common';
import { MyspaceSubscribeController } from './myspace-subscribe.controller';
import { MyspaceSubscribeService } from './myspace-subscribe.service';

@Module({
  controllers: [MyspaceSubscribeController],
  providers: [MyspaceSubscribeService],
  exports: [MyspaceSubscribeService]
})
export class MyspaceSubscribeModule {}
