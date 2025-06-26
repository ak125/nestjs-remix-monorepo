/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

export interface MyspaceSubscribeData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface MyspaceSubscribeResponse {
  status: 'success' | 'error';
  data: MyspaceSubscribeData;
  message?: string;
  module: string;
}
