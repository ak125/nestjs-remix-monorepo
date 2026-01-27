import { McpDataType } from '../mcp-validation.types';

/**
 * MCP Shadow Route Map Configuration
 *
 * Declarative mapping of API routes to MCP validation tools.
 * Used by the shadow interceptor to determine which MCP tool to call.
 */

export interface McpRouteMapping {
  /** Regex pattern to match the endpoint (method + path) */
  match: RegExp;
  /** Data type for validation */
  dataType: McpDataType;
  /** MCP tool to call */
  tool: string;
  /** Optional: Extract params from URL via capture groups */
  extractParams?: (matches: RegExpMatchArray) => Record<string, unknown>;
  /** Optional: Skip in certain contexts */
  skipIf?: (context: {
    checkoutContext: boolean;
    bypassCache: boolean;
  }) => boolean;
  /** Optional: Description for documentation */
  description?: string;
}

/**
 * MCP Shadow Route Map
 *
 * Order matters: first match wins.
 * More specific routes should come before generic ones.
 */
export const MCP_SHADOW_ROUTE_MAP: McpRouteMapping[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPATIBILITY (CRITICAL)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: /^GET \/api\/kg\/verify-compatibility/,
    dataType: 'compatibility',
    tool: 'verifyPartCompatibility',
    description: 'Knowledge Graph compatibility verification',
  },
  {
    match: /^GET \/api\/catalog\/pieces\/(\d+)\/compatibility/,
    dataType: 'compatibility',
    tool: 'verifyPartCompatibility',
    extractParams: (m) => ({ pieceId: parseInt(m[1], 10) }),
    description: 'Catalog piece compatibility check',
  },
  {
    match: /^POST \/api\/catalog\/verify-compatibility/,
    dataType: 'compatibility',
    tool: 'verifyPartCompatibility',
    description: 'Bulk compatibility verification',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRICE (CRITICAL)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: /^GET \/api\/products\/(\d+)\/price/,
    dataType: 'price',
    tool: 'getVerifiedStockAndPrice',
    extractParams: (m) => ({ pieceId: parseInt(m[1], 10) }),
    description: 'Product price verification',
  },
  {
    match: /^GET \/api\/catalog\/pieces\/(\d+)\/price/,
    dataType: 'price',
    tool: 'getVerifiedStockAndPrice',
    extractParams: (m) => ({ pieceId: parseInt(m[1], 10) }),
    description: 'Catalog piece price',
  },
  {
    match: /^GET \/api\/pricing\//,
    dataType: 'price',
    tool: 'getVerifiedStockAndPrice',
    description: 'Pricing API endpoints',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK (CRITICAL)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: /^GET \/api\/products\/(\d+)\/stock/,
    dataType: 'stock',
    tool: 'getVerifiedStockAndPrice',
    extractParams: (m) => ({ pieceId: parseInt(m[1], 10) }),
    description: 'Product stock verification',
  },
  {
    match: /^GET \/api\/catalog\/pieces\/(\d+)\/availability/,
    dataType: 'stock',
    tool: 'getVerifiedStockAndPrice',
    extractParams: (m) => ({ pieceId: parseInt(m[1], 10) }),
    description: 'Catalog piece availability',
  },
  {
    match: /^POST \/api\/cart\/validate/,
    dataType: 'stock',
    tool: 'getVerifiedStockAndPrice',
    skipIf: () => false, // Never skip cart validation
    description: 'Cart stock validation',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAFETY GATE (CRITICAL) - Phase 3
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: /^POST \/api\/knowledge-graph\/safety\/check/,
    dataType: 'safety',
    tool: 'checkSafetyGate',
    skipIf: () => false, // Never skip safety verification
    description: 'Safety gate verification',
  },
  {
    match: /^POST \/api\/knowledge-graph\/safety\/diagnose/,
    dataType: 'safety',
    tool: 'checkSafetyGate',
    skipIf: () => false, // Never skip safety diagnosis
    description: 'Diagnostic with safety check',
  },
  {
    match: /^POST \/api\/kg\/safety\//,
    dataType: 'safety',
    tool: 'checkSafetyGate',
    description: 'Knowledge Graph safety endpoints',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE (HIGH)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: /^GET \/api\/vehicles\/resolve/,
    dataType: 'vehicle',
    tool: 'verifyVehicleIdentity',
    description: 'Vehicle identity resolution',
  },
  {
    match: /^GET \/api\/catalog\/vehicles\/(\d+)/,
    dataType: 'vehicle',
    tool: 'verifyVehicleIdentity',
    extractParams: (m) => ({ ktypnr: parseInt(m[1], 10) }),
    description: 'Vehicle lookup by KType',
  },
  {
    match: /^POST \/api\/vehicles\/identify/,
    dataType: 'vehicle',
    tool: 'verifyVehicleIdentity',
    description: 'Vehicle identification (VIN/plate)',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSTIC (MEDIUM)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: /^POST \/api\/kg\/diagnose/,
    dataType: 'diagnostic',
    tool: 'diagnose',
    description: 'Knowledge Graph diagnosis',
  },
  {
    match: /^GET \/api\/diagnostic-auto\//,
    dataType: 'diagnostic',
    tool: 'diagnose',
    description: 'Diagnostic auto pages',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE ROLE (MEDIUM)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: /^GET \/api\/seo\/page-role/,
    dataType: 'page_role',
    tool: 'resolvePageRole',
    description: 'SEO page role resolution',
  },
  {
    match: /^GET \/api\/seo\/canonical/,
    dataType: 'page_role',
    tool: 'resolvePageRole',
    description: 'Canonical URL resolution',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REFERENCE (HIGH)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: /^GET \/api\/catalog\/search\/reference/,
    dataType: 'reference',
    tool: 'verifyReference',
    description: 'OEM reference search',
  },
  {
    match: /^GET \/api\/products\/by-ref\//,
    dataType: 'reference',
    tool: 'verifyReference',
    description: 'Product lookup by reference',
  },
];

/**
 * Find matching route for an endpoint
 * @param method HTTP method (GET, POST, etc.)
 * @param path Request path
 * @returns Matching route config or undefined
 */
export function findMatchingRoute(
  method: string,
  path: string,
): { mapping: McpRouteMapping; matches: RegExpMatchArray } | undefined {
  const endpoint = `${method} ${path}`;

  for (const mapping of MCP_SHADOW_ROUTE_MAP) {
    const matches = endpoint.match(mapping.match);
    if (matches) {
      return { mapping, matches };
    }
  }

  return undefined;
}

/**
 * Get all configured data types
 */
export function getConfiguredDataTypes(): McpDataType[] {
  return Array.from(new Set(MCP_SHADOW_ROUTE_MAP.map((r) => r.dataType)));
}

/**
 * Get routes by data type
 */
export function getRoutesByDataType(dataType: McpDataType): McpRouteMapping[] {
  return MCP_SHADOW_ROUTE_MAP.filter((r) => r.dataType === dataType);
}
