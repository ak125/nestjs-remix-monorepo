/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

import { Module } from '@nestjs/common';
import { ProductsGammeController } from './products-gamme.controller';
import { ProductsGammeService } from './products-gamme.service';

@Module({
  controllers: [ProductsGammeController],
  providers: [ProductsGammeService],
  exports: [ProductsGammeService]
})
export class ProductsGammeModule {}
