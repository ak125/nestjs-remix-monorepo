/**
 * CWV Beacon Controller — Bloc 3 / CWV Runtime Observability.
 *
 * Endpoint PUBLIC :
 *   POST /api/seo/cwv/beacon — reçoit 1 metric web-vitals émise via
 *   `navigator.sendBeacon` depuis le frontend.
 *
 * Public à dessein (mesure runtime utilisateur, no PII collected client-side).
 * Validation stricte Zod (`CwvBeaconClientPayloadSchema`). Enrichissement
 * serveur (priority_tier dérivé + ua_class via classifyUserAgent du UA header)
 * puis routing déterministe vers `__seo_cwv_raw` (humans) ou `__seo_event_log`
 * (bots) via `CwvBeaconService`.
 *
 * Pattern mirror de `FunnelEventsController` :
 *   - @HttpCode(202) — beacon = fire-and-forget, jamais 4xx visible côté UA
 *   - Validation safeParse → 202 `{ ok: false }` si malformé (ne pas casser le
 *     client), et rejet COMPTÉ par raison (`CwvBeaconService.countRejection`) :
 *     corps absent, schéma invalide, page hors origine canonique
 *   - Intégrité : seules les pages de `SITE_ORIGIN` alimentent la mesure (`url`
 *     et `attr_start_url`). Le runtime DEV (pages localhost, base partagée) et
 *     le container PREPROD (sondes CI sur localhost) voient leurs beacons
 *     comptés `foreign_host`
 *   - Hors de ce comptage : les refus émis avant le handler (throttler 429,
 *     body-parser 400/413) passent par `GlobalErrorFilter` et `err_status`
 *   - Throttler @nestjs/throttler : politique standard, bucket propre à ce
 *     handler (15/s · 100/min · 2000/h par IP). Le client émet jusqu'à 5
 *     beacons par page vue (un par métrique — web-vitals.client.ts:336-340).
 */
import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { SITE_ORIGIN } from '@config/site.constants';
import {
  CwvBeaconClientPayloadSchema,
  classifyUserAgent,
  priorityTierFromSurface,
  type Surface,
} from '@repo/cwv-taxonomy';
import { CwvBeaconService } from '../services/cwv-beacon.service';

@Controller('api/seo/cwv')
export class CwvBeaconController {
  constructor(private readonly cwvBeacon: CwvBeaconService) {}

  @Post('beacon')
  @HttpCode(202)
  // Pas d'override de tier ici : la politique standard s'applique
  // (15/s · 100/min · 2000/h par IP, bucket propre à ce handler —
  // src/config/throttler-tiers.config.ts). Un `@Throttle({ default: … })`
  // a vécu ici sans jamais s'appliquer : aucun tier ne s'appelle `default`,
  // et le guard lit l'override sous le NOM du tier configuré
  // (throttler.guard.js:77). Prouvé le 2026-09-09 : 20 POST en rafale →
  // 15× 202 puis 5× 429, soit le tier `short`, pas la limite annoncée.
  async beacon(
    @Body() body: unknown,
    @Headers('user-agent') ua: string | undefined,
  ): Promise<{ ok: boolean }> {
    // Content-Type non JSON → body-parser laisse `req.body` indéfini.
    if (body === undefined || body === null) {
      this.cwvBeacon.countRejection('empty_body');
      return { ok: false };
    }

    const parsed = CwvBeaconClientPayloadSchema.safeParse(body);
    if (!parsed.success) {
      this.cwvBeacon.countRejection('schema_invalid', parsed.error.issues);
      return { ok: false };
    }

    // Avant le routage bot : une page hors origine canonique ne nourrit aucune
    // table, bots compris. `url` et `attr_start_url` viennent du même document ;
    // le schéma les a déjà validées comme URL absolues.
    const pageUrls = [parsed.data.url, parsed.data.attribution?.attr_start_url];
    if (
      pageUrls.some((u) => u !== undefined && new URL(u).origin !== SITE_ORIGIN)
    ) {
      this.cwvBeacon.countRejection('foreign_host');
      return { ok: false };
    }

    // Enrichissement serveur (pas envoyé par le client — anti-spoofing) :
    //   - priority_tier dérivé de surface (lookup déterministe)
    //   - ua_class via classifyUserAgent sur header (anti-pollution p75 humains)
    const enriched = {
      ...parsed.data,
      priority_tier: priorityTierFromSurface(parsed.data.surface as Surface),
      ua_class: classifyUserAgent(ua ?? null),
    };

    return this.cwvBeacon.record(enriched);
  }
}
