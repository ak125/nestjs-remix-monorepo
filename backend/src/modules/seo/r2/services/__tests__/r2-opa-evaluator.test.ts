/**
 * R2OpaEvaluatorService — source of the WASM bundle and fail-closed behaviour.
 *
 * Covers : the default bundle directory is `<repo>/policies/dist` (no path
 * outside this repository), the committed bundle is present there, and a
 * missing bundle keeps the service in deny-all mode.
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  DEFAULT_R2_OPA_BUNDLE_DIR,
  R2OpaEvaluatorService,
} from '../r2-opa-evaluator.service';

const REPO_ROOT = resolve(__dirname, '../../../../../../..');

describe('R2OpaEvaluatorService', () => {
  const previous = process.env.R2_OPA_BUNDLE_PATH;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.R2_OPA_BUNDLE_PATH;
    } else {
      process.env.R2_OPA_BUNDLE_PATH = previous;
    }
  });

  it('reads its bundle from policies/dist of this repository by default', () => {
    expect(DEFAULT_R2_OPA_BUNDLE_DIR).toBe(join(REPO_ROOT, 'policies', 'dist'));
    expect(existsSync(join(REPO_ROOT, 'package.json'))).toBe(true);
    expect(
      existsSync(join(DEFAULT_R2_OPA_BUNDLE_DIR, 'r2-content-write.wasm')),
    ).toBe(true);
  });

  it('keeps the Rego source next to the committed bundle', () => {
    expect(
      existsSync(
        join(REPO_ROOT, 'policies', 'seo-content', 'r2-content-write.rego'),
      ),
    ).toBe(true);
  });

  it('denies every write when the bundle is missing (fail-closed)', () => {
    const empty = mkdtempSync(join(tmpdir(), 'r2-opa-empty-'));
    try {
      process.env.R2_OPA_BUNDLE_PATH = empty;
      const service = new R2OpaEvaluatorService();
      service.onModuleInit();

      expect(service.isReady()).toBe(false);
      const result = service.evaluateContentWrite({} as never);
      expect(result.allow).toBe(false);
      expect(result.denyReasons).toEqual([
        'fallback_deny_all_mode: OPA WASM bundle unavailable',
      ]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
