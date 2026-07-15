/**
 * SeoProjectionAdminController — surface admin minimale du forward-writer (ADR-059 PR-6c).
 *
 * Un seul endpoint : déclenche un cycle de feed R1 one-off (découverte exports → write-jobs),
 * pour PROUVER la boucle sans attendre le cron (ni dépendre du flag SEO_PROJECTION_R1_FEED_ENABLED,
 * qui ne gouverne que la planification automatique). Admin-only (AuthenticatedGuard + IsAdminGuard).
 * Aucune lecture publique : le read-path reste dark (RPC PR-7).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { SeoProjectionFeederService } from './seo-projection-feeder.service';

/**
 * DTO single-entity ROLE-SCOPED (P2-B). **Aucune collection** : le feeder résout EXACTEMENT 1
 * fichier, cardinalité = 1 (le batch `entities[]` n'apparaîtra qu'en P4 sur une route distincte).
 * `diagnostic` exclu ici (défense en profondeur ; le feeder le refuse aussi via FeatureFlags).
 */
const TriggerEntitySchema = z.object({
  entityType: z.enum(['gamme', 'constructeur', 'vehicle']),
  entityId: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug ^[a-z0-9][a-z0-9-]*$ requis'),
  projectionRole: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'rôle ^[A-Z][A-Z0-9_]*$ requis'),
});

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

  /**
   * Enqueue un write-job **single-entity role-scoped** (P2-B) : projette EXCLUSIVEMENT le rôle demandé
   * d'une entité (une canary R3 n'active jamais R4/R6 de la même gamme). Read-path reste dark (RPC PR-7).
   */
  @Post('feed/trigger-entity')
  async triggerEntity(@Body() body: unknown): Promise<{
    ok: true;
    jobId: string;
    exportPath: string;
    entityId: string;
    role: string;
  }> {
    const parsed = TriggerEntitySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const res = await this.feeder.triggerEntity(parsed.data);
    return { ok: true, ...res };
  }
}
