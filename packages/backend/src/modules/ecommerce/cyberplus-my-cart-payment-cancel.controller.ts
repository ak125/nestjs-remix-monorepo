/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: cyberplus.my.cart.payment.cancel.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { CyberplusMyCartPaymentCancelService } from './cyberplus-my-cart-payment-cancel.service';
import { CyberplusMyCartPaymentCancelDto } from './dto/cyberplus-my-cart-payment-cancel.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/cyberplus-my-cart-payment-cancel')
export class CyberplusMyCartPaymentCancelController {
  constructor(private readonly cyberplus-my-cart-payment-cancelService: CyberplusMyCartPaymentCancelService) {}

  @Get()
  @ApiOperation({ summary: 'Get cyberplus-my-cart-payment-cancel data' })
  @ApiResponse({ status: 200, description: 'cyberplus-my-cart-payment-cancel data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.cyberplus-my-cart-payment-cancelService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process cyberplus-my-cart-payment-cancel form' })
  @ApiResponse({ status: 201, description: 'cyberplus-my-cart-payment-cancel processed successfully' })
  async processForm(@Body() dto: CyberplusMyCartPaymentCancelDto, @Session() session: any) {
    return this.cyberplus-my-cart-payment-cancelService.processForm(dto, session);
  }
}
