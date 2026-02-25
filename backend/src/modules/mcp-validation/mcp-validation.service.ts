import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  McpValidationContext,
  McpValidationLogEntry,
  McpVerificationResult,
  McpDataType,
  McpShadowComparison,
  CircuitBreakerStatus,
  CircuitBreakerConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  MCP_DATA_TYPE_CONFIG,
  MCP_REFUSAL_MESSAGES,
} from './mcp-validation.types';

/**
 * MCP Validation Service - Phase 1: Shadow Mode
 *
 * Core service for validating AI responses against authoritative data sources.
 * Implements the principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
 */
@Injectable()
export class McpValidationService implements OnModuleDestroy {
  private readonly logger = new Logger(McpValidationService.name);

  // Circuit breaker state per endpoint
  private circuitBreakers = new Map<string, CircuitBreakerStatus>();
  private circuitBreakerConfig: CircuitBreakerConfig =
    DEFAULT_CIRCUIT_BREAKER_CONFIG;

  // In-memory log buffer for batch insertion (Phase 1)
  private logBuffer: McpValidationLogEntry[] = [];
  private readonly LOG_BUFFER_SIZE = 100;
  private readonly LOG_FLUSH_INTERVAL = 30000; // 30 seconds
  private readonly flushTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Start periodic log flush
    this.flushTimer = setInterval(
      () => this.flushLogBuffer(),
      this.LOG_FLUSH_INTERVAL,
    );
  }

  onModuleDestroy(): void {
    clearInterval(this.flushTimer);
    this.flushLogBuffer();
    this.circuitBreakers.clear();
    this.logger.log('McpValidationService destroyed — timer cleared');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE VALIDATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate response in shadow mode (Phase 1)
   * Runs MCP validation in parallel without blocking the response
   */
  async validateShadow<T>(
    directResult: T,
    mcpQueryFn: () => Promise<T>,
    context: McpValidationContext,
  ): Promise<McpShadowComparison> {
    const startTime = Date.now();
    let mcpResult: T | null = null;
    let mcpError: Error | null = null;
    let mcpLatency = 0;

    // Check circuit breaker
    if (this.isCircuitOpen(context.endpoint)) {
      this.logger.warn(
        `Circuit breaker OPEN for ${context.endpoint}, skipping MCP validation`,
      );
      return { matchStatus: 'error' };
    }

    // Execute MCP query (non-blocking in shadow mode)
    try {
      const mcpStart = Date.now();
      mcpResult = await mcpQueryFn();
      mcpLatency = Date.now() - mcpStart;
      this.recordSuccess(context.endpoint);
    } catch (error) {
      mcpError = error instanceof Error ? error : new Error(String(error));
      mcpLatency = Date.now() - startTime;
      this.recordFailure(context.endpoint);
      this.logger.warn(
        `MCP validation error for ${context.endpoint}: ${mcpError.message}`,
      );
    }

    // Compare results
    const comparison = this.compareResults(
      directResult,
      mcpResult,
      context.dataType,
    );

    // Log validation result
    const logEntry = this.createLogEntry(
      context,
      directResult,
      mcpResult,
      comparison,
      {
        latencyMcp: mcpLatency,
        latencyDirect: 0, // Direct result already computed
        latencyTotal: Date.now() - startTime,
        error: mcpError,
      },
    );

    this.bufferLog(logEntry);

    // Log discrepancies for analysis
    if (comparison.matchStatus === 'mismatch') {
      this.logger.warn(
        `MCP mismatch for ${context.endpoint} [${context.dataType}]: ${JSON.stringify(comparison.discrepancies?.slice(0, 3))}`,
      );
    }

    return comparison;
  }

  /**
   * Verify data against MCP (Phase 2+)
   * Returns verification result with status and potential refusal
   */
  async verify<T>(
    data: T,
    mcpQueryFn: () => Promise<T>,
    context: McpValidationContext,
  ): Promise<McpVerificationResult<T>> {
    const startTime = Date.now();

    // Check circuit breaker
    if (this.isCircuitOpen(context.endpoint)) {
      return this.createRefusalResult(
        context.dataType,
        'Circuit breaker open',
        'SERVICE_UNAVAILABLE',
      );
    }

    try {
      const mcpResult = await mcpQueryFn();
      const comparison = this.compareResults(data, mcpResult, context.dataType);

      if (comparison.matchStatus === 'match') {
        return {
          verified: true,
          status: 'verified',
          data,
          confidence: comparison.similarity || 1.0,
          source: 'mcp_verified',
          verified_at: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
        };
      }

      // Handle mismatch based on criticality
      const config = MCP_DATA_TYPE_CONFIG[context.dataType];
      if (config.criticality === 'critical') {
        return this.createRefusalResult(
          context.dataType,
          'Data mismatch on critical field',
          'MISMATCH',
        );
      }

      // Return verified with warning for non-critical
      return {
        verified: true,
        status: 'verified',
        data,
        confidence: comparison.similarity || 0.8,
        source: 'mcp_partial',
        verified_at: new Date().toISOString(),
        latency_ms: Date.now() - startTime,
      };
    } catch (error) {
      this.recordFailure(context.endpoint);
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if fallback is allowed
      const config = MCP_DATA_TYPE_CONFIG[context.dataType];
      if (config.fallbackAllowed) {
        return {
          verified: false,
          status: 'unverified',
          data,
          source: 'fallback',
          verified_at: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
        };
      }

      return this.createRefusalResult(
        context.dataType,
        err.message,
        'VERIFICATION_ERROR',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPARISON METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compare direct result with MCP result
   * Made public for use by McpVerifyInterceptor
   */
  public compareResults<T>(
    directResult: T,
    mcpResult: T | null,
    dataType: McpDataType,
  ): McpShadowComparison {
    if (mcpResult === null) {
      return { matchStatus: 'mcp_only' };
    }

    if (directResult === null || directResult === undefined) {
      return { matchStatus: 'direct_only' };
    }

    // Deep comparison
    const discrepancies = this.findDiscrepancies(
      directResult,
      mcpResult,
      dataType,
    );

    if (discrepancies.length === 0) {
      return { matchStatus: 'match', similarity: 1.0 };
    }

    // Calculate similarity
    const criticalCount = discrepancies.filter(
      (d) => d.severity === 'critical',
    ).length;
    const highCount = discrepancies.filter((d) => d.severity === 'high').length;

    if (criticalCount > 0) {
      return {
        matchStatus: 'mismatch',
        discrepancies,
        similarity: 0,
      };
    }

    const similarity = Math.max(
      0,
      1 - criticalCount * 0.5 - highCount * 0.2 - discrepancies.length * 0.05,
    );

    return {
      matchStatus: similarity > 0.9 ? 'match' : 'mismatch',
      discrepancies,
      similarity,
    };
  }

  /**
   * Find discrepancies between two objects
   */
  private findDiscrepancies<T>(
    direct: T,
    mcp: T,
    dataType: McpDataType,
    path = '',
  ): Array<{
    field: string;
    mcpValue: unknown;
    directValue: unknown;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const discrepancies: Array<{
      field: string;
      mcpValue: unknown;
      directValue: unknown;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }> = [];

    // Critical fields by data type
    const criticalFields: Record<McpDataType, string[]> = {
      compatibility: ['compatible', 'ktypnr', 'linkageId'],
      price: ['unitPriceTTC', 'totalTTC', 'consigneTTC'],
      stock: ['available', 'status'],
      reference: ['pieceRef', 'oemCodes'],
      vehicle: ['ktypnr', 'brand', 'model'],
      diagnostic: ['faultId', 'confidence'],
      safety: ['highest_gate', 'block_sales', 'can_continue_driving'],
      page_role: ['role'],
      content: [],
    };

    const highFields: Record<McpDataType, string[]> = {
      compatibility: ['method', 'confidence'],
      price: ['currency', 'unitPriceHT'],
      stock: ['reorderDate'],
      reference: ['brand', 'crossRefs'],
      vehicle: ['type', 'engineFamily'],
      diagnostic: ['score', 'matchedSymptoms'],
      safety: ['safety_message', 'triggered_observables'],
      page_role: ['canonical', 'indexable'],
      content: ['authorized'],
    };

    if (typeof direct !== typeof mcp) {
      return [
        {
          field: path || 'root',
          mcpValue: mcp,
          directValue: direct,
          severity: 'critical',
        },
      ];
    }

    if (typeof direct !== 'object' || direct === null || mcp === null) {
      if (direct !== mcp) {
        const fieldName = path.split('.').pop() || path;
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

        if (criticalFields[dataType]?.includes(fieldName)) {
          severity = 'critical';
        } else if (highFields[dataType]?.includes(fieldName)) {
          severity = 'high';
        }

        return [{ field: path, mcpValue: mcp, directValue: direct, severity }];
      }
      return [];
    }

    // Compare objects recursively
    const directObj = direct as Record<string, unknown>;
    const mcpObj = mcp as Record<string, unknown>;
    const allKeys = Array.from(
      new Set([...Object.keys(directObj), ...Object.keys(mcpObj)]),
    );

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      const directVal = directObj[key];
      const mcpVal = mcpObj[key];

      if (directVal === undefined && mcpVal !== undefined) {
        discrepancies.push({
          field: newPath,
          mcpValue: mcpVal,
          directValue: undefined,
          severity: criticalFields[dataType]?.includes(key) ? 'high' : 'low',
        });
      } else if (directVal !== undefined && mcpVal === undefined) {
        discrepancies.push({
          field: newPath,
          mcpValue: undefined,
          directValue: directVal,
          severity: 'low',
        });
      } else {
        discrepancies.push(
          ...this.findDiscrepancies(directVal, mcpVal, dataType, newPath),
        );
      }
    }

    return discrepancies;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CIRCUIT BREAKER
  // ═══════════════════════════════════════════════════════════════════════════

  private isCircuitOpen(endpoint: string): boolean {
    const status = this.circuitBreakers.get(endpoint);
    if (!status) return false;

    if (status.state === 'open') {
      // Check if recovery timeout has passed
      if (status.nextRetry && new Date() >= status.nextRetry) {
        status.state = 'half-open';
        status.successCount = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  private recordSuccess(endpoint: string): void {
    const status = this.circuitBreakers.get(endpoint);
    if (!status) return;

    if (status.state === 'half-open') {
      status.successCount++;
      if (status.successCount >= this.circuitBreakerConfig.halfOpenRequests) {
        status.state = 'closed';
        status.failureCount = 0;
        this.logger.log(`Circuit breaker CLOSED for ${endpoint}`);
      }
    } else if (status.state === 'closed') {
      status.failureCount = Math.max(0, status.failureCount - 1);
    }
  }

  private recordFailure(endpoint: string): void {
    let status = this.circuitBreakers.get(endpoint);
    if (!status) {
      status = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      };
      this.circuitBreakers.set(endpoint, status);
    }

    status.failureCount++;
    status.lastFailure = new Date();

    if (status.failureCount >= this.circuitBreakerConfig.failureThreshold) {
      status.state = 'open';
      status.nextRetry = new Date(
        Date.now() + this.circuitBreakerConfig.recoveryTimeout,
      );
      this.logger.warn(
        `Circuit breaker OPEN for ${endpoint}, retry at ${status.nextRetry.toISOString()}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  private createLogEntry(
    context: McpValidationContext,
    directResult: unknown,
    mcpResult: unknown,
    comparison: McpShadowComparison,
    metrics: {
      latencyMcp: number;
      latencyDirect: number;
      latencyTotal: number;
      error?: Error | null;
    },
  ): McpValidationLogEntry {
    return {
      request_id: context.requestId,
      endpoint: context.endpoint,
      http_method: context.httpMethod,
      data_type: context.dataType,
      validation_mode: context.mode,
      input_hash: this.hashObject({
        pieceId: context.pieceId,
        ktypnr: context.ktypnr,
        vehicleId: context.vehicleId,
      }),
      mcp_result_hash: mcpResult ? this.hashObject(mcpResult) : undefined,
      direct_result_hash: directResult
        ? this.hashObject(directResult)
        : undefined,
      match_status: comparison.matchStatus,
      confidence_score: comparison.similarity,
      latency_mcp_ms: metrics.latencyMcp,
      latency_direct_ms: metrics.latencyDirect,
      latency_total_ms: metrics.latencyTotal,
      user_id: context.userId,
      session_id: context.sessionId,
      ip_hash: context.ipHash,
      error_message: metrics.error?.message,
      created_at: new Date().toISOString(),
    };
  }

  private bufferLog(entry: McpValidationLogEntry): void {
    this.logBuffer.push(entry);

    if (this.logBuffer.length >= this.LOG_BUFFER_SIZE) {
      this.flushLogBuffer();
    }
  }

  private async flushLogBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // In Phase 1, just log to console
      // In production, this would insert into mcp_validation_log table
      this.logger.debug(
        `Flushing ${entries.length} MCP validation log entries`,
      );

      // TODO: Insert into Supabase when migration is applied
      // await this.supabase.from('mcp_validation_log').insert(entries);
    } catch (error) {
      this.logger.error(
        `Failed to flush MCP validation logs: ${error instanceof Error ? error.message : error}`,
      );
      // Re-add entries to buffer for retry
      this.logBuffer.unshift(...entries);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private hashObject(obj: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(obj, Object.keys(obj as object).sort()))
      .digest('hex')
      .substring(0, 16);
  }

  private createRefusalResult<T>(
    dataType: McpDataType,
    reason: string,
    _code: string,
  ): McpVerificationResult<T> {
    const messages = MCP_REFUSAL_MESSAGES[dataType];

    return {
      verified: false,
      status: 'rejected',
      refusal: {
        code: messages.code,
        reason,
        message_fr: messages.fr,
        message_en: messages.en,
        escalation: 'none',
      },
      source: 'mcp_refusal',
      verified_at: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC GETTERS
  // ═══════════════════════════════════════════════════════════════════════════

  getCircuitBreakerStatus(endpoint: string): CircuitBreakerStatus | undefined {
    return this.circuitBreakers.get(endpoint);
  }

  getAllCircuitBreakerStatuses(): Map<string, CircuitBreakerStatus> {
    return new Map(this.circuitBreakers);
  }

  getLogBufferSize(): number {
    return this.logBuffer.length;
  }
}
