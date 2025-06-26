/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

export interface BlogGlobalHeaderSectionData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface BlogGlobalHeaderSectionResponse {
  status: 'success' | 'error';
  data: BlogGlobalHeaderSectionData;
  message?: string;
  module: string;
}
