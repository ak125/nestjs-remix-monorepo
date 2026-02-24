/**
 * RemotionRenderEngine — Canary scaffold for real video rendering (P5).
 *
 * Implements IRenderEngine via HTTP POST to VIDEO_REMOTION_ENDPOINT.
 * If the endpoint is not configured, throws RenderEngineUnavailableError
 * so the adapter falls back to stub automatically.
 *
 * Rule 3: No output = no success.
 */

import type { IRenderEngine } from './render-engine.interface';
import { RenderErrorCode } from '../types/render.types';
import type { RenderRequest, RenderResult } from '../types/render.types';
import { RenderEngineUnavailableError } from '../types/canary.types';

export class RemotionRenderEngine implements IRenderEngine {
  readonly name = 'remotion';
  readonly version = '0.1.0-canary';

  async render(request: RenderRequest): Promise<RenderResult> {
    const endpoint = process.env.VIDEO_REMOTION_ENDPOINT;
    const start = Date.now();

    if (!endpoint) {
      throw new RenderEngineUnavailableError(this.name);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        briefId: request.briefId,
        executionLogId: request.executionLogId,
        videoType: request.videoType,
        vertical: request.vertical,
        templateId: request.templateId ?? null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown');
      throw new Error(
        `Remotion endpoint returned HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      );
    }

    const body = (await response.json()) as {
      outputPath?: string | null;
      metadata?: Record<string, unknown>;
    };

    const durationMs = Date.now() - start;
    const outputPath = body.outputPath ?? null;

    // Rule 3: No output = no success
    if (!outputPath) {
      return {
        status: 'failed',
        engineName: this.name,
        engineVersion: this.version,
        durationMs,
        outputPath: null,
        metadata: { ...(body.metadata ?? {}), canary: true },
        errorMessage: 'Engine returned no output file',
        errorCode: RenderErrorCode.RENDER_OUTPUT_INVALID,
        retryable: true,
      };
    }

    return {
      status: 'success',
      engineName: this.name,
      engineVersion: this.version,
      durationMs,
      outputPath,
      metadata: { ...(body.metadata ?? {}), canary: true },
      retryable: false,
    };
  }
}
