/**
 * 🛒 CartContext - État global du panier
 * 
 * Fournit un contexte React pour partager l'état du panier
 * entre tous les composants (Navbar, Sidebar, Pages, Boutons).
 * 
 * Utilise cart.api.ts pour TOUS les appels API.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { cartApi } from '../services/cart.api';
import type { CartItem, CartSummary, CartData } from '../types/cart';

// ============================================================================
// TYPES
// ============================================================================

interface CartContextType {
  items: CartItem[];
  summary: CartSummary;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions UI
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;

  // Actions API
  addToCart: (productId: number, quantity?: number) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  refreshCart: () => Promise<void>;

  // Mise à jour directe
  setCartData: (items: CartItem[], summary: CartSummary) => void;
}

// ============================================================================
// VALEURS PAR DÉFAUT
// ============================================================================

const defaultSummary: CartSummary = {
  total_items: 0,
  total_price: 0,
  subtotal: 0,
  tax_amount: 0,
  shipping_cost: 0,
  consigne_total: 0,
  currency: 'EUR',
};

// ============================================================================
// CONTEXTE
// ============================================================================

const CartContext = createContext<CartContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface CartProviderProps {
  children: ReactNode;
  initialData?: {
    items: CartItem[];
    summary: CartSummary;
  } | null;
}

export function CartProvider({ children, initialData }: CartProviderProps) {
  // DEBUG: Log pour voir les données initiales
  if (typeof window !== 'undefined') {
    console.log('🛒 [CartProvider] initialData:', initialData ? `${initialData.items?.length || 0} items` : 'null');
  }
  
  const [items, setItems] = useState<CartItem[]>(initialData?.items || []);
  const [summary, setSummary] = useState<CartSummary>(initialData?.summary || defaultSummary);
  const [isInitialized, setIsInitialized] = useState(!!initialData);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  const extractProductId = (itemId: string): number => {
    const parts = itemId.split('-');
    if (parts.length >= 2) {
      const productId = parseInt(parts[1], 10);
      if (!isNaN(productId)) return productId;
    }
    const parsed = parseInt(itemId, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const updateCartState = useCallback((cartData: CartData) => {
    const enrichedItems = cartData.items.map((item) => ({
      ...item,
      consigne_total: (item.consigne_unit || 0) * item.quantity,
      has_consigne: (item.consigne_unit || 0) > 0,
    }));
    setItems(enrichedItems);
    setSummary(cartData.summary);
    setError(null);
  }, []);

  const emitCartUpdated = () => {
    window.dispatchEvent(new Event('cart:updated'));
  };

  // ──────────────────────────────────────────────────────────────────────────
  // ACTIONS UI
  // ──────────────────────────────────────────────────────────────────────────

  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  // ──────────────────────────────────────────────────────────────────────────
  // ACTIONS API
  // ──────────────────────────────────────────────────────────────────────────

  const refreshCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await cartApi.getCart();
      if (result.success && result.data) {
        updateCartState(result.data);
      } else {
        setError(result.error || 'Erreur lors du chargement');
      }
    } finally {
      setIsLoading(false);
    }
  }, [updateCartState]);

  const addToCart = useCallback(
    async (productId: number, quantity: number = 1): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      openCart();

      try {
        const result = await cartApi.addItem(productId, quantity);
        if (result.success && result.cart) {
          updateCartState(result.cart);
          emitCartUpdated();
          return true;
        } else {
          setError(result.error || "Erreur lors de l'ajout");
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [openCart, updateCartState]
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      const productId = extractProductId(itemId);
      if (!productId) {
        setError('ID produit invalide');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await cartApi.removeItem(productId);
        if (result.success && result.cart) {
          updateCartState(result.cart);
          emitCartUpdated();
          return true;
        } else {
          setError(result.error || 'Erreur lors de la suppression');
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [updateCartState]
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number): Promise<boolean> => {
      const productId = extractProductId(itemId);
      if (!productId) {
        setError('ID produit invalide');
        return false;
      }

      if (quantity < 1) {
        return removeItem(itemId);
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await cartApi.updateQuantity(productId, quantity);
        if (result.success && result.cart) {
          updateCartState(result.cart);
          emitCartUpdated();
          return true;
        } else {
          setError(result.error || 'Erreur lors de la mise à jour');
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [removeItem, updateCartState]
  );

  const clearCart = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.clearCart();
      if (result.success) {
        setItems([]);
        setSummary(defaultSummary);
        emitCartUpdated();
        return true;
      } else {
        setError(result.error || 'Erreur lors du vidage');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setCartData = useCallback(
    (newItems: CartItem[], newSummary: CartSummary) => {
      const enrichedItems = newItems.map((item) => ({
        ...item,
        consigne_total: (item.consigne_unit || 0) * item.quantity,
        has_consigne: (item.consigne_unit || 0) > 0,
      }));
      setItems(enrichedItems);
      setSummary(newSummary);
      setError(null);
    },
    []
  );

  // ──────────────────────────────────────────────────────────────────────────
  // EFFETS
  // ──────────────────────────────────────────────────────────────────────────

  // NE PAS charger le panier au mount - laisser les loaders Remix gérer ça
  // Le CartContext sera synchronisé via setCartData depuis les pages qui ont des loaders
  // Cela évite les problèmes de session entre serveur et client
  useEffect(() => {
    if (initialData) {
      console.log('🛒 [CartContext] Initialisé avec données serveur:', initialData.items?.length || 0, 'items');
      setIsInitialized(true);
    }
  }, [initialData]);

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  const value: CartContextType = {
    items,
    summary,
    isOpen,
    isLoading,
    error,
    toggleCart,
    openCart,
    closeCart,
    addToCart,
    removeItem,
    updateQuantity,
    clearCart,
    refreshCart,
    setCartData,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useCartContext(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
}

// Alias pour compatibilité avec useCart existant
export const useCart = useCartContext;

// Export du contexte
export { CartContext };
export type { CartContextType };
