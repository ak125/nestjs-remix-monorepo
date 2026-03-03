/**
 * R1 Copy Gate — neutralise le vocabulaire diagnostic/entretien
 * sur les pages R1_ROUTER (compatibilité & routing uniquement).
 *
 * Vocabulaire interdit sur R1 :
 * - Symptômes : bruit, vibrations, témoin, frotte, crissement, grincement…
 * - Diagnostic : "vérifier si", "contrôler", "remplacer si"
 * - Entretien : "tous les X km", "durée de vie"
 * - Tuto : "peut-on changer soi-même"
 */

const R1_FORBIDDEN_PATTERNS = [
  /\b(vérifier|contrôler|remplacer)\s+(si|s[''']|en cas|l[''']état|leurs?|régulièrement)/i,
  /\b(bruit|vibration|crissement|grincement|frotte|fuit|fuite|claque|grince|lâche)/i,
  /\b(usure|usé|usée|usées|fissuré|voilé|coincé|bloqué|tordu|cassé|mort|défaillant|défectueux|hs)\b/i,
  /\b(témoin|voyant)\s+(allumé|d[''']usure)/i,
  /\b(épaisseur|limite)\s+d[''']usure/i,
  /\btous\s+les\s+\d+\s*0{3}\s*km/i,
  /\bdurée\s+de\s+vie\b/i,
  /\bchanger\s+soi-même\b/i,
];

/** Retourne true si le texte contient du vocabulaire R3/R5 interdit sur R1 */
export function isR3R5Content(text: string): boolean {
  return R1_FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

/** Nettoie un texte pour R1 : retourne null si diagnostic détecté */
export function sanitizeForR1Router(
  text: string | null | undefined,
): string | null {
  if (!text?.trim()) return null;
  return isR3R5Content(text) ? null : text;
}
