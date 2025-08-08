import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { MessagesModule } from './modules/messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60, // default, secondes
        limit: 100,
      },
      {
        name: 'admin',
        ttl: 60,
        limit: 6,
      },
    ]),
    DatabaseModule,
    AuthModule,
    RemixModule,
    UsersModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
    MessagesModule,
  ],
  controllers: [AuthController, RemixController], // RemixController en dernier pour catch-all
  providers: [
    // Activer le ThrottlerGuard globalement (peut être surchargé localement)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
