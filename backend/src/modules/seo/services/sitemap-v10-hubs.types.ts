/**
 * 🔗 TYPES & CONSTANTS - HUBS CRAWL V10
 *
 * Types, interfaces, constants et utilitaires partagés
 * entre les services de génération de hubs.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export type HubType =
  | 'money'
  | 'new-pages'
  | 'stabilize'
  | 'gammes'
  | 'vehicules'
  | 'clusters';

export interface HubConfig {
  title: string;
  description: string;
  bucket?: 'hot' | 'new' | 'stable' | 'cold';
  pageTypes?: string[];
  maxUrls: number;
}

export interface SubCategory {
  name: string;
  gamme_names: string[];
}

export interface FamilyClusterConfig {
  title: string;
  description: string;
  subcategories: SubCategory[];
}

export interface UrlWithPriority {
  url: string;
  subcategory: string;
  hasItem: number;
}

export interface HubGenerationResult {
  success: boolean;
  hubType: HubType;
  urlCount: number;
  filePath: string;
  error?: string;
}

// Legacy: Garder pour compatibilité (sera supprimé)
export interface ClusterConfig {
  title: string;
  description: string;
  gamme_slugs: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES PAGINATION
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_URLS_PER_PART = 5000; // Max URLs par fichier part (idéal pour crawl)

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION DES HUBS
// ═══════════════════════════════════════════════════════════════════════════

export const HUB_CONFIGS: Record<HubType, HubConfig> = {
  money: {
    title: 'Pages prioritaires - Automecanik',
    description: 'Pages produits à fort trafic et conversion',
    bucket: 'hot',
    maxUrls: 5000,
  },
  'new-pages': {
    title: 'Nouvelles pages - Automecanik',
    description: 'Pages récemment publiées ou mises à jour',
    bucket: 'new',
    maxUrls: 1000,
  },
  stabilize: {
    title: 'Pages à stabiliser (J7) - Automecanik',
    description: 'Pages indexées depuis 7 jours nécessitant stabilisation',
    maxUrls: 2000,
  },
  gammes: {
    title: 'Catégories pièces auto - Automecanik',
    description: 'Toutes les catégories de pièces automobiles',
    pageTypes: ['category', 'canonical'],
    maxUrls: 500,
  },
  vehicules: {
    title: 'Véhicules compatibles - Automecanik',
    description: 'Toutes les marques et modèles de véhicules',
    pageTypes: ['listing', 'hub'],
    maxUrls: 2000,
  },
  clusters: {
    title: 'Groupes thématiques - Automecanik',
    description: 'Pages regroupées par thème',
    bucket: 'stable',
    maxUrls: 3000,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 19 CLUSTERS FAMILLES - Structure optimisée SEO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔧 19 CLUSTERS FAMILLES - Structure optimisée SEO
 *
 * Stratégie: 1 fichier HTML par famille avec sections H2 par sous-catégorie
 * Avantages:
 * - Link juice concentré (19 fichiers vs 73)
 * - Crawl budget optimal
 * - Autorité thématique forte
 *
 * Source: catalog_family → pieces_gamme
 */
export const FAMILY_CLUSTERS: Record<string, FamilyClusterConfig> = {
  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 1: FILTRES
  // ═══════════════════════════════════════════════════════════════════
  filtres: {
    title: 'Filtres - Automecanik',
    description:
      'Tous les filtres automobile: huile, air, habitacle, carburant',
    subcategories: [
      { name: 'Filtre à huile', gamme_names: ['Filtre à huile'] },
      { name: 'Filtre à air', gamme_names: ['Filtre à air'] },
      { name: 'Filtre à carburant', gamme_names: ['Filtre à carburant'] },
      { name: "Filtre d'habitacle", gamme_names: ["Filtre d'habitacle"] },
      { name: 'Filtre de boîte auto', gamme_names: ['Filtre de boîte auto'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 2: FREINAGE
  // ═══════════════════════════════════════════════════════════════════
  freinage: {
    title: 'Freinage - Automecanik',
    description:
      'Système de freinage complet: plaquettes, disques, étriers, flexibles',
    subcategories: [
      { name: 'Plaquettes de frein', gamme_names: ['Plaquette de frein'] },
      { name: 'Disques de frein', gamme_names: ['Disque de frein'] },
      { name: 'Étriers de frein', gamme_names: ['Étrier de frein'] },
      {
        name: 'Mâchoires et kits arrière',
        gamme_names: ['Mâchoires de frein', 'Kit de freins arrière'],
      },
      { name: 'Capteurs ABS', gamme_names: ['Capteur ABS'] },
      {
        name: 'Flexibles et câbles',
        gamme_names: ['Flexible de frein', 'Câble de frein à main'],
      },
      {
        name: 'Maître cylindre et servo',
        gamme_names: [
          'Maître cylindre de frein',
          'Servo frein',
          'Cylindre de roue',
        ],
      },
      {
        name: 'Tambours et témoins',
        gamme_names: ['Tambour de frein', "Témoin d'usure"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 3: DISTRIBUTION
  // ═══════════════════════════════════════════════════════════════════
  distribution: {
    title: 'Distribution - Automecanik',
    description: 'Kits distribution, courroies, chaînes et pompes à eau',
    subcategories: [
      { name: 'Kit de distribution', gamme_names: ['Kit de distribution'] },
      {
        name: 'Courroie de distribution',
        gamme_names: ['Courroie de distribution'],
      },
      {
        name: 'Chaîne de distribution',
        gamme_names: [
          'Chaîne de distribution',
          'Kit de chaîne de distribution',
        ],
      },
      { name: "Courroie d'accessoire", gamme_names: ["Courroie d'accessoire"] },
      { name: 'Galet tendeur', gamme_names: ['Galet tendeur'] },
      { name: 'Pompe à eau', gamme_names: ['Pompe à eau'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 4: ALLUMAGE ET PRÉCHAUFFAGE
  // ═══════════════════════════════════════════════════════════════════
  allumage: {
    title: 'Allumage et Préchauffage - Automecanik',
    description: 'Bougies, bobines, faisceaux et préchauffage diesel',
    subcategories: [
      { name: "Bougies d'allumage", gamme_names: ["Bougie d'allumage"] },
      {
        name: 'Bougies de préchauffage',
        gamme_names: ['Bougie de préchauffage', 'Boîtier de préchauffage'],
      },
      { name: "Bobines d'allumage", gamme_names: ["Bobine d'allumage"] },
      { name: "Faisceaux d'allumage", gamme_names: ["Faisceau d'allumage"] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 5: DIRECTION ET LIAISON AU SOL
  // ═══════════════════════════════════════════════════════════════════
  direction: {
    title: 'Direction et Liaison au sol - Automecanik',
    description: 'Rotules, bras, biellettes, roulements et crémaillères',
    subcategories: [
      {
        name: 'Rotules',
        gamme_names: ['Rotule de direction', 'Rotule de suspension'],
      },
      { name: 'Bras de suspension', gamme_names: ['Bras de suspension'] },
      {
        name: 'Biellettes stabilisatrices',
        gamme_names: [
          'Biellette de barre stabilisatrice',
          'Barre stabilisatrice',
        ],
      },
      {
        name: 'Roulements de roue',
        gamme_names: ['Roulement de roue', 'Moyeu de roue'],
      },
      {
        name: 'Crémaillère de direction',
        gamme_names: ['Crémaillière de direction'],
      },
      { name: 'Barres de direction', gamme_names: ['Barre de direction'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 6: SUSPENSION
  // ═══════════════════════════════════════════════════════════════════
  suspension: {
    title: 'Amortisseurs et Suspension - Automecanik',
    description: 'Amortisseurs, butées et ressorts de suspension',
    subcategories: [
      { name: 'Amortisseurs', gamme_names: ['Amortisseur'] },
      {
        name: 'Ressorts de suspension',
        gamme_names: ['Ressort de suspension'],
      },
      {
        name: 'Butées de suspension',
        gamme_names: [
          'Kit de butée de suspension',
          "Butée élastique d'amortisseur",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 7: SUPPORT MOTEUR
  // ═══════════════════════════════════════════════════════════════════
  'support-moteur': {
    title: 'Support moteur - Automecanik',
    description: 'Supports moteur et boîte de vitesses',
    subcategories: [
      { name: 'Supports moteur', gamme_names: ['Support moteur'] },
      {
        name: 'Supports boîte de vitesse',
        gamme_names: ['Support de boîte vitesse'],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 8: EMBRAYAGE
  // ═══════════════════════════════════════════════════════════════════
  embrayage: {
    title: 'Embrayage - Automecanik',
    description: 'Kits embrayage, butées, volants moteur et commandes',
    subcategories: [
      { name: "Kit d'embrayage", gamme_names: ["Kit d'embrayage"] },
      { name: 'Volant moteur', gamme_names: ['Volant moteur'] },
      { name: "Butée d'embrayage", gamme_names: ["Butée d'embrayage"] },
      {
        name: 'Commande embrayage',
        gamme_names: [
          "Emetteur d'embrayage",
          "Récepteur d'embrayage",
          "Câble d'embrayage",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 9: TRANSMISSION
  // ═══════════════════════════════════════════════════════════════════
  transmission: {
    title: 'Transmission - Automecanik',
    description: 'Cardans, soufflets et transmissions',
    subcategories: [
      { name: 'Cardans', gamme_names: ['Cardan'] },
      {
        name: 'Soufflets de cardan',
        gamme_names: ['Soufflet de Cardan', "Bague d'étanchéité cardan"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 10: SYSTÈME ÉLECTRIQUE
  // ═══════════════════════════════════════════════════════════════════
  electrique: {
    title: 'Système électrique - Automecanik',
    description: 'Alternateurs, démarreurs et neimans',
    subcategories: [
      { name: 'Alternateurs', gamme_names: ['Alternateur'] },
      { name: 'Démarreurs', gamme_names: ['Démarreur'] },
      { name: 'Neimans', gamme_names: ['Neiman'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 11: CAPTEURS
  // ═══════════════════════════════════════════════════════════════════
  capteurs: {
    title: 'Capteurs - Automecanik',
    description: 'Tous les capteurs: ABS, vitesse, température, pression',
    subcategories: [
      { name: 'Capteurs vilebrequin', gamme_names: ['Capteur de vilebrequin'] },
      {
        name: 'Capteurs arbre à cames',
        gamme_names: ["Capteur d'arbre à cames"],
      },
      { name: 'Capteurs ABS', gamme_names: ['Capteur ABS'] },
      {
        name: 'Capteurs température',
        gamme_names: [
          "Capteur température d'eau",
          "Capteur température d'air admission",
          'Capteur température huile',
        ],
      },
      {
        name: 'Capteurs pression',
        gamme_names: [
          'Capteur de pression de suralimentation',
          'Capteur de pression Common Rail',
          "Capteur pression du tuyau d'admission",
        ],
      },
      {
        name: 'Autres capteurs',
        gamme_names: [
          'Capteur de cognement',
          "Capteur de pédale d'accélérateur",
          'Capteur position papillon',
          'Capteur de vitesse',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 12: ALIMENTATION
  // ═══════════════════════════════════════════════════════════════════
  alimentation: {
    title: "Système d'alimentation - Automecanik",
    description: 'Débitmètres, vannes EGR, pompes et injecteurs',
    subcategories: [
      { name: 'Injecteurs', gamme_names: ['Injecteur'] },
      { name: 'Vannes EGR', gamme_names: ['Vanne EGR'] },
      {
        name: 'Pompes à carburant',
        gamme_names: ['Pompe à carburant', 'Pompe à injection'],
      },
      { name: "Débitmètres d'air", gamme_names: ["Débitmètre d'air"] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 13: MOTEUR
  // ═══════════════════════════════════════════════════════════════════
  moteur: {
    title: 'Moteur - Automecanik',
    description: 'Joints, culasses, carters et pièces moteur',
    subcategories: [
      { name: 'Joints de culasse', gamme_names: ['Joint de culasse'] },
      { name: "Carters d'huile", gamme_names: ["Carter d'huile"] },
      {
        name: 'Joints et couvercles',
        gamme_names: [
          'Joint de cache culbuteurs',
          'Couvre culasse',
          'Joint cache culbuteur',
        ],
      },
      {
        name: 'Pièces moteur',
        gamme_names: [
          'Arbre à came',
          'Culasse',
          'Chemise de cylindre',
          'Poussoir',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 14: REFROIDISSEMENT
  // ═══════════════════════════════════════════════════════════════════
  refroidissement: {
    title: 'Refroidissement - Automecanik',
    description: 'Pompes à eau, radiateurs, thermostats et durits',
    subcategories: [
      { name: 'Pompes à eau', gamme_names: ['Pompe à eau'] },
      { name: 'Radiateurs', gamme_names: ['Radiateur de refroidissement'] },
      { name: 'Thermostats', gamme_names: ['Thermostat'] },
      {
        name: 'Durits et vases',
        gamme_names: [
          'Durite de refroidissement',
          "Vase d'expansion",
          'Bouchon de radiateur',
        ],
      },
      { name: 'Motoventilateurs', gamme_names: ['Motoventilateur'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 15: CLIMATISATION
  // ═══════════════════════════════════════════════════════════════════
  climatisation: {
    title: 'Climatisation - Automecanik',
    description: 'Compresseurs, condenseurs, évaporateurs et détendeurs',
    subcategories: [
      {
        name: 'Compresseurs de clim',
        gamme_names: ['Compresseur de climatisation'],
      },
      { name: 'Condenseurs', gamme_names: ['Condenseur de climatisation'] },
      { name: 'Évaporateurs', gamme_names: ['Evaporateur de climatisation'] },
      {
        name: 'Détendeurs et bouteilles',
        gamme_names: ['Détendeur de climatisation', 'Bouteille déshydratante'],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 16: ÉCHAPPEMENT
  // ═══════════════════════════════════════════════════════════════════
  echappement: {
    title: 'Échappement - Automecanik',
    description: 'Silencieux, catalyseurs, FAP et sondes lambda',
    subcategories: [
      { name: 'Catalyseurs', gamme_names: ['Catalyseur'] },
      { name: 'FAP', gamme_names: ['FAP'] },
      { name: 'Sondes lambda', gamme_names: ['Sonde lambda'] },
      {
        name: 'Silencieux et tubes',
        gamme_names: ['Silencieux', "Tube d'échappement"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 17: ÉCLAIRAGE
  // ═══════════════════════════════════════════════════════════════════
  eclairage: {
    title: 'Éclairage - Automecanik',
    description: 'Feux avant, arrière, clignotants et commandes',
    subcategories: [
      { name: 'Phares et feux avant', gamme_names: ['Feu avant'] },
      { name: 'Feux arrière', gamme_names: ['Feu arrière'] },
      { name: 'Clignotants', gamme_names: ['Feu clignotant'] },
      { name: "Commandes d'éclairage", gamme_names: ["Commande d'éclairage"] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 18: ACCESSOIRES
  // ═══════════════════════════════════════════════════════════════════
  accessoires: {
    title: 'Accessoires - Automecanik',
    description: 'Balais essuie-glace, rétroviseurs, lève-vitres et attelages',
    subcategories: [
      { name: 'Essuie-glaces', gamme_names: ["Balais d'essuie-glace"] },
      { name: 'Rétroviseurs', gamme_names: ['Rétroviseur extérieur'] },
      { name: 'Lève-vitres', gamme_names: ['Lève-vitre'] },
      { name: 'Attelages', gamme_names: ['Attelage'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 19: TURBO
  // ═══════════════════════════════════════════════════════════════════
  turbo: {
    title: 'Turbo - Automecanik',
    description: 'Turbos et intercoolers',
    subcategories: [
      { name: 'Turbos', gamme_names: ['Turbo'] },
      { name: 'Intercoolers', gamme_names: ['Intercooler'] },
    ],
  },
};

// Convertir FAMILY_CLUSTERS en ancien format pour compatibilité temporaire
export const CLUSTER_CONFIGS: Record<string, ClusterConfig> =
  Object.fromEntries(
    Object.entries(FAMILY_CLUSTERS).map(([slug, config]) => [
      slug,
      {
        title: config.title,
        description: config.description,
        gamme_slugs: config.subcategories.flatMap((sub) => sub.gamme_names),
      },
    ]),
  );

// ═══════════════════════════════════════════════════════════════════════════
// PURE UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateSignature(
  urlCount: number,
  pipeline: string = 'v10-robust',
): string {
  return `
<!-- ═══════════════════════════════════════════════════════════ -->
<!-- Hub generated by SitemapV10HubsService -->
<!-- Pipeline: ${pipeline} -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- URLs: ${urlCount} -->
<!-- ═══════════════════════════════════════════════════════════ -->`;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function sortUrlsByPriority(urls: UrlWithPriority[]): UrlWithPriority[] {
  return [...urls].sort((a, b) => b.hasItem - a.hasItem);
}
