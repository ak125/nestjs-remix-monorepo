/**
 * RPC Safety Gate - Types
 *
 * Defines types for the RPC governance system that controls access
 * to Supabase RPC functions based on security classification.
 */

export type RpcGateMode = 'observe' | 'enforce' | 'disabled';
export type RpcEnforceLevel = 'P0' | 'P1' | 'P2' | 'ALL';
export type RpcDecision = 'ALLOW' | 'BLOCK' | 'OBSERVE';
export type RpcSource = 'api' | 'cron' | 'admin' | 'internal' | 'unknown';

/**
 * Context passed to the RPC gate for evaluation
 */
export interface RpcGateContext {
  /** Unique request ID for tracing */
  requestId?: string;
  /** User ID making the request */
  userId?: string | number;
  /** User role: 'anon' | 'authenticated' | 'service_role' */
  role?: string;
  /** Source of the request */
  source?: RpcSource;
  /** Admin override token */
  adminToken?: string;
  /** Internal flag for service role (not exposed to clients) */
  isServiceRole?: boolean;
}

/**
 * Result of an RPC call through the gate
 */
export interface RpcGateResult<T = unknown> {
  decision: RpcDecision;
  reason: string;
  data?: T;
  error?: Error;
  durationMs: number;
}

/**
 * Structured log entry for RPC calls
 */
export interface RpcLogEntry {
  timestamp: string;
  env: string;
  mode: RpcGateMode;
  enforceLevel: RpcEnforceLevel;
  rpc: string;
  decision: RpcDecision;
  reason: string;
  role?: string;
  userId?: string;
  requestId?: string;
  source?: string;
  durationMs: number;
  error?: string;
}

/**
 * Definition of an RPC function in governance files
 */
export interface RpcFunctionDef {
  name: string;
  volatility?: 'IMMUTABLE' | 'STABLE' | 'VOLATILE';
  reason: string;
  severity?: 'P0' | 'P1' | 'P2';
  risk?: string;
}

/**
 * Structure of rpc_allowlist.json
 */
export interface RpcAllowlist {
  version: string;
  generated_at: string;
  description?: string;
  total: number;
  functions: RpcFunctionDef[];
}

/**
 * Structure of a denylist category
 */
export interface RpcDenylistCategory {
  count: number;
  access: string;
  reason?: string;
  functions: (RpcFunctionDef | string)[];
}

/**
 * Structure of rpc_denylist.json
 */
export interface RpcDenylist {
  version: string;
  generated_at: string;
  description?: string;
  total: number;
  categories: {
    P0_CRITICAL: RpcDenylistCategory;
    P1_HIGH: RpcDenylistCategory;
    P2_MEDIUM: RpcDenylistCategory;
  };
}

/**
 * Metrics returned by the gate for monitoring
 */
export interface RpcGateMetrics {
  mode: RpcGateMode;
  enforceLevel: RpcEnforceLevel;
  env: string;
  allowlistSize: number;
  denylistP0Size: number;
  denylistP1Size: number;
  denylistP2Size: number;
  totalCalls: number;
  totalBlocks: number;
  topCallers: [string, number][];
  topBlocked: [string, number][];
}
