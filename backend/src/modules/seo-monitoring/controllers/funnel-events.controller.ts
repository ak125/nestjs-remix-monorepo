/**
 * Funnel Events Controller — Commerce-Loop V1 étape 4-A.
 *
 * Endpoint PUBLIC posté par le beacon frontend (`navigator.sendBeacon`) :
 *   POST /api/seo/funnel/event   — enregistre 1 event funnel (diag_* | r2_*)
 *
 * Public à dessein (mesure de parcours utilisateur, pas de donnée sensible).
 * Validation stricte Zod (FunnelEventInputSchema). L'écriture passe par
 * `FunnelEventsService` (extends SupabaseBaseService → service-role + RLS ADR-028).
 */
import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { FunnelEventInputSchema } from '@repo/seo-types';
import { FunnelEventsService } from '../services/funnel-events.service';

@Controller('api/seo/funnel')
export class FunnelEventsController {
  private readonly logger = new Logger(FunnelEventsController.name);

  constructor(private readonly funnelEvents: FunnelEventsService) {}

  @Post('event')
  @HttpCode(202)
  async event(@Body() body: unknown): Promise<{ ok: boolean }> {
    const parsed = FunnelEventInputSchema.safeParse(body);
    if (!parsed.success) {
      // Beacon malformé : ignoré silencieusement (202) pour ne pas polluer les
      // logs ni casser le client. On trace en debug uniquement.
      this.logger.debug(`funnel event rejected (schema): ${parsed.error.message}`);
      return { ok: false };
    }
    return this.funnelEvents.record(parsed.data);
  }
}
