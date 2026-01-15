import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
// import { ScheduleModule } from '@nestjs/schedule'; // ❌ DÉSACTIVÉ - Conflit de version avec @nestjs/common v10
// import { BullModule } from '@nestjs/bullmq'; // ❌ DÉSACTIVÉ - Conflit de version avec @nestjs/common v10
import { CryptoModule } from './shared/crypto/crypto.module'; // 🔐 NOUVEAU - Module crypto centralisé !
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './modules/orders/orders.module';
import { HealthModule } from './modules/health/health.module';
import { CartModule } from './modules/cart/cart.module';
import { PromoModule } from './modules/promo/promo.module'; // 🎫 NOUVEAU - Module promo avancé avec Zod et Cache !
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MessagesModule } from './modules/messages/messages.module';
import { RemixModule } from './remix/remix.module'; // ✅ RÉACTIVÉ !
import { SuppliersModule } from './modules/suppliers/suppliers.module'; // ✅ NOUVEAU !
import { AdminModule } from './modules/admin/admin.module'; // ✅ NOUVEAU - Module admin aligné !
import { ApiModule } from './modules/api.module'; // ✅ NOUVEAU - API Legacy directe !
import { DashboardModule } from './modules/dashboard/dashboard.module'; // ✅ NOUVEAU - Dashboard Stats !
import { ProductsModule } from './modules/products/products.module'; // ✅ NOUVEAU - Module produits !
import { VehiclesModule } from './modules/vehicles/vehicles.module'; // 🚗 MODULE VEHICLES - Pour sélecteur véhicule (inclut VehicleBrandsService)
import { InvoicesModule } from './modules/invoices/invoices.module'; // 🧾 NOUVEAU - Module factures !
import { SeoModule } from './modules/seo/seo.module'; // 🔍 NOUVEAU - Module SEO avec services intégrés !
import { SearchModule } from './modules/search/search.module'; // 🔍 NOUVEAU - Module de recherche optimisé v3.0 !
import { SystemModule } from './modules/system/system.module'; // ⚡ NOUVEAU - Module system monitoring !
import { BlogModule } from './modules/blog/blog.module'; // 📚 NOUVEAU - Module blog avec tables __blog_* intégrées !
import { LayoutModule } from './modules/layout/layout.module'; // 🎨 NOUVEAU - Module layout pour gestion des composants UI !
import { NotificationsModule } from './notifications/notifications.module'; // 📬 NOUVEAU - Module notifications avec WebSocket !
import { PaymentsModule } from './modules/payments/payments.module'; // 💳 NOUVEAU - Module paiements avec Cyberplus !
import { CommercialModule } from './modules/commercial/commercial.module'; // 🏢 NOUVEAU - Module commercial et ventes !
import { StaffModule } from './modules/staff/staff.module'; // 👥 NOUVEAU - Module gestion du personnel !
import { AnalyticsController } from './controllers/analytics.controller'; // 📊 NOUVEAU - Analytics avancées !
import { AnalyticsModule } from './modules/analytics/analytics.module'; // 📊 NOUVEAU - Module Analytics enhanced !
import { CacheModule } from './modules/cache/cache.module'; // ⚡ NOUVEAU - Module cache Redis pour performances !
import { SupportModule } from './modules/support/support.module'; // 🎯 NOUVEAU - Module support client complet !
import { ErrorsModule } from './modules/errors/errors.module'; // ❌ NOUVEAU - Module de gestion des erreurs et redirections !
import { ApiModule as ErrorsApiModule } from './api/api.module'; // 🔌 NOUVEAU - API endpoints pour erreurs !
import { ConfigModule as CustomConfigModule } from './modules/config/config.module'; // 🔧 NOUVEAU - Module config enhanced !
import { MetadataModule } from './modules/metadata/metadata.module'; // 🔍 NOUVEAU - Module metadata optimisé !
import { CatalogModule } from './modules/catalog/catalog.module'; // ✅ ACTIVÉ - Catalogue automobile complet !
// import { CatalogModuleSimple } from './modules/catalog/catalog-simple.module'; // 🔧 TEMPORAIREMENT DÉSACTIVÉ - Version simplifiée pour test pièces !
import { GammeRestModule } from './modules/gamme-rest/gamme-rest.module'; // 🎯 NOUVEAU - API REST simple pour gammes !
import { WorkerModule } from './workers/worker.module'; // 🔄 NOUVEAU - Module Workers BullMQ pour jobs asynchrones !
import { AiContentModule } from './modules/ai-content/ai-content.module'; // 🤖 NOUVEAU - Module IA pour génération de contenu intelligent !
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module'; // 🧠 NOUVEAU - Knowledge Graph + Reasoning Engine v2.8.0 !
import { RagProxyModule } from './modules/rag-proxy/rag-proxy.module'; // 🤖 RAG PROXY - NestJS proxy vers service RAG Python !
import { GmailModule } from './modules/gmail/gmail.module'; // 📧 NOUVEAU - Module Gmail inbox admin !
import { VehicleKnowledgeModule } from './modules/vehicle-knowledge/vehicle-knowledge.module'; // 🚗 V5 ARCHITECTURE - Entity → Layers → Cards !
import { RmModule } from './modules/rm/rm.module'; // 🏗️ NOUVEAU - Read Model pour listings optimisés !

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
    // 🛡️ RATE LIMITING - Protection anti-spam/DDoS
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 1000, // 1 seconde
          limit: 15, // 15 req/sec max par IP
        },
        {
          name: 'medium',
          ttl: 60000, // 1 minute
          limit: 100, // 100 req/min par IP
        },
        {
          name: 'long',
          ttl: 3600000, // 1 heure
          limit: 2000, // 2000 req/heure par IP
        },
      ],
      // 🛡️ Skip internal calls (Remix SSR + Docker containers)
      skipIf: (context) => {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip || request.connection?.remoteAddress;

        // Skip localhost/127.0.0.1/::1 (internal SSR calls)
        if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
          return true;
        }

        // Skip Docker bridge network (172.17.0.0/16) - pour n8n et autres conteneurs
        if (ip?.startsWith('172.17.') || ip?.startsWith('::ffff:172.17.')) {
          return true;
        }

        // Skip Docker internal networks (172.16-31.0.0/12) - tous réseaux Docker
        const dockerMatch = ip?.match(
          /^(?:::ffff:)?172\.(1[6-9]|2[0-9]|3[0-1])\./,
        );
        if (dockerMatch) {
          return true;
        }

        return false;
      },
    }),

    // Event Emitter global
    EventEmitterModule.forRoot(),

    // ❌ Schedule Module désactivé - Conflit @nestjs/schedule v6 avec @nestjs/common v10
    // ❌ BullModule désactivé - Conflit @nestjs/bullmq v11 avec @nestjs/common v10
    // ✅ Utilisation directe de BullMQ (sans décorateurs NestJS) dans SeoLogsModule
    // ScheduleModule.forRoot(),
    // BullModule.forRoot({ connection: {...} }),

    // 🔐 Module crypto centralisé (Global)
    CryptoModule,

    // Modules core fonctionnels
    DatabaseModule,
    OrdersModule,
    HealthModule,
    CartModule,
    PromoModule, // 🎫 ACTIVÉ - Module promo avancé avec validation Zod et Cache Redis !
    AuthModule,
    UsersModule,
    MessagesModule,
    CacheModule, // ⚡ NOUVEAU - Module cache Redis pour performances !
    RemixModule, // ✅ RÉACTIVÉ - Votre vraie page d'accueil !
    SuppliersModule, // ✅ NOUVEAU - Gestion avancée des fournisseurs !
    AdminModule, // ✅ NOUVEAU - Module admin aligné sur l'architecture !
    ApiModule, // ✅ NOUVEAU - API Legacy directe connectée aux vraies tables !
    DashboardModule, // ✅ NOUVEAU - Dashboard Stats pour admin panel !
    ProductsModule, // ✅ NOUVEAU - Module produits avec CRUD complet !
    // 🚗 MODULES VÉHICULES
    VehiclesModule, // Module vehicle principal pour sélecteur véhicule (inclut gestion marques via VehicleBrandsService)
    InvoicesModule, // 🧾 NOUVEAU - Module factures avec cache et stats !
    SeoModule, // 🔍 NOUVEAU - Module SEO avec SeoService et SitemapService !
    SearchModule, // 🔍 NOUVEAU - Module de recherche optimisé v3.0 avec Meilisearch !
    BlogModule, // 📚 NOUVEAU - Module blog avec conseils, guides et glossaire intégrés !
    SystemModule, // ⚡ NOUVEAU - Module system monitoring et métriques !
    LayoutModule, // 🎨 ACTIVÉ - Module layout pour gestion des composants UI !
    NotificationsModule, // 📬 NOUVEAU - Module notifications avec WebSocket et temps réel !
    PaymentsModule, // 💳 ACTIVÉ - Module paiements avec Cyberplus et validation !
    CommercialModule, // 🏢 ACTIVÉ - Module commercial avec CRM et ventes !
    StaffModule, // 👥 ACTIVÉ - Module gestion du personnel et employés !
    SupportModule, // 🎯 ACTIVÉ - Module support client complet (contact, legal, reviews, FAQ) !
    MetadataModule, // 🔍 ACTIVÉ - Module metadata optimisé avec breadcrumbs ! (PRIORITÉ pour /admin/breadcrumbs)
    CustomConfigModule, // 🔧 ACTIVÉ - Module config enhanced avec gestion dynamique !
    ErrorsModule, // ❌ ACTIVÉ - Module de gestion des erreurs et redirections avec logs !
    ErrorsApiModule, // 🔌 ACTIVÉ - API endpoints pour erreurs et redirections !
    AnalyticsModule, // 📊 ACTIVÉ - Module Analytics enhanced avec multi-providers !

    // 🚗 CATALOGUE AUTOMOBILE
    CatalogModule, // ✅ ACTIVÉ - Catalogue automobile complet avec logique PHP exacte !
    // CatalogModuleSimple, // 🔧 TEMPORAIREMENT DÉSACTIVÉ - Version simplifiée pour test pièces !
    GammeRestModule, // 🎯 ACTIVÉ - API REST simple pour gammes avec vraies tables !

    // 🔄 WORKERS & BACKGROUND JOBS
    WorkerModule, // 🔄 ACTIVÉ - Module Workers BullMQ (sitemaps, cache, SEO monitor) !

    // 🤖 AI & CONTENT GENERATION
    AiContentModule, // 🤖 ACTIVÉ - Module IA pour génération de contenu intelligent !

    // 🧠 KNOWLEDGE GRAPH & REASONING ENGINE
    KnowledgeGraphModule, // 🧠 ACTIVÉ - Knowledge Graph + Reasoning Engine v2.8.0 !

    // 🤖 RAG PROXY - Service RAG Python
    RagProxyModule, // 🤖 ACTIVÉ - Proxy NestJS vers service RAG Python (port 8000) !

    // 📧 GMAIL INBOX - Boîte mail admin intégrée
    GmailModule, // 📧 ACTIVÉ - Module Gmail inbox admin avec OAuth2 !

    // 🚗 V5 VEHICLE KNOWLEDGE - Architecture Entity → Layers → Cards
    VehicleKnowledgeModule, // 🚗 ACTIVÉ - Système V5 avec garde-fous RAG !

    // 🏗️ READ MODEL - Listings pré-calculés optimisés
    RmModule, // 🏗️ ACTIVÉ - Module RM pour accès aux listings optimisés !
  ],
  controllers: [
    AnalyticsController, // 📊 Analytics avancées
  ], // Plus besoin du controller temporaire
  providers: [
    // 🛡️ Rate Limiting global - Protège toutes les routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
