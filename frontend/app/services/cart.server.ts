/**
 * 🛒 CART SERVER SERVICE - Service Remix pour gestion du panier
 * 
 * Service serveur qui encapsule les appels API backend
 * Compatible avec l'architecture existante RemixApiService
 */

import { type AppLoadContext } from "@remix-run/node";
import { type CartItem, type CartSummary, type CartData } from "../types/cart";

// Re-export des types pour compatibilité
export type { CartItem, CartSummary, CartData } from "../types/cart";

// Interface pour l'ancienne compatibilité avec les totaux
export interface Cart {
  cart_id: string;
  user_id?: string;
  items: CartItem[];
  totals: CartSummary;
  metadata: {
    promo_code?: string;
    shipping_address?: any;
    [key: string]: any;
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
   * 🔗 Référence vers l'API service existant
   */
  private apiService: any = null;

  /**
   * 🎯 Obtenir le panier complet
   */
  async getCart(request: Request, context?: AppLoadContext): Promise<CartData> {
    try {
      // Tentative d'appel au backend réel
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      
      // Récupérer les cookies de session depuis la requête
      const cookie = request.headers.get('Cookie') || '';
      
      console.log("🔄 [CartServer] Appel backend:", `${backendUrl}/api/cart`);
      
      const response = await fetch(`${backendUrl}/api/cart`, {
        method: 'GET',
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/json',
          'User-Agent': 'RemixCartService/1.0'
        }
      });

      if (response.ok) {
        const backendData = await response.json();
        console.log("✅ [CartServer] Données backend reçues:", backendData);
        
        // Normaliser les données du backend vers notre format
        return this.normalizeBackendData(backendData);
      } else {
        console.warn("⚠️ [CartServer] Backend non disponible, utilisation des données de démo");
      }

    } catch (error) {
      console.warn("⚠️ [CartServer] Erreur backend, fallback vers démo:", error);
    }

    // Fallback : simulation avec données de démo
    console.log("🔄 [CartServer] Utilisation des données de démo");
    
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
          weight: 0.2
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
          weight: 0.5
        }
      ],
      summary: {
        total_items: 2,
        total_price: 149.97,
        subtotal: 149.97,
        tax_amount: 0,
        shipping_cost: 0,
        discount_amount: 0,
        currency: "EUR"
      },
      metadata: {
        user_id: "demo-user",
        session_id: "demo-session",
        last_updated: new Date().toISOString()
      }
    };
  }

  /**
   * ➕ Ajouter un article au panier
   */
  async addItem(
    request: Request, 
    productId: string, 
    quantity: number = 1,
    context?: AppLoadContext
  ): Promise<CartActionResult> {
    try {
      console.log(`➕ [CartServer] Ajout article ${productId} x${quantity}`);
      
      // Tentative d'utilisation de l'API service existant
      if (this.apiService?.cart?.addItem) {
        return await this.apiService.cart.addItem(request, productId, quantity);
      }

      // Simulation d'ajout
      return {
        success: true,
        message: `Article ${productId} ajouté au panier (x${quantity})`,
        cart: await this.getCartAsLegacyFormat(request, context)
      };

    } catch (error) {
      console.error("❌ [CartServer] Erreur addItem:", error);
      return {
        success: false,
        error: "Erreur lors de l'ajout au panier"
      };
    }
  }

  /**
   * 🔄 Mettre à jour la quantité d'un article
   */
  async updateQuantity(
    request: Request,
    itemId: string,
    quantity: number,
    context?: AppLoadContext
  ): Promise<CartActionResult> {
    try {
      console.log(`🔄 [CartServer] Mise à jour quantité ${itemId}: ${quantity}`);
      
      if (quantity <= 0) {
        return await this.removeFromCart(request, itemId, context);
      }

      // Tentative d'utilisation de l'API service existant
      if (this.apiService?.cart?.updateQuantity) {
        return await this.apiService.cart.updateQuantity(request, itemId, quantity);
      }

      // Simulation de mise à jour
      return {
        success: true,
        message: `Quantité mise à jour pour l'article ${itemId}`,
        cart: await this.getCartAsLegacyFormat(request, context)
      };

    } catch (error) {
      console.error("❌ [CartServer] Erreur updateQuantity:", error);
      return {
        success: false,
        error: "Erreur lors de la mise à jour"
      };
    }
  }

  /**
   * 🗑️ Supprimer un article du panier
   */
  async removeFromCart(
    request: Request,
    itemId: string,
    context?: AppLoadContext
  ): Promise<CartActionResult> {
    try {
      console.log(`🗑️ [CartServer] Suppression article ${itemId}`);
      
      // Tentative d'utilisation de l'API service existant
      if (this.apiService?.cart?.removeItem) {
        return await this.apiService.cart.removeItem(request, itemId);
      }

      // Simulation de suppression
      return {
        success: true,
        message: `Article ${itemId} supprimé du panier`,
        cart: await this.getCartAsLegacyFormat(request, context)
      };

    } catch (error) {
      console.error("❌ [CartServer] Erreur removeFromCart:", error);
      return {
        success: false,
        error: "Erreur lors de la suppression"
      };
    }
  }

  /**
   * 🧹 Vider le panier
   */
  async clearCart(request: Request, context?: AppLoadContext): Promise<CartActionResult> {
    try {
      console.log("🧹 [CartServer] Vidage du panier");
      
      // Tentative d'utilisation de l'API service existant
      if (this.apiService?.cart?.clearCart) {
        return await this.apiService.cart.clearCart(request);
      }

      // Simulation de vidage
      return {
        success: true,
        message: "Panier vidé",
        cart: {
          cart_id: "empty-cart",
          items: [],
          totals: {
            total_items: 0,
            total_price: 0,
            subtotal: 0,
            tax_amount: 0,
            shipping_cost: 0,
            currency: "EUR"
          },
          metadata: {}
        }
      };

    } catch (error) {
      console.error("❌ [CartServer] Erreur clearCart:", error);
      return {
        success: false,
        error: "Erreur lors du vidage du panier"
      };
    }
  }

  /**
   * ✅ Valider le panier
   */
  async validateCart(request: Request, context?: AppLoadContext): Promise<CartActionResult> {
    try {
      const cart = await this.getCart(request, context);
      
      // Validation basique
      if (!cart.items.length) {
        return {
          success: false,
          error: "Le panier est vide"
        };
      }

      // Vérification du stock
      for (const item of cart.items) {
        if (item.stock_available && item.quantity > item.stock_available) {
          return {
            success: false,
            error: `Stock insuffisant pour ${item.product_name}`
          };
        }
      }

      if (cart.summary.total_price <= 0) {
        return {
          success: false,
          error: "Total invalide"
        };
      }

      return {
        success: true,
        message: "Panier valide",
        cart: await this.getCartAsLegacyFormat(request, context)
      };

    } catch (error) {
      console.error("❌ [CartServer] Erreur validateCart:", error);
      return {
        success: false,
        error: "Erreur lors de la validation"
      };
    }
  }

  /**
   * 🔄 Normaliser les données de panier depuis le backend
   */
  private normalizeBackendData(backendData: any): CartData {
    // Le backend renvoie un format comme {"cart_id":"R7QW...","user_id":"usr_...","items":[],"totals":{...},"metadata":{...}}
    
    return {
      items: (backendData.items || []).map((item: any) => ({
        id: item.id || item.cart_item_id || `item-${Date.now()}`,
        user_id: backendData.user_id || item.user_id || "unknown",
        product_id: item.product_id || `prod-${item.id}`,
        quantity: item.quantity || 1,
        price: item.price || item.unit_price || 0,
        unit_price: item.unit_price || item.price || 0,
        total_price: item.total_price || (item.quantity * (item.price || item.unit_price || 0)),
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        product_name: item.product_name || item.name || `Produit ${item.product_id}`,
        product_sku: item.product_sku || item.sku,
        product_ref: item.product_ref || item.product_sku || item.sku,
        product_image: item.product_image || item.image_url || "/images/no-image.png",
        stock_available: item.stock_available || 999,
        weight: item.weight || 0,
        options: item.options || {}
      })),
      summary: {
        total_items: backendData.totals?.item_count || backendData.items?.length || 0,
        total_price: backendData.totals?.total || 0,
        subtotal: backendData.totals?.subtotal || 0,
        tax_amount: backendData.totals?.tax || 0,
        shipping_cost: backendData.totals?.shipping || 0,
        discount_amount: backendData.totals?.discount || 0,
        currency: backendData.metadata?.currency || "EUR"
      },
      metadata: {
        user_id: backendData.user_id,
        session_id: backendData.cart_id,
        last_updated: new Date().toISOString(),
        ...backendData.metadata
      }
    };
  }

  /**
   * 🔄 Normaliser les données de panier (méthode legacy)
   */
  private normalizeCartData(rawCart: any): CartData {
    return {
      items: rawCart.items || [],
      summary: {
        total_items: rawCart.totals?.total_items || rawCart.summary?.total_items || 0,
        total_price: rawCart.totals?.total_price || rawCart.summary?.total_price || 0,
        subtotal: rawCart.totals?.subtotal || rawCart.summary?.subtotal || 0,
        tax_amount: rawCart.totals?.tax_amount || rawCart.summary?.tax_amount || 0,
        shipping_cost: rawCart.totals?.shipping_cost || rawCart.summary?.shipping_cost || 0,
        discount_amount: rawCart.totals?.discount_amount || rawCart.summary?.discount_amount || 0,
        currency: rawCart.totals?.currency || rawCart.summary?.currency || "EUR"
      },
      metadata: rawCart.metadata || {}
    };
  }

  /**
   * 🔄 Convertir vers le format legacy pour compatibilité
   */
  private async getCartAsLegacyFormat(request: Request, context?: AppLoadContext): Promise<Cart> {
    const cartData = await this.getCart(request, context);
    
    return {
      cart_id: cartData.metadata?.session_id || "default-cart",
      user_id: cartData.metadata?.user_id,
      items: cartData.items,
      totals: cartData.summary,
      metadata: cartData.metadata || {}
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
        currency: "EUR"
      },
      metadata: {
        last_updated: new Date().toISOString()
      }
    };
  }

  /**
   * 🔧 Initialiser avec l'API service existant (si disponible)
   */
  setApiService(apiService: any) {
    this.apiService = apiService;
    console.log("🔗 [CartServer] API Service connecté");
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

export const addItem = (request: Request, productId: string, quantity: number = 1, context?: AppLoadContext) =>
  cartServerService.addItem(request, productId, quantity, context);

export const updateQuantity = (request: Request, itemId: string, quantity: number, context?: AppLoadContext) =>
  cartServerService.updateQuantity(request, itemId, quantity, context);

export const removeFromCart = (request: Request, itemId: string, context?: AppLoadContext) =>
  cartServerService.removeFromCart(request, itemId, context);

export const clearCart = (request: Request, context?: AppLoadContext) =>
  cartServerService.clearCart(request, context);

export const validateCart = (request: Request, context?: AppLoadContext) =>
  cartServerService.validateCart(request, context);

/**
 * 🚀 Service par défaut
 */
export default cartServerService;
