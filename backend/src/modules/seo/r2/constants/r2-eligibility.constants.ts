/**
 * ADR-066 — R2 Eligibility constants (single source of truth)
 *
 * Threshold + weights utilisés par R2EligibilityService (Gate 1 du pipeline R2 v2).
 * Cf MEMORY feedback_seo_eligibility_gate_before_generation.
 *
 * Échelle unique 0-100 dans tout le code + DB. Jamais 0.45 / 0.35 (échelle [0,1])
 * dans une partie du code et 45 / 35 dans une autre.
 *
 * THRESHOLD_V1 = 45 est la valeur initiale, à confirmer/ajuster empiriquement
 * par le calibration script (scripts/audit/r2-eligibility-calibration.ts) sur
 * N=200 pairs stratified AVANT merge PR 1. Cf MEMORY feedback expert improvement E.
 *
 * Discipline canon : ces constantes restent en TS testable (jamais en Rego).
 * Rego enforce seulement la range [0,100] comme invariant.
 */

// ── Threshold pilote V1 (à calibrer empiriquement, ne pas inventer) ────────────

/**
 * Score minimum pour passer le gate eligibility (échelle 0-100).
 *
 * - eligibilityScore >= THRESHOLD_V1 → continue pipeline (compose + diversity + gate)
 * - eligibilityScore < THRESHOLD_V1  → SUPPRESSED (si sibling INDEX fiable) ou REJECT
 *
 * Valeur initiale 45 sera ajustée empiriquement post-calibration script.
 * Stratified sample N=200 (50 G1 universelles + 50 G1 spécifiques + 50 G2
 * + 50 edge cases TecDoc remap 60K-83456).
 */
export const THRESHOLD_V1 = 45;

// ── Weights pour eligibilityScore composite ─────────────────────────────────────

/**
 * Weights pondérés des 4 sous-scores :
 *
 *   eligibilityScore = 0.35×motorDelta + 0.35×compatDelta
 *                    + 0.20×commercialDistinctiveness + 0.10×crawlValue
 *
 * Les 2 deltas mécanique + catalogue dominent (0.70) car ce sont les vrais
 * discriminants SEO transactionnel (cf MEMORY feedback_seo_eligibility_gate_before_generation).
 *
 * À calibrer empiriquement avec le même script (sensitivity analysis).
 */
export const ELIGIBILITY_WEIGHTS = {
  motor: 0.35,
  compat: 0.35,
  commercial: 0.2,
  crawl: 0.1,
} as const;

// ── Weights pour commercialDistinctivenessScore ─────────────────────────────────

/**
 * Sous-pondération à l'intérieur du commercialDistinctivenessScore :
 *
 *   commercialDistinctiveness = 0.30×Δfamilles + 0.25×Δ OEM
 *                              + 0.20×Δ équipementiers + 0.15×Δ prix médian
 *                              + 0.10×Δ compatibilité
 *
 * Famille produit dominante car c'est le signal structurel le plus stable
 * (cf MEMORY feedback_seo_catalog_signature_before_text_diversity).
 */
export const COMMERCIAL_DISTINCTIVENESS_WEIGHTS = {
  families: 0.3,
  oem: 0.25,
  suppliers: 0.2,
  medianPrice: 0.15,
  compat: 0.1,
} as const;

// ── Diversity thresholds (gate 3) ───────────────────────────────────────────────

/**
 * catalog_overlap_score Jaccard threshold for early-decision SUPPRESSED/REJECT.
 *
 * > 0.92 = same catalogue signature (sorted OEM + subgroups + family_counts).
 * → SUPPRESSED si sibling INDEX fiable, REJECT sinon (canonical-first).
 *
 * Cf MEMORY feedback_seo_catalog_signature_before_text_diversity.
 */
export const CATALOG_OVERLAP_THRESHOLD = 0.92;

/**
 * LSH MinHash Jaccard threshold pour trigger l'embedding cosine check.
 *
 * Pré-filtre rapide : si Jaccard ≥ 0.65, on engage le cosine pgvector
 * (sinon économie embedding API call).
 */
export const LSH_JACCARD_THRESHOLD = 0.65;

/**
 * Embedding cosine threshold pour duplicate semantique.
 *
 * Cosine <= 0.80 = considéré comme distinct. Au-dessus → flag REVIEW_REQUIRED
 * (pas reject direct, governance gate décide).
 */
export const EMBEDDING_COSINE_THRESHOLD = 0.8;

// ── Forbidden commercial signals (S_REASSURANCE only) ───────────────────────────

/**
 * Tokens commerciaux confinés à la section S_REASSURANCE.
 *
 * Hors S_REASSURANCE = deny par OPA Rego policy r2-content-write.rego.
 * Cf user revue 2026-05-15 sur plan R2 v2 + ADR-066.
 *
 * Détection case-insensitive.
 */
export const FORBIDDEN_COMMERCIAL_SIGNALS = [
  'prix',
  'promo',
  'stock',
  'panier',
  'livraison',
  'ajouter au panier',
] as const;

/**
 * Section exclusive autorisée à porter les signaux commerciaux ci-dessus.
 */
export const COMMERCIAL_SIGNALS_ALLOWED_SECTION = 'S_REASSURANCE' as const;

// ── Retry policy ────────────────────────────────────────────────────────────────

/**
 * Nombre max de regenerate retries avant escalade REVIEW_REQUIRED.
 */
export const MAX_RETRIES = 2;

// ── Feature flag ────────────────────────────────────────────────────────────────

/**
 * Env var contrôle global pipeline R2 v2.
 *
 * Default OFF. Toggle admin via POST /api/admin/seo/r2/feature-flag.
 * Sert de kill-switch immédiat sans redeploy (improvement self-review D).
 */
export const FEATURE_FLAG_ENV_VAR = 'R2_V2_ENABLED' as const;
export const FEATURE_FLAG_REDIS_KEY = 'r2:v2:enabled' as const;
