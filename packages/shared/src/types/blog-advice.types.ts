/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

export interface BlogAdviceData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface BlogAdviceResponse {
  status: 'success' | 'error';
  data: BlogAdviceData;
  message?: string;
  module: string;
}
