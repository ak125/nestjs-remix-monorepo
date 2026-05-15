/**
 * PR-C — OPA Policy Engine (NestJS-only, sync evaluation)
 *
 * Loads the WASM bundle (compiled via governance vault PR-V #279, SHA-256
 * reproducible) and evaluates Rego policies synchronously.
 *
 * Bundle modes (env `OPA_BUNDLE_MODE`) :
 *   - `prod_vault` (DEV preprod + PROD) : reads from `OPA_BUNDLE_PATH`.
 *   - `dev_fixture` (local dev) : reads backend/test/fixtures/opa-policies/seo-content/h1-write.wasm
 *   - `test_fixture` (CI) : same path as dev_fixture, deterministic.
 *   - `missing_fail_closed` (explicit default if unset) : refuses everything.
 *
 * Memory : feedback_check_secret_propagation_when_adding_fail_fast (env var
 *          must propagate to .env.example + compose + ci.yml + SOPS)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { loadPolicy } from '@open-policy-agent/opa-wasm';

export type OpaBundleMode =
  | 'prod_vault'
  | 'dev_fixture'
  | 'test_fixture'
  | 'missing_fail_closed';

export interface PolicyDecision {
  allow: boolean;
  reasons: string[];
  policyBundleSha: string;
  policyName: string;
}

const ALLOWED_MODES: readonly OpaBundleMode[] = [
  'prod_vault',
  'dev_fixture',
  'test_fixture',
  'missing_fail_closed',
] as const;

const DEV_FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../../test/fixtures/opa-policies/seo-content/h1-write.wasm',
);

const POLICY_NAME = 'seo.content.h1.write';

function failClosed(reason: string): PolicyDecision {
  return {
    allow: false,
    reasons: [reason],
    policyBundleSha: '<no-bundle>',
    policyName: POLICY_NAME,
  };
}

@Injectable()
export class OpaPolicyEngineService implements OnModuleInit {
  private readonly logger = new Logger(OpaPolicyEngineService.name);
  private policy: Awaited<ReturnType<typeof loadPolicy>> | null = null;
  private policyBundleSha = '<no-bundle>';
  private readonly mode: OpaBundleMode;

  constructor() {
    const raw = (process.env.OPA_BUNDLE_MODE ?? '').trim();
    if (!raw) {
      this.mode = 'missing_fail_closed';
    } else if ((ALLOWED_MODES as readonly string[]).includes(raw)) {
      this.mode = raw as OpaBundleMode;
    } else {
      this.logger.error(
        `Invalid OPA_BUNDLE_MODE=${JSON.stringify(raw)}; fallback missing_fail_closed.`,
      );
      this.mode = 'missing_fail_closed';
    }
  }

  onModuleInit(): void {
    this.logger.log(`🚀 OPA engine init — mode=${this.mode}`);
    void this.loadBundle();
  }

  private async loadBundle(): Promise<void> {
    if (this.mode === 'missing_fail_closed') {
      this.logger.warn(
        '[OPA_BUNDLE_MODE=missing_fail_closed] All evaluations deny. ' +
          'Set OPA_BUNDLE_MODE=prod_vault|dev_fixture|test_fixture.',
      );
      return;
    }
    const bundlePath = this.resolveBundlePath();
    if (!bundlePath) {
      this.logger.error(
        `[OPA] No bundle path for mode=${this.mode} — fail-closed.`,
      );
      return;
    }
    if (!fs.existsSync(bundlePath)) {
      this.logger.error(
        `[OPA] Bundle not found at ${bundlePath} — fail-closed. Check OPA_BUNDLE_PATH or vault mirror sync.`,
      );
      return;
    }
    try {
      const buffer = fs.readFileSync(bundlePath);
      const sha = createHash('sha256').update(buffer).digest('hex');
      const policy = await loadPolicy(buffer);
      this.policy = policy;
      this.policyBundleSha = sha;
      this.logger.log(
        `✓ OPA bundle loaded — path=${bundlePath} sha256=${sha.slice(0, 12)}…`,
      );
    } catch (err) {
      this.logger.error(
        `[OPA] Failed to load bundle: ${err instanceof Error ? err.message : String(err)}. Fail-closed.`,
      );
      this.policy = null;
    }
  }

  private resolveBundlePath(): string | null {
    switch (this.mode) {
      case 'prod_vault': {
        const fromEnv = process.env.OPA_BUNDLE_PATH;
        if (!fromEnv) {
          this.logger.error(
            '[OPA] prod_vault mode but OPA_BUNDLE_PATH unset — fail-closed.',
          );
          return null;
        }
        return fromEnv;
      }
      case 'dev_fixture':
      case 'test_fixture':
        return DEV_FIXTURE_PATH;
      case 'missing_fail_closed':
        return null;
    }
  }

  evaluateH1Write(input: Record<string, unknown>): PolicyDecision {
    if (!this.policy) {
      return failClosed(
        `OPA bundle not loaded (mode=${this.mode}); fail-closed.`,
      );
    }
    try {
      this.policy.setData({});
      // Bundle exposes two entrypoints (compiled via `opa build -t wasm -e .../allow -e .../deny`).
      // Pass `input` directly — opa-wasm wraps it internally as the policy `input`.
      // Returns `[{result: <typed value>}]` per call.
      const allowSet = this.policy.evaluate(
        input,
        'seo/content/h1/write/allow',
      );
      const denySet = this.policy.evaluate(input, 'seo/content/h1/write/deny');
      const allow = this.extractBool(allowSet);
      const reasons = this.extractStringArray(denySet);
      return {
        allow,
        reasons,
        policyBundleSha: this.policyBundleSha,
        policyName: POLICY_NAME,
      };
    } catch (err) {
      this.logger.error(
        `[OPA] Eval error: ${err instanceof Error ? err.message : String(err)}. Fail-closed.`,
      );
      return failClosed(
        `OPA eval error: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  private extractBool(resultSet: unknown): boolean {
    if (!Array.isArray(resultSet) || resultSet.length === 0) return false;
    const first = resultSet[0] as { result?: unknown };
    return first.result === true;
  }

  private extractStringArray(resultSet: unknown): string[] {
    if (!Array.isArray(resultSet) || resultSet.length === 0) return [];
    const first = resultSet[0] as { result?: unknown };
    if (Array.isArray(first.result)) {
      return first.result.filter((x): x is string => typeof x === 'string');
    }
    return [];
  }

  getMode(): OpaBundleMode {
    return this.mode;
  }
  getBundleSha(): string {
    return this.policyBundleSha;
  }
  isReady(): boolean {
    return this.policy !== null;
  }
}
