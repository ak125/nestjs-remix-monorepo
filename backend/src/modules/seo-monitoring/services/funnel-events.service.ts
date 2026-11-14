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
import {
  R2OrderPlacedPayloadSchema,
  type FunnelEventInput,
} from '@repo/seo-types';

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
  /**
   * Public beacon path (`POST /api/funnel/event`).
   *
   * Delegates to {@link recordOnce} so BOTH emitters share ONE insert and ONE
   * error policy. Before this delegation the beacon had its own copy of the
   * insert with no `23505` branch: once the partial unique index
   * `uq_seo_event_log_r2_order_placed_order_id` exists (migration 20260623), a
   * client re-firing `r2_order_placed` on a return to the confirmation page —
   * the observed behaviour, 2 order_ids in 07-08/2026 — would log an
   * `error` for what is by design a benign duplicate, mis-classifying the
   * signal. The dedup verdict is returned (`deduped: true`) rather than
   * swallowed: observable, never silent (CLAUDE.md no-silent-fallback).
   */
  async record(
    input: FunnelEventInput,
  ): Promise<{ ok: boolean; deduped: boolean }> {
    if (input.event_type !== 'r2_order_placed') {
      return this.recordOnce(input);
    }

    // item_count et revenue_cents viennent de la commande, pas du client :
    // la page de retour paiement ne connaît pas les lignes (l'API commande
    // refuse les invités) et enverrait une valeur inventée. Le client garde
    // session_id et referrer, qu'il est seul à connaître.
    const placed = R2OrderPlacedPayloadSchema.safeParse(input.payload);
    if (!placed.success) return { ok: false, deduped: false };
    const orderId = placed.data.order_id;
    const facts = await this.readOrderFacts(orderId);
    if (!facts) return { ok: false, deduped: false };
    if (facts.itemCount < 1) {
      this.logger.warn(
        `r2_order_placed refusé pour ${orderId} : commande inconnue ou sans ligne`,
      );
      return { ok: false, deduped: false };
    }
    return this.recordOnce({
      event_type: 'r2_order_placed',
      entity_url: input.entity_url,
      payload: {
        ...placed.data,
        item_count: facts.itemCount,
        revenue_cents: facts.revenueCents,
      },
    });
  }

  /**
   * Faits de conversion lus dans la commande (source de vérité), partagés par
   * la balise publique et OrderFunnelListener : nombre de lignes et total TTC
   * en centimes. `null` si les lignes sont illisibles (erreur journalisée) ;
   * un total illisible donne `revenueCents: null` (journalisé en warn).
   */
  async readOrderFacts(
    orderId: string,
  ): Promise<{ itemCount: number; revenueCents: number | null } | null> {
    const { count, error: countError } = await this.supabase
      .from('___xtr_order_line')
      .select('*', { count: 'exact', head: true })
      .eq('orl_ord_id', orderId);
    if (countError) {
      this.logger.error(
        `r2_order_placed: order line count read failed for ${orderId}: ${countError.message}`,
      );
      return null;
    }

    const { data: order, error: orderError } = await this.supabase
      .from('___xtr_order')
      .select('ord_total_ttc')
      .eq('ord_id', orderId)
      .maybeSingle();
    if (orderError) {
      this.logger.warn(
        `r2_order_placed: order total read failed for ${orderId} (revenue→null): ${orderError.message}`,
      );
    }

    return {
      itemCount: count ?? 0,
      revenueCents: toCents(order?.ord_total_ttc),
    };
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

/** ord_total_ttc est un TEXT en euros (ex. "49.90") → centimes entiers, ou null. */
export function toCents(rawTotal: unknown): number | null {
  if (rawTotal === null || rawTotal === undefined) return null;
  const value = Number.parseFloat(String(rawTotal));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
