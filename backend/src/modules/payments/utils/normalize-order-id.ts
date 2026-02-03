/**
 * Normalise une référence de commande vers l'ID numérique attendu par la DB.
 *
 * La table ___xtr_order stocke ord_id comme ID numérique seul.
 * Cette fonction permet d'extraire l'ID numérique d'une référence Paybox.
 *
 * @example
 *   normalizeOrderId("ORD-1762010061177-879") // → "1762010061177"
 *   normalizeOrderId("1762010061177")         // → "1762010061177"
 *   normalizeOrderId("TEST-000")              // → "TEST-000" (fallback)
 *   normalizeOrderId("")                      // → ""
 */
export function normalizeOrderId(ref: string): string {
  if (!ref) return ref;

  // ORD-1762010061177-879 => 1762010061177
  const m = ref.match(/ORD-(\d+)/);
  if (m?.[1]) return m[1];

  // Si déjà numérique, on garde
  if (/^\d+$/.test(ref)) return ref;

  // Fallback : on ne devine pas, on retourne tel quel
  return ref;
}
