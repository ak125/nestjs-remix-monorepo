/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

import { Module } from '@nestjs/common';
import { ProductsCarGammeController } from './products-car-gamme.controller';
import { ProductsCarGammeService } from './products-car-gamme.service';

@Module({
  controllers: [ProductsCarGammeController],
  providers: [ProductsCarGammeService],
  exports: [ProductsCarGammeService]
})
export class ProductsCarGammeModule {}
