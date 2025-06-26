/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Mycart.validateController } from './mycart.validate.controller';
import { Mycart.validateService } from './mycart.validate.service';

@Module({
  controllers: [Mycart.validateController],
  providers: [Mycart.validateService],
  exports: [Mycart.validateService]
})
export class Mycart.validateModule {}
