/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: core
 */

export interface SqlConfData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface SqlConfResponse {
  status: 'success' | 'error';
  data: SqlConfData;
  message?: string;
  module: string;
}
