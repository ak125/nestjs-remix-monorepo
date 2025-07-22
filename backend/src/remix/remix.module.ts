import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../cache/cache.module';
import { UsersModule } from '../modules/users/users.module';
import { OrdersModule } from '../modules/orders/orders.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { CartModule } from '../modules/cart/cart.module';
import { RemixService } from './remix.service';
import { RemixIntegrationService } from './remix-integration.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CacheModule,
    UsersModule,
    OrdersModule,
    PaymentsModule,
    CartModule,
  ],
  providers: [RemixService, RemixIntegrationService],
  exports: [RemixService],
})
export class RemixModule {}
