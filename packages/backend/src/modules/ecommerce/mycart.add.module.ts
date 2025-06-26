/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Mycart.addController } from './mycart.add.controller';
import { Mycart.addService } from './mycart.add.service';

@Module({
  controllers: [Mycart.addController],
  providers: [Mycart.addService],
  exports: [Mycart.addService]
})
export class Mycart.addModule {}
