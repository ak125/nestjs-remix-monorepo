/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

import { Module } from '@nestjs/common';
import { MyspacePswdProceedController } from './myspace-pswd-proceed.controller';
import { MyspacePswdProceedService } from './myspace-pswd-proceed.service';

@Module({
  controllers: [MyspacePswdProceedController],
  providers: [MyspacePswdProceedService],
  exports: [MyspacePswdProceedService]
})
export class MyspacePswdProceedModule {}
