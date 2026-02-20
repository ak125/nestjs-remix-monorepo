/**
 * Sanitize un texte "conseil" motorisation pour l'affichage R1.
 * Retourne null si le texte est inutilisable.
 *
 * Règles:
 * - Max 80 caractères (troncature mot-boundary)
 * - 1 seule phrase
 * - Blacklist: "mort", "bizarre", infinitifs chaînés
 * - Capitalise première lettre
 */

const BLACKLIST_PATTERNS = [
  /\bmorts?\b/i,
  /\bbizarre\b/i,
  /\b\w+er\s+\w+er\b/, // infinitifs chaînés: "assurer dissiper"
  /\bs['']ils?\s+(sont?|est)\s+mort/i,
];

export function sanitizeAdvice(text: string): string | null {
  if (!text || text.trim().length < 5) return null;

  let clean = text.trim();

  // Blacklist check
  if (BLACKLIST_PATTERNS.some((re) => re.test(clean))) return null;

  // 1 seule phrase: couper au premier point/!/?
  const sentenceEnd = clean.search(/[.!?]/);
  if (sentenceEnd > 0) {
    clean = clean.substring(0, sentenceEnd + 1);
  }

  // Retirer préfixe "Conseil :" si présent (ajouté par le composant)
  clean = clean.replace(/^conseil\s*:\s*/i, "");

  // Capitaliser
  clean = clean.replace(/^./, (c) => c.toUpperCase());

  // Max 80 caractères (troncature mot-boundary)
  if (clean.length > 80) {
    const truncated = clean.substring(0, 77);
    const lastSpace = truncated.lastIndexOf(" ");
    clean =
      (lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated) + "…";
  }

  // Nettoyer ponctuation finale
  clean = clean.replace(/[,;:]+$/, "").trim();

  return clean.length >= 5 ? clean : null;
}
