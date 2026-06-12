/**
 * Runtime Events Service — Bloc 5 / CWV Runtime Observability.
 *
 * Wrapper d'écriture dans `__seo_event_log` existant pour les 4 event_types
 * runtime ajoutés bloc 5 :
 *   - seo.runtime.hydration_error
 *   - seo.runtime.long_task
 *   - seo.runtime.navigation_abort
 *   - seo.runtime.chunk_load_error
 *
 * Canon `feedback_no_external_canary_when_internal_observability_exists` :
 * étend l'infra `__seo_event_log` existante (pas de nouvelle table).
 *
 * Pattern mirror `FunnelEventsService` (extends `SupabaseBaseService`, fire-
 * and-forget, never throws).
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import type { RuntimeEventInput } from './runtime-events.schema';

@Injectable()
export class RuntimeEventsService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Persiste un runtime event dans __seo_event_log.
   *
   * `severity` :
   *   - 'info' pour `long_task` (signal, pas faute)
   *   - 'medium' pour `navigation_abort`, `chunk_load_error`
   *   - 'high' pour `hydration_error` (impact UX direct)
   */
  async record(input: RuntimeEventInput): Promise<{ ok: boolean }> {
    const severity = this.severityForEvent(input.event_type);

    const { error } = await this.supabase.from('__seo_event_log').insert({
      event_type: input.event_type,
      entity_url: input.url ?? null,
      severity,
      payload: {
        surface: input.surface,
        route_group: input.route_group,
        priority_tier: input.priority_tier,
        device: input.device,
        ua_class: input.ua_class,
        session_id: input.session_id ?? null,
        message: input.message ?? null,
        // Champ générique pour métadonnées spécifiques (longtask duration,
        // chunk asset name, etc.) — borné à 2KB côté Zod.
        meta: input.meta ?? null,
      },
    });

    if (error) {
      this.logger.error(
        `runtime event insert failed (${input.event_type}): ${error.message}`,
      );
      return { ok: false };
    }
    return { ok: true };
  }

  private severityForEvent(
    eventType: RuntimeEventInput['event_type'],
  ): 'info' | 'medium' | 'high' {
    switch (eventType) {
      case 'seo.runtime.long_task':
        return 'info';
      case 'seo.runtime.navigation_abort':
      case 'seo.runtime.chunk_load_error':
        return 'medium';
      case 'seo.runtime.hydration_error':
        return 'high';
      default:
        return 'info';
    }
  }
}
