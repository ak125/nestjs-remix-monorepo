/**
 * Constantes de validation SEO pour les guides d'achat (purchase guides)
 * Utilisées pour la validation des meta descriptions et contenu SEO
 */

export const PURCHASE_GUIDE_VALIDATION = {
  // Meta description length (120-160 chars for mobile SEO)
  MIN_DESC_LENGTH: 120,
  MAX_DESC_LENGTH: 160,

  // Minimum required symptoms per gamme
  MIN_SYMPTOMS: 3,

  // Minimum required FAQs per gamme
  MIN_FAQS: 3,

  // Levenshtein similarity threshold for title cannibalization detection
  // Values >= 0.80 are flagged as similar
  TITLE_SIMILARITY_THRESHOLD: 0.8,

  // Content similarity threshold (Jaccard) for duplicate detection
  CONTENT_SIMILARITY_THRESHOLD: 0.8,

  // Minimum title length
  MIN_TITLE_LENGTH: 10,

  // Minimum FAQ answer length
  MIN_FAQ_ANSWER_LENGTH: 20,

  // Minimum FAQ question length
  MIN_FAQ_QUESTION_LENGTH: 10,
} as const;

/**
 * Error messages for validation failures
 */
export const VALIDATION_ERROR_MESSAGES = {
  DESC_TOO_SHORT: 'Description trop courte (minimum 120 caractères)',
  DESC_TOO_LONG: 'Description trop longue (maximum 160 caractères)',
  TITLE_TOO_SHORT: 'Titre trop court (minimum 10 caractères)',
  INSUFFICIENT_SYMPTOMS: 'Nombre de symptômes insuffisant (minimum 3)',
  INSUFFICIENT_FAQS: 'Nombre de FAQs insuffisant (minimum 3)',
  SIMILAR_TITLE_EXISTS: 'Un titre similaire existe déjà (cannibalisation)',
  FAQ_QUESTION_TOO_SHORT: 'Question FAQ trop courte',
  FAQ_ANSWER_TOO_SHORT: 'Réponse FAQ trop courte',
} as const;

/**
 * Validation severity levels
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}
