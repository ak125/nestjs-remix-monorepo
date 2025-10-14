/**
 * 🛒 useCart Hook - PHASE 1 POC
 * 
 * Hook React pour gérer le panier avec support des consignes.
 * 
 * Features:
 * - Calcul automatique des consignes (pri_consigne_ttc)
 * - Subtotal produits + Total consignes séparé
 * - Intégration avec API backend existante
 * - Synchronisation temps réel
 * 
 * @example
 * ```tsx
 * const { items, summary, isOpen, toggleCart, removeItem } = useCart();
 * ```
 */

import { useFetcher } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
import type { CartData, CartItem, CartSummary } from '../types/cart';

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
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  refreshCart: () => void;
}

/**
 * Hook personnalisé pour gérer le panier avec consignes
 */
export function useCart(): UseCartReturn {
  // État local
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState<CartSummary>({
    total_items: 0,
    total_price: 0,
    subtotal: 0,
    tax_amount: 0,
    shipping_cost: 0,
    consigne_total: 0,
    currency: 'EUR',
  });
  const [error, setError] = useState<string | null>(null);

  // Fetcher pour les appels API
  const fetcher = useFetcher<{ success: boolean; cart?: CartData; error?: string }>();

  // 📊 Calcul automatique du résumé avec consignes
  const calculateSummary = useCallback((cartItems: CartItem[]): CartSummary => {
    if (!cartItems || cartItems.length === 0) {
      return {
        total_items: 0,
        total_price: 0,
        subtotal: 0,
        tax_amount: 0,
        shipping_cost: 0,
        consigne_total: 0,
        currency: 'EUR',
      };
    }

    // Calcul des totaux
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    
    // Subtotal produits (HT consignes)
    const subtotal = cartItems.reduce((sum, item) => {
      const unitPrice = item.unit_price || item.price || 0;
      return sum + (unitPrice * item.quantity);
    }, 0);

    // 🆕 Total consignes (remboursables)
    const consigneTotal = cartItems.reduce((sum, item) => {
      const consigneUnit = item.consigne_unit || 0;
      return sum + (consigneUnit * item.quantity);
    }, 0);

    // Total TTC = Subtotal + Consignes
    const totalPrice = subtotal + consigneTotal;

    return {
      total_items: totalItems,
      total_price: totalPrice,
      subtotal: subtotal,
      tax_amount: 0, // TODO: Calculer TVA si nécessaire
      shipping_cost: 0, // TODO: Calculer frais port
      consigne_total: consigneTotal,
      currency: 'EUR',
    };
  }, []);

  // 🔄 Charger le panier au montage
  useEffect(() => {
    refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 📥 Traiter la réponse du fetcher
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success && fetcher.data.cart) {
        const cartData = fetcher.data.cart;
        
        // Enrichir les items avec calcul consignes
        const enrichedItems = cartData.items.map(item => ({
          ...item,
          consigne_total: (item.consigne_unit || 0) * item.quantity,
          has_consigne: (item.consigne_unit || 0) > 0,
        }));

        setItems(enrichedItems);
        
        // Utiliser le summary du backend OU recalculer localement
        if (cartData.summary) {
          setSummary({
            ...cartData.summary,
            consigne_total: enrichedItems.reduce((sum, item) => 
              sum + (item.consigne_total || 0), 0
            ),
          });
        } else {
          setSummary(calculateSummary(enrichedItems));
        }
        
        setError(null);
      } else if (fetcher.data.error) {
        setError(fetcher.data.error);
      }
    }
  }, [fetcher.data, calculateSummary]);

  // 🔄 Actions du panier
  const toggleCart = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const openCart = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  const refreshCart = useCallback(() => {
    // Charger le panier via le loader /cart
    fetcher.load('/cart');
  }, [fetcher]);

  const removeItem = useCallback((itemId: string) => {
    // Supprimer via action DELETE
    fetcher.submit(
      { itemId },
      { method: 'DELETE', action: '/cart' }
    );
  }, [fetcher]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(itemId);
      return;
    }

    // Mettre à jour via action PATCH
    fetcher.submit(
      { itemId, quantity: quantity.toString() },
      { method: 'PATCH', action: '/cart' }
    );
  }, [fetcher, removeItem]);

  return {
    items,
    summary,
    isOpen,
    isLoading: fetcher.state !== 'idle',
    error,
    
    // Actions
    toggleCart,
    openCart,
    closeCart,
    removeItem,
    updateQuantity,
    refreshCart,
  };
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
  // Si PIECE_HAS_IMG = 0 → no.png
  return '/images/no.png';
}
