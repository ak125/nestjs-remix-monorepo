/**
 * RemotionRenderEngine — Real video rendering via HTTP to render service (P6).
 *
 * Implements IRenderEngine via HTTP POST to VIDEO_RENDER_BASE_URL/render.
 * Fallback: VIDEO_REMOTION_ENDPOINT (P5 compat).
 *
 * Circuit breaker: VIDEO_RENDER_ENABLED=false → throws immediately.
 * Rule 3: No output = no success.
 */

import type { IRenderEngine } from './render-engine.interface';
import { RenderErrorCode } from '../types/render.types';
import type { RenderRequest, RenderResult } from '../types/render.types';
import { RenderEngineUnavailableError } from '../types/canary.types';

export class RemotionRenderEngine implements IRenderEngine {
  readonly name = 'remotion';
  readonly version = '1.0.0';

  async render(request: RenderRequest): Promise<RenderResult> {
    const start = Date.now();

    // P6: Circuit breaker — instant kill switch
    if (process.env.VIDEO_RENDER_ENABLED !== 'true') {
      throw new RenderEngineUnavailableError(this.name);
    }

    // P6: Use VIDEO_RENDER_BASE_URL (fallback: VIDEO_REMOTION_ENDPOINT for P5 compat)
    const baseUrl =
      process.env.VIDEO_RENDER_BASE_URL || process.env.VIDEO_REMOTION_ENDPOINT;

    if (!baseUrl) {
      throw new RenderEngineUnavailableError(this.name);
    }

    const renderUrl = baseUrl.endsWith('/render')
      ? baseUrl
      : `${baseUrl}/render`;

    // P6: Timeout via AbortController
    const timeoutMs = parseInt(
      process.env.VIDEO_REMOTION_TIMEOUT_MS || '120000',
      10,
    );
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(renderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          schemaVersion: '1.0.0',
          briefId: request.briefId,
          executionLogId: request.executionLogId,
          videoType: request.videoType,
          vertical: request.vertical,
          templateId: request.templateId ?? null,
          composition: 'TestCard',
        }),
      });

      clearTimeout(timeoutId);

      // Parse response (works for both 200 and 4xx/5xx with JSON body)
      const body = (await response.json()) as {
        schemaVersion?: string;
        status?: string;
        outputPath?: string | null;
        durationMs?: number;
        metadata?: Record<string, unknown> | null;
        errorMessage?: string | null;
        errorCode?: string | null;
      };

      const durationMs = Date.now() - start;
      const outputPath = body.outputPath ?? null;
      const renderServiceDurationMs = body.durationMs ?? 0;

      // Map service error codes to backend error codes
      const serviceErrorCode = body.errorCode;
      let backendErrorCode: RenderErrorCode | undefined;
      if (serviceErrorCode) {
        const errorMap: Record<string, RenderErrorCode> = {
          INVALID_REQUEST: RenderErrorCode.RENDER_PROCESS_FAILED,
          COMPOSITION_NOT_FOUND: RenderErrorCode.RENDER_PROCESS_FAILED,
          RENDER_PROCESS_FAILED: RenderErrorCode.RENDER_PROCESS_FAILED,
          RENDER_TIMEOUT: RenderErrorCode.RENDER_ENGINE_TIMEOUT,
          S3_UPLOAD_FAILED: RenderErrorCode.RENDER_PROCESS_FAILED,
          OUTPUT_EMPTY: RenderErrorCode.RENDER_OUTPUT_INVALID,
        };
        backendErrorCode =
          errorMap[serviceErrorCode] ?? RenderErrorCode.RENDER_UNKNOWN_ERROR;
      }

      // Rule 3: No output = no success
      if (body.status === 'success' && !outputPath) {
        return {
          status: 'failed',
          engineName: this.name,
          engineVersion: this.version,
          durationMs,
          outputPath: null,
          metadata: {
            ...(body.metadata ?? {}),
            canary: true,
            renderServiceDurationMs,
          },
          errorMessage: 'Engine returned success but no output file',
          errorCode: RenderErrorCode.RENDER_OUTPUT_INVALID,
          retryable: true,
        };
      }

      if (body.status === 'failed') {
        return {
          status: 'failed',
          engineName: this.name,
          engineVersion: this.version,
          durationMs,
          outputPath: null,
          metadata: {
            ...(body.metadata ?? {}),
            canary: true,
            renderServiceDurationMs,
            serviceErrorCode,
          },
          errorMessage: body.errorMessage ?? 'Render service returned failed',
          errorCode: backendErrorCode ?? RenderErrorCode.RENDER_PROCESS_FAILED,
          retryable:
            serviceErrorCode !== 'INVALID_REQUEST' &&
            serviceErrorCode !== 'COMPOSITION_NOT_FOUND',
        };
      }

      return {
        status: 'success',
        engineName: this.name,
        engineVersion: this.version,
        durationMs,
        outputPath,
        metadata: {
          ...(body.metadata ?? {}),
          canary: true,
          renderServiceDurationMs,
          schemaVersion: body.schemaVersion,
        },
        retryable: false,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      const error = err as Error;
      const isAbort = error.name === 'AbortError';

      throw isAbort
        ? new Error(
            `RENDER_TIMEOUT: engine did not respond within ${timeoutMs}ms`,
          )
        : error;
    }
  }
}
