/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

import { Module } from '@nestjs/common';
import { MyspaceConnectTryController } from './myspace-connect-try.controller';
import { MyspaceConnectTryService } from './myspace-connect-try.service';

@Module({
  controllers: [MyspaceConnectTryController],
  providers: [MyspaceConnectTryService],
  exports: [MyspaceConnectTryService]
})
export class MyspaceConnectTryModule {}
