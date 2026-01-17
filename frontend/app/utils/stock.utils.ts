/**
 * 🔧 Utilitaires pour la gestion du stock
 * Centralise la logique de validation de disponibilité
 */

export type StockStatus =
  | "En stock"
  | "available"
  | "Sur commande"
  | "Rupture"
  | string;

/**
 * Vérifie si une pièce est disponible selon son statut de stock
 *
 * @param stockStatus - Statut de stock de la pièce
 * @returns true si la pièce est disponible, false sinon
 *
 * @example
 * hasStockAvailable('En stock') // → true
 * hasStockAvailable('Sur commande') // → true
 * hasStockAvailable('Rupture') // → false
 * hasStockAvailable('') // → false (stock masqué)
 * hasStockAvailable(undefined) // → true (par défaut disponible)
 */
export const hasStockAvailable = (stockStatus?: StockStatus): boolean => {
  // ✅ FIX 2026-01-17: Si stock est "" (empty string), ne pas afficher le badge
  // Cela permet de masquer le stock selon la config (rm-mapper.ts: stock: "")
  if (stockStatus === "") return false;

  // Si pas de statut (undefined), considérer comme disponible par défaut
  if (!stockStatus) return true;

  // Statuts considérés comme disponibles
  const availableStatuses: StockStatus[] = [
    "En stock",
    "available",
    "Sur commande",
  ];

  return availableStatuses.includes(stockStatus);
};

/**
 * Retourne un badge de statut avec couleur appropriée
 *
 * @param stockStatus - Statut de stock
 * @returns Objet avec label et variant pour le badge
 */
export const getStockBadgeInfo = (
  stockStatus?: StockStatus,
): {
  label: string;
  variant: "success" | "warning" | "error" | "default";
} => {
  if (!stockStatus) {
    return { label: "Disponible", variant: "success" };
  }

  switch (stockStatus) {
    case "En stock":
    case "available":
      return { label: "En stock", variant: "success" };

    case "Sur commande":
      return { label: "Sur commande", variant: "warning" };

    default:
      return { label: "Rupture", variant: "error" };
  }
};
