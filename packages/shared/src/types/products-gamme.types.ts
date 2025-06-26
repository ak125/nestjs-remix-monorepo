/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

export interface ProductsGammeData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface ProductsGammeResponse {
  status: 'success' | 'error';
  data: ProductsGammeData;
  message?: string;
  module: string;
}
