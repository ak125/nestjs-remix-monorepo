/**
 * R0 Page Contract — intent, sections, anti-cannibalisation, query governance.
 * Used by SEO agents (keyword-planner R0 path), homepage validation, content audit.
 *
 * Pattern: r5-diagnostic.constants.ts
 *
 * R0 = Homepage / Hub d'orientation
 * Mission : orienter, distribuer, rassurer. Pas éduquer, guider, comparer.
 */

// ── Intent Contract ─────────────────────────────────────

export const R0_INTENT_PRIMARY =
  "Orienter l'utilisateur vers la bonne pièce compatible via le bon parcours de recherche" as const;

export const R0_INTENTS_SECONDARY = {
  high: [
    'Permettre la recherche multi-entrée (véhicule, référence, Type Mine)',
    'Distribuer vers les parcours principaux (catalogue, constructeur, diagnostic)',
  ],
  medium: [
    'Rassurer sur la compatibilité, qualité, livraison, support',
    "Présenter l'écosystème de ressources (guides, références, conseils)",
  ],
  low: [
    'Montrer les recherches fréquentes (maillage interne vers R1)',
    'Afficher les questions commerciales fréquentes (FAQ)',
  ],
} as const;

export const R0_USER_JOBS = [
  'Trouver rapidement une pièce compatible avec mon véhicule',
  "Choisir une porte d'entrée de recherche (véhicule/référence/famille/constructeur)",
  'Comprendre si le site est fiable et professionnel',
  'Accéder au diagnostic si je ne sais pas quelle pièce changer',
  'Explorer les familles de pièces disponibles',
  'Trouver un constructeur ou une marque',
] as const;

export const R0_BUSINESS_GOAL =
  "Convertir un visiteur en acheteur en l'orientant vers le bon parcours" as const;

// ── Section Classification ──────────────────────────────

export type R0SectionStatus = 'required' | 'recommended' | 'optional';

export const R0_SECTION_CLASSIFICATION: Record<string, R0SectionStatus> = {
  hero_search: 'required',
  quick_access_grid: 'required',
  catalogue_index: 'required',
  diagnostic_cta: 'recommended',
  resources_pointers: 'recommended',
  brands_grid: 'recommended',
  trust_usps: 'required',
  blog_preview: 'optional',
  popular_searches: 'optional',
  faq_commercial: 'recommended',
  footer: 'required',
} as const;

// ── Section Intent Mapping ──────────────────────────────

export interface R0SectionMapping {
  target_intent: string;
  query_types: R0QueryType[];
  copy_vocabulary: string[];
  forbidden_vocabulary: string[];
  cta_type: 'search' | 'link' | 'anchor' | 'none';
  link_targets: string[];
}

export type R0QueryType =
  | 'navigationnel'
  | 'orientationnel'
  | 'commercial_large'
  | 'informationnel_leger'
  | 'trust_service'
  | 'marque_brand';

export const R0_SECTION_MAP: Record<string, R0SectionMapping> = {
  hero_search: {
    target_intent: 'Recherche pièce compatible',
    query_types: ['commercial_large', 'navigationnel'],
    copy_vocabulary: [
      'pièce compatible',
      'véhicule',
      'recherche',
      'référence OE',
      'Type Mine',
      'immatriculation',
      'trouver',
    ],
    forbidden_vocabulary: [
      'meilleur',
      'comparatif',
      'guide',
      'comment changer',
      'symptôme',
      'définition',
      'procédure',
    ],
    cta_type: 'search',
    link_targets: [],
  },
  quick_access_grid: {
    target_intent: 'Distribution vers les parcours',
    query_types: ['orientationnel', 'navigationnel'],
    copy_vocabulary: [
      'par véhicule',
      'par famille',
      'par constructeur',
      'par référence',
      'diagnostic',
      'guides',
      'parcours',
    ],
    forbidden_vocabulary: ['acheter', 'prix', 'pas cher', 'promotion'],
    cta_type: 'link',
    link_targets: ['R1', 'R5', 'R6'],
  },
  catalogue_index: {
    target_intent: 'Exploration taxonomie familles',
    query_types: ['navigationnel', 'commercial_large'],
    copy_vocabulary: [
      'catalogue',
      'familles',
      'pièces auto',
      'filtration',
      'freinage',
      'distribution',
      'embrayage',
      'suspension',
    ],
    forbidden_vocabulary: [
      'comment choisir',
      'meilleur',
      'comparatif',
      'remplacer',
      'symptôme',
      'procédure',
      'tutoriel',
    ],
    cta_type: 'link',
    link_targets: ['R1'],
  },
  diagnostic_cta: {
    target_intent: 'Orientation vers diagnostic',
    query_types: ['orientationnel'],
    copy_vocabulary: [
      'diagnostic',
      'symptôme',
      'identifier',
      'panne',
      'pièce à vérifier',
    ],
    forbidden_vocabulary: [
      'cause détaillée',
      'procédure',
      'code défaut',
      'DTC',
      'démontage',
      'voyant moteur causes',
      'fumée noire causes',
    ],
    cta_type: 'link',
    link_targets: ['R5'],
  },
  resources_pointers: {
    target_intent: 'Distribution vers contenus éducatifs',
    query_types: ['orientationnel', 'informationnel_leger'],
    copy_vocabulary: [
      'guides',
      'références',
      'conseils',
      'aide',
      'choisir',
      'vérifier',
    ],
    forbidden_vocabulary: [
      'étape 1',
      'tutoriel',
      'pas-à-pas',
      'définition',
      'glossaire',
      'encyclopédie',
    ],
    cta_type: 'link',
    link_targets: ['R3', 'R4', 'R5', 'R6'],
  },
  brands_grid: {
    target_intent: 'Navigation constructeurs/équipementiers',
    query_types: ['navigationnel', 'marque_brand'],
    copy_vocabulary: [
      'constructeur',
      'marque',
      'modèle',
      'motorisation',
      'équipementier',
    ],
    forbidden_vocabulary: [
      'meilleur constructeur',
      'classement',
      'versus',
      'comparatif marques',
    ],
    cta_type: 'link',
    link_targets: ['R1'],
  },
  trust_usps: {
    target_intent: 'Réassurance commerciale',
    query_types: ['trust_service', 'marque_brand'],
    copy_vocabulary: [
      'compatibilité vérifiée',
      'pièces neuves',
      'grandes marques',
      'support technique',
      'livraison rapide',
      'retours',
      'qualité certifiée',
    ],
    forbidden_vocabulary: [
      'garantie constructeur',
      'certification ISO',
      'homologation',
      'norme européenne',
      'label qualité',
    ],
    cta_type: 'none',
    link_targets: [],
  },
  blog_preview: {
    target_intent: 'Aperçu contenus (liens externes)',
    query_types: ['informationnel_leger'],
    copy_vocabulary: ['blog', 'guides', 'articles', 'conseils'],
    forbidden_vocabulary: ['guide complet', 'tout savoir', 'dossier'],
    cta_type: 'link',
    link_targets: ['R3', 'R6'],
  },
  popular_searches: {
    target_intent: 'Maillage interne R0→R1',
    query_types: ['commercial_large', 'orientationnel'],
    copy_vocabulary: [
      'trouver',
      'vérifier',
      'choisir',
      'identifier',
      'comparer',
    ],
    forbidden_vocabulary: ['acheter', 'prix', 'promo', 'meilleur prix'],
    cta_type: 'link',
    link_targets: ['R1'],
  },
  faq_commercial: {
    target_intent: 'Réassurance fonctionnelle',
    query_types: ['trust_service'],
    copy_vocabulary: [
      'livraison',
      'retour',
      'garantie',
      'paiement',
      'délai',
      'compatibilité',
      'professionnel',
    ],
    forbidden_vocabulary: [
      'symptôme',
      'diagnostic',
      'remplacement',
      'montage',
      'couple de serrage',
      'procédure',
    ],
    cta_type: 'none',
    link_targets: [],
  },
} as const;

// ── Query Decision Matrix ───────────────────────────────

export type R0QueryDecision = 'KEEP' | 'LIMIT' | 'EXCLUDE';

export interface R0QueryRule {
  pattern: RegExp;
  intent_type:
    | R0QueryType
    | 'transactionnel_profond'
    | 'diagnostic_detaille'
    | 'educatif'
    | 'encyclopedique';
  best_role: string;
  decision: R0QueryDecision;
  rationale: string;
}

/**
 * Matrice de décision : quelles requêtes R0 peut cibler.
 * KEEP = R0 cible directement
 * LIMIT = R0 mentionne mais ne développe pas (pointer)
 * EXCLUDE = interdit sur R0
 */
export const R0_QUERY_DECISION_RULES: R0QueryRule[] = [
  // ── KEEP : requêtes légitimes R0 ──
  {
    pattern: /pi[eè]ces?\s+auto/i,
    intent_type: 'commercial_large',
    best_role: 'R0',
    decision: 'KEEP',
    rationale: "Requête d'entrée large compatible avec un hub",
  },
  {
    pattern: /catalogue\s+pi[eè]ces/i,
    intent_type: 'navigationnel',
    best_role: 'R0',
    decision: 'KEEP',
    rationale: 'Navigation catalogue = rôle R0',
  },
  {
    pattern: /recherche\s+(pi[eè]ce|par\s+v[eé]hicule|par\s+r[eé]f[eé]rence)/i,
    intent_type: 'orientationnel',
    best_role: 'R0',
    decision: 'KEEP',
    rationale: 'Orientation recherche = mission R0',
  },
  {
    pattern: /pi[eè]ces?\s+(compatibles?|neuves?|toutes?\s+marques?)/i,
    intent_type: 'commercial_large',
    best_role: 'R0',
    decision: 'KEEP',
    rationale: 'Requête commerciale large = hub',
  },
  {
    pattern: /type\s+mine|immatriculation/i,
    intent_type: 'orientationnel',
    best_role: 'R0',
    decision: 'KEEP',
    rationale: 'Mode de recherche = fonctionnalité R0',
  },
  {
    pattern: /constructeur|marque\s+auto/i,
    intent_type: 'navigationnel',
    best_role: 'R0',
    decision: 'KEEP',
    rationale: 'Navigation marques = distribution R0',
  },

  // ── LIMIT : R0 mentionne sans développer ──
  {
    pattern: /diagnostic\s+auto/i,
    intent_type: 'orientationnel',
    best_role: 'R5',
    decision: 'LIMIT',
    rationale: 'R0 pointe vers R5, pas de contenu diagnostic',
  },
  {
    pattern: /guide\s+d['']achat/i,
    intent_type: 'informationnel_leger',
    best_role: 'R6',
    decision: 'LIMIT',
    rationale: 'R0 pointe vers R6, pas de guide embarqué',
  },
  {
    pattern: /conseil\s+(entretien|technique)/i,
    intent_type: 'informationnel_leger',
    best_role: 'R3',
    decision: 'LIMIT',
    rationale: 'R0 pointe vers R3, pas de contenu éducatif',
  },
  {
    pattern: /r[eé]f[eé]rence\s+technique/i,
    intent_type: 'informationnel_leger',
    best_role: 'R4',
    decision: 'LIMIT',
    rationale: 'R0 pointe vers R4, pas de définition',
  },

  // ── EXCLUDE : interdit sur R0 ──
  {
    pattern: /sympt[oô]mes?\s+.+\s+(hs|d[eé]faillant|cass[eé]|us[eé])/i,
    intent_type: 'diagnostic_detaille',
    best_role: 'R5',
    decision: 'EXCLUDE',
    rationale: 'Diagnostic symptômes détaillé = R5 exclusif',
  },
  {
    pattern: /comment\s+(changer|remplacer|d[eé]monter|installer)/i,
    intent_type: 'educatif',
    best_role: 'R3',
    decision: 'EXCLUDE',
    rationale: 'Procédure de remplacement = R3 exclusif',
  },
  {
    pattern: /(meilleur|quelle?\s+marque|quel\s+choix|comparatif)\s+/i,
    intent_type: 'educatif',
    best_role: 'R6',
    decision: 'EXCLUDE',
    rationale: "Comparatif / guide d'achat = R6 exclusif",
  },
  {
    pattern: /qu['']est[- ]ce\s+qu['']un|d[eé]finition|r[oô]le\s+(du|de\s+la)/i,
    intent_type: 'encyclopedique',
    best_role: 'R4',
    decision: 'EXCLUDE',
    rationale: 'Définition technique = R4 exclusif',
  },
  {
    pattern: /voyant\s+.+\s+(allum[eé]|causes?)/i,
    intent_type: 'diagnostic_detaille',
    best_role: 'R5',
    decision: 'EXCLUDE',
    rationale: 'Voyant + causes = R5 exclusif',
  },
  {
    pattern: /fum[eé]e\s+(blanche|noire|bleue)/i,
    intent_type: 'diagnostic_detaille',
    best_role: 'R5',
    decision: 'EXCLUDE',
    rationale: 'Symptôme fumée = R5 exclusif',
  },
  {
    pattern:
      /(peugeot|renault|citro[eë]n|volkswagen|bmw|audi|mercedes|dacia|ford|opel|toyota|hyundai|kia)\s+\d{3}/i,
    intent_type: 'transactionnel_profond',
    best_role: 'R1',
    decision: 'EXCLUDE',
    rationale: 'Requête véhicule+modèle spécifique = R1 exclusif',
  },
  {
    pattern: /\b\d{4,}\s*(oem|oe)\b/i,
    intent_type: 'transactionnel_profond',
    best_role: 'R1',
    decision: 'EXCLUDE',
    rationale: 'Référence OE spécifique = R1 exclusif',
  },
];

// ── Anti-Cannibalization Rules ───────────────────────────

/**
 * Termes réservés par rôle — R0 ne doit JAMAIS les développer.
 * R0 peut les mentionner comme ancre de lien, mais pas comme contenu.
 */
export const R0_TERMS_RESERVED_BY_ROLE = {
  R1: [
    'disque de frein',
    'plaquette de frein',
    'filtre à huile',
    'kit de distribution',
    'amortisseur',
    'alternateur',
    'vanne EGR',
    'turbo',
    'injecteur',
    'pompe à eau',
  ],
  R3: [
    'comment changer',
    'comment remplacer',
    'procédure de remplacement',
    'tutoriel',
    'pas-à-pas',
    'étape 1',
    'outils nécessaires',
    'couple de serrage',
    "temps d'intervention",
    'niveau de difficulté',
    'entretien préventif',
    'calendrier entretien',
    'quand remplacer',
  ],
  R4: [
    'définition',
    "qu'est-ce qu'un",
    'rôle du',
    'fonction de',
    'se compose de',
    'glossaire',
    'encyclopédie',
    'différence entre',
    'ne pas confondre avec',
  ],
  R5: [
    'symptômes',
    'causes possibles',
    'diagnostic détaillé',
    'code défaut',
    'DTC',
    'voyant moteur causes',
    'bruit anormal causes',
    'fumée noire causes',
    'perte de puissance causes',
    'surchauffe moteur causes',
  ],
  R6: [
    'meilleure marque',
    'quel choix',
    'comparatif',
    'comment choisir',
    "guide d'achat complet",
    'organique vs céramique',
    'OE vs aftermarket',
    'critères de choix',
    'top 5',
    'classement',
  ],
} as const;

// ── Forbidden Vocabulary (R0-wide) ──────────────────────

/**
 * Vocabulaire interdit sur toute la homepage.
 * Détecté = flag bloquant.
 */
export const R0_FORBIDDEN_VOCABULARY = [
  // R3 leaks
  'démontage',
  'démonter',
  'dépose',
  'remontage',
  'remonter',
  'repose',
  'outils nécessaires',
  'couple de serrage',
  'pas-à-pas',
  'étape 1',
  'étape 2',
  'étape 3',
  "temps d'intervention",
  'niveau de difficulté',
  'procédure de remplacement',
  'comment remplacer',
  'comment changer',
  'tutoriel',
  // R4 leaks
  'définition',
  'par définition',
  'au sens strict',
  'se compose de',
  'glossaire',
  'désigne',
  'ne pas confondre avec',
  "qu'est-ce qu'un",
  'encyclopédie',
  // R5 leaks
  'code défaut',
  'DTC',
  'OBD',
  'fumée blanche causes',
  'fumée noire causes',
  'voyant moteur causes',
  'diagnostic détaillé',
  // R6 leaks
  'guide complet',
  'comparatif détaillé',
  'top 5',
  'classement',
  'organique vs céramique',
  'OE vs aftermarket',
  'meilleure marque de',
] as const;

// ── Generic Phrase Patterns ─────────────────────────────

/**
 * Phrases génériques interdites sur R0 (même pattern que R5).
 * Signal de contenu template / remplissage.
 */
export const R0_GENERIC_PATTERNS: RegExp[] = [
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
];

// ── Quality Flags ───────────────────────────────────────

export const R0_BLOCKING_FLAGS = [
  'MISSING_H1',
  'MISSING_SEARCH_MODULE',
  'MISSING_TRUST_BLOCK',
  'R3_CONTENT_LEAK',
  'R4_CONTENT_LEAK',
  'R5_CONTENT_LEAK',
  'R6_CONTENT_LEAK',
  'EDUCATIONAL_CONTENT_EMBEDDED',
  'FORBIDDEN_VOCABULARY_DETECTED',
] as const;

export const R0_WARNING_FLAGS = [
  'SECTION_REDUNDANCY',
  'WEAK_H1',
  'MISSING_DIAGNOSTIC_CTA',
  'MISSING_BLOG_PREVIEW',
  'MISSING_POPULAR_SEARCHES',
  'TOO_MANY_SECTIONS',
  'MISSING_INTERNAL_LINKS_TO_R1',
  'MISSING_INTERNAL_LINKS_TO_R5',
  'GENERIC_PHRASE_DETECTED',
  'META_DESCRIPTION_LENGTH',
] as const;

export type R0BlockingFlag = (typeof R0_BLOCKING_FLAGS)[number];
export type R0WarningFlag = (typeof R0_WARNING_FLAGS)[number];
export type R0QualityFlag = R0BlockingFlag | R0WarningFlag;

// ── Quality Thresholds ──────────────────────────────────

export const R0_QUALITY_THRESHOLDS = {
  maxSections: 12,
  minMetaDescLength: 140,
  maxMetaDescLength: 160,
  maxH1Length: 65,
  maxGenericRatio: 0.02,
  maxForbiddenTermCount: 0,
  minInternalLinksR1: 3,
  minInternalLinksR5: 1,
  maxFamiliesVisibleDesktop: 6,
  maxBrandsVisibleDesktop: 12,
  maxBlogArticles: 4,
  maxFaqItems: 5,
} as const;

// ── Coverage Budget ─────────────────────────────────────

/**
 * Budget de couverture sémantique R0.
 * R0 ne doit pas chercher à couvrir tout le champ sémantique.
 */
export const R0_COVERAGE_BUDGET = {
  core: [
    'pièce auto',
    'compatibilité véhicule',
    'recherche par référence',
    'catalogue pièces',
    'constructeur auto',
    'diagnostic léger',
    'confiance service',
    'livraison pièces auto',
  ],
  secondary: [
    'guides pièces auto',
    'références techniques',
    'aide au choix',
    'support technique',
  ],
  excluded: [
    'symptômes détaillés',
    'comparatifs détaillés',
    'procédures de remplacement',
    'définitions techniques profondes',
    'catégories véhicule+pièce spécifiques',
    'longue traîne ultra-spécifique',
  ],
} as const;

// ── Internal Linking Plan ───────────────────────────────

export interface R0InternalLink {
  anchor_pattern: string;
  destination_role: string;
  destination_url_pattern: string;
  purpose: string;
}

export const R0_INTERNAL_LINKING_PLAN: R0InternalLink[] = [
  {
    anchor_pattern: 'Par véhicule|Recherche par véhicule',
    destination_role: 'R0',
    destination_url_pattern: '#hero-v9',
    purpose: 'Orientation intra-page vers le sélecteur',
  },
  {
    anchor_pattern: 'Par famille|Explorer les familles',
    destination_role: 'R0',
    destination_url_pattern: '#catalogue',
    purpose: 'Orientation intra-page vers le catalogue',
  },
  {
    anchor_pattern: 'Par constructeur|Voir les marques',
    destination_role: 'R0',
    destination_url_pattern: '#marques',
    purpose: 'Orientation intra-page vers les marques',
  },
  {
    anchor_pattern: 'Diagnostic|Lancer le diagnostic',
    destination_role: 'R5',
    destination_url_pattern: '/diagnostic-auto',
    purpose: 'Distribution vers R5',
  },
  {
    anchor_pattern: "Guides d'achat|Guides & conseils",
    destination_role: 'R6',
    destination_url_pattern: '/blog-pieces-auto/guide-achat',
    purpose: 'Distribution vers R6',
  },
  {
    anchor_pattern: 'Réf. techniques|Références',
    destination_role: 'R4',
    destination_url_pattern: '/reference-auto',
    purpose: 'Distribution vers R4',
  },
  {
    anchor_pattern: "Conseils d'entretien",
    destination_role: 'R3',
    destination_url_pattern: '/blog-pieces-auto/conseil',
    purpose: 'Distribution vers R3',
  },
  {
    anchor_pattern: '{famille}|Voir les pièces',
    destination_role: 'R1',
    destination_url_pattern: '/pieces/{slug}-{id}.html',
    purpose: 'Distribution catalogue vers R1',
  },
  {
    anchor_pattern: '{constructeur}',
    destination_role: 'R1',
    destination_url_pattern: '/constructeurs/{slug}-{id}.html',
    purpose: 'Distribution marques vers R1',
  },
];

// ── Heading Plan Constraints ────────────────────────────

export const R0_HEADING_CONSTRAINTS = {
  h1: {
    must_contain: ['pièce', 'compatible', 'véhicule'],
    must_not_contain: [
      'meilleur',
      'guide',
      'comment',
      'symptôme',
      'définition',
    ],
    max_length: 65,
    intent: 'commercial_large + orientationnel',
  },
  h2: {
    allowed_intents: ['navigationnel', 'orientationnel', 'trust_service'],
    forbidden_intents: ['educatif', 'diagnostic_detaille', 'encyclopedique'],
    max_count: 10,
  },
  h3: {
    allowed_for: [
      'famille_names',
      'usp_titles',
      'faq_questions',
      'blog_titles',
    ],
    forbidden_content: ['procédure', 'étape', 'définition', 'comparatif'],
  },
} as const;
