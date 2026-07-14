/**
 * ExecutionRouterService — Unified enricher dispatcher.
 *
 * Routes execution requests to the correct enricher service
 * using the canonical ExecutionRegistry. One endpoint, all roles.
 *
 * Fixes applied:
 * - R4/R5: single-target dispatch instead of batch-all
 * - R7_BRAND: dispatch to R7BrandEnricherService.enrichSingle(marqueId)
 * - dryRun: supported for R1/R2/R3-conseil/R5/R7/R8 (preview without DB write)
 *
 * @see execution-registry.constants.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EXECUTION_REGISTRY } from '../../../config/execution-registry.constants';
import { RoleId, normalizeRoleId } from '../../../config/role-ids';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { BuyingGuideEnricherService } from '../services/buying-guide-enricher.service';
import { R2EnricherService } from '../services/r2-enricher.service';
import { R8VehicleEnricherService } from '../services/r8-vehicle-enricher.service';
import { R7BrandEnricherService } from '../services/r7-brand-enricher.service';
import { DiagnosticService } from '../../seo/validation/diagnostic.service';
import { R1EnricherService } from '../services/r1-enricher.service';
import { ReferenceService } from '../../seo/services/reference.service';
import { R4ContentEnricherService } from '../services/r4-content-enricher.service';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

// ── Result types ──

export interface ExecutionRequest {
  /** Role to execute (canonical RoleId or legacy alias — will be normalized) */
  roleId: string;
  /** Target IDs: pgId strings for gamme-based roles, typeId numbers for R8 */
  targetIds: string[];
  /** Dry run mode — preview without writing to DB */
  dryRun?: boolean;
  /** Source of the request — used for R4 routing (r4_batch → 0-LLM audit enricher) */
  source?: string;
  /** Optional vehicle key for R2 (gamme × vehicle) */
  vehicleKey?: string;
}

export interface ExecutionTargetResult {
  targetId: string;
  status: 'success' | 'skipped' | 'failed';
  data?: unknown;
  error?: string;
}

export interface ExecutionResult {
  roleId: string;
  mode: string;
  dryRun: boolean;
  totalTargets: number;
  results: ExecutionTargetResult[];
  duration: number;
}

/** Minimal enricher interface for dispatch */
interface EnricherLike {
  enrichSingle?: (...args: unknown[]) => Promise<unknown>;
  enrich?: (...args: unknown[]) => Promise<unknown>;
  getBySlug?: (slug: string) => Promise<unknown>;
  getByPgId?: (pgId: number) => Promise<unknown>;
}

@Injectable()
export class ExecutionRouterService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ExecutionRouterService.name);

  /** Service class map: enricherServiceKey → class constructor */
  private readonly serviceClassMap: Record<
    string,
    new (...args: unknown[]) => unknown
  >;

  private r4ContentEnricher: R4ContentEnricherService | null = null;

  constructor(
    configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly flags: FeatureFlagsService,
  ) {
    super(configService);
    this.serviceClassMap = {
      BuyingGuideEnricherService: BuyingGuideEnricherService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      R2EnricherService: R2EnricherService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      R8VehicleEnricherService: R8VehicleEnricherService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      R7BrandEnricherService: R7BrandEnricherService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      DiagnosticService: DiagnosticService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      R1EnricherService: R1EnricherService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      ReferenceService: ReferenceService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      R4ContentEnricherService: R4ContentEnricherService as unknown as new (
        ...args: unknown[]
      ) => unknown,
    };
  }

  /**
   * Execute an enrichment request routed through the ExecutionRegistry.
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const start = Date.now();

    // 1. Normalize roleId
    const roleId = normalizeRoleId(request.roleId);
    if (!roleId) {
      return this.errorResult(
        request,
        start,
        `Unknown roleId: "${request.roleId}"`,
      );
    }

    // 2. Lookup registry entry
    const entry = EXECUTION_REGISTRY[roleId];
    if (!entry) {
      return this.errorResult(
        request,
        start,
        `No registry entry for role: ${roleId}`,
      );
    }

    // 4. Resolve the enricher service via DI
    const enricher = this.resolveEnricher(entry.enricherServiceKey);
    if (!enricher) {
      return this.errorResult(
        request,
        start,
        `Enricher service "${entry.enricherServiceKey}" not found in DI. Is it registered in AdminModule providers?`,
      );
    }

    const dryRun = request.dryRun ?? true;

    // 5. Dispatch with parallel concurrency (max 5), timeout + retry per target
    const timeoutMs = entry.stopPolicy.timeoutMs;
    const maxRetries = entry.stopPolicy.maxRetries ?? 1;

    const results = await this.executeWithConcurrency(
      request.targetIds,
      5,
      async (targetId) => {
        return this.executeWithRetryBackoff(
          maxRetries,
          async () => {
            const data = await this.executeWithTimeout(timeoutMs, () =>
              this.dispatchSingle(
                roleId,
                enricher,
                targetId,
                dryRun,
                request.vehicleKey,
                request.source,
              ),
            );
            return {
              targetId,
              status: this.inferStatus(data),
              data,
            } as ExecutionTargetResult;
          },
          (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`[${roleId}] target=${targetId} error: ${msg}`);
            return { targetId, status: 'failed' as const, error: msg };
          },
        );
      },
    );

    const executionResult: ExecutionResult = {
      roleId,
      mode: entry.defaultWriteMode,
      dryRun,
      totalTargets: request.targetIds.length,
      results,
      duration: Date.now() - start,
    };

    // 6. Log execution to __pipeline_chain_queue for history
    await this.logExecution(request, executionResult);

    return executionResult;
  }

  /**
   * List available roles with their registry metadata.
   */
  listRoles(): Array<{
    roleId: string;
    pageType: string;
    enricherServiceKey: string;
    available: boolean;
    allowedModes: string[];
    timeoutMs: number;
  }> {
    return Object.values(EXECUTION_REGISTRY).map((entry) => ({
      roleId: entry.roleId,
      pageType: entry.pageType,
      enricherServiceKey: entry.enricherServiceKey,
      available: !!this.resolveEnricher(entry.enricherServiceKey),
      allowedModes: [...entry.allowedModes],
      timeoutMs: entry.stopPolicy.timeoutMs,
    }));
  }

  // ── Private: dispatch per role ──

  private async dispatchSingle(
    roleId: RoleId,
    enricher: EnricherLike,
    targetId: string,
    dryRun: boolean,
    vehicleKey?: string,
    source?: string,
  ): Promise<unknown> {
    // Resolve pgAlias for gamme-based roles
    const pgAlias = await this.resolvePgAlias(targetId);

    switch (roleId) {
      case RoleId.R1_ROUTER:
        if (dryRun) {
          return this.dryRunPreview(roleId, targetId, pgAlias);
        }
        return enricher.enrichSingle!(targetId, pgAlias ?? targetId);

      case RoleId.R2_PRODUCT:
        if (dryRun) {
          return this.dryRunPreview(roleId, targetId, pgAlias);
        }
        return enricher.enrichSingle!(
          targetId,
          pgAlias ?? targetId,
          vehicleKey,
        );

      // R3_CONSEILS: no dispatch case — executable path removed (B2/B6, ADR-027
      // §Correction + ADR-080; RAG producer deleted). The registry entry is gone,
      // so execute() fails explicitly upstream ("No registry entry for role")
      // before ever reaching this switch — same surface as R3_GUIDE.

      case RoleId.R3_GUIDE:
      case RoleId.R6_GUIDE_ACHAT:
        // BuyingGuideEnricherService natively supports dryRun
        return enricher.enrich!([targetId], dryRun);

      case RoleId.R4_REFERENCE:
        // Single-target: check if reference exists for this pgAlias, or generate for single gamme
        return this.dispatchR4Single(
          enricher,
          targetId,
          pgAlias,
          dryRun,
          source,
        );

      case RoleId.R5_DIAGNOSTIC:
        // Single-target: generate diagnostics for one gamme only
        return this.dispatchR5Single(enricher, targetId, pgAlias, dryRun);

      case RoleId.R7_BRAND: {
        // R7 expects a marque_id (number), not a gamme pgId.
        // Validation: strict numeric format + existence in auto_marque.
        const resolved = await this.resolveMarqueId(targetId);
        if (!resolved) {
          return {
            targetId,
            status: 'failed',
            reason: `Invalid or unknown marque_id: "${targetId}". R7_BRAND requires a numeric marque_id existing in auto_marque.`,
          };
        }
        if (dryRun) {
          return this.dryRunR7Preview(
            targetId,
            resolved.marqueId,
            resolved.brand,
          );
        }
        return enricher.enrichSingle!(resolved.marqueId);
      }

      case RoleId.R8_VEHICLE: {
        // R8 expects a vehicle typeId, not a gamme pgId
        const typeId = parseInt(targetId, 10);
        if (isNaN(typeId) || typeId <= 0) {
          return {
            targetId,
            status: 'failed',
            reason: `Invalid vehicle typeId: "${targetId}". R8_VEHICLE requires a numeric typeId (not a gamme pgId).`,
          };
        }
        // Guard: reject if targetId matches an existing pgId (gamme, not vehicle)
        if (pgAlias) {
          return {
            targetId,
            status: 'failed',
            reason: `targetId ${targetId} resolves to gamme "${pgAlias}". R8_VEHICLE requires a vehicle typeId, not a gamme pgId.`,
          };
        }
        if (dryRun) {
          return {
            targetId,
            dryRun: true,
            typeId,
            action: 'would enrich vehicle page',
          };
        }
        return enricher.enrichSingle!(typeId);
      }

      default:
        throw new Error(`No dispatch handler for role: ${roleId}`);
    }
  }

  // ── Private: R4 single-target dispatch (r4_batch 0-LLM audit + dryRun preview only) ──

  private async dispatchR4Single(
    enricher: EnricherLike,
    targetId: string,
    pgAlias: string | null,
    dryRun: boolean,
    source?: string,
  ): Promise<unknown> {
    const slug = pgAlias ?? targetId;

    // Route to R4ContentEnricherService (0-LLM audit — delegates content gen to /content-gen skill)
    if (source === 'r4_batch') {
      const enricher0llm = this.getR4ContentEnricher();
      if (enricher0llm) {
        return enricher0llm.enrichSingle(slug, { dryRun, source });
      }
      this.logger.warn('[R4] R4ContentEnricherService not available');
    }

    if (dryRun) {
      if (typeof enricher.getBySlug === 'function') {
        const existing = await enricher.getBySlug(slug);
        return {
          targetId,
          dryRun: true,
          exists: !!existing,
          slug,
          action: existing
            ? 'skip (already exists)'
            : 'no-op (génération RAG retirée — ADR-031/046)',
        };
      }
      return this.dryRunPreview(RoleId.R4_REFERENCE, targetId, pgAlias);
    }

    // Génération R4 depuis le filesystem RAG retirée (ADR-031/046 — RAG = chatbot only).
    // Écritures R4 gouvernées restantes : SeoGeneratorService (writer live) et
    // R4ContentEnricherService (source='r4_batch', 0-LLM). Pas de fallback d'insert
    // générique — échec explicite, jamais silencieux.
    return {
      targetId,
      status: 'failed',
      slug,
      reason:
        'R4 generation-from-RAG removed (ADR-031/046). Use source=r4_batch (0-LLM audit) or the governed seo-generator writer.',
    };
  }

  // ── Private: R5 single-target dispatch ──

  private async dispatchR5Single(
    _enricher: EnricherLike,
    targetId: string,
    pgAlias: string | null,
    dryRun: boolean,
  ): Promise<unknown> {
    const slug = pgAlias ?? targetId;

    if (dryRun) {
      const { count } = await this.client
        .from('__seo_observable')
        .select('id', { count: 'exact', head: true })
        .like('slug', `%-${slug}`);

      return {
        targetId,
        dryRun: true,
        existingDiagnostics: count ?? 0,
        slug,
        action:
          (count ?? 0) > 0
            ? 'skip (diagnostics exist)'
            : 'no-op (génération templates/RAG retirée — ADR-031/046)',
      };
    }

    // Génération R5 (templates + parsing RAG filesystem) retirée (ADR-031/046 —
    // RAG = chatbot only). Pas de fallback d'insert générique — échec explicite,
    // jamais silencieux. Lecture/CRUD R5 (getBySlug, publish, qualityAudit…) intacts.
    return {
      targetId,
      status: 'failed',
      slug,
      reason:
        'R5 template/RAG generation removed (ADR-031/046). No write dispatch for R5_DIAGNOSTIC.',
    };
  }

  // ── Private: dry-run preview (for enrichers without native dryRun) ──

  private async dryRunPreview(
    roleId: RoleId,
    targetId: string,
    pgAlias: string | null,
  ): Promise<unknown> {
    // Load RAG file info for preview
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const ragPath = join(
      `${RAG_KNOWLEDGE_PATH}/gammes`,
      `${pgAlias ?? targetId}.md`,
    );
    const hasRag = existsSync(ragPath);

    // Load gamme info
    const { data: gamme } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias')
      .eq('pg_id', targetId)
      .single();

    return {
      targetId,
      dryRun: true,
      roleId,
      pgAlias: pgAlias ?? targetId,
      gammeName: gamme?.pg_name ?? 'unknown',
      hasRagFile: hasRag,
      action: hasRag ? 'would enrich from RAG' : 'would skip (no RAG file)',
      status: hasRag ? 'ready' : 'skipped',
    };
  }

  // ── Private: timeout wrapper ──

  private async executeWithTimeout<T>(
    timeoutMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
        timeoutMs,
      );
      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  // ── Private: retry wrapper with exponential backoff ──

  private async executeWithRetryBackoff<T>(
    maxRetries: number,
    fn: () => Promise<T>,
    onFinalError: (err: unknown) => T,
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= maxRetries) {
          return onFinalError(err);
        }
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        this.logger.warn(
          `Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${err instanceof Error ? err.message : err}`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return onFinalError(new Error('Unreachable'));
  }

  // ── Private: parallel execution with concurrency limit ──

  private async executeWithConcurrency<T>(
    items: string[],
    concurrency: number,
    fn: (item: string) => Promise<T>,
  ): Promise<T[]> {
    const results: T[] = [];
    const executing = new Set<Promise<void>>();

    for (const item of items) {
      const p = fn(item).then((result) => {
        results.push(result);
      });
      const wrapped = p.then(() => {
        executing.delete(wrapped);
      });
      executing.add(wrapped);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  // ── Private: log execution to __pipeline_chain_queue ──

  private async logExecution(
    request: ExecutionRequest,
    result: ExecutionResult,
  ): Promise<void> {
    try {
      const successCount = result.results.filter(
        (r) => r.status === 'success',
      ).length;
      const skippedCount = result.results.filter(
        (r) => r.status === 'skipped',
      ).length;
      const failedCount = result.results.filter(
        (r) => r.status === 'failed',
      ).length;

      const firstPgId = parseInt(request.targetIds[0], 10);
      const firstAlias = await this.resolvePgAlias(request.targetIds[0]);

      await this.client.from('__pipeline_chain_queue').insert({
        pcq_pg_id: isNaN(firstPgId) ? 0 : firstPgId,
        pcq_pg_alias: firstAlias ?? request.targetIds[0],
        pcq_page_type: result.roleId,
        pcq_source: 'execution_router',
        pcq_status: failedCount === 0 ? 'done' : 'failed',
        pcq_processed_at: new Date().toISOString(),
        pcq_error:
          failedCount > 0
            ? (this.extractDetailedError(result) ??
              `${failedCount}/${result.totalTargets} failed`)
            : null,
        pcq_sections: request.targetIds,
      });

      this.logger.debug(
        `Execution logged: role=${result.roleId} success=${successCount} skipped=${skippedCount} failed=${failedCount} duration=${result.duration}ms`,
      );
    } catch (err) {
      // Non-blocking — don't fail the execution if logging fails
      this.logger.warn(
        `Failed to log execution: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ── Private: extract detailed error from execution result ──

  private extractDetailedError(result: ExecutionResult): string | null {
    const firstFailed = result.results.find((r) => r.status === 'failed');
    if (!firstFailed) return null;

    // Priority 1: explicit error message (from thrown errors caught by retry handler)
    if (firstFailed.error) {
      return `${firstFailed.error}`.substring(0, 500);
    }

    // Priority 2: reason from returned data (e.g. QUALITY_BELOW_THRESHOLD)
    if (firstFailed.data && typeof firstFailed.data === 'object') {
      const d = firstFailed.data as Record<string, unknown>;
      if (d.reason) return `${d.reason}`.substring(0, 500);
      if (d.error) return `${d.error}`.substring(0, 500);
    }

    return null;
  }

  // ── Private: resolve enricher from DI ──

  /** Lazy-resolve R4ContentEnricherService via ModuleRef (avoids constructor DI issues) */
  private getR4ContentEnricher(): R4ContentEnricherService | null {
    if (this.r4ContentEnricher) return this.r4ContentEnricher;
    try {
      this.r4ContentEnricher = this.moduleRef.get(R4ContentEnricherService, {
        strict: false,
      });
      return this.r4ContentEnricher;
    } catch {
      return null;
    }
  }

  private resolveEnricher(serviceKey: string): EnricherLike | null {
    const serviceClass = this.serviceClassMap[serviceKey];
    if (!serviceClass) {
      this.logger.warn(`Unknown enricher service key: ${serviceKey}`);
      return null;
    }

    try {
      return this.moduleRef.get(serviceClass, {
        strict: false,
      }) as EnricherLike;
    } catch (err) {
      this.logger.warn(
        `Failed to resolve ${serviceKey}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  // ── Private: resolve pg_alias from pgId ──

  private async resolvePgAlias(pgId: string): Promise<string | null> {
    try {
      const { data } = await this.client
        .from('pieces_gamme')
        .select('pg_alias')
        .eq('pg_id', pgId)
        .single();
      return data?.pg_alias ?? null;
    } catch {
      return null;
    }
  }

  // ── Private: resolve marque_id from targetId (R7_BRAND) ──

  /**
   * Strictly numeric `targetId` ⇒ `auto_marque` row.
   *
   * Rejects:
   * - non-numeric formats: `"abc"`, `"30abc"`, `"+30"`, `"0x1E"`, `" 30"`, `""`
   * - non-positive ids: `"0"`, `"-1"` (regex blocks `-1`; `<= 0` blocks `0`)
   * - missing rows in `auto_marque`
   *
   * Note: `parseInt("30abc", 10) === 30` would silently inject — the strict
   * regex `/^\d+$/` blocks that case.
   */
  private async resolveMarqueId(targetId: string): Promise<{
    marqueId: number;
    brand: { marque_alias: string; marque_name: string };
  } | null> {
    if (!/^\d+$/.test(targetId)) return null;

    const marqueId = Number.parseInt(targetId, 10);
    if (Number.isNaN(marqueId) || marqueId <= 0) return null;

    try {
      const { data } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_alias, marque_name')
        .eq('marque_id', marqueId)
        .single();
      if (!data) return null;
      return {
        marqueId,
        brand: {
          marque_alias: data.marque_alias ?? '',
          marque_name: data.marque_name ?? '',
        },
      };
    } catch {
      return null;
    }
  }

  // ── Private: dryRun preview for R7_BRAND ──

  /**
   * Read-only preview: SELECT current `__seo_r7_pages` row state, no writes.
   * Returns `status: 'ready'` so `inferStatus` maps to `'success'`.
   */
  private async dryRunR7Preview(
    targetId: string,
    marqueId: number,
    brand: { marque_alias: string; marque_name: string },
  ): Promise<unknown> {
    const pageKey = `r7_brand_${marqueId}`;
    const { data: existing } = await this.client
      .from('__seo_r7_pages')
      .select('id, seo_decision, diversity_score, updated_at')
      .eq('page_key', pageKey)
      .maybeSingle();

    return {
      targetId,
      dryRun: true,
      roleId: RoleId.R7_BRAND,
      marqueId,
      marqueAlias: brand.marque_alias,
      marqueName: brand.marque_name,
      pageKey,
      exists: !!existing,
      currentDecision: existing?.seo_decision ?? null,
      currentScore: existing?.diversity_score ?? null,
      lastUpdate: existing?.updated_at ?? null,
      action: existing
        ? 'would regenerate (page exists)'
        : 'would create R7 brand page',
      status: 'ready',
    };
  }

  // ── Private: infer status from result ──

  private inferStatus(data: unknown): 'success' | 'skipped' | 'failed' {
    if (!data) return 'failed';
    if (typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>;
      if (d.status === 'skipped') return 'skipped';
      if (d.status === 'failed') return 'failed';
      if (d.status === 'ready') return 'success'; // dryRun preview
      if (
        d.status === 'enriched' ||
        d.status === 'draft' ||
        d.updated === true ||
        d.dryRun === true
      )
        return 'success';
    }
    return 'success';
  }

  // ── Private: error result builder ──

  private errorResult(
    request: ExecutionRequest,
    start: number,
    error: string,
  ): ExecutionResult {
    this.logger.error(`ExecutionRouter error: ${error}`);
    return {
      roleId: request.roleId,
      mode: 'blocked_no_write',
      dryRun: request.dryRun ?? true,
      totalTargets: request.targetIds.length,
      results: request.targetIds.map((id) => ({
        targetId: id,
        status: 'failed' as const,
        error,
      })),
      duration: Date.now() - start,
    };
  }
}
