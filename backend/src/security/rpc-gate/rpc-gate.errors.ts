/**
 * RPC Safety Gate - Error Classes
 *
 * Custom error classes for RPC operations that preserve
 * full error details from Supabase and the gate.
 */

/**
 * Raw error structure from Supabase RPC calls
 */
export interface SupabaseRpcErrorDetails {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Custom error class that preserves all Supabase error details
 * instead of just the message string.
 */
export class SupabaseRpcError extends Error {
  public readonly code?: string;
  public readonly details?: string;
  public readonly hint?: string;
  public readonly raw: unknown;

  constructor(raw: unknown) {
    const err = raw as SupabaseRpcErrorDetails | null;
    super(err?.message ?? 'Supabase RPC error');
    this.name = 'SupabaseRpcError';
    this.code = err?.code;
    this.details = err?.details;
    this.hint = err?.hint;
    this.raw = raw;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, SupabaseRpcError.prototype);
  }

  /**
   * Serialize error for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      hint: this.hint,
    };
  }
}

/**
 * Error thrown when an RPC call is blocked by the safety gate
 */
export class RpcBlockedError extends Error {
  constructor(
    public readonly rpcName: string,
    public readonly reason: string,
  ) {
    super(`RPC blocked by safety gate: ${rpcName} (${reason})`);
    this.name = 'RpcBlockedError';

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, RpcBlockedError.prototype);
  }

  /**
   * Serialize error for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      rpcName: this.rpcName,
      reason: this.reason,
    };
  }
}
