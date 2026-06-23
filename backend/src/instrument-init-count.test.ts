/**
 * Single-server-SDK init-count gate.
 *
 * `@sentry/nestjs` (instrument.ts) is the ONLY server SDK. It must call
 * `Sentry.init` EXACTLY once when `SENTRY_DSN` is set, and ZERO times when it is
 * absent. Together with the SSR-bundle proof (no `Sentry.init` in
 * entry.server.tsx) this locks the single-server-SDK invariant that the dual-realm
 * recursion incident (#1106 / getsentry/sentry-javascript#21696) depends on.
 *
 * Hermetic:
 *  - `@sentry/nestjs` mocked → we count `init` calls.
 *  - `dotenv/config` neutralized → instrument.ts's `import 'dotenv/config'` cannot
 *    repopulate SENTRY_DSN from a developer's local backend/.env (dotenv
 *    override:false), so the "0× without DSN" case is state-independent.
 *  - BOTH process listeners registered as an import side-effect
 *    (`unhandledRejection` + `uncaughtException`) are restored after each test.
 */

jest.mock('@sentry/nestjs', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('dotenv/config', () => ({}));

const PROCESS_EVENTS = ['unhandledRejection', 'uncaughtException'] as const;
type ProcEvent = (typeof PROCESS_EVENTS)[number];
type AnyListener = (...args: unknown[]) => void;

// `process.listeners`/`removeListener` overload-resolve per literal event; a union
// arg can't match a single overload (TS2769). Cast to one concrete literal — the
// runtime value of `ev` is correct; we only treat listeners as generic fns here.
const listenersOf = (ev: ProcEvent): AnyListener[] =>
  process.listeners(ev as 'uncaughtException') as AnyListener[];

describe('instrument.ts — single server SDK init count', () => {
  let originalDsn: string | undefined;
  let snapshots: Record<ProcEvent, Set<AnyListener>>;

  beforeEach(() => {
    originalDsn = process.env.SENTRY_DSN;
    snapshots = {
      unhandledRejection: new Set(listenersOf('unhandledRejection')),
      uncaughtException: new Set(listenersOf('uncaughtException')),
    };
  });

  afterEach(() => {
    // Remove any process listeners added by the import side-effect of instrument.ts
    // (both unhandledRejection AND uncaughtException) — never leak into other suites.
    for (const ev of PROCESS_EVENTS) {
      for (const h of listenersOf(ev)) {
        if (!snapshots[ev].has(h)) {
          process.removeListener(ev as 'uncaughtException', h);
        }
      }
    }
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
    jest.clearAllMocks();
  });

  it('initializes the unique server SDK exactly once when DSN is configured', () => {
    process.env.SENTRY_DSN = 'https://public@example.invalid/1';
    jest.isolateModules(() => {
      // Require the mock and the module in the SAME isolated registry so the
      // counted `init` is the instance instrument.ts actually called.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sentry = require('@sentry/nestjs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./instrument');
      expect(sentry.init).toHaveBeenCalledTimes(1);
    });
  });

  it('does not initialize Sentry when DSN is absent', () => {
    delete process.env.SENTRY_DSN;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sentry = require('@sentry/nestjs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./instrument');
      expect(sentry.init).not.toHaveBeenCalled();
    });
  });
});
