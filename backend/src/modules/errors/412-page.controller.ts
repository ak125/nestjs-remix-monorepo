/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: 412.page.php
 * Module: errors
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { Page412Service } from './412-page.service';
import { Page412Dto } from './dto/412-page.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('errors')
@Controller('errors/412-page')
export class Page412Controller {
  constructor(private readonly 412-pageService: Page412Service) {}

  @Get()
  @ApiOperation({ summary: 'Get 412-page data' })
  @ApiResponse({ status: 200, description: '412-page data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.412-pageService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process 412-page form' })
  @ApiResponse({ status: 201, description: '412-page processed successfully' })
  async processForm(@Body() dto: Page412Dto, @Session() session: any) {
    return this.412-pageService.processForm(dto, session);
  }
}
