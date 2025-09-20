import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PromoController],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}
