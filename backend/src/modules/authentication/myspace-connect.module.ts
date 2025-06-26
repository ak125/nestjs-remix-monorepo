/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

import { Module } from '@nestjs/common';
import { MyspaceConnectController } from './myspace-connect.controller';
import { MyspaceConnectService } from './myspace-connect.service';

@Module({
  controllers: [MyspaceConnectController],
  providers: [MyspaceConnectService],
  exports: [MyspaceConnectService]
})
export class MyspaceConnectModule {}
