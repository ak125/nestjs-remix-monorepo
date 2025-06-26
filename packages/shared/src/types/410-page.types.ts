/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: errors
 */

export interface Page410Data {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Page410Response {
  status: 'success' | 'error';
  data: Page410Data;
  message?: string;
  module: string;
}
