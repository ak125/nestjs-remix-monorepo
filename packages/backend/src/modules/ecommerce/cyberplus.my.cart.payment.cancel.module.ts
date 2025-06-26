/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Cyberplus.my.cart.payment.cancelController } from './cyberplus.my.cart.payment.cancel.controller';
import { Cyberplus.my.cart.payment.cancelService } from './cyberplus.my.cart.payment.cancel.service';

@Module({
  controllers: [Cyberplus.my.cart.payment.cancelController],
  providers: [Cyberplus.my.cart.payment.cancelService],
  exports: [Cyberplus.my.cart.payment.cancelService]
})
export class Cyberplus.my.cart.payment.cancelModule {}
