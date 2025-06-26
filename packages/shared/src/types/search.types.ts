/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: catalog
 */

export interface SearchData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface SearchResponse {
  status: 'success' | 'error';
  data: SearchData;
  message?: string;
  module: string;
}
