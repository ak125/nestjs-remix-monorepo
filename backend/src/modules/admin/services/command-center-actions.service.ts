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
  UNKNOWN_GSC_META,
  type GscOpportunityMeta,
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

/** Forme brute d'une ligne GSC renvoyée par rpc_seo_low_ctr_v1/v2 (JSONB). */
interface RawGscRow {
  page: string;
  impressions: number | string;
  clicks: number | string;
  avg_position?: number | string | null;
}

/**
 * Command Center — live Owner Action Queue engine (Phase 2).
 * Combines:
 *   - certification/repair actions from the canon snapshot (no DB),
 *   - REAL SEO opportunity actions (GSC — via the governed STABLE aggregation
 *     RPC rpc_seo_low_ctr_v2: synthetic queries filtered server-side, envelope
 *     discloses the p_limit cap + real data coverage + ingestion freshness;
 *     explicit logged fallback to v1 while the migration is not applied),
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
  /** SLA fraîcheur GSC : lag normal ≈ 3 j ; au-delà de 7 j = stale → PARTIAL. */
  private static readonly GSC_FRESH_MAX_LAG_DAYS = 7;

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
      // Governed STABLE aggregation, server-side GROUP BY + HAVING (avoids the
      // supabase-js 1000-row cap). p_max_ctr: 0 → strictly zero-click. Routed
      // through callRpc (RPC Safety Gate) — v1/v2 sont dans
      // governance/rpc/rpc_allowlist.json (une fonction inconnue du gate est
      // BLOCK en PROD enforce ; le « contexte interne » seul ne suffit pas).
      // v2 = synthetic queries filtered + honest envelope {rows, total_qualifying,
      // data_from, data_to, last_data_date}. v1 fallback is EXPLICIT and logged
      // (migration not yet applied): meta stays 'unknown' → the rule degrades
      // confidence to PARTIAL and the reason says the coverage is unknown —
      // governed, observable, never a silent green.
      const rpcParams = {
        p_window_days: CommandCenterActionsService.GSC_WINDOW_DAYS,
        p_min_impressions: CommandCenterActionsService.MIN_IMPRESSIONS,
        p_max_ctr: 0,
        p_limit: 50,
      };
      // Enveloppe honnête partagée v3/v2 (v3 ajoute coverage_status). v1 = sans enveloppe.
      type Envelope = {
        rows?: RawGscRow[];
        total_qualifying?: number | string | null;
        data_from?: string | null;
        data_to?: string | null;
        last_data_date?: string | null;
        coverage_status?: 'ok' | 'coverage_gap' | 'insufficient_data' | null;
      };
      const toMeta = (d: Envelope): GscOpportunityMeta => {
        // null doit RESTER null (Number(null) === 0 fabriquerait « Liste complète
        // (0 pages qualifiantes) » à côté de lignes non vides).
        const rawTotal = d.total_qualifying;
        const total = rawTotal == null ? NaN : Number(rawTotal);
        return {
          total_qualifying: Number.isFinite(total) ? total : null,
          data_from: d.data_from ?? null,
          data_to: d.data_to ?? null,
          freshness: this.gscFreshness(d.last_data_date ?? null),
          coverage_status: d.coverage_status ?? undefined,
        };
      };

      // Chaîne v3 → v2 → v1 (dégradation gracieuse, chaque repli loggué — no silent
      // fallback). v3 = grain pages FIDÈLE (__seo_gsc_daily_pages, sans query) +
      // couverture ; v2 = enveloppe honnête sans couverture ; v1 = sans enveloppe.
      // Toutes 3 dans rpc_allowlist.json (RPC Safety Gate). Une fonction non encore
      // déployée (migration non appliquée) → repli explicite, jamais un faux-vert.
      let rawRows: RawGscRow[];
      let meta: GscOpportunityMeta;
      const v3 = await this.callRpc<Envelope>('rpc_seo_low_ctr_v3', rpcParams);
      if (!v3.error && v3.data && Array.isArray(v3.data.rows)) {
        rawRows = v3.data.rows;
        meta = toMeta(v3.data);
      } else {
        this.logger.warn(
          `[command-center-actions] rpc_seo_low_ctr_v3 indisponible (${v3.error ?? 'enveloppe invalide'}) — fallback v2 : couverture inconnue`,
        );
        const v2 = await this.callRpc<Envelope>(
          'rpc_seo_low_ctr_v2',
          rpcParams,
        );
        if (!v2.error && v2.data && Array.isArray(v2.data.rows)) {
          rawRows = v2.data.rows;
          meta = toMeta(v2.data);
        } else {
          this.logger.warn(
            `[command-center-actions] rpc_seo_low_ctr_v2 indisponible (${v2.error ?? 'enveloppe invalide'}) — fallback v1 : couverture/total inconnus, confiance dégradée`,
          );
          const v1 = await this.callRpc<RawGscRow[]>(
            'rpc_seo_low_ctr_v1',
            rpcParams,
          );
          if (v1.error) throw v1.error;
          rawRows = v1.data ?? [];
          meta = UNKNOWN_GSC_META;
        }
      }

      // RPC returns BIGINT sums as JSONB numbers; coerce defensively. avg_position
      // → position (PR3): only a real SERP position (>0) survives; 0/NaN/absent → null
      // (explicit finite check, not a falsy-coerce) so the rule uses its honest fallback.
      const rows: GscOpportunityRow[] = rawRows.map((r) => {
        const pos = Number(r.avg_position);
        return {
          page: r.page,
          impressions: Number(r.impressions) || 0,
          clicks: Number(r.clicks) || 0,
          position: Number.isFinite(pos) && pos > 0 ? pos : null,
        };
      });
      return buildSeoOpportunityActions(rows, meta);
    } catch (e) {
      this.logger.warn(`[command-center-actions] SEO RPC failed: ${e}`);
      return [
        this.sourceUnavailable('seo', "Requête GSC d'opportunité indisponible"),
      ];
    }
  }

  /**
   * Fraîcheur d'ingestion GSC : 'fresh' si la dernière date ingérée est dans le
   * SLA (lag GSC normal ≈ 3 j) ; au-delà → 'stale' ; date absente/invalide →
   * 'unknown'. Stale/unknown ⇒ la règle dégrade la confiance à PARTIAL — la
   * constante « CERTIFIED 90 » n'est plus affichée sans vérification.
   */
  private gscFreshness(
    lastDataDate: string | null,
  ): 'fresh' | 'stale' | 'unknown' {
    if (!lastDataDate) return 'unknown';
    const last = Date.parse(lastDataDate);
    if (!Number.isFinite(last)) return 'unknown';
    // Jours calendaires entiers (floor) : 'YYYY-MM-DD' = minuit UTC, un lag
    // fractionnaire ferait basculer la même date fresh→stale selon l'heure.
    const lagDays = Math.floor((Date.now() - last) / 86_400_000);
    return lagDays <= CommandCenterActionsService.GSC_FRESH_MAX_LAG_DAYS
      ? 'fresh'
      : 'stale';
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
