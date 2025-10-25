/**
 * Configuration des langues et domaines pour hreflang
 */

export interface LanguageConfig {
  code: string; // Code ISO 639-1: 'fr', 'en', 'es', 'de', 'it'
  region?: string; // Code région optionnel: 'FR', 'BE', 'CH', 'CA'
  hreflang: string; // Code complet: 'fr', 'fr-FR', 'fr-BE', 'en-US', 'x-default'
  domain: string; // Domaine ou sous-domaine
  isDefault: boolean; // true pour x-default
}

/**
 * Configuration des langues supportées
 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'fr',
    region: 'FR',
    hreflang: 'fr-FR',
    domain: 'https://automecanik.com',
    isDefault: true, // Langue par défaut
  },
  {
    code: 'fr',
    region: 'BE',
    hreflang: 'fr-BE',
    domain: 'https://be.automecanik.com',
    isDefault: false,
  },
  {
    code: 'en',
    region: 'GB',
    hreflang: 'en-GB',
    domain: 'https://uk.automecanik.com',
    isDefault: false,
  },
  {
    code: 'de',
    region: 'DE',
    hreflang: 'de-DE',
    domain: 'https://de.automecanik.com',
    isDefault: false,
  },
  {
    code: 'es',
    region: 'ES',
    hreflang: 'es-ES',
    domain: 'https://es.automecanik.com',
    isDefault: false,
  },
  {
    code: 'it',
    region: 'IT',
    hreflang: 'it-IT',
    domain: 'https://it.automecanik.com',
    isDefault: false,
  },
];

/**
 * Configuration x-default (langue de repli)
 */
export const X_DEFAULT_LANGUAGE: LanguageConfig = {
  code: 'fr',
  hreflang: 'x-default',
  domain: 'https://automecanik.com',
  isDefault: true,
};

/**
 * Obtient la configuration d'une langue par code hreflang
 */
export function getLanguageConfig(
  hreflang: string,
): LanguageConfig | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.hreflang === hreflang);
}

/**
 * Obtient toutes les langues sauf celle spécifiée
 */
export function getAlternateLanguages(
  currentHreflang: string,
): LanguageConfig[] {
  return SUPPORTED_LANGUAGES.filter(
    (lang) => lang.hreflang !== currentHreflang,
  );
}

/**
 * Génère l'URL d'une page dans une langue donnée
 */
export function generateLocalizedUrl(
  path: string,
  languageConfig: LanguageConfig,
): string {
  // Retirer le domaine de l'URL si présent
  const urlPath = path.replace(/^https?:\/\/[^/]+/, '');

  // Retourner l'URL complète avec le nouveau domaine
  return `${languageConfig.domain}${urlPath}`;
}

/**
 * Vérifie si une URL doit avoir des hreflang
 * (certaines pages peuvent être uniquement en français)
 */
export function shouldHaveHreflang(path: string): boolean {
  // Pages exclues du hreflang (spécifiques à une langue)
  const excludedPatterns = [
    /\/mentions-legales/, // Mentions légales FR uniquement
    /\/cgv/, // CGV FR uniquement
    /\/legal-notice/, // Legal notice EN uniquement
    /\/support/, // Support FR uniquement
    /\/aide/, // Aide FR uniquement
    /\/faq-fr/, // FAQ FR uniquement
    /\/contact-fr/, // Contact FR uniquement
  ];

  return !excludedPatterns.some((pattern) => pattern.test(path));
}

/**
 * Types de contenu supportant le multilingue
 */
export enum MultilingualContentType {
  STATIC_PAGE = 'static_page', // Pages statiques
  PRODUCT = 'product', // Fiches produit
  CATEGORY = 'category', // Catégories
  BLOG = 'blog', // Articles de blog
  CONSTRUCTEUR = 'constructeur', // Pages constructeurs
  MODELE = 'modele', // Pages modèles
}

/**
 * Configuration du support multilingue par type de contenu
 */
export const MULTILINGUAL_SUPPORT: Record<
  MultilingualContentType,
  {
    enabled: boolean;
    languages: string[]; // Codes hreflang supportés
  }
> = {
  [MultilingualContentType.STATIC_PAGE]: {
    enabled: true,
    languages: ['fr-FR', 'fr-BE', 'en-GB', 'de-DE', 'es-ES', 'it-IT'],
  },
  [MultilingualContentType.PRODUCT]: {
    enabled: true,
    languages: ['fr-FR', 'fr-BE', 'en-GB', 'de-DE', 'es-ES', 'it-IT'],
  },
  [MultilingualContentType.CATEGORY]: {
    enabled: true,
    languages: ['fr-FR', 'fr-BE', 'en-GB', 'de-DE', 'es-ES', 'it-IT'],
  },
  [MultilingualContentType.BLOG]: {
    enabled: true,
    languages: ['fr-FR', 'en-GB'], // Blog uniquement FR et EN pour l'instant
  },
  [MultilingualContentType.CONSTRUCTEUR]: {
    enabled: true,
    languages: ['fr-FR', 'fr-BE', 'en-GB', 'de-DE', 'es-ES', 'it-IT'],
  },
  [MultilingualContentType.MODELE]: {
    enabled: true,
    languages: ['fr-FR', 'fr-BE', 'en-GB', 'de-DE', 'es-ES', 'it-IT'],
  },
};
