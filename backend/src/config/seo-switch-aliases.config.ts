/**
 * Configuration des alias de switches SEO
 * Ce fichier définit les noms et descriptions des différents alias utilisés
 * dans les templates SEO pour générer du contenu dynamique.
 */

export interface SwitchAliasConfig {
  alias: string;
  type: 'item' | 'family' | 'gamme';
  name: string;
  placeholder: string;
  description: string;
}

/**
 * Liste complète des alias de switches SEO
 *
 * Item Switches (alias 1-3): Switches génériques par gamme (__seo_item_switch)
 * Family Switches (alias 11-16): Switches par famille produit (__seo_family_gamme_car_switch)
 * Gamme Switches (alias 1-3): Switches gamme/véhicule spécifiques (__seo_gamme_car_switch)
 */
export const SEO_SWITCH_ALIASES: SwitchAliasConfig[] = [
  // ============================================
  // Item Switches (alias 1-3) - Table: __seo_item_switch
  // ============================================
  {
    alias: '1',
    type: 'item',
    name: 'Action/Verbe',
    placeholder: '#Switch_1#',
    description: 'Verbes courts: vérifier, contrôler, changer, remplacer...',
  },
  {
    alias: '2',
    type: 'item',
    name: 'Bénéfice',
    placeholder: '#Switch_2#',
    description:
      'Bénéfices: pour un freinage optimal, pour une longue durée...',
  },
  {
    alias: '3',
    type: 'item',
    name: 'Variation',
    placeholder: '#Switch_3#',
    description: 'Autres variations contextuelles',
  },

  // ============================================
  // Family Switches (alias 11-16) - Table: __seo_family_gamme_car_switch
  // ============================================
  {
    alias: '11',
    type: 'family',
    name: 'Bénéfice court',
    placeholder: '#FamilySwitch_11#',
    description: 'Phrase courte sur le bénéfice produit',
  },
  {
    alias: '12',
    type: 'family',
    name: 'Bénéfice détaillé',
    placeholder: '#FamilySwitch_12#',
    description: 'Description détaillée du bénéfice',
  },
  {
    alias: '13',
    type: 'family',
    name: 'Fonction technique',
    placeholder: '#FamilySwitch_13#',
    description: 'Explication technique du rôle de la pièce',
  },
  {
    alias: '14',
    type: 'family',
    name: 'Détail technique',
    placeholder: '#FamilySwitch_14#',
    description: 'Caractéristiques techniques et matériaux',
  },
  {
    alias: '15',
    type: 'family',
    name: 'Action maintenance',
    placeholder: '#FamilySwitch_15#',
    description: 'Action à effectuer lors du remplacement',
  },
  {
    alias: '16',
    type: 'family',
    name: 'Conseil entretien',
    placeholder: '#FamilySwitch_16#',
    description: 'Conseil de maintenance et périodicité',
  },

  // ============================================
  // Gamme Switches (alias 1-3) - Table: __seo_gamme_car_switch
  // Pour les liens internes et cross-selling
  // ============================================
  {
    alias: '1',
    type: 'gamme',
    name: 'Verbe lien',
    placeholder: '#CompSwitch_1_X#',
    description: 'Verbe pour liens internes: Découvrez, Trouvez, Commandez...',
  },
  {
    alias: '2',
    type: 'gamme',
    name: 'Nom lien',
    placeholder: '#CompSwitch_2_X#',
    description: 'Nom pour liens internes: accessoires, équipements...',
  },
  {
    alias: '3',
    type: 'gamme',
    name: 'Variation lien',
    placeholder: '#CompSwitch_3_X#',
    description: 'Variations pour liens cross-gamme',
  },
];

/**
 * Récupère la configuration d'un alias par son numéro et type
 */
export const getSwitchAliasConfig = (
  alias: string,
  type?: 'item' | 'family' | 'gamme',
): SwitchAliasConfig | undefined => {
  if (type) {
    return SEO_SWITCH_ALIASES.find((a) => a.alias === alias && a.type === type);
  }
  // Sans type, priorité: family > item > gamme
  return (
    SEO_SWITCH_ALIASES.find((a) => a.alias === alias && a.type === 'family') ||
    SEO_SWITCH_ALIASES.find((a) => a.alias === alias && a.type === 'item') ||
    SEO_SWITCH_ALIASES.find((a) => a.alias === alias && a.type === 'gamme')
  );
};

/**
 * Récupère tous les alias d'un type donné
 */
export const getSwitchAliasesByType = (
  type: 'item' | 'family' | 'gamme',
): SwitchAliasConfig[] => SEO_SWITCH_ALIASES.filter((a) => a.type === type);

/**
 * Mapping rapide alias -> nom pour affichage
 */
export const SWITCH_ALIAS_NAMES: Record<string, Record<string, string>> = {
  item: {
    '1': 'Action/Verbe',
    '2': 'Bénéfice',
    '3': 'Variation',
  },
  family: {
    '11': 'Bénéfice court',
    '12': 'Bénéfice détaillé',
    '13': 'Fonction technique',
    '14': 'Détail technique',
    '15': 'Action maintenance',
    '16': 'Conseil entretien',
  },
  gamme: {
    '1': 'Verbe lien',
    '2': 'Nom lien',
    '3': 'Variation lien',
  },
};
