/**
 * EnricherObservabilityHelper — helper Sentry + OTel pour enrichers SEO.
 *
 * Implémente ADR-050 Livrable 3 (Sentry captureException obligatoire).
 *
 * Usage dans un enricher :
 *
 *   try {
 *     return await this.runEnrich(slot);
 *   } catch (err) {
 *     captureEnricherException(err, {
 *       role: 'R1_ROUTER',
 *       service: this.constructor.name,
 *       pgId: slot.pg_id,
 *       step: 'micro_seo_block',
 *     });
 *     this.metrics.incrementEnrich('R1_ROUTER', 'error');
 *     throw err; // re-throw pour que le caller puisse abort/retry
 *   }
 *
 * Memory: backend.md "Aucun await d'I/O distante dans onModuleInit" — Sentry
 * SDK est non-blocking (envoi async, queue interne).
 */

import * as Sentry from '@sentry/nestjs';
import { Logger } from '@nestjs/common';

export interface EnricherErrorContext {
  role: string;
  service: string;
  pgId?: string;
  step?: string;
  [key: string]: unknown;
}

/**
 * Capture une exception au catch level d'un enricher avec contexte structuré.
 * Tags Sentry permettent filtrage Sentry UI : role, service, step.
 */
export function captureEnricherException(
  err: unknown,
  ctx: EnricherErrorContext,
  logger?: Logger,
): void {
  Sentry.captureException(err, {
    tags: {
      module: 'seo-enricher',
      role: ctx.role,
      service: ctx.service,
      ...(ctx.step ? { step: ctx.step } : {}),
    },
    extra: {
      pg_id: ctx.pgId ?? null,
      ...ctx,
    },
  });

  if (logger) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      `[${ctx.role}] enrich failed (${ctx.service}): ${message}`,
      err as any,
    );
  }
}
