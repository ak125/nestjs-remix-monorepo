import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GSC_BACKFILL_FLOOR_DATE_DEFAULT, isIsoDate } from '@repo/seo-types';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, join } from 'path';
import { gzipSync } from 'zlib';
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
  buildImprovementCandidateActions,
  type SizeBudgetMeasure,
} from './command-center-action-rules/improvement-candidate.rules';
import { resolveOrchestrationMode } from './command-center-orchestrator/executable-action.contract';
import {
  CONFIDENCE_BY_CERT,
  finalizeAction,
  sortActions,
  type ActionSource,
  type OwnerActionV2,
  type RawAction,
} from './command-center-action-rules/score-action';

/** Forme brute d'une ligne GSC renvoyée par rpc_seo_low_ctr_v1..v4 (JSONB). */
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
 *     RPC rpc_seo_low_ctr_v4: faithful page grain, envelope discloses the p_limit
 *     cap + committed days + clicks/impressions coverage + ingestion freshness;
 *     explicit logged fallback v3 → v2 → v1 while the migration is not applied),
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

  /** Premier jour GSC attendu passé à v4 (même param que le planificateur d'ingestion). */
  private readonly gscExpectedFrom: string;

  constructor(configService: ConfigService) {
    super(configService);
    const rawFloor = configService.get<string>('SEO_GSC_BACKFILL_FLOOR_DATE');
    if (rawFloor == null || String(rawFloor).trim() === '') {
      this.gscExpectedFrom = GSC_BACKFILL_FLOOR_DATE_DEFAULT;
    } else if (isIsoDate(String(rawFloor).trim())) {
      this.gscExpectedFrom = String(rawFloor).trim();
    } else {
      this.logger.warn(
        `⚠️ SEO_GSC_BACKFILL_FLOOR_DATE=${rawFloor} invalide (attendu YYYY-MM-DD) — défaut ${GSC_BACKFILL_FLOOR_DATE_DEFAULT} appliqué`,
      );
      this.gscExpectedFrom = GSC_BACKFILL_FLOOR_DATE_DEFAULT;
    }
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
      ...this.improvementCandidates(),
    ];
    return sortActions(raws.map(finalizeAction));
  }

  private async seoOpportunities(): Promise<RawAction[]> {
    try {
      // Governed STABLE aggregation, server-side GROUP BY + HAVING (avoids the
      // supabase-js 1000-row cap). p_max_ctr: 0 → strictly zero-click. Routed
      // through callRpc (RPC Safety Gate) — v1..v4 sont dans
      // governance/rpc/rpc_allowlist.json (une fonction inconnue du gate est
      // BLOCK en PROD enforce ; le « contexte interne » seul ne suffit pas).
      // Enveloppe honnête {rows, total_qualifying, data_from, data_to,
      // last_data_date, coverage_status, grain, days_*}. Chaque repli est EXPLICITE
      // et loggué ; seul le grain fidèle (v4) peut conduire à CERTIFIED —
      // governed, observable, never a silent green.
      const rpcParams = {
        p_window_days: CommandCenterActionsService.GSC_WINDOW_DAYS,
        p_min_impressions: CommandCenterActionsService.MIN_IMPRESSIONS,
        p_max_ctr: 0,
        p_limit: 50,
      };
      // v4 seule accepte ce paramètre (PostgREST résout la signature par noms :
      // le passer à v3/v2/v1 ferait échouer l'appel). Aucun ratio n'est passé : le
      // statut v4 ne dépend pas de l'écart d'agrégation byPage/propriété.
      const rpcParamsV4 = {
        ...rpcParams,
        p_expected_from: this.gscExpectedFrom,
      };
      // Enveloppe honnête partagée v4/v3/v2 (v3 ajoute coverage_status ; v4 ajoute
      // grain + jours). v1 = sans enveloppe.
      type Envelope = {
        rows?: RawGscRow[];
        total_qualifying?: number | string | null;
        data_from?: string | null;
        data_to?: string | null;
        last_data_date?: string | null;
        coverage_status?:
          | 'ok'
          | 'coverage_gap'
          | 'insufficient_data'
          | 'incomplete_days'
          | null;
        grain?: string | null;
        days_expected?: number | string | null;
        days_present?: number | string | null;
      };
      // null doit RESTER null (Number(null) === 0 fabriquerait « Liste complète
      // (0 pages qualifiantes) » à côté de lignes non vides).
      const toCount = (raw: number | string | null | undefined) => {
        const n = raw == null ? NaN : Number(raw);
        return Number.isFinite(n) ? n : null;
      };
      const toMeta = (
        d: Envelope,
        grain_fidelity: GscOpportunityMeta['grain_fidelity'],
      ): GscOpportunityMeta => ({
        total_qualifying: toCount(d.total_qualifying),
        data_from: d.data_from ?? null,
        data_to: d.data_to ?? null,
        freshness: this.gscFreshness(d.last_data_date ?? null),
        grain_fidelity,
        coverage_status: d.coverage_status ?? undefined,
        days_expected: toCount(d.days_expected),
        days_present: toCount(d.days_present),
      });

      // Chaîne v4 → v3 → v2 → v1 (dégradation gracieuse, chaque repli loggué — no
      // silent fallback). v4 = grain page FIDÈLE (__seo_gsc_daily_page_totals, jours
      // commités) + jours et récupération du grain ; v3 = grain page+country+device
      // (LOSSY, ~7 % des clics) + couverture impressions ; v2 = grain requêtes (LOSSY)
      // sans couverture ; v1 = sans enveloppe. Toutes dans rpc_allowlist.json (RPC
      // Safety Gate). Une fonction non encore déployée (migration non appliquée) →
      // repli explicite, confiance PARTIAL, jamais un faux-vert.
      let rawRows: RawGscRow[] | undefined;
      let meta: GscOpportunityMeta = UNKNOWN_GSC_META;
      const v4 = await this.callRpc<Envelope>(
        'rpc_seo_low_ctr_v4',
        rpcParamsV4,
      );
      if (!v4.error && v4.data && Array.isArray(v4.data.rows)) {
        rawRows = v4.data.rows;
        // grain annoncé ≠ page_totals → fidélité non prouvée, pas supposée.
        meta = toMeta(
          v4.data,
          v4.data.grain === 'page_totals' ? 'faithful' : 'unknown',
        );
      } else {
        this.logger.warn(
          `[command-center-actions] rpc_seo_low_ctr_v4 indisponible (${v4.error ?? 'enveloppe invalide'}) — fallback v3 : grain pages lossy, confiance dégradée`,
        );
      }
      if (rawRows === undefined) {
        const v3 = await this.callRpc<Envelope>(
          'rpc_seo_low_ctr_v3',
          rpcParams,
        );
        if (!v3.error && v3.data && Array.isArray(v3.data.rows)) {
          rawRows = v3.data.rows;
          meta = toMeta(v3.data, 'lossy');
        } else {
          this.logger.warn(
            `[command-center-actions] rpc_seo_low_ctr_v3 indisponible (${v3.error ?? 'enveloppe invalide'}) — fallback v2 : couverture inconnue`,
          );
        }
      }
      if (rawRows === undefined) {
        const v2 = await this.callRpc<Envelope>(
          'rpc_seo_low_ctr_v2',
          rpcParams,
        );
        if (!v2.error && v2.data && Array.isArray(v2.data.rows)) {
          rawRows = v2.data.rows;
          meta = toMeta(v2.data, 'lossy');
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
      const rows: GscOpportunityRow[] = (rawRows ?? []).map((r) => {
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

  /** In-memory memo so an admin request doesn't re-gzip the build every time. */
  private sizeMemo: { at: number; actions: RawAction[] } | null = null;
  private static readonly SIZE_MEMO_TTL_MS = 60_000;

  /**
   * READ-ONLY improvement-candidate source: ranks chunks by size-limit headroom
   * (the "candidate auto-selection" feeder for the measured-improvement loop,
   * §8 agent-method-patterns). Pure ranking lives in improvement-candidate.rules;
   * here we only read frontend/.size-limit.json + gzip-measure the built assets.
   * 0-mutation, never executes. A missing build (DEV without `npm run build`) or
   * missing config yields [] WITH a log — observable, never a silent fallback,
   * never a crash (the source is advisory).
   */
  private improvementCandidates(): RawAction[] {
    // SHADOW by default: reuse the governed COMMAND_CENTER_ORCHESTRATION flag
    // (PROD forced 'off'; default 'off') — no new ungoverned flag. The read-only
    // perf candidates only surface in the shadow envelope (DEV/PREPROD, opt-in),
    // so existing behaviour/tests are unchanged until deliberately enabled.
    if (resolveOrchestrationMode() === 'off') return [];
    const now = Date.now();
    if (
      this.sizeMemo &&
      now - this.sizeMemo.at < CommandCenterActionsService.SIZE_MEMO_TTL_MS
    ) {
      return this.sizeMemo.actions;
    }
    const actions = this.measureSizeCandidates();
    this.sizeMemo = { at: now, actions };
    return actions;
  }

  private measureSizeCandidates(): RawAction[] {
    try {
      const frontendDir = this.resolveFrontendDir();
      if (!frontendDir) {
        this.logger.warn(
          '[command-center-actions] frontend/.size-limit.json introuvable — aucun candidat perf (observable, non-bloquant)',
        );
        return [];
      }
      const budgets = JSON.parse(
        readFileSync(join(frontendDir, '.size-limit.json'), 'utf-8'),
      ) as Array<{ name: string; path: string | string[]; limit: string }>;
      const assetsDir = join(frontendDir, 'build', 'client', 'assets');
      if (!existsSync(assetsDir)) {
        this.logger.warn(
          '[command-center-actions] build/client/assets absent (DEV sans build statique) — aucun candidat perf',
        );
        return [];
      }
      const files = readdirSync(assetsDir);
      const measures: SizeBudgetMeasure[] = [];
      for (const b of budgets) {
        const patterns = (Array.isArray(b.path) ? b.path : [b.path]).map((p) =>
          basename(p),
        );
        // Skip catch-all aggregates ("*.js"/"*.css"): expensive to gzip AND not a
        // targeted candidate (the global gate already covers them).
        if (patterns.some((p) => p === '*.js' || p === '*.css')) continue;
        const limitBytes = this.parseSizeLimit(b.limit);
        if (limitBytes <= 0) continue;
        let measuredBytes = 0;
        let matched = 0;
        for (const f of files) {
          if (patterns.some((p) => this.globMatch(p, f))) {
            measuredBytes += gzipSync(readFileSync(join(assetsDir, f))).length;
            matched++;
          }
        }
        if (matched === 0) continue; // no match → don't fabricate a 0-byte candidate
        measures.push({ name: b.name, measuredBytes, limitBytes });
      }
      return buildImprovementCandidateActions(measures);
    } catch (e) {
      this.logger.warn(
        `[command-center-actions] size candidates indisponibles: ${e}`,
      );
      return [];
    }
  }

  /**
   * Resolve frontend/ at runtime. Anchored on REGISTRY_DIR (the Docker image sets
   * it absolute → /app/audit/registry → /app/frontend), with cwd fallbacks that
   * also cover the `cd backend` start.sh trap. First dir with .size-limit.json wins.
   */
  private resolveFrontendDir(): string | null {
    const roots = [
      process.env.REGISTRY_DIR
        ? join(process.env.REGISTRY_DIR, '..', '..', 'frontend')
        : null,
      join(process.cwd(), 'frontend'),
      join(process.cwd(), '..', 'frontend'),
    ].filter((d): d is string => !!d);
    return roots.find((d) => existsSync(join(d, '.size-limit.json'))) ?? null;
  }

  /** "34 KB" → 34000, "1 MB" → 1000000 (size-limit uses decimal KB/MB). */
  private parseSizeLimit(limit: string): number {
    const m = /([\d.]+)\s*(B|KB|MB)?/i.exec(limit.trim());
    if (!m) return 0;
    const unit = (m[2] || 'B').toUpperCase();
    const mult = unit === 'MB' ? 1e6 : unit === 'KB' ? 1e3 : 1;
    return Math.round(parseFloat(m[1]) * mult);
  }

  /** Minimal glob (only the `*` wildcard, which is all size-limit patterns use). */
  private globMatch(pattern: string, name: string): boolean {
    const re = new RegExp(
      '^' +
        pattern
          .split('*')
          .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*') +
        '$',
    );
    return re.test(name);
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
