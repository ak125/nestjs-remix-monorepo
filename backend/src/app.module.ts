import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RemixController } from './remix/remix.controller';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { RemixModule } from './remix/remix.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    RemixModule,
    UsersModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
  ],
  controllers: [AuthController, RemixController],
  providers: [],
})
export class AppModule {}
