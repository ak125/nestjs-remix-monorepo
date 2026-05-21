/**
 * SitemapEventLogService — Commerce-Loop V1 étape 2.
 *
 * Wrapper d'écriture du heartbeat de régénération sitemap dans la table unifiée
 * `__seo_event_log` (#601). Le `SitemapRegenerateProcessor` émet :
 *   - `sitemap_generation_complete` (severity info) sur succès
 *   - `sitemap_generation_failed`   (severity high)  sur échec
 *
 * L'absence de `sitemap_generation_complete` >26h lève l'alerte `SITEMAP_STALE_V1`
 * (rpc_seo_alerts_v1, migration 20260521_seo_sitemap_freshness_001_alert_rpc.sql).
 *
 * Étend `SupabaseBaseService` (chemin DI canonique, mirror de `FunnelEventsService`) :
 * `this.supabase` service-role + sémaphore + circuit breaker + fallback ADR-028. Pas
 * de `createClient` local (anti-duplication).
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

export interface SitemapHeartbeatPayload {
  totalUrls?: number;
  totalFiles?: number;
  durationMs: number;
  triggeredBy: string;
  errorMessage?: string;
}

@Injectable()
export class SitemapEventLogService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Persiste le heartbeat de régénération. Fire-and-forget côté appelant : on log
   * l'erreur mais on ne lève jamais (un heartbeat raté ne doit pas casser le job).
   */
  async recordHeartbeat(
    success: boolean,
    payload: SitemapHeartbeatPayload,
  ): Promise<{ ok: boolean }> {
    const eventType = success
      ? 'sitemap_generation_complete'
      : 'sitemap_generation_failed';
    const { error } = await this.supabase.from('__seo_event_log').insert({
      event_type: eventType,
      entity_url: null,
      severity: success ? 'info' : 'high',
      payload,
    });
    if (error) {
      this.logger.error(
        `sitemap heartbeat insert failed (${eventType}): ${error.message}`,
      );
      return { ok: false };
    }
    return { ok: true };
  }
}
