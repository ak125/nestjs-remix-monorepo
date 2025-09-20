export interface CartItem {
  id: number;
  user_id: string; // UUID comme string
  product_id: string; // UUID comme string
  quantity: number;
  price: number;
  created_at: Date;
  updated_at: Date;
}

export interface CartMetadata {
  id: number;
  user_id: string; // UUID comme string
  total_items: number;
  total_quantity: number;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  promo_code?: string;
  promo_discount: number;
  promo_applied_at?: Date;
  currency: string;
  status: string;
  last_activity: Date;
  session_id?: string;
  shipping_address?: any;
  billing_address?: any;
  created_at: Date;
  updated_at: Date;
}

export interface PromoCode {
  id: number;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  start_date: Date;
  end_date: Date;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PromoUsage {
  id: number;
  promo_code_id: number;
  user_id: string;
  cart_id?: number;
  order_id?: number;
  discount_applied: number;
  used_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CartStats {
  item_count: number;
  total_quantity: number;
  subtotal: number;
  total: number;
  has_promo: boolean;
  promo_discount: number;
}

export interface PromoValidation {
  valid: boolean;
  discount: number;
  reason?: string;
}
