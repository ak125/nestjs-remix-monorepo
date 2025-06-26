/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: authentication
 */

export interface MyspacePswdProceedData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface MyspacePswdProceedResponse {
  status: 'success' | 'error';
  data: MyspacePswdProceedData;
  message?: string;
  module: string;
}
