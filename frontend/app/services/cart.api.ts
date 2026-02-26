/**
 * 🛒 CART API SERVICE - Point d'entrée unique pour toutes les opérations panier
 *
 * Ce service centralise TOUS les appels API vers le backend NestJS.
 * Aucun autre fichier ne devrait faire de fetch vers /api/cart/*.
 *
 * @example
 * ```tsx
 * import { cartApi } from '~/services/cart.api';
 *
 * // Ajouter un article
 * const result = await cartApi.addItem(12345, 2);
 * if (result.success) {
 *   console.log('Panier:', result.cart);
 * }
 * ```
 */

import { logger } from "~/utils/logger";
import { type CartData, type CartItem, type CartSummary } from "../types/cart";

// ============================================================================
// TYPES
// ============================================================================

export interface CartApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AddItemResponse {
  success: boolean;
  cart?: CartData;
  item?: CartItem;
  error?: string;
}

export interface UpdateQuantityResponse {
  success: boolean;
  cart?: CartData;
  error?: string;
}

export interface RemoveItemResponse {
  success: boolean;
  cart?: CartData;
  error?: string;
}

export interface ClearCartResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = "/api/cart";

/**
 * Headers par défaut pour les requêtes API
 */
const getHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

/**
 * Options fetch par défaut (inclut les cookies pour la session)
 */
const getFetchOptions = (): RequestInit => ({
  credentials: "include",
  headers: getHeaders(),
});

// ============================================================================
// HELPERS - AUTH
// ============================================================================

/**
 * 🔐 Gère les erreurs 401 (session expirée) avec redirection vers login
 * Retourne true si c'était un 401 (et la redirection est en cours)
 */
function handle401Redirect(response: Response): boolean {
  if (response.status === 401) {
    // Sauvegarder l'URL actuelle pour redirection post-login
    const returnTo = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    window.location.href = `/login?redirectTo=${returnTo}`;
    return true;
  }
  return false;
}

// ============================================================================
// SERVICE API
// ============================================================================

export const cartApi = {
  /**
   * 📦 Récupérer le panier complet
   */
  async getCart(): Promise<CartApiResponse<CartData>> {
    try {
      const response = await fetch(API_BASE, {
        method: "GET",
        ...getFetchOptions(),
      });

      if (!response.ok) {
        // Session expirée → redirection login
        if (handle401Redirect(response)) {
          return { success: false, error: "Session expirée" };
        }
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Erreur HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: normalizeCartData(data),
      };
    } catch (error) {
      logger.error("❌ [cartApi.getCart] Erreur:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur réseau",
      };
    }
  },

  /**
   * ➕ Ajouter un article au panier
   *
   * @param productId - ID du produit (number)
   * @param quantity - Quantité à ajouter (défaut: 1)
   */
  async addItem(
    productId: number,
    quantity: number = 1,
  ): Promise<AddItemResponse> {
    try {
      logger.log("➕ [cartApi.addItem]", { productId, quantity });

      const response = await fetch(`${API_BASE}/items`, {
        method: "POST",
        ...getFetchOptions(),
        body: JSON.stringify({
          product_id: productId,
          quantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Session expirée → redirection login
        if (handle401Redirect(response)) {
          return { success: false, error: "Session expirée" };
        }
        logger.error(
          "❌ [cartApi.addItem] Erreur HTTP:",
          response.status,
          data,
        );
        return {
          success: false,
          error: data.message || `Erreur HTTP ${response.status}`,
        };
      }

      logger.log("✅ [cartApi.addItem] Succès");
      return {
        success: true,
        cart: data.cart ? normalizeCartData(data.cart) : undefined,
        item: data.item,
      };
    } catch (error) {
      logger.error("❌ [cartApi.addItem] Erreur:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur réseau",
      };
    }
  },

  /**
   * 🔄 Mettre à jour la quantité d'un article
   *
   * @param productId - ID du produit (number)
   * @param quantity - Nouvelle quantité
   */
  async updateQuantity(
    productId: number,
    quantity: number,
  ): Promise<UpdateQuantityResponse> {
    try {
      logger.log("🔄 [cartApi.updateQuantity]", { productId, quantity });

      if (quantity < 1) {
        // Si quantité < 1, supprimer l'article
        return this.removeItem(productId);
      }

      const response = await fetch(`${API_BASE}/items`, {
        method: "POST",
        ...getFetchOptions(),
        body: JSON.stringify({
          product_id: productId,
          quantity,
          replace: true, // Remplacer la quantité au lieu d'ajouter
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Session expirée → redirection login
        if (handle401Redirect(response)) {
          return { success: false, error: "Session expirée" };
        }
        logger.error(
          "❌ [cartApi.updateQuantity] Erreur HTTP:",
          response.status,
          data,
        );
        return {
          success: false,
          error: data.message || `Erreur HTTP ${response.status}`,
        };
      }

      logger.log("✅ [cartApi.updateQuantity] Succès");
      return {
        success: true,
        cart: data.cart ? normalizeCartData(data.cart) : undefined,
      };
    } catch (error) {
      logger.error("❌ [cartApi.updateQuantity] Erreur:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur réseau",
      };
    }
  },

  /**
   * 🗑️ Supprimer un article du panier
   *
   * @param productId - ID du produit (number)
   */
  async removeItem(productId: number): Promise<RemoveItemResponse> {
    try {
      logger.log("🗑️ [cartApi.removeItem]", { productId });

      const response = await fetch(`${API_BASE}/items/${productId}`, {
        method: "DELETE",
        ...getFetchOptions(),
      });

      const data = await response.json();

      if (!response.ok) {
        // Session expirée → redirection login
        if (handle401Redirect(response)) {
          return { success: false, error: "Session expirée" };
        }
        logger.error(
          "❌ [cartApi.removeItem] Erreur HTTP:",
          response.status,
          data,
        );
        return {
          success: false,
          error: data.message || `Erreur HTTP ${response.status}`,
        };
      }

      logger.log("✅ [cartApi.removeItem] Succès");
      return {
        success: true,
        cart: data.cart ? normalizeCartData(data.cart) : undefined,
      };
    } catch (error) {
      logger.error("❌ [cartApi.removeItem] Erreur:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur réseau",
      };
    }
  },

  /**
   * 🧹 Vider complètement le panier
   */
  async clearCart(): Promise<ClearCartResponse> {
    try {
      logger.log("🧹 [cartApi.clearCart]");

      const response = await fetch(API_BASE, {
        method: "DELETE",
        ...getFetchOptions(),
      });

      const data = await response.json();

      if (!response.ok) {
        // Session expirée → redirection login
        if (handle401Redirect(response)) {
          return { success: false, error: "Session expirée" };
        }
        logger.error(
          "❌ [cartApi.clearCart] Erreur HTTP:",
          response.status,
          data,
        );
        return {
          success: false,
          error: data.message || `Erreur HTTP ${response.status}`,
        };
      }

      logger.log("✅ [cartApi.clearCart] Succès");
      return {
        success: true,
        message: data.message || "Panier vidé",
      };
    } catch (error) {
      logger.error("❌ [cartApi.clearCart] Erreur:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur réseau",
      };
    }
  },

  /**
   * 🎁 Appliquer un code promo
   *
   * @param code - Code promotionnel
   */
  async applyPromoCode(code: string): Promise<CartApiResponse<CartData>> {
    try {
      logger.log("🎁 [cartApi.applyPromoCode]", { code });

      const response = await fetch(`${API_BASE}/promo`, {
        method: "POST",
        ...getFetchOptions(),
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Session expirée → redirection login
        if (handle401Redirect(response)) {
          return { success: false, error: "Session expirée" };
        }
        return {
          success: false,
          error: data.message || "Code promo invalide",
        };
      }

      return {
        success: true,
        data: data.cart ? normalizeCartData(data.cart) : undefined,
        message: data.message,
      };
    } catch (error) {
      logger.error("❌ [cartApi.applyPromoCode] Erreur:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur réseau",
      };
    }
  },

  /**
   * ❌ Retirer le code promo
   */
  async removePromoCode(): Promise<CartApiResponse<CartData>> {
    try {
      const response = await fetch(`${API_BASE}/promo`, {
        method: "DELETE",
        ...getFetchOptions(),
      });

      const data = await response.json();

      if (!response.ok) {
        // Session expirée → redirection login
        if (handle401Redirect(response)) {
          return { success: false, error: "Session expirée" };
        }
        return {
          success: false,
          error: data.message || "Erreur lors du retrait du code promo",
        };
      }

      return {
        success: true,
        data: data.cart ? normalizeCartData(data.cart) : undefined,
      };
    } catch (error) {
      logger.error("❌ [cartApi.removePromoCode] Erreur:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur réseau",
      };
    }
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normaliser les données du panier depuis le backend
 */
function normalizeCartData(data: any): CartData {
  const items: CartItem[] = (data.items || []).map((item: any) => ({
    ...item,
    // Enrichir avec les champs calculés
    consigne_total: (item.consigne_unit || 0) * item.quantity,
    has_consigne: (item.consigne_unit || 0) > 0,
  }));

  const summary: CartSummary = data.summary || {
    total_items: items.reduce((sum, item) => sum + item.quantity, 0),
    total_price: data.totals?.total || 0,
    subtotal: data.totals?.subtotal || 0,
    tax_amount: data.totals?.tax || 0,
    shipping_cost: data.totals?.shipping || 0,
    consigne_total: data.totals?.consigne_total || 0,
    currency: "EUR",
  };

  return { items, summary };
}

export { formatPrice } from "~/utils/format";

/**
 * 🖼️ Obtenir l'URL de l'image produit avec fallback
 */
export function getProductImageUrl(item: CartItem): string {
  if (item.product_image) {
    return item.product_image;
  }
  return "/images/no.png";
}

// Export par défaut
export default cartApi;
