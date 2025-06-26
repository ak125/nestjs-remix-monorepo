/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

import { Module } from '@nestjs/common';
import { SearchFicheController } from './search-fiche.controller';
import { SearchFicheService } from './search-fiche.service';

@Module({
  controllers: [SearchFicheController],
  providers: [SearchFicheService],
  exports: [SearchFicheService]
})
export class SearchFicheModule {}
