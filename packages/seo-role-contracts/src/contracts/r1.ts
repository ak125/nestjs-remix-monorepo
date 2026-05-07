/**
 * RoleContract pour R1_ROUTER (gamme listing pages).
 *
 * Sources : extraites depuis backend/src/config/r1-keyword-plan.constants.ts
 * (R1_SECTION_CONFIG) + r1-enricher.service.ts (R1_MICRO_SEO_MIN/MAX_CHARS).
 *
 * Note bump 2026-05-07 : R1_S4_MICRO_SEO seuils max_chars étendus à 3000c
 * (Option B sweet-spot). min_chars actuellement 700 (constants), bump prévu
 * à 1500 en Phase 4 PR-S après diversity audit baseline (PR-R).
 *
 * Implémente ADR-046 + ADR-047.
 */

import { RoleId } from '@repo/seo-roles';
import type { RoleContract } from '../schema';

export const R1_ROUTER_CONTRACT: RoleContract = {
  id: RoleId.R1_ROUTER,

  allowed_sections: [
    { id: 'R1_S0_SERP', min_chars: 150, max_chars: 1500, required: true },
    { id: 'R1_S1_HERO', min_chars: 60, max_chars: 200, required: true },
    { id: 'R1_S2_SELECTOR', min_chars: 50, max_chars: 200, required: false },
    { id: 'R1_S3_BADGES', min_chars: 40, max_chars: 300, required: false },
    { id: 'R1_S4_MICRO_SEO', min_chars: 700, max_chars: 3000, required: true },
    { id: 'R1_S5_COMPAT', min_chars: 60, max_chars: 500, required: false },
    { id: 'R1_S6_SAFE_TABLE', min_chars: 80, max_chars: 800, required: false },
    { id: 'R1_S7_EQUIP', min_chars: 50, max_chars: 300, required: false },
    { id: 'R1_S8_CROSS_SELL', min_chars: 50, max_chars: 500, required: false },
    { id: 'R1_S9_FAQ', min_chars: 600, max_chars: 1500, required: true }, // canon r1-keyword-plan.constants.ts:158-167 (min 600c, required)
  ],

  forbidden_overlap: [
    // Termes diagnostique/HowTo qui appartiennent à R3_CONSEILS
    'étape', 'pas-à-pas', 'tuto', 'tutoriel', 'montage',
    'démonter', 'visser', 'dévisser', 'couple de serrage',
    'symptôme', 'diagnostic', 'panne', 'voyant',
    'comparatif', 'versus', 'vs',
  ],

  allowed_schemas: ['Product', 'CollectionPage', 'BreadcrumbList'],

  content_contracts: {
    decision: 'transactional gamme router — guide vers SKU spécifique',
    identity: 'pièce automobile générique (ex: plaquette de frein)',
  },

  semantic_intents: ['transactional', 'navigational'],

  uniqueness_thresholds: {
    min_specific_ratio: 0.6,
    max_boilerplate: 0.4,
    // Phase 4 PR-R diversity audit baseline déterminera entropy_shannon réel
  },

  promotion_gate: {
    requires_validations: ['semantic', 'role', 'license'],
    // diagnostic non requis pour R1 (pas de diagnostic_relations attendues)
  },

  inputs: {
    wiki: {
      required: true,
      source_pattern: 'rag/knowledge/gammes/${pgAlias}.md',
      fallback_policy: 'skip', // skip slot si RAG MD absent (current behavior)
    },
    db: {
      required: true,
      tables: ['pieces_gamme', '__seo_r1_gamme_slots'],
      rpcs: [],
    },
    kw: {
      required: true,
      plan_table: '__seo_r1_keyword_plan',
      read_columns: ['rkp_section_terms', 'rkp_primary_intent', 'rkp_quality_score'],
    },
  },

  inputs_completeness_gate: 'fail-closed',

  gate_strictness: {
    quality_gate: 'fail-closed',
    forbidden_overlap: 'fail-closed',
    min_chars_pre_write: 'warn', // warn-only pour MVP-0 ; fail-closed Phase 2 PR-I-bis
  },

  output_consumers: {
    sitemap: {
      threshold_gatekeeper_score: 70,
    },
    dynamic_seo_v4: {
      source_columns: ['r1s_micro_seo_block', 'sg_content', 'sg_title_draft'],
      fallback_to_aggregates: true,
    },
    maillage_targets: [RoleId.R2_PRODUCT, RoleId.R4_REFERENCE],
  },

  quality_metrics: {
    tracked_metrics: ['char_count', 'gatekeeper_score'],
    snapshot_frequency: 'monthly',
    alert_thresholds: [
      { metric: 'gatekeeper_score', drop_pct: 0.15, window_days: 30 },
      { metric: 'char_count', drop_pct: 0.20, window_days: 30 },
    ],
  },
};
