/**
 * DiagnosticProjectionAdminController — déclenchement one-off de la projection
 * diagnostic (admin uniquement). Drapeau OFF ou READ_ONLY → 409 explicite, rien
 * n'est enqueué (jamais un « ok » pour un job qui ne s'exécutera pas). Le
 * processor (drapeau) et le writer (READ_ONLY) restent autoritaires à
 * l'exécution : le drapeau peut basculer entre l'enqueue et le run.
 */
import { ConflictException, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { getAppConfig } from '../../../config/app.config';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';

@Controller('api/admin/diagnostic-projection')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class DiagnosticProjectionAdminController {
  constructor(
    private readonly scheduler: DiagnosticProjectionSchedulerService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Post('trigger')
  async trigger(): Promise<{ ok: true; jobId: string; message: string }> {
    if (!this.featureFlags.diagnosticProjectionEnabled) {
      throw new ConflictException({
        ok: false,
        reason: 'FLAG_OFF',
        message:
          'DIAGNOSTIC_PROJECTION_ENABLED!=true — projection non enqueue.',
      });
    }
    // Même source que `SupabaseBaseService.isReadOnlyMode` (guardReadOnly du writer).
    if (getAppConfig().supabase.readOnly) {
      throw new ConflictException({
        ok: false,
        reason: 'READ_ONLY',
        message: 'READ_ONLY=true — projection non enqueue (ADR-028 Option D).',
      });
    }
    const jobId = await this.scheduler.triggerNow();
    return {
      ok: true,
      jobId,
      message:
        'Projection diagnostic enqueue (one-off) — résultat dans __diag_projection_runs et les logs DiagnosticProjectionProcessor.',
    };
  }
}
