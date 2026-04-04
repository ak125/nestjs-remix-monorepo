/**
 * useCartSidebar — Singleton pour ouvrir/fermer le cart sidebar
 *
 * Remplace le mécanisme CustomEvent (fragile en prod).
 * Navbar enregistre son setState via registerCartSidebarSetter().
 * N'importe quel composant appelle openCartSidebar() directement.
 * Appel synchrone → aucun risque de timing, SSR-safe.
 */

let _setIsCartOpen: ((v: boolean) => void) | null = null;

/** Enregistrer le setState du Navbar (appelé au mount, nettoyé au unmount) */
export function registerCartSidebarSetter(
  fn: ((v: boolean) => void) | null,
): void {
  _setIsCartOpen = fn;
}

/** Ouvrir le cart sidebar depuis n'importe quel composant */
export function openCartSidebar(): void {
  _setIsCartOpen?.(true);
}

/** Fermer le cart sidebar */
export function closeCartSidebar(): void {
  _setIsCartOpen?.(false);
}
