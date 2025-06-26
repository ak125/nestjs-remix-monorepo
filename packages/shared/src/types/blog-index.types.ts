/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

export interface BlogIndexData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface BlogIndexResponse {
  status: 'success' | 'error';
  data: BlogIndexData;
  message?: string;
  module: string;
}
