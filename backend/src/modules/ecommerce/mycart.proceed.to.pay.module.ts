/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

import { Module } from '@nestjs/common';
import { Mycart.proceed.to.payController } from './mycart.proceed.to.pay.controller';
import { Mycart.proceed.to.payService } from './mycart.proceed.to.pay.service';

@Module({
  controllers: [Mycart.proceed.to.payController],
  providers: [Mycart.proceed.to.payService],
  exports: [Mycart.proceed.to.payService]
})
export class Mycart.proceed.to.payModule {}
