import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z, ZodError } from 'zod';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { User } from '../../../common/decorators/user.decorator';
import {
  SeoActionAttributionService,
  SeoActionAppliedInputSchema,
  type SeoActionAppliedResult,
} from '../services/seo-action-attribution.service';

/**
 * PR-1 — Endpoint admin « seed manuel » de l'attribution SEO (boucle OBSERVE).
 *
 *   POST /api/admin/seo/action/applied
 *
 * Déclaration owner-asserted : « action X appliquée à la page P à T0 ». Garde-fous :
 *  - admin-only (`AuthenticatedGuard` + `IsAdminGuard`) — jamais public ;
 *  - corps validé Zod strict (namespace `seo_action_applied` uniquement) → 400 si invalide ;
 *  - respecte READ_ONLY via le service (`{recorded:false, reason:'read_only'}`) ;
 *  - aucune mutation runtime/contenu/URL — écrit seulement une ligne d'audit (observe pur).
 */
@Controller('api/admin/seo/action')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class SeoActionAttributionController {
  constructor(private readonly attribution: SeoActionAttributionService) {}

  @Post('applied')
  async recordApplied(
    @Body() body: unknown,
    @User('email') actorEmail?: string,
  ): Promise<SeoActionAppliedResult> {
    let parsed: z.infer<typeof SeoActionAppliedInputSchema>;
    try {
      parsed = SeoActionAppliedInputSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(
          `Requête invalide : ${e.issues.map((i) => i.message).join(', ')}`,
        );
      }
      throw e;
    }
    return this.attribution.recordActionApplied(parsed, actorEmail ?? 'admin');
  }
}
