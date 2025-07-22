import { Injectable, Logger } from '@nestjs/common';

// Types pour le cart
export interface CartItem {
  id: number;
  user_id: string;
  product_id: number;
  quantity: number;
  price: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartItemWithProduct extends CartItem {
  product?: {
    name: string;
    description?: string;
    price: number;
    image_url?: string;
  };
}

export interface CartSummary {
  total_items: number;
  total_quantity: number;
  subtotal: number;
  total: number;
  currency: string;
}

export interface AddToCartDto {
  product_id: number;
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}

export interface CartOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  // Mock data pour le développement - utilise les vraies tables à l'avenir
  private mockCartItems: Map<string, CartItem[]> = new Map();
  private nextId = 1;

  constructor() {
    this.logger.log(
      'CartService initialisé avec des données mockées pour la démonstration',
    );

    // Initialiser quelques données de démonstration
    this.mockCartItems.set('demo-user', [
      {
        id: 1,
        user_id: 'demo-user',
        product_id: 123456,
        quantity: 2,
        price: 45.99,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 2,
        user_id: 'demo-user',
        product_id: 789012,
        quantity: 1,
        price: 89.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  }

  /**
   * Récupérer les articles du panier d'un utilisateur
   */
  async getCartItems(userId: string): Promise<CartItemWithProduct[]> {
    try {
      this.logger.log(
        `Récupération des articles du panier pour l'utilisateur: ${userId}`,
      );

      const items = this.mockCartItems.get(userId) || [];

      // Transformer en CartItemWithProduct avec des données mock
      const cartItems: CartItemWithProduct[] = items.map((item) => ({
        ...item,
        product: {
          name: `Pièce Auto ${item.product_id}`,
          description: `Description de la pièce ${item.product_id}`,
          price: item.price,
          image_url: `https://example.com/piece-${item.product_id}.jpg`,
        },
      }));

      this.logger.log(
        `Articles du panier récupérés: ${cartItems.length} articles`,
      );
      return cartItems;
    } catch (error) {
      this.logger.error(`Erreur dans getCartItems:`, error);
      return [];
    }
  }

  /**
   * Ajouter un article au panier
   */
  async addToCart(
    userId: string,
    addToCartDto: AddToCartDto,
  ): Promise<CartOperationResult> {
    try {
      this.logger.log(
        `Ajout au panier pour l'utilisateur: ${userId}`,
        addToCartDto,
      );

      const userItems = this.mockCartItems.get(userId) || [];

      // Vérifier si l'article existe déjà
      const existingItemIndex = userItems.findIndex(
        (item) => item.product_id === addToCartDto.product_id,
      );

      if (existingItemIndex >= 0) {
        // Mettre à jour la quantité
        userItems[existingItemIndex].quantity += addToCartDto.quantity;
        userItems[existingItemIndex].updated_at = new Date().toISOString();
      } else {
        // Ajouter un nouvel article
        const newItem: CartItem = {
          id: this.nextId++,
          user_id: userId,
          product_id: addToCartDto.product_id,
          quantity: addToCartDto.quantity,
          price: Math.random() * 100 + 10, // Prix mockés entre 10 et 110€
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        userItems.push(newItem);
      }

      this.mockCartItems.set(userId, userItems);

      this.logger.log(`Article ajouté avec succès au panier`);
      return {
        success: true,
        message: 'Article ajouté au panier avec succès',
      };
    } catch (error) {
      this.logger.error(`Erreur dans addToCart:`, error);
      return {
        success: false,
        message: "Erreur lors de l'ajout au panier",
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Mettre à jour la quantité d'un article dans le panier
   */
  async updateCartItem(
    userId: string,
    itemId: number,
    updateDto: UpdateCartItemDto,
  ): Promise<CartOperationResult> {
    try {
      this.logger.log(
        `Mise à jour de l'article ${itemId} pour l'utilisateur: ${userId}`,
        updateDto,
      );

      const userItems = this.mockCartItems.get(userId) || [];
      const itemIndex = userItems.findIndex((item) => item.id === itemId);

      if (itemIndex === -1) {
        return {
          success: false,
          message: 'Article non trouvé dans le panier',
        };
      }

      if (updateDto.quantity <= 0) {
        // Supprimer l'article si la quantité est 0 ou moins
        userItems.splice(itemIndex, 1);
      } else {
        // Mettre à jour la quantité
        userItems[itemIndex].quantity = updateDto.quantity;
        userItems[itemIndex].updated_at = new Date().toISOString();
      }

      this.mockCartItems.set(userId, userItems);

      return {
        success: true,
        message: 'Article mis à jour avec succès',
      };
    } catch (error) {
      this.logger.error(`Erreur dans updateCartItem:`, error);
      return {
        success: false,
        message: 'Erreur lors de la mise à jour',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Supprimer un article du panier
   */
  async removeFromCart(
    userId: string,
    itemId: number,
  ): Promise<CartOperationResult> {
    try {
      this.logger.log(
        `Suppression de l'article ${itemId} pour l'utilisateur: ${userId}`,
      );

      const userItems = this.mockCartItems.get(userId) || [];
      const itemIndex = userItems.findIndex((item) => item.id === itemId);

      if (itemIndex === -1) {
        return {
          success: false,
          message: 'Article non trouvé dans le panier',
        };
      }

      userItems.splice(itemIndex, 1);
      this.mockCartItems.set(userId, userItems);

      return {
        success: true,
        message: 'Article supprimé du panier avec succès',
      };
    } catch (error) {
      this.logger.error(`Erreur dans removeFromCart:`, error);
      return {
        success: false,
        message: 'Erreur lors de la suppression',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Vider le panier
   */
  async clearCart(userId: string): Promise<CartOperationResult> {
    try {
      this.logger.log(`Vidage du panier pour l'utilisateur: ${userId}`);

      this.mockCartItems.set(userId, []);

      return {
        success: true,
        message: 'Panier vidé avec succès',
      };
    } catch (error) {
      this.logger.error(`Erreur dans clearCart:`, error);
      return {
        success: false,
        message: 'Erreur lors du vidage du panier',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer le résumé du panier
   */
  async getCartSummary(userId: string): Promise<CartSummary> {
    try {
      this.logger.log(`Résumé du panier pour l'utilisateur: ${userId}`);

      const items = this.mockCartItems.get(userId) || [];

      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      return {
        total_items: items.length,
        total_quantity: totalQuantity,
        subtotal: subtotal,
        total: subtotal, // Pas de taxes pour le moment
        currency: 'EUR',
      };
    } catch (error) {
      this.logger.error(`Erreur dans getCartSummary:`, error);
      return {
        total_items: 0,
        total_quantity: 0,
        subtotal: 0,
        total: 0,
        currency: 'EUR',
      };
    }
  }
}
