/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Cyberplus.my.cart.payment.refusedController } from './cyberplus.my.cart.payment.refused.controller';
import { Cyberplus.my.cart.payment.refusedService } from './cyberplus.my.cart.payment.refused.service';

@Module({
  controllers: [Cyberplus.my.cart.payment.refusedController],
  providers: [Cyberplus.my.cart.payment.refusedService],
  exports: [Cyberplus.my.cart.payment.refusedService]
})
export class Cyberplus.my.cart.payment.refusedModule {}
