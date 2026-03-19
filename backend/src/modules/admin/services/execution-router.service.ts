/**
 * ExecutionRouterService — Unified enricher dispatcher.
 *
 * Routes execution requests to the correct enricher service
 * using the canonical ExecutionRegistry. One endpoint, all roles.
 *
 * Fixes applied:
 * - R4/R5: single-target dispatch instead of batch-all
 * - R7_BRAND: explicit "not implemented" error
 * - dryRun: supported for R1/R2/R3-conseil (preview without DB write)
 *
 * @see execution-registry.constants.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EXECUTION_REGISTRY } from '../../../config/execution-registry.constants';
import { RoleId, normalizeRoleId } from '../../../config/role-ids';
import { PageType } from '../../../workers/types/content-refresh.types';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { BuyingGuideEnricherService } from '../services/buying-guide-enricher.service';
import { ConseilEnricherService } from '../services/conseil-enricher.service';
import { R2EnricherService } from '../services/r2-enricher.service';
import { R8VehicleEnricherService } from '../services/r8-vehicle-enricher.service';
import { DiagnosticService } from '../../seo/services/diagnostic.service';
import { R1EnricherService } from '../services/r1-enricher.service';
import { ReferenceService } from '../../seo/services/reference.service';

// ── Result types ──

export interface ExecutionRequest {
  /** Role to execute (canonical RoleId or legacy alias — will be normalized) */
  roleId: string;
  /** Target IDs: pgId strings for gamme-based roles, typeId numbers for R8 */
  targetIds: string[];
  /** Dry run mode — preview without writing to DB */
  dryRun?: boolean;
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
  generateFromTemplates?: () => Promise<unknown>;
  generateFromGammes?: () => Promise<unknown>;
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
      ConseilEnricherService: ConseilEnricherService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      R2EnricherService: R2EnricherService as unknown as new (
        ...args: unknown[]
      ) => unknown,
      R8VehicleEnricherService: R8VehicleEnricherService as unknown as new (
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

    // 2. R7_BRAND: not implemented in ExecutionRouter — skip gracefully
    if (roleId === RoleId.R7_BRAND) {
      this.logger.warn(
        'R7_BRAND enricher not available in ExecutionRouter. Use /content-gen --r7 or r7-brand-execution agent.',
      );
      return {
        roleId: request.roleId,
        mode: 'blocked_no_write',
        dryRun: request.dryRun ?? true,
        totalTargets: request.targetIds.length,
        results: request.targetIds.map((id) => ({
          targetId: id,
          status: 'skipped' as const,
          data: {
            reason:
              'R7_BRAND enricher not implemented in pipeline. Use /content-gen --r7 or r7-brand-execution agent.',
          },
        })),
        duration: Date.now() - start,
      };
    }

    // 3. Lookup registry entry
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
    // Include R7 manually (not in registry but is a known role)
    const registryRoles = Object.values(EXECUTION_REGISTRY).map((entry) => ({
      roleId: entry.roleId,
      pageType: entry.pageType,
      enricherServiceKey: entry.enricherServiceKey,
      available: !!this.resolveEnricher(entry.enricherServiceKey),
      allowedModes: [...entry.allowedModes],
      timeoutMs: entry.stopPolicy.timeoutMs,
    }));

    registryRoles.push({
      roleId: RoleId.R7_BRAND,
      pageType: 'R7_brand' as PageType,
      enricherServiceKey: 'not_implemented',
      available: false,
      allowedModes: [],
      timeoutMs: 0,
    });

    return registryRoles;
  }

  // ── Private: dispatch per role ──

  private async dispatchSingle(
    roleId: RoleId,
    enricher: EnricherLike,
    targetId: string,
    dryRun: boolean,
    vehicleKey?: string,
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

      case RoleId.R3_CONSEILS:
        if (dryRun) {
          return this.dryRunPreview(roleId, targetId, pgAlias);
        }
        return enricher.enrichSingle!(targetId, pgAlias ?? targetId);

      case RoleId.R3_GUIDE:
      case RoleId.R6_GUIDE_ACHAT:
        // BuyingGuideEnricherService natively supports dryRun
        return enricher.enrich!([targetId], dryRun);

      case RoleId.R4_REFERENCE:
        // Single-target: check if reference exists for this pgAlias, or generate for single gamme
        return this.dispatchR4Single(enricher, targetId, pgAlias, dryRun);

      case RoleId.R5_DIAGNOSTIC:
        // Single-target: generate diagnostics for one gamme only
        return this.dispatchR5Single(enricher, targetId, pgAlias, dryRun);

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

  // ── Private: R4 single-target dispatch (uses ReferenceService.refreshSingleGamme) ──

  private async dispatchR4Single(
    enricher: EnricherLike,
    targetId: string,
    pgAlias: string | null,
    dryRun: boolean,
  ): Promise<unknown> {
    const slug = pgAlias ?? targetId;

    if (dryRun) {
      if (typeof enricher.getBySlug === 'function') {
        const existing = await enricher.getBySlug(slug);
        return {
          targetId,
          dryRun: true,
          exists: !!existing,
          slug,
          action: existing ? 'skip (already exists)' : 'would create from RAG',
        };
      }
      return this.dryRunPreview(RoleId.R4_REFERENCE, targetId, pgAlias);
    }

    // Use ReferenceService.refreshSingleGamme for enriched RAG content
    const refService = enricher as unknown as {
      refreshSingleGamme?: (alias: string) => Promise<{
        created: boolean;
        updated: boolean;
        skipped: boolean;
        qualityScore?: number;
        qualityFlags?: string[];
      }>;
    };

    if (typeof refService.refreshSingleGamme === 'function') {
      const result = await refService.refreshSingleGamme(slug);
      return {
        targetId,
        status: result.created || result.updated ? 'enriched' : 'skipped',
        slug,
        ...result,
      };
    }

    // Fallback: basic insert
    const { data: gamme } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_id', targetId)
      .single();

    if (!gamme) {
      return { targetId, status: 'skipped', reason: 'gamme not found' };
    }

    const { count } = await this.client
      .from('__seo_reference')
      .select('id', { count: 'exact', head: true })
      .eq('slug', gamme.pg_alias);

    if ((count ?? 0) > 0) {
      return {
        targetId,
        status: 'skipped',
        reason: 'reference already exists',
      };
    }

    const { error } = await this.client.from('__seo_reference').insert({
      slug: gamme.pg_alias,
      title: `${gamme.pg_name} : Définition, rôle et composition`,
      meta_description: `Définition technique du ${gamme.pg_name}: rôle, composition, fonctionnement.`,
      definition: `Le ${gamme.pg_name} est une pièce automobile essentielle.`,
      role_mecanique: `Rôle mécanique du ${gamme.pg_name} dans le véhicule.`,
      pg_id: parseInt(targetId, 10),
      is_published: false,
    });

    if (error) {
      return { targetId, status: 'failed', reason: error.message };
    }

    return {
      targetId,
      status: 'enriched',
      slug: gamme.pg_alias,
      action: 'created',
    };
  }

  // ── Private: R5 single-target dispatch ──

  private async dispatchR5Single(
    enricher: EnricherLike,
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
            : 'would create from templates (RAG-enriched)',
      };
    }

    // Use DiagnosticService.generateForSingleGamme for RAG-enriched content
    const diagService = enricher as unknown as {
      generateForSingleGamme?: (
        pgId: number,
        pgAlias: string,
      ) => Promise<{ created: number; skipped: number }>;
    };

    if (typeof diagService.generateForSingleGamme === 'function') {
      const result = await diagService.generateForSingleGamme(
        parseInt(targetId, 10),
        slug,
      );
      return {
        targetId,
        status: result.created > 0 ? 'enriched' : 'skipped',
        ...result,
      };
    }

    // Fallback: basic check
    const { count } = await this.client
      .from('__seo_observable')
      .select('id', { count: 'exact', head: true })
      .like('slug', `%-${slug}`);

    if ((count ?? 0) > 0) {
      return {
        targetId,
        status: 'skipped',
        reason: `${count} diagnostics already exist for ${slug}`,
      };
    }

    // Fetch gamme info for basic insert
    const { data: gammeData } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_id', targetId)
      .single();

    if (!gammeData) {
      return { targetId, status: 'skipped', reason: 'gamme not found' };
    }

    // Insert basic diagnostic entry for this gamme
    const { error } = await this.client.from('__seo_observable').insert({
      slug: `usure-${gammeData.pg_alias}`,
      label: `Usure ${gammeData.pg_name}`,
      observable_type: 'symptom',
      cluster_id: gammeData.pg_alias,
      related_gammes: [parseInt(targetId, 10)],
      is_published: false,
    });

    if (error) {
      return { targetId, status: 'failed', reason: error.message };
    }

    return {
      targetId,
      status: 'enriched',
      slug: `usure-${gammeData.pg_alias}`,
      action: 'created',
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
      '/opt/automecanik/rag/knowledge/gammes',
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
            ? `${failedCount}/${result.totalTargets} failed`
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

  // ── Private: resolve enricher from DI ──

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
