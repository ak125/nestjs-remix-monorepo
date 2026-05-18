/**
 * @repo/seo-types/control-dashboard
 *
 * PR-SBD-1 v1 — Zod schemas for SEO Business Control Dashboard.
 *
 * Single source of truth for the contract between :
 *   - Backend NestJS endpoint  : GET /api/admin/seo-control/snapshot?range=…
 *   - Frontend Remix loader    : /admin/seo-control
 *   - Synthetic crawler        : safeParse for availability check
 *
 * Runtime-validated fail-loud both sides (anti-bricolage : pas de fallback
 * silencieux, parse errors crash explicitly).
 *
 * All numeric fields are FLOAT8 in SQL (cf. migration 002_rpcs.sql cast
 * `::FLOAT8`) → arrive as JS `number` in supabase-js, validate via `z.number()`.
 *
 * Limits enforced by Zod `.max()` to match SQL `LIMIT` :
 *   topLosers ≤ 20 · lowCtrOpportunities ≤ 50 · technicalAlerts ≤ 50
 *   conversionGap ≤ 20 · top_queries_sample ≤ 3 · payload_minimal ≤ 3 keys
 *   decisions.{suspected_causes, recommended_actions} ≤ 5
 *
 * Lineage (forensic replay) :
 *   snapshot_id   = UUID v4 (Node 16+ crypto.randomUUID), v7 V2 backlog
 *   snapshot_hash = SHA256 hex of fast-json-stable-stringify(payload-without-hash)
 *   generated_from = { rpc_versions: v1×5, decision_service_version: 'v1',
 *                      impact_score_version: 'v1', rules_catalog_version: 'v1' }
 */
import { z } from 'zod';
import {
  DECISION_RULE_IDS,
  OPERATIONAL_DOMAINS,
  ROLE_IDS,
  SURFACE_KEYS,
} from './control-dashboard.rules.js';

// ─── Primitive enums ────────────────────────────────────────────────

export const RangeSchema = z.enum(['7d', '28d']);
export type Range = z.infer<typeof RangeSchema>;

export const SeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);
export type Severity = z.infer<typeof SeveritySchema>;

export const SurfaceKeySchema = z.enum(SURFACE_KEYS);
export const RoleIdSchema = z.enum(ROLE_IDS);
export const OperationalDomainSchema = z.enum(OPERATIONAL_DOMAINS);

export const DecisionRuleIdSchema = z.enum(
  DECISION_RULE_IDS as [string, ...string[]],
);

// ─── Decisions (injected by SeoControlDecisionsService TS) ──────────

export const DecisionsSchema = z.object({
  suspected_causes: z.array(z.string()).max(5),
  recommended_actions: z.array(z.string()).max(5),
  decision_rule_ids: z.array(DecisionRuleIdSchema).min(1).max(5),
  role_id: RoleIdSchema,
});
export type Decisions = z.infer<typeof DecisionsSchema>;

// ─── Block 1 : Traffic Window ───────────────────────────────────────

export const TrafficDeltaSchema = z.object({
  clicks_pct: z.number().nullable(),
  impressions_pct: z.number().nullable(),
  direction: z.enum(['up', 'down', 'flat', 'unknown']),
  change_severity: z.enum(['high', 'medium', 'info']),
});

export const TrafficWindowSchema = z.object({
  impact_score_version: z.literal('v1'),
  clicks: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  ctr: z.number(),
  avg_position: z.number(),
  pages_count: z.number().int().nonnegative(),
  delta_vs_previous: TrafficDeltaSchema,
});
export type TrafficWindow = z.infer<typeof TrafficWindowSchema>;

// ─── Block 2 : Top Loser (with top_queries_sample) ──────────────────

export const TopQuerySampleSchema = z.object({
  query: z.string(),
  clicks_delta: z.number().int(),
  position_current: z.number().nullable(),
});

export const TopLoserSchema = z.object({
  page: z.string(),
  surface_key: SurfaceKeySchema,
  clicks_current: z.number().int().nonnegative(),
  clicks_previous: z.number().int().nonnegative(),
  delta_clicks: z.number().int(),
  delta_pct: z.number().nullable(),
  impressions_current: z.number().int().nonnegative(),
  position_current: z.number().nullable(),
  position_delta: z.number(),
  business_impact_score: z.number().nonnegative(),
  impact_score_version: z.literal('v1'),
  severity: SeveritySchema,
  top_queries_sample: z.array(TopQuerySampleSchema).max(3),
  decisions: DecisionsSchema,
});
export type TopLoser = z.infer<typeof TopLoserSchema>;

// ─── Block 3 : Low CTR Opportunity ──────────────────────────────────

export const LowCtrOpportunitySchema = z.object({
  page: z.string(),
  surface_key: SurfaceKeySchema,
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  ctr: z.number(),
  avg_position: z.number(),
  position_band: z.enum(['top5', 'top15', 'beyond']),
  business_impact_score: z.number().nonnegative(),
  impact_score_version: z.literal('v1'),
  severity: SeveritySchema,
  decisions: DecisionsSchema,
});
export type LowCtrOpportunity = z.infer<typeof LowCtrOpportunitySchema>;

// ─── Block 4 : Conversion Gap (Task 0 GO) ───────────────────────────

export const ConversionGapSchema = z.object({
  page: z.string(),
  surface_key: SurfaceKeySchema,
  sessions: z.number().int().nonnegative(),
  orders_count: z.number().int().nonnegative(),
  conversion_rate: z.number(),
  revenue: z.number(),
  business_impact_score: z.number().nonnegative(),
  impact_score_version: z.literal('v1'),
  severity: SeveritySchema,
  decisions: DecisionsSchema,
});
export type ConversionGap = z.infer<typeof ConversionGapSchema>;

// ─── Block 5 : Technical Alert ──────────────────────────────────────

export const TechnicalAlertSchema = z.object({
  source: z.enum(['audit_findings', 'event_log']),
  alert_type: z.string(),
  entity_url: z.string().nullable(),
  surface_key: SurfaceKeySchema,
  operational_domain: OperationalDomainSchema,
  severity: SeveritySchema,
  detected_at: z.string(),
  payload_minimal: z
    .record(z.unknown())
    .refine((o) => Object.keys(o).length <= 3, 'payload_minimal max 3 keys'),
  business_impact_score: z.number().nonnegative(),
  impact_score_version: z.literal('v1'),
  decisions: DecisionsSchema,
});
export type TechnicalAlert = z.infer<typeof TechnicalAlertSchema>;

// ─── Lineage (forensic replay) ──────────────────────────────────────

export const GeneratedFromSchema = z.object({
  rpc_versions: z.object({
    traffic: z.literal('v1'),
    losers: z.literal('v1'),
    low_ctr: z.literal('v1'),
    alerts: z.literal('v1'),
    conversion: z.literal('v1'),
  }),
  decision_service_version: z.literal('v1'),
  impact_score_version: z.literal('v1'),
  rules_catalog_version: z.literal('v1'),
});

export const SnapshotLineageSchema = z.object({
  snapshot_id: z.string().uuid(),
  snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/, 'sha256 hex (64 chars)'),
  generated_at: z.string(),
  generated_from: GeneratedFromSchema,
});

// ─── Full snapshot (root response) ──────────────────────────────────

export const SeoControlSnapshotSchema = SnapshotLineageSchema.extend({
  range: RangeSchema,
  window_days: z.number().int().positive(),
  trafficWindow: TrafficWindowSchema,
  topLosers: z.array(TopLoserSchema).max(20),
  lowCtrOpportunities: z.array(LowCtrOpportunitySchema).max(50),
  technicalAlerts: z.array(TechnicalAlertSchema).max(50),
  conversionGap: z.array(ConversionGapSchema).max(20).nullable(),
});

export type SeoControlSnapshot = z.infer<typeof SeoControlSnapshotSchema>;

// Re-export rules catalogue + enums from sibling module
export {
  DECISION_RULE_IDS,
  OPERATIONAL_DOMAINS,
  ROLE_IDS,
  SEO_CONTROL_DECISION_RULES_V1,
  SURFACE_KEYS,
} from './control-dashboard.rules.js';
export type {
  DecisionRuleId,
  OperationalDomain,
  RoleId,
  SurfaceKey,
} from './control-dashboard.rules.js';
