/**
 * ADR-066 — R2 Admin Pilot Controller
 *
 * Sync pilot endpoint for PR 1 :
 *   POST /api/admin/seo/r2/enrich-single?pgId&typeId
 *
 * Returns the eligibility verdict for a single (pg_id, type_id) pair.
 * No content generation in PR 1 — only Gate 1 evaluation. PR 2 V1.5 adds the
 * full pipeline (compose + diversity + governance gate + LLM content).
 *
 * Used by the pilot V1 batch (10 URLs stratified) to verify the eligibility
 * gate produces the expected sane mix (4-7 INDEX + 2-4 SUPPRESSED + 0-2 REJECT)
 * BEFORE PR 2 is unlocked.
 *
 * Security : @UseGuards(IsAdminGuard) — admin authenticated only (cf
 * MEMORY feedback_no_overclaim_security_words : 2-layer admin + Rego).
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { R2EligibilityService } from './services/r2-eligibility.service';
import { R2FeatureFlagService } from './services/r2-feature-flag.service';
import type {
  R2EnrichSingleDto,
  R2EnrichSingleResponse,
} from './dto/r2-enrich-single.dto';

@Controller('api/admin/seo/r2')
@UseGuards(IsAdminGuard)
export class R2AdminPilotController {
  private readonly logger = new Logger(R2AdminPilotController.name);

  constructor(
    private readonly eligibilityService: R2EligibilityService,
    private readonly featureFlag: R2FeatureFlagService,
  ) {}

  /**
   * Sync pilot eligibility evaluation.
   *
   * PR 1 limitation : data loading (motor delta, commercial inputs) is stubbed
   * here — full wire-up requires R2DataLoaderService (PR 2 V1.5). For PR 1, this
   * endpoint returns a placeholder verdict that exercises the service shape
   * and feature flag, allowing the admin UI / pilot script to be wired early.
   */
  @Post('enrich-single')
  async enrichSingle(
    @Body() dto: R2EnrichSingleDto,
  ): Promise<R2EnrichSingleResponse> {
    // Inline validation (no class-validator dep — aligned with monorepo pattern,
    // cf seo-generator.controller.ts).
    if (
      !dto ||
      !Number.isInteger(dto.pgId) ||
      dto.pgId <= 0 ||
      !Number.isInteger(dto.typeId) ||
      dto.typeId <= 0 ||
      dto.typeId > 99_999_999
    ) {
      throw new BadRequestException(
        'pgId + typeId must be positive integers (typeId <= 99_999_999)',
      );
    }

    const flagEnabled = await this.featureFlag.isEnabled();
    const ts = new Date().toISOString();

    if (!flagEnabled) {
      this.logger.warn(
        `R2_V2_ENABLED is OFF, pilot eval skipped for (${dto.pgId}, ${dto.typeId})`,
      );
      return {
        pgId: dto.pgId,
        typeId: dto.typeId,
        featureFlagEnabled: false,
        eligibility: {
          score: 0,
          verdict: 'reject',
          reason: 'R2_V2_ENABLED feature flag OFF — pilot pipeline disabled',
          subscores: { motor: 0, compat: 0, commercial: 0, crawl: 0 },
        },
        warning: 'feature_flag_off',
        timestamp: ts,
      };
    }

    // PR 1 stub : real R2DataLoaderService wires the input loading in PR 2 V1.5.
    // For PR 1 we surface a stub that returns reject with explicit warning so
    // the pilot batch can detect missing data loader and not silently report
    // a fake "all eligible".
    return {
      pgId: dto.pgId,
      typeId: dto.typeId,
      featureFlagEnabled: true,
      eligibility: {
        score: 0,
        verdict: 'reject',
        reason:
          'PR 1 stub — R2DataLoaderService not yet wired (PR 2 V1.5 deliverable). Eligibility service available but no input data source.',
        subscores: { motor: 0, compat: 0, commercial: 0, crawl: 0 },
      },
      warning: 'pr1_stub_data_loader_pending',
      timestamp: ts,
    };
  }
}
