import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../cache/cache.module';
import { UsersModule } from '../modules/users/users.module';
import { OrdersModule } from '../modules/orders/orders.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { CartModule } from '../modules/cart/cart.module';
import { AdminModule } from '../modules/admin/admin.module';
import { RemixService } from './remix.service';
import { RemixApiService } from './remix-api.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CacheModule,
    UsersModule,
    OrdersModule,
    PaymentsModule,
    CartModule,
    AdminModule,
  ],
  providers: [RemixService, RemixApiService],
  exports: [RemixService, RemixApiService],
})
export class RemixModule {}
