/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

export interface Mycart.showData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Mycart.showResponse {
  status: 'success' | 'error';
  data: Mycart.showData;
  message?: string;
  module: string;
}
