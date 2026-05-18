import { z } from 'zod';

/**
 * SEO Criticality Tiers — Zod schema for
 * `.spec/00-canon/repository-registry/seo-criticality.yaml`.
 *
 * Source of truth for the SEO Production Control Plane (ADR-064, proposed)
 * Layer 4 Governance. Read at boot by :
 *   - Synthetic Crawler (L1) for sampling weights
 *   - Multi-source SLO (L2) for tier thresholds
 *   - Alerting Actions (L3) for routing
 *
 * Foundation PR-2D — no runtime component yet. Schema must stabilise before
 * PR-2A Collectors can rely on it.
 *
 * @see feedback_seo_routes_need_criticality_tiers (2026-05-14)
 * @see feedback_seo_control_plane_layered_architecture (4-layer model)
 */

const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'schemaVersion must be semver (X.Y.Z)');

const GlobSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9._\-*/]+$/, 'glob must be path-safe (alpha, digits, ., _, -, *, /)');

const TierIdSchema = z.enum(['tier0', 'tier1', 'tier2']);
export type TierId = z.infer<typeof TierIdSchema>;

const AlertingChannelSchema = z.enum(['pagerduty', 'slack', 'log', 'webhook']);
export type AlertingChannel = z.infer<typeof AlertingChannelSchema>;

const AlertingPolicySchema = z
  .object({
    breach_threshold_minutes: z.number().int().min(1).max(1440), // 1 min .. 24h
    channel: AlertingChannelSchema,
    auto_issue: z.boolean(),
  })
  .strict();

const TierPolicySchema = z
  .object({
    slo: z
      .number()
      .min(0.5, 'SLO < 0.5 makes no sense for a Tier — would be permanent breach')
      .max(0.9999, 'SLO == 1 is unachievable, max 0.9999'),
    sampling_weight: z
      .number()
      .min(0)
      .max(1, 'sampling_weight is a fraction in [0,1]'),
    alerting: AlertingPolicySchema,
    routes: z.array(GlobSchema).min(1),
  })
  .strict();

const MetadataSchema = z
  .object({
    adr_reference: z.string().regex(/^ADR-\d{3,}$/, 'must be ADR-NNN'),
    introduced_in_pr: z.union([z.string().regex(/^#\d+$/), z.literal('TBD')]),
    last_review: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO date YYYY-MM-DD'),
    next_review_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO date YYYY-MM-DD'),
  })
  .strict();

const ExcludedSchema = z
  .object({
    routes: z.array(GlobSchema).min(1),
  })
  .strict();

export const SeoCriticalitySchema = z
  .object({
    schemaVersion: SemverSchema,
    slo_window_minutes: z.number().int().min(5).max(1440),
    tiers: z
      .object({
        tier0: TierPolicySchema,
        tier1: TierPolicySchema,
        tier2: TierPolicySchema,
      })
      .strict(),
    excluded: ExcludedSchema,
    metadata: MetadataSchema,
  })
  .strict()
  .superRefine((c, ctx) => {
    // Sampling weights across tiers should sum ~= 1.0 (allow ±0.01 floating slack).
    const total =
      c.tiers.tier0.sampling_weight +
      c.tiers.tier1.sampling_weight +
      c.tiers.tier2.sampling_weight;
    if (Math.abs(total - 1.0) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `tiers.*.sampling_weight must sum to 1.0 ± 0.01 (got ${total.toFixed(3)})`,
        path: ['tiers'],
      });
    }

    // SLO must be strictly decreasing tier0 > tier1 > tier2 (business-critical tighter).
    if (
      c.tiers.tier0.slo <= c.tiers.tier1.slo ||
      c.tiers.tier1.slo <= c.tiers.tier2.slo
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `SLO must be strictly decreasing: tier0 (${c.tiers.tier0.slo}) > tier1 (${c.tiers.tier1.slo}) > tier2 (${c.tiers.tier2.slo})`,
        path: ['tiers'],
      });
    }

    // alerting.breach_threshold_minutes must be strictly increasing tier0 < tier1 < tier2
    // (less tolerance for tier0 breaches).
    if (
      c.tiers.tier0.alerting.breach_threshold_minutes >=
        c.tiers.tier1.alerting.breach_threshold_minutes ||
      c.tiers.tier1.alerting.breach_threshold_minutes >=
        c.tiers.tier2.alerting.breach_threshold_minutes
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `breach_threshold_minutes must be strictly increasing tier0 < tier1 < tier2`,
        path: ['tiers'],
      });
    }

    // Anti-pattern guard : admin/* MUST be in excluded, never in any tier.
    const allTierRoutes = [
      ...c.tiers.tier0.routes,
      ...c.tiers.tier1.routes,
      ...c.tiers.tier2.routes,
    ];
    const adminInTier = allTierRoutes.find((r) => r.includes('admin'));
    if (adminInTier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `admin/* routes must be in 'excluded', never in any tier (got: "${adminInTier}"). See feedback_seo_routes_need_criticality_tiers.`,
        path: ['tiers'],
      });
    }

    // Anti-pattern guard : api/* same.
    const apiInTier = allTierRoutes.find((r) => /^api\//.test(r));
    if (apiInTier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `api/* routes must be in 'excluded', never in any tier (got: "${apiInTier}").`,
        path: ['tiers'],
      });
    }
  });

export type SeoCriticality = z.infer<typeof SeoCriticalitySchema>;

/**
 * Convert a minimal glob to a RegExp. Supports:
 *   - `*` matches any chars except path separator `/` (non-greedy)
 *   - `/*` at end means "this segment or any descendant"
 *   - everything else is a literal
 * Examples:
 *   `pieces/*` → matches `pieces/foo`, `pieces/foo/bar`, NOT `pieces` alone (no slash).
 *   `sitemap*.xml` → matches `sitemap.xml`, `sitemap-index.xml`, `sitemap-pieces-1.xml`.
 *   `robots.txt` → exact match only.
 */
function globToRegex(glob: string): RegExp {
  let body = glob;
  let tailOpt = false;
  if (body.endsWith('/*')) {
    body = body.slice(0, -2);
    tailOpt = true;
  }
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const stared = escaped.replace(/\*/g, '[^/]*');
  return new RegExp(`^${stared}${tailOpt ? '(/.+)?' : ''}$`);
}

/**
 * Classify a route path against the criticality config. Returns the tier id,
 * or "excluded" if the route is in the exclusion allowlist, or null if the
 * route is not covered (uncovered routes default to tier2 in callers — be
 * explicit at the call site).
 */
export function classifyRoute(
  config: SeoCriticality,
  routePath: string,
): TierId | 'excluded' | null {
  const normalized = routePath.startsWith('/') ? routePath.slice(1) : routePath;
  const matchesGlob = (glob: string): boolean => globToRegex(glob).test(normalized);

  for (const ex of config.excluded.routes) {
    if (matchesGlob(ex)) return 'excluded';
  }
  for (const [tier, policy] of Object.entries(config.tiers) as Array<[TierId, typeof config.tiers.tier0]>) {
    if (policy.routes.some(matchesGlob)) return tier;
  }
  return null;
}

export { SemverSchema, GlobSchema, TierIdSchema, AlertingChannelSchema };
