/**
 * 🔗 Configuration des limites de liens SEO - Maillage Interne
 *
 * Ce fichier centralise toutes les limites configurables pour éviter
 * le sur-maillage (11.4M liens potentiels réduits à ~26 par page)
 *
 * Décisions:
 * - MAX_INJECTED_LINKS = 3 (dans contenu textuel via #LinkGammeCar#)
 * - CrossSelling = 4 gammes max
 * - RelatedArticles = 3 articles max
 * - Footer = 16 liens (8 marques + 8 gammes)
 */

export const SEO_LINK_LIMITS = {
  // =====================================================
  // 📝 Liens injectés dans le contenu textuel
  // =====================================================

  /**
   * Nombre max de liens #LinkGammeCar_Y# injectés par bloc de contenu
   * PHP n'avait pas de limite, on en ajoute une pour qualité SEO
   */
  MAX_INJECTED_LINKS_PER_CONTENT: 3,

  /**
   * Nombre max de liens #LinkGamme_Y# (liens simples sans véhicule)
   */
  MAX_SIMPLE_GAMME_LINKS: 2,

  // =====================================================
  // 🛒 Cross-Selling (gammes complémentaires)
  // =====================================================

  /**
   * Nombre de gammes affichées dans la section cross-selling
   * Page pièces: "Pièces complémentaires pour votre véhicule"
   */
  MAX_CROSSSELLING_LINKS: 4,

  /**
   * Version compacte du cross-selling (sidebar)
   */
  MAX_CROSSSELLING_COMPACT: 3,

  // =====================================================
  // 📰 Articles liés / Blog
  // =====================================================

  /**
   * Nombre d'articles liés affichés en fin de page
   */
  MAX_RELATED_ARTICLES: 3,

  /**
   * Nombre de liens dans un article de blog
   */
  MAX_BLOG_INTERNAL_LINKS: 5,

  // =====================================================
  // 🦶 Footer SEO
  // =====================================================

  /**
   * Top marques dans le footer
   */
  MAX_FOOTER_TOP_MARQUES: 8,

  /**
   * Gammes populaires dans le footer
   */
  MAX_FOOTER_GAMMES_POPULAIRES: 8,

  /**
   * Total liens utiles footer (CGV, mentions, etc.)
   */
  MAX_FOOTER_UTILITY_LINKS: 10,

  // =====================================================
  // 📄 Page totaux (pour référence)
  // =====================================================

  /**
   * Total liens internes SEO maximum par page
   * CrossSelling(4) + RelatedArticles(3) + Footer(16) + Content(3) = ~26
   */
  MAX_TOTAL_LINKS_PER_PAGE: 30,

  // =====================================================
  // 🎯 VoirAussi / Composants similaires
  // =====================================================

  /**
   * Section "Voir aussi" en bas de page produit
   */
  MAX_VOIR_AUSSI_LINKS: 4,

  /**
   * Composants compatibles affichés
   */
  MAX_COMPATIBLE_COMPONENTS: 6,
} as const;

// Type pour TypeScript
export type SeoLinkLimits = typeof SEO_LINK_LIMITS;

// =====================================================
// 🧪 A/B Testing Configuration
// =====================================================

export const SEO_AB_TESTING_CONFIG = {
  /**
   * Activer le tracking A/B des formulations
   */
  ENABLED: true,

  /**
   * Rotation déterministe (comme PHP) ou aléatoire
   * - 'deterministic': même véhicule = même ancre (cache friendly)
   * - 'random': variation aléatoire pour A/B testing pur
   */
  ROTATION_MODE: 'deterministic' as 'deterministic' | 'random',

  /**
   * Seed pour rotation aléatoire (si mode random)
   * Basé sur session_id pour consistance utilisateur
   */
  USE_SESSION_SEED: true,

  /**
   * Durée de rétention des données A/B (jours)
   */
  RETENTION_DAYS: 90,
} as const;

// =====================================================
// 🔤 Switch Types Configuration (reproduction PHP)
// =====================================================

export const SEO_SWITCH_TYPES = {
  /**
   * Types de switches supportés (reproduit PHP)
   */
  COMP_SWITCH: 'CompSwitch', // Switch générique
  COMP_SWITCH_ALIAS: 'CompSwitch_X', // Switch avec alias 1-16
  LINK_GAMME_CAR: 'LinkGammeCar', // Lien gamme + véhicule (verb+noun)
  LINK_GAMME: 'LinkGamme', // Lien simple vers gamme
  FAMILY_SWITCH: 'FamilySwitch', // Switch par famille produit
  ITEM_SWITCH: 'ItemSwitch', // Switch par item
  PRIX_PAS_CHER: 'PrixPasCher', // Mention prix compétitif
  QUALITE_SWITCH: 'QualiteSwitch', // Mention qualité

  /**
   * Alias pour les verbes (SGCS_ALIAS=1 dans PHP)
   * Exemples: Découvrez, Trouvez, Commandez, Profitez de
   */
  VERB_ALIAS: 1,

  /**
   * Alias pour les noms (SGCS_ALIAS=2 dans PHP)
   * Exemples: accessoires, équipements, composants
   */
  NOUN_ALIAS: 2,
} as const;

// =====================================================
// 🔗 Link Types pour Tracking
// =====================================================

export const SEO_LINK_TYPES = [
  'LinkGammeCar',
  'LinkGammeCar_ID',
  'LinkGamme',
  'CompSwitch',
  'CrossSelling',
  'VoirAussi',
  'Footer',
  'RelatedArticles',
  'TopMarques',
  'GammesPopulaires',
] as const;

export type SeoLinkType = (typeof SEO_LINK_TYPES)[number];

// =====================================================
// 📍 Link Positions
// =====================================================

export const SEO_LINK_POSITIONS = [
  'header',
  'content',
  'sidebar',
  'footer',
  'crossselling',
  'voiraussi',
  'blog',
] as const;

export type SeoLinkPosition = (typeof SEO_LINK_POSITIONS)[number];

export default SEO_LINK_LIMITS;
