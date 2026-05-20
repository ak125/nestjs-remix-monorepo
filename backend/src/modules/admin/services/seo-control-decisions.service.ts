/**
 * PR-SBD-1 Task 3 — SeoControlDecisionsService
 *
 * Pure TypeScript service for deriving actionable decisions
 * (suspected_causes + recommended_actions + decision_rule_ids + role_id)
 * from RPC rows of the SEO Business Control Dashboard.
 *
 * Anti-bricolage : no DB lookup, no I/O, no async. Rules encoded as pure
 * if/else heuristics, traceable via rule_ids from the V1 catalogue.
 *
 * Versioning : every rule_id ends with _V1. Future v2 (revenue/stock/
 * recoverability scoring) introduces _V2 rules without touching V1
 * (historical audit preserved).
 *
 * Refs :
 *   - packages/seo-types/src/control-dashboard.rules.ts (catalogue V1)
 *   - packages/seo-types/src/control-dashboard.ts (Zod schemas)
 *   - .claude/plans/verifier-existant-avant-et-ethereal-firefly.md Task 3
 */
import { Injectable } from '@nestjs/common';
import {
  type DecisionRuleId,
  type Decisions,
  type RoleId,
  SEO_CONTROL_DECISION_RULES_V1,
} from '@repo/seo-types';

@Injectable()
export class SeoControlDecisionsService {
  static readonly VERSION = 'v1';

  /**
   * Derive decisions for a Top Loser row.
   * Inputs from rpc_seo_top_losers_v1 JSONB row.
   */
  deriveLoser(row: {
    delta_pct: number | null;
    position_current: number | null;
    position_delta: number;
    impressions_current: number;
  }): Decisions {
    const ruleIds: DecisionRuleId[] = [];
    const causes: string[] = [];
    const actions: string[] = [];

    // Ranking drop : position dégradée > 2 positions
    if (row.position_delta > 2) {
      ruleIds.push('LOSER_RANK_DROP_V1');
      causes.push('ranking_drop');
      actions.push(
        'audit_canonical',
        'check_competitor_serp',
        'compare_top_queries_sample',
      );
    }

    // CTR drop at stable position : grosse perte clics, position quasi stable
    if (
      row.impressions_current > 0 &&
      row.delta_pct !== null &&
      row.delta_pct < -30 &&
      row.position_delta <= 1
    ) {
      ruleIds.push('LOSER_CTR_DROP_STABLE_POS_V1');
      causes.push('ctr_drop_at_stable_position');
      actions.push(
        'audit_meta_title_description',
        'check_serp_features_change',
      );
    }

    // Lost visibility : position basse mais encore vue
    if (
      row.position_current !== null &&
      row.position_current > 20 &&
      row.impressions_current > 100
    ) {
      ruleIds.push('LOSER_LOST_VISIBILITY_V1');
      causes.push('lost_serp_visibility');
      actions.push('audit_internal_links', 'check_index_status');
    }

    // Fallback : signal pas clair
    if (ruleIds.length === 0) {
      ruleIds.push('LOSER_UNCLEAR_V1');
      causes.push('unclear_signal');
      actions.push('compare_gsc_query_breakdown');
    }

    return this.assemble(ruleIds, causes, actions);
  }

  /**
   * Derive decisions for a Low CTR Opportunity row.
   * Inputs from rpc_seo_low_ctr_v1 JSONB row.
   */
  deriveLowCtr(row: {
    position_band: 'top5' | 'top15' | 'beyond';
    ctr: number;
    impressions: number;
  }): Decisions {
    if (row.position_band === 'top5') {
      return this.assemble(
        ['LOWCTR_TOP5_META_MISMATCH_V1'],
        ['meta_mismatch_query_intent', 'serp_feature_competition'],
        ['rewrite_meta_description', 'add_structured_data', 'audit_title_tag'],
      );
    }
    if (row.position_band === 'top15') {
      return this.assemble(
        ['LOWCTR_TOP15_TITLE_APPEAL_V1'],
        ['title_low_appeal', 'snippet_too_generic'],
        ['ab_test_title', 'enrich_meta_description'],
      );
    }
    return this.assemble(
      ['LOWCTR_BEYOND_RANK_FIRST_V1'],
      ['position_too_low_for_clicks'],
      ['focus_on_ranking_first', 'review_internal_link_targeting'],
    );
  }

  /**
   * Derive decisions for a Technical Alert row.
   * Inputs from rpc_seo_alerts_v1 JSONB row.
   */
  deriveAlert(row: { alert_type: string }): Decisions {
    const map: Record<
      string,
      { ruleId: DecisionRuleId; causes: string[]; actions: string[] }
    > = {
      canonical_conflict: {
        ruleId: 'ALERT_CANONICAL_DRIFT_V1',
        causes: ['canonical_drift'],
        actions: ['audit_canonical_chain', 'check_alternate_versions'],
      },
      schema_violation: {
        ruleId: 'ALERT_SCHEMA_INVALID_V1',
        causes: ['structured_data_invalid'],
        actions: ['run_schema_validator', 'compare_canon_template'],
      },
      image_seo: {
        ruleId: 'ALERT_IMAGE_SEO_V1',
        causes: ['missing_alt_or_oversize'],
        actions: ['regenerate_alt_text', 'compress_images'],
      },
      ingestion_run_failed: {
        ruleId: 'ALERT_INGESTION_FAILED_V1',
        causes: ['credentials_expired', 'api_quota'],
        actions: ['check_gsc_ga4_credentials', 'review_quota_dashboard'],
      },
      anomaly_detected: {
        ruleId: 'ALERT_ANOMALY_V1',
        causes: ['traffic_anomaly', 'ranking_anomaly'],
        actions: ['check_recent_deploys', 'review_gsc_coverage_report'],
      },
    };

    const matched = map[row.alert_type];
    if (matched) {
      return this.assemble([matched.ruleId], matched.causes, matched.actions);
    }

    return this.assemble(
      ['ALERT_UNKNOWN_V1'],
      ['unknown_alert_type'],
      ['inspect_event_log_payload'],
    );
  }

  /**
   * Derive decisions for a Conversion Gap row (Bloc 4).
   * Inputs from rpc_seo_conversion_v1 JSONB row.
   */
  deriveConversion(row: {
    sessions: number;
    orders_count: number;
    conversion_rate: number;
  }): Decisions {
    if (row.orders_count === 0 && row.sessions > 200) {
      return this.assemble(
        ['CONV_CRITICAL_FUNNEL_BLOCK_V1'],
        ['critical_funnel_block', 'wrong_product_match'],
        [
          'audit_product_availability',
          'check_pricing_visibility',
          'review_addtocart_button',
        ],
      );
    }
    if (row.conversion_rate < 0.5) {
      return this.assemble(
        ['CONV_WEAK_MATCH_V1'],
        ['weak_product_match', 'price_friction'],
        ['ab_test_landing_layout', 'check_competitor_prices'],
      );
    }
    return this.assemble(
      ['CONV_BELOW_AVG_V1'],
      ['below_average_conversion'],
      ['monitor_2_more_weeks'],
    );
  }

  /**
   * Assemble a Decisions object with role_id derived from the first rule_id.
   * Enforces the catalogue (every rule_id has role_default).
   */
  private assemble(
    ruleIds: DecisionRuleId[],
    causes: string[],
    actions: string[],
  ): Decisions {
    // role_id = role_default of the FIRST rule_id emitted (priority order)
    const primaryRule = ruleIds[0];
    const roleId = SEO_CONTROL_DECISION_RULES_V1[primaryRule]
      .role_default as RoleId;

    return {
      suspected_causes: causes.slice(0, 5),
      recommended_actions: actions.slice(0, 5),
      decision_rule_ids: ruleIds.slice(0, 5),
      role_id: roleId,
    };
  }
}
