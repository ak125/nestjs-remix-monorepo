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

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { R1GammeCompletenessAuditController } from './r1-gamme-completeness-audit.controller';
import { R2AdminPilotController } from './r2-admin-pilot.controller';
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

@Module({
  imports: [DatabaseModule],
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
    {
      // Redis provider stub — PR 2 V1.5 wires real Redis client (BullMQ Redis
      // reused). For PR 1 foundation, feature flag falls back to env var.
      provide: R2_FEATURE_FLAG_REDIS_TOKEN,
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
  ],
})
export class R2V2Module {}
