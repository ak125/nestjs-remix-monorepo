/**
 * VideoExecutionProcessor — BullMQ worker stub for video governance pipeline (P2).
 *
 * Validates artefacts, runs 7 gates (G1-G7), logs results.
 * NO real rendering (Remotion/FFmpeg) — stub only.
 *
 * Pattern: content-refresh.processor.ts
 * @see backend/src/workers/processors/content-refresh.processor.ts
 */

import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { VideoGatesService } from '../../modules/media-factory/services/video-gates.service';
import type { VideoGateInput } from '../../modules/media-factory/services/video-gates.service';
import { VideoDataService } from '../../modules/media-factory/services/video-data.service';
import { RenderAdapterService } from '../../modules/media-factory/render/render-adapter.service';
import { RenderErrorCode } from '../../modules/media-factory/render/types/render.types';
import type { RenderRequest } from '../../modules/media-factory/render/types/render.types';
import { VIDEO_FLAG_PENALTIES } from '../../config/video-quality.constants';
import type {
  VideoQualityFlag,
  VideoType,
} from '../../config/video-quality.constants';
import {
  resolveTemplate,
  defaultTemplateForVideoType,
} from '../../modules/media-factory/render/templates/template-registry';
import type {
  VideoExecutionJobData,
  VideoExecutionResult,
} from '../types/video-execution.types';

@Processor('video-render')
export class VideoExecutionProcessor extends SupabaseBaseService {
  protected override readonly logger = new Logger(VideoExecutionProcessor.name);

  constructor(
    configService: ConfigService,
    private readonly gatesService: VideoGatesService,
    private readonly dataService: VideoDataService,
    private readonly renderAdapter: RenderAdapterService,
  ) {
    super(configService);
  }

  @Process({
    name: 'video-execute',
    concurrency: parseInt(process.env.VIDEO_PIPELINE_CONCURRENCY || '1', 10),
  })
  async handleVideoExecution(
    job: Job<VideoExecutionJobData>,
  ): Promise<VideoExecutionResult> {
    const { executionLogId, briefId } = job.data;
    const startTime = Date.now();

    // P7a: Idempotency guard — skip if already completed
    const currentLog = await this.client
      .from('__video_execution_log')
      .select('status')
      .eq('id', executionLogId)
      .single();

    if (currentLog.data?.status === 'completed') {
      this.logger.warn(
        `[VEP] exec=${executionLogId} already completed — skipping`,
      );
      return {
        status: 'completed',
        canPublish: null,
        qualityScore: null,
        qualityFlags: [],
        durationMs: 0,
      };
    }

    this.logger.log(
      `[VEP] Starting execution #${executionLogId} for brief=${briefId}`,
    );

    // ── Feature flag guard ──
    if (process.env.VIDEO_PIPELINE_ENABLED !== 'true') {
      this.logger.warn('[VEP] VIDEO_PIPELINE_ENABLED is not true — skipping');
      await this.updateExecutionLog(executionLogId, {
        status: 'completed',
        error_message: 'Pipeline disabled (VIDEO_PIPELINE_ENABLED=false)',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        feature_flags: this.captureFeatureFlags(),
      });
      return {
        status: 'completed',
        canPublish: null,
        qualityScore: null,
        qualityFlags: [],
        errorMessage: 'Pipeline disabled',
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // ── Step 1: Update status → processing ──
      await this.updateExecutionLog(executionLogId, {
        status: 'processing',
        started_at: new Date().toISOString(),
      });

      // ── Step 2: Load production ──
      const production = await this.dataService.getProduction(briefId);

      // ── Step 3: Check artefacts ──
      // checkArtefacts only checks truthiness of each field, cast is safe
      const artefactInput: Partial<VideoGateInput> = {
        brief: production.knowledgeContract
          ? (production.knowledgeContract as unknown as VideoGateInput['brief'])
          : undefined,
        claims: production.claimTable ?? undefined,
        evidencePack: production.evidencePack ?? undefined,
        disclaimerPlan: production.disclaimerPlan ?? undefined,
        approvalRecord: production.approvalRecord ?? undefined,
      };

      const artefactCheck = this.gatesService.checkArtefacts(artefactInput);

      if (!artefactCheck.canProceed) {
        this.logger.warn(
          `[VEP] Artefact check FAILED for ${briefId}: missing ${artefactCheck.missingArtefacts.join(', ')}`,
        );
        await this.updateExecutionLog(executionLogId, {
          status: 'failed',
          artefact_check: artefactCheck,
          can_publish: false,
          error_message: `Missing artefacts: ${artefactCheck.missingArtefacts.join(', ')}`,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          feature_flags: this.captureFeatureFlags(),
        });
        return {
          status: 'failed',
          canPublish: false,
          qualityScore: null,
          qualityFlags: ['MISSING_ARTEFACTS'],
          errorMessage: `Missing: ${artefactCheck.missingArtefacts.join(', ')}`,
          durationMs: Date.now() - startTime,
        };
      }

      // ── Step 4: Build gate input ──
      const gateInput: VideoGateInput = {
        brief: artefactInput.brief as VideoGateInput['brief'],
        claims: production.claimTable ?? [],
        evidencePack: production.evidencePack ?? [],
        disclaimerPlan: production.disclaimerPlan!,
        approvalRecord: production.approvalRecord!,
      };

      // ── Step 5: Run all gates ──
      const gateOutput = this.gatesService.runAllGates(gateInput);

      // ── Step 5b: P8 — Resolve template + build composition props ──
      const effectiveTemplateId =
        production.templateId ??
        defaultTemplateForVideoType(production.videoType as VideoType);
      const templateEntry = resolveTemplate(effectiveTemplateId);

      const compositionProps: Record<string, unknown> = {
        briefId,
        executionLogId,
        videoType: production.videoType,
        vertical: production.vertical,
        gammeAlias: production.gammeAlias ?? null,
        templateId: effectiveTemplateId,
        compositionId: templateEntry.compositionId,
        claims: (production.claimTable ?? [])
          .filter((c) => c.status === 'verified')
          .slice(0, production.videoType === 'short' ? 3 : 6)
          .map((c) => ({
            kind: c.kind,
            value: c.value,
            unit: c.unit,
            rawText: c.rawText,
          })),
        disclaimerText:
          production.disclaimerPlan?.disclaimers?.[0]?.text ?? null,
        brandName: 'AutoMecanik',
        tagline: 'Pièces auto de qualité',
      };

      // ── Step 5c: Render via adapter ──
      const renderRequest: RenderRequest = {
        briefId,
        executionLogId,
        videoType: production.videoType,
        vertical: production.vertical,
        templateId: effectiveTemplateId,
        gateResults: gateOutput.gates,
        qualityScore: 0, // pre-score, computed next
        canPublish: gateOutput.canPublish,
        governanceSnapshot: {
          pipelineEnabled: process.env.VIDEO_PIPELINE_ENABLED === 'true',
          gatesBlocking: process.env.VIDEO_GATES_BLOCKING === 'true',
          renderEngine: process.env.VIDEO_RENDER_ENGINE || 'stub',
        },
        resolvedCompositionId: templateEntry.compositionId,
        compositionProps,
      };
      const renderResult = await this.renderAdapter.render(renderRequest);

      // ── P7d: Handle render failure ──
      if (renderResult.status === 'failed') {
        const isRetryable = renderResult.retryable !== false;
        if (!isRetryable) {
          // Non-retryable: persist failure and return (no bull retry)
          await this.updateExecutionLog(executionLogId, {
            status: 'failed',
            render_status: renderResult.status,
            render_output_path: renderResult.outputPath,
            render_metadata: renderResult.metadata,
            render_duration_ms: renderResult.durationMs,
            render_error_code: renderResult.errorCode ?? null,
            engine_name: renderResult.engineName,
            engine_version: renderResult.engineVersion,
            engine_resolution: renderResult.engineResolution ?? null,
            retryable: false,
            is_canary: renderResult.metadata?.canary === true,
            canary_fallback: renderResult.metadata?.fallback === true,
            canary_error_message:
              (renderResult.metadata?.canaryError as string) ?? null,
            canary_error_code:
              (renderResult.metadata?.canaryErrorCode as string) ?? null,
            error_message:
              renderResult.errorMessage ??
              `Non-retryable: ${renderResult.errorCode}`,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            feature_flags: this.captureFeatureFlags(),
          });
          this.logger.warn(
            `[VEP] exec=${executionLogId} non-retryable render failure: ${renderResult.errorCode}`,
          );
          return {
            status: 'failed',
            canPublish: null,
            qualityScore: null,
            qualityFlags: ['NON_RETRYABLE_RENDER_FAILURE'],
            errorMessage: `Non-retryable: ${renderResult.errorCode}`,
            durationMs: Date.now() - startTime,
          };
        }
        // Retryable: persist partial state, then throw for bull retry
        await this.updateExecutionLog(executionLogId, {
          render_status: renderResult.status,
          render_error_code: renderResult.errorCode ?? null,
          engine_name: renderResult.engineName,
          engine_version: renderResult.engineVersion,
          retryable: true,
          is_canary: renderResult.metadata?.canary === true,
          canary_fallback: renderResult.metadata?.fallback === true,
        });
        throw new Error(
          `Retryable render failure: ${renderResult.errorCode ?? 'UNKNOWN'}`,
        );
      }

      // ── Step 6: Compute quality score ──
      const qualityFlags = gateOutput.flags;
      let qualityScore = 100;
      for (const flag of qualityFlags) {
        const penalty = VIDEO_FLAG_PENALTIES[flag as VideoQualityFlag];
        if (penalty) qualityScore -= penalty;
      }
      qualityScore = Math.max(0, qualityScore);

      // ── Step 7: Observe-only mode ──
      const gatesBlocking = process.env.VIDEO_GATES_BLOCKING === 'true';
      const canPublish = gatesBlocking ? gateOutput.canPublish : null;

      if (!gatesBlocking && !gateOutput.canPublish) {
        this.logger.warn(
          `[VEP] Gates would BLOCK ${briefId} but VIDEO_GATES_BLOCKING=false (observe-only)`,
        );
      }

      // ── Step 8: P7c — 2-phase finalization ──
      const durationMs = Date.now() - startTime;

      // Phase 1: Persist render result + metadata (idempotent on retry)
      await this.updateExecutionLog(executionLogId, {
        artefact_check: artefactCheck,
        gate_results: gateOutput.gates,
        engine_name: renderResult.engineName,
        engine_version: renderResult.engineVersion,
        render_status: renderResult.status,
        render_output_path: renderResult.outputPath,
        render_metadata: renderResult.metadata,
        render_duration_ms: renderResult.durationMs,
        render_error_code: renderResult.errorCode ?? null,
        engine_resolution: renderResult.engineResolution ?? null,
        retryable: renderResult.retryable ?? false,
        is_canary: renderResult.metadata?.canary === true,
        canary_fallback: renderResult.metadata?.fallback === true,
        canary_error_message:
          (renderResult.metadata?.canaryError as string) ?? null,
        canary_error_code:
          (renderResult.metadata?.canaryErrorCode as string) ?? null,
        feature_flags: this.captureFeatureFlags(),
      });

      // Phase 2: Mark completed (only if Phase 1 succeeded)
      await this.updateExecutionLog(executionLogId, {
        status: 'completed',
        can_publish: canPublish,
        quality_score: qualityScore,
        quality_flags: qualityFlags,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      });

      // ── Step 9: Write-back to production ──
      await this.dataService.updateProduction(briefId, {
        gateResults: gateOutput.gates,
        qualityScore,
        qualityFlags,
      });

      this.logger.log(
        `[VEP] Execution #${executionLogId} completed: canPublish=${canPublish}, score=${qualityScore}, duration=${durationMs}ms`,
      );

      return {
        status: 'completed',
        canPublish,
        qualityScore,
        qualityFlags,
        durationMs,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `[VEP] Execution #${executionLogId} FAILED: ${errorMessage}`,
      );

      // P7c: Try to persist error state; if DB fails too, throw for bull retry
      try {
        await this.updateExecutionLog(executionLogId, {
          status: 'failed',
          error_message: errorMessage,
          render_error_code: RenderErrorCode.RENDER_UNKNOWN_ERROR,
          engine_resolution: null,
          retryable: false,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          feature_flags: this.captureFeatureFlags(),
        });
      } catch (dbErr) {
        this.logger.error(
          `[VEP] DB update also failed for exec #${executionLogId}: ${dbErr}`,
        );
        throw dbErr; // P7c: Let bull retry — DB state is inconsistent
      }

      return {
        status: 'failed',
        canPublish: null,
        qualityScore: null,
        qualityFlags: [],
        errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ── Helpers ──

  private async updateExecutionLog(
    id: number,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.client
      .from('__video_execution_log')
      .update(updates)
      .eq('id', id);

    if (error) {
      this.logger.error(
        `[VEP] updateExecutionLog(${id}) error: ${error.message}`,
      );
      // P7c: Re-throw so callers can handle DB failures
      throw new Error(`DB update failed for execution ${id}: ${error.message}`);
    }
  }

  private captureFeatureFlags(): Record<string, unknown> {
    const canaryStats = this.renderAdapter.getCanaryStats();
    return {
      pipeline_enabled: process.env.VIDEO_PIPELINE_ENABLED === 'true',
      gates_blocking: process.env.VIDEO_GATES_BLOCKING === 'true',
      // P5: canary observability
      render_engine: process.env.VIDEO_RENDER_ENGINE || 'stub',
      canary_available: canaryStats.canaryAvailable,
      canary_daily_usage: canaryStats.dailyUsageCount,
      canary_remaining_quota: canaryStats.remainingQuota,
    };
  }
}
