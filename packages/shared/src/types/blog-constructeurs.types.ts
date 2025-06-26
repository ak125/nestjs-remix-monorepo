/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

export interface BlogConstructeursData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface BlogConstructeursResponse {
  status: 'success' | 'error';
  data: BlogConstructeursData;
  message?: string;
  module: string;
}
