/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: mycart.proceed.to.pay.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MycartProceedToPayService } from './mycart-proceed-to-pay.service';
import { MycartProceedToPayDto } from './dto/mycart-proceed-to-pay.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/mycart-proceed-to-pay')
export class MycartProceedToPayController {
  constructor(private readonly mycart-proceed-to-payService: MycartProceedToPayService) {}

  @Get()
  @ApiOperation({ summary: 'Get mycart-proceed-to-pay data' })
  @ApiResponse({ status: 200, description: 'mycart-proceed-to-pay data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.mycart-proceed-to-payService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process mycart-proceed-to-pay form' })
  @ApiResponse({ status: 201, description: 'mycart-proceed-to-pay processed successfully' })
  async processForm(@Body() dto: MycartProceedToPayDto, @Session() session: any) {
    return this.mycart-proceed-to-payService.processForm(dto, session);
  }
}
