/**
 * Internal pipeline endpoint for automated enrichment (cron, scripts, Claude agents).
 * Protected by X-Internal-Key header instead of session auth.
 * NOT exposed through Caddy in prod (localhost only).
 *
 * POST /api/internal/pipeline/execute  — execute enrichment for any role
 * GET  /api/internal/pipeline/roles    — list available roles + status
 */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import {
  ExecutionRouterService,
  type ExecutionResult,
} from '../services/execution-router.service';

const ExecuteRequestSchema = z.object({
  roleId: z.string().min(1, 'roleId is required'),
  targetIds: z.array(z.string().min(1)).min(1).max(50),
  dryRun: z.boolean().optional().default(true),
  vehicleKey: z.string().optional(),
});

@Controller('api/internal/pipeline')
@UseGuards(InternalApiKeyGuard)
export class InternalPipelineController {
  private readonly logger = new Logger(InternalPipelineController.name);

  constructor(private readonly router: ExecutionRouterService) {}

  @Post('execute')
  async execute(
    @Body() body: unknown,
  ): Promise<{ success: boolean; data: ExecutionResult }> {
    const parsed = ExecuteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { roleId, targetIds, dryRun, vehicleKey } = parsed.data;

    this.logger.log(
      `[Internal] Pipeline execute: roleId=${roleId} targets=${targetIds.length} dryRun=${dryRun}`,
    );

    const result = await this.router.execute({
      roleId,
      targetIds,
      dryRun,
      vehicleKey,
    });

    this.logger.log(
      `[Internal] Pipeline done: duration=${result.duration}ms success=${result.results.filter((r) => r.status === 'success').length}/${result.totalTargets}`,
    );

    return { success: true, data: result };
  }

  @Get('roles')
  async listRoles() {
    return { success: true, data: this.router.listRoles() };
  }
}
