import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
// import { ScheduleModule } from '@nestjs/schedule'; // Temporairement désactivé
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
import { DashboardModule } from './modules/dashboard/dashboard.module'; // ✅ NOUVEAU - Dashboard Stats !
import { ProductsModule } from './modules/products/products.module'; // ✅ NOUVEAU - Module produits !
import { VehiclesModule } from './modules/vehicles/vehicles.module'; // 🚗 NOUVEAU - Module véhicules !
import { VehiclesZodTestModule } from './modules/vehicles/vehicles-zod-test.module'; // 🧪 TEST - Module test Zod !
import { ManufacturersModule } from './modules/manufacturers/manufacturers.module'; // 🏭 NOUVEAU - Module manufacturers !
import { InvoicesModule } from './modules/invoices/invoices.module'; // 🧾 NOUVEAU - Module factures !
import { SeoModule } from './modules/seo/seo.module'; // 🔍 NOUVEAU - Module SEO avec services intégrés !
import { SearchModule } from './modules/search/search.module'; // 🔍 NOUVEAU - Module de recherche optimisé v3.0 !
import { SystemModule } from './modules/system/system.module'; // ⚡ NOUVEAU - Module system monitoring !
import { BlogModule } from './modules/blog/blog.module'; // 📚 NOUVEAU - Module blog avec tables __blog_* intégrées !
import { AnalyticsController } from './controllers/analytics.controller'; // 📊 NOUVEAU - Analytics avancées !
// import { CatalogModule } from './modules/catalog/catalog.module'; // ✅ NOUVEAU - Catalogue automobile !

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

    // Scheduler pour les tâches CRON (temporairement désactivé)
    // ScheduleModule.forRoot(),

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
    DashboardModule, // ✅ NOUVEAU - Dashboard Stats pour admin panel !
    ProductsModule, // ✅ NOUVEAU - Module produits avec CRUD complet !
    VehiclesModule, // 🚗 NOUVEAU - Module véhicules avec recherche avancée !
    VehiclesZodTestModule, // 🧪 TEST - Module test Zod validation !
    ManufacturersModule, // 🏭 NOUVEAU - Module manufacturers avec tables auto_* !
    InvoicesModule, // 🧾 NOUVEAU - Module factures avec cache et stats !
    SeoModule, // 🔍 NOUVEAU - Module SEO avec SeoService et SitemapService !
    SearchModule, // 🔍 NOUVEAU - Module de recherche optimisé v3.0 avec Meilisearch !
    BlogModule, // 📚 NOUVEAU - Module blog avec conseils, guides et glossaire intégrés !
    SystemModule, // ⚡ NOUVEAU - Module system monitoring et métriques !
    // CatalogModule, // ✅ NOUVEAU - Catalogue automobile avec tables existantes !

    // TODO: Réactiver progressivement
    // PaymentsModule,
    // SupplierModule,
  ],
  controllers: [
    AnalyticsController, // 📊 Analytics avancées
  ], // Plus besoin du controller temporaire
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
