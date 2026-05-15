/**
 * PR-C — SEO Content Write Gateway (single preflight authority)
 *
 * Single service that callers MUST invoke before any write to a governed SEO
 * content field. The gateway :
 *   1. Validates the request against the OPA policy (PR-V #279, fail-closed)
 *   2. Records the decision in __seo_policy_evaluations (audit-trail)
 *   3. Returns on allow → caller proceeds with the actual UPDATE/UPSERT
 *      Throws PolicyDeniedException on deny
 *
 * Why preflight (not the physical UPDATE) :
 * The physical UPDATE / UPSERT for a row in __meta_tags_ariane often includes
 * 6+ fields besides H1 (mta_title, mta_descrip, mta_content, mta_ariane,
 * mta_relfollow, etc.). Splitting H1 into a separate write would create
 * non-atomic operations and double-writes. The preflight pattern lets the
 * caller keep its single upsert, while ensuring the policy is evaluated and
 * audited before any H1 value is allowed through.
 *
 * The bypass scanner (`scripts/audit/find-direct-h1-writes.ts`) enforces that
 * every file writing to the 4 canonical H1 columns either :
 *   - Calls this gateway's preflight method first, OR
 *   - Is in the explicit infrastructure whitelist (this service, the data
 *     service abstraction, tests, migrations)
 *
 * Governed fields (PR-C ships h1 only) :
 *   - __seo_r1_gamme_slots.r1s_h1_override   (R1_ROUTER)
 *   - __seo_gamme_purchase_guide.sgpg_h1_override (R6_GUIDE_ACHAT)
 *   - __seo_gamme.sg_h1                       (legacy_fallback / R3)
 *   - __meta_tags_ariane.mta_h1               (R7_BRAND | R8_VEHICLE / generic mtaAlias)
 *
 * Memory : feedback_single_write_path_needs_bypass_scanner
 * Plan : §6 Phase C
 */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import {
  OpaPolicyEngineService,
  PolicyDecision,
} from './opa-policy-engine.service';

// ── Public types ─────────────────────────────────────────────────────────────

export type FieldPath = 'h1';

export type SourceKind =
  | 'human_curated'
  | 'human_validated_llm'
  | 'legacy_recovery'
  | 'deterministic_builder'
  | 'llm_generated_direct';

export interface H1WriteSource {
  kind: SourceKind;
  actor: string;
  /** For source.kind=legacy_recovery, evidence_tier from PR-A1 audit. */
  evidenceTier?: string;
  /** For source.kind=legacy_recovery, reference to proposed event (Phase D). */
  proposedEvent?: { eventId: string; parentEventKind: 'proposed' };
  /** For source.kind=legacy_recovery, GrowthBook flag state (Phase E). */
  flagState?: 'enabled' | 'disabled';
  /** For source.kind=deterministic_builder, builder service identifier. */
  service?: string;
}

export type H1Target =
  | { kind: 'mta_alias'; mtaAlias: string }
  | { kind: 'r1_pg'; pgId: number }
  | { kind: 'r6_pg'; pgId: number }
  | { kind: 'legacy_gamme'; pgId: number };

export interface PreflightH1Input {
  target: H1Target;
  value: string;
  source: H1WriteSource;
  /** Whether the asset currently holds an active lock. Caller supplies. */
  lockActive?: boolean;
}

export interface PreflightResult {
  allow: true;
  decision: PolicyDecision;
  evaluationId: string | null;
}

export class PolicyDeniedException extends HttpException {
  constructor(public readonly decision: PolicyDecision) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'PolicyDenied',
        message: 'H1 write refused by OPA policy',
        reasons: decision.reasons,
        policyBundleSha: decision.policyBundleSha,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function targetAssetId(target: H1Target): string {
  switch (target.kind) {
    case 'mta_alias':
      return `mta:${target.mtaAlias}`;
    case 'r1_pg':
      return `r1_router:pg:${target.pgId}`;
    case 'r6_pg':
      return `r6_guide:pg:${target.pgId}`;
    case 'legacy_gamme':
      return `legacy_gamme:pg:${target.pgId}`;
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SeoContentWriteService {
  private readonly logger = new Logger(SeoContentWriteService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly opa: OpaPolicyEngineService) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        '[SeoContentWriteService] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required',
      );
    }
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  /**
   * Preflight an H1 write : evaluate the OPA policy and INSERT an audit row.
   * Throws PolicyDeniedException on deny. Returns on allow — caller MUST then
   * proceed with the actual UPDATE/UPSERT.
   *
   * This is the single authoritative entry-point for governance on H1 writes.
   */
  async preflightH1(input: PreflightH1Input): Promise<PreflightResult> {
    const opaInput = this.buildOpaInput(input);
    const decision = this.opa.evaluateH1Write(opaInput);
    const evaluationId = await this.recordEvaluation(input, opaInput, decision);

    if (!decision.allow) {
      this.logger.warn(
        `[SeoContentWrite] DENY asset=${targetAssetId(input.target)} ` +
          `source=${input.source.kind} reasons=${decision.reasons.join(' | ')}`,
      );
      throw new PolicyDeniedException(decision);
    }

    this.logger.log(
      `[SeoContentWrite] ALLOW asset=${targetAssetId(input.target)} ` +
        `source=${input.source.kind} evaluation_id=${evaluationId ?? '<no-audit>'}`,
    );

    return { allow: true, decision, evaluationId };
  }

  private buildOpaInput(input: PreflightH1Input): Record<string, unknown> {
    return {
      source_kind: input.source.kind,
      actor: input.source.actor,
      field_path: 'h1' satisfies FieldPath,
      asset_id: targetAssetId(input.target),
      lock_active: input.lockActive === true,
      evidence_tier: input.source.evidenceTier ?? null,
      proposed_event: input.source.proposedEvent
        ? {
            event_id: input.source.proposedEvent.eventId,
            parent_event_kind: input.source.proposedEvent.parentEventKind,
          }
        : { event_id: '', parent_event_kind: '' },
      flag_state: input.source.flagState ?? null,
    };
  }

  private async recordEvaluation(
    input: PreflightH1Input,
    opaInput: Record<string, unknown>,
    decision: PolicyDecision,
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('__seo_policy_evaluations')
        .insert({
          asset_id: targetAssetId(input.target),
          field_path: 'h1',
          policy_name: decision.policyName,
          input_snapshot: opaInput,
          decision: decision.allow ? 'allow' : 'deny',
          reason: decision.allow ? null : decision.reasons.join(' | '),
          policy_bundle_sha: decision.policyBundleSha,
        })
        .select('evaluation_id')
        .single();
      if (error) {
        this.logger.error(
          `[SeoContentWrite] audit-trail INSERT failed (non-blocking): ${error.message}`,
        );
        return null;
      }
      return (data as { evaluation_id: string } | null)?.evaluation_id ?? null;
    } catch (err) {
      this.logger.error(
        `[SeoContentWrite] audit-trail unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Health endpoint helper (PR-C+ /health/seo-policy).
   */
  getEngineMode(): string {
    return this.opa.getMode();
  }
  getEngineBundleSha(): string {
    return this.opa.getBundleSha();
  }
  isEngineReady(): boolean {
    return this.opa.isReady();
  }
}
