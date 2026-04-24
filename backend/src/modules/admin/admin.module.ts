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
import { AdminR8VehicleController } from './controllers/admin-r8-vehicle.controller'; // 🚗 R8 Vehicle enrichment
import { AdminR7BrandController } from './controllers/admin-r7-brand.controller'; // 🏭 R7 Brand enrichment
// AdminContentRefreshController SUPPRIME — content-refresh pipeline remplace par skills /content-gen
import { InternalEnrichController } from './controllers/internal-enrich.controller'; // 🔑 Internal enrichment (API key auth)
import { AdminPageBriefController } from './controllers/admin-page-brief.controller'; // 📋 Page Briefs SEO
import { AdminKeywordClustersController } from './controllers/admin-keyword-clusters.controller'; // 🔑 Keyword Clusters & Overlaps (read-only)
import { AdminKeywordPlannerController } from './controllers/admin-keyword-planner.controller'; // 📊 Keyword Planner Coverage
import { AdminHealthController } from './controllers/admin-health.controller'; // 🏥 Health Overview
// AdminSupplierStatsController — not ready for prod, removed from module
import { AdminGammesSeoService } from './services/admin-gammes-seo.service'; // 🎯 Service Gammes SEO
import { GammeSeoThresholdsService } from './services/gamme-seo-thresholds.service'; // 🎯 Seuils Gammes SEO
import { GammeSeoAuditService } from './services/gamme-seo-audit.service'; // 🎯 Audit Gammes SEO
import { GammeSeoBadgesService } from './services/gamme-seo-badges.service'; // 🏷️ Badges & Aggregates
import { SeoCockpitService } from './services/seo-cockpit.service'; // 🚀 Service SEO Cockpit
import { GammeDetailEnricherService } from './services/gamme-detail-enricher.service';
import { GammeVLevelService } from './services/gamme-vlevel.service';
import { StockMovementService } from './services/stock-movement.service';
import { StockReportService } from './services/stock-report.service';
import { BuyingGuideEnricherService } from './services/buying-guide-enricher.service'; // 📖 RAG enrichment (orchestrator)
import {
  BuyingGuideRagFetcherService,
  BuyingGuideSectionExtractor,
  BuyingGuideQualityGatesService,
  BuyingGuideDbService,
  BuyingGuideSeoDraftService,
} from './services/buying-guide'; // 📖 RAG enrichment sub-services
// R1ContentPipelineService SUPPRIME — pipeline Groq remplace par skills /content-gen
// ContentRefreshService SUPPRIME — pipeline auto remplace par skills /content-gen
import { ConseilEnricherService } from './services/conseil-enricher.service'; // 🔄 R3 Conseils enricher
import { PageBriefService } from './services/page-brief.service'; // 📋 Page Briefs CRUD + overlap
import { BriefGatesService } from './services/brief-gates.service'; // 🚦 Pre-publish gates anti-cannibalisation
import { HardGatesService } from './services/hard-gates.service'; // 🚦 Hard gates (attribution, no_guess, scope, contradiction, seo)
import { KeywordDensityGateService } from './services/keyword-density-gate.service'; // 🚦 Gate F: keyword density check
import { ImageGatesService } from './services/image-gates.service'; // 🚦 P3: image gates (OG, hero policy, alt text)
import { AdminJobHealthService } from './services/admin-job-health.service'; // 🏥 Job health tracking
import { AdminHealthService } from './services/admin-health.service'; // 🏥 Health overview aggregator
// AdminSupplierStatsService — not ready for prod, removed from module
import { EnricherTextUtils } from './services/enricher-text-utils.service'; // 🔧 Shared text utilities
import { EnricherYamlParser } from './services/enricher-yaml-parser.service'; // 🔧 Shared YAML/frontmatter parsing
import { RagGammeReaderService } from './services/rag-gamme-reader.service'; // 🔧 Centralized RAG gamme reading
import { QualityScoringEngineService } from './services/quality-scoring-engine.service'; // 📊 Quality scoring engine (multi-page)
import { GammeAggregatorService } from './services/gamme-aggregator.service'; // 📊 Gamme-level score aggregation
import { RagSafeDistillService } from './services/rag-safe-distill.service'; // 🔒 RAG Safe Distill (pre-enricher filter)
import { ConseilQualityScorerService } from './services/conseil-quality-scorer.service'; // 📊 Conseil section quality scorer
import { ConseilPriorityService } from './services/conseil-priority.service'; // 📊 Conseil priority queue
import { KeywordPlanGatesService } from './services/keyword-plan-gates.service'; // 🚦 Keyword plan gates G1-G6
import { R1KeywordPlanGatesService } from './services/r1-keyword-plan-gates.service'; // 🚦 R1 Keyword plan gates KA1-KA6
import { R1KeywordPlanBatchService } from './services/r1-keyword-plan-batch.service'; // 🔄 R1 KP batch 0-LLM
import { AdminConseilController } from './controllers/admin-conseil.controller'; // 📊 Conseil coverage + backfill
import { AdminRagIngestController } from './controllers/admin-rag-ingest.controller'; // 📄 PDF → RAG merge pipeline
import { AdminR3ImagePromptsController } from './controllers/admin-r3-image-prompts.controller'; // 🎨 R3 Image Prompts generation
import { AdminR1ImagePromptsController } from './controllers/admin-r1-image-prompts.controller'; // 🎨 R1 Image Briefs (brief-driven, 0-LLM)
import { AdminFeatureFlagsController } from './controllers/admin-feature-flags.controller';
// PipelineChainPollerService SUPPRIME — dependait de content-refresh queue
// RagCatchupService SUPPRIME — catch-up auto remplace par skills /content-gen
import { R3ImagePromptService } from './services/r3-image-prompt.service'; // 🎨 R3 Image Prompts (template-based, 0-LLM)
import { R1ContentFromRagService } from './services/r1-content-from-rag.service'; // 📝 R1 Content from RAG (0-LLM, template)
import { R1ImagePromptService } from './services/r1-image-prompt.service'; // 🎨 R1 Image Brief generator (brief-driven, 0-LLM)
import { R8VehicleEnricherService } from './services/r8-vehicle-enricher.service'; // 🚗 R8 Vehicle page enricher (RAG + diversity scoring)
import { EngineProfileRagLoader } from './services/engine-profile-rag-loader.service'; // 🚗 ADR-022 Pilier A : RAG runtime loader for S_MOTOR_ISSUES content
import { R7BrandEnricherService } from './services/r7-brand-enricher.service'; // 🏭 R7 Brand page enricher (RAG + diversity scoring)
import { BrandEditorialService } from './services/brand-editorial.service'; // 🏭 R7 Brand editorial content (FAQ/issues/maintenance)
import { VehicleRagGeneratorService } from './services/vehicle-rag-generator.service'; // 🚗 Vehicle RAG .md generator (0 LLM)
import { RagProposalService } from './services/rag-proposal.service'; // 📝 ADR-022 L1 propose-before-write
import { AdminVehicleRagController } from './controllers/admin-vehicle-rag.controller'; // 🚗 Vehicle RAG generation endpoints

// Services - Stock services pour le controller consolidé
import { ConfigurationService } from './services/configuration.service';
import { StockManagementService } from './services/stock-management.service';
import { WorkingStockService } from './services/working-stock.service'; // ✅ Ajouté pour stock.controller.ts
import { ReportingService } from './services/reporting.service';
import { UserManagementService } from './services/user-management.service';
// import { AdminProductsService } from './services/admin-products.service';

// Import du module Orders pour les services
import { OrdersModule } from '../orders/orders.module';
import { StaffModule } from '../staff/staff.module';
import { ProductsModule } from '../products/products.module';
import { WorkerModule } from '../../workers/worker.module'; // 📊 Pour SeoMonitorSchedulerService
import { SeoModule } from '../seo/seo.module'; // 🚀 Pour RiskFlagsEngineService + GooglebotDetectorService
import { RagProxyModule } from '../rag-proxy/rag-proxy.module'; // 📖 Pour RagProxyService (enrichissement buying guide)
import { AiContentModule } from '../ai-content/ai-content.module'; // 🤖 Pour ConseilEnricher + BuyingGuideSEODraft (optional LLM polish)
import { SystemModule } from '../system/system.module';
import { AdminDbGovernanceController } from './controllers/admin-db-governance.controller';
import { AdminPipelineController } from './controllers/admin-pipeline.controller'; // 🚀 Unified pipeline execution
import { AdminRagPipelineStatusController } from './controllers/admin-rag-pipeline-status.controller';
import { ExecutionRouterService } from './services/execution-router.service'; // 🚀 Enricher dispatch router
import { R2EnricherService } from './services/r2-enricher.service'; // 🏗️ R2 Product enricher (WriteGate-native)
import { R1EnricherService } from './services/r1-enricher.service'; // 🏗️ R1 Router enricher (0-LLM, RAG+KP)
import { ContentQualityGateService } from './services/content-quality-gate.service'; // 🚦 Cross-role quality gates
import { R4ContentEnricherService } from './services/r4-content-enricher.service'; // 🏗️ R4 Reference enricher (0-LLM audit + lint)
import { R4LintGatesService } from './services/r4-lint-gates.service'; // 🚦 R4 content lint gates LG1-LG8
import { InternalPipelineController } from './controllers/internal-pipeline.controller'; // 🚀 Internal pipeline (X-Internal-Key auth)
import { InternalSeoAuditController } from './controllers/internal-seo-audit.controller'; // 📊 Internal SEO audit (X-Internal-Key auth)

@Module({
  imports: [
    DatabaseModule,
    OrdersModule,
    StaffModule,
    ProductsModule,
    WorkerModule, // 📊 Import pour SeoMonitorSchedulerService + BullMQ queues (pipeline-chain)
    SeoModule, // 🚀 Import pour accès aux services SEO (risk flags, googlebot)
    RagProxyModule, // 📖 Import pour accès à RagProxyService (enrichissement buying guide)
    SystemModule, // DB governance Phase 2 (DbGovernanceService)
    AiContentModule, // 🤖 Pour ConseilEnricher + BuyingGuideSEODraft (optional LLM polish)
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
    InternalEnrichController, // 🔑 Internal enrichment (API key) - /api/internal/buying-guides/*
    AdminPageBriefController, // 📋 Page Briefs SEO - /api/admin/page-briefs/*
    AdminKeywordClustersController, // 🔑 Keyword Clusters & Overlaps - /api/admin/keyword-clusters/*
    AdminKeywordPlannerController, // 📊 Keyword Planner Coverage - /api/admin/keyword-planner/*
    AdminHealthController, // 🏥 Health Overview - /api/admin/health/*
    AdminConseilController, // 📊 Conseil coverage + backfill - /api/admin/conseil/*
    AdminRagIngestController, // 📄 PDF → RAG merge - /api/admin/rag/pdf-merge/*
    AdminR3ImagePromptsController, // 🎨 R3 Image Prompts - /api/admin/r3-image-prompts/*
    AdminR1ImagePromptsController, // 🎨 R1 Image Briefs - /api/admin/r1-image-prompts/*
    AdminFeatureFlagsController, // 🏷️ Feature Flags - /api/admin/feature-flags/*
    AdminR8VehicleController, // 🚗 R8 Vehicle enrichment - /api/admin/r8/enrich/:typeId
    AdminR7BrandController, // 🏭 R7 Brand enrichment - /api/admin/r7/enrich/:marqueId
    AdminVehicleRagController, // 🚗 Vehicle RAG generation - /api/admin/vehicle-rag/*
    // AdminSupplierStatsController — not ready for prod
    AdminDbGovernanceController, // 📊 DB Governance Phase 2 - /api/admin/db-governance/*
    AdminPipelineController, // 🚀 Unified pipeline execution - /api/admin/pipeline/*
    AdminRagPipelineStatusController, // 📊 RAG pipeline dashboard - /api/admin/rag-pipeline/status
    InternalPipelineController, // 🚀 Internal pipeline (X-Internal-Key) - /api/internal/pipeline/*
    InternalSeoAuditController, // 📊 Internal SEO audit (X-Internal-Key) - /api/internal/seo/audit/*
  ],
  providers: [
    ConfigurationService,
    StockManagementService, // ✅ Service principal stock
    WorkingStockService, // ✅ Service complémentaire (search, export, stats)
    // ❌ RealStockService - SUPPRIMÉ (fonctionnalité minimaliste)
    ReportingService,
    UserManagementService,
    // AdminProductsService,
    // StaffService fourni par StaffModule (imports)
    AdminGammesSeoService, // 🎯 Service Gammes SEO
    GammeSeoThresholdsService, // 🎯 Seuils Gammes SEO
    GammeSeoAuditService, // 🎯 Audit Gammes SEO
    GammeSeoBadgesService, // 🏷️ Badges & Aggregates
    SeoCockpitService, // 🚀 Service SEO Cockpit Unifié
    GammeDetailEnricherService,
    GammeVLevelService,
    StockMovementService,
    StockReportService,
    BuyingGuideEnricherService, // 📖 RAG enrichment orchestrator
    BuyingGuideRagFetcherService, // 📖 RAG content fetching + parsing
    BuyingGuideSectionExtractor, // 📖 Markdown section extraction
    BuyingGuideQualityGatesService, // 📖 Quality validation gates
    BuyingGuideDbService, // 📖 DB operations (anti-regression)
    BuyingGuideSeoDraftService, // 📖 SEO draft generation
    ConseilEnricherService, // 🔄 R3 Conseils S1-S8 enricher
    PageBriefService, // 📋 Page Briefs CRUD + overlap detection
    BriefGatesService, // 🚦 Pre-publish gates anti-cannibalisation
    HardGatesService, // 🚦 Hard gates (attribution, no_guess, scope, contradiction, seo)
    KeywordDensityGateService, // 🚦 Gate F: keyword density (feature flag KEYWORD_DENSITY_GATE_ENABLED)
    ImageGatesService, // 🚦 P3: image gates (OG, hero policy, alt text)
    AdminJobHealthService, // 🏥 Job health tracking (used by processors via WorkerModule)
    AdminHealthService, // 🏥 Health overview aggregator
    EnricherTextUtils, // 🔧 Shared text utilities (anonymize, stripHtml, restoreAccents, etc.)
    EnricherYamlParser, // 🔧 Shared YAML/frontmatter parsing (extractYamlList, extractYamlFaq, etc.)
    RagGammeReaderService, // 🔧 Centralized RAG gamme disk reading + parsing
    QualityScoringEngineService, // 📊 Quality scoring engine (multi-page, 4 dimensions)
    GammeAggregatorService, // 📊 Gamme-level weighted score aggregation
    RagSafeDistillService, // 🔒 RAG Safe Distill (pre-enricher chunk filter, 0-LLM)
    ConseilQualityScorerService, // 📊 Section quality scoring + pack coverage
    ConseilPriorityService, // 📊 Priority queue for conseil enrichment
    KeywordPlanGatesService, // 🚦 Keyword plan gates G1-G6 (keyword-planner agent)
    R1KeywordPlanGatesService, // 🚦 R1 Keyword plan gates KA1-KA6 (R1 pipeline + keyword-planner R1 mode)
    R1KeywordPlanBatchService, // 🔄 R1 KP batch 0-LLM generator
    R3ImagePromptService, // 🎨 R3 Image Prompts (template-based, 0-LLM)
    R1ContentFromRagService, // 📝 R1 Content from RAG (0-LLM)
    R1ImagePromptService, // 🎨 R1 Image Brief generator
    R8VehicleEnricherService, // 🚗 R8 Vehicle page enricher (RAG + diversity scoring, 0-LLM)
    EngineProfileRagLoader, // 🚗 ADR-022 Pilier A : runtime RAG reader for S_MOTOR_ISSUES
    R7BrandEnricherService, // 🏭 R7 Brand page enricher (RAG + diversity scoring, 0-LLM)
    BrandEditorialService, // 🏭 R7 Brand editorial content CRUD
    VehicleRagGeneratorService, // 🚗 Vehicle RAG .md generator (DB + gamme RAGs, 0-LLM)
    RagProposalService, // 📝 ADR-022 L1 propose-before-write staging (__rag_proposals)
    // AdminSupplierStatsService — not ready for prod
    ExecutionRouterService, // 🚀 Unified enricher dispatch router (ExecutionRegistry-based)
    R2EnricherService, // 🏗️ R2 Product enricher (WriteGate-native, 0-LLM)
    R1EnricherService, // 🏗️ R1 Router enricher (0-LLM, RAG+KP → r1_gamme_slots)
    ContentQualityGateService, // 🚦 Cross-role quality gates (R1/R3/R4/R6 min lengths + vocab)
    R4ContentEnricherService, // 🏗️ R4 Reference enricher (0-LLM audit + lint gates)
    R4LintGatesService, // 🚦 R4 content lint gates LG1-LG8
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
    PageBriefService, // 📋 Export for WorkerModule (enricher consumption)
    BriefGatesService, // 🚦 Export for WorkerModule (processor gates)
    HardGatesService, // 🚦 Export for WorkerModule (hard gates)
    ImageGatesService, // 🚦 Export for WorkerModule (image gates)
    AdminJobHealthService, // 🏥 Export for WorkerModule (job health tracking)
    RagSafeDistillService, // 🔒 Export for WorkerModule (RAG safe distill)
    KeywordPlanGatesService, // 🚦 Export for keyword-planner agent
    R1KeywordPlanGatesService, // 🚦 Export for R1 pipeline + keyword-planner R1 mode
    R8VehicleEnricherService, // 🚗 Export for content-refresh processor
    R7BrandEnricherService, // 🏭 Export for R7 brand enrichment
    VehicleRagGeneratorService, // 🚗 Export for R8 enricher auto-generate
    RagGammeReaderService, // 🔧 Export for gamme-rest (r1-related-resources)
  ],
})
export class AdminModule {}
