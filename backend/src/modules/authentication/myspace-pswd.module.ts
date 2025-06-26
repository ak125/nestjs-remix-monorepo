/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

import { Module } from '@nestjs/common';
import { MyspacePswdController } from './myspace-pswd.controller';
import { MyspacePswdService } from './myspace-pswd.service';

@Module({
  controllers: [MyspacePswdController],
  providers: [MyspacePswdService],
  exports: [MyspacePswdService]
})
export class MyspacePswdModule {}
