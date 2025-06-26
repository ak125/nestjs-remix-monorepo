/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

export interface BlogGuideItemData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface BlogGuideItemResponse {
  status: 'success' | 'error';
  data: BlogGuideItemData;
  message?: string;
  module: string;
}
