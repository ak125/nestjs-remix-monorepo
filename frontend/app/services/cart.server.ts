/**
 * 🛒 CART SERVER SERVICE - Service Remix pour gestion du panier
 *
 * Service serveur qui encapsule les appels API backend
 * Compatible avec l'architecture existante RemixApiService
 */

import { type AppLoadContext } from "@remix-run/node";
import { logger } from "~/utils/logger";
import {
  type CartItem,
  type CartSummary,
  type CartData,
} from "../schemas/cart.schemas";

// Re-export des types pour compatibilité
export type { CartItem, CartSummary, CartData } from "../schemas/cart.schemas";

// Interface pour l'ancienne compatibilité avec les totaux
export interface Cart {
  cart_id: string;
  user_id?: string;
  items: CartItem[];
  totals: CartSummary;
  metadata: {
    promo_code?: string;
    shipping_address?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * 🎯 Interface pour les actions du panier
 */
export interface CartActionResult {
  success: boolean;
  error?: string;
  message?: string;
  cart?: Cart;
}

/**
 * 📦 Service principal - utilise l'architecture existante RemixApiService
 */
class CartServerService {
  /**
   * Obtenir le panier complet
   */
  async getCart(request: Request, context?: AppLoadContext): Promise<CartData> {
    try {
      // Tentative d'appel au backend réel
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

      // Récupérer les cookies de session depuis la requête
      const cookie = request.headers.get("Cookie") || "";

      const response = await fetch(`${backendUrl}/api/cart`, {
        method: "GET",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "User-Agent": "RemixCartService/1.0",
        },
      });

      if (response.ok) {
        const backendData = await response.json();

        // Normaliser les données du backend vers notre format
        const normalized = this.normalizeBackendData(backendData);
        return normalized;
      } else {
        logger.warn(
          "⚠️ [CartServer] Backend non disponible, utilisation des données de démo",
        );
      }
    } catch (error) {
      logger.warn("⚠️ [CartServer] Erreur backend, fallback vers démo:", error);
    }

    // Fallback : simulation avec données de démo
    return {
      items: [
        {
          id: "demo-item-1",
          user_id: "demo-user",
          product_id: "prod-123",
          quantity: 2,
          price: 29.99,
          unit_price: 29.99,
          total_price: 59.98,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          product_name: "T-Shirt Premium",
          product_sku: "TS-001",
          product_ref: "REF-TS-001",
          product_image: "/images/tshirt-premium.jpg",
          stock_available: 15,
          weight: 0.2,
        },
        {
          id: "demo-item-2",
          user_id: "demo-user",
          product_id: "prod-456",
          quantity: 1,
          price: 89.99,
          unit_price: 89.99,
          total_price: 89.99,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          product_name: "Sweat à Capuche",
          product_sku: "SW-002",
          product_ref: "REF-SW-002",
          product_image: "/images/sweat-capuche.jpg",
          stock_available: 5,
          weight: 0.5,
        },
      ],
      summary: {
        total_items: 2,
        total_price: 149.97,
        subtotal: 149.97,
        tax_amount: 0,
        shipping_cost: 0,
        discount_amount: 0,
        consigne_total: 0,
        currency: "EUR",
      },
      metadata: {
        user_id: "demo-user",
        session_id: "demo-session",
        last_updated: new Date().toISOString(),
      },
    };
  }

  /**
   * Ajouter un article au panier
   */
  async addItem(
    request: Request,
    productId: string,
    quantity: number = 1,
  ): Promise<CartActionResult> {
    try {
      logger.log(`[CartServer] Ajout article ${productId} x${quantity}`);

      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
      const cookie = request.headers.get("Cookie") || "";

      const response = await fetch(`${backendUrl}/api/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "User-Agent": "RemixCartService/1.0",
        },
        body: JSON.stringify({
          product_id: parseInt(productId, 10),
          quantity,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error:
            (errorData as Record<string, string>).message ||
            `Erreur HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        message:
          (result as Record<string, string>).message ||
          `Article ${productId} ajouté`,
      };
    } catch (error) {
      logger.error("[CartServer] Erreur addItem:", error);
      return {
        success: false,
        error: "Erreur lors de l'ajout au panier",
      };
    }
  }

  /**
   * Mettre a jour la quantite d'un article
   */
  async updateQuantity(
    request: Request,
    itemId: string,
    quantity: number,
  ): Promise<CartActionResult> {
    try {
      logger.log(`[CartServer] Mise a jour quantite ${itemId}: ${quantity}`);

      if (quantity <= 0) {
        return await this.removeFromCart(request, itemId);
      }

      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
      const cookie = request.headers.get("Cookie") || "";

      const response = await fetch(`${backendUrl}/api/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "User-Agent": "RemixCartService/1.0",
        },
        body: JSON.stringify({
          product_id: parseInt(itemId, 10),
          quantity,
          replace: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error:
            (errorData as Record<string, string>).message ||
            `Erreur HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        message:
          (result as Record<string, string>).message ||
          `Quantite mise a jour pour l'article ${itemId}`,
      };
    } catch (error) {
      logger.error("[CartServer] Erreur updateQuantity:", error);
      return {
        success: false,
        error: "Erreur lors de la mise a jour",
      };
    }
  }

  /**
   * Supprimer un article du panier
   */
  async removeFromCart(
    request: Request,
    itemId: string,
  ): Promise<CartActionResult> {
    try {
      logger.log(`[CartServer] Suppression article ${itemId}`);

      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
      const cookie = request.headers.get("Cookie") || "";

      const response = await fetch(`${backendUrl}/api/cart/items/${itemId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "User-Agent": "RemixCartService/1.0",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error:
            (errorData as Record<string, string>).message ||
            `Erreur HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        message:
          (result as Record<string, string>).message ||
          `Article ${itemId} supprime`,
      };
    } catch (error) {
      logger.error("[CartServer] Erreur removeFromCart:", error);
      return {
        success: false,
        error: "Erreur lors de la suppression",
      };
    }
  }

  /**
   * Vider le panier
   */
  async clearCart(request: Request): Promise<CartActionResult> {
    try {
      logger.log("[CartServer] Vidage du panier");

      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
      const cookie = request.headers.get("Cookie") || "";

      const response = await fetch(`${backendUrl}/api/cart`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "User-Agent": "RemixCartService/1.0",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Erreur HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      logger.log("✅ [CartServer] Panier vidé:", result);

      return {
        success: true,
        message: result.message || "Panier vidé avec succès",
        cart: {
          cart_id: "empty-cart",
          items: [],
          totals: {
            total_items: 0,
            total_price: 0,
            subtotal: 0,
            tax_amount: 0,
            shipping_cost: 0,
            consigne_total: 0,
            currency: "EUR",
          },
          metadata: {},
        },
      };
    } catch (error) {
      logger.error("❌ [CartServer] Erreur clearCart:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors du vidage du panier",
      };
    }
  }

  /**
   * ✅ Valider le panier
   */
  async validateCart(
    request: Request,
    context?: AppLoadContext,
  ): Promise<CartActionResult> {
    try {
      const cart = await this.getCart(request, context);

      // Validation basique
      if (!cart.items.length) {
        return {
          success: false,
          error: "Le panier est vide",
        };
      }

      // Vérification du stock
      for (const item of cart.items) {
        if (item.stock_available && item.quantity > item.stock_available) {
          return {
            success: false,
            error: `Stock insuffisant pour ${item.product_name}`,
          };
        }
      }

      if (cart.summary.total_price <= 0) {
        return {
          success: false,
          error: "Total invalide",
        };
      }

      return {
        success: true,
        message: "Panier valide",
        cart: await this.getCartAsLegacyFormat(request, context),
      };
    } catch (error) {
      logger.error("❌ [CartServer] Erreur validateCart:", error);
      return {
        success: false,
        error: "Erreur lors de la validation",
      };
    }
  }

  /**
   * 🔄 Normaliser les données de panier depuis le backend
   */
  private normalizeBackendData(backendData: Record<string, any>): CartData {
    // Le backend renvoie un format comme {"cart_id":"R7QW...","user_id":"usr_...","items":[],"totals":{...},"metadata":{...}}
    const items = backendData.items as Record<string, any>[] | undefined;
    const totals = backendData.totals as Record<string, any> | undefined;
    const metadata = backendData.metadata as Record<string, any> | undefined;

    return {
      items: (items || []).map((item) => ({
        id: item.id || item.cart_item_id || `item-${Date.now()}`,
        user_id: backendData.user_id || item.user_id || "unknown",
        product_id: item.product_id || `prod-${item.id}`,
        quantity: item.quantity || 1,
        price: item.price || item.unit_price || 0,
        unit_price: item.unit_price || item.price || 0,
        total_price:
          item.total_price ||
          item.quantity * (item.price || item.unit_price || 0),
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        product_name:
          item.product_name || item.name || `Produit ${item.product_id}`,
        product_sku: item.product_sku || item.sku,
        product_ref: item.product_ref || item.product_sku || item.sku,
        product_brand: item.product_brand || null, // 🔧 AJOUT: Mapper la marque depuis le backend
        product_image:
          item.product_image ||
          item.image_url ||
          "/images/categories/default.svg",
        stock_available: item.stock_available || 999,
        weight: item.weight || 0,
        options: item.options || {},
        // ✅ PHASE 4: Mapper les consignes depuis le backend
        consigne_unit: item.consigne_unit || 0,
        has_consigne: item.has_consigne || false,
        consigne_total: item.consigne_total || 0,
        // Gamme ID pour cross-sell
        pg_id: item.pg_id || undefined,
        // Vehicle type_id pour cross-sell contextuel
        type_id: item.type_id || undefined,
      })),
      summary: {
        total_items: (totals?.total_items as number) || 0,
        total_price:
          (totals?.total as number) || (totals?.total_price as number) || 0, // ✅ Backend envoie "total" pas "total_price"
        subtotal: (totals?.subtotal as number) || 0,
        tax_amount:
          (totals?.tax as number) || (totals?.tax_amount as number) || 0,
        shipping_cost:
          (totals?.shipping as number) ||
          (totals?.shipping_cost as number) ||
          0,
        discount_amount:
          (totals?.discount as number) ||
          (totals?.discount_amount as number) ||
          0,
        consigne_total: (totals?.consigne_total as number) || 0,
        currency: "EUR",
      },
      metadata: {
        user_id: backendData.user_id as string | undefined,
        session_id: backendData.cart_id as string | undefined,
        last_updated: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * 🔄 Normaliser les données de panier (méthode legacy)
   */
  private normalizeCartData(rawCart: any): CartData {
    return {
      items: rawCart.items || [],
      summary: {
        total_items:
          rawCart.totals?.total_items || rawCart.summary?.total_items || 0,
        total_price:
          rawCart.totals?.total ||
          rawCart.totals?.total_price ||
          rawCart.summary?.total_price ||
          0, // ✅ Backend envoie totals.total
        subtotal: rawCart.totals?.subtotal || rawCart.summary?.subtotal || 0,
        tax_amount:
          rawCart.totals?.tax ||
          rawCart.totals?.tax_amount ||
          rawCart.summary?.tax_amount ||
          0,
        shipping_cost:
          rawCart.totals?.shipping ||
          rawCart.totals?.shipping_cost ||
          rawCart.summary?.shipping_cost ||
          0,
        discount_amount:
          rawCart.totals?.discount ||
          rawCart.totals?.discount_amount ||
          rawCart.summary?.discount_amount ||
          0,
        consigne_total:
          rawCart.totals?.consigne_total ||
          rawCart.summary?.consigne_total ||
          0,
        currency:
          rawCart.totals?.currency || rawCart.summary?.currency || "EUR",
      },
      metadata: rawCart.metadata || {},
    };
  }

  /**
   * 🔄 Convertir vers le format legacy pour compatibilité
   */
  private async getCartAsLegacyFormat(
    request: Request,
    context?: AppLoadContext,
  ): Promise<Cart> {
    const cartData = await this.getCart(request, context);

    return {
      cart_id: cartData.metadata?.session_id || "default-cart",
      user_id: cartData.metadata?.user_id,
      items: cartData.items,
      totals: cartData.summary,
      metadata: cartData.metadata || {},
    };
  }

  /**
   * 📭 Panier vide
   */
  private getEmptyCart(): CartData {
    return {
      items: [],
      summary: {
        total_items: 0,
        total_price: 0,
        subtotal: 0,
        tax_amount: 0,
        shipping_cost: 0,
        consigne_total: 0,
        currency: "EUR",
      },
      metadata: {
        last_updated: new Date().toISOString(),
      },
    };
  }
}

/**
 * 🌟 Instance unique du service
 */
export const cartServerService = new CartServerService();

/**
 * 🎯 Fonctions utilitaires pour l'export
 */
export const getCart = (request: Request, context?: AppLoadContext) =>
  cartServerService.getCart(request, context);

export const addItem = (
  request: Request,
  productId: string,
  quantity: number = 1,
) => cartServerService.addItem(request, productId, quantity);

export const updateQuantity = (
  request: Request,
  itemId: string,
  quantity: number,
) => cartServerService.updateQuantity(request, itemId, quantity);

export const removeFromCart = (request: Request, itemId: string) =>
  cartServerService.removeFromCart(request, itemId);

export const clearCart = (request: Request) =>
  cartServerService.clearCart(request);

export const validateCart = (request: Request, context?: AppLoadContext) =>
  cartServerService.validateCart(request, context);

/**
 * 🚀 Service par défaut
 */
export default cartServerService;
