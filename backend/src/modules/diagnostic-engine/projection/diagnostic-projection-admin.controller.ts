/**
 * DiagnosticProjectionAdminController — déclenchement one-off de la projection
 * diagnostic (admin uniquement). Le drapeau et READ_ONLY s'appliquent en aval
 * (processor puis writer) : ce endpoint ne contourne aucun des deux.
 */
import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';

@Controller('api/admin/diagnostic-projection')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class DiagnosticProjectionAdminController {
  constructor(
    private readonly scheduler: DiagnosticProjectionSchedulerService,
  ) {}

  @Post('trigger')
  async trigger(): Promise<{ ok: true; jobId: string; message: string }> {
    const jobId = await this.scheduler.triggerNow();
    return {
      ok: true,
      jobId,
      message:
        'Projection diagnostic enqueue (one-off) — résultat dans __diag_projection_runs et les logs DiagnosticProjectionProcessor.',
    };
  }
}
