/**
 * useCartSidebar — Event-based cart sidebar trigger
 *
 * Permet a BottomNav (ou tout composant) d'ouvrir le cart sidebar
 * gere par Navbar, sans couplage direct.
 * Meme pattern que "cart:updated" (root.tsx).
 */
import { useEffect } from "react";

const CART_SIDEBAR_EVENT = "cart:toggle-sidebar";

/** Dispatch depuis n'importe quel composant (ex: BottomNav) */
export function openCartSidebar() {
  window.dispatchEvent(new CustomEvent(CART_SIDEBAR_EVENT));
}

/** Ecouter dans Navbar pour ouvrir/fermer le sidebar */
export function useCartSidebarListener(callback: () => void) {
  useEffect(() => {
    window.addEventListener(CART_SIDEBAR_EVENT, callback);
    return () => window.removeEventListener(CART_SIDEBAR_EVENT, callback);
  }, [callback]);
}
