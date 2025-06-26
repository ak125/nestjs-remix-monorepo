/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: cyberplus.my.cart.payment.result.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { CyberplusMyCartPaymentResultService } from './cyberplus-my-cart-payment-result.service';
import { CyberplusMyCartPaymentResultDto } from './dto/cyberplus-my-cart-payment-result.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/cyberplus-my-cart-payment-result')
export class CyberplusMyCartPaymentResultController {
  constructor(private readonly cyberplus-my-cart-payment-resultService: CyberplusMyCartPaymentResultService) {}

  @Get()
  @ApiOperation({ summary: 'Get cyberplus-my-cart-payment-result data' })
  @ApiResponse({ status: 200, description: 'cyberplus-my-cart-payment-result data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.cyberplus-my-cart-payment-resultService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process cyberplus-my-cart-payment-result form' })
  @ApiResponse({ status: 201, description: 'cyberplus-my-cart-payment-result processed successfully' })
  async processForm(@Body() dto: CyberplusMyCartPaymentResultDto, @Session() session: any) {
    return this.cyberplus-my-cart-payment-resultService.processForm(dto, session);
  }
}
