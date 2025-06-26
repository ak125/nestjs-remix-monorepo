/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

export interface ProductsCarGammeData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface ProductsCarGammeResponse {
  status: 'success' | 'error';
  data: ProductsCarGammeData;
  message?: string;
  module: string;
}
