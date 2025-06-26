/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

import { Module } from '@nestjs/common';
import { ProductsCarGammeFicheController } from './products-car-gamme-fiche.controller';
import { ProductsCarGammeFicheService } from './products-car-gamme-fiche.service';

@Module({
  controllers: [ProductsCarGammeFicheController],
  providers: [ProductsCarGammeFicheService],
  exports: [ProductsCarGammeFicheService]
})
export class ProductsCarGammeFicheModule {}
