/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: cyberplus.my.cart.payment.refused.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { CyberplusMyCartPaymentRefusedService } from './cyberplus-my-cart-payment-refused.service';
import { CyberplusMyCartPaymentRefusedDto } from './dto/cyberplus-my-cart-payment-refused.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/cyberplus-my-cart-payment-refused')
export class CyberplusMyCartPaymentRefusedController {
  constructor(private readonly cyberplus-my-cart-payment-refusedService: CyberplusMyCartPaymentRefusedService) {}

  @Get()
  @ApiOperation({ summary: 'Get cyberplus-my-cart-payment-refused data' })
  @ApiResponse({ status: 200, description: 'cyberplus-my-cart-payment-refused data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.cyberplus-my-cart-payment-refusedService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process cyberplus-my-cart-payment-refused form' })
  @ApiResponse({ status: 201, description: 'cyberplus-my-cart-payment-refused processed successfully' })
  async processForm(@Body() dto: CyberplusMyCartPaymentRefusedDto, @Session() session: any) {
    return this.cyberplus-my-cart-payment-refusedService.processForm(dto, session);
  }
}
