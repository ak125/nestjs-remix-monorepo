/**
 * Chunk-load recovery — `vite:preloadError`.
 *
 * Vite's build output is content-hashed (`/assets/<name>-<hash>.js`). When a
 * deploy rewrites those hashes, a client still holding the *pre-deploy* HTML
 * requests route chunks at URLs that no longer exist at the origin → the dynamic
 * `import()` fails ("Importing a module script failed" / "Failed to fetch
 * dynamically imported module", seen especially on iOS Safari). Vite surfaces
 * this via a `vite:preloadError` window event. A single hard reload fetches the
 * fresh HTML + chunk graph and the navigation succeeds.
 *
 * Scope: RECOVERY only. Observability of the same class stays in
 * `runtime-errors.client.ts` (`captureChunkLoadErrors`, the SEO beacon). The two
 * are decoupled so a reload here never suppresses the beacon there.
 *
 * Anti-loop: a reload can itself land on stale HTML (e.g. a CDN still serving the
 * old document inside its `s-maxage` window). We must never reload in a tight
 * loop. A short-lived timestamp persisted via `safeSessionStorage` (which never
 * throws under the WebView / private-mode `SecurityError` we already guard
 * elsewhere) bounds reloads to at most one per `RELOAD_WINDOW_MS`; a genuinely
 * later deploy still recovers once the window elapses.
 */

import { safeSessionStorage } from "~/utils/safe-storage";

export const CHUNK_RELOAD_TS_KEY = "vite:preloadError:lastReloadAt";
export const RELOAD_WINDOW_MS = 10_000;

/**
 * Pure decision: should we hard-reload now, given the last reload timestamp?
 *
 * Reload only when we have not reloaded within the last `windowMs`. A missing
 * (`null`) or corrupt (non-finite) timestamp is treated as "never reloaded" so
 * the first failure always recovers. The boundary is strict (`>`), so two
 * failures exactly `windowMs` apart do NOT double-reload.
 */
export function shouldReloadOnPreloadError(
  now: number,
  lastReloadAt: number | null,
  windowMs: number = RELOAD_WINDOW_MS,
): boolean {
  if (lastReloadAt === null || !Number.isFinite(lastReloadAt)) return true;
  return now - lastReloadAt > windowMs;
}

/**
 * Install the `vite:preloadError` recovery guard. Call once from
 * `entry.client.tsx`. No-op under SSR (`window` undefined).
 */
export function installChunkReloadGuard(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event: Event) => {
    const now = Date.now();
    const raw = safeSessionStorage.getItem(CHUNK_RELOAD_TS_KEY);
    const lastReloadAt = raw === null ? null : Number(raw);

    if (!shouldReloadOnPreloadError(now, lastReloadAt)) {
      // Reloaded very recently → don't loop. Let the error propagate to the
      // existing observability path (runtime-errors.client.ts beacon).
      return;
    }

    // Handle it ourselves: stop Vite from throwing the unhandled preload error,
    // record the attempt, then fetch fresh HTML + chunk graph.
    event.preventDefault();
    safeSessionStorage.setItem(CHUNK_RELOAD_TS_KEY, String(now));
    window.location.reload();
  });
}
