/**
 * @repo/seo-types/control-dashboard.rules
 *
 * PR-SBD-1 v1 — Catalogue centralisé des règles de décision du
 * SEO Business Control Dashboard.
 *
 * Chaque rule_id identifie une heuristique du SeoControlDecisionsService
 * (backend/src/modules/admin/services/seo-control-decisions.service.ts).
 *
 * Versioning : tous les rule_ids portent le suffixe `_V1`. La migration vers V2
 * (revenue-weighted scoring, stock awareness, recoverability) introduira de
 * nouveaux rule_ids `_V2` sans toucher les V1 → audit historique préservé.
 *
 * Source of truth pour : Zod enum `DecisionRuleIdSchema`, validation runtime
 * back+front, et la couche UI (DecisionsPopover Phase C).
 *
 * @example
 *   import { SEO_CONTROL_DECISION_RULES_V1, type DecisionRuleId } from "@repo/seo-types/control-dashboard.rules";
 *   const rule = SEO_CONTROL_DECISION_RULES_V1.LOSER_RANK_DROP_V1;
 *   console.log(rule.role_default); // 'seo-content'
 */

export const SEO_CONTROL_DECISION_RULES_V1 = {
  // ─── Top Losers ──────────────────────────────────────────────────
  LOSER_RANK_DROP_V1: {
    domain: 'seo',
    role_default: 'seo-content',
    desc: 'position_delta > 2 (ranking drop) — likely canonical/CWV regression',
  },
  LOSER_CTR_DROP_STABLE_POS_V1: {
    domain: 'seo',
    role_default: 'seo-content',
    desc: 'delta_pct < -30 and position_delta <= 1 — CTR drop at stable rank (meta/title issue)',
  },
  LOSER_LOST_VISIBILITY_V1: {
    domain: 'seo',
    role_default: 'seo-qa',
    desc: 'position_current > 20 and impressions_current > 100 — lost SERP visibility',
  },
  LOSER_UNCLEAR_V1: {
    domain: 'seo',
    role_default: 'seo-content',
    desc: 'Fallback when no specific signal matches',
  },

  // ─── Low CTR ─────────────────────────────────────────────────────
  LOWCTR_TOP5_META_MISMATCH_V1: {
    domain: 'seo',
    role_default: 'seo-content',
    desc: 'position_band=top5 with low CTR — meta description mismatch query intent',
  },
  LOWCTR_TOP15_TITLE_APPEAL_V1: {
    domain: 'seo',
    role_default: 'seo-content',
    desc: 'position_band=top15 with low CTR — title low appeal, A/B test recommended',
  },
  LOWCTR_BEYOND_RANK_FIRST_V1: {
    domain: 'seo',
    role_default: 'seo-qa',
    desc: 'position_band=beyond — focus on ranking first, CTR optimization deferred',
  },

  // ─── Alerts ──────────────────────────────────────────────────────
  ALERT_CANONICAL_DRIFT_V1: {
    domain: 'seo',
    role_default: 'seo-qa',
    desc: 'audit_findings.canonical_conflict — canonical drift',
  },
  ALERT_SCHEMA_INVALID_V1: {
    domain: 'seo',
    role_default: 'seo-qa',
    desc: 'audit_findings.schema_violation — structured data invalid',
  },
  ALERT_IMAGE_SEO_V1: {
    domain: 'content',
    role_default: 'seo-content',
    desc: 'audit_findings.image_seo — missing alt or oversize',
  },
  ALERT_INGESTION_FAILED_V1: {
    domain: 'ingestion',
    role_default: 'rag-lead',
    desc: 'event_log.ingestion_run_failed — GSC/GA4 credentials or quota',
  },
  ALERT_ANOMALY_V1: {
    domain: 'seo',
    role_default: 'cto',
    desc: 'event_log.anomaly_detected — traffic or ranking anomaly',
  },
  ALERT_UNKNOWN_V1: {
    domain: 'infra',
    role_default: 'cto',
    desc: 'Unknown alert_type — inspect event_log payload manually',
  },

  // ─── Conversion Gap (Bloc 4 — Task 0 GO verdict) ─────────────────
  CONV_CRITICAL_FUNNEL_BLOCK_V1: {
    domain: 'content',
    role_default: 'cmo',
    desc: 'orders_count=0 with sessions > 200 — critical funnel block (product/pricing/UX)',
  },
  CONV_WEAK_MATCH_V1: {
    domain: 'content',
    role_default: 'cmo',
    desc: 'conversion_rate < 0.5% — weak product match or price friction',
  },
  CONV_BELOW_AVG_V1: {
    domain: 'content',
    role_default: 'cmo',
    desc: 'Below-average conversion — monitor 2 more weeks before action',
  },
} as const;

export type DecisionRuleId = keyof typeof SEO_CONTROL_DECISION_RULES_V1;

export const DECISION_RULE_IDS = Object.keys(
  SEO_CONTROL_DECISION_RULES_V1,
) as DecisionRuleId[];

/**
 * Roles able to act on dashboard signals.
 * Mapped from Paperclip AI-COS agents + canonical roles.
 */
export const ROLE_IDS = [
  'ceo',
  'cmo',
  'cpo',
  'cto',
  'rag-lead',
  'seo-content',
  'seo-qa',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

/**
 * R-surfaces of the SEO chain (R0..R8) + admin/unknown.
 * Source : docs/seo/legacy_to_monorepo_gap_matrix.md + frontend/app/routes/.
 *   R0 = home
 *   R1 = pieces listing
 *   R2 = product page (currently absent, treated as R1)
 *   R3 = blog conseils gamme
 *   R4 = wiki editorial (deferred)
 *   R5 = gamme dedicated (sunset per ADR-027, treated as section in R3)
 *   R6 = blog article
 *   R7 = constructeur hub (brand)
 *   R8 = vehicle page (modele/type)
 *   admin = internal routes (excluded from SEO public)
 *   unknown = no pattern matched
 */
export const SURFACE_KEYS = [
  'R0',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'R8',
  'admin',
  'unknown',
] as const;
export type SurfaceKey = (typeof SURFACE_KEYS)[number];

/**
 * Operational domains for alert routing.
 * Mapped by `_seo_resolve_operational_domain()` SQL helper.
 */
export const OPERATIONAL_DOMAINS = [
  'seo',
  'ingestion',
  'infra',
  'content',
  'runtime',
] as const;
export type OperationalDomain = (typeof OPERATIONAL_DOMAINS)[number];
