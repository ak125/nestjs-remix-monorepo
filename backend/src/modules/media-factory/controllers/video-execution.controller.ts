/**
 * VideoExecutionController — Admin endpoints for video execution pipeline (P2).
 *
 * 3 endpoints: execute, status, retry.
 * Protected by AuthenticatedGuard + IsAdminGuard.
 */

import {
  Controller,
  Post,
  Get,
  Param,
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
