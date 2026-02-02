/**
 * Templates SEO pour la génération de contenu
 *
 * Basé sur le skill seo-content-architect (templates.md)
 *
 * Ces templates définissent les patterns pour:
 * - Les titres (≤60 caractères)
 * - Les meta descriptions (120-155 caractères)
 * - Les structures H1/H2
 */

/**
 * Template pour une page
 */
export interface SeoTemplate {
  /** Pattern pour le titre (≤60 chars) */
  title: string;
  /** Pattern pour la meta description (120-155 chars) */
  meta: string;
  /** Pattern pour le H1 */
  h1: string;
  /** Liste des H2 suggérés */
  h2: string[];
  /** Longueur cible en mots */
  targetWords: {
    min: number;
    max: number;
  };
}

/**
 * Templates pour les pages R4 Reference
 */
export const R4_REFERENCE_TEMPLATE: SeoTemplate = {
  title: '{piece} : Définition et Rôle Mécanique | Automecanik',
  meta: "Découvrez le rôle du/de la {piece} dans votre véhicule. Définition technique, fonctionnement et signes d'usure. Guide complet.",
  h1: '{Piece} : Définition Technique',
  h2: [
    "Qu'est-ce qu'un(e) {piece} ?",
    'Rôle mécanique',
    'Composition et fonctionnement',
    "Signes d'usure",
    'Quand remplacer ?',
  ],
  targetWords: {
    min: 200,
    max: 800,
  },
};

/**
 * Templates pour les pages R5 Diagnostic
 */
export const R5_DIAGNOSTIC_TEMPLATE: SeoTemplate = {
  title: '{symptome} : Causes et Solutions | Diagnostic Auto',
  meta: 'Votre véhicule présente un(e) {symptome} ? Découvrez les causes probables et les solutions pour y remédier.',
  h1: '{Symptome} : Diagnostic',
  h2: [
    'Symptôme observé',
    'Causes probables',
    'Niveau de risque',
    'Solutions recommandées',
    'Pièces concernées',
  ],
  targetWords: {
    min: 150,
    max: 600,
  },
};

/**
 * Templates pour les pages R1 Router (Famille)
 */
export const R1_FAMILLE_TEMPLATE: SeoTemplate = {
  title: '{famille} - Pièces Auto {marque} | Automecanik',
  meta: 'Achetez vos pièces de {famille} pour {marque}. Large choix, prix compétitifs, livraison rapide. Consultez notre catalogue.',
  h1: '{Famille} {Marque}',
  h2: [
    'Sélectionnez votre modèle',
    'Nos gammes de {famille}',
    'Marques disponibles',
  ],
  targetWords: {
    min: 50,
    max: 150,
  },
};

/**
 * Templates pour les pages R2 Product
 */
export const R2_PRODUCT_TEMPLATE: SeoTemplate = {
  title: '{piece} {marque} {modele} | Prix & Livraison | Automecanik',
  meta: '{Piece} {marque} {modele}. Pièce de qualité équipementier. Prix affiché, livraison en 24/48h.',
  h1: '{Piece} {Marque} {Modele}',
  h2: [
    'Caractéristiques',
    'Compatibilité',
    'Avis clients',
    'Produits similaires',
  ],
  targetWords: {
    min: 100,
    max: 300,
  },
};

/**
 * Templates pour les pages R3 Blog/Guide
 */
export const R3_BLOG_TEMPLATE: SeoTemplate = {
  title: '{sujet} : Guide Complet | Conseils Auto | Automecanik',
  meta: "{sujet} ? Découvrez notre guide complet avec conseils d'experts, étapes détaillées et astuces pour votre véhicule.",
  h1: '{Sujet} : Guide Complet',
  h2: [
    'Introduction',
    "Pourquoi c'est important",
    'Étapes à suivre',
    "Conseils d'expert",
    'Conclusion',
  ],
  targetWords: {
    min: 400,
    max: 1500,
  },
};

/**
 * Map des templates par rôle de page
 */
export const SEO_TEMPLATES: Record<string, SeoTemplate> = {
  R1_FAMILLE: R1_FAMILLE_TEMPLATE,
  R2_PRODUCT: R2_PRODUCT_TEMPLATE,
  R3_BLOG: R3_BLOG_TEMPLATE,
  R4_REFERENCE: R4_REFERENCE_TEMPLATE,
  R5_DIAGNOSTIC: R5_DIAGNOSTIC_TEMPLATE,
};

/**
 * Applique les variables à un template
 *
 * @param template - Le template à utiliser
 * @param variables - Les variables à substituer
 * @returns Le template avec les variables substituées
 *
 * @example
 * const result = applyTemplate(R4_REFERENCE_TEMPLATE, {
 *   piece: 'filtre à huile',
 *   Piece: 'Filtre à Huile',
 * });
 */
export function applyTemplate(
  template: SeoTemplate,
  variables: Record<string, string>,
): {
  title: string;
  meta: string;
  h1: string;
  h2: string[];
} {
  const replace = (text: string): string => {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  };

  return {
    title: replace(template.title).slice(0, 60), // Limite à 60 chars
    meta: replace(template.meta).slice(0, 155), // Limite à 155 chars
    h1: replace(template.h1),
    h2: template.h2.map((h) => replace(h)),
  };
}

/**
 * Vérifie les limites de caractères
 *
 * @param title - Le titre à vérifier
 * @param meta - La meta description à vérifier
 * @returns Les problèmes détectés
 */
export function checkLimits(
  title: string,
  meta: string,
): {
  titleOk: boolean;
  metaOk: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  const titleOk = title.length <= 60;
  if (!titleOk) {
    issues.push(`Titre trop long (${title.length}/60 chars)`);
  }

  const metaOk = meta.length >= 120 && meta.length <= 155;
  if (meta.length < 120) {
    issues.push(`Meta trop courte (${meta.length}/120-155 chars)`);
  } else if (meta.length > 155) {
    issues.push(`Meta trop longue (${meta.length}/155 chars)`);
  }

  return {
    titleOk,
    metaOk,
    issues,
  };
}

/**
 * Génère le Schema.org pour une page R4 Reference
 */
export function buildR4SchemaOrg(
  title: string,
  definition: string,
  url: string,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: title.replace(/ : Définition.*$/, ''),
    description: definition,
    url,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Référence Auto - Glossaire des Pièces Automobiles',
      url: 'https://automecanik.com/reference-auto',
    },
  };
}

/**
 * Génère le Schema.org FAQPage pour une page R5 Diagnostic
 *
 * Structure : 3 questions FAQ standard pour rich snippets Google
 * 1. Que signifie ce symptôme ?
 * 2. Quelles sont les causes possibles ?
 * 3. Que faire ?
 */
export function buildR5SchemaOrg(
  title: string,
  symptomDescription: string,
  causes: string[],
  url: string,
): object {
  // Construire la liste des causes pour la réponse
  const causesText =
    causes.length > 0
      ? `Les causes possibles sont : ${causes.slice(0, 5).join(', ')}.`
      : 'Plusieurs causes peuvent expliquer ce symptôme.';

  // Solution générique basée sur le niveau de risque
  const solutionText = `Si vous constatez ce symptôme, faites vérifier votre véhicule par un professionnel. En fonction de la gravité, un contrôle rapide ou immédiat peut être nécessaire.`;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Que signifie le symptôme "${title}" ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: symptomDescription,
        },
      },
      {
        '@type': 'Question',
        name: `Quelles sont les causes possibles ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: causesText,
        },
      },
      {
        '@type': 'Question',
        name: `Que faire si je constate ce symptôme ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: solutionText,
        },
      },
    ],
    url,
  };
}
