import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Centralized feature flag access for the RAG content pipeline and brief gates.
 *
 * Flags are read from env vars via ConfigService, with an optional volatile
 * override layer for runtime toggling from the admin dashboard.
 * Overrides are lost on restart (by design — safer for prod).
 */
@Injectable()
export class FeatureFlagsService {
  private readonly overrides = new Map<string, string>();

  constructor(private readonly config: ConfigService) {}

  // ── Content pipeline flags ──

  get evidencePackEnabled(): boolean {
    return this.bool('EVIDENCE_PACK_ENABLED', false);
  }

  get hardGatesEnabled(): boolean {
    return this.bool('HARD_GATES_ENABLED', false);
  }

  get autoRepairEnabled(): boolean {
    return this.bool('AUTO_REPAIR_ENABLED', false);
  }

  get safeFallbackEnabled(): boolean {
    return this.bool('SAFE_FALLBACK_ENABLED', false);
  }

  get canaryGammes(): string[] {
    return this.csv('CANARY_GAMMES');
  }

  get autoRepairMaxPasses(): number {
    return Math.min(this.int('AUTO_REPAIR_MAX_PASSES', 2), 3);
  }

  get canaryAutoPublish(): boolean {
    return this.bool('CANARY_AUTO_PUBLISH', false);
  }

  get draftAutoPublishEnabled(): boolean {
    return this.bool('DRAFT_AUTO_PUBLISH_ENABLED', false);
  }

  get draftAutoPublishIntervalMs(): number {
    return this.int('DRAFT_AUTO_PUBLISH_INTERVAL_MS', 300_000);
  }

  get pipelineConcurrency(): number {
    return this.int('PIPELINE_CONCURRENCY', 1);
  }

  // ── Brief gates flags ──

  get briefGatesEnabled(): boolean {
    return this.bool('BRIEF_GATES_ENABLED', false);
  }

  get briefGatesObserveOnly(): boolean {
    return this.bool('BRIEF_GATES_OBSERVE_ONLY', false);
  }

  get briefAwareEnabled(): boolean {
    return this.bool('BRIEF_AWARE_ENABLED', false);
  }

  // ── Phase 2 Orchestration flags ──

  get executionRegistryEnabled(): boolean {
    return this.bool('EXECUTION_REGISTRY_ENABLED', false);
  }

  get evidenceGradingEnabled(): boolean {
    return this.bool('EVIDENCE_GRADING_ENABLED', false);
  }

  get versionComparisonEnabled(): boolean {
    return this.bool('VERSION_COMPARISON_ENABLED', false);
  }

  get qaDecisionEnabled(): boolean {
    return this.bool('QA_DECISION_ENABLED', false);
  }

  get bestVersionProtectionEnabled(): boolean {
    return this.bool('BEST_VERSION_PROTECTION_ENABLED', false);
  }

  // ── R1 Content Pipeline flag ──

  /**
   * Controls whether the R1 4-prompt pipeline can be TRIGGERED (write path).
   * Does NOT gate the read path: once data is in sgpg_* columns, it's served
   * regardless of this flag. Default: false (safe for cold starts without .env).
   * Coverage: 33/213 gammes (G1 = P1 + P1-PENDING) as of 2026-03-04.
   */
  get r1ContentPipelineEnabled(): boolean {
    return this.bool('R1_CONTENT_PIPELINE_ENABLED', false);
  }

  get keywordDensityGateEnabled(): boolean {
    return this.bool('KEYWORD_DENSITY_GATE_ENABLED', false);
  }

  // ── R8 Owned Editorial (Fix B — owned DB editorial × per-type facts) ──

  /**
   * Controls whether the R8 vehicle enricher composes its editorial sections
   * (S_SELECTION_GUIDE / S_ENTRETIEN_CONTEXT / S_FAQ_DEDICATED) from OWNED DB
   * editorial (`__seo_gamme_purchase_guide` + `__seo_gamme_conseil`, quality-gated)
   * blended with per-motorisation facts, instead of the template / RAG-FAQ path.
   *
   * This gates the WRITE path (the enricher run), not the served read path:
   * once blocks are persisted to `__seo_r8_pages`, they're served regardless.
   * Default: false (safe for cold starts without .env). When a gamme has no
   * publishable owned editorial, the enricher falls back to the existing path
   * and logs `R8_OWNED_EDITORIAL_FALLBACK` (never silent — CLAUDE.md no-silent-fallback).
   */
  get r8OwnedEditorialEnabled(): boolean {
    return this.bool('R8_OWNED_EDITORIAL_ENABLED', false);
  }

  // ── R6 Consolidation (guide d'achat → R3 conseils, décision owner 2026-06-10) ──

  /**
   * Gates the R6→R3 consolidation redirect path: when ON, R6 guide-achat
   * detail pages 301-redirect to the gamme's R3 conseils page — ONLY for
   * gammes whose R3 article exists (self-gated per gamme: no live R3 → no
   * redirect, the standalone R6 page keeps serving — never a redirect-to-404).
   * Mirrors the R5→R3 consolidation (diagnostic-auto sub-pages → conseils).
   *
   * Activation is owner-gated: requires the vault ADR amending role-matrix v5
   * (R6 standalone page → R3 section) + smoke-test anchor swap (airlock) +
   * sitemap exclusion of folded gammes. Default: false (inert — zero change).
   */
  get seoR6ConsolidationEnabled(): boolean {
    return this.bool('SEO_R6_CONSOLIDATION_ENABLED', false);
  }

  // ── Conseil Pack flags ──

  get conseilPackEnabled(): boolean {
    return this.bool('CONSEIL_PACK_ENABLED', false);
  }

  get conseilProPackEnabled(): boolean {
    return this.bool('CONSEIL_PRO_PACK_ENABLED', false);
  }

  get conseilEeatEnabled(): boolean {
    return this.bool('CONSEIL_EEAT_ENABLED', false);
  }

  get conseilBatchSize(): number {
    return this.int('CONSEIL_BATCH_SIZE', 10);
  }

  // ── RAG catch-up flag ──

  get ragCatchupEnabled(): boolean {
    return this.bool('RAG_CATCHUP_ENABLED', false);
  }

  // ── RAG Virtual Merge (Bridge — DB docs into .md at read-time) ──

  get ragVirtualMergeEnabled(): boolean {
    return this.bool('RAG_VIRTUAL_MERGE_ENABLED', false);
  }

  // ── RAG Merge scope flags (consumed by PipelineChainProcessor) ──

  /** Dry run mode for merge operations (preview without DB writes) */
  get ragMergeDryRun(): boolean {
    return this.bool('RAG_MERGE_DRY_RUN', true);
  }

  /** CSV of allowed roles for RAG merge (empty = all IMPROVABLE_ROLES) */
  get ragMergeAllowedRoles(): string[] {
    return this.csv('RAG_MERGE_ALLOWED_ROLES');
  }

  /** CSV of allowed gamme aliases for RAG merge (empty = all gammes) */
  get ragMergeAllowedGammes(): string[] {
    return this.csv('RAG_MERGE_ALLOWED_GAMMES');
  }

  // ── Agentic Engine flags ──

  get agenticEngineEnabled(): boolean {
    return this.bool('AGENTIC_ENGINE_ENABLED', false);
  }

  get agenticApplyEnabled(): boolean {
    return this.bool('AGENTIC_APPLY_ENABLED', false);
  }

  get agenticMaxBranches(): number {
    return Math.min(this.int('AGENTIC_MAX_BRANCHES', 3), 5);
  }

  get agenticMaxCriticLoops(): number {
    return Math.min(this.int('AGENTIC_MAX_CRITIC_LOOPS', 2), 3);
  }

  get agenticAirlockCheckEnabled(): boolean {
    return this.bool('AGENTIC_AIRLOCK_CHECK_ENABLED', false);
  }

  get agenticDailyTokenBudget(): number {
    return this.int('AGENTIC_DAILY_TOKEN_BUDGET', 100_000);
  }

  get agenticAirlockEnabled(): boolean {
    return this.bool('AGENTIC_AIRLOCK_CHECK_ENABLED', false);
  }

  // ── Abandoned Cart Email flags ──

  get abandonedCartEmailEnabled(): boolean {
    return this.bool('ABANDONED_CART_EMAIL_ENABLED', false);
  }

  // ── SEO Business Control Dashboard flag (PR-SBD-1 Task 7) ──

  /**
   * Controls visibility of /admin/seo-control dashboard route + endpoint.
   * Default: false (Phase A rollout — only admin Fafa overrides ON).
   * Kill-switch silencieux : OFF → endpoint returns 404 (not 503) to hide
   * the surface entirely from non-admins.
   */
  get seoControlDashboardEnabled(): boolean {
    return this.bool('SEO_CONTROL_DASHBOARD_ENABLED', false);
  }

  // ── R2 Accessories block (accessory products under main gamme, PR-2) ──

  /**
   * Master switch for the R2 "Accessoires" block — surfaces an accessory gamme's
   * PRODUCTS (linked via pieces_gamme.pg_parent_gamme_id) on the main gamme's R2
   * product page, in the current vehicle context. Default: false (rollout safe).
   * OFF = the AccessoryProductsService short-circuits to an empty result (no query,
   * no surface). The accessory gamme stays hidden; no URL/sitemap/indexation change.
   */
  get accessoryBlocksOnR2Enabled(): boolean {
    return this.bool('SHOW_ACCESSORY_BLOCKS_ON_R2', false);
  }

  // ── VehicleContext cookie kill-switch (PR-B.6) ──

  /**
   * Master switch for the VehicleContext JWS cookie middleware (PR-B).
   * Default `true` — the cookie path is on by default.
   * Set `VEHICLE_CTX_ENABLED=false` to make the middleware a no-op
   * pass-through. Cookies already stored in browsers are not cleared —
   * they're simply ignored. Used for emergency rollback or A/B holdback.
   */
  get vehicleContextEnabled(): boolean {
    return this.bool('VEHICLE_CTX_ENABLED', true);
  }

  // ── Diagnostic KG shadow flags (PR-E) ──

  /**
   * Master switch for the KG shadow comparison (PR-E). Default `true` —
   * the shadow path runs fire-and-forget alongside the canonical engines.
   * Set `DIAGNOSTIC_KG_SHADOW_ENABLED=false` for emergency rollback.
   * Disabled = no RPC call, no event emission, no metric.
   */
  get diagnosticKgShadowEnabled(): boolean {
    return this.bool('DIAGNOSTIC_KG_SHADOW_ENABLED', true);
  }

  /**
   * Whether the KG result is the canonical (primary) source of truth.
   * Default `false` per canon `project_diagnostic_control_plane_v1_plan.md` :
   * the KG only graduates to primary after V1.5 evidence gates pass
   * (≥ 1000 golden cohort sessions with < 5 % divergence). Flipping early
   * = production decision-bypassing-V1-evidence regression.
   */
  get diagnosticKgPrimaryEnabled(): boolean {
    return this.bool('DIAGNOSTIC_KG_PRIMARY_ENABLED', false);
  }

  // ── Write Guard flags (P1.5) ──

  get writeGuardEnabled(): boolean {
    return this.bool('WRITE_GUARD_ENABLED', true);
  }

  get writeGuardMode(): 'observe' | 'enforce' {
    return (
      (this.resolve('WRITE_GUARD_MODE') as 'observe' | 'enforce') || 'enforce'
    );
  }

  get writeGuardCanaryRoles(): string[] {
    return this.csv('WRITE_GUARD_CANARY_ROLES');
  }

  get writeGuardCanaryGroups(): string[] {
    return this.csv('WRITE_GUARD_CANARY_GROUPS');
  }

  // ── Helpers ──

  /**
   * Returns true if the given gamme slug is in the CANARY_GAMMES list,
   * or if CANARY_GAMMES contains '*' (all gammes are canary).
   */
  isCanary(gammeSlug: string): boolean {
    const list = this.canaryGammes;
    return list.includes(gammeSlug) || list.includes('*');
  }

  // ── Runtime override API (volatile — lost on restart) ──

  private static readonly ALLOWED_KEYS = new Set([
    'EVIDENCE_PACK_ENABLED',
    'HARD_GATES_ENABLED',
    'AUTO_REPAIR_ENABLED',
    'SAFE_FALLBACK_ENABLED',
    'CANARY_GAMMES',
    'R1_CONTENT_PIPELINE_ENABLED',
    'R8_OWNED_EDITORIAL_ENABLED',
    'BRIEF_GATES_ENABLED',
    'BRIEF_GATES_OBSERVE_ONLY',
    'RAG_CATCHUP_ENABLED',
    'RAG_MERGE_DRY_RUN',
    'RAG_MERGE_ALLOWED_ROLES',
    'RAG_MERGE_ALLOWED_GAMMES',
    'CONSEIL_PACK_ENABLED',
    'KEYWORD_DENSITY_GATE_ENABLED',
    'CANARY_AUTO_PUBLISH',
    'DRAFT_AUTO_PUBLISH_ENABLED',
    'DRAFT_AUTO_PUBLISH_INTERVAL_MS',
    'AGENTIC_ENGINE_ENABLED',
    'AGENTIC_APPLY_ENABLED',
    'AGENTIC_MAX_BRANCHES',
    'AGENTIC_MAX_CRITIC_LOOPS',
    'AGENTIC_AIRLOCK_CHECK_ENABLED',
    'AGENTIC_DAILY_TOKEN_BUDGET',
    'EXECUTION_REGISTRY_ENABLED',
    'EVIDENCE_GRADING_ENABLED',
    'VERSION_COMPARISON_ENABLED',
    'QA_DECISION_ENABLED',
    'BEST_VERSION_PROTECTION_ENABLED',
    'ABANDONED_CART_EMAIL_ENABLED',
    'WRITE_GUARD_ENABLED',
    'WRITE_GUARD_MODE',
    'WRITE_GUARD_CANARY_ROLES',
    'WRITE_GUARD_CANARY_GROUPS',
    'RAG_VIRTUAL_MERGE_ENABLED',
    'SEO_CONTROL_DASHBOARD_ENABLED',
    'VEHICLE_CTX_ENABLED',
    'DIAGNOSTIC_KG_SHADOW_ENABLED',
    'DIAGNOSTIC_KG_PRIMARY_ENABLED',
    'SHOW_ACCESSORY_BLOCKS_ON_R2',
  ]);

  listFlags(): Record<
    string,
    { envValue: string | null; override: string | null; effective: string }
  > {
    const result: Record<
      string,
      { envValue: string | null; override: string | null; effective: string }
    > = {};
    for (const key of FeatureFlagsService.ALLOWED_KEYS) {
      const envValue = this.config.get<string>(key) ?? null;
      const override = this.overrides.get(key) ?? null;
      result[key] = {
        envValue,
        override,
        effective: override ?? envValue ?? '',
      };
    }
    return result;
  }

  setOverride(key: string, value: string): void {
    if (!FeatureFlagsService.ALLOWED_KEYS.has(key)) {
      throw new Error(`Unknown flag key: ${key}`);
    }
    this.overrides.set(key, value);
  }

  clearOverride(key: string): void {
    this.overrides.delete(key);
  }

  // ── Private helpers ──

  private resolve(key: string): string | undefined {
    return this.overrides.get(key) ?? this.config.get<string>(key);
  }

  private bool(key: string, defaultValue: boolean): boolean {
    const raw = this.resolve(key);
    if (raw === undefined || raw === null || raw === '') return defaultValue;
    return raw === 'true';
  }

  private csv(key: string): string[] {
    const raw = this.resolve(key) ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private int(key: string, defaultValue: number): number {
    const raw = this.resolve(key);
    if (raw === undefined || raw === null || raw === '') return defaultValue;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}
