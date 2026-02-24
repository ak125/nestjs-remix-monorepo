/**
 * Render Adapter types for the Video Pipeline (P3-Lite + P4.0).
 *
 * Defines the contract between the processor and any render engine.
 */

// ─────────────────────────────────────────────────────────────
// Render error codes (P4.0 — typed error classification)
// ─────────────────────────────────────────────────────────────

export enum RenderErrorCode {
  RENDER_ENGINE_NOT_SUPPORTED = 'RENDER_ENGINE_NOT_SUPPORTED',
  RENDER_ENGINE_TIMEOUT = 'RENDER_ENGINE_TIMEOUT',
  RENDER_ARTEFACTS_INCOMPLETE = 'RENDER_ARTEFACTS_INCOMPLETE',
  RENDER_GATES_FAILED = 'RENDER_GATES_FAILED',
  RENDER_PROCESS_FAILED = 'RENDER_PROCESS_FAILED',
  RENDER_OUTPUT_INVALID = 'RENDER_OUTPUT_INVALID',
  RENDER_UNKNOWN_ERROR = 'RENDER_UNKNOWN_ERROR',
}

// ─────────────────────────────────────────────────────────────
// Render request (processor → engine)
// ─────────────────────────────────────────────────────────────

export interface RenderRequest {
  briefId: string;
  executionLogId: number;
  videoType: string;
  vertical: string;
  templateId?: string;
  gateResults: unknown;
  qualityScore: number;
  canPublish: boolean | null;
  governanceSnapshot: {
    pipelineEnabled: boolean;
    gatesBlocking: boolean;
    renderEngine: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Render result (engine → processor)
// ─────────────────────────────────────────────────────────────

export interface RenderResult {
  status: 'success' | 'failed' | 'skipped' | 'not_implemented';
  engineName: string;
  engineVersion: string;
  durationMs: number;
  outputPath: string | null;
  metadata: Record<string, unknown> | null;
  errorMessage?: string;
  // ── P4.0 additions (all optional, backwards compatible) ──
  errorCode?: RenderErrorCode;
  engineResolution?: 'requested' | 'fallback_to_stub';
  retryable?: boolean;
}
