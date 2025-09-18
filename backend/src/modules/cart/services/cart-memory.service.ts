/**
 * 🛒 CART SERVICE TEMPORAIRE - Stockage en mémoire
 * 
 * Service temporaire pour tester le système de panier sans la base de données
 * ✅ Stockage en mémoire (Map)
 * ✅ Simulation d'un vrai panier
 * ✅ Compatible avec l'interface existante
 */

import { Injectable, Logger } from '@nestjs/common';

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  name: string;
  addedAt: Date;
}

export interface Cart {
  id: string;
  sessionId: string;
  userId?: string;
  items: CartItem[];
  metadata: {
    subtotal: number;
    promo_code?: string;
    shipping_address?: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CartMemoryService {
  private readonly logger = new Logger(CartMemoryService.name);
  private carts: Map<string, Cart> = new Map();

  /**
   * Récupérer ou créer un panier
   */
  getCart(sessionId: string, userId?: string): Cart {
    const cartKey = userId || sessionId;
    
    if (!this.carts.has(cartKey)) {
      const newCart: Cart = {
        id: `cart_${Date.now()}`,
        sessionId,
        userId,
        items: [],
        metadata: {
          subtotal: 0,
          promo_code: null,
          shipping_address: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      this.carts.set(cartKey, newCart);
      this.logger.log(`✅ Nouveau panier créé: ${cartKey}`);
    }

    const cart = this.carts.get(cartKey)!;
    this.logger.log(`🛒 Panier récupéré: ${cart.items.length} articles`);
    return cart;
  }

  /**
   * Ajouter un article au panier
   */
  addItem(sessionId: string, productId: string, quantity: number, userId?: string): Cart {
    const cart = this.getCart(sessionId, userId);
    const cartKey = userId || sessionId;

    // Vérifier si l'article existe déjà
    const existingItemIndex = cart.items.findIndex(item => item.product_id === productId);

    if (existingItemIndex >= 0) {
      // Mettre à jour la quantité
      cart.items[existingItemIndex].quantity += quantity;
      this.logger.log(`🔄 Quantité mise à jour pour produit ${productId}: ${cart.items[existingItemIndex].quantity}`);
    } else {
      // Ajouter nouvel article
      const newItem: CartItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        product_id: productId,
        quantity,
        price: this.getProductPrice(productId), // Prix simulé
        name: this.getProductName(productId), // Nom simulé
        addedAt: new Date(),
      };

      cart.items.push(newItem);
      this.logger.log(`➕ Nouvel article ajouté: ${productId} (qty: ${quantity})`);
    }

    // Mettre à jour les métadonnées
    cart.metadata.subtotal = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();

    this.carts.set(cartKey, cart);
    this.logger.log(`✅ Panier mis à jour: ${cart.items.length} articles, total: ${cart.metadata.subtotal}€`);

    return cart;
  }

  /**
   * Supprimer un article du panier
   */
  removeItem(sessionId: string, productId: string, userId?: string): Cart {
    const cart = this.getCart(sessionId, userId);
    const cartKey = userId || sessionId;

    cart.items = cart.items.filter(item => item.product_id !== productId);
    cart.metadata.subtotal = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();

    this.carts.set(cartKey, cart);
    this.logger.log(`🗑️ Article supprimé: ${productId}`);

    return cart;
  }

  /**
   * Vider le panier
   */
  clearCart(sessionId: string, userId?: string): Cart {
    const cart = this.getCart(sessionId, userId);
    const cartKey = userId || sessionId;

    cart.items = [];
    cart.metadata.subtotal = 0;
    cart.updatedAt = new Date();

    this.carts.set(cartKey, cart);
    this.logger.log(`🧹 Panier vidé: ${cartKey}`);

    return cart;
  }

  /**
   * Obtenir le prix d'un produit (simulation)
   */
  private getProductPrice(productId: string): number {
    // Simulation de prix basée sur l'ID
    const prices: { [key: string]: number } = {
      '12345': 29.99,
      '67890': 49.99,
      '11111': 19.99,
    };

    return prices[productId] || Math.round((Math.random() * 100 + 10) * 100) / 100;
  }

  /**
   * Obtenir le nom d'un produit (simulation)
   */
  private getProductName(productId: string): string {
    const names: { [key: string]: string } = {
      '12345': 'Produit Test 1',
      '67890': 'Produit Test 2', 
      '11111': 'Produit Test 3',
    };

    return names[productId] || `Produit ${productId}`;
  }

  /**
   * Statistiques de debug
   */
  getStats(): { totalCarts: number; totalItems: number } {
    const totalItems = Array.from(this.carts.values())
      .reduce((total, cart) => total + cart.items.length, 0);

    return {
      totalCarts: this.carts.size,
      totalItems,
    };
  }
}