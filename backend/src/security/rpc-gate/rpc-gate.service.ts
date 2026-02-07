/**
 * RPC Safety Gate - Service
 *
 * Application-level firewall for Supabase RPC calls.
 * Evaluates calls against allowlist/denylist and enforces
 * access policies based on mode and level configuration.
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  RpcGateMode,
  RpcEnforceLevel,
  RpcDecision,
  RpcGateContext,
  RpcLogEntry,
  RpcAllowlist,
  RpcDenylist,
  RpcGateMetrics,
} from './rpc-gate.types';

@Injectable()
export class RpcGateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RpcGateService.name);

  // Configuration
  private mode: RpcGateMode;
  private enforceLevel: RpcEnforceLevel;
  private env: string;
  private logAllow: boolean;
  private adminToken: string | null;

  // Governance sets
  private allowlist = new Set<string>();
  private denylistP0 = new Set<string>();
  private denylistP1 = new Set<string>();
  private denylistP2 = new Set<string>();

  // Metrics
  private callCounts = new Map<string, number>();
  private blockCounts = new Map<string, number>();
  private sampleCounter = 0;
  private readonly SAMPLE_RATE = 100; // Log 1/100 ALLOW calls
  private readonly MAX_TRACKED_FUNCTIONS = 500;
  private metricsResetInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.mode = (this.configService.get<string>('RPC_GATE_MODE') ||
      'observe') as RpcGateMode;
    this.enforceLevel = (this.configService.get<string>(
      'RPC_GATE_ENFORCE_LEVEL',
    ) || 'P0') as RpcEnforceLevel;
    this.env = this.configService.get<string>('NODE_ENV') || 'development';
    this.logAllow =
      this.configService.get<string>('RPC_GATE_LOG_ALLOW') === 'true';
    this.adminToken = this.configService.get<string>('RPC_ADMIN_TOKEN') || null;
  }

  async onModuleInit() {
    await this.loadGovernanceFiles();
    this.logger.log(
      `RPC Gate initialized: mode=${this.mode}, level=${this.enforceLevel}, env=${this.env}`,
    );
    this.logger.log(
      `Loaded: ${this.allowlist.size} allowlist, ${this.denylistP0.size} P0, ${this.denylistP1.size} P1, ${this.denylistP2.size} P2`,
    );
    // Reset metrics every 24 hours to prevent counter overflow
    this.metricsResetInterval = setInterval(
      () => {
        this.resetMetrics();
      },
      24 * 60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.metricsResetInterval) {
      clearInterval(this.metricsResetInterval);
      this.metricsResetInterval = null;
    }
    this.callCounts.clear();
    this.blockCounts.clear();
    this.logger.log('RpcGateService destroyed, metrics cleared');
  }

  private resetMetrics(): void {
    this.callCounts.clear();
    this.blockCounts.clear();
    this.sampleCounter = 0;
    this.logger.log('RPC Gate metrics reset (periodic cleanup)');
  }

  /**
   * Load governance JSON files from configured directory
   */
  private async loadGovernanceFiles() {
    // Use process.cwd() to avoid __dirname issues in compiled output
    const govDir =
      this.configService.get<string>('RPC_GATE_GOV_DIR') ??
      path.resolve(process.cwd(), 'governance', 'rpc');

    try {
      // Load allowlist
      const allowlistPath = path.join(govDir, 'rpc_allowlist.json');
      if (fs.existsSync(allowlistPath)) {
        const data: RpcAllowlist = JSON.parse(
          fs.readFileSync(allowlistPath, 'utf-8'),
        );
        data.functions.forEach((f) => this.allowlist.add(f.name));
        this.logger.debug(`Loaded allowlist from ${allowlistPath}`);
      } else {
        this.logger.warn(`Allowlist not found: ${allowlistPath}`);
      }

      // Load denylist
      const denylistPath = path.join(govDir, 'rpc_denylist.json');
      if (fs.existsSync(denylistPath)) {
        const data: RpcDenylist = JSON.parse(
          fs.readFileSync(denylistPath, 'utf-8'),
        );
        this.loadDenylistCategory(data.categories.P0_CRITICAL, this.denylistP0);
        this.loadDenylistCategory(data.categories.P1_HIGH, this.denylistP1);
        this.loadDenylistCategory(data.categories.P2_MEDIUM, this.denylistP2);
        this.logger.debug(`Loaded denylist from ${denylistPath}`);
      } else {
        this.logger.warn(`Denylist not found: ${denylistPath}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to load governance files: ${(error as Error).message}`,
      );
      // FAIL-SAFE: switch to observe mode
      this.mode = 'observe';
      this.logger.warn('Fail-safe activated: mode switched to observe');
    }
  }

  /**
   * Load a denylist category into a Set
   */
  private loadDenylistCategory(
    category: { functions: (string | { name: string })[] },
    set: Set<string>,
  ) {
    category.functions.forEach((f) => {
      set.add(typeof f === 'string' ? f : f.name);
    });
  }

  /**
   * Evaluate an RPC call and return the decision
   */
  evaluate(
    rpcName: string,
    context: RpcGateContext = {},
  ): { decision: RpcDecision; reason: string } {
    // Guard against unbounded growth from arbitrary RPC names
    if (this.callCounts.size > this.MAX_TRACKED_FUNCTIONS) {
      this.resetMetrics();
    }
    // Track call count
    this.callCounts.set(rpcName, (this.callCounts.get(rpcName) || 0) + 1);

    // Mode disabled = allow all
    if (this.mode === 'disabled') {
      return { decision: 'ALLOW', reason: 'GATE_DISABLED' };
    }

    // Admin token override
    if (
      context.adminToken &&
      this.adminToken &&
      context.adminToken === this.adminToken
    ) {
      return { decision: 'ALLOW', reason: 'ADMIN_OVERRIDE' };
    }

    // Internal bypass ONLY if service_role (CORRECTION #2)
    const isServiceRole =
      context.role === 'service_role' || context.isServiceRole === true;
    if (
      (context.source === 'internal' || context.source === 'cron') &&
      isServiceRole
    ) {
      return { decision: 'ALLOW', reason: 'INTERNAL_SERVICE_ROLE' };
    }

    const shouldEnforce = this.mode === 'enforce';

    // P0 CRITICAL - Always block in enforce mode
    if (this.denylistP0.has(rpcName)) {
      this.blockCounts.set(rpcName, (this.blockCounts.get(rpcName) || 0) + 1);
      if (shouldEnforce) {
        return { decision: 'BLOCK', reason: 'DENYLIST_P0_CRITICAL' };
      }
      return { decision: 'OBSERVE', reason: 'DENYLIST_P0_CRITICAL' };
    }

    // P1 HIGH - Block if enforce level includes P1
    if (this.denylistP1.has(rpcName)) {
      if (shouldEnforce && ['P1', 'P2', 'ALL'].includes(this.enforceLevel)) {
        this.blockCounts.set(rpcName, (this.blockCounts.get(rpcName) || 0) + 1);
        return { decision: 'BLOCK', reason: 'DENYLIST_P1_HIGH' };
      }
      return { decision: 'OBSERVE', reason: 'DENYLIST_P1_HIGH' };
    }

    // P2 SECURITY_DEFINER - Block if enforce level includes P2
    if (this.denylistP2.has(rpcName)) {
      if (shouldEnforce && ['P2', 'ALL'].includes(this.enforceLevel)) {
        this.blockCounts.set(rpcName, (this.blockCounts.get(rpcName) || 0) + 1);
        return { decision: 'BLOCK', reason: 'DENYLIST_P2_SECURITY_DEFINER' };
      }
      return { decision: 'OBSERVE', reason: 'SECURITY_DEFINER' };
    }

    // Allowlist - explicitly allowed
    if (this.allowlist.has(rpcName)) {
      return { decision: 'ALLOW', reason: 'ALLOWLIST_READ_SAFE' };
    }

    // Unknown function handling (CORRECTION #4)
    // Service role can call unknown functions
    if (isServiceRole) {
      return { decision: 'ALLOW', reason: 'UNKNOWN_SERVICE_ROLE' };
    }

    // In production with enforce mode, block unknown from public roles
    if (this.env === 'production' && shouldEnforce) {
      this.blockCounts.set(rpcName, (this.blockCounts.get(rpcName) || 0) + 1);
      return { decision: 'BLOCK', reason: 'UNKNOWN_BLOCKED_PROD' };
    }

    // Dev: observe but allow unknown
    return { decision: 'OBSERVE', reason: 'UNKNOWN_FUNCTION' };
  }

  /**
   * Log RPC decision with sampling for ALLOW (CORRECTION #5)
   */
  log(
    rpcName: string,
    decision: RpcDecision,
    reason: string,
    context: RpcGateContext,
    durationMs: number,
    error?: Error,
  ) {
    const entry: RpcLogEntry = {
      timestamp: new Date().toISOString(),
      env: this.env,
      mode: this.mode,
      enforceLevel: this.enforceLevel,
      rpc: rpcName,
      decision,
      reason,
      role: context.role,
      userId: context.userId?.toString(),
      requestId: context.requestId,
      source: context.source,
      durationMs,
      error: error?.message,
    };

    switch (decision) {
      case 'BLOCK':
        this.logger.warn(entry, `RPC BLOCKED: ${rpcName}`);
        break;
      case 'OBSERVE':
        this.logger.log(entry, `RPC OBSERVE: ${rpcName}`);
        break;
      case 'ALLOW':
        // Sample ALLOW logs to reduce noise
        this.sampleCounter++;
        if (this.logAllow || this.sampleCounter % this.SAMPLE_RATE === 0) {
          this.logger.debug(entry, `RPC ALLOW: ${rpcName}`);
        }
        break;
    }

    if (error) {
      this.logger.error(
        { ...entry, stack: error.stack },
        `RPC ERROR: ${rpcName}`,
      );
    }
  }

  /**
   * Get current gate mode
   */
  getMode(): RpcGateMode {
    return this.mode;
  }

  /**
   * Get current enforce level
   */
  getEnforceLevel(): RpcEnforceLevel {
    return this.enforceLevel;
  }

  /**
   * Get metrics for monitoring/health endpoint
   */
  getMetrics(): RpcGateMetrics {
    return {
      mode: this.mode,
      enforceLevel: this.enforceLevel,
      env: this.env,
      allowlistSize: this.allowlist.size,
      denylistP0Size: this.denylistP0.size,
      denylistP1Size: this.denylistP1.size,
      denylistP2Size: this.denylistP2.size,
      totalCalls: [...this.callCounts.values()].reduce((a, b) => a + b, 0),
      totalBlocks: [...this.blockCounts.values()].reduce((a, b) => a + b, 0),
      topCallers: [...this.callCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      topBlocked: [...this.blockCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    };
  }

  /**
   * Reload governance files (for hot-reload without restart)
   */
  async reload() {
    this.allowlist.clear();
    this.denylistP0.clear();
    this.denylistP1.clear();
    this.denylistP2.clear();
    await this.loadGovernanceFiles();
    this.logger.log('Governance files reloaded');
  }

  /**
   * Check if a function is in the denylist (any level)
   */
  isDenied(rpcName: string): boolean {
    return (
      this.denylistP0.has(rpcName) ||
      this.denylistP1.has(rpcName) ||
      this.denylistP2.has(rpcName)
    );
  }

  /**
   * Check if a function is in the allowlist
   */
  isAllowed(rpcName: string): boolean {
    return this.allowlist.has(rpcName);
  }
}
