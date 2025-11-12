/**
 * Utilitaires de décodage des entités HTML
 * 
 * Utilisé pour nettoyer les données provenant de sources externes
 * ou de bases de données legacy avec encodage HTML
 */

/**
 * Décode toutes les entités HTML (nommées et numériques) en caractères UTF-8
 * 
 * @param text - Texte contenant potentiellement des entités HTML
 * @returns Texte décodé en UTF-8
 * 
 * @example
 * decodeHtmlEntities('&eacute;t&eacute;') // 'été'
 * decodeHtmlEntities('caf&#233;') // 'café'
 * decodeHtmlEntities('d&rsquo;accord') // "d'accord"
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return text || '';

  const entities: Record<string, string> = {
    // Voyelles accentuées minuscules
    '&eacute;': 'é',
    '&egrave;': 'è',
    '&ecirc;': 'ê',
    '&euml;': 'ë',
    '&agrave;': 'à',
    '&acirc;': 'â',
    '&auml;': 'ä',
    '&ocirc;': 'ô',
    '&ouml;': 'ö',
    '&ograve;': 'ò',
    '&icirc;': 'î',
    '&iuml;': 'ï',
    '&igrave;': 'ì',
    '&ucirc;': 'û',
    '&ugrave;': 'ù',
    '&uuml;': 'ü',
    // Voyelles accentuées majuscules
    '&Eacute;': 'É',
    '&Egrave;': 'È',
    '&Ecirc;': 'Ê',
    '&Euml;': 'Ë',
    '&Agrave;': 'À',
    '&Acirc;': 'Â',
    '&Auml;': 'Ä',
    '&Ocirc;': 'Ô',
    '&Ouml;': 'Ö',
    '&Ograve;': 'Ò',
    '&Icirc;': 'Î',
    '&Iuml;': 'Ï',
    '&Igrave;': 'Ì',
    '&Ucirc;': 'Û',
    '&Ugrave;': 'Ù',
    '&Uuml;': 'Ü',
    // Cédille
    '&ccedil;': 'ç',
    '&Ccedil;': 'Ç',
    // Guillemets et apostrophes
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&#39;': "'",
    '&apos;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&#34;': '"',
    '&quot;': '"',
    '&laquo;': '«',
    '&raquo;': '»',
    // Ponctuation et symboles
    '&hellip;': '…',
    '&mdash;': '—',
    '&ndash;': '–',
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&deg;': '°',
    '&plusmn;': '±',
    '&times;': '×',
    '&divide;': '÷',
    // Devises
    '&euro;': '€',
    '&pound;': '£',
    '&yen;': '¥',
    '&cent;': '¢',
  };

  let decoded = text;

  // D'abord les entités nommées
  Object.entries(entities).forEach(([entity, char]) => {
    decoded = decoded.split(entity).join(char);
  });

  // Puis les entités numériques décimales (&#NNN;)
  decoded = decoded.replace(/&#(\d+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });

  // Entités hexadécimales (&#xNNN;)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });

  return decoded;
}

/**
 * Remplace les variables de template dans un texte
 * 
 * @param text - Texte contenant des variables
 * @param variables - Map des variables à remplacer
 * @returns Texte avec variables remplacées
 * 
 * @example
 * replaceTemplateVariables(
 *   'Le constructeur #VMarque# recommande...',
 *   { VMarque: 'RENAULT' }
 * ) // 'Le constructeur RENAULT recommande...'
 */
export function replaceTemplateVariables(
  text: string,
  variables: Record<string, string>,
): string {
  if (!text) return text;

  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const pattern = new RegExp(`#${key}#`, 'g');
    result = result.replace(pattern, value);
  });

  return result;
}

/**
 * Nettoie complètement un texte SEO (entités + variables)
 * 
 * @param text - Texte à nettoyer
 * @param variables - Variables de template à remplacer
 * @returns Texte nettoyé et prêt à l'affichage
 * 
 * @example
 * cleanSeoText(
 *   'Le contr&ocirc;le selon #VMarque#',
 *   { VMarque: 'PEUGEOT' }
 * ) // 'Le contrôle selon PEUGEOT'
 */
export function cleanSeoText(
  text: string,
  variables: Record<string, string> = {},
): string {
  if (!text) return text;

  // 1. Décoder les entités HTML
  let cleaned = decodeHtmlEntities(text);

  // 2. Remplacer les variables
  cleaned = replaceTemplateVariables(cleaned, variables);

  return cleaned;
}

/**
 * Vérifie si un texte contient des entités HTML
 * 
 * @param text - Texte à vérifier
 * @returns true si des entités HTML sont présentes
 */
export function hasHtmlEntities(text: string): boolean {
  if (!text) return false;
  return /&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/.test(text);
}

/**
 * Nettoie un objet en décodant toutes ses propriétés textuelles
 * 
 * @param obj - Objet à nettoyer
 * @returns Nouvel objet avec propriétés nettoyées
 */
export function cleanObject<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'string') {
      cleaned[key] = decodeHtmlEntities(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        typeof item === 'object' ? cleanObject(item) : item,
      );
    } else if (value && typeof value === 'object') {
      cleaned[key] = cleanObject(value);
    } else {
      cleaned[key] = value;
    }
  });

  return cleaned as T;
}
