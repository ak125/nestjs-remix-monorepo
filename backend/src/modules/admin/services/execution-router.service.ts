/**
 * ExecutionRouterService — Unified enricher dispatcher.
 *
 * Routes execution requests to the correct enricher service
 * using the canonical ExecutionRegistry. One endpoint, all roles.
 *
 * Signature normalization: each enricher has its own method signature,
 * this router normalizes { roleId, targetIds, dryRun } into the
 * correct call for each service.
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

    // 3. Resolve the enricher service via DI
    const enricher = this.resolveEnricher(entry.enricherServiceKey);
    if (!enricher) {
      return this.errorResult(
        request,
        start,
        `Enricher service "${entry.enricherServiceKey}" not found in DI. Is it registered in AdminModule providers?`,
      );
    }

    const dryRun = request.dryRun ?? true;

    // 4. Dispatch to the right enricher per role
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
  ): Promise<unknown> {
    // Resolve pgAlias for gamme-based roles
    const pgAlias = await this.resolvePgAlias(targetId);

    switch (roleId) {
      case RoleId.R1_ROUTER:
        // R1EnricherService.enrichSingle(pgId, pgAlias)
        return enricher.enrichSingle!(targetId, pgAlias ?? targetId);

      case RoleId.R2_PRODUCT:
        return enricher.enrichSingle!(
          targetId,
          pgAlias ?? targetId,
          vehicleKey,
        );

      case RoleId.R3_CONSEILS:
        return enricher.enrichSingle!(targetId, pgAlias ?? targetId);

      case RoleId.R3_GUIDE:
      case RoleId.R6_GUIDE_ACHAT:
        return enricher.enrich!([targetId], dryRun);

      case RoleId.R4_REFERENCE:
        if (typeof enricher.enrichSingle === 'function') {
          return enricher.enrichSingle(targetId, pgAlias ?? targetId);
        }
        if (typeof enricher.generateFromTemplates === 'function') {
          return enricher.generateFromTemplates();
        }
        throw new Error('ReferenceService has no enrich method available');

      case RoleId.R5_DIAGNOSTIC:
        if (typeof enricher.generateFromTemplates === 'function') {
          return enricher.generateFromTemplates();
        }
        throw new Error('DiagnosticService has no enrichment method');

      case RoleId.R8_VEHICLE:
        return enricher.enrichSingle!(parseInt(targetId, 10));

      default:
        throw new Error(`No dispatch handler for role: ${roleId}`);
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
      if (d.status === 'enriched' || d.status === 'draft' || d.updated === true)
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
