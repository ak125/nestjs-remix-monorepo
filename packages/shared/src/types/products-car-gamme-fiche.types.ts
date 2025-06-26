/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

export interface ProductsCarGammeFicheData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface ProductsCarGammeFicheResponse {
  status: 'success' | 'error';
  data: ProductsCarGammeFicheData;
  message?: string;
  module: string;
}
