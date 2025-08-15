import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './modules/orders/orders.module';
import { HealthModule } from './modules/health/health.module';
import { CartModule } from './modules/cart/cart.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MessagesModule } from './modules/messages/messages.module';
import { RemixModule } from './remix/remix.module'; // ✅ RÉACTIVÉ !
import { SuppliersModule } from './modules/suppliers/suppliers.module'; // ✅ NOUVEAU !
import { AdminModule } from './modules/admin/admin.module'; // ✅ NOUVEAU - Module admin aligné !
import { ApiModule } from './modules/api.module'; // ✅ NOUVEAU - API Legacy directe !

/**
 * AppModule - Architecture Modulaire Restaurée
 * ✅ RemixModule réactivé pour la vraie page d'accueil
 * ✅ Tous les modules essentiels fonctionnels
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),

    // Event Emitter global
    EventEmitterModule.forRoot(),

    // Modules core fonctionnels
    DatabaseModule,
    OrdersModule,
    HealthModule,
    CartModule,
    AuthModule,
    UsersModule,
    MessagesModule,
    RemixModule, // ✅ RÉACTIVÉ - Votre vraie page d'accueil !
    SuppliersModule, // ✅ NOUVEAU - Gestion avancée des fournisseurs !
    AdminModule, // ✅ NOUVEAU - Module admin aligné sur l'architecture !
    ApiModule, // ✅ NOUVEAU - API Legacy directe connectée aux vraies tables !

    // TODO: Réactiver progressivement
    // PaymentsModule,
    // SupplierModule,
  ],
  controllers: [], // Plus besoin du controller temporaire
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
