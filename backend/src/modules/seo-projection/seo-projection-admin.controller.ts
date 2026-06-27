/**
 * SeoProjectionAdminController — surface admin minimale du forward-writer (ADR-059 PR-6c).
 *
 * Un seul endpoint : déclenche un cycle de feed R1 one-off (découverte exports → write-jobs),
 * pour PROUVER la boucle sans attendre le cron (ni dépendre du flag SEO_PROJECTION_R1_FEED_ENABLED,
 * qui ne gouverne que la planification automatique). Admin-only (AuthenticatedGuard + IsAdminGuard).
 * Aucune lecture publique : le read-path reste dark (RPC PR-7).
 */
import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { SeoProjectionFeederService } from './seo-projection-feeder.service';

@Controller('api/admin/seo-projection')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class SeoProjectionAdminController {
  constructor(private readonly feeder: SeoProjectionFeederService) {}

  /** Enqueue un feed R1 one-off (READ_ONLY + dossier-absent gérés en aval, observable). */
  @Post('feed/trigger')
  async triggerFeed(): Promise<{ ok: true; jobId: string; message: string }> {
    const jobId = await this.feeder.triggerNow();
    return {
      ok: true,
      jobId,
      message:
        'Feed R1 enqueue (one-off) — voir logs SeoProjectionFeedProcessor pour le résultat.',
    };
  }
}
