/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: 410.page.for.old.link.php
 * Module: errors
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { Page410ForOldLinkService } from './410-page-for-old-link.service';
import { Page410ForOldLinkDto } from './dto/410-page-for-old-link.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('errors')
@Controller('errors/410-page-for-old-link')
export class Page410ForOldLinkController {
  constructor(private readonly 410-page-for-old-linkService: Page410ForOldLinkService) {}

  @Get()
  @ApiOperation({ summary: 'Get 410-page-for-old-link data' })
  @ApiResponse({ status: 200, description: '410-page-for-old-link data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.410-page-for-old-linkService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process 410-page-for-old-link form' })
  @ApiResponse({ status: 201, description: '410-page-for-old-link processed successfully' })
  async processForm(@Body() dto: Page410ForOldLinkDto, @Session() session: any) {
    return this.410-page-for-old-linkService.processForm(dto, session);
  }
}
