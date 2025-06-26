/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

export interface Mycart.add.qtyData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Mycart.add.qtyResponse {
  status: 'success' | 'error';
  data: Mycart.add.qtyData;
  message?: string;
  module: string;
}
