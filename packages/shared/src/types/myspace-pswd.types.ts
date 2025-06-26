/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

export interface MyspacePswdData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface MyspacePswdResponse {
  status: 'success' | 'error';
  data: MyspacePswdData;
  message?: string;
  module: string;
}
