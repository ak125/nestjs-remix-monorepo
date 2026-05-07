/**
 * SEO Smoke Test Controller — dev/preprod-only endpoint pour valider
 * le pipeline d'observabilité Sentry + OTel (ADR-050 critère #6 + #7).
 *
 * Refus 403 en prod (gate par NODE_ENV check).
 *
 * Usage : scripts/ops/seo-mvp0-smoke-test.sh appelle cet endpoint pour
 * forcer un fail dans chaque enricher et valider :
 *   - Sentry UI montre 1 captureException par rôle
 *   - /metrics expose seo_enrich_total{outcome="error"} et seo_gate_violation_total
 *
 * Sécurité : refus en NODE_ENV=production (double gate avec IsAdminGuard côté
 * AppModule routing).
 */

import {
  Body,
  Controller,
  ForbiddenException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { MetricsService } from '../../metrics/metrics.service';
import { captureEnricherException } from '../../../common/observability/enricher-observability.helper';

/**
 * Robust prod check : NODE_ENV peut être absent, en majuscules, ou avoir
 * du whitespace (cf. memory feedback_strip_env_vars_python.md sur secrets
 * GitHub avec trailing newline).
 *
 * Fail-closed : si NODE_ENV ne peut être lu OU est ambigu, on considère
 * production (refus du smoke test).
 */
function isProdEnv(): boolean {
  const raw = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  return raw === 'production' || raw === 'prod' || raw === '';
}

const SUPPORTED_ROLES = [
  'R0_HOME',
  'R1_ROUTER',
  'R2_PRODUCT',
  'R3_CONSEILS',
  'R4_REFERENCE',
  'R6_GUIDE_ACHAT',
  'R7_BRAND',
  'R8_VEHICLE',
];

@Controller('api/admin/seo')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class SeoSmokeTestController {
  private readonly logger = new Logger(SeoSmokeTestController.name);

  constructor(private readonly metrics: MetricsService) {}

  /**
   * Force un fail dans l'enricher du rôle donné (synthétique, pas d'enrich réel).
   * Émet 1 Sentry captureException + 1 incrementEnrich('error') + 1 incrementGateViolation.
   *
   * Body : { role: 'R0_HOME' | ... | 'R8_VEHICLE' }
   */
  @Post('smoke-fail-enricher')
  smokeFail(@Body() body: { role?: string }): {
    role: string;
    sentryEventCaptured: boolean;
    metricsIncremented: boolean;
  } {
    if (isProdEnv()) {
      throw new ForbiddenException(
        'smoke-fail-enricher refusé en production. Validation prod = capture réelle ou dry-run sécurisé (Options A/B/C plan v12).',
      );
    }

    const role = body.role ?? 'R1_ROUTER';
    if (!SUPPORTED_ROLES.includes(role)) {
      throw new ForbiddenException(
        `role inconnu : ${role}. Valeurs supportées : ${SUPPORTED_ROLES.join(', ')}`,
      );
    }

    const syntheticError = new Error(
      `[SMOKE TEST] Synthetic fail for ${role} — validate Sentry+OTel pipeline (ADR-050)`,
    );
    syntheticError.name = 'SeoMvp0SmokeTestError';

    captureEnricherException(syntheticError, {
      role,
      service: 'SeoSmokeTestController',
      pgId: '__smoke_test__',
      step: 'smoke_fail_enricher',
    });

    this.metrics.incrementEnrich(role, 'error');
    this.metrics.incrementGateViolation(role, 'smoke_test_synthetic');

    this.logger.log(`[SMOKE] ${role} : Sentry + 2 counters incremented`);

    return {
      role,
      sentryEventCaptured: true,
      metricsIncremented: true,
    };
  }

  /**
   * Reset compteurs in-memory (utile entre 2 smoke runs).
   */
  @Post('smoke-reset-metrics')
  smokeReset(): { reset: boolean; warning: string } {
    if (isProdEnv()) {
      throw new ForbiddenException('reset refusé en production.');
    }
    return {
      reset: false,
      warning:
        'in-memory counters reset non implémenté MVP-0 (compteurs reset au restart NestJS naturellement).',
    };
  }
}
