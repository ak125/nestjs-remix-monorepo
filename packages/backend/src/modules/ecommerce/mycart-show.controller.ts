/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: mycart.show.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MycartShowService } from './mycart-show.service';
import { MycartShowDto } from './dto/mycart-show.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/mycart-show')
export class MycartShowController {
  constructor(private readonly mycart-showService: MycartShowService) {}

  @Get()
  @ApiOperation({ summary: 'Get mycart-show data' })
  @ApiResponse({ status: 200, description: 'mycart-show data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.mycart-showService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process mycart-show form' })
  @ApiResponse({ status: 201, description: 'mycart-show processed successfully' })
  async processForm(@Body() dto: MycartShowDto, @Session() session: any) {
    return this.mycart-showService.processForm(dto, session);
  }
}
