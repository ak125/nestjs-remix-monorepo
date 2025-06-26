/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

export interface MyspaceConnectTryData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface MyspaceConnectTryResponse {
  status: 'success' | 'error';
  data: MyspaceConnectTryData;
  message?: string;
  module: string;
}
