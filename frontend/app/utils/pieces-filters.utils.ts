/**
 * 🎯 Utilitaires pour les filtres de pièces
 * Fonctions de conversion et validation centralisées
 */

/**
 * Convertit les étoiles (1-6) en note sur 10
 * Fonction unique pour garantir la cohérence entre affichage et filtrage
 *
 * @param stars - Nombre d'étoiles (1-6), optionnel
 * @returns Note sur 10 (0-10)
 *
 * @example
 * convertStarsToNote(6) // → 10
 * convertStarsToNote(3) // → 5
 * convertStarsToNote(undefined) // → 5 (valeur par défaut)
 */
export function convertStarsToNote(stars?: number): number {
  const safeStars = stars ?? 3; // Valeur par défaut: 3 étoiles = note moyenne
  return Math.round((safeStars / 6) * 10);
}

/**
 * Calcule la note moyenne à partir d'un tableau de pièces
 * Retourne la moyenne avec 1 décimale
 *
 * @param pieces - Tableau de pièces avec propriété stars
 * @returns Note moyenne sur 10 avec 1 décimale
 */
export function calculateAverageNote(
  pieces: Array<{ stars?: number }>
): number {
  if (pieces.length === 0) return 0;

  const total = pieces.reduce((sum, piece) => {
    return sum + convertStarsToNote(piece.stars);
  }, 0);

  return Math.round((total / pieces.length) * 10) / 10;
}

/**
 * Valide si une position est disponible dans la liste
 *
 * @param position - Position à valider
 * @param availablePositions - Liste des positions disponibles
 * @returns true si la position est valide ou "all"
 */
export function isValidPosition(
  position: string | undefined,
  availablePositions: string[]
): boolean {
  if (!position || position === "all") return true;
  return availablePositions.includes(position);
}
