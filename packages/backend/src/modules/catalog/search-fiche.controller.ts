/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: search.fiche.php
 * Module: catalog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { SearchFicheService } from './search-fiche.service';
import { SearchFicheDto } from './dto/search-fiche.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('catalog')
@Controller('catalog/search-fiche')
export class SearchFicheController {
  constructor(private readonly search-ficheService: SearchFicheService) {}

  @Get()
  @ApiOperation({ summary: 'Get search-fiche data' })
  @ApiResponse({ status: 200, description: 'search-fiche data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.search-ficheService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process search-fiche form' })
  @ApiResponse({ status: 201, description: 'search-fiche processed successfully' })
  async processForm(@Body() dto: SearchFicheDto, @Session() session: any) {
    return this.search-ficheService.processForm(dto, session);
  }
}
