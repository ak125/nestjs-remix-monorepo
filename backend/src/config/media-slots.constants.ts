/**
 * Media Slots Rules & Layout Contract — configuration statique pour les pages gamme R3.
 * PAS injecté dans les prompts LLM (économie de tokens).
 * Utilisé par le frontend, le pipeline de build d'images, et les agents keyword-planner/conseil-batch.
 */

import {
  type MediaSlotType,
  type MediaPlacement,
} from './keyword-plan.constants';

// ── Build-time rules (hero, wallpaper, webp) ─────────────

export const MEDIA_SLOTS_RULES = {
  hero_requires_gradient: true,
  wallpaper_over_gradient: true,
  pg_pic_as_selector_image: true,
  fallback_generic_category: true,
  lazy_load_below_fold: true,
  webp_only: true,
  max_hero_width: 1920,
} as const;

// ── Media Layout Contract — contrat detaille per-section ──

export interface MediaSlotSchema {
  columns?: string[];
  row_count_target?: string;
  item_count_target?: string;
}

export interface MediaSlotImageContract {
  topic: string;
  format: 'webp' | 'avif';
  aspect_ratio: '16:9' | '4:3' | '1:1';
  min_width: number;
  alt_template: string;
  loading: 'eager' | 'lazy';
}

export interface MediaSlotContract {
  slot_id: string;
  type: MediaSlotType;
  required: boolean;
  purpose: string;
  placement_hint: MediaPlacement;
  budget_cost: number;
  schema?: MediaSlotSchema;
  image_spec?: MediaSlotImageContract;
}

export const MEDIA_LAYOUT_CONTRACT: Record<string, MediaSlotContract[]> = {
  HERO: [
    {
      slot_id: 'HERO_IMAGE',
      type: 'image',
      required: true,
      purpose: 'illustration piece/zone',
      placement_hint: 'before_content',
      budget_cost: 0,
      image_spec: {
        topic: 'hero_piece',
        format: 'webp',
        aspect_ratio: '16:9',
        min_width: 1200,
        alt_template: '{gamme_name} : guide complet',
        loading: 'eager',
      },
    },
    {
      slot_id: 'HERO_TLDR',
      type: 'cards',
      required: true,
      purpose: 'badges difficulty/time/safety',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: { item_count_target: '3-4' },
    },
  ],
  S1: [
    {
      slot_id: 'S1_CHECKLIST',
      type: 'checklist',
      required: true,
      purpose: 'outils + consommables essentiels',
      placement_hint: 'inline',
      budget_cost: 0,
    },
    {
      slot_id: 'S1_CALLOUT',
      type: 'callout',
      required: true,
      purpose: 'securite (gants, lunettes, cric)',
      placement_hint: 'after_content',
      budget_cost: 0,
    },
  ],
  S2: [
    {
      slot_id: 'S2_DIAG_TABLE',
      type: 'table',
      required: true,
      purpose: 'snippet + diagnostic rapide',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: {
        columns: ['Symptome', 'Cause probable', 'Action recommandee'],
        row_count_target: '6-10',
      },
    },
    {
      slot_id: 'S2_SYMPTOM_IMAGE',
      type: 'image',
      required: false,
      purpose: 'symptome visuel (bleuissement, fissure)',
      placement_hint: 'inline',
      budget_cost: 1,
      image_spec: {
        topic: 'symptom_visual',
        format: 'webp',
        aspect_ratio: '16:9',
        min_width: 800,
        alt_template: 'Symptomes usure {gamme_name} : {symptom}',
        loading: 'lazy',
      },
    },
  ],
  S3: [
    {
      slot_id: 'S3_COMPAT_TABLE',
      type: 'table',
      required: true,
      purpose: 'compatibilite : caracteristique / ou lire / risque / verifier',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: {
        columns: [
          'Caracteristique',
          'Ou la lire',
          'Risque si erreur',
          'Comment verifier',
        ],
        row_count_target: '4-6',
      },
    },
    {
      slot_id: 'S3_SCHEMA_IMAGE',
      type: 'image',
      required: false,
      purpose: 'schema comparatif (ex: ventile vs plein)',
      placement_hint: 'after_content',
      budget_cost: 1,
      image_spec: {
        topic: 'comparison_schema',
        format: 'webp',
        aspect_ratio: '4:3',
        min_width: 800,
        alt_template: 'Schema comparatif {gamme_name}',
        loading: 'lazy',
      },
    },
  ],
  S4_DEPOSE: [
    {
      slot_id: 'S4D_STEPS',
      type: 'steps',
      required: true,
      purpose: 'etapes numerotees demontage (7-12)',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: { item_count_target: '7-12' },
    },
    {
      slot_id: 'S4D_SCHEMA_IMAGE',
      type: 'image',
      required: false,
      purpose: 'schema points fixation/vis',
      placement_hint: 'inline',
      budget_cost: 1,
      image_spec: {
        topic: 'fixation_schema',
        format: 'webp',
        aspect_ratio: '4:3',
        min_width: 800,
        alt_template: 'Schema demontage {gamme_name}',
        loading: 'lazy',
      },
    },
  ],
  S4_REPOSE: [
    {
      slot_id: 'S4R_STEPS',
      type: 'steps',
      required: true,
      purpose: 'etapes numerotees remontage',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: { item_count_target: '5-10' },
    },
    {
      slot_id: 'S4R_CHECKLIST',
      type: 'checklist',
      required: true,
      purpose: 'avant abaisser vehicule',
      placement_hint: 'after_content',
      budget_cost: 0,
      schema: { item_count_target: '4-6' },
    },
    {
      slot_id: 'S4R_RODAGE_TABLE',
      type: 'table',
      required: false,
      purpose: 'tableau rodage km/type/eviter',
      placement_hint: 'after_content',
      budget_cost: 0,
      schema: {
        columns: ['Vitesse km/h', 'Type freinage', 'A eviter'],
        row_count_target: '3-4',
      },
    },
  ],
  S5: [
    {
      slot_id: 'S5_ERROR_TABLE',
      type: 'table',
      required: true,
      purpose: 'erreur → risque → correctif',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: {
        columns: ['Erreur', 'Risque', 'Correctif'],
        row_count_target: '5-8',
      },
    },
  ],
  S6: [
    {
      slot_id: 'S6_CHECKLIST',
      type: 'checklist',
      required: true,
      purpose: 'verifications statique + essai progressif + stop si',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: { item_count_target: '6-10' },
    },
  ],
  S7: [
    {
      slot_id: 'S7_CARDS',
      type: 'cards',
      required: true,
      purpose: 'pieces + consommables associes (sans prix)',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: { item_count_target: '3-6' },
    },
    {
      slot_id: 'S7_TABLE',
      type: 'table',
      required: false,
      purpose: 'consommable / pourquoi / quand',
      placement_hint: 'after_content',
      budget_cost: 0,
      schema: {
        columns: ['Consommable', 'Pourquoi', 'Quand necessaire'],
        row_count_target: '3-5',
      },
    },
  ],
  S8: [
    {
      slot_id: 'S8_FAQ',
      type: 'faq',
      required: true,
      purpose: 'accordeon FAQ 4-6 questions',
      placement_hint: 'inline',
      budget_cost: 0,
      schema: { item_count_target: '4-6' },
    },
  ],
  META: [
    {
      slot_id: 'META_LINKS',
      type: 'cards',
      required: true,
      purpose: 'liens internes R4 glossaire + R3 diagnostics + guides proches',
      placement_hint: 'inline',
      budget_cost: 0,
    },
  ],
};

// ── Image library strategy ────────────────────────────────

export const IMAGE_LIBRARY_STRATEGY = {
  universal: {
    description:
      'Images reutilisables par famille (freinage, filtration, transmission...)',
    types: [
      'hero_generic_family',
      'outillage_securite',
      'schema_ventile_vs_plein',
    ],
    path: '/img/uploads/guides/universal/',
  },
  specific: {
    description:
      'Images specifiques aux top gammes (symptomes, schemas fixation)',
    condition: 'uniquement si image claire et universelle disponible',
    path: '/img/uploads/guides/gammes/{pg_alias}/',
  },
} as const;
