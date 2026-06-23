/**
 * Funnel Events Service — Commerce-Loop V1 étape 4-A.
 *
 * Wrapper d'écriture dans la table unifiée `__seo_event_log` pour les events du
 * funnel de l'outil diagnostic → commande (diag_* + r2_*).
 *
 * Étend `SupabaseBaseService` (chemin DI canonique : `this.supabase` service-role
 * + sémaphore connexions + circuit breaker + fallback ADR-028 read-only). Pas de
 * `createClient` local (anti-duplication).
 *
 * Refs:
 * - 20260521_seo_event_funnel_enum.sql (ENUM seo_event_type +7)
 * - packages/seo-types/src/intelligence.ts (FunnelEventInputSchema)
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import type { FunnelEventInput } from '@repo/seo-types';

@Injectable()
export class FunnelEventsService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Persiste un event funnel. Fire-and-forget côté appelant : on log l'erreur
   * mais on ne lève jamais (un beacon raté ne doit pas casser une requête user).
   * `severity` est toujours `info` (events de mesure, pas d'alerte).
   */
  async record(input: FunnelEventInput): Promise<{ ok: boolean }> {
    const { error } = await this.supabase.from('__seo_event_log').insert({
      event_type: input.event_type,
      entity_url: input.entity_url ?? null,
      severity: 'info',
      payload: input.payload,
    });
    if (error) {
      this.logger.error(
        `funnel event insert failed (${input.event_type}): ${error.message}`,
      );
      return { ok: false };
    }
    return { ok: true };
  }

  /**
   * Idempotent variant for GUARANTEED server-side emission (Commerce-Loop V1 PR-A).
   *
   * Same insert as `record()`, but a `23505` unique_violation (raised by the
   * partial unique index `uq_seo_event_log_r2_order_placed_order_id`) is treated
   * as a BENIGN idempotent skip (`deduped: true`) — the event already exists for
   * this natural key, no duplicate sale is written. Any OTHER error is a real
   * failure: logged at `error` (observable, never silent — CLAUDE.md) and
   * returned as `{ ok: false }` so the caller can surface it.
   *
   * Used by server-side emitters (e.g. OrderFunnelListener) where a duplicate is
   * expected-and-harmless but a true write failure must not be swallowed.
   */
  async recordOnce(
    input: FunnelEventInput,
  ): Promise<{ ok: boolean; deduped: boolean }> {
    const { error } = await this.supabase.from('__seo_event_log').insert({
      event_type: input.event_type,
      entity_url: input.entity_url ?? null,
      severity: 'info',
      payload: input.payload,
    });
    if (error) {
      if (error.code === '23505') {
        return { ok: true, deduped: true };
      }
      this.logger.error(
        `funnel event insert failed (${input.event_type}): ${error.message}`,
      );
      return { ok: false, deduped: false };
    }
    return { ok: true, deduped: false };
  }
}
