import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';

@Module({
  imports: [CartModule], // Pour ShippingCalculatorService
  providers: [ShippingService],
  controllers: [ShippingController],
  exports: [ShippingService],
})
export class ShippingModule {}
