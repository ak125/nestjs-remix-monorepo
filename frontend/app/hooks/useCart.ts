/**
 * 🛒 useCart Hook
 * 
 * Re-export du contexte CartContext pour compatibilité.
 * Toute la logique est centralisée dans CartContext.tsx
 * qui utilise cart.api.ts pour les appels API.
 */

// Re-export tout depuis CartContext
export { 
  useCart, 
  useCartContext, 
  CartProvider, 
  CartContext 
} from '../contexts/CartContext';

export type { CartContextType } from '../contexts/CartContext';

// Re-export les utilitaires depuis cart.api.ts
export { formatPrice, getProductImageUrl } from '../services/cart.api';
