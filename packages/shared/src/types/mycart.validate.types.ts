/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: ecommerce
 */

export interface Mycart.validateData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Mycart.validateResponse {
  status: 'success' | 'error';
  data: Mycart.validateData;
  message?: string;
  module: string;
}
