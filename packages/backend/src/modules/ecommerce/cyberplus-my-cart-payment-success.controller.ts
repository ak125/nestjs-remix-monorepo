/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: cyberplus.my.cart.payment.success.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { CyberplusMyCartPaymentSuccessService } from './cyberplus-my-cart-payment-success.service';
import { CyberplusMyCartPaymentSuccessDto } from './dto/cyberplus-my-cart-payment-success.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/cyberplus-my-cart-payment-success')
export class CyberplusMyCartPaymentSuccessController {
  constructor(private readonly cyberplus-my-cart-payment-successService: CyberplusMyCartPaymentSuccessService) {}

  @Get()
  @ApiOperation({ summary: 'Get cyberplus-my-cart-payment-success data' })
  @ApiResponse({ status: 200, description: 'cyberplus-my-cart-payment-success data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.cyberplus-my-cart-payment-successService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process cyberplus-my-cart-payment-success form' })
  @ApiResponse({ status: 201, description: 'cyberplus-my-cart-payment-success processed successfully' })
  async processForm(@Body() dto: CyberplusMyCartPaymentSuccessDto, @Session() session: any) {
    return this.cyberplus-my-cart-payment-successService.processForm(dto, session);
  }
}
