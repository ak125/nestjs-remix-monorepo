/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

export interface MyspaceConnectData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface MyspaceConnectResponse {
  status: 'success' | 'error';
  data: MyspaceConnectData;
  message?: string;
  module: string;
}
