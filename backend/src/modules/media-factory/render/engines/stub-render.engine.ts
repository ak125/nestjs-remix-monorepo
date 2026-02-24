/**
 * StubRenderEngine — No-op render engine for P3-Lite.
 *
 * Simulates a successful render in ~50ms.
 * Will be replaced by RemotionRenderEngine when real rendering is needed.
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
      status: 'success',
      engineName: this.name,
      engineVersion: this.version,
      durationMs: Date.now() - start,
      outputPath: null,
      metadata: {
        stub: true,
        briefId: request.briefId,
        videoType: request.videoType,
        vertical: request.vertical,
      },
    };
  }
}
