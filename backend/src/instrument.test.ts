/**
 * Regression guard for the process-level error handlers registered as an
 * import side-effect in instrument.ts.
 *
 * The `unhandledRejection` handler is the structural fix for the PREPROD
 * ~5-min crash-loop: a background async rejection (e.g. an RLS-blocked write in
 * READ_ONLY PREPROD, or a transient RPC error) must NOT take down the whole
 * server via Node's default `--unhandled-rejections=throw`. This test pins that
 * contract: the handler stays registered, logs, and never calls `process.exit`.
 *
 * SENTRY_DSN is unset in the unit-test env, so `Sentry.init` is skipped on
 * import (no network), and `Sentry.captureException` inside the handler is a
 * safe no-op.
 */
describe('instrument.ts — process-level error handlers', () => {
  it('registers a non-fatal unhandledRejection handler (logs, never exits)', () => {
    const before = new Set(process.listeners('unhandledRejection'));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./instrument');
    });

    const added = process
      .listeners('unhandledRejection')
      .filter((h) => !before.has(h));
    expect(added.length).toBeGreaterThanOrEqual(1);

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const errSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const handler = added[added.length - 1] as (reason: unknown) => void;
    handler(new Error('simulated background rejection'));

    // The fix: a background rejection is logged but the process survives.
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
    exitSpy.mockRestore();

    // Avoid leaking the freshly-registered listener into other suites.
    process.removeListener(
      'unhandledRejection',
      handler as (reason: unknown, promise: Promise<unknown>) => void,
    );
  });
});
