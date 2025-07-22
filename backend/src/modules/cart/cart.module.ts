import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Module({
  controllers: [CartController],
  providers: [CartService, SupabaseRestService],
  exports: [CartService],
})
export class CartModule {}
