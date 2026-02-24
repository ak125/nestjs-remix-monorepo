/**
 * RenderAdapterService — Facade for the pluggable render engine (P3-Lite + P4.0).
 *
 * Selects the engine based on VIDEO_RENDER_ENGINE env var.
 * P4.0: adds timeout, typed error codes, and engine resolution tracking.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IRenderEngine } from './engines/render-engine.interface';
import { StubRenderEngine } from './engines/stub-render.engine';
import { RenderErrorCode } from './types/render.types';
import type { RenderRequest, RenderResult } from './types/render.types';
import { RENDER_TIMEOUT_MS } from '../../../config/video-quality.constants';

@Injectable()
export class RenderAdapterService {
  private readonly logger = new Logger(RenderAdapterService.name);
  private readonly engine: IRenderEngine;
  private readonly engineResolution: 'requested' | 'fallback_to_stub';

  constructor() {
    const engineName = process.env.VIDEO_RENDER_ENGINE || 'stub';

    // P3-Lite: always stub. P4+ will add real engines here.
    this.engine = new StubRenderEngine();

    if (engineName !== 'stub') {
      this.logger.warn(
        `[RAS] Engine '${engineName}' not implemented, falling back to stub`,
      );
      this.engineResolution = 'fallback_to_stub';
    } else {
      this.engineResolution = 'requested';
    }

    this.logger.log(
      `[RAS] Initialized with engine=${this.engine.name} v${this.engine.version} (resolution=${this.engineResolution})`,
    );
  }

  async render(request: RenderRequest): Promise<RenderResult> {
    this.logger.log(
      `[RAS] Rendering brief=${request.briefId} with engine=${this.engine.name} (resolution=${this.engineResolution})`,
    );

    try {
      const result = await this.withTimeout(
        this.engine.render(request),
        RENDER_TIMEOUT_MS,
      );

      return {
        ...result,
        engineResolution: this.engineResolution,
        errorCode:
          result.status === 'failed' && !result.errorCode
            ? RenderErrorCode.RENDER_PROCESS_FAILED
            : result.errorCode,
        retryable: result.retryable ?? result.status === 'failed',
      };
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && err.message.includes('RENDER_TIMEOUT');
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown render error';

      this.logger.error(
        `[RAS] Render failed for brief=${request.briefId}: ${errorMessage}`,
      );

      return {
        status: 'failed',
        engineName: this.engine.name,
        engineVersion: this.engine.version,
        durationMs: isTimeout ? RENDER_TIMEOUT_MS : 0,
        outputPath: null,
        metadata: null,
        errorMessage,
        errorCode: isTimeout
          ? RenderErrorCode.RENDER_ENGINE_TIMEOUT
          : RenderErrorCode.RENDER_UNKNOWN_ERROR,
        engineResolution: this.engineResolution,
        retryable: isTimeout,
      };
    }
  }

  getEngineInfo(): { name: string; version: string } {
    return { name: this.engine.name, version: this.engine.version };
  }

  // ── Helpers ──

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(`RENDER_TIMEOUT: engine did not respond within ${ms}ms`),
          ),
        ms,
      );
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
