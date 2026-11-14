/**
 * Valeurs saisies dans un filtre PostgREST écrit à la main (`.or()`,
 * `.and()`, `.not()`).
 *
 * Dans ces filtres, une valeur non citée s'arrête à la première `,` ou `)` :
 * une recherche qui en contient échoue (« failed to parse logic tree ») ou
 * ajoute une condition. Une valeur entre guillemets est lue jusqu'au guillemet
 * fermant, et `\x` y vaut `x` (parseur `pQuotedValue` de PostgREST).
 *
 * Les méthodes à une colonne (`.eq()`, `.ilike()`…) n'ont pas besoin de ces
 * fonctions : supabase-js y transmet la valeur telle quelle.
 */

/** Échappe `\`, `%` et `_` pour qu'un motif LIKE/ILIKE les cherche tels quels. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/** Valeur citée pour un filtre PostgREST : ni `,`, ni `)`, ni `"` n'en sortent. */
export function quoteFilterValue(value: string | number): string {
  return `"${String(value).replace(/[\\"]/g, '\\$&')}"`;
}

/** Motif `ilike` « contient ce texte », cité. */
export function ilikeContains(term: string): string {
  return quoteFilterValue(`%${escapeLikePattern(term)}%`);
}
