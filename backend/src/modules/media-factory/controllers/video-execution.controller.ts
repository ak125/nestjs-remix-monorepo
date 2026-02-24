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
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { VideoJobService } from '../services/video-job.service';

@Controller('api/admin/video')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class VideoExecutionController {
  constructor(private readonly jobService: VideoJobService) {}

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
    const data = this.jobService.getCanaryStats();
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
}
