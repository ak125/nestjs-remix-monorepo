/**
 * FAMILY_REGISTRY — Source unique des métadonnées famille produit
 *
 * Les NOMS et l'ORDRE viennent de la DB (CatalogHierarchyService).
 * Ce fichier contient uniquement les enrichissements statiques keyed par mf_id (stable).
 *
 * Usage :
 *   import { FAMILY_REGISTRY, findFamilyIdByKeyword, FAMILY_DOMAIN_GROUPS } from '@repo/database-types';
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FamilyDomain = 'moteur' | 'chassis' | 'transmission' | 'electrique';

export interface FamilyMeta {
  /** Couleur de base Tailwind (ex: "red", "blue") */
  baseColor: string;
  /** Gradient Tailwind (ex: "from-red-600 to-rose-700") */
  gradient: string;
  /** Nom icône Lucide (ex: "Filter", "Disc") */
  icon: string;
  /** Emoji fallback pour SSR/text */
  emoji: string;
  /** Image filename (dans /img/uploads/articles/familles-produits/) */
  pic: string;
  /** Domaine technique (pour groupement onglets) */
  domain: FamilyDomain;
  /** Mots-clés pour matcher blog tags, gamme names, etc. (lowercase, sans accents) */
  keywords: string[];
  /** Termes SEO requis pour validation contenu */
  seoTerms: string[];
  /** Texte SEO switch par défaut */
  seoSwitch: string;
}

// ---------------------------------------------------------------------------
// Registre — 19 familles keyed par mf_id (DB catalog_family.mf_id)
// ---------------------------------------------------------------------------

export const FAMILY_REGISTRY: Record<number, FamilyMeta> = {
  1: {
    baseColor: 'blue',
    gradient: 'from-blue-500 to-blue-700',
    icon: 'Filter',
    emoji: '🛢️',
    pic: 'Filtres.webp',
    domain: 'moteur',
    keywords: ['filtration', 'filtre', 'filtres', 'système de filtration'],
    seoTerms: ['filtre', 'filtration', 'remplacement', 'entretien'],
    seoSwitch: 'nos pièces de qualité',
  },
  2: {
    baseColor: 'red',
    gradient: 'from-red-600 to-rose-700',
    icon: 'Disc',
    emoji: '🛞',
    pic: 'Freinage.webp',
    domain: 'chassis',
    keywords: ['freinage', 'frein', 'système de freinage'],
    seoTerms: ['frein', 'freinage', 'distance', 'sécurité'],
    seoSwitch: 'notre sélection premium',
  },
  3: {
    baseColor: 'slate',
    gradient: 'from-slate-600 to-slate-800',
    icon: 'Link',
    emoji: '⛓️',
    pic: 'Courroie_galet_poulie.webp',
    domain: 'transmission',
    keywords: ['distribution', 'courroie', 'galet', 'poulie', 'chaine', 'courroie et distribution'],
    seoTerms: ['courroie', 'distribution', 'galet', 'synchronisation'],
    seoSwitch: 'nos équipements performants',
  },
  4: {
    baseColor: 'yellow',
    gradient: 'from-yellow-400 to-amber-600',
    icon: 'Flame',
    emoji: '🔥',
    pic: 'Allumage_Prechauffage.webp',
    domain: 'moteur',
    keywords: ['allumage', 'prechauffage', 'electrique', 'batterie', 'allumage et préchauffage', 'allumage et prechauffage'],
    seoTerms: ['allumage', 'préchauffage', 'bougie', 'démarrage'],
    seoSwitch: 'nos composants certifiés',
  },
  5: {
    baseColor: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    icon: 'Navigation',
    emoji: '🔧',
    pic: 'Direction.webp',
    domain: 'chassis',
    keywords: ['direction', 'train', 'cremaillere', 'liaison', 'direction et liaison au sol'],
    seoTerms: ['direction', 'rotule', 'bras', 'tenue de route'],
    seoSwitch: 'notre gamme complète',
  },
  6: {
    baseColor: 'purple',
    gradient: 'from-purple-600 to-violet-700',
    icon: 'ArrowDownUp',
    emoji: '🏎️',
    pic: 'Amortisseur.webp',
    domain: 'chassis',
    keywords: ['amortisseur', 'suspension', 'ressort', 'amortisseur et suspension'],
    seoTerms: ['suspension', 'amortisseur', 'stabilité', 'confort'],
    seoSwitch: 'nos produits fiables',
  },
  7: {
    baseColor: 'indigo',
    gradient: 'from-indigo-500 to-blue-700',
    icon: 'Cog',
    emoji: '⚙️',
    pic: 'Support.webp',
    domain: 'moteur',
    keywords: ['support', 'silent', 'tampon', 'support moteur'],
    seoTerms: ['support', 'moteur', 'vibration', 'fixation'],
    seoSwitch: "nos pièces d'origine",
  },
  9: {
    baseColor: 'pink',
    gradient: 'from-pink-500 to-rose-600',
    icon: 'CircleDot',
    emoji: '🔩',
    pic: 'Embrayage.webp',
    domain: 'transmission',
    keywords: ['embrayage', 'volant', 'embrayage'],
    seoTerms: ['embrayage', 'butée', 'kit', 'passage de vitesses'],
    seoSwitch: 'notre catalogue spécialisé',
  },
  10: {
    baseColor: 'orange',
    gradient: 'from-orange-600 to-red-700',
    icon: 'ArrowRightLeft',
    emoji: '🔗',
    pic: 'Transmission.webp',
    domain: 'transmission',
    keywords: ['transmission', 'boite', 'differentiel'],
    seoTerms: ['transmission', 'cardan', 'couple', 'motricité'],
    seoSwitch: 'nos solutions techniques',
  },
  11: {
    baseColor: 'amber',
    gradient: 'from-amber-600 to-orange-700',
    icon: 'Zap',
    emoji: '⚡',
    pic: 'Systeme_electrique.webp',
    domain: 'electrique',
    keywords: ['electrique', 'système électrique', 'système electrique'],
    seoTerms: ['électrique', 'alternateur', 'démarreur', 'batterie'],
    seoSwitch: 'nos pièces moteur haute performance',
  },
  12: {
    baseColor: 'teal',
    gradient: 'from-teal-600 to-cyan-700',
    icon: 'Radio',
    emoji: '📡',
    pic: 'Capteurs.webp',
    domain: 'electrique',
    keywords: ['capteur', 'sonde', 'calculateur', 'capteurs', 'capteurs et sondes'],
    seoTerms: ['capteur', 'sonde', 'signal', 'diagnostic'],
    seoSwitch: 'nos systèmes de freinage éprouvés',
  },
  13: {
    baseColor: 'lime',
    gradient: 'from-lime-500 to-green-600',
    icon: 'Fuel',
    emoji: '⛽',
    pic: 'Alimentation.webp',
    domain: 'moteur',
    keywords: ['alimentation', 'carburant', 'essence', 'diesel', "système d'alimentation"],
    seoTerms: ['alimentation', 'carburant', 'injection', 'pompe'],
    seoSwitch: 'nos équipements électriques certifiés',
  },
  14: {
    baseColor: 'gray',
    gradient: 'from-gray-700 to-neutral-800',
    icon: 'Wrench',
    emoji: '🔧',
    pic: 'Moteur.webp',
    domain: 'moteur',
    keywords: ['moteur', 'bloc'],
    seoTerms: ['moteur', 'joint', 'culasse', 'vilebrequin'],
    seoSwitch: 'nos composants de suspension premium',
  },
  15: {
    baseColor: 'cyan',
    gradient: 'from-cyan-400 to-blue-600',
    icon: 'Thermometer',
    emoji: '🌡️',
    pic: 'Refroidissement.webp',
    domain: 'moteur',
    keywords: ['refroidissement', 'radiateur', 'eau', 'liquide'],
    seoTerms: ['refroidissement', 'pompe', 'radiateur', 'thermostat'],
    seoSwitch: 'nos pièces de transmission robustes',
  },
  16: {
    baseColor: 'sky',
    gradient: 'from-sky-400 to-cyan-600',
    icon: 'Snowflake',
    emoji: '❄️',
    pic: 'Climatisation.webp',
    domain: 'electrique',
    keywords: ['climatisation', 'clim', 'condenseur'],
    seoTerms: ['climatisation', 'froid', 'pression', 'compresseur'],
    seoSwitch: "nos éléments de carrosserie d'origine",
  },
  17: {
    baseColor: 'rose',
    gradient: 'from-rose-600 to-pink-700',
    icon: 'Wind',
    emoji: '💨',
    pic: 'Echappement.webp',
    domain: 'moteur',
    keywords: ['echappement', 'silencieux', 'pot', 'échappement'],
    seoTerms: ['échappement', 'catalyseur', 'FAP', 'sonde lambda'],
    seoSwitch: 'nos équipements adaptés',
  },
  18: {
    baseColor: 'fuchsia',
    gradient: 'from-fuchsia-500 to-pink-600',
    icon: 'Lightbulb',
    emoji: '💡',
    pic: 'Eclairage.webp',
    domain: 'electrique',
    keywords: ['eclairage', 'phare', 'feu', 'éclairage'],
    seoTerms: ['éclairage', 'phare', 'feu', 'signalisation'],
    seoSwitch: 'nos solutions techniques',
  },
  19: {
    baseColor: 'green',
    gradient: 'from-emerald-600 to-green-700',
    icon: 'Package',
    emoji: '🧹',
    pic: 'Accessoires.webp',
    domain: 'electrique',
    keywords: ['accessoire', 'interieur', 'equipement', 'accessoires'],
    seoTerms: ['accessoire', 'essuie-glace', 'rétroviseur', 'confort'],
    seoSwitch: 'nos produits fiables',
  },
  20: {
    baseColor: 'violet',
    gradient: 'from-violet-600 to-purple-800',
    icon: 'Gauge',
    emoji: '🌀',
    pic: 'Turbo.webp',
    domain: 'moteur',
    keywords: ['turbo', 'compresseur', 'suralimentation'],
    seoTerms: ['turbo', 'suralimentation', 'pression', 'puissance'],
    seoSwitch: 'nos composants certifiés',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise une string pour matching : lowercase, sans accents */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Trouve le mf_id depuis un mot-clé, nom de famille ou tag blog.
 * Cherche dans FAMILY_REGISTRY[id].keywords.
 * Retourne undefined si aucun match.
 */
export function findFamilyIdByKeyword(input: string): number | undefined {
  const normalized = normalize(input);
  for (const [idStr, meta] of Object.entries(FAMILY_REGISTRY)) {
    if (meta.keywords.some((kw) => normalize(kw) === normalized || normalized.includes(normalize(kw)))) {
      return Number(idStr);
    }
  }
  return undefined;
}

/**
 * Retourne les métadonnées d'une famille par son mf_id.
 * Fallback gris neutre si ID inconnu.
 */
export function getFamilyMeta(mfId: number): FamilyMeta {
  return (
    FAMILY_REGISTRY[mfId] ?? {
      baseColor: 'gray',
      gradient: 'from-gray-500 to-gray-700',
      icon: 'HelpCircle',
      emoji: '❓',
      pic: '',
      domain: 'moteur' as FamilyDomain,
      keywords: [],
      seoTerms: [],
      seoSwitch: 'nos pièces de qualité',
    }
  );
}

// ---------------------------------------------------------------------------
// Domain groupings (pour onglets catalogue) — keyed par mf_id, PAS par nom
// ---------------------------------------------------------------------------

export const FAMILY_DOMAIN_GROUPS: { label: string; icon: string; familyIds: number[] | null }[] = [
  { label: 'Tout', icon: 'Car', familyIds: null },
  {
    label: 'Moteur',
    icon: 'Wrench',
    familyIds: [1, 4, 7, 13, 14, 15, 17, 20],
  },
  {
    label: 'Freinage & Châssis',
    icon: 'Shield',
    familyIds: [2, 5, 6],
  },
  {
    label: 'Transmission',
    icon: 'Cog',
    familyIds: [3, 9, 10],
  },
  {
    label: 'Électrique & Confort',
    icon: 'Zap',
    familyIds: [11, 12, 16, 18, 19],
  },
];

// ---------------------------------------------------------------------------
// Ordered family IDs (aligned with DB mf_sort)
// ---------------------------------------------------------------------------

export const FAMILY_IDS_ORDERED: number[] = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
