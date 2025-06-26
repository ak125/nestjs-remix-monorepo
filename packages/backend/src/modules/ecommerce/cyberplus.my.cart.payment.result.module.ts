/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Cyberplus.my.cart.payment.resultController } from './cyberplus.my.cart.payment.result.controller';
import { Cyberplus.my.cart.payment.resultService } from './cyberplus.my.cart.payment.result.service';

@Module({
  controllers: [Cyberplus.my.cart.payment.resultController],
  providers: [Cyberplus.my.cart.payment.resultService],
  exports: [Cyberplus.my.cart.payment.resultService]
})
export class Cyberplus.my.cart.payment.resultModule {}
