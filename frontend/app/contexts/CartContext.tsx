/**
 * 🛒 CartContext - État partagé du panier
 * 
 * Permet de synchroniser le panier entre tous les composants:
 * - Navbar (compteur)
 * - CartSidebar (liste des articles)
 * - Boutons "Ajouter au panier"
 * 
 * @example
 * ```tsx
 * // Dans root.tsx
 * <CartProvider>
 *   <App />
 * </CartProvider>
 * 
 * // Dans n'importe quel composant
 * const { items, summary, addToCart } = useCartContext();
 * ```
 */

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useFetcher } from '@remix-run/react';
import { type CartData, type CartItem, type CartSummary } from '../types/cart';

// Types
interface CartContextType {
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
  
  // Mise à jour directe (pour optimisation)
  setCartData: (items: CartItem[], summary: CartSummary) => void;
}

const defaultSummary: CartSummary = {
  total_items: 0,
  total_price: 0,
  subtotal: 0,
  tax_amount: 0,
  shipping_cost: 0,
  consigne_total: 0,
  currency: 'EUR',
};

// Contexte
const CartContext = createContext<CartContextType | null>(null);

// Provider
export function CartProvider({ children }: { children: ReactNode }) {
  // État partagé
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState<CartSummary>(defaultSummary);
  const [error, setError] = useState<string | null>(null);

  // Fetcher pour les appels API
  const fetcher = useFetcher<{ success: boolean; cart?: CartData; error?: string }>();

  // 🔄 Charger le panier au montage
  useEffect(() => {
    fetcher.load('/cart');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 📥 Traiter la réponse du fetcher
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success && fetcher.data.cart) {
        const cartData = fetcher.data.cart;
        
        // Enrichir les items
        const enrichedItems = cartData.items.map(item => ({
          ...item,
          consigne_total: (item.consigne_unit || 0) * item.quantity,
          has_consigne: (item.consigne_unit || 0) > 0,
        }));

        setItems(enrichedItems);
        
        if (cartData.summary) {
          setSummary(cartData.summary);
        }
        
        setError(null);
      } else if (fetcher.data.error) {
        setError(fetcher.data.error);
      }
    }
  }, [fetcher.data]);

  // Actions
  const toggleCart = useCallback(() => setIsOpen(prev => !prev), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  
  const refreshCart = useCallback(() => {
    fetcher.load('/cart');
  }, [fetcher]);

  // Mise à jour directe depuis les réponses API optimisées
  const setCartData = useCallback((newItems: CartItem[], newSummary: CartSummary) => {
    const enrichedItems = newItems.map(item => ({
      ...item,
      consigne_total: (item.consigne_unit || 0) * item.quantity,
      has_consigne: (item.consigne_unit || 0) > 0,
    }));
    setItems(enrichedItems);
    setSummary(newSummary);
    setError(null);
  }, []);

  // ➕ Ajouter au panier
  const addToCart = useCallback(async (productId: number, quantity: number = 1) => {
    try {
      console.log('➕ [CartContext] addToCart:', { productId, quantity });
      
      // ⚡ Ouvrir le panier IMMÉDIATEMENT
      openCart();
      
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ product_id: productId, quantity })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [CartContext] Article ajouté');
        
        // ⚡ Mise à jour directe depuis la réponse
        if (data.cart) {
          console.log('⚡ [CartContext] Mise à jour inline:', data.cart.summary?.total_items);
          setCartData(data.cart.items || [], data.cart.summary || defaultSummary);
        } else {
          refreshCart();
        }
        
        // Émettre événement pour compatibilité
        window.dispatchEvent(new Event('cart:updated'));
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [CartContext] Erreur:', errorData);
        setError(errorData.message || 'Erreur lors de l\'ajout');
      }
    } catch (err) {
      console.error('❌ [CartContext] Erreur réseau:', err);
      setError('Erreur réseau');
    }
  }, [openCart, setCartData, refreshCart]);

  // 🗑️ Supprimer du panier
  const removeItem = useCallback(async (itemId: string) => {
    try {
      const parts = itemId.split('-');
      const productId = parts.length >= 2 ? parts[1] : itemId;
      
      console.log('🗑️ [CartContext] removeItem:', { itemId, productId });
      
      const response = await fetch(`/api/cart/items/${productId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [CartContext] Article supprimé');
        
        if (data.cart) {
          setCartData(data.cart.items || [], data.cart.summary || defaultSummary);
        } else {
          refreshCart();
        }
        
        window.dispatchEvent(new Event('cart:updated'));
      } else {
        console.error('❌ [CartContext] Erreur suppression');
      }
    } catch (err) {
      console.error('❌ [CartContext] Erreur:', err);
    }
  }, [setCartData, refreshCart]);

  // 🔄 Mettre à jour quantité
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      return removeItem(itemId);
    }

    try {
      const parts = itemId.split('-');
      const productId = parts.length >= 2 ? parts[1] : itemId;
      
      console.log('🔄 [CartContext] updateQuantity:', { productId, quantity });
      
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          product_id: parseInt(productId), 
          quantity,
          replace: true 
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [CartContext] Quantité mise à jour');
        
        if (data.cart) {
          setCartData(data.cart.items || [], data.cart.summary || defaultSummary);
        } else {
          refreshCart();
        }
        
        window.dispatchEvent(new Event('cart:updated'));
      } else {
        console.error('❌ [CartContext] Erreur mise à jour');
      }
    } catch (err) {
      console.error('❌ [CartContext] Erreur:', err);
    }
  }, [removeItem, setCartData, refreshCart]);

  // 🧹 Vider le panier
  const clearCart = useCallback(async () => {
    try {
      console.log('🧹 [CartContext] Vidage du panier');
      
      const response = await fetch('/api/cart', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        console.log('✅ [CartContext] Panier vidé');
        setItems([]);
        setSummary(defaultSummary);
        window.dispatchEvent(new Event('cart:updated'));
      } else {
        console.error('❌ [CartContext] Erreur vidage panier');
      }
    } catch (err) {
      console.error('❌ [CartContext] Erreur:', err);
    }
  }, []);

  const value: CartContextType = {
    items,
    summary,
    isOpen,
    isLoading: fetcher.state !== 'idle',
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

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// Hook pour utiliser le contexte
export function useCartContext(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
}

// Export du contexte pour les cas avancés
export { CartContext };
