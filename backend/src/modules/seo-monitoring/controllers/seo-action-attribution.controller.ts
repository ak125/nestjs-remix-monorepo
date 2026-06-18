import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
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
import { SeoActionOutcomeService } from '../services/seo-action-outcome.service';

/**
 * PR-1 — Endpoint admin « seed manuel » de l'attribution SEO (boucle OBSERVE).
 *
 *   POST /api/admin/seo/action/applied      — seed attribution (PR-1)
 *   POST /api/admin/seo/action/materialize  — matérialise les outcomes (PR-2)
 *   GET  /api/admin/seo/action/outcomes     — lecture des outcomes (PR-2)
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
  constructor(
    private readonly attribution: SeoActionAttributionService,
    private readonly outcomes: SeoActionOutcomeService,
  ) {}

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

  /**
   * Matérialise les outcomes (delta baseline vs fenêtre 7/14/28 j). Idempotent.
   * On-demand en V1 (pas de cron — évite un cron silencieux ; à greffer plus tard).
   */
  @Post('materialize')
  async materialize(
    @Query('lookback_days') lookbackDays?: string,
  ): Promise<Record<string, unknown>> {
    return this.outcomes.materialize(parsePositiveInt(lookbackDays, 90));
  }

  /** Lecture des outcomes matérialisés (enveloppe honnête observationnelle). */
  @Get('outcomes')
  async getOutcomes(
    @Query('lookback_days') lookbackDays?: string,
    @Query('limit') limit?: string,
  ): Promise<Record<string, unknown>> {
    return this.outcomes.getOutcomes(
      parsePositiveInt(lookbackDays, 90),
      parsePositiveInt(limit, 100),
    );
  }
}

/** Parse un entier positif de query string, sinon défaut. */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
