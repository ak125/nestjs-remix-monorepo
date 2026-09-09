/**
 * Runtime Events Controller — Bloc 5 / CWV Runtime Observability.
 *
 * Endpoint PUBLIC :
 *   POST /api/seo/runtime-event — capture hydration / longtask / nav-abort /
 *   chunk-load-error depuis frontend via `navigator.sendBeacon`.
 *
 * Pattern mirror `CwvBeaconController` (public, @HttpCode(202)).
 *
 * Anti-flood : politique standard par handler (15/s · 100/min · 2000/h par IP)
 * — cf. src/config/throttler-tiers.config.ts. Les runtime events sont
 * supposés rares ; sample throttling frontend max 5/session/event_type.
 */
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import {
  classifyUserAgent,
  priorityTierFromSurface,
  type Surface,
} from '@repo/cwv-taxonomy';
import { RuntimeEventsService } from '../services/runtime-events.service';
import { RuntimeEventInputSchema } from '../services/runtime-events.schema';

@Controller('api/seo')
export class RuntimeEventsController {
  private readonly logger = new Logger(RuntimeEventsController.name);

  constructor(private readonly runtimeEvents: RuntimeEventsService) {}

  @Post('runtime-event')
  @HttpCode(202)
  // Pas d'override de tier ici : la politique standard s'applique
  // (15/s · 100/min · 2000/h par IP, bucket propre à ce handler —
  // src/config/throttler-tiers.config.ts). Un `@Throttle({ default: … })`
  // a vécu ici sans jamais s'appliquer : aucun tier ne s'appelle `default`,
  // et le guard lit l'override sous le NOM du tier configuré
  // (throttler.guard.js:77). Prouvé le 2026-09-09 : 20 POST en rafale →
  // 15× 202 puis 5× 429, soit le tier `short`, pas la limite annoncée.
  async event(
    @Body() body: unknown,
    @Headers('user-agent') ua: string | undefined,
  ): Promise<{ ok: boolean }> {
    // Pré-fill : priority_tier (dérivé) + ua_class (header) avant Zod parse
    // pour éviter au client d'envoyer ces 2 champs (anti-spoofing).
    const enriched =
      typeof body === 'object' && body !== null
        ? {
            ...body,
            priority_tier:
              (body as { surface?: unknown }).surface !== undefined
                ? priorityTierFromSurface(
                    (body as { surface: string }).surface as Surface,
                  )
                : undefined,
            ua_class: classifyUserAgent(ua ?? null),
          }
        : body;

    const parsed = RuntimeEventInputSchema.safeParse(enriched);
    if (!parsed.success) {
      this.logger.debug(
        `runtime event rejected (schema): ${parsed.error.message}`,
      );
      return { ok: false };
    }

    return this.runtimeEvents.record(parsed.data);
  }
}
