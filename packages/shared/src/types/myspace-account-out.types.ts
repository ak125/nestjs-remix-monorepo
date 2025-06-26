/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

export interface MyspaceAccountOutData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface MyspaceAccountOutResponse {
  status: 'success' | 'error';
  data: MyspaceAccountOutData;
  message?: string;
  module: string;
}
