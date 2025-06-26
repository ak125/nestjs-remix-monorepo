/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: errors
 */

export interface Page404Data {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Page404Response {
  status: 'success' | 'error';
  data: Page404Data;
  message?: string;
  module: string;
}
