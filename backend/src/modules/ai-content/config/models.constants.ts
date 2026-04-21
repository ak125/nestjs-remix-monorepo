/**
 * Central registry for Claude model IDs used by AiContentModule.
 *
 * Single source of truth — do NOT hardcode model strings elsewhere.
 * Override at runtime via ANTHROPIC_MODEL / ANTHROPIC_ADVISOR_MODEL env vars.
 */

export const ClaudeModel = {
  OPUS_4_6: 'claude-opus-4-6',
  SONNET_4_6: 'claude-sonnet-4-6',
  HAIKU_4_5: 'claude-haiku-4-5-20251001',
} as const;

export type ClaudeModelId = (typeof ClaudeModel)[keyof typeof ClaudeModel];

/** Default executor model — used by all generateContent() calls unless overridden. */
export const DEFAULT_EXECUTOR_MODEL: ClaudeModelId = ClaudeModel.SONNET_4_6;

/** Default advisor model — used by the Advisor tool strategy (Phase 1 POC). */
export const DEFAULT_ADVISOR_MODEL: ClaudeModelId = ClaudeModel.OPUS_4_6;

/** Beta header required to enable the Advisor tool on the Messages API. */
export const ADVISOR_BETA_HEADER = 'advisor-tool-2026-03-01';
