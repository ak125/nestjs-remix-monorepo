/**
 * ADR-072 PR 2D-3 — R8 readiness gate status admin endpoint.
 *
 *   GET  /api/admin/seo/r2/r8-gate-status?fresh=true
 *     Returns the canonical readiness signal for PR 2E.
 *
 * Pass criterion : `snapshots >= autoTypes && autoTypes > 0`
 *   - mirrors MEMORY project-r2-v2-canon-sequence-202605
 *   - consumed by the CI workflow `pr-2e-readiness-gate.yml` (machine gate)
 *     and the admin dashboard.
 *
 * The `?fresh=true` query bypasses the 30 s in-process cache and is the
 * recommended path for CI runs.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { R8GateStatus } from '../schemas/r8-gate-status.schema';
import { R2R8GateStatusService } from '../services/r2-r8-gate-status.service';

@Controller('api/admin/seo/r2')
@UseGuards(IsAdminGuard)
export class R2R8GateStatusController {
  constructor(private readonly gateStatus: R2R8GateStatusService) {}

  @Get('r8-gate-status')
  async getGateStatus(@Query('fresh') fresh?: string): Promise<R8GateStatus> {
    const forceFresh = fresh === 'true' || fresh === '1';
    return this.gateStatus.getStatus(forceFresh);
  }
}
