/**
 * R5PageContract Zod Schema — contrat formel pour les pages R5 Diagnostic.
 * Self-contained avec imports constants R5.
 * 9 blocs, safety gates, observable types, anti-cannibalisation R3/R4.
 *
 * INTERDIT R5 : tout contenu procedural (R3), encyclopedique (R4), commercial (R1/R6).
 */

import { z } from 'zod';
import type { PageRole } from './page-contract-shared.constants';
import {
  R5_BLOC_CLASSIFICATION,
  R5_BLOCKING_FLAGS,
  R5_WARNING_FLAGS,
} from './r5-diagnostic.constants';

// ── Enums ────────────────────────────────────────────────

const ObservableType = z.enum(['symptom', 'sign', 'dtc']);
const PerceptionChannel = z.enum([
  'auditory',
  'visual',
  'tactile',
  'olfactory',
  'electronic',
]);
const RiskLevel = z.enum(['confort', 'securite', 'critique']);
const SafetyGate = z.enum(['none', 'warning', 'stop_soon', 'stop_immediate']);
const ContextFrequency = z.enum([
  'intermittent',
  'permanent',
  'progressif',
  'sporadique',
]);

// ── Recommended action ──────────────────────────────────

const RecommendedAction = z.object({
  action: z.string().min(10).max(200),
  urgency: z.enum(['immediate', 'soon', 'routine']),
  skill_level: z.enum(['DIY', 'intermediate', 'professional']),
  duration: z.string().max(30).optional(),
});

// ── Sidebar links ───────────────────────────────────────

const SidebarLink = z.object({
  label: z.string().min(3).max(80),
  href: z.string().startsWith('/'),
  target_role: z.enum(['R1_ROUTER', 'R3_GUIDE', 'R4_REFERENCE']),
});

// ── Bloc classification (derived from constants) ────────

const BlocId = z.enum(
  Object.keys(R5_BLOC_CLASSIFICATION) as [string, ...string[]],
);

// ── Quality flag ────────────────────────────────────────

const QualityFlag = z.object({
  flag: z.enum([...R5_BLOCKING_FLAGS, ...R5_WARNING_FLAGS]),
  severity: z.enum(['blocking', 'warning']),
  message: z.string().min(5),
});

// ══════════════════════════════════════════════════════════
// R5 Page Contract (top-level)
// ══════════════════════════════════════════════════════════

export const PageContractR5Schema = z.object({
  // ── Identity ──────────────────────────────────────────
  page_role: z.literal('R5_DIAGNOSTIC' satisfies PageRole),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/),
  cluster_id: z.string().min(3),

  // ── SEO ───────────────────────────────────────────────
  title: z.string().min(40).max(70),
  meta_description: z.string().min(140).max(160),
  schema_org: z
    .array(z.enum(['HowTo', 'FAQPage', 'BreadcrumbList']))
    .default(['HowTo', 'FAQPage', 'BreadcrumbList']),

  // ── Observable classification ─────────────────────────
  observable_type: ObservableType,
  perception_channel: PerceptionChannel,
  risk_level: RiskLevel,
  safety_gate: SafetyGate,

  // ── Context ───────────────────────────────────────────
  ctx_phase: z.array(z.string().min(3)).optional(),
  ctx_temp: z.array(z.enum(['froid', 'chaud'])).optional(),
  ctx_freq: ContextFrequency.optional(),

  // ── Content blocs ─────────────────────────────────────
  symptom_description: z.string().min(200),
  sign_description: z.string().min(200),
  dtc_codes: z.array(z.string().regex(/^[PBCU]\d{4}$/)).optional(),
  dtc_descriptions: z.record(z.string(), z.string().min(10)).optional(),
  recommended_actions: z.array(RecommendedAction).min(1),

  // ── Phase 2 blocs (optional until implemented) ────────
  differentiation_checklist: z
    .array(
      z.object({
        condition: z.string().min(5),
        cause_probable: z.string().min(5),
      }),
    )
    .optional(),
  consultation_triggers: z
    .object({
      drive_risk: z.enum(['safe', 'caution', 'stop']),
      diy_allowed: z.boolean(),
      pro_inspection: z.boolean(),
      delay: z.string().max(50).optional(),
    })
    .optional(),
  do_dont_list: z
    .object({
      do: z.array(z.string().min(5)).min(3).max(5),
      dont: z.array(z.string().min(5)).min(3).max(5),
    })
    .optional(),

  // ── Repair estimation ─────────────────────────────────
  estimated_repair_cost_min: z.number().int().positive().optional(),
  estimated_repair_cost_max: z.number().int().positive().optional(),
  estimated_repair_duration: z.string().max(30).optional(),

  // ── Maillage ──────────────────────────────────────────
  related_gammes: z.array(z.number().int().positive()).min(1),
  related_references: z.array(z.string()).optional(),
  related_blog_articles: z.array(z.string()).optional(),
  sidebar_links: z.array(SidebarLink).optional(),

  // ── Blocs present/absent ──────────────────────────────
  blocs_present: z.array(BlocId).min(4),

  // ── Quality ───────────────────────────────────────────
  quality_flags: z.array(QualityFlag).optional(),
  quality_score: z.number().int().min(0).max(100).optional(),
  is_published: z.boolean().default(false),

  // ── Anti-cannibalisation ──────────────────────────────
  forbidden: z
    .object({
      r3_terms_matched: z.array(z.string()).default([]),
      r4_terms_matched: z.array(z.string()).default([]),
      generic_patterns_matched: z.array(z.string()).default([]),
      vehicle_dependency_score: z.number().int().min(0).default(0),
    })
    .optional(),
});

export type PageContractR5 = z.infer<typeof PageContractR5Schema>;

// ── Partial schema (intermediate pipeline phases) ────────

export const PageContractR5PartialSchema = PageContractR5Schema.partial();
export type PageContractR5Partial = z.infer<typeof PageContractR5PartialSchema>;
