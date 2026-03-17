/**
 * MODULE WORKER BULLMQ
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Processors
// import { SitemapProcessor } from './processors/sitemap.processor'; // DESACTIVE temporairement
// import { CacheProcessor } from './processors/cache.processor'; // DESACTIVE - Besoin IORedis Module
import { EmailProcessor } from './processors/email.processor';
import { SeoMonitorProcessor } from './processors/seo-monitor.processor';
import { ContentRefreshProcessor } from './processors/content-refresh.processor';
import { VideoExecutionProcessor } from './processors/video-execution.processor';

// Services (depuis modules existants)
// import { SitemapStreamingService } from '../modules/seo/services/sitemap-streaming.service'; // DESACTIVE
// import { SitemapDeltaService } from '../modules/seo/services/sitemap-delta.service'; // DESACTIVE

// Services Workers
import { SeoMonitorSchedulerService } from './services/seo-monitor-scheduler.service';

// Dependencies for ContentRefreshProcessor
import { RagProxyModule } from '../modules/rag-proxy/rag-proxy.module';
import { AiContentModule } from '../modules/ai-content/ai-content.module';
import { BuyingGuideEnricherService } from '../modules/admin/services/buying-guide-enricher.service';
import {
  BuyingGuideRagFetcherService,
  BuyingGuideSectionExtractor,
  BuyingGuideQualityGatesService,
  BuyingGuideDbService,
  BuyingGuideSeoDraftService,
} from '../modules/admin/services/buying-guide';
import { R1ContentPipelineService } from '../modules/admin/services/r1-content-pipeline.service';
import { ConseilEnricherService } from '../modules/admin/services/conseil-enricher.service';
import { ReferenceService } from '../modules/seo/services/reference.service';
import { DiagnosticService } from '../modules/seo/services/diagnostic.service';
import { BriefGatesService } from '../modules/admin/services/brief-gates.service';
import { HardGatesService } from '../modules/admin/services/hard-gates.service';
import { ImageGatesService } from '../modules/admin/services/image-gates.service';
import { SectionCompilerService } from '../modules/admin/services/section-compiler.service';
import { PageBriefService } from '../modules/admin/services/page-brief.service';
import { KeywordDensityGateService } from '../modules/admin/services/keyword-density-gate.service';
import { EnricherTextUtils } from '../modules/admin/services/enricher-text-utils.service';
import { EnricherYamlParser } from '../modules/admin/services/enricher-yaml-parser.service';

// Job health tracking (used by all processors)
import { AdminJobHealthService } from '../modules/admin/services/admin-job-health.service';
import { RagSafeDistillService } from '../modules/admin/services/rag-safe-distill.service';
import { R1KeywordPlanGatesService } from '../modules/admin/services/r1-keyword-plan-gates.service';
import { PipelineChainPollerService } from '../modules/admin/services/pipeline-chain-poller.service';
import { R8VehicleEnricherService } from '../modules/admin/services/r8-vehicle-enricher.service';
import { VehicleRagGeneratorService } from '../modules/admin/services/vehicle-rag-generator.service';

// Dependencies for VideoExecutionProcessor
import { VideoDataService } from '../modules/media-factory/services/video-data.service';
import { VideoGatesService } from '../modules/media-factory/services/video-gates.service';
import { RenderAdapterService } from '../modules/media-factory/render/render-adapter.service';

// Dependencies for AgenticProcessor
import { AgenticProcessor } from './processors/agentic.processor';
import { AgenticDataService } from '../modules/agentic-engine/services/agentic-data.service';
import { EvidenceLedgerService } from '../modules/agentic-engine/services/evidence-ledger.service';
import { RunManagerService } from '../modules/agentic-engine/services/run-manager.service';
import { PlannerService } from '../modules/agentic-engine/services/planner.service';
import { SolverService } from '../modules/agentic-engine/services/solver.service';
import { CriticService } from '../modules/agentic-engine/services/critic.service';
import { ClaudeCliService } from '../modules/agentic-engine/services/claude-cli.service';
import { FeatureFlagsModule } from '../config/feature-flags.module';
import { ProcessorTrackingService } from './services/processor-tracking.service';
import { ProcessorLinkMarkersService } from './services/processor-link-markers.service';
import { R2EnricherService } from '../modules/admin/services/r2-enricher.service';
import { ExecutionPlanResolverService } from '../config/execution-plan-resolver.service';
import { MailService } from '../services/mail.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Configuration BullMQ
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'redis'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 50,
          removeOnFail: 50,
          timeout: 300_000, // P0: 5 minutes max per job — prevents zombie processing
        },
      }),
      inject: [ConfigService],
    }),

    // Queues BullMQ
    BullModule.registerQueue(
      // { name: 'sitemap' }, // DESACTIVE temporairement
      // { name: 'cache' }, // DESACTIVE temporairement
      { name: 'email' },
      { name: 'seo-monitor' },
      { name: 'content-refresh' },
      { name: 'video-render' },
      { name: 'agentic-engine' },
    ),

    // Modules for ContentRefreshProcessor + AgenticProcessor dependencies
    RagProxyModule,
    AiContentModule, // Used by ContentRefreshProcessor (enrichers need AI providers)
    FeatureFlagsModule, // Used by RunManagerService (agentic budget guard + flags)
  ],

  providers: [
    // Processors
    // SitemapProcessor, // DESACTIVE
    // CacheProcessor, // DESACTIVE
    EmailProcessor,
    SeoMonitorProcessor,
    ContentRefreshProcessor,
    VideoExecutionProcessor,

    // Enricher services (used by ContentRefreshProcessor)
    // NOTE: These 4 services are also declared in AdminModule/SeoModule.
    // WorkerModule does NOT import those modules, so NestJS creates separate instances.
    // Verified stateless (no in-memory cache/state) — safe duplicate. See audit 2026-02-19.
    BuyingGuideEnricherService,
    BuyingGuideRagFetcherService, // 📖 RAG content fetching + parsing
    BuyingGuideSectionExtractor, // 📖 Markdown section extraction
    BuyingGuideQualityGatesService, // 📖 Quality validation gates
    BuyingGuideDbService, // 📖 DB operations (anti-regression)
    BuyingGuideSeoDraftService, // 📖 SEO draft generation
    R1ContentPipelineService, // 🚀 R1 4-prompt pipeline (flag-gated, stateless — safe duplicate)
    ConseilEnricherService,
    ReferenceService,
    DiagnosticService,
    PageBriefService, // Used by BriefGatesService + enrichers (brief-aware templates)
    KeywordDensityGateService, // Gate F: keyword density (injected into BriefGatesService)
    BriefGatesService, // Pre-publish gates anti-cannibalisation
    HardGatesService, // Hard gates (attribution, no_guess, scope, contradiction, seo)
    ImageGatesService, // P3: image gates (OG, hero policy, alt text)
    SectionCompilerService, // Section policy enforcement (raw → compiled)
    EnricherTextUtils, // Used by BuyingGuideEnricherService + ConseilEnricherService
    EnricherYamlParser, // Used by BuyingGuideEnricherService + ConseilEnricherService

    // Video execution dependencies
    // NOTE: Stateless services, safe duplicate (same pattern as enricher services above)
    VideoDataService,
    VideoGatesService,
    RenderAdapterService,

    // Agentic engine processor + dependencies (Phase 2: Claude CLI plan/solve/critique)
    // NOTE: Stateless services, safe duplicate (same pattern as enricher services above)
    AgenticProcessor,
    ClaudeCliService,
    AgenticDataService,
    EvidenceLedgerService,
    RunManagerService,
    PlannerService,
    SolverService,
    CriticService,

    // Job health tracking (shared by all processors)
    AdminJobHealthService,
    RagSafeDistillService, // 🔒 RAG Safe Distill (pre-enricher chunk filter, 0-LLM)
    R1KeywordPlanGatesService, // 🚦 R1 KP gates (used by R1ContentPipelineService, stateless — safe duplicate)
    PipelineChainPollerService, // 🔗 Pipeline chain poller (keyword-plan → conseil auto-refresh)
    ExecutionPlanResolverService, // 📋 P2.1 Execution Registry resolver (flag-gated, stateless — safe duplicate)
    R8VehicleEnricherService, // 🚗 R8 Vehicle enricher (RAG + diversity scoring, 0-LLM, stateless — safe duplicate)
    VehicleRagGeneratorService, // 🚗 Vehicle RAG .md generator (DB + gamme RAGs, 0-LLM, stateless — safe duplicate)
    MailService, // Email service for EmailProcessor

    // P1.5 v2.1 — Processor sub-services (extracted from content-refresh.processor.ts)
    ProcessorTrackingService, // 📋 Centralized tracking log writes
    ProcessorLinkMarkersService, // 🔗 Link marker injection (derived content)
    R2EnricherService, // 🛒 R2 Product enricher (WriteGate-native, 0-LLM, stateless — safe duplicate)

    // Services
    // SitemapStreamingService, // DESACTIVE
    // SitemapDeltaService, // DESACTIVE
    SeoMonitorSchedulerService,
  ],
  exports: [SeoMonitorSchedulerService],
})
export class WorkerModule {}
