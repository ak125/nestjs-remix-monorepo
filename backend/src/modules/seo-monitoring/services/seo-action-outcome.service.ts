import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import { getAppConfig } from '../../../config/app.config';

/**
 * PR-2 — Mesure de la boucle OBSERVE.
 *
 * Deux chemins, strictement séparés (CHECK-0 flag #2) :
 *  - `materialize()` → RPC VOLATILE `rpc_seo_action_outcomes_materialize_v1` (service_role) :
 *    calcule les deltas baseline vs fenêtre 7/14/28 j et UPSERT `__seo_action_outcome`.
 *    Gardé READ_ONLY (PREPROD ne matérialise pas).
 *  - `getOutcomes()` → RPC STABLE `rpc_seo_action_outcomes_v1` (lecture, anon-safe) :
 *    enveloppe honnête {rows, complete, pending, last_data_date, disclaimer}.
 *
 * No-silent-fallback : une erreur RPC est SURFACÉE (jamais un faux tableau vide « propre »).
 */
@Injectable()
export class SeoActionOutcomeService {
  private readonly logger = new Logger(SeoActionOutcomeService.name);
  private readonly supabase: SupabaseClient;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback ANON_KEY en READ_ONLY (RLS protège les writes).
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'SeoActionOutcomeService: env Supabase manquant — échec au premier appel',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Matérialise les outcomes (idempotent). READ_ONLY → no-op surfacé. */
  async materialize(lookbackDays = 90): Promise<Record<string, unknown>> {
    if (getAppConfig().supabase.readOnly) {
      this.logger.warn(
        {
          metric: 'readonly.skipped',
          operation: 'seo-action-outcomes-materialize',
        },
        '[READ_ONLY] Skip materialize outcomes',
      );
      return { status: 'read_only' };
    }
    const { data, error } = await this.supabase.rpc(
      'rpc_seo_action_outcomes_materialize_v1',
      { p_lookback_days: lookbackDays },
    );
    if (error) {
      this.logger.error(`materialize outcomes KO: ${error.message}`);
      // SURFACÉ (no-silent-fallback) — le contrôleur transmet l'échec tel quel.
      return { status: 'error', reason: error.message };
    }
    return (data as Record<string, unknown>) ?? { status: 'ok' };
  }

  /** Lit les outcomes matérialisés (enveloppe honnête). */
  async getOutcomes(
    lookbackDays = 90,
    limit = 100,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase.rpc(
      'rpc_seo_action_outcomes_v1',
      {
        p_lookback_days: lookbackDays,
        p_limit: limit,
      },
    );
    if (error) {
      this.logger.error(`read outcomes KO: ${error.message}`);
      // SURFACÉ : on expose l'indisponibilité, jamais un faux tableau vide « ok ».
      return { rows: [], source_unavailable: true, reason: error.message };
    }
    return (data as Record<string, unknown>) ?? { rows: [] };
  }
}
