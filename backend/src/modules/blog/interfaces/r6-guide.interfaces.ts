import { z } from 'zod';

/**
 * R6 Guide d'Achat interfaces V2.
 * Typed payload served by R6GuideService from __seo_gamme_purchase_guide.
 *
 * Dual-mode: V1 legacy fields (optional) + V2 buying-guide fields (optional).
 * roleVersion tells the frontend which set to render.
 */

// ══════════════════════════════════════════════════════════
// V1 legacy interfaces (kept for backward compat)
// ══════════════════════════════════════════════════════════

export interface R6FaqItem {
  question: string;
  answer: string;
}

export interface R6SelectionCriterion {
  key: string;
  label: string;
  guidance: string;
  priority: 'required' | 'recommended' | 'optional';
}

export interface R6DecisionNode {
  id: string;
  question: string;
  options: Array<{
    label: string;
    outcome: string;
  }>;
}

export interface R6UseCase {
  id: string;
  label: string;
  recommendation: string;
}

export interface R6InterestNugget {
  hook: string;
  angle: string;
  rag_source: string;
}

export interface R6RiskSection {
  title: string;
  explanation: string;
  consequences: string[];
  costRange: string | null;
  conclusion: string | null;
}

export interface R6TimingSection {
  title: string;
  years: string | null;
  km: string | null;
  note: string | null;
}

export interface R6Argument {
  title: string;
  content: string;
  icon: string | null;
}

// ══════════════════════════════════════════════════════════
// V2 buying-guide interfaces
// ══════════════════════════════════════════════════════════

/** Runtime contract for comparison tiers; V1 compatibility criteria do not satisfy it. */
export const R6QualityTierSchema = z.object({
  tier_id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  target_profile: z.string().optional(),
  price_hint: z.string().optional(),
  available: z.boolean(),
});

export type R6QualityTier = z.infer<typeof R6QualityTierSchema>;

export interface R6CompatibilityAxis {
  axis: string;
  where_to_find: string;
  risk_if_wrong: string;
}

export interface R6BrandEntry {
  name: string;
  speciality?: string;
}

export interface R6QualitySignal {
  signal: string;
  why_it_matters: string;
}

export interface R6WhenProCase {
  situation: string;
  why_pro: string;
  keywords?: string[];
}

export interface R6PriceGuideTier {
  label: string;
  range_hint: string;
  target_profile: string;
  safe_wording: string;
}

export interface R6HeroDecision {
  promise: string;
  bullets: string[];
  cta_label?: string;
  cta_href?: string;
}

export interface R6PriceGuideSection {
  mode: 'ranges' | 'factors';
  tiers?: R6PriceGuideTier[];
  variation_factors?: string[];
  disclaimer: string;
}

export interface R6BrandsGuideSection {
  recognized_brands?: R6BrandEntry[];
  quality_signals: R6QualitySignal[];
  alert_signs: string[];
}

export interface R6CtaFinal {
  links: Array<{ label: string; href: string; target_role: string }>;
  internal_links?: Array<{
    anchor_text: string;
    href: string;
    target_role: string;
  }>;
}

// ══════════════════════════════════════════════════════════
// Media slots (from sgpg_page_contract)
// ══════════════════════════════════════════════════════════

export interface R6MediaSlotFrontend {
  slot_id: string;
  type:
    | 'image'
    | 'diagram'
    | 'table'
    | 'checklist'
    | 'callout'
    | 'cards'
    | 'quote';
  placement: string;
  priority: 'high' | 'normal' | 'low';
  source: string;
  src?: string;
  src_key?: string;
  alt: { template: string; variables?: Record<string, string> };
  caption?: { template: string; variables?: Record<string, string> };
  loading: 'eager' | 'lazy';
  fetch_priority?: 'high' | 'auto' | 'low';
  width?: number;
  height?: number;
  callout_style?: 'info' | 'warning' | 'tip' | 'budget';
  content_hint?: string;
  format?: 'webp' | 'avif';
}

// ══════════════════════════════════════════════════════════
// Page metadata (shared V1/V2)
// ══════════════════════════════════════════════════════════

export interface R6GuidePage {
  pg_alias: string;
  pg_id: number;
  title: string;
  heroSubtitle: string | null;
  metaTitle: string;
  metaDescription: string;
  featuredImage: string | null;
  updatedAt: string;
  readingTime: number;
}

// ══════════════════════════════════════════════════════════
// Top-level payload (dual-mode V1/V2)
// ══════════════════════════════════════════════════════════

export interface R6GuidePayload {
  // ── Intent & role (always present) ─────────────────────
  intentType: 'R6';
  pageRole: 'R6_BUYING_GUIDE';
  canonicalRoleUrl: string;
  roleVersion: 'v1' | 'v2';

  // ── Page metadata (always present) ─────────────────────
  page: R6GuidePage;

  // ── V2 buying-guide sections ───────────────────────────
  heroDecision?: R6HeroDecision;
  summaryPickFast?: R6DecisionNode[];
  qualityTiers?: R6QualityTier[];
  /** Missing/invalid comparison data; keep the section explicit without invented tiers. */
  qualityTiersReviewRequired?: boolean;
  compatibilityAxes?: R6CompatibilityAxis[];
  priceGuide?: R6PriceGuideSection;
  brandsGuide?: R6BrandsGuideSection;
  pitfalls?: string[];
  whenPro?: R6WhenProCase[];
  faq: R6FaqItem[];
  ctaFinal?: R6CtaFinal;
  mediaSlots?: Record<string, R6MediaSlotFrontend[]>;

  // ── V1 legacy sections (optional, present when roleVersion='v1') ──
  risk?: R6RiskSection;
  timing?: R6TimingSection;
  arguments?: R6Argument[];
  howToChoose?: string | null;
  symptoms?: string[];
  selectionCriteria?: R6SelectionCriterion[];
  decisionTree?: R6DecisionNode[];
  useCases?: R6UseCase[];
  antiMistakes?: string[];
  interestNuggets?: R6InterestNugget[];
  selectorMicrocopy?: string[];
  compatibilitiesIntro?: string | null;
  equipementiersLine?: string | null;
  familyCrossSellIntro?: string | null;
  microSeoBlock?: string | null;

  // ── Cross-links (anti-cannibalization R3↔R6) ──────────
  crossLinks?: {
    r3Url: string;
    r3Label: string;
  };

  // ── Source tracking ────────────────────────────────────
  sourceType: string | null;
  sourceVerified: boolean;
}
