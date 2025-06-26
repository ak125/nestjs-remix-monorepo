/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: errors
 */

export interface Page412Data {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Page412Response {
  status: 'success' | 'error';
  data: Page412Data;
  message?: string;
  module: string;
}
