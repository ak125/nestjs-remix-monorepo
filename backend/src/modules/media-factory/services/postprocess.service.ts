/**
 * PostprocessService — Calls renderer /postprocess after render success.
 *
 * Auto-triggered from the video execution processor when render completes.
 * Stores variant metadata in __video_variants table.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface PostprocessInput {
  briefId: string;
  executionLogId: number;
  renderOutputPath: string;
  audioS3Key?: string;
  videoType: string;
}

export interface VariantRecord {
  name: string;
  s3Path: string;
  codec: string;
  resolution: string;
  fileSizeBytes: number;
  durationSecs: number | null;
}

export interface PostprocessResult {
  variants: VariantRecord[];
  srtS3Path: string | null;
  totalDurationMs: number;
}

// Default variants per video type
const DEFAULT_VARIANTS: Record<
  string,
  Array<{ name: string; width: number; height: number; codec: 'h264' }>
> = {
  short: [
    { name: '1080p_vertical', width: 1080, height: 1920, codec: 'h264' },
    { name: '720p_vertical', width: 720, height: 1280, codec: 'h264' },
  ],
  film_gamme: [
    { name: '1080p_h264', width: 1920, height: 1080, codec: 'h264' },
    { name: '720p_h264', width: 1280, height: 720, codec: 'h264' },
    { name: 'vertical_h264', width: 1080, height: 1920, codec: 'h264' },
  ],
  film_socle: [
    { name: '1080p_h264', width: 1920, height: 1080, codec: 'h264' },
    { name: '720p_h264', width: 1280, height: 720, codec: 'h264' },
    { name: 'vertical_h264', width: 1080, height: 1920, codec: 'h264' },
  ],
};

@Injectable()
export class PostprocessService extends SupabaseBaseService {
  protected override readonly logger = new Logger(PostprocessService.name);

  private readonly rendererUrl: string;
  private readonly enabled: boolean;
  private readonly loudnessTarget: number;

  constructor(configService: ConfigService) {
    super(configService);

    this.rendererUrl =
      configService.get<string>('VIDEO_RENDERER_URL') ??
      'http://localhost:3100';
    this.enabled = configService.get<string>('POSTPROCESS_ENABLED') !== 'false';
    this.loudnessTarget = parseInt(
      configService.get<string>('POSTPROCESS_LOUDNESS_TARGET') ?? '-14',
      10,
    );
  }

  /**
   * Run post-processing on a completed render.
   * Auto-triggered from the video execution processor.
   */
  async postprocess(
    input: PostprocessInput,
  ): Promise<PostprocessResult | null> {
    if (!this.enabled) {
      this.logger.log('[PP] Postprocess disabled — skipping');
      return null;
    }

    const variants =
      DEFAULT_VARIANTS[input.videoType] ?? DEFAULT_VARIANTS['short'];

    this.logger.log(
      `[PP] Starting postprocess for ${input.briefId} (exec=${input.executionLogId}), ${variants.length} variants`,
    );

    const body = {
      briefId: input.briefId,
      executionLogId: input.executionLogId,
      inputS3Key: input.renderOutputPath,
      audioS3Key: input.audioS3Key ?? null,
      variants,
      normalizeLoudness: true,
      loudnessTarget: this.loudnessTarget,
    };

    const response = await fetch(`${this.rendererUrl}/postprocess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `[PP] Renderer /postprocess failed: ${response.status} ${text}`,
      );
      return null;
    }

    const result = (await response.json()) as {
      status: string;
      variants: VariantRecord[];
      srtS3Path: string | null;
      totalDurationMs: number;
    };

    if (result.status !== 'success') {
      this.logger.error(`[PP] Postprocess returned non-success status`);
      return null;
    }

    // Store variants in DB
    await this.storeVariants(
      input.briefId,
      input.executionLogId,
      result.variants,
    );

    // Update execution log with postprocess metadata
    await this.updateExecutionLog(
      input.executionLogId,
      result.variants,
      result.totalDurationMs,
      result.srtS3Path,
    );

    this.logger.log(
      `[PP] Postprocess complete for ${input.briefId}: ${result.variants.length} variants in ${result.totalDurationMs}ms`,
    );

    return {
      variants: result.variants,
      srtS3Path: result.srtS3Path,
      totalDurationMs: result.totalDurationMs,
    };
  }

  private async storeVariants(
    briefId: string,
    executionLogId: number,
    variants: VariantRecord[],
  ): Promise<void> {
    for (const v of variants) {
      const { error } = await this.client.from('__video_variants').upsert(
        {
          execution_log_id: executionLogId,
          brief_id: briefId,
          variant_name: v.name,
          s3_path: v.s3Path,
          codec: v.codec,
          resolution: v.resolution,
          file_size_bytes: v.fileSizeBytes,
          duration_secs: v.durationSecs,
        },
        { onConflict: 'execution_log_id,variant_name' },
      );

      if (error) {
        this.logger.error(
          `[PP] storeVariant error (${v.name}): ${error.message}`,
        );
      }
    }
  }

  private async updateExecutionLog(
    executionLogId: number,
    variants: VariantRecord[],
    totalDurationMs: number,
    srtS3Path: string | null,
  ): Promise<void> {
    const { error } = await this.client
      .from('__video_execution_log')
      .update({
        postprocess_variants: variants,
        postprocess_duration_ms: totalDurationMs,
        srt_s3_path: srtS3Path,
      })
      .eq('id', executionLogId);

    if (error) {
      this.logger.error(`[PP] updateExecutionLog error: ${error.message}`);
    }
  }

  /**
   * List variants for an execution.
   */
  async listVariants(executionLogId: number): Promise<VariantRecord[]> {
    const { data, error } = await this.client
      .from('__video_variants')
      .select('*')
      .eq('execution_log_id', executionLogId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`listVariants error: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => ({
      name: row.variant_name as string,
      s3Path: row.s3_path as string,
      codec: row.codec as string,
      resolution: row.resolution as string,
      fileSizeBytes: row.file_size_bytes as number,
      durationSecs: row.duration_secs as number | null,
    }));
  }
}
