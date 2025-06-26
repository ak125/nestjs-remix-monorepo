/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: 404.page.php
 * Module: errors
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { Page404Service } from './404-page.service';
import { Page404Dto } from './dto/404-page.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('errors')
@Controller('errors/404-page')
export class Page404Controller {
  constructor(private readonly 404-pageService: Page404Service) {}

  @Get()
  @ApiOperation({ summary: 'Get 404-page data' })
  @ApiResponse({ status: 200, description: '404-page data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.404-pageService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process 404-page form' })
  @ApiResponse({ status: 201, description: '404-page processed successfully' })
  async processForm(@Body() dto: Page404Dto, @Session() session: any) {
    return this.404-pageService.processForm(dto, session);
  }
}
