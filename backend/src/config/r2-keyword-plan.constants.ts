/**
 * R2 Keyword Plan constants V3 — Product Listing (transactionnel + compatibilite vehicule).
 * 20 sections, 8 intents, 6 phases (P0-P5), 11 gates, audit-first pipeline.
 * Aligned with PageContract R2 schema (r2-content-contract.schema.ts).
 * Used by r2-keyword-planner agent.
 *
 * V3 changes vs V2:
 * - Audit-first: P0 diagnoses before generating
 * - Selective regeneration: only priority sections
 * - ui_blocks format: structured blocks instead of body_md
 * - S_MICRO_SPECS: 20th section for mounting specs
 * - Linking integrated per-section (no separate phase)
 * - Heading plan merged into P1
 * - 11 gates (GR1-GR11): +claim_proof, +faq_validity, +footprint_blocks
 *
 * INTERDIT R2 : tutoriel complet (R3), diagnostic (R5), glossaire (R4), generique sans vehicule (R1).
 * R2 = transactionnel + rassurant + utile, jamais un article.
 */

import type {
  GateDefinition,
  GateResult,
  PriorityFix,
  AuditResult,
} from './keyword-plan.constants';

// Re-export shared interfaces (no duplication)
export type { GateDefinition, GateResult, PriorityFix, AuditResult };

// ── Pipeline phases R2 V3 (6 phases + complete) ─────────

export const R2_KP_PIPELINE_PHASES = [
  'P0_AUDIT_FINDER',
  'P1_KEYWORD_INTENT_V3',
  'P2_SECTION_KEYWORD_MAP',
  'P3_SECTION_CONTENT_GEN',
  'P4_MICRO_SPECS',
  'P5_QA_GATEKEEPER',
  'complete',
] as const;
export type R2KpPipelinePhase = (typeof R2_KP_PIPELINE_PHASES)[number];

// ── Section IDs V3 (20 sections — +S_MICRO_SPECS) ──────

export const R2_SECTION_IDS = [
  'S_HERO',
  'S_VEHICLE_BADGE',
  'S_FAST_LANES',
  'S_TOOLBAR',
  'S_FILTERS',
  'S_LISTING_GROUPS',
  'S_TRUST_PROOF',
  'S_VIN_CHECK',
  'S_MISTAKES_AVOID',
  'S_BUYING_GUIDE',
  'S_FAQ',
  'S_COMPAT',
  'S_OEM',
  'S_EQUIVALENCE',
  'S_MICRO_SPECS',
  'S_CATALOG_FAMILY',
  'S_CROSS_SELL',
  'S_RELATED_ARTICLES',
  'S_VOIR_AUSSI',
  'S_FOOTER_MICROSEO',
] as const;
export type R2SectionId = (typeof R2_SECTION_IDS)[number];

// ── Intent IDs (8 secondary intents — aligned with PageContract) ─

export const R2_INTENT_IDS = [
  'I_COMPAT',
  'I_PRICE',
  'I_SIDE',
  'I_OEM',
  'I_QUALITY',
  'I_DELIVERY',
  'I_BRANDS',
  'I_TRUST',
] as const;
export type R2IntentId = (typeof R2_INTENT_IDS)[number];

// ── Section configuration V3 ────────────────────────────

export type R2SeoPriority = 'critique' | 'haute' | 'moyenne' | 'basse';

export interface R2SectionDef {
  label: string;
  min_terms: number;
  required: boolean;
  keyword_targeted: boolean;
  seo_priority: R2SeoPriority;
  page_component: string;
  conditional_on?: string;
}

export const R2_SECTION_CONFIG: Record<R2SectionId, R2SectionDef> = {
  S_HERO: {
    label: 'Hero vehicule + gamme',
    min_terms: 4,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    page_component: 'H1 + breadcrumb + chips',
  },
  S_VEHICLE_BADGE: {
    label: 'Badge vehicule (marque/modele/type)',
    min_terms: 3,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'VehicleBadge + motorisation',
  },
  S_FAST_LANES: {
    label: 'Raccourcis avant/arriere ou capteur',
    min_terms: 2,
    required: false,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'FastLaneChips (position/capteur)',
    conditional_on: 'has_side',
  },
  S_TOOLBAR: {
    label: 'Barre outils (tri/vue/compare)',
    min_terms: 1,
    required: true,
    keyword_targeted: false,
    seo_priority: 'basse',
    page_component: 'PiecesToolbar',
  },
  S_FILTERS: {
    label: 'Filtres sidebar',
    min_terms: 2,
    required: true,
    keyword_targeted: false,
    seo_priority: 'basse',
    page_component: 'PiecesFilterSidebar',
  },
  S_LISTING_GROUPS: {
    label: 'Listing produits groupes',
    min_terms: 3,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    page_component: 'PiecesGroupedDisplay',
  },
  S_TRUST_PROOF: {
    label: 'Preuve confiance & garanties',
    min_terms: 2,
    required: true,
    keyword_targeted: false,
    seo_priority: 'moyenne',
    page_component: 'FrictionReducer + TrustBar',
  },
  S_VIN_CHECK: {
    label: 'Verification VIN/CNIT',
    min_terms: 2,
    required: false,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'CompatibilityBlock (futur)',
    conditional_on: 'has_vin_check',
  },
  S_MISTAKES_AVOID: {
    label: 'Erreurs courantes a eviter',
    min_terms: 3,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'MountingAlerts + CommonMistakes',
  },
  S_BUYING_GUIDE: {
    label: 'Guide de choix rapide',
    min_terms: 4,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    page_component: 'PiecesBuyingGuide + InterventionGuide',
  },
  S_FAQ: {
    label: 'FAQ dynamique',
    min_terms: 3,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    page_component: 'PiecesFAQ (generateFAQ)',
  },
  S_COMPAT: {
    label: 'Compatibilite vehicule',
    min_terms: 3,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'Badge Pourquoi compatible',
  },
  S_OEM: {
    label: 'References OEM constructeur',
    min_terms: 3,
    required: false,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'PiecesOemSection',
    conditional_on: 'has_oem_refs',
  },
  S_EQUIVALENCE: {
    label: 'Equivalences marques',
    min_terms: 3,
    required: false,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'PiecesOemSection (brand equivalences)',
    conditional_on: 'has_oem_refs',
  },
  S_MICRO_SPECS: {
    label: 'Micro-specs montage',
    min_terms: 2,
    required: false,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'MicroSpecsTable',
    conditional_on: 'has_micro_specs',
  },
  S_CATALOG_FAMILY: {
    label: 'Famille catalogue (gammes soeurs)',
    min_terms: 2,
    required: false,
    keyword_targeted: false,
    seo_priority: 'moyenne',
    page_component: 'CatalogFamilySection',
  },
  S_CROSS_SELL: {
    label: 'Cross-selling gammes liees',
    min_terms: 2,
    required: false,
    keyword_targeted: false,
    seo_priority: 'moyenne',
    page_component: 'CrossSellingSection',
  },
  S_RELATED_ARTICLES: {
    label: 'Articles conseils lies',
    min_terms: 2,
    required: false,
    keyword_targeted: true,
    seo_priority: 'moyenne',
    page_component: 'RelatedArticles',
  },
  S_VOIR_AUSSI: {
    label: 'Voir aussi (liens contextuels)',
    min_terms: 2,
    required: false,
    keyword_targeted: true,
    seo_priority: 'moyenne',
    page_component: 'VoirAussiSection',
  },
  S_FOOTER_MICROSEO: {
    label: 'Footer micro-SEO',
    min_terms: 2,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    page_component: 'FooterSEOBloc',
  },
};

// ── Intent configuration ────────────────────────────────

export interface R2IntentDef {
  label: string;
  statement: string;
  conditional_on?: string;
  target_sections: R2SectionId[];
}

export const R2_INTENT_CONFIG: Record<R2IntentId, R2IntentDef> = {
  I_COMPAT: {
    label: 'Compatibilite vehicule',
    statement: 'Verifier que la piece est compatible avec mon vehicule',
    target_sections: [
      'S_HERO',
      'S_VEHICLE_BADGE',
      'S_LISTING_GROUPS',
      'S_COMPAT',
      'S_FAQ',
    ],
  },
  I_PRICE: {
    label: 'Prix et budget',
    statement: 'Comparer les prix et trouver le meilleur rapport qualite-prix',
    target_sections: ['S_LISTING_GROUPS', 'S_BUYING_GUIDE', 'S_FAQ'],
  },
  I_SIDE: {
    label: 'Position avant/arriere ou gauche/droite',
    statement: 'Choisir la bonne position (essieu/cote)',
    conditional_on: 'has_side',
    target_sections: [
      'S_FAST_LANES',
      'S_FILTERS',
      'S_LISTING_GROUPS',
      'S_COMPAT',
    ],
  },
  I_OEM: {
    label: 'Reference OEM constructeur',
    statement: 'Trouver la piece par reference OEM ou constructeur',
    conditional_on: 'has_oem_refs',
    target_sections: ['S_OEM', 'S_EQUIVALENCE', 'S_LISTING_GROUPS', 'S_FAQ'],
  },
  I_QUALITY: {
    label: 'Qualite OE vs aftermarket',
    statement: 'Choisir entre qualite OE, OES, equivalent ou economique',
    target_sections: ['S_BUYING_GUIDE', 'S_LISTING_GROUPS', 'S_FAQ'],
  },
  I_DELIVERY: {
    label: 'Delai et stock',
    statement: 'Verifier la disponibilite et les delais de livraison',
    target_sections: ['S_LISTING_GROUPS', 'S_TRUST_PROOF'],
  },
  I_BRANDS: {
    label: 'Marques fiables',
    statement: 'Identifier les marques les plus fiables pour cette gamme',
    target_sections: ['S_LISTING_GROUPS', 'S_BUYING_GUIDE', 'S_FAQ'],
  },
  I_TRUST: {
    label: 'Confiance et garanties',
    statement: 'Verifier la fiabilite du vendeur et les garanties',
    target_sections: ['S_TRUST_PROOF', 'S_VIN_CHECK', 'S_FAQ'],
  },
};

// ── Content block types (aligned with PageContract) ─────

export const R2_CONTENT_BLOCK_TYPES = [
  'microcopy',
  'bullets',
  'table_2col',
  'table_specs',
  'faq',
  'cta',
  'note',
  'link_list',
] as const;
export type R2ContentBlockType = (typeof R2_CONTENT_BLOCK_TYPES)[number];

/** @deprecated Use R2_CONTENT_BLOCK_TYPES instead */
export const R2_UI_BLOCK_TYPES = R2_CONTENT_BLOCK_TYPES;
/** @deprecated Use R2ContentBlockType instead */
export type R2UiBlockType = R2ContentBlockType;

// ── Media slot types (aligned with PageContract, 12) ────

export const R2_MEDIA_SLOT_TYPES = [
  'hero_image',
  'product_card_image',
  'brand_logo_strip',
  'diagram_position',
  'trust_badges_row',
  'table_2col',
  'table_specs',
  'oem_search_box',
  'vin_check_module',
  'compare_tray',
  'schema_hint_itemlist',
  'schema_hint_faq',
] as const;
export type R2MediaSlotType = (typeof R2_MEDIA_SLOT_TYPES)[number];

// ── Quality tier enum (aligned with PageContract) ───────

export const R2_QUALITY_TIER_ENUM = [
  'OE_OES',
  'AFTERMARKET',
  'ECO',
  'PREMIUM',
] as const;
export type R2QualityTier = (typeof R2_QUALITY_TIER_ENUM)[number];

// ── Schema types (structured data) ──────────────────────

export const R2_SCHEMA_TYPES = [
  'ItemList',
  'FAQPage',
  'BreadcrumbList',
  'Product',
  'AggregateOffer',
] as const;
export type R2SchemaType = (typeof R2_SCHEMA_TYPES)[number];

// ── Content tone & style ────────────────────────────────

export const R2_CONTENT_TONE = {
  voice: 'pro',
  style: 'direct',
  domain: 'e-commerce',
  density: 'scannable',
  maxParagraphWords: 60,
  maxBullets: 8,
  avoidPatterns: [
    'En effet,',
    'Il est important de noter que',
    'Comme nous le savons,',
    'Dans cet article,',
    "N'hesitez pas a",
  ],
} as const;

// ── Audit issue types V3 (P0 output classification) ─────

export const R2_AUDIT_ISSUE_TYPES = [
  'intent_fit',
  'contradiction',
  'footprint',
  'completeness',
  'schema_gap',
  'cannib_risk',
] as const;
export type R2AuditIssueType = (typeof R2_AUDIT_ISSUE_TYPES)[number];

// ── Section length budgets V3 ───────────────────────────

export const R2_SECTION_LENGTH_BUDGETS: Record<
  R2SectionId,
  { min_words: number; max_words: number }
> = {
  S_HERO: { min_words: 15, max_words: 40 },
  S_VEHICLE_BADGE: { min_words: 10, max_words: 30 },
  S_FAST_LANES: { min_words: 10, max_words: 25 },
  S_TOOLBAR: { min_words: 5, max_words: 15 },
  S_FILTERS: { min_words: 10, max_words: 20 },
  S_LISTING_GROUPS: { min_words: 30, max_words: 80 },
  S_TRUST_PROOF: { min_words: 20, max_words: 50 },
  S_VIN_CHECK: { min_words: 20, max_words: 60 },
  S_MISTAKES_AVOID: { min_words: 40, max_words: 100 },
  S_BUYING_GUIDE: { min_words: 60, max_words: 150 },
  S_FAQ: { min_words: 80, max_words: 200 },
  S_COMPAT: { min_words: 30, max_words: 80 },
  S_OEM: { min_words: 20, max_words: 60 },
  S_EQUIVALENCE: { min_words: 20, max_words: 60 },
  S_MICRO_SPECS: { min_words: 30, max_words: 80 },
  S_CATALOG_FAMILY: { min_words: 15, max_words: 40 },
  S_CROSS_SELL: { min_words: 15, max_words: 40 },
  S_RELATED_ARTICLES: { min_words: 15, max_words: 40 },
  S_VOIR_AUSSI: { min_words: 10, max_words: 30 },
  S_FOOTER_MICROSEO: { min_words: 20, max_words: 60 },
};

// ── Idempotent skip rules ───────────────────────────────

export interface R2IdempotentRule {
  section_key: R2SectionId;
  skip_when: string;
  fallback?: string;
}

export const R2_IDEMPOTENT_RULES: R2IdempotentRule[] = [
  { section_key: 'S_FAST_LANES', skip_when: 'has_side === false' },
  { section_key: 'S_VIN_CHECK', skip_when: 'has_vin_check === false' },
  { section_key: 'S_OEM', skip_when: 'has_oem_refs === false' },
  { section_key: 'S_EQUIVALENCE', skip_when: 'has_oem_refs === false' },
  { section_key: 'S_MICRO_SPECS', skip_when: 'has_micro_specs === false' },
  { section_key: 'S_CATALOG_FAMILY', skip_when: 'catalog_family_count === 0' },
  {
    section_key: 'S_RELATED_ARTICLES',
    skip_when: 'related_articles_count === 0',
  },
];

// Noindex rule
export const R2_NOINDEX_THRESHOLD = {
  minProductCount: 2,
  action: 'noindex,follow',
  reason: 'Trop peu de produits pour justifier une page indexee',
} as const;

// ── Anti-cannibalisation — forbidden terms by role ──────

/** R2 forbidden from R3 — how-to/mounting/tutorial terms */
export const R2_FORBIDDEN_FROM_R3 = [
  'comment changer',
  'tuto',
  'tutoriel',
  'etapes de montage',
  'outils necessaires',
  'temps de montage detaille',
  'purger le circuit',
  'comparatif complet',
  'meilleures marques 2026',
  'couple de serrage',
  'cle dynamometrique',
  'purge',
  'chandelles',
  'depose/repose',
  'etape 1',
  'outillage requis',
  'pas-a-pas',
  'demonter',
  'visser',
  'devisser',
  'demontage',
  'remontage',
  'comment remplacer',
] as const;

/** R2 forbidden from R4 — encyclopedic/glossary terms */
export const R2_FORBIDDEN_FROM_R4 = [
  'definition complete',
  "qu'est-ce que",
  'encyclopedie',
  'historique de',
  'fonctionnement detaille',
  'invente en',
  'etymologie',
] as const;

/** R2 forbidden from R5 — diagnostic/symptom terms */
export const R2_FORBIDDEN_FROM_R5 = [
  'symptomes',
  'bruit anormal',
  'vibrations au freinage',
  'voyant allume',
  'panne',
  'diagnostic',
  'OBD',
  'code erreur',
  'code defaut',
  'calculateur',
  'capteur defaillant',
  'multimetre',
  'valise diagnostic',
] as const;

/** R2 howto strict — hard fail if any match (content is R3, not R2) */
export const R2_HOWTO_STRICT_TERMS = [
  'couple de serrage',
  'cle dynamometrique',
  'purge',
  'chandelles',
  'depose/repose',
  'etape 1',
  'outillage requis',
  'OBD reset',
  'calibration detaillee',
  'tutoriel',
] as const;

/** R2 stopwords metier — footprint avoidance */
export const R2_STOPWORDS_METIER = [
  'En conclusion',
  'Pour resumer',
  'Comme on peut le voir',
  'A noter que',
  'Il faut savoir que',
  'En ce qui concerne',
  'Dans le cadre de',
  'En matiere de',
  'Force est de constater',
  'Il va sans dire',
] as const;

/** R2 transactional tokens — legitimate on R2 (NOT forbidden unlike R6) */
export const R2_TRANSACTIONAL_TOKENS = [
  'acheter',
  'commander',
  'prix',
  'livraison',
  'en stock',
  'ajouter au panier',
  'expedition',
  'livraison rapide',
  'pas cher',
  'meilleur prix',
  'promo',
] as const;

/** R2 buying intent tokens — score weight for R2 classification */
export const R2_BUYING_TOKENS = [
  'compatible',
  'adapte',
  'homologue',
  'certifie',
  'reference OEM',
  'qualite OE',
  'qualite OES',
  'premiere monte',
  'equivalent',
  'aftermarket',
  'economique',
  'prix',
  'stock',
  'livraison',
  'marque',
] as const;

// ── Promises & claims controls ──────────────────────────

/** Banned claims — never use in R2 content */
export const R2_BANNED_CLAIMS = [
  'prix garanti',
  'livraison garantie',
  'moins cher du marche',
  'zero defaut',
  'meilleur du marche',
  'certifie constructeur',
  'garanti a vie',
  'qualite garantie',
] as const;

// ── Gate definitions V3 (GR1-GR11) ─────────────────────

export const R2_GATE_DEFINITIONS: Record<string, GateDefinition> = {
  GR1_INTENT_PURITY: {
    description:
      'intent_primary.role === R2_PRODUCT (transactionnel + compatibilite)',
    penalty: 100,
  },
  GR2_VEHICLE_CONTEXT: {
    description: 'Toutes requetes head/mid contiennent modele ou type vehicule',
    penalty: 30,
  },
  GR3_CANNIB_JACCARD: {
    description: 'Jaccard vs R1/R3/R5 keyword plans < 0.12',
    penalty: 30,
  },
  GR4_HOWTO_STRICT: {
    description: 'Hard fail if any howto_strict_terms detected (content is R3)',
    penalty: 100,
  },
  GR5_COVERAGE: {
    description: 'Coverage score >= 60% des intents applicables',
    penalty: 15,
  },
  GR6_SECTION_COMPLETE: {
    description: 'Toutes sections required ont must_include_terms',
    penalty: 20,
  },
  GR7_ENTITY_VARIANTS: {
    description: '>= 3 variantes entite utilisees dans les clusters',
    penalty: 10,
  },
  GR8_FORBIDDEN_HITS: {
    description: '0 hit forbidden R4/R5 terms',
    penalty: 30,
  },
  GR9_CLAIM_PROOF: {
    description: 'Toutes claims (R90, stock, delais) justifiees par data RM',
    penalty: 20,
  },
  GR10_FAQ_VALIDITY: {
    description: '>= 4 Q/R completes dans S_FAQ',
    penalty: 15,
  },
  GR11_FOOTPRINT_BLOCKS: {
    description: 'Aucun ui_block repete entre sections',
    penalty: 10,
  },
};

// ── Quality thresholds ──────────────────────────────────

export const R2_KP_QUALITY_THRESHOLDS = {
  minQualityScore: 60,
  minCoverageScore: 0.6,
  maxJaccardScore: 0.12,
  validatedScoreMin: 70,
  healthyScoreMin: 85,
  maxFootprintRepeatRatio: 0.15,
  minFaqCount: 4,
} as const;

// ── Per-section term minimums ───────────────────────────

export const R2_SECTION_TERM_MINIMUMS: Record<R2SectionId, number> = {
  S_HERO: 4,
  S_VEHICLE_BADGE: 3,
  S_FAST_LANES: 2,
  S_TOOLBAR: 1,
  S_FILTERS: 2,
  S_LISTING_GROUPS: 3,
  S_TRUST_PROOF: 2,
  S_VIN_CHECK: 2,
  S_MISTAKES_AVOID: 3,
  S_BUYING_GUIDE: 4,
  S_FAQ: 3,
  S_COMPAT: 3,
  S_OEM: 3,
  S_EQUIVALENCE: 3,
  S_MICRO_SPECS: 2,
  S_CATALOG_FAMILY: 2,
  S_CROSS_SELL: 2,
  S_RELATED_ARTICLES: 2,
  S_VOIR_AUSSI: 2,
  S_FOOTER_MICROSEO: 2,
};

// ── Anchor text bank (20 verbs + 20 buying variants) ────

export const R2_ANCHOR_VERBS = [
  'Voir',
  'Decouvrir',
  'Explorer',
  'Comparer',
  'Consulter',
  'Trouver',
  'Verifier',
  'Choisir',
  'Selectionner',
  'Parcourir',
  'Identifier',
  'Rechercher',
  'Evaluer',
  'Commander',
  'Acheter',
  'Ajouter',
  'Profiter de',
  'Beneficier de',
  'Obtenir',
  'Acceder a',
] as const;

export const R2_ANCHOR_BUYING_VARIANTS = [
  'les {{gamme}} pour votre {{modele}}',
  'nos {{gamme}} compatibles {{marque}}',
  '{{gamme}} {{marque}} {{modele}} au meilleur prix',
  'toutes les references {{gamme}} {{marque}}',
  'les {{gamme}} OE/OES pour {{modele}}',
  '{{gamme}} origine {{marque}} {{modele}}',
  '{{gamme}} pas cher {{marque}} {{modele}}',
  '{{gamme}} {{marque}} livraison rapide',
  'kit {{gamme}} complet {{marque}} {{modele}}',
  '{{gamme}} {{marque}} en stock',
  '{{gamme}} avant pour {{marque}} {{modele}}',
  '{{gamme}} arriere pour {{marque}} {{modele}}',
  'reference OEM {{gamme}} {{marque}}',
  '{{gamme}} qualite premiere monte {{marque}}',
  '{{gamme}} {{marque}} {{modele}} {{type}}',
  '{{gamme}} {{marque}} prix et disponibilite',
  'equivalences {{gamme}} {{marque}}',
  '{{gamme}} {{marque}} avis et notation',
  '{{gamme}} compatibles {{marque}} {{modele}} {{type}}',
  'catalogue {{gamme}} {{marque}} {{modele}}',
] as const;

// ── Snippet bank (parametric short phrases) ─────────────

export const R2_SNIPPET_BANK = [
  'Compatibilite confirmee pour votre {{marque}} {{modele}} {{type}}.',
  'Livraison sous {{stock_signal}} pour la plupart des references.',
  'References OEM disponibles pour verification croisee.',
  '{{count}} pieces de {{brand_count}} marques differentes.',
  'Qualite OE/OES garantie par le fabricant premiere monte.',
  'Filtrez par position ({{side_labels}}) pour trouver la bonne piece.',
  'Prix a partir de {{min_price}}€ TTC.',
  'Score qualite base sur : fabricant, disponibilite, couverture image.',
] as const;

// ── Linking anti-spam rules ─────────────────────────────

export const R2_LINKING_RULES = {
  maxVoirAussi: 4,
  maxCrossSell: 12,
  maxCatalogFamily: 12,
  maxSameFamilyLinks: 5,
  noDuplicateAnchors: true,
  noDuplicateTargets: true,
} as const;

// ══════════════════════════════════════════════════════════
// V3 INTERFACES — Audit-First Pipeline
// ══════════════════════════════════════════════════════════

// ── P0 Audit Finder output (PageContract aligned) ───────

export interface R2AuditIssue {
  issue_id: string;
  severity: 'high' | 'med' | 'low';
  section_key: R2SectionId;
  why_it_matters: string[];
  evidence: string[];
  fix: string;
  expected_gain: Array<'SEO' | 'CTR' | 'CVR' | 'Trust' | 'Crawl'>;
}

export interface R2MediaGap {
  slot_type: R2MediaSlotType;
  priority: 'above_fold' | 'mid' | 'below';
  placement_section: R2SectionId;
  why: string;
}

export interface R2AuditReport {
  pass_fail: 'pass' | 'fail';
  top_issues: R2AuditIssue[];
  regen_sections: R2SectionId[];
  media_gaps: R2MediaGap[];
  anti_cannibalization: {
    forbidden_global: string[];
    forbidden_by_role: {
      R1_ROUTER: string[];
      R3_GUIDE: string[];
      R4_GLOSSARY: string[];
      R5_DIAGNOSTIC: string[];
    };
  };
  notes: string[];
}

/** @deprecated Use R2AuditReport instead */
export interface R2AuditBacklog {
  pg_id: string;
  audited_at: string;
  page_exists: boolean;
  overall_health: number;
  top_priority_sections: R2SectionId[];
  do_not_touch: R2SectionId[];
  issues: R2AuditIssue[];
  sections_ok: R2SectionId[];
  sections_skip: Array<{ section_key: R2SectionId; reason: string }>;
  cannib_signals: Array<{
    term: string;
    conflicting_role: string;
    jaccard: number;
  }>;
  schema_readiness: Record<string, boolean>;
}

// ── P1 Entity pack (unchanged from V2, still used in P1) ─

export interface R2EntityPack {
  gamme: {
    pg_id: string;
    name: string;
    alias: string;
    synonyms: string[];
  };
  vehicle_patterns: {
    brand_variants: string[];
    model_variants: string[];
    type_variants: string[];
    vehicle_full_variants: string[];
    power_variants: string[];
    code_patterns: string[];
  };
  product_context: {
    has_side: boolean;
    side_labels: string[];
    quality_tiers: string[];
    has_oem_refs: boolean;
    has_wear_sensor: boolean;
  };
  lexicon: {
    synonyms_allowed: Record<string, string[]>;
    synonyms_forbidden: string[];
    stopwords_metier: string[];
    action_verbs: string[];
    compat_terms: string[];
    quality_terms: string[];
  };
}

// ── P1 Intent map (unchanged, with embedded heading plan) ─

export interface R2IntentMap {
  meta: { pg_id: string; pg_alias: string; generated_at: string };
  intent_primary: { role: 'R2_PRODUCT'; statement: string };
  intent_secondary: Array<{
    id: R2IntentId;
    statement: string;
    applicable: boolean;
  }>;
  query_clusters: Record<
    R2IntentId,
    {
      head: string[];
      mid: string[];
      long_tail: string[];
    }
  >;
  heading_plan: {
    h1: string;
    sections: Array<{
      section_key: R2SectionId;
      h2: string;
      h3?: string[];
      intents: R2IntentId[];
    }>;
  };
  coverage_checklist: {
    has_side_queries: boolean;
    has_oem_queries: boolean;
    has_quality_queries: boolean;
    has_delivery_queries: boolean;
    has_brand_queries: boolean;
    coverage_score: number;
  };
  global_forbidden_terms: string[];
}

// ── P2 Section keyword map V3 ───────────────────────────

export interface R2SectionKeywordEntryV3 {
  section_key: R2SectionId;
  must_include: string[];
  nice_to_include: string[];
  entity_variants_to_use: string[];
  forbidden: string[];
  length_budget: { min_words: number; max_words: number };
}

export interface R2SectionKeywordMapV3 {
  sections: R2SectionKeywordEntryV3[];
}

// ── P3 Content blocks (aligned with PageContract, 8 types) ─

export interface R2BlockMicrocopy {
  type: 'microcopy';
  payload: { text: string };
}

export interface R2BlockBullets {
  type: 'bullets';
  payload: { items: string[] };
}

export interface R2BlockTable2col {
  type: 'table_2col';
  payload: { rows: [string, string][] };
}

export interface R2BlockTableSpecs {
  type: 'table_specs';
  payload: { headers: string[]; rows: string[][] };
}

export interface R2BlockFaq {
  type: 'faq';
  payload: { items: Array<{ q: string; a: string }> };
}

export interface R2BlockCta {
  type: 'cta';
  payload: { label: string; href?: string; style?: string };
}

export interface R2BlockNote {
  type: 'note';
  payload: { text: string; tone?: 'info' | 'warning' | 'success' };
}

export interface R2BlockLinkList {
  type: 'link_list';
  payload: { links: Array<{ label: string; href: string; intent?: string }> };
}

export type R2ContentBlock =
  | R2BlockMicrocopy
  | R2BlockBullets
  | R2BlockTable2col
  | R2BlockTableSpecs
  | R2BlockFaq
  | R2BlockCta
  | R2BlockNote
  | R2BlockLinkList;

/** @deprecated Use R2ContentBlock instead */
export type R2UiBlock = R2ContentBlock;

// ── P3 Section content V3 (PageContract aligned) ────────

export interface R2SectionContentV3 {
  section_key: R2SectionId;
  intent_targets: R2IntentId[];
  heading: {
    h2: string;
    h3?: string[];
  };
  keyword_plan: {
    must: string[];
    nice: string[];
    forbidden: string[];
  };
  content_blocks: R2ContentBlock[];
  media_slots: Array<{
    slot_id: string;
    type: R2MediaSlotType;
    priority: 'above_fold' | 'mid' | 'below';
    placement: { section_key: R2SectionId; order: number };
    spec: {
      goal: string;
      constraints: string[];
      alt_text?: string;
      data_binding?: string[];
      fallback_key?: string;
    };
  }>;
  internal_links?: Array<{
    label: string;
    href: string;
    intent: string;
  }>;
  schema_hints?: Array<{
    type: R2SchemaType;
    data_source: string;
  }>;
}

export interface R2PageSectionsContentV3 {
  sections: R2SectionContentV3[];
  skipped_sections: Array<{ section_key: R2SectionId; reason: string }>;
}

// ── P4 Micro-specs output ───────────────────────────────

export interface R2MicroSpecs {
  section_key: 'S_MICRO_SPECS';
  lines: Array<{ label: string; value: string }>;
  mini_table: { headers: string[]; rows: string[][] };
  vin_validation_note: string;
}

// ── P5 QA report V3 ────────────────────────────────────

export interface R2QaReportV3 {
  coverage_score: number;
  coverage_by_intent: Record<R2IntentId, number>;
  intent_fulfillment_time: number;
  forbidden_hits: Array<{ term: string; section: string; role: string }>;
  jaccard_scores: Record<string, number>;
  footprint_risk: {
    repeated_phrases: string[];
    repeat_ratio: number;
    passed: boolean;
  };
  claim_proof_check: Array<{
    claim: string;
    backed_by_data: boolean;
    source?: string;
  }>;
  faq_validity: {
    total_qr: number;
    complete_qr: number;
    passed: boolean;
  };
  missing_sections: R2SectionId[];
  schema_readiness: {
    ItemList: boolean;
    FAQPage: boolean;
    BreadcrumbList: boolean;
  };
  role_purity: { score: number; violations: string[] };
  gate_results: Array<{ gate: string; passed: boolean; detail?: string }>;
  fix_suggestions: string[];
  noindex_proposal?: { recommend: boolean; reason: string };
  final_status: 'validated' | 'draft' | 'rejected' | 'needs_audit';
  final_score: number;
}

// ── Linking plan (kept for anchor_bank extraction in P3) ─

export interface R2LinkingPlan {
  anchor_text_bank: Array<{
    anchor: string;
    intent: R2IntentId;
    target_pattern: string;
  }>;
  links: {
    voir_aussi: Array<{ anchor: string; href_pattern: string; intent: string }>;
    cross_sell: Array<{
      anchor: string;
      href_pattern: string;
      gamme_alias: string;
    }>;
    catalog_family: Array<{
      anchor: string;
      href_pattern: string;
      family_id: string;
    }>;
  };
  anti_spam: {
    duplicate_anchors: number;
    duplicate_targets: number;
    same_family_count: number;
    passed: boolean;
  };
}

// ══════════════════════════════════════════════════════════
// DEPRECATED V2 INTERFACES — kept for backward compatibility
// ══════════════════════════════════════════════════════════

/** @deprecated V2 — heading plan is now embedded in R2IntentMap.heading_plan */
export interface R2HeadingPlan {
  h1: string;
  sections: Array<{
    section_key: R2SectionId;
    h2: string;
    h3?: string[];
    intents: R2IntentId[];
  }>;
}

/** @deprecated V2 — use R2SectionKeywordMapV3 instead */
export interface R2SectionKeywordMap {
  sections: Array<{
    section_key: R2SectionId;
    must_include_terms: string[];
    nice_to_include_terms: string[];
    forbidden_terms: string[];
  }>;
}

/** @deprecated V2 — use R2SectionContentV3 (ui_blocks) instead */
export interface R2SectionContent {
  section_key: R2SectionId;
  title?: string;
  body_md: string;
  bullets: string[];
  micro_table?: { headers: string[]; rows: string[][] };
  faq_items?: Array<{ question: string; answer: string }>;
  microcopy_cta?: string;
  media_slots: Array<{
    type: R2MediaSlotType;
    placement: string;
    alt_text?: string;
    fallback_key?: string;
  }>;
  schema_hints?: Array<{
    type: R2SchemaType;
    data_source: string;
  }>;
}

/** @deprecated V2 — use R2PageSectionsContentV3 instead */
export interface R2PageSectionsContent {
  sections: R2SectionContent[];
  skipped_sections: Array<{ section_key: R2SectionId; reason: string }>;
}

/** @deprecated V2 — use R2QaReportV3 instead */
export interface R2QaReport {
  coverage_score: number;
  coverage_by_intent: Record<R2IntentId, number>;
  forbidden_hits: Array<{ term: string; section: string; role: string }>;
  jaccard_scores: Record<string, number>;
  footprint_risk: {
    repeated_phrases: string[];
    repeat_ratio: number;
    passed: boolean;
  };
  missing_sections: R2SectionId[];
  schema_readiness: {
    ItemList: boolean;
    FAQPage: boolean;
    BreadcrumbList: boolean;
  };
  role_purity: { score: number; violations: string[] };
  gate_results: Array<{ gate: string; passed: boolean; detail?: string }>;
  fix_suggestions: string[];
  noindex_proposal?: { recommend: boolean; reason: string };
  final_status: 'validated' | 'draft' | 'rejected';
  final_score: number;
}
