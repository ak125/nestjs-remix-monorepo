/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: mycart.add.qty.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MycartAddQtyService } from './mycart-add-qty.service';
import { MycartAddQtyDto } from './dto/mycart-add-qty.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/mycart-add-qty')
export class MycartAddQtyController {
  constructor(private readonly mycart-add-qtyService: MycartAddQtyService) {}

  @Get()
  @ApiOperation({ summary: 'Get mycart-add-qty data' })
  @ApiResponse({ status: 200, description: 'mycart-add-qty data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.mycart-add-qtyService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process mycart-add-qty form' })
  @ApiResponse({ status: 201, description: 'mycart-add-qty processed successfully' })
  async processForm(@Body() dto: MycartAddQtyDto, @Session() session: any) {
    return this.mycart-add-qtyService.processForm(dto, session);
  }
}
