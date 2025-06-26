/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Mycart.add.qtyController } from './mycart.add.qty.controller';
import { Mycart.add.qtyService } from './mycart.add.qty.service';

@Module({
  controllers: [Mycart.add.qtyController],
  providers: [Mycart.add.qtyService],
  exports: [Mycart.add.qtyService]
})
export class Mycart.add.qtyModule {}
