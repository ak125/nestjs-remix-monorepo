/**
 * Cart shared utilities — constants, formatters, localStorage backup
 */

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

interface CartBackupItem {
  product_id: number;
  quantity: number;
  product_name?: string;
  price?: number;
}

export function saveCartToLocalStorage(items: CartBackupItem[]): void {
  try {
    if (typeof window === "undefined") return;
    if (items.length === 0) {
      localStorage.removeItem(CART_BACKUP_KEY);
      return;
    }
    localStorage.setItem(
      CART_BACKUP_KEY,
      JSON.stringify({ items, savedAt: Date.now() }),
    );
  } catch {
    // localStorage full or disabled — ignore
  }
}

export function loadCartFromLocalStorage(): CartBackupItem[] | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(CART_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 7 days
    if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CART_BACKUP_KEY);
      return null;
    }
    return parsed.items || null;
  } catch {
    return null;
  }
}

export function clearCartLocalStorage(): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CART_BACKUP_KEY);
  } catch {
    // ignore
  }
}
