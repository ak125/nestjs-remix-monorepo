/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

export interface BlogGuideData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface BlogGuideResponse {
  status: 'success' | 'error';
  data: BlogGuideData;
  message?: string;
  module: string;
}
