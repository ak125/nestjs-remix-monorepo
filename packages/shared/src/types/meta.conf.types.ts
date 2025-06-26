/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: core
 */

export interface MetaConfData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface MetaConfResponse {
  status: 'success' | 'error';
  data: MetaConfData;
  message?: string;
  module: string;
}
