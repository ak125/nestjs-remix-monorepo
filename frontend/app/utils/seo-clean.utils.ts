/**
 * 🧹 Utilitaires de nettoyage SEO
 * Nettoie les balises <p> orphelines et la ponctuation incorrecte
 *
 * 🎯 Miroir du backend: gamme-unified.service.ts::cleanOrphanParagraphs()
 */

/**
 * Nettoie les balises <p> orphelines qui entourent tout le contenu
 * Pattern: <p>Kit d'embrayage FIAT DOBLO...</p> → Kit d'embrayage FIAT DOBLO...
 *
 * @param html - Contenu HTML brut
 * @returns Contenu nettoyé
 */
export function cleanOrphanParagraphs(html: string): string {
  if (!html || typeof html !== "string") {
    return html;
  }

  let result = html;

  // 1. Supprimer les <p> vides (<p></p> ou <p> </p>)
  result = result.replace(/<p>\s*<\/p>/gi, "");

  // 2. 🎯 Supprimer <p>...</p> qui ENTOURE TOUT LE CONTENU (début + fin)
  // Pattern: <p>Kit d'embrayage FIAT DOBLO I 1.3 D Multijet 84 ch 2005...</p>
  // Détecte: commence par <p> et finit par </p> avec rien avant/après
  result = result.replace(/^\s*<p>(.*)<\/p>\s*$/is, "$1");

  // 3. Supprimer la première balise <p>...</p> UNIQUEMENT si elle contient un titre de gamme
  // Pattern: <p>Plaquette de frein pour CITROËN... </p>
  // On garde le texte mais on enlève les balises <p></p>
  result = result.replace(/^<p>([^<]+pour\s+[A-Z].+?)<\/p>\s*/i, "$1\n");

  // 4. Si pas de "pour", essayer juste un titre de gamme seul
  // Pattern: <p>Kit d'embrayage RENAULT... </p>
  result = result.replace(
    /^<p>([A-Z][^<]+?(?:RENAULT|CITROËN|PEUGEOT|BMW|AUDI|VOLKSWAGEN|MERCEDES|FIAT|ALFA|FORD|OPEL|TOYOTA|NISSAN|HONDA|MAZDA|HYUNDAI|KIA|VOLVO)[^<]+?)<\/p>\s*/i,
    "$1\n",
  );

  // 🎯 Nettoyage de ponctuation orpheline
  // Supprimer virgules orphelines: "de , les" → "de les"
  result = result.replace(/\s+,\s+/g, ", "); // Normaliser d'abord
  result = result.replace(/(\s+\w+)\s+,\s+/g, "$1 "); // "de , " → "de "

  // Supprimer doubles virgules: ", ," → ","
  result = result.replace(/,\s*,/g, ",");

  // Supprimer points orphelins en fin de phrase incomplète: "il faut ." → "il faut"
  result = result.replace(/\s+\.\s*$/gm, "");

  return result;
}

/**
 * 🎨 Supprime les styles inline qui écrasent les classes CSS
 * Supprime: font-family, font-size, line-height des attributs style
 *
 * @param html - Contenu HTML avec styles inline
 * @returns Contenu HTML sans styles inline de typographie
 */
export function cleanInlineStyles(html: string): string {
  if (!html || typeof html !== "string") {
    return html;
  }

  let result = html;

  // 1. Supprimer les attributs style contenant font-family, font-size, line-height
  // Pattern: style="font-size:11pt" ou style="font-family:Calibri,sans-serif"
  result = result.replace(
    /\s*style="[^"]*(?:font-family|font-size|line-height)[^"]*"/gi,
    "",
  );

  // 2. Supprimer les <span> vides (sans attributs) qui restent après nettoyage
  // Pattern: <span>texte</span> → texte
  result = result.replace(/<span>([^<]*)<\/span>/gi, "$1");

  // 3. Répéter pour les spans imbriqués
  result = result.replace(/<span>([^<]*)<\/span>/gi, "$1");

  return result;
}

/**
 * Nettoie tous les champs SEO d'un objet
 *
 * @param seoData - Objet contenant h1, title, description, content, longDescription
 * @returns Objet avec champs nettoyés
 */
export function cleanSEOContent<T extends Record<string, unknown>>(
  seoData: T,
): T {
  if (!seoData || typeof seoData !== "object") {
    return seoData;
  }

  const result: Record<string, unknown> = { ...seoData };
  const fieldsToClean = [
    "h1",
    "title",
    "description",
    "content",
    "longDescription",
  ];

  for (const field of fieldsToClean) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = cleanOrphanParagraphs(result[field] as string);
    }
  }

  return result as T;
}

/**
 * 🧹 Supprime TOUTES les balises HTML pour les meta descriptions
 * Utilisé pour nettoyer le contenu avant de l'utiliser dans <meta name="description">
 *
 * @param html - Contenu HTML brut (peut contenir <strong>, <span>, etc.)
 * @param maxLength - Longueur max (défaut: 160 pour meta description)
 * @returns Texte brut sans HTML, tronqué à maxLength caractères
 */
export function stripHtmlForMeta(
  html: string,
  maxLength: number = 160,
): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  let result = html;

  // 1. Décoder les entités HTML AVANT de supprimer les tags
  // Car le contenu peut contenir &lt;strong&gt; (HTML encodé)
  result = result
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

  // 2. Supprimer tous les tags HTML (y compris malformés comme <spanCalibri",...>)
  result = result.replace(/<[^>]*>/g, "");

  // 3. Supprimer les attributs style orphelins qui pourraient rester
  // Pattern: Calibri","sans-serif"" (résidu de <span style="font-family:Calibri...">)
  result = result.replace(/[A-Za-z-]+["',]+[^"']*["']+/g, "");

  // 4. Normaliser les espaces multiples et trim
  result = result.replace(/\s+/g, " ").trim();

  // 5. Tronquer à maxLength caractères avec ellipsis propre
  if (result.length > maxLength) {
    // Couper au dernier espace avant la limite pour éviter de couper un mot
    const truncated = result.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > maxLength - 30) {
      result = truncated.substring(0, lastSpace) + "...";
    } else {
      result = truncated + "...";
    }
  }

  return result;
}
