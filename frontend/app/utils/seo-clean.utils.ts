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
  if (!html || typeof html !== 'string') {
    return html;
  }

  let result = html;

  // 1. Supprimer les <p> vides (<p></p> ou <p> </p>)
  result = result.replace(/<p>\s*<\/p>/gi, '');

  // 2. 🎯 Supprimer <p>...</p> qui ENTOURE TOUT LE CONTENU (début + fin)
  // Pattern: <p>Kit d'embrayage FIAT DOBLO I 1.3 D Multijet 84 ch 2005...</p>
  // Détecte: commence par <p> et finit par </p> avec rien avant/après
  result = result.replace(/^\s*<p>(.*)<\/p>\s*$/is, '$1');

  // 3. Supprimer la première balise <p>...</p> UNIQUEMENT si elle contient un titre de gamme
  // Pattern: <p>Plaquette de frein pour CITROËN... </p>
  // On garde le texte mais on enlève les balises <p></p>
  result = result.replace(/^<p>([^<]+pour\s+[A-Z].+?)<\/p>\s*/i, '$1\n');

  // 4. Si pas de "pour", essayer juste un titre de gamme seul
  // Pattern: <p>Kit d'embrayage RENAULT... </p>
  result = result.replace(
    /^<p>([A-Z][^<]+?(?:RENAULT|CITROËN|PEUGEOT|BMW|AUDI|VOLKSWAGEN|MERCEDES|FIAT|ALFA|FORD|OPEL|TOYOTA|NISSAN|HONDA|MAZDA|HYUNDAI|KIA|VOLVO)[^<]+?)<\/p>\s*/i,
    '$1\n'
  );

  // 🎯 Nettoyage de ponctuation orpheline
  // Supprimer virgules orphelines: "de , les" → "de les"
  result = result.replace(/\s+,\s+/g, ', '); // Normaliser d'abord
  result = result.replace(/(\s+\w+)\s+,\s+/g, '$1 '); // "de , " → "de "

  // Supprimer doubles virgules: ", ," → ","
  result = result.replace(/,\s*,/g, ',');

  // Supprimer points orphelins en fin de phrase incomplète: "il faut ." → "il faut"
  result = result.replace(/\s+\.\s*$/gm, '');

  return result;
}

/**
 * Nettoie tous les champs SEO d'un objet
 * 
 * @param seoData - Objet contenant h1, title, description, content, longDescription
 * @returns Objet avec champs nettoyés
 */
export function cleanSEOContent<T extends Record<string, any>>(seoData: T): T {
  if (!seoData || typeof seoData !== 'object') {
    return seoData;
  }

  const result = { ...seoData };
  const fieldsToClean = ['h1', 'title', 'description', 'content', 'longDescription'];

  for (const field of fieldsToClean) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = cleanOrphanParagraphs(result[field]);
    }
  }

  return result;
}
