/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

export interface Mycart.proceed.to.payData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Mycart.proceed.to.payResponse {
  status: 'success' | 'error';
  data: Mycart.proceed.to.payData;
  message?: string;
  module: string;
}
