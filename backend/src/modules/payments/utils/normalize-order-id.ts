/**
 * Normalise une référence de commande pour correspondre au format en BDD.
 *
 * La table ___xtr_order stocke ord_id sous deux formats :
 * - Ancien système (2020-2024) : numérique seul ("278383")
 * - Nouveau système (2025+) : "ORD-{timestamp}-{random}" ("ORD-1770396202649-628")
 *
 * Cette fonction préserve le format d'entrée pour matcher correctement la BDD.
 *
 * @example
 *   normalizeOrderId("ORD-1762010061177-879") // → "ORD-1762010061177-879" (préservé)
 *   normalizeOrderId("1762010061177")         // → "1762010061177" (numérique gardé)
 *   normalizeOrderId("278383")                // → "278383" (ancien format gardé)
 *   normalizeOrderId("TEST-000")              // → "TEST-000" (fallback)
 *   normalizeOrderId("")                      // → ""
 */
export function normalizeOrderId(ref: string): string {
  if (!ref) return ref;

  // Format ORD-xxx-xxx : on préserve tel quel (c'est le format stocké en BDD)
  if (ref.startsWith('ORD-')) return ref;

  // Si déjà numérique, on garde (ancien format)
  if (/^\d+$/.test(ref)) return ref;

  // Fallback : on ne devine pas, on retourne tel quel
  return ref;
}

/**
 * Extrait la partie numérique (timestamp) d'un ID commande.
 * Utilisé comme fallback dans resolveOrderId() pour chercher par pattern LIKE.
 *
 * @example
 *   extractNumericPart("ORD-1762010061177-879") // → "1762010061177"
 *   extractNumericPart("278383")                // → "278383"
 *   extractNumericPart("TEST-000")              // → null
 */
export function extractNumericPart(ref: string): string | null {
  if (!ref) return null;

  // ORD-1762010061177-879 → "1762010061177"
  const m = ref.match(/^ORD-(\d+)/);
  if (m?.[1]) return m[1];

  // Déjà numérique
  if (/^\d+$/.test(ref)) return ref;

  return null;
}
