/**
 * Marketing Brief DTO — Zod schemas + types inférés.
 *
 * Validation triple verrou (defense in depth, ADR-036) :
 *   1. CHECK SQL `__marketing_brief.business_unit/channel/conversion_goal`
 *   2. DTO Zod côté NestJS (ce fichier — refuse en amont avant query DB)
 *   3. Invariant OperatingMatrix `requires` (snapshot CI deterministic)
 *
 * Enums importées de `marketing-matrix.types` (PR-1.2) — single source of truth :
 *   - MarketingBusinessUnit : ECOMMERCE / LOCAL / HYBRID
 *   - MarketingChannel : 8 canaux fermés
 *   - MarketingConversionGoal : CALL / VISIT / QUOTE / ORDER
 *   - MarketingGateLevel : PASS / WARN / FAIL (cohérent __marketing_social_posts)
 *
 * Refinements :
 *   - business_unit × channel coherence (LOCAL = gbp/local_landing/sms uniquement)
 *   - HYBRID payload obligatoire (5 champs : hybrid_reason, cta_ecommerce, cta_local,
 *     conversion_goal_ecommerce, conversion_goal_local)
 *   - RGPD : pas applicable au DTO brief direct, mais le SERVICE (PR-1.5) qui
 *     query `___xtr_customer` filtre `cst_marketing_consent_at IS NOT NULL`
 *     pour les briefs RETENTION ECOMMERCE/HYBRID ciblant email/sms.
 *
 * Source vérité enum values : ADR-036 + canon `rules-marketing-voice.md`.
 */

import { z } from 'zod';

import {
  MarketingBusinessUnit,
  MarketingChannel,
  MarketingConversionGoal,
  MarketingGateLevel,
} from '@config/marketing-matrix.types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 Brief status enum (cohérent CHECK SQL __marketing_brief.status)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export enum MarketingBriefStatus {
  DRAFT = 'draft',
  REVIEWED = 'reviewed',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📋 AEC Coverage Manifest (rules-agent-exit-contract.md canon)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AecFinalStatusSchema = z.enum([
  'PARTIAL_COVERAGE',
  'SCOPE_SCANNED',
  'REVIEW_REQUIRED',
  'VALIDATED_FOR_SCOPE_ONLY',
  'INSUFFICIENT_EVIDENCE',
]);

/** Coverage manifest obligatoire pour TOUT brief (AEC v1.0.0). */
export const CoverageManifestSchema = z.object({
  scope_requested: z.string().min(1),
  scope_actually_scanned: z.string().min(1).optional(),
  files_read_count: z.number().int().min(0).optional(),
  excluded_paths: z.array(z.string()).default([]),
  unscanned_zones: z.array(z.string()).default([]),
  corrections_proposed: z.array(z.string()).default([]),
  validation_executed: z.boolean().default(false),
  remaining_unknowns: z.array(z.string()).default([]),
  final_status: AecFinalStatusSchema,
});

export type CoverageManifest = z.infer<typeof CoverageManifestSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔀 HYBRID payload sub-schema (5 conditions strictes ADR-036)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const HybridPayloadSchema = z
  .object({
    hybrid_reason: z
      .string()
      .min(1, 'hybrid_reason obligatoire (ADR-036 §HYBRID)'),
    cta_ecommerce: z.string().min(1),
    cta_local: z.string().min(1),
    conversion_goal_ecommerce: z.nativeEnum(MarketingConversionGoal),
    conversion_goal_local: z.nativeEnum(MarketingConversionGoal),
    /** Optionnel : zone géographique cible (default '93' pour smart routing). */
    target_zone: z.string().optional(),
  })
  .refine((data) => data.cta_ecommerce !== data.cta_local, {
    message:
      'cta_ecommerce et cta_local doivent être DISTINCTS (sinon non-HYBRID)',
    path: ['cta_local'],
  })
  .refine(
    (data) => data.conversion_goal_ecommerce !== data.conversion_goal_local,
    {
      message:
        'conversion_goal_ecommerce et conversion_goal_local doivent être DISTINCTS',
      path: ['conversion_goal_local'],
    },
  );

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 Cohérence business_unit × channel (CHECK SQL miroir)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LOCAL_CHANNELS = new Set<MarketingChannel>([
  MarketingChannel.GBP,
  MarketingChannel.LOCAL_LANDING,
  MarketingChannel.SMS,
]);

const ECOMMERCE_CHANNELS = new Set<MarketingChannel>([
  MarketingChannel.WEBSITE_SEO,
  MarketingChannel.EMAIL,
  MarketingChannel.SOCIAL_FACEBOOK,
  MarketingChannel.SOCIAL_INSTAGRAM,
  MarketingChannel.SOCIAL_YOUTUBE,
]);

/** Vrai si la combinaison business_unit × channel est valide. */
export function isCoherentUnitChannel(
  businessUnit: MarketingBusinessUnit,
  channel: MarketingChannel,
): boolean {
  if (businessUnit === MarketingBusinessUnit.HYBRID) return true;
  if (businessUnit === MarketingBusinessUnit.LOCAL) {
    return LOCAL_CHANNELS.has(channel);
  }
  if (businessUnit === MarketingBusinessUnit.ECOMMERCE) {
    return ECOMMERCE_CHANNELS.has(channel);
  }
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 CreateMarketingBriefSchema — DTO insertion principale
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CreateMarketingBriefSchema = z
  .object({
    agent_id: z.string().min(1).max(100),
    business_unit: z.nativeEnum(MarketingBusinessUnit),
    channel: z.nativeEnum(MarketingChannel),
    conversion_goal: z.nativeEnum(MarketingConversionGoal),
    cta: z.string().min(1).max(500),
    target_segment: z.string().min(1).max(200),

    /** Payload : structure libre sauf si HYBRID (validé après). */
    payload: z.record(z.string(), z.unknown()),

    /** AEC coverage manifest obligatoire. */
    coverage_manifest: CoverageManifestSchema,

    /** Lien optionnel vers post social spécifique (FK __marketing_social_posts). */
    social_post_id: z.number().int().positive().optional(),

    /** Trace agent (cohérent __marketing_social_posts.ai_*). */
    ai_provider: z.string().optional(),
    ai_model: z.string().optional(),
    generation_prompt_hash: z.string().optional(),
  })
  // Refinement 1 : business_unit × channel cohérence
  .refine(
    (data) => isCoherentUnitChannel(data.business_unit, data.channel),
    (data) => ({
      message:
        `Channel '${data.channel}' incohérent avec business_unit '${data.business_unit}'. ` +
        `LOCAL=[gbp,local_landing,sms] ECOMMERCE=[website_seo,email,social_*] HYBRID=any.`,
      path: ['channel'],
    }),
  )
  // Refinement 2 : HYBRID payload obligatoire
  .refine(
    (data) => {
      if (data.business_unit !== MarketingBusinessUnit.HYBRID) return true;
      // Tente de parser le payload comme HybridPayload — si échec, refinement fail
      const result = HybridPayloadSchema.safeParse(data.payload);
      return result.success;
    },
    (data) => ({
      message:
        data.business_unit === MarketingBusinessUnit.HYBRID
          ? 'HYBRID exige payload avec hybrid_reason + cta_ecommerce + cta_local + ' +
            'conversion_goal_ecommerce + conversion_goal_local (ADR-036 §HYBRID)'
          : '',
      path: ['payload'],
    }),
  );

export type CreateMarketingBriefDto = z.infer<
  typeof CreateMarketingBriefSchema
>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔄 UpdateBriefStatusSchema — admin UI workflow
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const UpdateBriefStatusSchema = z.object({
  status: z.nativeEnum(MarketingBriefStatus),
  reviewed_by: z.string().optional(),
  approved_by: z.string().optional(),
});

export type UpdateBriefStatusDto = z.infer<typeof UpdateBriefStatusSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 RecordBriefFeedbackSchema — saisie métriques admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const RecordBriefFeedbackSchema = z.object({
  brief_id: z.string().uuid(),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  calls: z.number().int().min(0).optional(),
  visits: z.number().int().min(0).optional(),
  quotes: z.number().int().min(0).optional(),
  orders: z.number().int().min(0).optional(),
  revenue_cents: z.number().int().min(0).optional(),
  source: z.enum([
    'manual_admin',
    'ga4',
    'gbp_api',
    'mailjet',
    'twilio',
    'phone_tracker',
    'meta_pixel',
    'facebook_insights',
  ]),
});

export type RecordBriefFeedbackDto = z.infer<typeof RecordBriefFeedbackSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🛡️ Brand gate verdict (côté brand-compliance-gate.service)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BrandGateVerdictSchema = z.object({
  brand_gate_level: z.nativeEnum(MarketingGateLevel),
  compliance_gate_level: z.nativeEnum(MarketingGateLevel),
  gate_summary: z.record(z.string(), z.unknown()).optional(),
  /** Raison du verdict (ex: 'local_canon_unvalidated', 'forbidden_word', ...). */
  reason: z.string().optional(),
});

export type BrandGateVerdictDto = z.infer<typeof BrandGateVerdictSchema>;
