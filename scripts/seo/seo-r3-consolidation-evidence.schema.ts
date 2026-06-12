/**
 * seo-r3-consolidation-evidence.schema.ts — Zod SoT for the read-only
 * "R3 pillar consolidation evidence" matrix (per gamme).
 *
 * Evidence-only. The matrix MEASURES; it never decides a fold/canonical/301.
 * `evidence_complete=false` forces recommendation/url verdicts to OBSERVE
 * (owner adjustment 1). `recommendation` (architecture) is kept STRICTLY
 * separate from `url_R4`/`url_R6` (URL posture) — owner adjustment 2.
 */
import { z } from 'zod';

export const LIVE_STATUS = ['PRESENT_RICH', 'PRESENT_THIN', 'DRAFT', 'ABSENT', 'OBSERVE'] as const;
export const INDEX_FOLLOW = ['INDEX_FOLLOW', 'NOINDEX_FOLLOW', 'NOINDEX_NOFOLLOW', 'OBSERVE'] as const;
export const OVERLAP_BAND = ['LOW', 'MED', 'HIGH', 'OBSERVE'] as const;
export const RECOMMENDATION = ['R3_ONLY', 'R3_PLUS_R4', 'R3_PLUS_R6', 'R3_PLUS_R4_R6', 'OBSERVE', 'NO_ACTION'] as const;
export const URL_VERDICT = ['KEEP', 'MERGE+301', 'CANONICAL', 'OBSERVE'] as const;
export const RISK_LEVEL = ['LOW', 'MEDIUM', 'HIGH'] as const;

const GscMetrics = z
  .object({ clicks: z.number(), impressions: z.number(), position: z.number().nullable() })
  .strict();

const RoleSignals = z
  .object({
    role: z.enum(['R3', 'R4', 'R6']),
    url: z.string().nullable(),
    live: z.enum(LIVE_STATUS),
    gsc_28d: GscMetrics.nullable(), // null = signal absent → OBSERVE (anti-fabrication)
    gsc_90d: GscMetrics.nullable(),
    index_follow: z.enum(INDEX_FOLLOW),
    inbound_links: z.number().int().nullable(), // null = OBSERVE
  })
  .strict();

const OverlapPair = z
  .object({
    pair: z.enum(['R3_R4', 'R3_R6']),
    jaccard: z.number().nullable(), // null = not computable (a side absent) → OBSERVE
    band: z.enum(OVERLAP_BAND),
  })
  .strict();

export const GammeRowSchema = z
  .object({
    gamme: z.string(),
    pg_id: z.number().int(),
    pg_alias: z.string(),
    intent_targets: z.array(z.string()),
    roles: z.object({ R3: RoleSignals, R4: RoleSignals, R6: RoleSignals }).strict(),
    overlaps: z.array(OverlapPair),
    user_intent_gap: z.array(z.string()),
    // Owner adjustment 1 — explicit completeness gate.
    evidence_complete: z.boolean(),
    missing_signals: z.array(z.string()),
    // Owner adjustment 2 — architecture recommendation, kept separate from URL posture.
    recommendation: z.enum(RECOMMENDATION),
    url_R4: z.enum(URL_VERDICT),
    url_R6: z.enum(URL_VERDICT),
    // Owner adjustment 3 — explicit risk.
    risk_level: z.enum(RISK_LEVEL),
    risk_reasons: z.array(z.string()),
    next_action: z.string(),
  })
  .strict();

export const MatrixSchema = z
  .object({
    schema_version: z.literal('r3-consolidation-evidence.v1'),
    site: z.string(),
    window: z
      .object({
        end: z.string(), // YYYY-MM-DD (from --end ; no wall-clock)
        d28: z.object({ start: z.string(), end: z.string() }).strict(),
        d90: z.object({ start: z.string(), end: z.string() }).strict(),
      })
      .strict(),
    live_robots: z.boolean(), // whether index/follow was probed live (else OBSERVE)
    rows: z.array(GammeRowSchema),
  })
  .strict();

export type GammeRow = z.infer<typeof GammeRowSchema>;
export type Matrix = z.infer<typeof MatrixSchema>;
export type RoleSignalsT = z.infer<typeof RoleSignals>;
