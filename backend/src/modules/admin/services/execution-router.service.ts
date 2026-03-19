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

    // 2. R7_BRAND: not implemented yet
    if (roleId === RoleId.R7_BRAND) {
      return this.errorResult(
        request,
        start,
        'R7_BRAND enricher not implemented. Use /content-gen --r7 or r7-brand-execution agent.',
      );
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

    // 5. Dispatch to the right enricher per role
    const results: ExecutionTargetResult[] = [];

    for (const targetId of request.targetIds) {
      try {
        const data = await this.dispatchSingle(
          roleId,
          enricher,
          targetId,
          dryRun,
          request.vehicleKey,
        );
        results.push({
          targetId,
          status: this.inferStatus(data),
          data,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${roleId}] target=${targetId} error: ${msg}`);
        results.push({ targetId, status: 'failed', error: msg });
      }
    }

    return {
      roleId,
      mode: entry.defaultWriteMode,
      dryRun,
      totalTargets: request.targetIds.length,
      results,
      duration: Date.now() - start,
    };
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
      pageType: 'R7_brand',
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

      case RoleId.R8_VEHICLE:
        // R8 does not support dryRun — always writes (WriteGate protects)
        return enricher.enrichSingle!(parseInt(targetId, 10));

      default:
        throw new Error(`No dispatch handler for role: ${roleId}`);
    }
  }

  // ── Private: R4 single-target dispatch ──

  private async dispatchR4Single(
    enricher: EnricherLike,
    targetId: string,
    pgAlias: string | null,
    dryRun: boolean,
  ): Promise<unknown> {
    const slug = pgAlias ?? targetId;

    if (dryRun) {
      // Preview: check if reference exists
      if (typeof enricher.getBySlug === 'function') {
        const existing = await enricher.getBySlug(slug);
        return {
          targetId,
          dryRun: true,
          exists: !!existing,
          slug,
          action: existing ? 'skip (already exists)' : 'would create',
        };
      }
      return this.dryRunPreview(RoleId.R4_REFERENCE, targetId, pgAlias);
    }

    // Check if already exists
    const { count } = await this.client
      .from('__seo_reference')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);

    if ((count ?? 0) > 0) {
      return {
        targetId,
        status: 'skipped',
        reason: 'reference already exists',
      };
    }

    // Generate for this single gamme by loading its data and inserting
    // Use generateFromGammes() but note it processes ALL gammes.
    // For single-target, we insert directly.
    const { data: gamme } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_id', targetId)
      .single();

    if (!gamme) {
      return { targetId, status: 'skipped', reason: 'gamme not found' };
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
    _enricher: EnricherLike,
    targetId: string,
    pgAlias: string | null,
    dryRun: boolean,
  ): Promise<unknown> {
    const slug = pgAlias ?? targetId;

    if (dryRun) {
      // Count existing diagnostics for this gamme
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
            : 'would create from templates',
      };
    }

    // Generate diagnostics for this single gamme
    const { data: gamme } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_id', targetId)
      .single();

    if (!gamme) {
      return { targetId, status: 'skipped', reason: 'gamme not found' };
    }

    // Check if already exists
    const { count } = await this.client
      .from('__seo_observable')
      .select('id', { count: 'exact', head: true })
      .like('slug', `%-${gamme.pg_alias}`);

    if ((count ?? 0) > 0) {
      return {
        targetId,
        status: 'skipped',
        reason: `${count} diagnostics already exist for ${gamme.pg_alias}`,
      };
    }

    // Insert basic diagnostic entry for this gamme
    const { error } = await this.client.from('__seo_observable').insert({
      slug: `usure-${gamme.pg_alias}`,
      label: `Usure ${gamme.pg_name}`,
      observable_type: 'symptom',
      cluster_id: gamme.pg_alias,
      related_gammes: [parseInt(targetId, 10)],
      is_published: false,
    });

    if (error) {
      return { targetId, status: 'failed', reason: error.message };
    }

    return {
      targetId,
      status: 'enriched',
      slug: `usure-${gamme.pg_alias}`,
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
