/**
 * RoleContract pour R3_CONSEILS (blog/conseils HowTo + diagnostic S2_DIAG).
 *
 * Sources : ConseilEnricherService canon gates (CanonGate + QualityGate)
 * + ADR-027 R5 consolidation into R3 S2_DIAG + ADR-033 diagnostic_relations.
 *
 * Note : R3 est le seul rôle avec pipeline 2-gates fail-closed déjà robuste
 * en MVP-0. Pas besoin d'instrumenter Sentry au niveau enricher (pas de
 * top-level catch sur enrichSingle), les sub-catches sont warn-level.
 *
 * Implémente ADR-046 + ADR-047 + ADR-027 + ADR-033.
 */

import { RoleId } from '@repo/seo-roles';
import type { RoleContract } from '../schema';

export const R3_CONSEILS_CONTRACT: RoleContract = {
  id: RoleId.R3_CONSEILS,

  // IDs alignés sur SECTION_TYPES backend (conseil-enricher.service.ts:36-48).
  // Ne pas inventer — extension via ADR-047 si nouvelles sections.
  allowed_sections: [
    { id: 'S1', min_chars: 200, max_chars: 800, required: true },           // Fonction
    { id: 'S2', min_chars: 200, max_chars: 800, required: true },           // Quand changer
    { id: 'S2_DIAG', min_chars: 400, max_chars: 2000, required: true },     // Diagnostic (ADR-027 replace R5)
    { id: 'S3', min_chars: 300, max_chars: 1500, required: true },          // Comment choisir
    { id: 'S4_DEPOSE', min_chars: 300, max_chars: 1500, required: false },  // Démontage
    { id: 'S4_REPOSE', min_chars: 300, max_chars: 1500, required: false },  // Remontage
    { id: 'S5', min_chars: 300, max_chars: 1500, required: false },         // Erreurs à éviter
    { id: 'S6', min_chars: 100, max_chars: 600, required: false },          // Vérification finale
    { id: 'S_GARAGE', min_chars: 100, max_chars: 800, required: false },    // Quand aller au garage
    { id: 'S7', min_chars: 100, max_chars: 600, required: false },          // Pièces associées
    { id: 'S8', min_chars: 400, max_chars: 2000, required: true },          // FAQ
  ],

  forbidden_overlap: [
    // Termes transactionnels qui appartiennent à R1/R2
    'acheter', 'prix', 'livraison', 'commander', 'panier',
    'meilleur prix', 'pas cher', 'promo',
    // Termes comparatifs qui appartiennent à R6
    'meilleur', 'comparatif', 'top 5', 'classement',
  ],

  allowed_schemas: ['Article', 'HowTo', 'FAQPage', 'BreadcrumbList'],

  content_contracts: {
    procedure: 'pas-à-pas avec couples de serrage + outils',
    diagnostic: 'symptômes observables + checks gates safety (ADR-027 S2_DIAG)',
    definition: 'définition technique + composition + variantes',
  },

  semantic_intents: ['informational', 'investigational'],

  uniqueness_thresholds: {
    min_specific_ratio: 0.7, // R3 doit être très spécifique par gamme
    max_boilerplate: 0.3,
  },

  promotion_gate: {
    // R3 a besoin des 4 validations (diagnostic_relations[] obligatoire ADR-033)
    requires_validations: ['semantic', 'role', 'diagnostic', 'license'],
  },

  inputs: {
    wiki: {
      required: true,
      source_pattern: 'rag/knowledge/gammes/${pgAlias}.md',
      fallback_policy: 'fail',
    },
    db: {
      required: true,
      tables: ['pieces_gamme', '__seo_gamme_conseil', '__seo_r3_keyword_plan'],
      rpcs: [],
    },
    kw: {
      required: true,
      plan_table: '__seo_r3_keyword_plan',
      read_columns: ['skp_section_terms'],
    },
  },

  inputs_completeness_gate: 'fail-closed',

  gate_strictness: {
    quality_gate: 'fail-closed', // R3 a déjà fail-closed via CanonGate + QualityGate
    forbidden_overlap: 'fail-closed',
    min_chars_pre_write: 'fail-closed',
  },

  output_consumers: {
    sitemap: {
      threshold_gatekeeper_score: 70,
    },
    dynamic_seo_v4: {
      source_columns: ['sgc_html', 'sgc_meta_description'],
      fallback_to_aggregates: false, // R3 contenu strictement dérivé de l'article
    },
    maillage_targets: [RoleId.R1_ROUTER, RoleId.R4_REFERENCE, RoleId.R6_GUIDE_ACHAT],
  },

  quality_metrics: {
    tracked_metrics: [
      'char_count',
      'gatekeeper_score',
      'specific_content_ratio',
      'boilerplate_ratio',
    ],
    snapshot_frequency: 'monthly',
    alert_thresholds: [
      { metric: 'gatekeeper_score', drop_pct: 0.15, window_days: 30 },
      { metric: 'specific_content_ratio', drop_pct: 0.20, window_days: 30 },
    ],
  },
};
