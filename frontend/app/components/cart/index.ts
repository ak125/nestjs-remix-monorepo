/**
 * 🛒 CART COMPONENTS MODULE
 * 
 * Export centralisé de tous les composants liés au panier
 * Avec validation Zod intégrée et gestion d'état optimisée
 */

// Composants principaux
export { default as AddToCartForm } from './AddToCartForm';
export { AddToCartModern } from './AddToCartModern';
export { default as CartIcon } from './CartIcon';
export { CartIconModern } from './CartIconModern';
export { default as CartItem } from './CartItem';
export { default as CartSummary } from './CartSummary';
export { default as EmptyCart } from './EmptyCart';

// Composants de développement et debug
export { AddToCartFormFetcher } from './AddToCartFormFetcher';
export { CartIconDebug } from './CartIconDebug';

// Types et interfaces
export type { CartItem as CartItemType } from '../../types/cart-validation';
export type { AddToCartRequest } from '../../types/cart-validation';

// Configuration et constantes
export const CART_CONFIG = {
  // Animation settings
  animations: {
    iconBounce: 'bounce',
    fadeIn: 'fadeIn',
    slideUp: 'slideUp',
  },
  
  // Timing
  debounceMs: 300,
  toastDuration: 3000,
  
  // UI
  maxQuantity: 999,
  minQuantity: 1,
  
  // API endpoints
  endpoints: {
    get: '/api/cart',
    add: '/api/cart/items',
    update: '/api/cart',
    remove: '/api/cart/items',
    clear: '/api/cart/clear',
  },
} as const;