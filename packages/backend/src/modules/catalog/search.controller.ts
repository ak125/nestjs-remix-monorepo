/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: search.php
 * Module: catalog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('catalog')
@Controller('catalog/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Get search data' })
  @ApiResponse({ status: 200, description: 'search data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.searchService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process search form' })
  @ApiResponse({ status: 201, description: 'search processed successfully' })
  async processForm(@Body() dto: SearchDto, @Session() session: any) {
    return this.searchService.processForm(dto, session);
  }
}
