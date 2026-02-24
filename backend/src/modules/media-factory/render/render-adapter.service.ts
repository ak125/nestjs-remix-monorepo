/**
 * RenderAdapterService — Facade for the pluggable render engine (P3-Lite).
 *
 * Selects the engine based on VIDEO_RENDER_ENGINE env var.
 * For P3-Lite: always stub. Later: switch on engineName.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IRenderEngine } from './engines/render-engine.interface';
import { StubRenderEngine } from './engines/stub-render.engine';
import type { RenderRequest, RenderResult } from './types/render.types';

@Injectable()
export class RenderAdapterService {
  private readonly logger = new Logger(RenderAdapterService.name);
  private readonly engine: IRenderEngine;

  constructor() {
    const engineName = process.env.VIDEO_RENDER_ENGINE || 'stub';

    // P3-Lite: always stub. P4+ will add real engines here.
    this.engine = new StubRenderEngine();

    if (engineName !== 'stub') {
      this.logger.warn(
        `[RAS] Engine '${engineName}' not implemented, falling back to stub`,
      );
    }

    this.logger.log(
      `[RAS] Initialized with engine=${this.engine.name} v${this.engine.version}`,
    );
  }

  async render(request: RenderRequest): Promise<RenderResult> {
    this.logger.log(
      `[RAS] Rendering brief=${request.briefId} with engine=${this.engine.name}`,
    );
    return this.engine.render(request);
  }

  getEngineInfo(): { name: string; version: string } {
    return { name: this.engine.name, version: this.engine.version };
  }
}
