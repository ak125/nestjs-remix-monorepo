import type { Logger } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Context attached to every parse-or-soft call for observability.
 */
export interface ParseResponseContext {
  /** Class name of the controller (e.g. "ReferenceController"). */
  controller: string;
  /** Method or route handler name (e.g. "getStatus"). */
  endpoint: string;
}

/**
 * Strict mode flag — when true, throws on parse failure instead of returning
 * the raw input. Read at call time (not module load) so per-test overrides work
 * with `process.env.SEO_ROLE_STRICT` mutations between cases.
 *
 * Set `SEO_ROLE_STRICT=true` in DEV / CI to catch regressions early.
 */
function isStrictMode(): boolean {
  return process.env.SEO_ROLE_STRICT === 'true';
}

/**
 * Kill-switch — when true, bypasses normalization entirely and returns raw.
 * Read at call time, see {@link isStrictMode}.
 *
 * Use to disable response normalization in production without a code rollback,
 * e.g. if a schema is mis-written and causes broken responses.
 */
function isNormalizationDisabled(): boolean {
  return process.env.SEO_ROLE_NORMALIZE_RESPONSE === 'false';
}

/**
 * Compteurs Prometheus-friendly (in-memory, non persistant).
 *
 * Format des metric names (à exposer via /metrics ou pino):
 *  - seo_role_normalization_failed_total{controller,endpoint}
 *  - seo_role_normalize_response_disabled_total{controller,endpoint}
 *
 * Ces compteurs alimentent la précondition mesurable de PR-5
 * ("0 fail sur 7 jours consécutifs sur les controllers décorés").
 *
 * **Cluster / multi-process caveat** : ces Maps sont per-process. En cluster
 * (PM2 / Node cluster module / Kubernetes replicas), chaque worker tient sa
 * propre instance — Prometheus scrape doit collecter via /metrics par worker
 * (pattern standard). Pour un total agrégé applicatif, agréger côté Prometheus
 * via `sum()` et non via lecture du compteur in-memory côté code.
 */
const FAIL_COUNTER = new Map<string, number>();
const KILL_SWITCH_COUNTER = new Map<string, number>();

function incrementCounter(
  store: Map<string, number>,
  ctx: ParseResponseContext,
): void {
  const key = `${ctx.controller}:${ctx.endpoint}`;
  store.set(key, (store.get(key) ?? 0) + 1);
}

/**
 * Read-only access to the failure counter for tests / metrics endpoints.
 */
export function getRoleNormalizationFailCount(
  controller?: string,
  endpoint?: string,
): number {
  if (controller && endpoint) {
    return FAIL_COUNTER.get(`${controller}:${endpoint}`) ?? 0;
  }
  return [...FAIL_COUNTER.values()].reduce((a, b) => a + b, 0);
}

/**
 * Read-only access to the kill-switch counter.
 */
export function getRoleNormalizationKillSwitchCount(): number {
  return [...KILL_SWITCH_COUNTER.values()].reduce((a, b) => a + b, 0);
}

/**
 * Reset counters — for unit tests only.
 */
export function _resetRoleNormalizationCounters(): void {
  FAIL_COUNTER.clear();
  KILL_SWITCH_COUNTER.clear();
}

/**
 * Parse `raw` against `schema` with three behaviors :
 *
 * - **Success** : returns the parsed (and normalized) value.
 * - **Failure + STRICT_MODE** (DEV/CI) : throws `ZodError`.
 * - **Failure + soft** (PROD default) : logs structured warning, increments
 *   counter, returns `raw` unchanged so the response doesn't break.
 *
 * Kill switch : if `SEO_ROLE_NORMALIZE_RESPONSE=false`, skip parse and return raw
 * immediately (counter incremented separately).
 *
 * Use at the controller boundary for SEO/admin response validation, e.g.:
 *
 *   @Get('status')
 *   async getStatus(): Promise<StatusResponse> {
 *     const raw = await this.service.compute();
 *     return parseResponseOrSoft(statusResponseSchema, raw, {
 *       controller: AdminRagPipelineStatusController.name,
 *       endpoint: 'getStatus',
 *     }, this.logger) as StatusResponse;
 *   }
 *
 * @returns Parsed value (success), or raw input (soft fallback). Caller is
 *   responsible for typing — runtime guarantees only when `STRICT_MODE=true`.
 */
export function parseResponseOrSoft<T>(
  schema: ZodSchema<T>,
  raw: unknown,
  context: ParseResponseContext,
  logger: Logger,
): T | unknown {
  if (isNormalizationDisabled()) {
    incrementCounter(KILL_SWITCH_COUNTER, context);
    return raw;
  }

  const result = schema.safeParse(raw);
  if (result.success) return result.data;

  // Failure path
  if (isStrictMode()) {
    // Re-throw with context so DEV/CI catches the regression
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(
      `[seo_role_normalization_failed_strict] ${context.controller}.${context.endpoint}: ${issues}`,
    );
  }

  logger.warn(
    {
      metric: 'seo_role_normalization_failed',
      controller: context.controller,
      endpoint: context.endpoint,
      issues: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        received:
          'received' in i ? (i as { received?: unknown }).received : undefined,
      })),
    },
    `seo_role_normalization_failed: ${context.controller}.${context.endpoint}`,
  );
  incrementCounter(FAIL_COUNTER, context);
  return raw;
}
