/**
 * Tests assertCompatibleProjectionContract — runtime contract check.
 */
import {
  ProjectionContractMismatchError,
  REFRESH_CONCURRENCY,
  REFRESH_DEBOUNCE_MS,
  RUNNER_PROJECTION_CONTRACT_VERSION,
  SEO_PROJECTION_REFRESH_QUEUE,
  SEO_PROJECTION_WRITE_QUEUE,
  assertCompatibleProjectionContract,
} from '../projection-contract.constants';

describe('assertCompatibleProjectionContract', () => {
  it('accepts identical version', () => {
    expect(() =>
      assertCompatibleProjectionContract(RUNNER_PROJECTION_CONTRACT_VERSION),
    ).not.toThrow();
  });

  it('accepts same MAJOR with different MINOR (forward-compat)', () => {
    expect(() =>
      assertCompatibleProjectionContract('1.5.3', '1.0.0'),
    ).not.toThrow();
    expect(() =>
      assertCompatibleProjectionContract('1.0.99', '1.0.0'),
    ).not.toThrow();
  });

  it('rejects MAJOR mismatch (anti-drift)', () => {
    expect(() => assertCompatibleProjectionContract('2.0.0', '1.0.0')).toThrow(
      ProjectionContractMismatchError,
    );
    expect(() => assertCompatibleProjectionContract('0.9.0', '1.0.0')).toThrow(
      ProjectionContractMismatchError,
    );
  });

  it('rejects malformed semver', () => {
    expect(() => assertCompatibleProjectionContract('abc')).toThrow(
      ProjectionContractMismatchError,
    );
    expect(() => assertCompatibleProjectionContract('1.0')).toThrow(
      ProjectionContractMismatchError,
    );
    expect(() => assertCompatibleProjectionContract('1.0.0-beta')).toThrow(
      ProjectionContractMismatchError,
    );
  });

  it('error contains both versions for debugging', () => {
    try {
      assertCompatibleProjectionContract('2.0.0', '1.0.0');
    } catch (err) {
      const e = err as ProjectionContractMismatchError;
      expect(e.jobVersion).toBe('2.0.0');
      expect(e.runnerVersion).toBe('1.0.0');
      expect(e.message).toContain('2.0.0');
      expect(e.message).toContain('1.0.0');
    }
  });
});

describe('queue constants — 2 queues découplées (ADR-059 §Découplage write↔refresh)', () => {
  it('write and refresh queues are distinct', () => {
    expect(SEO_PROJECTION_WRITE_QUEUE).not.toBe(SEO_PROJECTION_REFRESH_QUEUE);
  });

  it('refresh queue concurrency is 1 (single-flight)', () => {
    expect(REFRESH_CONCURRENCY).toBe(1);
  });

  it('refresh debounce is positive (coalescing window)', () => {
    expect(REFRESH_DEBOUNCE_MS).toBeGreaterThan(0);
  });
});
