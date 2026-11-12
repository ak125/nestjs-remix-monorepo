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
 * Supprime TOUTES les balises HTML pour les meta descriptions SEO
 * Utilisé pour nettoyer le contenu avant de l'utiliser dans <meta name="description">
 *
 * 🎯 Miroir du frontend: seo-clean.utils.ts::stripHtmlForMeta()
 *
 * @param html - Contenu HTML brut (peut contenir <strong>, <span>, tags malformés)
 * @param maxLength - Longueur max (défaut: 160 pour meta description)
 * @returns Texte brut sans HTML, tronqué à maxLength caractères
 *
 * @example
 * stripHtmlForMeta('&lt;strong&gt;Alternateur&lt;/strong&gt; pour...') // 'Alternateur pour...'
 * stripHtmlForMeta('<span>Kit embrayage</span>') // 'Kit embrayage'
 */
export function stripHtmlForMeta(
  html: string | null | undefined,
  maxLength = 160,
): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let result = html;

  // 1. Décoder les entités HTML AVANT de supprimer les tags
  // Car le contenu peut contenir &lt;strong&gt; (HTML encodé)
  result = result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // 2. Supprimer tous les tags HTML (y compris malformés comme <spanCalibri",...>)
  result = result.replace(/<[^>]*>/g, '');

  // 3. Supprimer les attributs style orphelins qui pourraient rester
  // Pattern: Calibri","sans-serif"" (résidu de <span style="font-family:Calibri...">)
  // Seule la séquence `","` signe ce résidu : ni l'apostrophe ni la virgule
  // seule, sinon le texte entre deux élisions (« d'embrayage … l'usure ») part.
  result = result.replace(/[A-Za-z-]+","[^"]*"+/g, '');

  // 4. Décoder les entités HTML restantes (après strip des tags)
  result = decodeHtmlEntities(result);

  // 5. Normaliser les espaces multiples et trim
  result = result.replace(/\s+/g, ' ').trim();

  // 6. Tronquer à maxLength caractères avec ellipsis propre
  if (result.length > maxLength) {
    // Couper au dernier espace avant la limite pour éviter de couper un mot
    const truncated = result.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength - 30) {
      result = truncated.substring(0, lastSpace) + '...';
    } else {
      result = truncated + '...';
    }
  }

  return result;
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
