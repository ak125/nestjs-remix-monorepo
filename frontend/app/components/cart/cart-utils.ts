/**
 * Cart shared utilities — constants, formatters, localStorage backup
 */

import { safeLocalStorage } from "~/utils/safe-storage";

export const FREE_SHIPPING_THRESHOLD = 150;
export const MAX_CART_QUANTITY = 99;

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

// -- localStorage cart backup --

const CART_BACKUP_KEY = "automecanik_cart_backup";

export interface CartBackupItem {
  product_id: number;
  quantity: number;
  product_name?: string;
  price?: number;
  // Contexte d'ajout rejoué à la restauration (même contrat que POST /api/cart/items)
  type_id?: number;
  website_url?: string; // F1 attribution → orl_website_url
  vehicle_source?: CartVehicleSource; // Mandat CK : provenance de type_id
}

/** Provenance du véhicule d'une ligne (mandat CK). */
export type CartVehicleSource = "page" | "selected_vehicle";

/**
 * Véhicule rattaché à un ajout au panier (mandat CK).
 * - la page porte un véhicule (page pièces du véhicule) : il prime, `page` ;
 * - sinon (recherche, fiche produit), le véhicule choisi par le client
 *   (cookie `selected_vehicle`) est rattaché, `selected_vehicle` ;
 * - sinon aucun véhicule : la ligne le dira à la commande.
 */
export function resolveAddToCartVehicle(
  pageTypeId: number | null | undefined,
  selectedVehicle: { type_id?: number | string | null } | null | undefined,
): { typeId?: number; vehicleSource?: CartVehicleSource } {
  const fromPage = Number(pageTypeId);
  if (Number.isInteger(fromPage) && fromPage > 0) {
    return { typeId: fromPage, vehicleSource: "page" };
  }
  const fromCookie = Number(selectedVehicle?.type_id);
  if (Number.isInteger(fromCookie) && fromCookie > 0) {
    return { typeId: fromCookie, vehicleSource: "selected_vehicle" };
  }
  return {};
}

/**
 * Corps de POST /api/cart/items pour rejouer une ligne sauvegardée.
 * Le prix n'est jamais renvoyé : le serveur fait autorité (F5).
 */
export function buildRestoreAddItemBody(item: CartBackupItem) {
  return {
    product_id: item.product_id,
    quantity: item.quantity,
    ...(item.type_id && { type_id: item.type_id }),
    ...(item.website_url && { website_url: item.website_url }),
    ...(item.type_id &&
      item.vehicle_source && { vehicle_source: item.vehicle_source }),
  };
}

// safeLocalStorage couvre SSR, stockage bloqué et quota plein (Sentry 181aeb23).
export function saveCartToLocalStorage(items: CartBackupItem[]): void {
  if (items.length === 0) {
    safeLocalStorage.removeItem(CART_BACKUP_KEY);
    return;
  }
  safeLocalStorage.setItem(
    CART_BACKUP_KEY,
    JSON.stringify({ items, savedAt: Date.now() }),
  );
}

export function loadCartFromLocalStorage(): CartBackupItem[] | null {
  const raw = safeLocalStorage.getItem(CART_BACKUP_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Expire after 7 days
    if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
      safeLocalStorage.removeItem(CART_BACKUP_KEY);
      return null;
    }
    return parsed.items || null;
  } catch {
    return null;
  }
}

export function clearCartLocalStorage(): void {
  safeLocalStorage.removeItem(CART_BACKUP_KEY);
}
