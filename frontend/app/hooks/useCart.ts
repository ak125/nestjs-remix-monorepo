/**
 * 🛒 useCart Hook - Version avec Context partagé
 * 
 * Ce hook utilise CartContext pour synchroniser l'état du panier
 * entre tous les composants (Navbar, CartSidebar, boutons d'ajout).
 * 
 * @example
 * ```tsx
 * const { items, summary, isOpen, toggleCart, addToCart } = useCart();
 * ```
 */

import { useContext } from 'react';
import { CartContext } from '../contexts/CartContext';
import { type CartItem, type CartSummary } from '../types/cart';

interface UseCartReturn {
  items: CartItem[];
  summary: CartSummary;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => void;
}

// Valeurs par défaut pour le fallback (hors contexte)
const defaultSummary: CartSummary = {
  total_items: 0,
  total_price: 0,
  subtotal: 0,
  tax_amount: 0,
  shipping_cost: 0,
  consigne_total: 0,
  currency: 'EUR',
};

/**
 * Hook pour accéder au panier partagé
 * 
 * ⚠️ IMPORTANT: Ce hook doit être utilisé à l'intérieur d'un CartProvider
 */
export function useCart(): UseCartReturn {
  const context = useContext(CartContext);
  
  // Si le contexte n'existe pas, retourner des valeurs par défaut
  // Cela permet aux composants de fonctionner même sans provider
  if (!context) {
    console.warn('⚠️ useCart appelé hors de CartProvider - fonctionnalités limitées');
    
    return {
      items: [],
      summary: defaultSummary,
      isOpen: false,
      isLoading: false,
      error: null,
      toggleCart: () => console.warn('CartProvider manquant'),
      openCart: () => console.warn('CartProvider manquant'),
      closeCart: () => console.warn('CartProvider manquant'),
      addToCart: async () => console.warn('CartProvider manquant'),
      removeItem: async () => console.warn('CartProvider manquant'),
      updateQuantity: async () => console.warn('CartProvider manquant'),
      clearCart: async () => console.warn('CartProvider manquant'),
      refreshCart: () => console.warn('CartProvider manquant'),
    };
  }
  
  return context;
}

/**
 * 💰 Formater un prix en EUR
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * 🎨 Obtenir l'URL de l'image avec fallback
 */
export function getProductImageUrl(item: CartItem): string {
  if (item.product_image) {
    return item.product_image;
  }
  
  // Fallback basé sur la logique PHP legacy
  return '/images/no.png';
}

// Re-export du CartProvider pour faciliter l'import
export { CartProvider, useCartContext } from '../contexts/CartContext';
