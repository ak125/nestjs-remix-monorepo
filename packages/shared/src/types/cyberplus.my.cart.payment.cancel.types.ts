/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

export interface Cyberplus.my.cart.payment.cancelData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Cyberplus.my.cart.payment.cancelResponse {
  status: 'success' | 'error';
  data: Cyberplus.my.cart.payment.cancelData;
  message?: string;
  module: string;
}
