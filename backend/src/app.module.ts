import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CloudflareThrottlerGuard } from './common/guards/cloudflare-throttler.guard';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { SentryModule } from '@sentry/nestjs/setup';
import { loggerConfig } from './config/logger.config';
import { RequestIdMiddleware } from './modules/mcp-validation/middleware/request-id.middleware';
// import { ScheduleModule } from '@nestjs/schedule'; // ❌ DÉSACTIVÉ - Conflit de version avec @nestjs/common v10
// import { BullModule } from '@nestjs/bullmq'; // ❌ DÉSACTIVÉ - Conflit de version avec @nestjs/common v10
import { CryptoModule } from './shared/crypto/crypto.module'; // 🔐 NOUVEAU - Module crypto centralisé !
import { MailModule } from './services/mail.module'; // 📧 Module mail global (MailService disponible partout)
import { FeatureFlagsModule } from './config/feature-flags.module'; // 🎛️ NOUVEAU - Feature flags centralisés (content pipeline + brief gates)
import { WriteGuardModule } from './config/write-guard.module'; // 🛡️ P1.5 - Write Ownership & Collision Guard
import { RpcGateModule } from './security/rpc-gate/rpc-gate.module'; // 🛡️ NOUVEAU - RPC Safety Gate pour gouvernance Supabase !
import { BotGuardModule } from './modules/bot-guard/bot-guard.module'; // 🛡️ Bot protection (geo-block, IP block, behavioral scoring)
import { SyntheticProbeCredentialModule } from './modules/seo-control-plane/synthetic-probe-credential.module'; // 🛡️ HMAC credential du crawler synthétique (exemption rate-limit scopée)
import { isSyntheticExemptPath } from './modules/seo-control-plane/types';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './modules/orders/orders.module';
import { HealthModule } from './modules/health/health.module';
import { SessionInfrastructureModule } from './modules/session/session-infrastructure.module';
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
import { PricingModule } from './modules/pricing/pricing.module'; // 💶 Pricing Control Plane V1
import { VehiclesModule } from './modules/vehicles/vehicles.module'; // 🚗 MODULE VEHICLES - Pour sélecteur véhicule (inclut VehicleBrandsService)
import { VehicleContextModule } from './modules/vehicle-context/vehicle-context.module'; // 🪪 PR-B.2 — VehicleContext JWS cookie middleware (OPTION A locked)
import { ObservabilityModule } from './modules/observability/observability.module'; // 📊 PR-C — Prometheus counters for vehicle_ctx_* events + /api/observability/metrics
import { InvoicesModule } from './modules/invoices/invoices.module'; // 🧾 NOUVEAU - Module factures !
import { SeoModule } from './modules/seo/seo.module'; // 🔍 NOUVEAU - Module SEO avec services intégrés !
import { SeoMonitoringModule } from './modules/seo-monitoring/seo-monitoring.module'; // 📊 Phase 1 — Observability GSC/GA4/CWV daily ingestion
import { SeoControlPlaneModule } from './modules/seo-control-plane/seo-control-plane.module'; // 🤖 ADR-064 — SEO Production Control Plane (L1 synthetic crawler q15min)
import { MerchantCenterModule } from './modules/merchant-center/merchant-center.module'; // 🛒 PR commerce-loop V1 step 5B — Google Shopping XML feed
import { SupplierTruthModule } from './modules/supplier-truth/supplier-truth.module'; // 🔌 Supplier-truth read-only observability endpoint (sync side lives in WorkerModule)
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
import { CacheModule } from './cache/cache.module';
import { SupportModule } from './modules/support/support.module'; // 🎯 NOUVEAU - Module support client complet !
import { ErrorsModule } from './modules/errors/errors.module'; // ❌ NOUVEAU - Module de gestion des erreurs et redirections !
import { ApiModule as ErrorsApiModule } from './api/api.module'; // 🔌 NOUVEAU - API endpoints pour erreurs !
import { ConfigModule as CustomConfigModule } from './modules/config/config.module'; // 🔧 NOUVEAU - Module config enhanced !
import { MetadataModule } from './modules/metadata/metadata.module'; // 🔍 NOUVEAU - Module metadata optimisé !
import { CatalogModule } from './modules/catalog/catalog.module'; // ✅ ACTIVÉ - Catalogue automobile complet !
import { SubstitutionModule } from './modules/substitution/substitution.module'; // 🔁 ACTIVÉ - moteur substitution: 404/410 SEO sur pages pièces vides (owner GO 2026-06-21)
// import { CatalogModuleSimple } from './modules/catalog/catalog-simple.module'; // 🔧 TEMPORAIREMENT DÉSACTIVÉ - Version simplifiée pour test pièces !
import { GammeRestModule } from './modules/gamme-rest/gamme-rest.module'; // 🎯 NOUVEAU - API REST simple pour gammes !
import { WorkerModule } from './workers/worker.module'; // 🔄 NOUVEAU - Module Workers BullMQ pour jobs asynchrones !
// ⛔ DÉSACTIVÉ P0.1-P0.2 (2026-02-02) - Modules DEV ONLY, ne doivent pas être en PROD
// Voir docs/MIGRATION_PLAN_DEV_PREPROD_PROD.md pour détails
import { AiContentModule } from './modules/ai-content/ai-content.module';
// import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module'; // DEV ONLY - Experimental
import { RagProxyModule } from './modules/rag-proxy/rag-proxy.module';
import { RagKnowledgeBootstrapModule } from './modules/rag-knowledge-bootstrap/rag-knowledge-bootstrap.module'; // 🛡️ ADR-046/050 — fail-fast L3 mirror state au boot
import { RmModule } from './modules/rm/rm.module'; // ✅ RÉACTIVÉ - Fix Dockerfile: shared-types copié (2026-02-02)
import { MarketingModule } from './modules/marketing/marketing.module'; // 📊 NOUVEAU - Module marketing avec backlinks, content roadmap et KPIs !
import { MediaFactoryModule } from './modules/media-factory/media-factory.module'; // 🎬 REVIVE 2026-06-20 — fetch-only TTS (Azure REST), dé-RAG, flag-gated
import { isMediaFactoryEnabled } from './modules/media-factory/media-factory.flag';
import { DiagnosticEngineModule } from './modules/diagnostic-engine/diagnostic-engine.module'; // 🔧 NOUVEAU - Moteur diagnostic mecanique MVP !
import { TrendSignalsModule } from './modules/trend-signals/trend-signals.module'; // 📈 NOUVEAU - Middle-ground trend signals ingestion (Tasks 1.9-1.11 ai-additive-layer)

/**
 * AppModule - Architecture Modulaire Restaurée
 * ✅ RemixModule réactivé pour la vraie page d'accueil
 * ✅ Tous les modules essentiels fonctionnels
 */
@Module({
  imports: [
    // 🚨 Sentry — DI bridge so Sentry-aware filters/services can be injected.
    // The actual SDK init happens in `instrument.ts` (loaded via main.ts).
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
    }),
    // 📝 LOGGER - Pino structuré (JSON prod, pretty dev)
    LoggerModule.forRoot(loggerConfig),
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
        {
          // ADR-043 Sprint 1 ticket #6 — payment callbacks (STRIDE 01-paiement
          // critique #2). Apply via @Throttle({ payment_callback: {...} }) on
          // /api/paybox/callback + /api/payments/callback/cyberplus. Gateway IPN
          // sends ~1-2 callbacks per transaction → 30/min/IP is generous for
          // legitimate flow, tight for crypto-compute DoS. On 429, gateways
          // retry idempotently (HMAC signature dedups).
          name: 'payment_callback',
          ttl: 60000, // 1 minute
          limit: 30,
        },
      ],
      // 🛡️ Skip internal calls (Remix SSR + Docker containers + Admin users)
      skipIf: (context) => {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip || request.connection?.remoteAddress;
        const user = request.user;

        // Skip forward-confirmed search-engine crawlers (flag set upstream by
        // BotGuardMiddleware via FCrDNS) — they must never hit the rate limiter
        // and get a 429 mid-crawl.
        if (request.isVerifiedBot === true) {
          return true;
        }

        // Skip the internal synthetic crawler (seo-control-plane L1) — but ONLY
        // for public-catalogue GETs (least-privilege). The flag is set upstream
        // by BotGuardMiddleware after verifying an HMAC credential (NOT the UA),
        // and isSyntheticExemptPath() blocks /api, /auth, /cart, /checkout,
        // /admin and every non-GET, so even a leaked credential cannot relax
        // rate-limiting beyond already-public, already-CDN-cached reads.
        // Incident 2026-06-25 (crawler 89.7% 429 → L1 monitoring blind).
        if (
          request.isVerifiedSyntheticProbe === true &&
          isSyntheticExemptPath(request.method, request.path || '')
        ) {
          return true;
        }

        // Skip for admin users (level >= 7)
        if (user?.isAdmin === true || parseInt(user?.level) >= 7) {
          return true;
        }

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

    // 🛡️ Bot protection - geo-block, IP block, behavioral scoring (must be before other modules)
    BotGuardModule,

    // 🛡️ Credential HMAC du crawler synthétique (@Global) — injecté par
    // BotGuardMiddleware (verify) + SyntheticCrawlerService (sign). Posé avant les
    // modules consommateurs pour disponibilité DI app-wide. Incident 2026-06-25.
    SyntheticProbeCredentialModule,

    // 🎛️ Feature flags centralisés (Global)
    FeatureFlagsModule,

    // 🛡️ P1.5 Write Ownership & Collision Guard (Global)
    WriteGuardModule,

    // 🔐 Module crypto centralisé (Global)
    CryptoModule,

    // 📧 Module mail global (MailService dispo partout sans import)
    MailModule,

    // 🛡️ RPC Safety Gate - Gouvernance des appels Supabase RPC
    RpcGateModule,

    // Modules core fonctionnels
    SessionInfrastructureModule, // 🔐 Store de session Redis encapsulé (PR-9e.1)
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
    PricingModule, // 💶 Pricing Control Plane V1 — import fournisseur + moteur de prix canonique
    // 🚗 MODULES VÉHICULES
    VehiclesModule, // Module vehicle principal pour sélecteur véhicule (inclut gestion marques via VehicleBrandsService)
    VehicleContextModule, // PR-B.2 — JWS cookie middleware on /api/diagnostic/* + /api/v1/orientation/*
    ObservabilityModule, // PR-C — prom-client counters subscribed to NestJS events + scrape endpoint
    InvoicesModule, // 🧾 NOUVEAU - Module factures avec cache et stats !
    SeoModule, // 🔍 NOUVEAU - Module SEO avec SeoService et SitemapService !
    SeoMonitoringModule, // 📊 Phase 1 — Observability GSC/GA4/CWV daily ingestion (cf. ADR-025)
    SeoControlPlaneModule, // 🤖 ADR-064 — SEO Production Control Plane (L1 synthetic crawler q15min)
    MerchantCenterModule, // 🛒 PR commerce-loop V1 step 5B — Google Shopping XML feed /api/feed/merchant-center.xml
    SupplierTruthModule, // 🔌 Read-only observability for the supplier-truth sentinel (admin status + projection); the inert-gated sync runtime lives in WorkerModule
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
    SubstitutionModule, // 🔁 ACTIVÉ - moteur substitution (404/410 SEO sur pages pièces vides) — owner GO 2026-06-21
    // CatalogModuleSimple, // 🔧 TEMPORAIREMENT DÉSACTIVÉ - Version simplifiée pour test pièces !
    GammeRestModule, // 🎯 ACTIVÉ - API REST simple pour gammes avec vraies tables !
    MarketingModule, // 📊 ACTIVÉ - Module marketing avec backlinks, content roadmap et KPIs !
    ...(isMediaFactoryEnabled() ? [MediaFactoryModule] : []), // 🎬 REVIVE flag-gated (MEDIA_FACTORY_ENABLED, off par défaut → 0 prod)
    DiagnosticEngineModule, // 🔧 ACTIVÉ - Moteur diagnostic mecanique MVP (Slice 1) !
    TrendSignalsModule, // 📈 ACTIVÉ - Middle-ground trend signals ingestion (Tasks 1.9-1.11)
    // AgenticEngineModule — ARCHIVÉ 2026-04-02 (tables → _archive schema, remplacé par Paperclip)

    // 🔄 WORKERS & BACKGROUND JOBS
    WorkerModule, // 🔄 ACTIVÉ - Module Workers BullMQ (sitemaps, cache, SEO monitor) !

    // ⛔ DÉSACTIVÉ P0.1-P0.2 (2026-02-02) - Modules DEV ONLY
    ...(process.env.LLM_POLISH_ENABLED === 'true' ? [AiContentModule] : []),
    // KnowledgeGraphModule,   // DEV ONLY - AI-COS reasoning experimental
    ...(process.env.RAG_ENABLED === 'true' ? [RagProxyModule] : []),
    RagKnowledgeBootstrapModule, // 🛡️ ADR-046/050 fail-fast L3 mirror state — toujours actif (gate independent of RAG_ENABLED)
    RmModule, // ✅ RÉACTIVÉ - Fix Dockerfile shared-types (2026-02-02)
  ],
  controllers: [
    AnalyticsController, // 📊 Analytics avancées
  ], // Plus besoin du controller temporaire
  providers: [
    // 🛡️ Rate Limiting global - Protège toutes les routes.
    // CloudflareThrottlerGuard clé sur la vraie IP client (Cf-Connecting-Ip)
    // au lieu de l'IP edge Cloudflare partagée — sinon 429 sur /cart & co.
    {
      provide: APP_GUARD,
      useClass: CloudflareThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
