/**
 * MCP GENERATED TYPES - RESELLER PROTECTED
 * Généré automatiquement par MCP Context-7
 * Module: reseller-ecommerce
 * Sécurité: Types revendeurs uniquement
 * Source: massdoc/mycart.php
 */

export interface ResellerEcommerceData {
  id: string;
  resellerId: string;
  productId: string;
  quantity: number;
  resellerPrice: number;
  discountPercent: number;
  status: 'active' | 'reserved' | 'ordered' | 'cancelled';
  product?: ResellerProductData;
  resellerDiscount?: ResellerDiscountData;
  createdAt: string;
  updatedAt: string;
}

export interface ResellerProductData {
  id: string;
  name: string;
  reference: string;
  publicPrice: number;
  resellerPrice: number;
  costPrice?: number; // Visible pour admins uniquement
  margin: number;
  stockLevel: number;
  resellerDiscount: number;
  supplierRef: string;
  description: string;
  images: string[];
  category: string;
  status: 'active' | 'discontinued' | 'out_of_stock';
  lastResellerOrder?: string;
}

export interface ResellerDiscountData {
  id: string;
  resellerId: string;
  productId?: string;
  categoryId?: string;
  percentage: number;
  fixedAmount?: number;
  minQuantity?: number;
  maxQuantity?: number;
  validFrom: string;
  validTo?: string;
  isActive: boolean;
  type: 'percentage' | 'fixed' | 'tier' | 'volume';
}

export interface ResellerData {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  territory: string;
  level: 'standard' | 'premium' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  discountTiers: ResellerDiscountData[];
  totalOrders: number;
  totalAmount: number;
  lastOrderDate?: string;
  createdAt: string;
  permissions: string[];
}

export interface ResellerEcommerceResponse {
  status: 'success' | 'error';
  data: ResellerEcommerceData | ResellerEcommerceData[];
  message?: string;
  module: 'reseller-ecommerce';
  security: 'reseller-protected';
  timestamp: string;
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
  };
}

export interface ResellerStockData {
  id: string;
  productId: string;
  resellerId: string;
  quantity: number;
  reserved: number;
  available: number;
  threshold: number;
  lastMovement: string;
  movements: ResellerStockMovement[];
}

export interface ResellerStockMovement {
  id: string;
  type: 'in' | 'out' | 'reserve' | 'release' | 'adjustment';
  quantity: number;
  reference: string;
  reason: string;
  performedBy: string;
  timestamp: string;
}

export interface ResellerAuthData {
  id: string;
  resellerId: string;
  userType: 'reseller' | 'admin';
  resellerLevel: 'standard' | 'premium' | 'enterprise';
  permissions: string[];
  territory?: string;
  status: 'active' | 'suspended';
  lastLogin: string;
  sessionExpires: string;
}

export interface ResellerDashboardData {
  resellerId: string;
  summary: {
    totalOrders: number;
    pendingOrders: number;
    totalAmount: number;
    averageOrderValue: number;
  };
  recentOrders: ResellerOrderData[];
  stockAlerts: ResellerStockData[];
  notifications: ResellerNotificationData[];
}

export interface ResellerOrderData {
  id: string;
  orderNumber: string;
  resellerId: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  discountAmount: number;
  items: ResellerOrderItemData[];
  createdAt: string;
  expectedDelivery?: string;
}

export interface ResellerOrderItemData {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  totalPrice: number;
}

export interface ResellerNotificationData {
  id: string;
  type: 'stock_alert' | 'order_update' | 'new_product' | 'promotion';
  title: string;
  message: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}
