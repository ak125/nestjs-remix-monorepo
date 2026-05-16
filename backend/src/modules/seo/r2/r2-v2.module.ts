/**
 * ADR-066 — R2 v2 NestJS Module
 *
 * Registers all foundation services + pilot controller for PR 1.
 *
 * Non-blocking onModuleInit (cf MEMORY backend.md, no remote I/O at init).
 * Services that need Supabase extend SupabaseBaseService and use lazy DB access.
 *
 * Wired into SeoModule (see backend/src/modules/seo/seo.module.ts).
 */

import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { R1GammeCompletenessAuditController } from './r1-gamme-completeness-audit.controller';
import { R2AdminPilotController } from './r2-admin-pilot.controller';
import {
  R8_ENRICHMENT_QUEUE_NAME,
  SEO_OUTBOX_QUEUE_NAME,
} from './queues/r8-enrichment.constants';
import {
  OutboxRelayProcessor,
  R8EnrichmentProcessor,
} from './queues/r8-enrichment.processor';
import { OutboxRelayService } from './services/outbox-relay.service';
import { R1GammeCompletenessAuditService } from './services/r1-gamme-completeness-audit.service';
import { R2CatalogSignatureService } from './services/r2-catalog-signature.service';
import { R2CommercialDistinctivenessService } from './services/r2-commercial-distinctiveness.service';
import { R2CompositionInputSnapshotService } from './services/r2-composition-input-snapshot.service';
import { R2CompositionService } from './services/r2-composition.service';
import { R2EligibilityService } from './services/r2-eligibility.service';
import {
  R2FeatureFlagService,
  R2_FEATURE_FLAG_REDIS_TOKEN,
} from './services/r2-feature-flag.service';
import { R2MotorDeltaService } from './services/r2-motor-delta.service';
import { R2OpaEvaluatorService } from './services/r2-opa-evaluator.service';
import { R2VehicleFamilyService } from './services/r2-vehicle-family.service';
import { R8ParentEnrichmentService } from './services/r8-parent-enrichment.service';
import { R8SnapshotSeedService } from './services/r8-snapshot-seed.service';
import {
  R8SnapshotReaderService,
  R8_SNAPSHOT_CACHE_TOKEN,
} from './services/r8-snapshot-reader.service';
import { SeoOutboxRelaySchedulerService } from './services/seo-outbox-relay-scheduler.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue(
      { name: R8_ENRICHMENT_QUEUE_NAME },
      { name: SEO_OUTBOX_QUEUE_NAME },
    ),
  ],
  controllers: [R2AdminPilotController, R1GammeCompletenessAuditController],
  providers: [
    R1GammeCompletenessAuditService,
    R2CatalogSignatureService,
    R2CommercialDistinctivenessService,
    R2CompositionInputSnapshotService,
    R2CompositionService,
    R2EligibilityService,
    R2MotorDeltaService,
    R2OpaEvaluatorService,
    R2VehicleFamilyService,
    R2FeatureFlagService,
    R8SnapshotReaderService, // ADR-072 §3 R8 Vehicle Domain bounded context read-side
    R8ParentEnrichmentService, // ADR-072 PR 2D-2 write side
    R8SnapshotSeedService, // ADR-072 PR 2D-2 idempotent batch seed
    OutboxRelayService, // ADR-072 PR 2D-2 transactional outbox relay
    SeoOutboxRelaySchedulerService, // BullMQ repeatable scheduler
    R8EnrichmentProcessor,
    OutboxRelayProcessor,
    {
      // Redis provider stub — PR 2 V1.5 wires real Redis client (BullMQ Redis
      // reused). For PR 1 foundation, feature flag falls back to env var.
      provide: R2_FEATURE_FLAG_REDIS_TOKEN,
      useValue: null,
    },
    {
      // R8 snapshot cache provider (Redis L1) — null fallback pour PR 2D-2
      // (cache désactivé tant que BullMQ Redis pas branché ici). PR 2E
      // wire le vrai client Redis (BullMQ Redis réutilisé).
      provide: R8_SNAPSHOT_CACHE_TOKEN,
      useValue: null,
    },
  ],
  exports: [
    R1GammeCompletenessAuditService,
    R2CatalogSignatureService,
    R2CommercialDistinctivenessService,
    R2CompositionService,
    R2EligibilityService,
    R2MotorDeltaService,
    R2OpaEvaluatorService,
    R2FeatureFlagService,
    R8SnapshotReaderService,
    R8ParentEnrichmentService,
    R8SnapshotSeedService,
    OutboxRelayService,
  ],
})
export class R2V2Module {}
