/**
 * RenderAdapterService — Canary-aware facade for pluggable render engines (P5).
 *
 * Selects engine based on VIDEO_RENDER_ENGINE env var with canary policy:
 * - Targeted eligibility (videoType + templateId)
 * - Daily quota (Redis-persisted, survives process restarts)
 * - Automatic fallback to stub on any canary failure
 * - Instant rollback: evaluateCanary() re-reads process.env every call
 *
 * Rule 1: Stub stays reference — always available as fallback.
 * Rule 2: Canary = targeted + measured.
 * Rule 3: No output = no success (double-checked at adapter level).
 * Rule 4: Classified errors > raw messages.
 * Rule 5: Rollback by flag < 1min.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IRenderEngine } from './engines/render-engine.interface';
import { StubRenderEngine } from './engines/stub-render.engine';
import { RemotionRenderEngine } from './engines/remotion-render.engine';
import { RenderErrorCode } from './types/render.types';
import type { RenderRequest, RenderResult } from './types/render.types';
import type { CanaryPolicy, CanaryDecision } from './types/canary.types';
import { RENDER_TIMEOUT_MS } from '../../../config/video-quality.constants';
import { CacheService } from '../../../cache/cache.service';

@Injectable()
export class RenderAdapterService {
  private readonly logger = new Logger(RenderAdapterService.name);
  private readonly stubEngine: IRenderEngine;
  private readonly canaryEngine: IRenderEngine | null;
  private readonly canaryPolicy: CanaryPolicy;

  constructor(private readonly cacheService: CacheService) {
    const engineName = process.env.VIDEO_RENDER_ENGINE || 'stub';

    // Rule 1: Stub always instantiated
    this.stubEngine = new StubRenderEngine();

    // Canary engine: only instantiated if a non-stub engine is configured
    if (engineName !== 'stub') {
      this.canaryEngine = new RemotionRenderEngine();
    } else {
      this.canaryEngine = null;
    }

    // Parse canary policy from env
    this.canaryPolicy = {
      eligibleVideoTypes: (process.env.VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      eligibleTemplateIds: (
        process.env.VIDEO_CANARY_ELIGIBLE_TEMPLATE_IDS || ''
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      quotaPerDay: parseInt(process.env.VIDEO_CANARY_QUOTA_PER_DAY || '10', 10),
      engineTimeoutMs: parseInt(
        process.env.VIDEO_REMOTION_TIMEOUT_MS || '120000',
        10,
      ),
    };

    this.logger.log(
      `[RAS] Initialized: primary=${engineName}, ` +
        `canary=${this.canaryEngine ? this.canaryEngine.name : 'none'}, ` +
        `renderEnabled=${process.env.VIDEO_RENDER_ENABLED ?? 'undefined'}, ` +
        `policy=${JSON.stringify(this.canaryPolicy)}`,
    );
  }

  // ── Main render entry point ──

  async render(request: RenderRequest): Promise<RenderResult> {
    const decision = await this.evaluateCanary(request);

    this.logger.log(
      `[RAS] brief=${request.briefId} exec=${request.executionLogId} canary=${decision.useCanary} ` +
        `reason="${decision.reason}" remaining=${decision.remainingQuota}`,
    );

    if (decision.useCanary && this.canaryEngine) {
      return this.renderWithCanary(request, decision);
    }

    return this.renderWithStub(request);
  }

  // ── Canary render path ──

  private async renderWithCanary(
    request: RenderRequest,
    decision: CanaryDecision,
  ): Promise<RenderResult> {
    try {
      await this.incrementDailyCount();

      const result = await this.withTimeout(
        this.canaryEngine!.render(request),
        this.canaryPolicy.engineTimeoutMs,
      );

      // Rule 3: No output = no success (double-check at adapter level)
      if (result.status === 'success' && !result.outputPath) {
        this.logger.warn(
          `[RAS] brief=${request.briefId} exec=${request.executionLogId} Canary returned success but no outputPath — marking failed`,
        );
        return {
          ...result,
          status: 'failed',
          errorCode: RenderErrorCode.RENDER_OUTPUT_INVALID,
          engineResolution: 'requested',
          retryable: true,
          metadata: {
            ...(result.metadata ?? {}),
            canary: true,
            fallback: false,
            canaryDecision: decision,
          },
        };
      }

      return {
        ...result,
        engineResolution: 'requested',
        errorCode:
          result.status === 'failed' && !result.errorCode
            ? RenderErrorCode.RENDER_PROCESS_FAILED
            : result.errorCode,
        retryable: result.retryable ?? result.status === 'failed',
        metadata: {
          ...(result.metadata ?? {}),
          canary: true,
          fallback: false,
          canaryDecision: decision,
        },
      };
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && err.message.includes('RENDER_TIMEOUT');
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown canary error';
      const canaryErrorCode = isTimeout
        ? RenderErrorCode.RENDER_ENGINE_TIMEOUT
        : RenderErrorCode.RENDER_PROCESS_FAILED;

      this.logger.warn(
        `[RAS] brief=${request.briefId} exec=${request.executionLogId} Canary failed: ${errorMessage} — falling back to stub`,
      );

      // Cleanup partial output (no-op in P5.1)
      await this.cleanupPartialOutput(request);

      // Fallback: run stub
      const stubResult = await this.renderWithStub(request);

      return {
        ...stubResult,
        engineResolution: 'fallback_to_stub',
        metadata: {
          ...(stubResult.metadata ?? {}),
          canary: true,
          fallback: true,
          canaryError: errorMessage,
          canaryErrorCode,
          canaryDecision: decision,
        },
      };
    }
  }

  // ── Stub render path ──

  private async renderWithStub(request: RenderRequest): Promise<RenderResult> {
    const currentEngine = process.env.VIDEO_RENDER_ENGINE || 'stub';
    const isCanaryFallback = currentEngine !== 'stub';

    try {
      const result = await this.withTimeout(
        this.stubEngine.render(request),
        RENDER_TIMEOUT_MS,
      );

      return {
        ...result,
        engineResolution: isCanaryFallback ? 'fallback_to_stub' : 'requested',
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
        `[RAS] brief=${request.briefId} exec=${request.executionLogId} Stub render failed: ${errorMessage}`,
      );

      return {
        status: 'failed',
        engineName: this.stubEngine.name,
        engineVersion: this.stubEngine.version,
        durationMs: isTimeout ? RENDER_TIMEOUT_MS : 0,
        outputPath: null,
        metadata: null,
        errorMessage,
        errorCode: isTimeout
          ? RenderErrorCode.RENDER_ENGINE_TIMEOUT
          : RenderErrorCode.RENDER_UNKNOWN_ERROR,
        engineResolution: isCanaryFallback ? 'fallback_to_stub' : 'requested',
        retryable: isTimeout,
      };
    }
  }

  // ── Canary policy evaluation ──

  async evaluateCanary(request: RenderRequest): Promise<CanaryDecision> {
    // Rule 5: Re-read env every call for instant rollback
    const engineName = process.env.VIDEO_RENDER_ENGINE || 'stub';

    // P6: Circuit breaker — render disabled → immediate stub
    if (process.env.VIDEO_RENDER_ENABLED !== 'true') {
      return {
        useCanary: false,
        reason: 'VIDEO_RENDER_ENABLED!=true',
        dailyUsageCount: 0,
        remainingQuota: 0,
      };
    }

    // P6-F: Canary freeze switch — independent of render enabled
    if (process.env.VIDEO_CANARY_ENABLED !== 'true') {
      return {
        useCanary: false,
        reason: 'VIDEO_CANARY_ENABLED!=true',
        dailyUsageCount: 0,
        remainingQuota: 0,
      };
    }

    if (engineName === 'stub' || !this.canaryEngine) {
      return {
        useCanary: false,
        reason: 'engine=stub',
        dailyUsageCount: 0,
        remainingQuota: 0,
      };
    }

    // P12a: Single Redis read for all quota checks
    const dailyCount = await this.getDailyCount();
    const remaining = Math.max(0, this.canaryPolicy.quotaPerDay - dailyCount);

    // Check videoType eligibility (empty list = none eligible)
    if (this.canaryPolicy.eligibleVideoTypes.length === 0) {
      return {
        useCanary: false,
        reason: 'no eligible videoTypes configured',
        dailyUsageCount: dailyCount,
        remainingQuota: remaining,
      };
    }

    if (!this.canaryPolicy.eligibleVideoTypes.includes(request.videoType)) {
      return {
        useCanary: false,
        reason: `videoType=${request.videoType} not eligible`,
        dailyUsageCount: dailyCount,
        remainingQuota: remaining,
      };
    }

    // Check templateId eligibility (empty list = all templates OK)
    if (
      this.canaryPolicy.eligibleTemplateIds.length > 0 &&
      request.templateId &&
      !this.canaryPolicy.eligibleTemplateIds.includes(request.templateId)
    ) {
      return {
        useCanary: false,
        reason: `templateId=${request.templateId} not eligible`,
        dailyUsageCount: dailyCount,
        remainingQuota: remaining,
      };
    }

    // Check daily quota
    if (remaining <= 0) {
      return {
        useCanary: false,
        reason: `daily quota exhausted (${this.canaryPolicy.quotaPerDay}/${this.canaryPolicy.quotaPerDay})`,
        dailyUsageCount: dailyCount,
        remainingQuota: 0,
      };
    }

    return {
      useCanary: true,
      reason: 'eligible + quota available',
      dailyUsageCount: dailyCount,
      remainingQuota: remaining,
    };
  }

  // ── Public accessors ──

  getEngineInfo(): { name: string; version: string } {
    const engine = this.canaryEngine ?? this.stubEngine;
    return { name: engine.name, version: engine.version };
  }

  async getCanaryStats(): Promise<{
    engineName: string;
    canaryAvailable: boolean;
    renderEnabled: boolean;
    dailyUsageCount: number;
    remainingQuota: number;
    quotaPerDay: number;
    eligibleVideoTypes: string[];
  }> {
    const dailyCount = await this.getDailyCount();
    return {
      engineName: process.env.VIDEO_RENDER_ENGINE || 'stub',
      canaryAvailable: !!this.canaryEngine,
      renderEnabled: process.env.VIDEO_RENDER_ENABLED === 'true',
      dailyUsageCount: dailyCount,
      remainingQuota: Math.max(0, this.canaryPolicy.quotaPerDay - dailyCount),
      quotaPerDay: this.canaryPolicy.quotaPerDay,
      eligibleVideoTypes: this.canaryPolicy.eligibleVideoTypes,
    };
  }

  // ── P12a: Redis-backed daily counter helpers ──

  private getCanaryKey(): string {
    return `video:canary:count:${new Date().toISOString().slice(0, 10)}`;
  }

  private async getDailyCount(): Promise<number> {
    return (await this.cacheService.get<number>(this.getCanaryKey())) ?? 0;
  }

  private async incrementDailyCount(): Promise<void> {
    const key = this.getCanaryKey();
    const current = (await this.cacheService.get<number>(key)) ?? 0;
    await this.cacheService.set(key, current + 1, 90000); // TTL 25h
  }

  // ── P12c: Cleanup orphan tmp files on renderer ──

  private async cleanupPartialOutput(_request: RenderRequest): Promise<void> {
    const baseUrl = process.env.VIDEO_RENDER_BASE_URL;
    if (!baseUrl) return;
    try {
      await fetch(`${baseUrl}/render/cleanup`, { method: 'DELETE' });
    } catch (err) {
      this.logger.warn(
        `cleanupPartialOutput HTTP call failed: ${(err as Error).message}`,
      );
    }
  }

  // ── Timeout helper ──

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
