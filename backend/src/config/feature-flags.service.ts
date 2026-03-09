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

  // ── RAG Safe Distill flag ──

  get ragSafeDistillEnabled(): boolean {
    return this.bool('RAG_SAFE_DISTILL_ENABLED', false);
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

  // ── Pipeline chain flags ──

  get pipelineChainEnabled(): boolean {
    return this.bool('PIPELINE_CHAIN_ENABLED', false);
  }

  get pipelineChainPollIntervalMs(): number {
    return this.int('PIPELINE_CHAIN_POLL_INTERVAL_MS', 60_000);
  }

  // ── RAG catch-up flag ──

  get ragCatchupEnabled(): boolean {
    return this.bool('RAG_CATCHUP_ENABLED', false);
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
    'BRIEF_GATES_ENABLED',
    'BRIEF_GATES_OBSERVE_ONLY',
    'PIPELINE_CHAIN_ENABLED',
    'RAG_CATCHUP_ENABLED',
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
