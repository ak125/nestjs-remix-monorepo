/**
 * ADR-072 PR 2D-3 — R8 seed-run admin controller.
 *
 *   POST /api/admin/seo/r2/r8-seed/run
 *     Accept body: { idempotencyKey, dryRun?, batchSize?, sinceTypeId?, maxBatches? }
 *     202 Accepted → { runId, status, idempotentHit, acceptedAt, dryRun }
 *
 *   GET /api/admin/seo/r2/r8-seed/run/:runId
 *     200 → AdminJobRow
 *     404 → { error: 'run_not_found' }
 *
 * Auth : IsAdminGuard — admin-authenticated only. Actor identity is read from
 * the request (admin email) so every audit row carries a real human.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { Request } from 'express';
import {
  R8SeedRunAcceptResponse,
  R8SeedRunRequest,
  R8SeedRunRequestSchema,
  AdminJobRow,
} from '../schemas/admin-job.schema';
import { R2R8SeedJobOrchestratorService } from '../services/r2-r8-seed-job-orchestrator.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/admin/seo/r2/r8-seed')
@UseGuards(IsAdminGuard)
export class R2R8SeedRunnerController {
  constructor(private readonly orchestrator: R2R8SeedJobOrchestratorService) {}

  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  async run(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<R8SeedRunAcceptResponse> {
    const parsed = R8SeedRunRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const request: R8SeedRunRequest = parsed.data;
    const actor = this.extractActor(req);
    return this.orchestrator.accept(request, actor);
  }

  @Get('run/:runId')
  async getRun(@Param('runId') runId: string): Promise<AdminJobRow> {
    if (!UUID_RE.test(runId)) {
      throw new BadRequestException({
        error: 'invalid_run_id',
        details: 'runId must be a UUID v4',
      });
    }
    const row = await this.orchestrator.getRun(runId);
    if (!row) {
      throw new NotFoundException({ error: 'run_not_found', runId });
    }
    return row;
  }

  private extractActor(req: Request): string {
    // Auth layer populates req.user (passport / session). We require an
    // identifier here — fall back to "admin:unknown" only as a defense
    // against missing wiring, never in normal operation (IsAdminGuard rejects
    // unauthenticated requests upstream).
    const user = req.user;
    if (user) {
      if (user.email && user.email.length > 0) {
        return user.email;
      }
      if (typeof user.id_utilisateur === 'number') {
        return `admin:${user.id_utilisateur}`;
      }
    }
    return 'admin:unknown';
  }
}
