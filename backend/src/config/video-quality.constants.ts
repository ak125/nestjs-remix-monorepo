/**
 * Constantes de qualite pour le systeme video Media Factory.
 *
 * Source unique (Single Source of Truth) utilisee par :
 *  - VideoGatesService      (media-factory/services)
 *  - Video pipeline worker  (P1, a venir)
 *
 * Pattern identique a buying-guide-quality.constants.ts
 * NE PAS dupliquer ces constantes dans d'autres fichiers.
 */

// ─────────────────────────────────────────────────────────────
// Video types & modes
// ─────────────────────────────────────────────────────────────

export type VideoType = 'film_socle' | 'film_gamme' | 'short';

export type VideoMode = 'socle' | 'gamme' | 'short';

export type VideoStatus =
  | 'draft'
  | 'pending_review'
  | 'script_approved'
  | 'storyboard'
  | 'rendering'
  | 'qa'
  | 'qa_failed'
  | 'ready_for_publish'
  | 'published'
  | 'archived';

export type VisualType =
  | 'schema'
  | 'animation'
  | 'macro'
  | 'motion_text'
  | 'ambiance'
  | 'photo_reelle';

export type TruthDependency = 'illustration' | 'proof' | 'reference';

export type Platform =
  | 'youtube_long'
  | 'youtube_short'
  | 'instagram_reel'
  | 'tiktok'
  | 'linkedin';

// ─────────────────────────────────────────────────────────────
// Gate names & verdicts
// ─────────────────────────────────────────────────────────────

export type VideoGateName =
  | 'truth'
  | 'safety'
  | 'brand'
  | 'platform'
  | 'reuse_risk'
  | 'visual_role'
  | 'final_qa';

export type GateVerdict = 'PASS' | 'WARN' | 'FAIL';

// ─────────────────────────────────────────────────────────────
// Gate thresholds (SSOT)
// ─────────────────────────────────────────────────────────────

export const VIDEO_GATE_THRESHOLDS = {
  /** G1 Truth: ratio of unsourced claims */
  truth_attribution: { warn: 0.15, fail: 0.3 },
  /** G2 Safety: count of unvalidated procedure/safety claims — STRICT */
  safety_unvalidated: { warn: 0, fail: 1 },
  /** G3 Brand: count of brand voice violations */
  brand_violations: { warn: 1, fail: 3 },
  /** G4 Platform: duration tolerance ratio (±10%) */
  platform_duration_tolerance: 0.1,
  /** G5 Reuse: script similarity score (cosine) */
  reuse_similarity: { warn: 0.5, fail: 0.7 },
  /** G6 Visual Role: count of visuals used as proof — STRICT */
  visual_role_violations: { warn: 0, fail: 1 },
} as const;

// ─────────────────────────────────────────────────────────────
// Duration constraints by video type (seconds)
// ─────────────────────────────────────────────────────────────

export const VIDEO_DURATION_RANGES: Record<
  VideoType,
  { min: number; max: number }
> = {
  film_socle: { min: 420, max: 540 }, // 7-9 min
  film_gamme: { min: 180, max: 360 }, // 3-6 min
  short: { min: 15, max: 60 }, // 15s-60s
};

// ─────────────────────────────────────────────────────────────
// Mode constraints (what's allowed/forbidden per mode)
// ─────────────────────────────────────────────────────────────

export interface ModeConstraints {
  allowCTA: boolean;
  allowPromo: boolean;
  allowPricing: boolean;
  maxClaimsPerSequence: number;
  requireDisclaimer: boolean;
  narrativeStyle: 'documentary' | 'educational' | 'hook_first';
}

export const MODE_CONSTRAINTS: Record<VideoMode, ModeConstraints> = {
  socle: {
    allowCTA: false,
    allowPromo: false,
    allowPricing: false,
    maxClaimsPerSequence: 1,
    requireDisclaimer: true,
    narrativeStyle: 'documentary',
  },
  gamme: {
    allowCTA: false,
    allowPromo: false,
    allowPricing: false,
    maxClaimsPerSequence: 2,
    requireDisclaimer: true,
    narrativeStyle: 'educational',
  },
  short: {
    allowCTA: false,
    allowPromo: false,
    allowPricing: false,
    maxClaimsPerSequence: 1,
    requireDisclaimer: false, // overlay disclaimer suffisant
    narrativeStyle: 'hook_first',
  },
};

// ─────────────────────────────────────────────────────────────
// Claim kinds (extends RAG pipeline kinds with video-specific)
// ─────────────────────────────────────────────────────────────

export type VideoClaimKind =
  | 'mileage'
  | 'dimension'
  | 'percentage'
  | 'norm'
  | 'procedure' // geste technique — validation humaine obligatoire
  | 'safety'; // recommandation securite — disclaimer requis

// ─────────────────────────────────────────────────────────────
// Disclaimer types
// ─────────────────────────────────────────────────────────────

export type DisclaimerType =
  | 'pedagogique'
  | 'securite'
  | 'illustration_ia'
  | 'diagnostic';

export type DisclaimerPosition =
  | 'intro'
  | 'before_procedure'
  | 'overlay'
  | 'outro';

// ─────────────────────────────────────────────────────────────
// Approval stages
// ─────────────────────────────────────────────────────────────

export type ApprovalStage =
  | 'script_text'
  | 'storyboard'
  | 'render_preview'
  | 'final_publish';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// ─────────────────────────────────────────────────────────────
// Quality flags (video-specific, score = 100 - sum of penalties)
// ─────────────────────────────────────────────────────────────

export type VideoQualityFlag =
  | 'UNSOURCED_CLAIMS'
  | 'MISSING_DISCLAIMER'
  | 'DURATION_OUT_OF_RANGE'
  | 'CTA_IN_SOCLE'
  | 'PROMO_IN_EDUCATIONAL'
  | 'VISUAL_AS_PROOF'
  | 'MISSING_EVIDENCE_PACK'
  | 'MISSING_CLAIM_TABLE'
  | 'INCOMPLETE_APPROVAL'
  | 'REUSED_CONTENT';

export const VIDEO_FLAG_PENALTIES: Record<VideoQualityFlag, number> = {
  UNSOURCED_CLAIMS: 25,
  MISSING_DISCLAIMER: 15,
  DURATION_OUT_OF_RANGE: 10,
  CTA_IN_SOCLE: 30,
  PROMO_IN_EDUCATIONAL: 20,
  VISUAL_AS_PROOF: 30,
  MISSING_EVIDENCE_PACK: 20,
  MISSING_CLAIM_TABLE: 20,
  INCOMPLETE_APPROVAL: 15,
  REUSED_CONTENT: 10,
};

// ─────────────────────────────────────────────────────────────
// Visual role matrix (authorized / forbidden)
// ─────────────────────────────────────────────────────────────

/** Visuals that can be used as illustration (never as proof) */
export const VISUAL_ALLOWED_AS_ILLUSTRATION: readonly VisualType[] = [
  'schema',
  'animation',
  'macro',
  'motion_text',
  'ambiance',
] as const;

/** Visuals that require truth_dependency = 'proof' validation */
export const VISUAL_REQUIRES_VALIDATION: readonly VisualType[] = [
  'photo_reelle',
] as const;

// ─────────────────────────────────────────────────────────────
// Forbidden patterns per mode (for brand gate)
// ─────────────────────────────────────────────────────────────

export const FORBIDDEN_PATTERNS_SOCLE: readonly RegExp[] = [
  /\bachetez?\b/i,
  /\bcommandez?\b/i,
  /\bpromotion\b/i,
  /\bprix\b/i,
  /\b(pas cher|meilleur prix)\b/i,
  /\blivraison\b/i,
  /\ben stock\b/i,
  /\boffre\b/i,
  /\bremise\b/i,
  /\bcode promo\b/i,
] as const;

export const FORBIDDEN_PATTERNS_SHORT: readonly RegExp[] = [
  ...FORBIDDEN_PATTERNS_SOCLE,
  /\burgent\b/i,
  /\bdepêchez/i,
  /\bne ratez pas\b/i,
  /\bdernier(e|s)?\s+(chance|jour)/i,
] as const;

// ─────────────────────────────────────────────────────────────
// Render engine timeout (P4.0)
// ─────────────────────────────────────────────────────────────

/** Max time in ms to wait for engine.render() before aborting */
export const RENDER_TIMEOUT_MS = parseInt(
  process.env.VIDEO_RENDER_TIMEOUT_MS || '120000',
  10,
);

// ─────────────────────────────────────────────────────────────
// Canary render engine defaults (P5)
// ─────────────────────────────────────────────────────────────

/** Default max canary executions per UTC day */
export const CANARY_QUOTA_PER_DAY_DEFAULT = 10;

/** Default timeout for canary engine (ms) */
export const CANARY_ENGINE_TIMEOUT_MS_DEFAULT = 120_000;
