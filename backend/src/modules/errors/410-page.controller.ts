/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: 410.page.php
 * Module: errors
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { Page410Service } from './410-page.service';
import { Page410Dto } from './dto/410-page.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('errors')
@Controller('errors/410-page')
export class Page410Controller {
  constructor(private readonly 410-pageService: Page410Service) {}

  @Get()
  @ApiOperation({ summary: 'Get 410-page data' })
  @ApiResponse({ status: 200, description: '410-page data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.410-pageService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process 410-page form' })
  @ApiResponse({ status: 201, description: '410-page processed successfully' })
  async processForm(@Body() dto: Page410Dto, @Session() session: any) {
    return this.410-pageService.processForm(dto, session);
  }
}
