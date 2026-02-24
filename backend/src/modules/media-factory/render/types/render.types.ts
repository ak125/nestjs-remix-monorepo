/**
 * Render Adapter types for the Video Pipeline (P3-Lite).
 *
 * Defines the contract between the processor and any render engine.
 */

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
}
