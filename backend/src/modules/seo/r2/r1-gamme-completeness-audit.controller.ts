/**
 * ADR-070 PR 2C' — R1 Gamme Completeness Audit Admin Controller
 *
 * Admin endpoint pour visualiser l'audit de complétude R1 prerequisite
 * AVANT le pilote V1 R2 v2 :
 *
 *   GET /api/admin/seo/r1/gamme-completeness-audit?sampleLimit=50
 *
 * Returns aggregated counts + top N incomplete gammes (status missing/partial)
 * pour relance manuelle de l'agent r1-keyword-planner (workspace seo-batch).
 *
 * Pilot V1 blocker : si > 30% gammes incomplètes → backfill R1 obligatoire
 * AVANT compose R2 (sinon massif review_required reason r1_gamme_sections_empty).
 *
 * Security : @UseGuards(IsAdminGuard) — admin authenticated only.
 *
 * Cf canon `feedback_no_overclaim_security_words` : 2-layer (admin guard + Rego).
 */

import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  R1GammeCompletenessAuditService,
  R1GammeCompletenessAuditReport,
} from './services/r1-gamme-completeness-audit.service';

@Controller('api/admin/seo/r1')
@UseGuards(IsAdminGuard)
export class R1GammeCompletenessAuditController {
  private readonly logger = new Logger(R1GammeCompletenessAuditController.name);

  constructor(private readonly auditService: R1GammeCompletenessAuditService) {}

  /**
   * GET /api/admin/seo/r1/gamme-completeness-audit
   *
   * Query params :
   *   - sampleLimit (optional, default 50, max 500) :
   *     top N incomplete gammes à inclure dans rowsSample
   *
   * Use case : admin UI dashboard de pré-pilote V1 R2 v2.
   * Si pilotV1Blocker=true, l'admin relance r1-keyword-planner agent via
   * le workspace seo-batch pour les pg_ids listés dans rowsSample.
   */
  @Get('gamme-completeness-audit')
  async audit(
    @Query('sampleLimit') sampleLimitRaw?: string,
  ): Promise<R1GammeCompletenessAuditReport> {
    // Strict numeric parse (canon `feedback_strict_numeric_targetid_parsing`)
    let sampleLimit = 50;
    if (sampleLimitRaw !== undefined) {
      if (!/^\d+$/.test(sampleLimitRaw)) {
        // Invalid → fallback to default
        this.logger.warn(
          `Invalid sampleLimit query=${sampleLimitRaw}, falling back to 50`,
        );
      } else {
        sampleLimit = Math.min(500, Math.max(1, Number(sampleLimitRaw)));
      }
    }

    return this.auditService.auditCompleteness(sampleLimit);
  }
}
