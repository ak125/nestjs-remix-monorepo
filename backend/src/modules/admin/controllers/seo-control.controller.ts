/**
 * PR-SBD-1 Task 4 — SeoControlController
 *
 * Endpoint : GET /api/admin/seo-control/snapshot?range=7d|28d
 *
 * Pattern aligned with admin-feature-flags.controller.ts :
 *   - @UseGuards(AuthenticatedGuard, IsAdminGuard) — admin-only
 *   - @UseInterceptors(AdminResponseInterceptor) — consistent admin response shape
 *   - FeatureFlagsService.seoControlDashboardEnabled kill-switch (404 if off)
 *   - Zod parse range → BadRequestException (400) on invalid
 *
 * Refs :
 *   - .claude/plans/verifier-existant-avant-et-ethereal-firefly.md Task 4 Step 3
 *   - packages/seo-types/src/control-dashboard.ts (RangeSchema)
 */
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { ZodError } from 'zod';
import { RangeSchema } from '@repo/seo-types';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { SeoControlService } from '../services/seo-control.service';

@Controller('api/admin/seo-control')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class SeoControlController {
  private readonly logger = new Logger(SeoControlController.name);

  constructor(
    private readonly seoControlService: SeoControlService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Get('snapshot')
  async snapshot(@Query('range') rangeRaw: string | undefined, @Req() req: any) {
    // Kill-switch silencieux : flag OFF → 404 (hide surface to non-admins).
    if (!this.featureFlags.seoControlDashboardEnabled) {
      throw new NotFoundException();
    }

    // Zod parse range (Range = '7d' | '28d') → 400 on invalid, not 500.
    let range: '7d' | '28d';
    try {
      range = RangeSchema.parse(rangeRaw ?? '7d');
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(
          `Invalid range parameter (expected '7d' or '28d', got: ${rangeRaw})`,
        );
      }
      throw err;
    }

    const adminUserId = (req.user?.id ?? null) as string | null;
    return this.seoControlService.getSnapshot(range, adminUserId);
  }
}
