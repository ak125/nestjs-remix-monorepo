/**
 * Command Center — Owner Action scoring + the LOCKED safety caps.
 *
 * Phase 2 (owner decision 2026-06-06): the action queue must be HONEST —
 *   CERTIFIED source → real business action
 *   PARTIAL source   → cautious action (prudence flag)
 *   UNKNOWN/BROKEN    → certification/repair action ONLY (never a fake business insight)
 *
 * The caps below are not advisory: `finalizeAction()` MECHANICALLY converts any
 * `business` action whose data confidence is too low into a `certification` action,
 * so a rule physically cannot emit a business recommendation on broken data.
 */

import type { CcActionV2, CcSeoDetail } from '@repo/registry';

/**
 * Single source of truth: the action wire types ARE the registry Zod-inferred
 * contract the frontend consumes. Aliasing (not hand-mirroring) makes any future
 * drift a COMPILE error at the registry SoT — no parallel definition, no runtime gate.
 */
export type ActionSource = CcActionV2['source'];
export type ActionType = CcActionV2['action_type'];

export type SourceCertification =
  | 'CERTIFIED'
  | 'PARTIAL'
  | 'UNKNOWN'
  | 'BROKEN';

/** Per-URL drill-down for a seo:opportunity:* action (PR2). null for every other action. */
export type SeoOpportunityDetail = CcSeoDetail;

/**
 * The owner-action wire contract = the registry Zod type (single source of truth).
 * Field bounds (impact/urgency/effort/risk 0..10, data_confidence 0..100) and the
 * source/action_type enums live in CcActionV2Schema; this is its inferred type.
 */
export type OwnerActionV2 = CcActionV2;

/**
 * What a rule emits before scoring/gating (score computed by finalizeAction).
 * `details` is optional here — only SEO rules set it; finalizeAction normalises
 * the absent case to `null`.
 */
export type RawAction = Omit<OwnerActionV2, 'score' | 'details'> & {
  details?: SeoOpportunityDetail[] | null;
};

/** Confidence floor below which a `business`/`risk` action is downgraded to certification. */
export const BUSINESS_CONFIDENCE_FLOOR = 40;

/** Default data_confidence per source certification (a rule may override). */
export const CONFIDENCE_BY_CERT: Record<SourceCertification, number> = {
  CERTIFIED: 90,
  PARTIAL: 55,
  UNKNOWN: 25,
  BROKEN: 10,
};

/**
 * score = impact + urgency + (data_confidence / 10) - effort - risk
 * (data_confidence normalized to a 0..10 term so it doesn't dominate; the raw
 * 0..100 value is what the cap below tests.)
 */
export function computeScore(a: RawAction): number {
  const raw = a.impact + a.urgency + a.data_confidence / 10 - a.effort - a.risk;
  return Math.round(raw * 10) / 10;
}

/**
 * Enforce the honesty caps, then score. A `business` or `risk` action whose
 * confidence is below the floor (broken/unknown/low-trust source) is converted
 * into a `certification` action whose next step is to fix/wire the source —
 * never a fake business insight on bad data.
 */
export function finalizeAction(raw: RawAction): OwnerActionV2 {
  let a: RawAction = { ...raw };

  const needsTrust = a.action_type === 'business' || a.action_type === 'risk';
  if (needsTrust && a.data_confidence < BUSINESS_CONFIDENCE_FLOOR) {
    a = {
      ...a,
      action_type: 'certification',
      title: `Fiabiliser la source « ${a.source} » avant d'agir`,
      reason:
        `Source non fiable (confiance ${a.data_confidence}/100 < ${BUSINESS_CONFIDENCE_FLOOR}) — ` +
        `aucune recommandation business tant que la donnée n'est pas certifiée. (${a.reason})`,
      next_step:
        a.next_step ||
        `Certifier / câbler la source ${a.source} (preuve + fraîcheur) avant toute optimisation.`,
      // a degraded source is high-leverage to fix → keep urgency, drop risk of acting
      risk: Math.min(a.risk, 2),
      // a non-certified action must NOT carry presentational per-URL metrics —
      // keep "details only on a trusted/business action" structurally true.
      details: null,
    };
  }

  return { ...a, score: computeScore(a), details: a.details ?? null };
}

/** Sort: highest score first; ties broken by action_type then id (deterministic). */
const TYPE_RANK: Record<ActionType, number> = {
  repair: 0,
  certification: 1,
  risk: 2,
  business: 3,
};
export function sortActions(actions: OwnerActionV2[]): OwnerActionV2[] {
  return [...actions].sort(
    (x, y) =>
      y.score - x.score ||
      TYPE_RANK[x.action_type] - TYPE_RANK[y.action_type] ||
      (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
}
