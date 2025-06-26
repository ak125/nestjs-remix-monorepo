/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: errors
 */

export interface Page410PageForOldLinkData {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
}

export interface Page410PageForOldLinkResponse {
  status: 'success' | 'error';
  data: 410PageForOldLinkData;
  message?: string;
  module: string;
}
