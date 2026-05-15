/**
 * ADR-066 — R2 OPA WASM Evaluator (Gate 4 — invariants enforcement)
 *
 * Loads pre-built WASM bundles `r2-content-write.wasm` and `r2-cluster-health.wasm`
 * (compiled from Rego policies in governance-vault, mergé via vault commit `8a92c49`,
 * available under `dist/policies/` if vault checked out alongside or fetched).
 *
 * For PR 1, the WASM file path is configurable via env var :
 *   R2_OPA_BUNDLE_PATH (default : /opt/automecanik/governance-vault/dist/policies)
 *
 * If WASM bundles are missing at module init :
 *   - Service starts in "fallback deny-all" mode (fail-closed, safest)
 *   - Logger warns at startup
 *   - PR 2 V1.5 will ship the bundle either by copying into monorepo `assets/`
 *     or via deploy-time pull from vault.
 *
 * Eval is SYNC <1ms once loaded (WASM in-process).
 *
 * Discipline canon (cf MEMORY feedback_opa_rego_invariants_only) :
 *   Rego enforce INVARIANTS only. Scoring/logique métier reste en TS testable.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface OpaWasmModule {
  // Minimal contract — we just need `evaluate(input) → { result }`.
  evaluate(input: unknown): unknown;
}

export interface R2WriteInput {
  source_kind:
    | 'human_curated'
    | 'human_validated_llm'
    | 'pipeline_generated'
    | string;
  actor?: string;
  pg_id?: number;
  type_id?: number;
  feature_flag_r2_v2_enabled?: boolean;
  flag_state?: 'enabled' | 'disabled';
  lock_active?: boolean;
  governance_decision?:
    | 'index'
    | 'suppressed'
    | 'review_required'
    | 'regenerate'
    | 'reject';
  canonical_target_type_id?: number | null;
  canonical_target?: { decision?: string; pg_id?: number };
  content_hash?: string | null;
  eligibility_score?: number;
  retry_count?: number;
  section_key?: string;
  section_content?: string;
}

export interface OpaEvalResult {
  allow: boolean;
  denyReasons: string[];
}

@Injectable()
export class R2OpaEvaluatorService implements OnModuleInit {
  private readonly logger = new Logger(R2OpaEvaluatorService.name);
  private contentWriteModule: OpaWasmModule | null = null;
  private fallbackDenyAll = true;

  /**
   * Non-blocking init. WASM load happens synchronously here (small bundles,
   * ~150KB) — no remote I/O, safe per backend.md "Non-blocking onModuleInit".
   */
  onModuleInit(): void {
    const bundlePath =
      process.env.R2_OPA_BUNDLE_PATH ??
      '/opt/automecanik/governance-vault/dist/policies';

    const wasmFile = join(bundlePath, 'r2-content-write.wasm');

    if (!existsSync(wasmFile)) {
      this.logger.warn(
        `R2 OPA WASM bundle missing at ${wasmFile} → fallback deny-all mode (fail-closed)`,
      );
      this.fallbackDenyAll = true;
      return;
    }

    try {
      // Lazy require to avoid hard dependency in tsconfig.
      // @ts-expect-error : optional dep, may not be installed in V1 foundation
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const opaWasm:
        | { loadPolicySync(bytes: Buffer): OpaWasmModule }
        | undefined =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@open-policy-agent/opa-wasm');

      if (!opaWasm?.loadPolicySync) {
        this.logger.warn(
          '@open-policy-agent/opa-wasm not installed → fallback deny-all mode. Add to backend/package.json in PR 2.',
        );
        this.fallbackDenyAll = true;
        return;
      }

      const bytes = readFileSync(wasmFile);
      this.contentWriteModule = opaWasm.loadPolicySync(bytes);
      this.fallbackDenyAll = false;
      this.logger.log(
        `R2 OPA WASM bundle loaded from ${wasmFile} (sync eval enabled)`,
      );
    } catch (err) {
      this.logger.error(`Failed to load R2 OPA WASM bundle: ${err}`);
      this.fallbackDenyAll = true;
    }
  }

  /**
   * Evaluate r2-content-write.rego policy.
   * Returns allow=false in fallback mode (fail-closed).
   */
  evaluateContentWrite(input: R2WriteInput): OpaEvalResult {
    if (this.fallbackDenyAll || !this.contentWriteModule) {
      return {
        allow: false,
        denyReasons: ['fallback_deny_all_mode: OPA WASM bundle unavailable'],
      };
    }

    try {
      const raw = this.contentWriteModule.evaluate(input);
      // OPA wasm returns [{ result: { allow: bool, deny: [reasons] } }]
      const arr = raw as Array<{
        result?: { allow?: boolean; deny?: string[] };
      }>;
      const result = arr?.[0]?.result;
      const allow = Boolean(result?.allow);
      const denyReasons = Array.isArray(result?.deny) ? result!.deny : [];
      return { allow, denyReasons };
    } catch (err) {
      this.logger.error(`OPA eval failed: ${err}`);
      return {
        allow: false,
        denyReasons: [
          `opa_eval_error: ${err instanceof Error ? err.message : String(err)}`,
        ],
      };
    }
  }

  isReady(): boolean {
    return !this.fallbackDenyAll && this.contentWriteModule !== null;
  }
}
