/**
 * 🛒 CART TYPES - Types pour le module panier
 */

export interface CartItem {
  id: string;  // UUID du backend
  user_id: string;
  product_id: string; // UUID du backend
  quantity: number;
  price: number;
  created_at: string;
  updated_at: string;
  product_name?: string;
  product_sku?: string;
  product_ref?: string; // Référence produit
  product_brand?: string; // 🔧 AJOUT: Marque du produit
  product_image?: string; // URL image produit
  weight?: number;
  stock_available?: number; // Stock disponible
  unit_price?: number; // Prix unitaire (alias de price)
  total_price?: number; // Prix total calculé
  options?: Record<string, any>;
}

export interface CartSummary {
  total_items: number;
  total_price: number;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount?: number;
  currency: string;
}

export interface CartData {
  items: CartItem[];
  summary: CartSummary;
  metadata?: {
    user_id?: string;
    session_id?: string;
    last_updated: string;
  };
}
