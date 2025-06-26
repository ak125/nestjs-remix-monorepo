/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Cyberplus.my.cart.payment.successController } from './cyberplus.my.cart.payment.success.controller';
import { Cyberplus.my.cart.payment.successService } from './cyberplus.my.cart.payment.success.service';

@Module({
  controllers: [Cyberplus.my.cart.payment.successController],
  providers: [Cyberplus.my.cart.payment.successService],
  exports: [Cyberplus.my.cart.payment.successService]
})
export class Cyberplus.my.cart.payment.successModule {}
