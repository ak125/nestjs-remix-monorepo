/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

export interface SearchFicheData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface SearchFicheResponse {
  status: 'success' | 'error';
  data: SearchFicheData;
  message?: string;
  module: string;
}
