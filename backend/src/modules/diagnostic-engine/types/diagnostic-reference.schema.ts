import { z } from 'zod';
import { CauseTypeEnum, UrgencyLevelEnum } from './evidence-pack.schema';

// Validate the existing reference contract, without inventing defaults or
// translating unknown urgencies. The data service keeps the original rows so
// metadata used by downstream engines is not stripped by schema parsing.
const identity = z.number().int().positive();
const text = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const activeRow = z.object({ id: identity, active: z.literal(true) });
const namedRow = activeRow.extend({
  slug: text,
  label: text,
  description: z.string().nullable(),
});

export const DiagSystemRowSchema = namedRow;
export const DiagSymptomRowSchema = namedRow.extend({
  system_id: identity,
  signal_mode: text,
  urgency: UrgencyLevelEnum,
});
export const DiagCauseRowSchema = namedRow
  .extend({
    system_id: identity,
    // Reference rows and output hypotheses share the same supported categories.
    cause_type: CauseTypeEnum,
    verification_method: z.string().nullable(),
    urgency: UrgencyLevelEnum,
    plausible_km_min: z.number().finite().nonnegative().nullish(),
    plausible_km_max: z.number().finite().nonnegative().nullish(),
    plausible_age_min: z.number().finite().nonnegative().nullish(),
    plausible_age_max: z.number().finite().nonnegative().nullish(),
  })
  .refine(
    (row) =>
      (row.plausible_km_min == null ||
        row.plausible_km_max == null ||
        row.plausible_km_min <= row.plausible_km_max) &&
      (row.plausible_age_min == null ||
        row.plausible_age_max == null ||
        row.plausible_age_min <= row.plausible_age_max),
  );
export const DiagCauseLinkRowSchema = activeRow.extend({
  symptom_id: identity,
  cause_id: identity,
  relative_score: z.number().int().min(0).max(100),
  evidence_for: z.array(z.string()),
  evidence_against: z.array(z.string()),
  requires_verification: z.boolean(),
});
export const DiagSafetyRuleRowSchema = activeRow.extend({
  system_id: identity,
  rule_slug: text,
  condition_description: text,
  risk_flag: text,
  urgency: UrgencyLevelEnum,
  blocks_catalog: z.boolean(),
});

const unique = (rows: Record<string, unknown>[], key: string) =>
  new Set(rows.map((row) => row[key])).size === rows.length;

export const DiagSystemsSchema = z
  .array(DiagSystemRowSchema)
  .refine((rows) => unique(rows, 'id') && unique(rows, 'slug'));
export const DiagSymptomsSchema = z
  .array(DiagSymptomRowSchema)
  .refine((rows) => unique(rows, 'id') && unique(rows, 'slug'));
export const DiagCausesSchema = z
  .array(DiagCauseRowSchema)
  .refine((rows) => unique(rows, 'id') && unique(rows, 'slug'));
export const DiagCauseLinksSchema = z
  .array(DiagCauseLinkRowSchema)
  .refine((rows) => unique(rows, 'id') && unique(rows, 'cause_id'));
export const DiagSafetyRulesSchema = z
  .array(DiagSafetyRuleRowSchema)
  .refine((rows) => unique(rows, 'id') && unique(rows, 'rule_slug'));
export const DiagSafetyRuleCoverageSchema = z.array(
  DiagSafetyRuleRowSchema.pick({ system_id: true, active: true }),
);
