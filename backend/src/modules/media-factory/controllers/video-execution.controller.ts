/**
 * VideoExecutionController — Admin endpoints for video execution pipeline (P2).
 *
 * 6 endpoints: canary/policy, stats, execute, list, status, retry.
 * Protected by AuthenticatedGuard + IsAdminGuard.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { VideoJobService } from '../services/video-job.service';
import { PostprocessService } from '../services/postprocess.service';

@Controller('api/admin/video')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class VideoExecutionController {
  private readonly logger = new Logger(VideoExecutionController.name);

  constructor(
    private readonly jobService: VideoJobService,
    private readonly postprocessService: PostprocessService,
  ) {}

  /**
   * POST /api/admin/video/batch-execute
   * P15: Submit batch execution for multiple derivative productions.
   */
  @Post('batch-execute')
  async batchExecute(@Body() body: { briefIds: string[] }) {
    if (!body.briefIds || body.briefIds.length === 0) {
      return {
        success: false,
        error: 'briefIds array is required and must not be empty',
        timestamp: new Date().toISOString(),
      };
    }

    const result = await this.jobService.submitBatchExecution(
      body.briefIds,
      'api',
    );
    return {
      success: true,
      data: result,
      message: `Batch ${result.batchId}: ${result.submitted.length} submitted, ${result.skipped.length} skipped`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /api/admin/video/productions/:briefId/execute
   * Submit a new video execution job.
   */
  @Post('productions/:briefId/execute')
  async executeProduction(@Param('briefId') briefId: string) {
    const result = await this.jobService.submitExecution(briefId, 'api');
    return {
      success: true,
      data: result,
      message: `Execution submitted for ${briefId}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/admin/video/canary/policy
   * P5.4: Current canary configuration and usage.
   */
  @Get('canary/policy')
  async getCanaryPolicy() {
    const data = await this.jobService.getCanaryStats();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * GET /api/admin/video/render-service/health
   * P6.2: Proxy health check to the Remotion render service.
   */
  @Get('render-service/health')
  async getRenderServiceHealth() {
    const baseUrl = process.env.VIDEO_RENDER_BASE_URL;
    if (!baseUrl) {
      return {
        success: true,
        data: { status: 'not_configured' },
        timestamp: new Date().toISOString(),
      };
    }
    try {
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const health = await res.json();
      return {
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        success: true,
        data: { status: 'unreachable' },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /api/admin/video/executions/stats?window=24h|7d|all
   * P6.2: Time-windowed execution statistics dashboard.
   * NOTE: Must be declared BEFORE :executionLogId to avoid ParseIntPipe on "stats".
   */
  @Get('executions/stats')
  async getExecutionStats(@Query('window') window?: string) {
    const validWindows = ['24h', '7d', 'all'];
    const tw = (validWindows.includes(window) ? window : 'all') as
      | '24h'
      | '7d'
      | 'all';
    const data = await this.jobService.getExecutionStats(tw);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * GET /api/admin/video/executions
   * List all executions across all productions (paginated + filters).
   * NOTE: Must be declared BEFORE :executionLogId to avoid ParseIntPipe.
   */
  @Get('executions')
  async listAllExecutions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('briefId') briefId?: string,
    @Query('batchId') batchId?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const filters: { status?: string; briefId?: string; batchId?: string } = {};
    if (status) filters.status = status;
    if (briefId) filters.briefId = briefId;
    if (batchId) filters.batchId = batchId;

    const result = await this.jobService.listAllExecutions(filters, {
      page: parseInt(page || '1', 10),
      limit: Math.min(parseInt(limit || '20', 10), 100),
      sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
    });

    return {
      success: true,
      data: result.data,
      total: result.total,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/admin/video/productions/:briefId/executions
   * List executions for a production.
   */
  @Get('productions/:briefId/executions')
  async listExecutions(@Param('briefId') briefId: string) {
    const data = await this.jobService.listExecutions(briefId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * GET /api/admin/video/executions/:executionLogId
   * Get execution status.
   */
  @Get('executions/:executionLogId')
  async getExecutionStatus(
    @Param('executionLogId', ParseIntPipe) executionLogId: number,
  ) {
    const data = await this.jobService.getExecutionStatus(executionLogId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /api/admin/video/executions/:executionLogId/retry
   * Retry a failed execution.
   */
  @Post('executions/:executionLogId/retry')
  async retryExecution(
    @Param('executionLogId', ParseIntPipe) executionLogId: number,
  ) {
    const result = await this.jobService.retryExecution(executionLogId);
    return {
      success: true,
      data: result,
      message: `Retry submitted for execution #${executionLogId}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/admin/video/executions/:executionLogId/variants
   * List format variants (postprocess outputs) for an execution.
   */
  @Get('executions/:executionLogId/variants')
  async listVariants(
    @Param('executionLogId', ParseIntPipe) executionLogId: number,
  ) {
    const data = await this.postprocessService.listVariants(executionLogId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * GET /api/admin/video/executions/:executionLogId/presigned-url
   * P9: Generate presigned HTTPS URL for the rendered video output.
   * Proxies to the render service /presigned-url endpoint.
   */
  @Get('executions/:executionLogId/presigned-url')
  async getPresignedUrl(
    @Param('executionLogId', ParseIntPipe) executionLogId: number,
  ) {
    const exec = await this.jobService.getExecutionStatus(executionLogId);

    if (!exec.renderOutputPath) {
      return {
        success: false,
        error: 'No render output path for this execution',
        timestamp: new Date().toISOString(),
      };
    }

    // Parse s3://automecanik-renders/renders/<briefId>/<execId>/<ts>.mp4
    const bucketName = process.env.S3_BUCKET_NAME ?? 'automecanik-renders';
    const s3Prefix = `s3://${bucketName}/`;
    const key = exec.renderOutputPath.startsWith(s3Prefix)
      ? exec.renderOutputPath.slice(s3Prefix.length)
      : exec.renderOutputPath.replace(/^s3:\/\/[^/]+\//, '');

    const baseUrl = process.env.VIDEO_RENDER_BASE_URL;
    if (!baseUrl) {
      return {
        success: false,
        error: 'Render service not configured (VIDEO_RENDER_BASE_URL missing)',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const res = await fetch(
        `${baseUrl}/presigned-url?key=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (!res.ok) {
        const body = await res.text();
        return {
          success: false,
          error: `Render service error: ${res.status} ${body}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = (await res.json()) as { url: string; expiresIn: number };
      return {
        success: true,
        data: { url: data.url, expiresIn: data.expiresIn },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: msg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /api/admin/video/executions/:executionLogId/stream
   * P9b: Stream rendered video from MinIO through the backend.
   * Avoids exposing MinIO directly — the browser fetches from backend.
   */
  @Get('executions/:executionLogId/stream')
  async streamVideo(
    @Param('executionLogId', ParseIntPipe) executionLogId: number,
    @Res() res: Response,
  ) {
    const exec = await this.jobService.getExecutionStatus(executionLogId);

    if (!exec.renderOutputPath) {
      res.status(404).json({ error: 'No render output for this execution' });
      return;
    }

    // Parse S3 key from s3://bucket/key path
    const bucketName = process.env.S3_BUCKET_NAME ?? 'automecanik-renders';
    const s3Prefix = `s3://${bucketName}/`;
    const key = exec.renderOutputPath.startsWith(s3Prefix)
      ? exec.renderOutputPath.slice(s3Prefix.length)
      : exec.renderOutputPath.replace(/^s3:\/\/[^/]+\//, '');

    const baseUrl = process.env.VIDEO_RENDER_BASE_URL;
    if (!baseUrl) {
      res.status(503).json({ error: 'Render service not configured' });
      return;
    }

    try {
      // Get presigned URL from renderer (internal, localhost is OK here)
      const presignedRes = await fetch(
        `${baseUrl}/presigned-url?key=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (!presignedRes.ok) {
        res
          .status(502)
          .json({ error: 'Failed to get video URL from renderer' });
        return;
      }

      const { url } = (await presignedRes.json()) as { url: string };

      // Fetch the video from MinIO using the presigned URL (server-side, localhost works)
      const videoRes = await fetch(url, {
        signal: AbortSignal.timeout(60000),
      });

      if (!videoRes.ok || !videoRes.body) {
        res.status(502).json({ error: 'Failed to fetch video from storage' });
        return;
      }

      // Pipe to response
      res.setHeader('Content-Type', 'video/mp4');
      if (videoRes.headers.get('content-length')) {
        res.setHeader(
          'Content-Length',
          videoRes.headers.get('content-length')!,
        );
      }
      res.setHeader(
        'Content-Disposition',
        `inline; filename="render-${executionLogId}.mp4"`,
      );
      res.setHeader('Cache-Control', 'private, max-age=3600');

      // Stream the body using Node.js readable stream
      const reader = videoRes.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        return pump();
      };
      await pump();
    } catch (err) {
      this.logger.error(
        `Stream failed for execution #${executionLogId}: ${err}`,
      );
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream failed' });
      }
    }
  }
}
