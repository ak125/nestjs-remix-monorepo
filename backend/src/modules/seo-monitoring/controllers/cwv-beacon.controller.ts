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
 *   - Validation safeParse → 202 silencieux si malformé (ne pas casser le client)
 *   - Throttler @nestjs/throttler 120/min/IP (= ~5 metrics × 24 pages-views/min absolute max)
 */
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CwvBeaconClientPayloadSchema,
  classifyUserAgent,
  priorityTierFromSurface,
  type Surface,
} from '@repo/cwv-taxonomy';
import { CwvBeaconService } from '../services/cwv-beacon.service';

@Controller('api/seo/cwv')
export class CwvBeaconController {
  private readonly logger = new Logger(CwvBeaconController.name);

  constructor(private readonly cwvBeacon: CwvBeaconService) {}

  @Post('beacon')
  @HttpCode(202)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async beacon(
    @Body() body: unknown,
    @Headers('user-agent') ua: string | undefined,
  ): Promise<{ ok: boolean }> {
    const parsed = CwvBeaconClientPayloadSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.debug(
        `cwv beacon rejected (schema): ${parsed.error.message}`,
      );
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
