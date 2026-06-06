import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  buildCertificationActions,
  type ChainView,
  type DeptView,
} from './command-center-action-rules/certification-action.rules';
import {
  buildSeoOpportunityActions,
  type GscOpportunityRow,
} from './command-center-action-rules/seo-action.rules';
import { buildPricingRiskActions } from './command-center-action-rules/pricing-action.rules';
import {
  CONFIDENCE_BY_CERT,
  finalizeAction,
  sortActions,
  type ActionSource,
  type OwnerActionV2,
  type RawAction,
} from './command-center-action-rules/score-action';

/**
 * Command Center — live Owner Action Queue engine (Phase 2).
 * Combines:
 *   - certification/repair actions from the canon snapshot (no DB),
 *   - REAL SEO opportunity actions (GSC, certified — via the governed STABLE
 *     aggregation RPC rpc_seo_low_ctr_v1; server-side GROUP BY, no new RPC/migration),
 *   - cautious pricing actions (missing purchase price via count; margin thresholds
 *     + runtime sell-at-loss kept as certification — no fake threshold).
 * Every source is graceful: a failed query yields a "source unavailable" certification
 * action, never a crash and never a fabricated business insight. supabase-js does NOT
 * throw on a failed query (it resolves { error }), so every read checks `error` and
 * throws into the catch — a broken source surfaces as certification, never fake-green.
 */
@Injectable()
export class CommandCenterActionsService extends SupabaseBaseService {
  private static readonly GSC_WINDOW_DAYS = 120;
  private static readonly MIN_IMPRESSIONS = 50;

  constructor(configService: ConfigService) {
    super(configService);
  }

  /** Full mode only — light/disabled never expose action detail. */
  async computeActionQueue(
    departments: DeptView[],
    chains: ChainView[],
    mode: string,
  ): Promise<OwnerActionV2[]> {
    if (mode !== 'full') return [];
    const raws: RawAction[] = [
      ...buildCertificationActions(departments, chains),
      ...(await this.seoOpportunities()),
      ...(await this.pricingRisks()),
    ];
    return sortActions(raws.map(finalizeAction));
  }

  private async seoOpportunities(): Promise<RawAction[]> {
    try {
      // Reuse the governed STABLE aggregation RPC instead of reinventing GROUP BY
      // client-side: it computes SUM(impressions)/SUM(clicks) GROUP BY page with
      // HAVING impressions >= p_min_impressions AND ctr <= p_max_ctr, server-side.
      // p_max_ctr: 0 → strictly zero-click. This avoids the supabase-js 1000-row
      // cap and the unindexed client sort; STABLE = read-only (no mutation).
      // Routed through callRpc (RPC Safety Gate) — internal admin context, not
      // source:'api', so no allowlist entry is required.
      const { data, error } = await this.callRpc<
        Array<{
          page: string;
          impressions: number | string;
          clicks: number | string;
        }>
      >('rpc_seo_low_ctr_v1', {
        p_window_days: CommandCenterActionsService.GSC_WINDOW_DAYS,
        p_min_impressions: CommandCenterActionsService.MIN_IMPRESSIONS,
        p_max_ctr: 0,
        p_limit: 50,
      });
      if (error) throw error;

      // RPC returns BIGINT sums as JSONB numbers; coerce defensively.
      const rows: GscOpportunityRow[] = (data ?? []).map((r) => ({
        page: r.page,
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
      }));
      return buildSeoOpportunityActions(rows);
    } catch (e) {
      this.logger.warn(`[command-center-actions] SEO RPC failed: ${e}`);
      return [
        this.sourceUnavailable('seo', "Requête GSC d'opportunité indisponible"),
      ];
    }
  }

  private async pricingRisks(): Promise<RawAction[]> {
    try {
      // supabase-js resolves { error } on failure (it does NOT throw): check both
      // queries and throw so a broken pricing source becomes an observable
      // sourceUnavailable certification action — never a fake-green "0 / 0".
      const { count: available, error: availableError } = await this.supabase
        .from('pieces_price')
        .select('*', { count: 'exact', head: true })
        .eq('pri_dispo', '1');
      if (availableError) throw availableError;

      // missing purchase price = column-to-LITERAL filters (supabase-js OK)
      const {
        data: missingRows,
        count: missing,
        error: missingError,
      } = await this.supabase
        .from('pieces_price')
        .select('pri_piece_id', { count: 'exact' })
        .eq('pri_dispo', '1')
        .gt('pri_vente_ht_n', 0)
        .or('pri_achat_ht_n.is.null,pri_achat_ht_n.eq.0')
        .limit(5);
      if (missingError) throw missingError;

      return buildPricingRiskActions({
        available_total: available ?? 0,
        sell_at_loss: 0, // column-to-column compare not supabase-js-queryable → import-enforced
        missing_purchase: missing ?? 0,
        sell_at_loss_samples: [],
        missing_samples: (
          (missingRows ?? []) as Array<{ pri_piece_id: string }>
        ).map((r) => String(r.pri_piece_id)),
      });
    } catch (e) {
      this.logger.warn(`[command-center-actions] pricing query failed: ${e}`);
      return [
        this.sourceUnavailable('pricing', 'Requête pricing indisponible'),
      ];
    }
  }

  private sourceUnavailable(source: ActionSource, reason: string): RawAction {
    return {
      id: `unavailable:${source}`,
      title: `Source ${source} indisponible — fiabiliser avant d'agir`,
      department: source,
      source,
      action_type: 'certification',
      impact: 5,
      urgency: 5,
      data_confidence: CONFIDENCE_BY_CERT.UNKNOWN,
      effort: 3,
      risk: 1,
      reason,
      evidence: [],
      next_step: `Vérifier la connectivité/le schéma de la source ${source}.`,
    };
  }
}
