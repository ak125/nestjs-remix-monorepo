/**
 * 🛒 useCart Hook - Version sans Context
 *
 * Utilise directement l'API cart.api.ts et émet des événements
 * pour synchroniser le panier globalement via useRevalidator.
 */

import { useState, useCallback } from "react";

import { useRootCart } from "../root";
import { cartApi, formatPrice, getProductImageUrl } from "../services/cart.api";

// Re-export les utilitaires
export { formatPrice, getProductImageUrl };

/**
 * Hook principal pour les opérations panier
 * - Lecture via useRootCart (données SSR du root loader)
 * - Actions via cartApi + émission event 'cart:updated'
 */
export function useCart() {
  const rootCart = useRootCart();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Données du panier depuis le root loader
  const items = rootCart?.items || [];
  const summary = rootCart?.summary || {
    total_items: 0,
    total_price: 0,
    subtotal: 0,
    tax_amount: 0,
    shipping_cost: 0,
    consigne_total: 0,
    currency: "EUR",
  };

  // Émettre l'événement pour synchroniser globalement
  const emitCartUpdated = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cart:updated"));
    }
  };

  // Ajouter un article au panier
  const addToCart = useCallback(
    async (
      productId: number,
      quantity: number = 1,
      typeId?: number,
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await cartApi.addItem(productId, quantity, typeId);
        if (result.success) {
          emitCartUpdated();
          return true;
        } else {
          setError(result.error || "Erreur lors de l'ajout");
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Mettre à jour la quantité
  const updateQuantity = useCallback(
    async (productId: number, quantity: number): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await cartApi.updateQuantity(productId, quantity);
        if (result.success) {
          emitCartUpdated();
          return true;
        } else {
          setError(result.error || "Erreur lors de la mise à jour");
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Supprimer un article
  const removeItem = useCallback(
    async (productId: number): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await cartApi.removeItem(productId);
        if (result.success) {
          emitCartUpdated();
          return true;
        } else {
          setError(result.error || "Erreur lors de la suppression");
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Vider le panier
  const clearCart = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.clearCart();
      if (result.success) {
        emitCartUpdated();
        return true;
      } else {
        setError(result.error || "Erreur lors du vidage");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // Données (lecture depuis SSR)
    items,
    summary,
    itemCount: summary.total_items,
    subtotal: summary.subtotal,

    // État
    isLoading,
    error,

    // Actions
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  };
}

// Alias pour compatibilité
export const useCartContext = useCart;
