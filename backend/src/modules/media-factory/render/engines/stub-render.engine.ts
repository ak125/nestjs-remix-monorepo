/**
 * StubRenderEngine — No-op render engine for P3-Lite.
 *
 * Exercises the pipeline in ~50ms without producing a deliverable.
 */

import type { IRenderEngine } from './render-engine.interface';
import type { RenderRequest, RenderResult } from '../types/render.types';

export class StubRenderEngine implements IRenderEngine {
  readonly name = 'stub';
  readonly version = '1.0.0';

  async render(request: RenderRequest): Promise<RenderResult> {
    const start = Date.now();

    // Simulate minimal processing delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      status: 'skipped',
      engineName: this.name,
      engineVersion: this.version,
      durationMs: Date.now() - start,
      outputPath: null,
      metadata: {
        stub: true,
        executionMode: 'simulated',
        briefId: request.briefId,
        videoType: request.videoType,
        vertical: request.vertical,
      },
      // P4.0: engine resolution + retryable (overridden by adapter)
      engineResolution: 'requested' as const,
      retryable: false,
    };
  }
}
