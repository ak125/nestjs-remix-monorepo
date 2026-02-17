/**
 * AdminModule - Module d'administration
 *
 * Module aligné sur l'approche des modules orders, cart, user, payment :
 * - Structure modulaire claire avec séparation des responsabilités
 * - Controllers spécialisés par domaine fonctionnel
 * - Services métier spécialisés et réutilisables
 * - Imports cohérents (DatabaseModule, CacheModule)
 * - Exports sélectifs des services pour réutilisation
 *
 * Phase 1 : Configuration de base ✅
 * Phase 2 : Stock Management 🚧
 * Phase 3 : Orders Administration (AdminOrdersController retiré - intégré dans OrdersController)
 * Phase 4 : Reporting & Analytics
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';

// Controllers - Stock consolidé ✅
import { ConfigurationController } from './controllers/configuration.controller';
import { StockController } from './controllers/stock.controller'; // 🔥 Controller consolidé unique
import { AdminController } from './controllers/admin.controller';
import { AdminRootController } from './controllers/admin-root.controller';
import { ReportingController } from './controllers/reporting.controller';
import { UserManagementController } from './controllers/user-management.controller';
import { AdminStaffController } from './controllers/admin-staff.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { AdminGammesSeoListController } from './controllers/admin-gammes-seo-list.controller'; // 📋 Gammes SEO - Liste & Stats
import { AdminGammesSeoUpdateController } from './controllers/admin-gammes-seo-update.controller'; // 🔧 Gammes SEO - Mises à jour
import { AdminGammesSeoThresholdsController } from './controllers/admin-gammes-seo-thresholds.controller'; // 🔧 Gammes SEO - Seuils
import { AdminGammesSeoVlevelController } from './controllers/admin-gammes-seo-vlevel.controller'; // 📊 Gammes SEO - V-Level & Section K
import { AdminGammesSeoAggregatesController } from './controllers/admin-gammes-seo-aggregates.controller'; // 🏷️ Gammes SEO - Agrégats
import { SeoCockpitController } from './controllers/seo-cockpit.controller'; // 🚀 SEO Cockpit Unifié
// AdminVehicleResolveController supprimé — méthode resolveVehicleTypes jamais implémentée
import { AdminBuyingGuideController } from './controllers/admin-buying-guide.controller'; // 📖 Buying Guide RAG enrichment
import { AdminContentRefreshController } from './controllers/admin-content-refresh.controller'; // 🔄 Content Refresh pipeline
import { AdminGammesSeoService } from './services/admin-gammes-seo.service'; // 🎯 Service Gammes SEO
import { GammeSeoThresholdsService } from './services/gamme-seo-thresholds.service'; // 🎯 Seuils Gammes SEO
import { GammeSeoAuditService } from './services/gamme-seo-audit.service'; // 🎯 Audit Gammes SEO
import { GammeSeoBadgesService } from './services/gamme-seo-badges.service'; // 🏷️ Badges & Aggregates
import { SeoCockpitService } from './services/seo-cockpit.service'; // 🚀 Service SEO Cockpit
import { GammeDetailEnricherService } from './services/gamme-detail-enricher.service';
import { GammeVLevelService } from './services/gamme-vlevel.service';
import { StockMovementService } from './services/stock-movement.service';
import { StockReportService } from './services/stock-report.service';
import { BuyingGuideEnricherService } from './services/buying-guide-enricher.service'; // 📖 RAG enrichment
import { ContentRefreshService } from './services/content-refresh.service'; // 🔄 Content Refresh orchestrator
import { ConseilEnricherService } from './services/conseil-enricher.service'; // 🔄 R3 Conseils enricher

// Services - Stock services pour le controller consolidé
import { ConfigurationService } from './services/configuration.service';
import { StockManagementService } from './services/stock-management.service';
import { WorkingStockService } from './services/working-stock.service'; // ✅ Ajouté pour stock.controller.ts
import { ReportingService } from './services/reporting.service';
import { UserManagementService } from './services/user-management.service';
// import { AdminProductsService } from './services/admin-products.service';
import { StaffService } from '../staff/staff.service';

// Import du module Orders pour les services
import { OrdersModule } from '../orders/orders.module';
import { StaffModule } from '../staff/staff.module';
import { ProductsModule } from '../products/products.module';
import { WorkerModule } from '../../workers/worker.module'; // 📊 Pour SeoMonitorSchedulerService
import { SeoModule } from '../seo/seo.module'; // 🚀 Pour RiskFlagsEngineService + GooglebotDetectorService
import { RagProxyModule } from '../rag-proxy/rag-proxy.module'; // 📖 Pour RagProxyService (enrichissement buying guide)

@Module({
  imports: [
    DatabaseModule,
    OrdersModule,
    StaffModule,
    ProductsModule,
    WorkerModule, // 📊 Import pour accès à SeoMonitorSchedulerService
    SeoModule, // 🚀 Import pour accès aux services SEO (risk flags, googlebot)
    RagProxyModule, // 📖 Import pour accès à RagProxyService (enrichissement buying guide)
    BullModule.registerQueue({ name: 'seo-monitor' }), // 🔄 Queue pour ContentRefreshService
  ],
  controllers: [
    ConfigurationController,
    StockController, // 🔥 Un seul controller stock consolidé (13 routes)
    // ❌ StockEnhancedController - SUPPRIMÉ
    // ❌ StockTestController - SUPPRIMÉ
    // ❌ RealStockController - SUPPRIMÉ
    // ❌ SimpleStockController - SUPPRIMÉ
    // ❌ WorkingStockController - SUPPRIMÉ (fonctionnalités intégrées dans StockController)
    // AdminOrdersController retiré - Routes disponibles dans OrdersModule (/api/orders/admin/*)
    AdminController,
    AdminRootController,
    ReportingController,
    UserManagementController,
    AdminStaffController,
    AdminProductsController,
    AdminGammesSeoListController, // 📋 Gammes SEO - Liste, stats, export, audit
    AdminGammesSeoUpdateController, // 🔧 Gammes SEO - Update, batch, actions
    AdminGammesSeoThresholdsController, // 🔧 Gammes SEO - Seuils Smart Action
    AdminGammesSeoVlevelController, // 📊 Gammes SEO - V-Level & Section K
    AdminGammesSeoAggregatesController, // 🏷️ Gammes SEO - Agrégats badges
    SeoCockpitController, // 🚀 SEO Cockpit Unifié - /api/admin/seo-cockpit/*
    // AdminVehicleResolveController supprimé
    AdminBuyingGuideController, // 📖 Buying Guide RAG enrichment - /api/admin/buying-guides/*
    AdminContentRefreshController, // 🔄 Content Refresh pipeline - /api/admin/content-refresh/*
  ],
  providers: [
    ConfigurationService,
    StockManagementService, // ✅ Service principal stock
    WorkingStockService, // ✅ Service complémentaire (search, export, stats)
    // ❌ RealStockService - SUPPRIMÉ (fonctionnalité minimaliste)
    ReportingService,
    UserManagementService,
    // AdminProductsService,
    StaffService,
    AdminGammesSeoService, // 🎯 Service Gammes SEO
    GammeSeoThresholdsService, // 🎯 Seuils Gammes SEO
    GammeSeoAuditService, // 🎯 Audit Gammes SEO
    GammeSeoBadgesService, // 🏷️ Badges & Aggregates
    SeoCockpitService, // 🚀 Service SEO Cockpit Unifié
    GammeDetailEnricherService,
    GammeVLevelService,
    StockMovementService,
    StockReportService,
    BuyingGuideEnricherService, // 📖 RAG enrichment service
    ContentRefreshService, // 🔄 Content Refresh orchestrator (event listener + queue)
    ConseilEnricherService, // 🔄 R3 Conseils S1-S8 enricher
  ],
  exports: [
    ConfigurationService,
    StockManagementService,
    ReportingService,
    UserManagementService,
    // AdminProductsService,
    GammeDetailEnricherService,
    GammeVLevelService,
    StockMovementService,
    StockReportService,
  ],
})
export class AdminModule {}
