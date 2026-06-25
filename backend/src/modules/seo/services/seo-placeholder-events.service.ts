/**
 * SEO Placeholder Events Service — A1a-observe (plan R* contenu, Phase 3
 * SEO_RUNTIME_FOUNDATION).
 *
 * Wrapper d'écriture dans `__seo_event_log` existant pour rendre OBSERVABLES
 * deux replis runtime jusqu'ici SILENCIEUX du SEO V4 :
 *   - le strip des marqueurs `#X#` non résolus dans `cleanContent()`
 *     (trigger `residual_marker_detected`) ;
 *   - le fallback `generateDefaultSeo` (trigger `runtime_default_fallback`).
 *
 * Canon `feedback_no_external_canary_when_internal_observability_exists` :
 * étend l'infra `__seo_event_log` (PAS de nouvelle table). Pattern mirror
 * `FunnelEventsService` / `RuntimeEventsService` (extends `SupabaseBaseService`,
 * fire-and-forget, never throws, severity `info`).
 *
 * DÉTECTION SEULEMENT : aucun gate, aucun blocage de promotion ; le strip et le
 * fallback restent strictement inchangés — on ne fait qu'émettre un signal.
 *
 * Refs:
 * - 20260625_seo_event_placeholder_unresolved_enum.sql (ENUM seo_event_type +1)
 * - 20260425_seo_event_log.sql (__seo_event_log)
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

export const PLACEHOLDER_EVENT_TYPE = 'seo_placeholder_unresolved' as const;

export type PlaceholderTrigger =
  | 'residual_marker_detected'
  | 'runtime_default_fallback';

export interface PlaceholderEventInput {
  trigger: PlaceholderTrigger;
  field?: 'title' | 'description';
  /** Total des marqueurs `#X#` détectés (regex large, chiffres inclus). */
  marker_count?: number;
  /** Sous-ensemble réellement retiré par le strip `/#[A-Za-z_]+#/g` (sans chiffres). */
  stripped_count?: number;
  /** Échantillon des marqueurs détectés (borné 10). */
  markers?: string[];
  pg_id?: number;
  type_id?: number;
  fallback_version?: string;
  entity_url?: string;
}

@Injectable()
export class SeoPlaceholderEventsService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Persiste un placeholder event dans `__seo_event_log`. Fire-and-forget côté
   * appelant : on log l'erreur mais on ne lève jamais (un beacon raté ne doit
   * pas casser un rendu SEO). `severity` toujours `info` (signal, pas alerte).
   */
  async record(input: PlaceholderEventInput): Promise<{ ok: boolean }> {
    const { error } = await this.supabase.from('__seo_event_log').insert({
      event_type: PLACEHOLDER_EVENT_TYPE,
      entity_url: input.entity_url ?? null,
      severity: 'info',
      payload: {
        trigger: input.trigger,
        field: input.field ?? null,
        marker_count: input.marker_count ?? null,
        stripped_count: input.stripped_count ?? null,
        markers: input.markers ?? null,
        pg_id: input.pg_id ?? null,
        type_id: input.type_id ?? null,
        fallback_version: input.fallback_version ?? null,
      },
    });
    if (error) {
      this.logger.error(
        `placeholder event insert failed (${PLACEHOLDER_EVENT_TYPE}): ${error.message}`,
      );
      return { ok: false };
    }
    return { ok: true };
  }
}
