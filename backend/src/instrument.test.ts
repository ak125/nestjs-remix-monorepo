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
import type { ErrorEvent, EventHint } from '@sentry/nestjs';
import { sanitizeSentryEvent } from './instrument';

describe('sanitizeSentryEvent — client-disconnect noise filter (beforeSend)', () => {
  const run = (originalException: unknown, event: Partial<ErrorEvent> = {}) =>
    sanitizeSentryEvent(
      event as ErrorEvent,
      { originalException } as EventHint,
    );

  it('drops a raw "read ECONNRESET" socket error (wget /health probe / client RST)', () => {
    // Node surfaces an inbound keep-alive socket reset as `Error: read
    // ECONNRESET` (code ECONNRESET, syscall read) from TCP.onStreamRead. The
    // Docker HEALTHCHECK `wget -qO- .../health` and real browsers/CDNs closing
    // keep-alive sockets produce this; it is not an application fault.
    const err = Object.assign(new Error('read ECONNRESET'), {
      code: 'ECONNRESET',
      syscall: 'read',
    });
    expect(run(err)).toBeNull();
  });

  it('drops EPIPE / ECONNABORTED socket write disconnects', () => {
    const epipe = Object.assign(new Error('write EPIPE'), {
      code: 'EPIPE',
      syscall: 'write',
    });
    const aborted = Object.assign(new Error('ECONNABORTED'), {
      code: 'ECONNABORTED',
      syscall: 'read',
    });
    expect(run(epipe)).toBeNull();
    expect(run(aborted)).toBeNull();
  });

  it('still drops the sibling raw-body "request aborted" noise (regression)', () => {
    const err = Object.assign(new Error('request aborted'), {
      type: 'request.aborted',
    });
    expect(run(err)).toBeNull();
  });

  it('does NOT drop a genuine application error (no over-filtering)', () => {
    const err = new Error("Cannot read properties of undefined (reading 'x')");
    const event = { request: { headers: {} } } as ErrorEvent;
    expect(run(err, event)).not.toBeNull();
  });

  it('does NOT drop an ECONNRESET that is not a bare socket read/write (has no syscall)', () => {
    // A domain-level error that merely mentions ECONNRESET in its message but is
    // not a bare TCP socket error must still surface (guards against blanket
    // suppression of real upstream failures, which the data layer already
    // retries — see supabase-base.service.ts).
    const err = Object.assign(new Error('Supabase RPC failed: ECONNRESET'), {
      // no `code`, no `syscall` → not a bare socket disconnect
    });
    expect(run(err)).not.toBeNull();
  });
});

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
