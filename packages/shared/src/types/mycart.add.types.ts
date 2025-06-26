/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

export interface Mycart.addData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Mycart.addResponse {
  status: 'success' | 'error';
  data: Mycart.addData;
  message?: string;
  module: string;
}
