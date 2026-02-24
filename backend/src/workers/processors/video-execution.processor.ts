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
import type { RenderRequest } from '../../modules/media-factory/render/types/render.types';
import { VIDEO_FLAG_PENALTIES } from '../../config/video-quality.constants';
import type { VideoQualityFlag } from '../../config/video-quality.constants';
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
    concurrency: 1,
  })
  async handleVideoExecution(
    job: Job<VideoExecutionJobData>,
  ): Promise<VideoExecutionResult> {
    const { executionLogId, briefId } = job.data;
    const startTime = Date.now();

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

      // ── Step 5b: Render via adapter ──
      const renderRequest: RenderRequest = {
        briefId,
        executionLogId,
        videoType: production.videoType,
        vertical: production.vertical,
        templateId: production.templateId ?? undefined,
        gateResults: gateOutput.gates,
        qualityScore: 0, // pre-score, computed next
        canPublish: gateOutput.canPublish,
        governanceSnapshot: {
          pipelineEnabled: process.env.VIDEO_PIPELINE_ENABLED === 'true',
          gatesBlocking: process.env.VIDEO_GATES_BLOCKING === 'true',
          renderEngine: process.env.VIDEO_RENDER_ENGINE || 'stub',
        },
      };
      const renderResult = await this.renderAdapter.render(renderRequest);

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

      // ── Step 8: Update execution log ──
      const durationMs = Date.now() - startTime;
      await this.updateExecutionLog(executionLogId, {
        status: 'completed',
        artefact_check: artefactCheck,
        gate_results: gateOutput.gates,
        can_publish: canPublish,
        quality_score: qualityScore,
        quality_flags: qualityFlags,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        feature_flags: this.captureFeatureFlags(),
        engine_name: renderResult.engineName,
        engine_version: renderResult.engineVersion,
        render_status: renderResult.status,
        render_output_path: renderResult.outputPath,
        render_metadata: renderResult.metadata,
        render_duration_ms: renderResult.durationMs,
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

      await this.updateExecutionLog(executionLogId, {
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        feature_flags: this.captureFeatureFlags(),
      }).catch((logErr) =>
        this.logger.error(`[VEP] Failed to update log: ${logErr}`),
      );

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
    }
  }

  private captureFeatureFlags(): Record<string, boolean> {
    return {
      pipeline_enabled: process.env.VIDEO_PIPELINE_ENABLED === 'true',
      gates_blocking: process.env.VIDEO_GATES_BLOCKING === 'true',
    };
  }
}
