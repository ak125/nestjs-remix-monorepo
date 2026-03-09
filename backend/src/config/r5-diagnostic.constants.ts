/**
 * R5 Diagnostic constants — quality gates, flags, thresholds, surface routing.
 * Used by DiagnosticService.validateDiagnosticQuality() and diagnostic agents.
 *
 * Pattern: keyword-plan.constants.ts + conseil-pack.constants.ts
 */

// ── Bloc classification ─────────────────────────────────

export type R5BlocStatus =
  | 'required'
  | 'recommended'
  | 'forbidden_if_no_signal';

/**
 * 9 blocs du template R5, classifies par obligation.
 * 'forbidden_if_no_signal' = ne pas afficher si aucune donnee.
 */
export const R5_BLOC_CLASSIFICATION: Record<string, R5BlocStatus> = {
  urgency_banner: 'required',
  symptom_description: 'required',
  sign_description: 'required',
  dtc_codes: 'forbidden_if_no_signal',
  context: 'required',
  recommended_actions: 'required',
  differentiation_checklist: 'recommended',
  consultation_triggers: 'recommended',
  do_dont_list: 'recommended',
} as const;

// ── Strategic topics whitelist ──────────────────────────

/**
 * Seuls ces sujets sont autorises en R5.
 * Tout autre sujet doit prouver son autonomie.
 * Matching: slug doit COMMENCER par un de ces prefixes.
 */
export const R5_STRATEGIC_TOPICS = [
  'bruit-frein',
  'bruit-disque',
  'bruit-plaquette',
  'voyant-moteur',
  'voyant-abs',
  'voyant-airbag',
  'surchauffe',
  'fumee-blanche',
  'fumee-noire',
  'perte-puissance',
  'demarrage-difficile',
  'code-defaut',
  'dtc-',
] as const;

// ── Vehicle dependency signals ──────────────────────────

/**
 * Patterns indiquant que le contenu depend du vehicule.
 * Score: chaque match = +1. Score >= 2 = forte dependance → outil.
 * Case-insensitive, appliques sur titre + symptom_description + sign_description.
 */
export const R5_VEHICLE_DEPENDENCY_SIGNALS: RegExp[] = [
  /\b\d{3}\s*000\s*km\b/i,
  /\b\d{2,3}\s*k\s*km\b/i,
  /\bkilom[eè]trage\b/i,
  /\bdiesel\b/i,
  /\bessence\b/i,
  /\bhybride\b/i,
  /\b(hdi|tdi|dci|tdci|cdti|jtd|crdi)\b/i,
  /\bapr[eè]s (vidange|r[eé]paration|changement|remplacement|intervention)\b/i,
  /\bmon v[eé]hicule\b/i,
  /\bma voiture\b/i,
  /\bmod[eè]le\b/i,
  /\bann[eé]e\b/i,
  /\b(peugeot|renault|citro[eë]n|volkswagen|ford|opel|bmw|audi|mercedes|fiat|toyota|hyundai|kia|dacia|nissan|seat|skoda)\b/i,
  /\b(clio|megane|308|208|c3|c4|golf|polo|focus|corsa|fiesta)\b/i,
];

// ── Forbidden vocabulary (R3 = procedure) ───────────────

export const R5_FORBIDDEN_R3_TERMS = [
  'demontage',
  'demonter',
  'depose',
  'remontage',
  'remonter',
  'repose',
  'outils necessaires',
  'couple de serrage',
  'pas a pas',
  'pas-a-pas',
  'etape 1',
  'etape 2',
  'etape 3',
  "temps d'intervention",
  'niveau de difficulte',
  'procedure de remplacement',
  'comment remplacer',
  'comment changer',
  'tutoriel',
] as const;

// ── Forbidden vocabulary (R4 = encyclopedie) ────────────

export const R5_FORBIDDEN_R4_TERMS = [
  'definition',
  'par definition',
  'au sens strict',
  'se compose de',
  'compose de',
  'glossaire',
  'designe',
  'ne pas confondre avec',
  "qu'est-ce qu'un",
  "qu'est-ce que",
  'encyclopedie',
  'historiquement',
] as const;

// ── Generic phrase patterns ─────────────────────────────

/**
 * Regex detectant les phrases generiques / template.
 * Parallel a conseil-pack.constants.ts GENERIC_PHRASES.
 */
export const R5_GENERIC_PATTERNS: RegExp[] = [
  /n['']h[eé]sitez pas [aà] consulter/gi,
  /il est important de v[eé]rifier/gi,
  /pour am[eé]liorer la fiabilit[eé]/gi,
  /r[oô]le essentiel/gi,
  /bon fonctionnement/gi,
  /pi[eè]ce importante/gi,
  /large choix/gi,
  /qualit[eé] premium/gi,
  /il est recommand[eé]/gi,
  /pour (?:assurer|garantir) (?:la |le |un |une )?(?:s[eé]curit[eé]|confort|performance)/gi,
  /Un .+ anormal au niveau/gi,
  /entretien r[eé]gulier garantit/gi,
];

// ── Quality flags ───────────────────────────────────────

/**
 * Flags bloquants — empechent la publication.
 * 6 flags strictement bloquants des le depart.
 */
export const R5_BLOCKING_FLAGS = [
  'VAGUE_PROMISE',
  'R3_ANGLE_LEAK',
  'R4_ANGLE_LEAK',
  'MISSING_SAFETY_GATE',
  'MISSING_ACTIONS',
  'DTC_WITHOUT_CODES',
] as const;

/**
 * Flags warning — observes, certains promouvables en blocking apres calibrage.
 */
export const R5_WARNING_FLAGS = [
  'NOT_STRATEGIC_TOPIC',
  'VEHICLE_DEPENDENT',
  'GENERIC_PAGE',
  'NO_DIFFERENTIATION',
  'MISSING_RISK_LEVEL',
  'MISSING_GAMMES',
  'SHORT_SYMPTOM',
  'SHORT_SIGN',
  'NO_R3_LINK',
  'NO_R4_LINK',
  'META_LENGTH',
  'MISSING_COST_ESTIMATE',
  'MISSING_CONTEXT',
  'WEAK_VARIANT',
  'AFTER_REPAIR_TOPIC',
] as const;

export type R5BlockingFlag = (typeof R5_BLOCKING_FLAGS)[number];
export type R5WarningFlag = (typeof R5_WARNING_FLAGS)[number];
export type R5QualityFlag = R5BlockingFlag | R5WarningFlag;

/**
 * Flags promotables : WARNING → BLOCKING apres calibrage sur les 24 pages.
 */
export const R5_PROMOTABLE_FLAGS: R5WarningFlag[] = [
  'NOT_STRATEGIC_TOPIC',
  'VEHICLE_DEPENDENT',
  'GENERIC_PAGE',
  'NO_DIFFERENTIATION',
  'MISSING_RISK_LEVEL',
  'MISSING_GAMMES',
];

// ── Quality thresholds ──────────────────────────────────

export const R5_QUALITY_THRESHOLDS = {
  minSymptomLength: 200,
  minSignLength: 200,
  minMetaDescLength: 140,
  maxMetaDescLength: 160,
  minActionsCount: 1,
  minGammesCount: 1,
  maxGenericRatio: 0.05,
  maxR3TermCount: 0,
  maxR4TermCount: 0,
  vehicleDependencyBlockingScore: 2,
  weakVariantJaccardThreshold: 0.7,
} as const;

// ── Surface routing rules (double filter) ───────────────

export type IntentDominant =
  | 'agir'
  | 'comprendre'
  | 'personnaliser'
  | 'orienter';
export type VehicleDependency = 'low' | 'medium' | 'high';
export type SurfaceTarget = 'R3' | 'R4' | 'R5' | 'TOOL';

export interface SurfaceRoutingResult {
  surface: SurfaceTarget;
  confidence: number;
  reason: string;
}

/**
 * Matrice de routage : intention × dependance vehicule → surface.
 */
export const SURFACE_ROUTING_MATRIX: Record<
  IntentDominant,
  Record<VehicleDependency, SurfaceTarget>
> = {
  agir: { low: 'R3', medium: 'R3', high: 'TOOL' },
  comprendre: { low: 'R4', medium: 'R4', high: 'TOOL' },
  personnaliser: { low: 'TOOL', medium: 'TOOL', high: 'TOOL' },
  orienter: { low: 'R5', medium: 'R5', high: 'TOOL' },
} as const;

// ── After-repair detection ──────────────────────────────

export const R5_AFTER_REPAIR_PATTERNS: RegExp[] = [
  /apr[eè]s (changement|remplacement|r[eé]paration|intervention|montage|vidange)/gi,
  /toujours pr[eé]sent apr[eè]s/gi,
  /persiste apr[eè]s/gi,
  /revenu apr[eè]s/gi,
  /probl[eè]me apr[eè]s/gi,
];
