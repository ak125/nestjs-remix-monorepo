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
 * @returns true - TOUJOURS disponible (stock désactivé temporairement)
 *
 * ⚠️ FIX 2026-01-21: Gestion stock désactivée car non fonctionnelle
 * Tous les produits sont considérés comme disponibles pour afficher
 * le bouton "Ajouter au panier" sur toutes les fiches produit.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const hasStockAvailable = (_stockStatus?: StockStatus): boolean => {
  // 🛒 Stock désactivé - tous les produits disponibles
  return true;
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
