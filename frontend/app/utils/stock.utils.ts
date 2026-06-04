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
 * Stock statuses that permit selling (maps pri_dispo IN ('1','2','3')):
 * IN_STOCK ('1'), LOW_STOCK ('2'), PREORDER ('3' = sur commande) + legacy labels.
 */
const SELLABLE_STOCK_STATUS = new Set<string>([
  "IN_STOCK",
  "LOW_STOCK",
  "PREORDER",
  "En stock",
  "available",
  "Sur commande",
]);

/**
 * 🛒 Commercial sellability gate (owner rule 2026-06-04):
 *   can_sell = price_exists && supplier availability confirmed (pri_dispo IN '1','2','3').
 *
 * The R2 RPC zeroes the price for any piece without a sellable-dispo price
 * (best_prices filters pri_dispo IN ('1','2','3'), else COALESCE → 0), so
 * `price > 0` already implies a confirmed-available price. When the RPC surfaces
 * `stockStatus`, it additionally excludes OUT_OF_STOCK explicitly. This replaces
 * the temporary `hasStockAvailable() === true` that let 0,00 € pieces be bought.
 */
export const isSellable = (price?: number, stockStatus?: string): boolean => {
  if (!(typeof price === "number" && Number.isFinite(price) && price > 0)) {
    return false;
  }
  if (!stockStatus) return true; // no stock signal surfaced → rely on price>0
  return SELLABLE_STOCK_STATUS.has(stockStatus);
};

/** Preorder = sur commande (pri_dispo '3' / PREORDER) — sellable, delivered with a delay. */
export const isPreorder = (stockStatus?: string): boolean =>
  stockStatus === "PREORDER" || stockStatus === "Sur commande";

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
