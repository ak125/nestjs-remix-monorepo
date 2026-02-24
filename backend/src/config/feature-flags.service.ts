import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Centralized feature flag access for the RAG content pipeline and brief gates.
 *
 * All flags are read once from env vars via ConfigService.
 * Getters are cheap (no I/O) — safe to call in hot paths.
 */
@Injectable()
export class FeatureFlagsService {
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

  get keywordDensityGateEnabled(): boolean {
    return this.bool('KEYWORD_DENSITY_GATE_ENABLED', false);
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

  // ── Private helpers ──

  private bool(key: string, defaultValue: boolean): boolean {
    const raw = this.config.get<string>(key);
    if (raw === undefined || raw === null || raw === '') return defaultValue;
    return raw === 'true';
  }

  private csv(key: string): string[] {
    const raw = this.config.get<string>(key) ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private int(key: string, defaultValue: number): number {
    const raw = this.config.get<string>(key);
    if (raw === undefined || raw === null || raw === '') return defaultValue;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}
