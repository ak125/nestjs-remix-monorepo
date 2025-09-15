// 📁 frontend/app/config/categoryFamilies.ts
// 👨‍👩‍👧‍👦 Configuration des familles de catégories

export interface CategoryFamily {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  subcategories: string[];
}

export const CATEGORY_FAMILIES: CategoryFamily[] = [
  {
    id: 'filtration',
    name: 'Système de filtration',
    description: 'Tous les filtres pour maintenir la propreté des fluides',
    icon: '🔍',
    subcategories: [
      'Filtre à huile',
      'Filtre à air',
      'Filtre à carburant',
      'Filtre d\'habitacle',
      'Filtre de boîte auto',
      'Filtre',
      'filtration',
      'filtre',
      'huile',
      'air',
      'carburant',
      'habitacle'
    ]
  },
  export const CATEGORY_FAMILIES: CategoryFamily[] = [
  {
    id: 'filtration',
    name: 'Système de filtration',
    description: 'Tous les filtres pour maintenir la propreté des fluides',
    icon: '🔍',
    subcategories: [
      'filtre à huile',
      'filtre à air', 
      'filtre à carburant',
      'filtre d\'habitacle',
      'filtre de boîte auto'
    ]
  },
  {
    id: 'freinage',
    name: 'Système de freinage',
    description: 'Composants essentiels pour le freinage et la sécurité',
    icon: '🛑',
    subcategories: [
      'plaquette de frein',
      'disque de frein',
      'étrier de frein',
      'témoin d\'usure',
      'kit de freins arrière',
      'mâchoires de frein',
      'cylindre de roue',
      'interrupteur des feux de freins',
      'capteur abs',
      'flexible de frein',
      'câble de frein à main',
      'tambour de frein',
      'maître cylindre de frein',
      'agregat de freinage'
    ]
  },
  {
    id: 'transmission-courroie',
    name: 'Courroie, galet, poulie et chaîne',
    description: 'Transmission de puissance par courroie et chaîne',
    icon: '⚙️',
    subcategories: [
      'courroie d\'accessoire',
      'galet tendeur',
      'galet enrouleur',
      'kit de distribution',
      'courroie de distribution',
      'pompe à eau',
      'poulie vilebrequin',
      'poulie d\'alternateur',
      'poulie d\'arbre à came',
      'kit de chaîne de distribution',
      'chaîne de distribution'
    ]
  },
  {
    id: 'prechauffage',
    name: 'Préchauffage et allumage',
    description: 'Système de démarrage et préchauffage',
    icon: '⚡',
    subcategories: [
      'bougie de préchauffage',
      'boîtier de préchauffage',
      'bougie d\'allumage',
      'faisceau d\'allumage',
      'bobine d\'allumage'
    ]
  },
  {
    id: 'direction',
    name: 'Direction et liaison au sol',
    description: 'Système de direction et train roulant',
    icon: '🎯',
    subcategories: [
      'rotule de direction',
      'barre de direction',
      'rotule de suspension',
      'bras de suspension',
      'biellette de barre stabilisatrice',
      'soufflet de direction',
      'roulement de roue',
      'pompe de direction assistée',
      'crémaillière de direction',
      'colonne de direction'
    ]
  },
  {
    id: 'amortissement',
    name: 'Amortisseur et suspension',
    description: 'Système de suspension et amortissement',
    icon: '🌊',
    subcategories: [
      'amortisseur',
      'kit de butée de suspension',
      'butée élastique d\'amortisseur',
      'ressort de suspension'
    ]
  },
  {
    id: 'support-moteur',
    name: 'Support moteur',
    description: 'Supports et fixations moteur',
    icon: '🔧',
    subcategories: [
      'support moteur',
      'support de boîte vitesse'
    ]
  },
  {
    id: 'embrayage',
    name: 'Embrayage',
    description: 'Système d\'embrayage et transmission',
    icon: '🔄',
    subcategories: [
      'kit d\'embrayage',
      'butée d\'embrayage',
      'emetteur d\'embrayage',
      'récepteur d\'embrayage',
      'volant moteur',
      'câble d\'embrayage'
    ]
  },
  {
    id: 'cardan',
    name: 'Transmission',
    description: 'Transmission de puissance aux roues',
    icon: '🔩',
    subcategories: [
      'cardan',
      'soufflet de cardan'
    ]
  },
  {
    id: 'electrique',
    name: 'Système électrique',
    description: 'Composants électriques principaux',
    icon: '🔌',
    subcategories: [
      'alternateur',
      'démarreur',
      'neiman'
    ]
  },
  {
    id: 'capteurs',
    name: 'Capteurs',
    description: 'Capteurs et sondes du véhicule',
    icon: '📡',
    subcategories: [
      'pressostat d\'huile',
      'capteur impulsion',
      'capteur pression et température d\'huile',
      'capteur niveau d\'huile moteur',
      'capteur de cognement',
      'capteur température d\'air admission',
      'capteur pression du tuyau d\'admission',
      'capteur pression de carburant',
      'valve de réglage du ralenti',
      'capteur abs',
      'interrupteur des feux de freins',
      'sonde de refroidissement',
      'sonde lambda'
    ]
  },
  {
    id: 'alimentation',
    name: 'Système d\'alimentation',
    description: 'Alimentation carburant et air',
    icon: '⛽',
    subcategories: [
      'débitmètre d\'air',
      'vanne egr',
      'pompe à carburant',
      'joint d\'injecteur',
      'injecteur',
      'boîtier papillon'
    ]
  },
  {
    id: 'moteur',
    name: 'Moteur',
    description: 'Composants internes du moteur',
    icon: '🏭',
    subcategories: [
      'joint de culasse',
      'joint de cache culbuteurs',
      'bagues d\'étanchéité moteur',
      'vis de culasse',
      'joint de collecteur',
      'soupape d\'admission',
      'soupape d\'échappement',
      'poussoir de soupape',
      'carter d\'huile'
    ]
  },
  {
    id: 'refroidissement',
    name: 'Refroidissement',
    description: 'Système de refroidissement moteur',
    icon: '❄️',
    subcategories: [
      'pompe à eau',
      'radiateur de refroidissement',
      'thermostat',
      'sonde de refroidissement',
      'durite de refroidissement',
      'ventilateur de refroidissement',
      'pulseur d\'air d\'habitacle',
      'radiateur de chauffage',
      'commande de ventilation'
    ]
  },
  {
    id: 'climatisation',
    name: 'Climatisation',
    description: 'Système de climatisation et ventilation',
    icon: '🌡️',
    subcategories: [
      'pulseur d\'air d\'habitacle',
      'compresseur de climatisation',
      'condenseur de climatisation',
      'evaporateur de climatisation',
      'détendeur de climatisation',
      'commande de ventilation',
      'bouteille déshydratante',
      'filtre d\'habitacle',
      'capteur température de climatisation'
    ]
  },
  {
    id: 'echappement',
    name: 'Echappement',
    description: 'Système d\'échappement et dépollution',
    icon: '💨',
    subcategories: [
      'catalyseur',
      'fap',
      'sonde lambda'
    ]
  },
  {
    id: 'eclairage',
    name: 'Eclairage',
    description: 'Système d\'éclairage et signalisation',
    icon: '💡',
    subcategories: [
      'feu avant',
      'feu arrière',
      'feu clignotant',
      'contacteur feu de recul',
      'commande d\'éclairage'
    ]
  },
  {
    id: 'accessoires',
    name: 'Accessoires',
    description: 'Accessoires et équipements divers',
    icon: '🔧',
    subcategories: [
      'balais d\'essuie-glace',
      'commande d\'essuie-glace',
      'rétroviseur extérieur',
      'lève-vitre',
      'attelage'
    ]
  },
  {
    id: 'turbo',
    name: 'Turbo',
    description: 'Système de suralimentation',
    icon: '🌪️',
    subcategories: [
      'turbo',
      'turbocompresseur'
    ]
  }
];
  {
    id: 'transmission',
    name: 'Courroie, galet, poulie et chaîne',
    description: 'Système de transmission de puissance',
    icon: '⚙️',
    subcategories: [
      'Courroie d\'accessoire',
      'Galet tendeur de courroie d\'accessoire',
      'Galet enrouleur de courroie d\'accessoire',
      'Kit de distribution',
      'Courroie de distribution',
      'Pompe à eau',
      'Poulie vilebrequin',
      'Poulie d\'alternateur',
      'Poulie d\'arbre à came',
      'Kit de chaîne de distribution',
      'Chaîne de distribution'
    ]
  },
  {
    id: 'allumage',
    name: 'Préchauffage et allumage',
    description: 'Système d\'allumage et de préchauffage moteur',
    icon: '⚡',
    subcategories: [
      'Bougie de préchauffage',
      'Boîtier de préchauffage',
      'Bougie d\'allumage',
      'Faisceau d\'allumage',
      'Bobine d\'allumage'
    ]
  },
  {
    id: 'direction',
    name: 'Direction et liaison au sol',
    description: 'Composants de direction et suspension',
    icon: '🎯',
    subcategories: [
      'Rotule de direction',
      'Barre de direction',
      'Rotule de suspension',
      'Bras de suspension',
      'Biellette de barre stabilisatrice',
      'Soufflet de direction',
      'Roulement de roue',
      'Pompe de direction assistée',
      'Crémaillière de direction',
      'Colonne de direction'
    ]
  },
  {
    id: 'suspension',
    name: 'Amortisseur et suspension',
    description: 'Système de suspension et amortissement',
    icon: '🌊',
    subcategories: [
      'Amortisseur',
      'Kit de butée de suspension',
      'Butée élastique d\'amortisseur',
      'Ressort de suspension'
    ]
  },
  {
    id: 'support-moteur',
    name: 'Support moteur',
    description: 'Supports et fixations moteur',
    icon: '🔧',
    subcategories: [
      'Support moteur',
      'Support de boîte vitesse'
    ]
  },
  {
    id: 'embrayage',
    name: 'Embrayage',
    description: 'Système d\'embrayage et transmission',
    icon: '🔄',
    subcategories: [
      'Kit d\'embrayage',
      'Butée d\'embrayage',
      'Emetteur d\'embrayage',
      'Récepteur d\'embrayage',
      'Volant moteur',
      'Câble d\'embrayage'
    ]
  },
  {
    id: 'cardan',
    name: 'Transmission',
    description: 'Transmission de puissance aux roues',
    icon: '🔩',
    subcategories: [
      'Cardan',
      'Soufflet de Cardan'
    ]
  },
  {
    id: 'electrique',
    name: 'Système électrique',
    description: 'Composants électriques principaux',
    icon: '🔌',
    subcategories: [
      'Alternateur',
      'Démarreur',
      'Neiman'
    ]
  },
  {
    id: 'capteurs',
    name: 'Capteurs',
    description: 'Capteurs et sondes du véhicule',
    icon: '📡',
    subcategories: [
      'Pressostat d\'huile',
      'Capteur impulsion',
      'Capteur pression et température d\'huile',
      'Capteur niveau d\'huile moteur',
      'Capteur de cognement',
      'Capteur température d\'air admission',
      'Capteur pression du tuyau d\'admission',
      'Capteur pression de carburant',
      'Valve de réglage du ralenti',
      'Capteur ABS',
      'Interrupteur des feux de freins',
      'Sonde de refroidissement',
      'Sonde lambda'
    ]
  },
  {
    id: 'alimentation',
    name: 'Système d\'alimentation',
    description: 'Alimentation carburant et air',
    icon: '⛽',
    subcategories: [
      'Débitmètre d\'air',
      'Vanne EGR',
      'Pompe à carburant',
      'Joint d\'injecteur',
      'Injecteur',
      'Boîtier papillon'
    ]
  },
  {
    id: 'moteur',
    name: 'Moteur',
    description: 'Composants internes du moteur',
    icon: '🏭',
    subcategories: [
      'Joint de culasse',
      'Joint de cache culbuteurs',
      'Bagues d\'étanchéité moteur',
      'Vis de culasse',
      'Joint de collecteur',
      'Soupape d\'admission',
      'Soupape d\'échappement',
      'Poussoir de soupape',
      'Carter d\'huile'
    ]
  },
  {
    id: 'refroidissement',
    name: 'Refroidissement',
    description: 'Système de refroidissement moteur',
    icon: '❄️',
    subcategories: [
      'Pompe à eau',
      'Radiateur de refroidissement',
      'Thermostat',
      'Sonde de refroidissement',
      'Durite de refroidissement',
      'Ventilateur de refroidissement',
      'Pulseur d\'air d\'habitacle',
      'Radiateur de chauffage',
      'Commande de ventilation'
    ]
  },
  {
    id: 'climatisation',
    name: 'Climatisation',
    description: 'Système de climatisation et ventilation',
    icon: '🌡️',
    subcategories: [
      'Pulseur d\'air d\'habitacle',
      'Compresseur de climatisation',
      'Condenseur de climatisation',
      'Evaporateur de climatisation',
      'Détendeur de climatisation',
      'Commande de ventilation',
      'Bouteille déshydratante',
      'Filtre d\'habitacle',
      'Capteur température de climatisation'
    ]
  },
  {
    id: 'echappement',
    name: 'Echappement',
    description: 'Système d\'échappement et dépollution',
    icon: '💨',
    subcategories: [
      'Catalyseur',
      'FAP',
      'Sonde lambda'
    ]
  },
  {
    id: 'eclairage',
    name: 'Eclairage',
    description: 'Système d\'éclairage du véhicule',
    icon: '💡',
    subcategories: [
      'Feu avant',
      'Feu arrière',
      'Feu clignotant',
      'Contacteur feu de recul',
      'Commande d\'éclairage'
    ]
  },
  {
    id: 'accessoires',
    name: 'Accessoires',
    description: 'Accessoires et équipements divers',
    icon: '🔧',
    subcategories: [
      'Balais d\'essuie-glace',
      'Commande d\'essuie-glace',
      'Rétroviseur extérieur',
      'Lève-vitre',
      'Attelage'
    ]
  }
];

// Helper pour trouver une famille par nom de catégorie
export function findFamilyByCategory(categoryName: string): CategoryFamily | undefined {
  if (!categoryName) return undefined;
  
  const normalizedCategory = categoryName.toLowerCase().trim();
  
  return CATEGORY_FAMILIES.find(family => 
    family.subcategories.some(sub => {
      const normalizedSub = sub.toLowerCase().trim();
      
      // Correspondance exacte
      if (normalizedCategory === normalizedSub) return true;
      
      // Correspondance partielle (contient)
      if (normalizedCategory.includes(normalizedSub) || normalizedSub.includes(normalizedCategory)) return true;
      
      // Correspondance par mots-clés (pour des noms complexes)
      const categoryWords = normalizedCategory.split(/\s+/);
      const subWords = normalizedSub.split(/\s+/);
      
      // Si au moins 60% des mots correspondent
      const matchingWords = subWords.filter(subWord => 
        categoryWords.some(catWord => 
          catWord.includes(subWord) || subWord.includes(catWord)
        )
      );
      
      return matchingWords.length / subWords.length >= 0.6;
    })
  );
}

// Helper pour organiser les catégories par famille
export function organizeCategoriesByFamily(categories: any[]): { [familyName: string]: any[] } {
  const organized: { [familyName: string]: any[] } = {};
  
  // Initialiser toutes les familles
  CATEGORY_FAMILIES.forEach(family => {
    organized[family.name] = [];
  });
  
  // Ajouter une catégorie "Autres" pour les non-classées
  organized['Autres'] = [];
  
  // Classer chaque catégorie
  categories.forEach(category => {
    const categoryName = category.pg_name || category.name || category.pg_designation;
    
    if (!categoryName) {
      organized['Autres'].push(category);
      return;
    }
    
    const family = findFamilyByCategory(categoryName);
    
    if (family) {
      organized[family.name].push(category);
    } else {
      organized['Autres'].push(category);
    }
  });
  
  // Ne pas supprimer les familles vides pour l'instant, pour debug
  return organized;
}