import { expect, test } from '@playwright/test';

/**
 * Sentry lazy-loading contract (guards the Vite build's modulePreload filter).
 *
 * Invariant under test (see frontend/vite.config.ts `modulePreload.resolveDependencies`
 * + frontend/app/entry.client.tsx):
 *   1. `sentry-vendor-*.js` is an isolated chunk and is NOT in the initial
 *      `<link rel="modulepreload">` set, and is NOT fetched on first paint.
 *   2. The SDK loads only when the deferred background task runs
 *      (`scheduler.postTask({priority:'background'})`, with requestIdleCallback /
 *      setTimeout fallbacks) — there is NO click/scroll listener anymore.
 *   3. With a DSN present, the task triggers the lazy `import('@sentry/react-router')`
 *      → `sentry-vendor-*.js` is fetched.
 *
 * MUST run against a PRODUCTION build served via the real NestJS topology
 * (NODE_ENV=production), because modulePreload + chunking only exist in the prod
 * build, and the loaders depend on NestJS's getLoadContext. The dev middleware
 * does not exercise this contract.
 *
 *   npm run build            # backend + frontend (vite 7 prod build)
 *   NODE_ENV=production VITE_SENTRY_DSN=<test-dsn> node backend/dist/main.js   # :3000
 *   npm -w @fafa/frontend run test:sentry-lazy
 */

const SENTRY_VENDOR_RE = /sentry-vendor-[^/"']*\.js/;

test.describe('Sentry lazy-loading contract', () => {
  test('sentry-vendor is not preloaded nor fetched before the deferred task runs', async ({
    page,
  }) => {
    // Capture the background task instead of letting it run, so we control timing.
    // Mirrors entry.client.tsx: `scheduler.postTask(startInit, {priority:'background'})`.
    await page.addInitScript(() => {
      const captured: Array<() => void> = [];
      (window as unknown as { __capturedSentryTasks: Array<() => void> }).__capturedSentryTasks =
        captured;
      // Force the postTask branch and capture the callback (don't execute it).
      (globalThis as unknown as { scheduler: unknown }).scheduler = {
        postTask: (cb: () => void) => {
          captured.push(cb);
          return Promise.resolve();
        },
      };
      // Neutralise the fallbacks so they can't auto-fire the init during the assert window.
      (window as unknown as { requestIdleCallback: unknown }).requestIdleCallback = () => 0;
    });

    const sentryRequests: string[] = [];
    page.on('request', (req) => {
      if (SENTRY_VENDOR_RE.test(req.url())) sentryRequests.push(req.url());
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    // (1) No modulepreload link referencing sentry-vendor in the served HTML.
    const preloadedSentry = await page.$$eval(
      'link[rel="modulepreload"]',
      (links) => links.map((l) => (l as HTMLLinkElement).href).filter((h) => /sentry-vendor/.test(h)),
    );
    expect(preloadedSentry, 'sentry-vendor must not be in modulepreload').toEqual([]);

    // (2) Not fetched before the deferred task runs.
    expect(sentryRequests, 'sentry-vendor must not load on first paint').toEqual([]);

    // The page actually captured the deferred init task.
    const captured = await page.evaluate(
      () =>
        (window as unknown as { __capturedSentryTasks?: Array<() => void> }).__capturedSentryTasks
          ?.length ?? 0,
    );
    expect(captured, 'init must be scheduled via scheduler.postTask').toBeGreaterThan(0);

    // (3) Running the deferred task triggers the lazy chunk fetch (DSN is injected
    // server-side into window.ENV.VITE_SENTRY_DSN). If no DSN, the import is skipped
    // by design — assert accordingly.
    const dsn = await page.evaluate(
      () => (window as unknown as { ENV?: { VITE_SENTRY_DSN?: string } }).ENV?.VITE_SENTRY_DSN,
    );

    const sentryFetch = page
      .waitForRequest(SENTRY_VENDOR_RE, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    await page.evaluate(() => {
      const tasks =
        (window as unknown as { __capturedSentryTasks?: Array<() => void> }).__capturedSentryTasks ??
        [];
      tasks.forEach((t) => t());
    });

    const fetched = await sentryFetch;
    if (dsn) {
      expect(fetched, 'sentry-vendor must load after the deferred task when DSN present').toBe(true);
    } else {
      expect(fetched, 'no DSN → sentry-vendor must stay unloaded').toBe(false);
    }
  });
});
