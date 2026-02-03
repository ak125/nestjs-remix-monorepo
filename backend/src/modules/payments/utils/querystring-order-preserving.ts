/**
 * Parseur QueryString préservant l'ordre
 * SAFE CHANGE: Nouveau fichier utilitaire, aucun impact sur l'existant
 *
 * Requis pour calculer la signature dans l'ordre de réception Paybox
 */

/**
 * Parse une querystring en préservant l'ordre exact des paires clé=valeur
 *
 * ⚠️ FIX CRITIQUE: En x-www-form-urlencoded, les espaces arrivent en '+'
 * decodeURIComponent("a+b") => "a+b" (FAUX), il faut "a b"
 * Solution: remplacer '+' par '%20' AVANT decodeURIComponent
 */
export function parseQueryStringPreservingOrder(
  queryString: string,
): Array<{ key: string; value: string }> {
  if (!queryString) return [];

  // Retirer le ? initial si présent
  const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;

  return qs.split('&').map((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) {
      return { key: pair, value: '' };
    }
    // FIX: Convertir '+' en '%20' avant decodeURIComponent (standard x-www-form-urlencoded)
    const rawValue = pair.slice(idx + 1);
    const fixedValue = rawValue.replace(/\+/g, '%20');
    return {
      key: pair.slice(0, idx),
      value: decodeURIComponent(fixedValue),
    };
  });
}

/**
 * Reconstruit une chaîne de signature depuis les paires ordonnées
 * en excluant les clés de signature connues
 */
export function buildSignatureStringFromOrdered(
  pairs: Array<{ key: string; value: string }>,
  excludeKeys: string[] = ['Signature', 'K', 'PBX_HMAC'],
): string {
  return pairs
    .filter((p) => !excludeKeys.includes(p.key))
    .map((p) => `${p.key}=${p.value}`)
    .join('&');
}
