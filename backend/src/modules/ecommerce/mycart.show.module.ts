/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Mycart.showController } from './mycart.show.controller';
import { Mycart.showService } from './mycart.show.service';

@Module({
  controllers: [Mycart.showController],
  providers: [Mycart.showService],
  exports: [Mycart.showService]
})
export class Mycart.showModule {}
