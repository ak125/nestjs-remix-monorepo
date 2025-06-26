/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: mycart.add.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MycartAddService } from './mycart-add.service';
import { MycartAddDto } from './dto/mycart-add.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/mycart-add')
export class MycartAddController {
  constructor(private readonly mycart-addService: MycartAddService) {}

  @Get()
  @ApiOperation({ summary: 'Get mycart-add data' })
  @ApiResponse({ status: 200, description: 'mycart-add data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.mycart-addService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process mycart-add form' })
  @ApiResponse({ status: 201, description: 'mycart-add processed successfully' })
  async processForm(@Body() dto: MycartAddDto, @Session() session: any) {
    return this.mycart-addService.processForm(dto, session);
  }
}
