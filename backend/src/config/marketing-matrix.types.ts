/**
 * Marketing Matrix Types — single-source view over marketing agents + invariants.
 *
 * Pattern miroir de operating-matrix.types.ts mais scope distinct :
 *   - OperatingMatrix = SEO Agent Matrix (R0-R8 + FIELD_CATALOG)
 *   - MarketingMatrix = Marketing Agent Matrix (LEAD/LOCAL/RETENTION + business_unit)
 *
 * Décision pivot vs plan rev 8 §"OperatingMatrix étendu" : services séparés
 * (séparation des concerns, snapshot JSON SEO inchangé). Cf ADR-036 §"OperatingMatrixService étendu"
 * — l'extension nominale passe par 2 services parallèles, le pattern reste celui d'ADR-025.
 *
 * Source vérité invariants : ADR-036 + rules-marketing-voice.md (canon vault).
 */

/** Les 3 unités business — ECOMMERCE national, LOCAL magasin 93, HYBRID smart routing. */
export enum MarketingBusinessUnit {
  ECOMMERCE = 'ECOMMERCE',
  LOCAL = 'LOCAL',
  HYBRID = 'HYBRID',
}

/** Liste fermée des channels autorisés (cohérent CHECK SQL `__marketing_brief.channel`). */
export enum MarketingChannel {
  GBP = 'gbp',
  LOCAL_LANDING = 'local_landing',
  WEBSITE_SEO = 'website_seo',
  EMAIL = 'email',
  SMS = 'sms',
  SOCIAL_FACEBOOK = 'social_facebook',
  SOCIAL_INSTAGRAM = 'social_instagram',
  SOCIAL_YOUTUBE = 'social_youtube',
}

/** Conversion goal — chaque brief DOIT en avoir un (NOT NULL CHECK). */
export enum MarketingConversionGoal {
  CALL = 'CALL',
  VISIT = 'VISIT',
  QUOTE = 'QUOTE',
  ORDER = 'ORDER',
}

/** Verdicts brand-compliance-gate (cohérent __marketing_social_posts.brand_gate_level). */
export enum MarketingGateLevel {
  PASS = 'PASS',
  WARN = 'WARN',
  FAIL = 'FAIL',
}

/**
 * Marketing canonical agent IDs (ADR-038, étend ADR-037 au scope marketing).
 *
 * Source de vérité du mapping fichier agent → identité canonique : le frontmatter
 * `role:` (validé Zod, fail-fast au boot via MarketingMatrixService).
 *
 * Phase 1-2 ADR-036 = 3 agents. Étendre cet enum si Phase 3+ ajoute de nouveaux
 * agents canoniques (chaque ajout = ADR ou amendement explicite).
 */
export enum MarketingRoleId {
  MARKETING_LEAD = 'MARKETING_LEAD',
  LOCAL_BUSINESS = 'LOCAL_BUSINESS',
  CUSTOMER_RETENTION = 'CUSTOMER_RETENTION',
}

/** All marketing role IDs as an array (Zod enum + iteration). */
export const MARKETING_ROLE_ID_LIST: MarketingRoleId[] =
  Object.values(MarketingRoleId);

/**
 * Invariants requis pour qu'un brief soit valide.
 * Sans ces 4 vérifications, le brief est rejeté en amont (DTO Zod ou CHECK SQL).
 *
 * Ordre stable (alphabétique) pour snapshot deterministic.
 */
export type MarketingInvariantKey =
  | 'aec_manifest'
  | 'brand_compliance_gate'
  | 'business_unit_defined'
  | 'conversion_goal_defined';

export interface MarketingInvariant {
  /** Liste des vérifications obligatoires (alpha-sorted). */
  requires: ReadonlyArray<MarketingInvariantKey>;
  /** Sous-domaines couverts par ces invariants. */
  subdomains: ReadonlyArray<MarketingBusinessUnit>;
}

/** Entrée d'agent marketing détecté dans workspaces/marketing/.claude/agents/. */
export interface MarketingAgentEntry {
  /** Nom du fichier sans extension (ex: 'local-business-agent'). */
  name: string;
  /** Présent dans le filesystem ? */
  present: boolean;
  /**
   * RoleId canonique résolu via frontmatter `role:` (ADR-038).
   * `null` si l'agent est attendu mais absent du filesystem.
   * Si un fichier existe mais avec un frontmatter invalide, il n'apparaît PAS
   * dans `agents[]` — l'erreur est surfacée en `parseErrors[]`.
   */
  role: MarketingRoleId | null;
  /** Business units où cet agent est autorisé à exécuter (déclaré en frontmatter). */
  scope: ReadonlyArray<MarketingBusinessUnit>;
}

/**
 * Erreur de parsing frontmatter d'un agent (ADR-038, fail-fast).
 * Surfaced as `level: 'error'` dans formatBootLog() pour bloquer le boot
 * du MarketingModule si un agent est mal frontmatté.
 */
export interface MarketingAgentParseError {
  /** Path relatif depuis repoRoot (`workspaces/marketing/.claude/agents/<file>.md`). */
  path: string;
  /** Filename basename (ex: 'local-business-agent.md'). */
  file: string;
  /** Message d'erreur agrégé (Zod issues join, ENOENT, YAML parse, etc.). */
  message: string;
}

/** Hash des fichiers source pour reproductibilité snapshot. */
export interface MarketingMatrixSourcesHash {
  /** Hash de `marketing-matrix.types.ts` lui-même (référence stable). */
  matrixTypes: string;
  /** Hash de `.claude/canon-mirrors/marketing-voice.md` (canon distribué via canon-publish). */
  marketingVoiceCanon: string;
}

/** Snapshot complet de la matrice marketing à un instant T. */
export interface MarketingMatrix {
  /** Version du contrat. Bump majeur = breaking change downstream. */
  version: '1.0.0';
  /** Module identifier (constant — pour cohérence cross-matrix). */
  module: 'MARKETING';
  /** Hashes pour reproductibilité. */
  sourcesHash: MarketingMatrixSourcesHash;
  /** Invariants requires + subdomains. */
  invariant: MarketingInvariant;
  /** Channels autorisés (alpha-sorted). */
  channels: ReadonlyArray<MarketingChannel>;
  /** Goals autorisés (alpha-sorted). */
  conversionGoals: ReadonlyArray<MarketingConversionGoal>;
  /** Niveaux brand_gate (alpha-sorted). */
  gateLevels: ReadonlyArray<MarketingGateLevel>;
  /** Agents Phase 1-2 attendus (canon ADR-036). */
  agentsExpected: ReadonlyArray<string>;
  /** Agents effectivement détectés au scan filesystem (frontmatter validé Zod). */
  agents: ReadonlyArray<MarketingAgentEntry>;
  /** Le scan filesystem a-t-il été skippé (ex: production) ? */
  agentScanSkipped: boolean;
  /** Raison du skip si applicable. */
  agentScanSkipReason?: 'production_default' | 'no_paths_found';
  /** Path scanné réellement (debug). Omitted from canonical JSON for determinism. */
  agentScanRootsFound?: ReadonlyArray<string>;
}
