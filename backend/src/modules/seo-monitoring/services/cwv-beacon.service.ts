/**
 * CWV Beacon Service — Bloc 3 / CWV Runtime Observability.
 *
 * Persiste un beacon CWV émis depuis le frontend (`navigator.sendBeacon`).
 *
 * Discipline :
 *   - Bots (`ua_class != 'human'`) : écrits dans __seo_event_log (debug only),
 *     JAMAIS dans __seo_cwv_raw — anti-pollution p75 humains (canon plan §5).
 *   - Humans : INSERT direct dans __seo_cwv_raw (partitioned daily, TTL 48h).
 *   - Erreurs INSERT : log + retour `ok: false`, JAMAIS d'exception (un beacon
 *     raté ne doit pas casser une requête user).
 *   - Pattern mirror de FunnelEventsService (extends SupabaseBaseService).
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import type { CwvBeaconServerInsert } from '@repo/cwv-taxonomy';
import { isBot } from '@repo/cwv-taxonomy';

@Injectable()
export class CwvBeaconService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Persiste un beacon CWV. Fire-and-forget côté appelant.
   *
   * Routing déterministe par ua_class :
   *   - human       → __seo_cwv_raw (aggregation pure, p75 humains)
   *   - bot_search/ai/other → __seo_event_log (debug only, séparation canon)
   */
  async record(input: CwvBeaconServerInsert): Promise<{ ok: boolean }> {
    if (isBot(input.ua_class)) {
      return this.recordBot(input);
    }
    return this.recordHuman(input);
  }

  private async recordHuman(input: CwvBeaconServerInsert): Promise<{ ok: boolean }> {
    const { error } = await this.supabase.from('__seo_cwv_raw').insert({
      session_id: input.session_id,
      surface: input.surface,
      route_group: input.route_group,
      priority_tier: input.priority_tier,
      funnel_step: input.funnel_step,
      previous_funnel_step: input.previous_funnel_step,
      url: input.url,
      metric: input.metric,
      value: input.value,
      device: input.device,
      ua_class: input.ua_class,
      attribution: input.attribution ?? null,
      nav_type: input.nav_type,
    });
    if (error) {
      this.logger.error(
        `cwv beacon insert failed (${input.metric}/${input.route_group}): ${error.message}`,
      );
      return { ok: false };
    }
    return { ok: true };
  }

  private async recordBot(input: CwvBeaconServerInsert): Promise<{ ok: boolean }> {
    // Bots : event_log avec payload pour debug, jamais agrégé.
    const { error } = await this.supabase.from('__seo_event_log').insert({
      event_type: 'seo.runtime.bot_cwv_beacon',
      entity_url: input.url,
      severity: 'info',
      payload: {
        ua_class: input.ua_class,
        metric: input.metric,
        value: input.value,
        surface: input.surface,
        route_group: input.route_group,
        priority_tier: input.priority_tier,
        device: input.device,
      },
    });
    if (error) {
      this.logger.error(
        `cwv beacon (bot) event_log insert failed (${input.metric}): ${error.message}`,
      );
      return { ok: false };
    }
    return { ok: true };
  }
}
