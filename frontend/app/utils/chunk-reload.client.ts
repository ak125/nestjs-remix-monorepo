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
 * Scope: RECOVERY + observability of this exact import site. The guard emits the
 * internal `seo.runtime.chunk_load_error` beacon itself, because NEITHER guard
 * path lets the failure reach `runtime-errors.client.ts` afterwards:
 * `preventDefault()` makes `__vitePreload` swallow the rejection (the `import()`
 * then FULFILS `undefined` — Vite contract, vitejs/vite#12084), and on the
 * anti-loop path React Router's `loadRouteModule` catch swallows it. Incident
 * 2026-07-10 (`TypeError: reading 'links'`, unhandled) is the downstream race
 * artifact of that fulfil-undefined: it fires between our `reload()` call and
 * the actual unload. `isChunkReloadRecoveryActive()` exposes that window so the
 * Sentry beforeSend can classify those artifacts instead of paging "first
 * error". See audit/sentry-prod-links-undefined-and-removechild-triage-2026-07-14.md.
 *
 * Anti-loop: a reload can itself land on stale HTML (e.g. a CDN still serving the
 * old document inside its `s-maxage` window). We must never reload in a tight
 * loop. A short-lived timestamp persisted via `safeSessionStorage` (which never
 * throws under the WebView / private-mode `SecurityError` we already guard
 * elsewhere) bounds reloads to at most one per `RELOAD_WINDOW_MS`; a genuinely
 * later deploy still recovers once the window elapses.
 */

import { reportChunkResolvedInvalid } from "~/utils/runtime-errors.client";
import { safeSessionStorage } from "~/utils/safe-storage";

export const CHUNK_RELOAD_TS_KEY = "vite:preloadError:lastReloadAt";
export const RELOAD_WINDOW_MS = 10_000;

/**
 * Instant où le guard a décidé un reload de recovery (état module — il ne
 * survit PAS au reload, contrairement au timestamp sessionStorage : sur la page
 * rechargée, la fenêtre est fermée). Lu par le beforeSend Sentry
 * (`entry.client.tsx`) pour classer les erreurs de course post-recovery via
 * `applyChunkErrorClassification`.
 */
let recoveryTriggeredAt: number | null = null;

/**
 * Fenêtre de recovery ACTIVE = un reload a été déclenché il y a moins de
 * `RELOAD_WINDOW_MS`. Borne temporelle délibérée : les artefacts de course
 * (fulfil-undefined → TypeError aval) tombent dans les millisecondes suivant
 * `reload()` ; si la navigation de reload n'aboutit jamais (Stop utilisateur,
 * offline, WebView en pause), la fenêtre se referme d'elle-même au lieu de
 * mislabeliser toute la fin de session.
 */
export function isChunkReloadRecoveryActive(now: number = Date.now()): boolean {
  return (
    recoveryTriggeredAt !== null &&
    now - recoveryTriggeredAt <= RELOAD_WINDOW_MS
  );
}

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

/** Message borné de l'erreur d'origine (`event.payload`, posé par Vite). */
function boundedErrorMessage(payload: unknown): string {
  const msg =
    payload instanceof Error ? payload.message : String(payload ?? "unknown");
  return msg.slice(0, 200);
}

/**
 * Install the `vite:preloadError` recovery guard. Call once from
 * `entry.client.tsx`. No-op under SSR (`window` undefined).
 *
 * @param reload injectable pour les tests ; défaut = hard reload navigateur.
 * @returns cleanup (retire le listener + réarme le marqueur) — ignoré en prod,
 *          utilisé pour l'isolation des tests.
 */
export function installChunkReloadGuard(
  reload: () => void = () => window.location.reload(),
): () => void {
  if (typeof window === "undefined") return () => {};

  const onPreloadError = (event: Event): void => {
    const now = Date.now();
    const raw = safeSessionStorage.getItem(CHUNK_RELOAD_TS_KEY);
    const lastReloadAt = raw === null ? null : Number(raw);
    const error_message = boundedErrorMessage(
      (event as Event & { payload?: unknown }).payload,
    );

    if (!shouldReloadOnPreloadError(now, lastReloadAt)) {
      // Reloaded very recently → don't loop. The rethrown error lands in React
      // Router's loadRouteModule catch (console.error + its own reload), so this
      // beacon is the ONLY observable trace of the failure on this path.
      // Burst discipline : Vite dispatche un vite:preloadError PAR dep rejetée
      // (CSS/preload) + un pour le module — une seule navigation cassée peut en
      // produire 2-3 dans la même boucle, tous APRÈS notre décision de reload
      // (le timestamp vient d'être écrit). Même échec physique → un seul beacon
      // par vie de page ; le marqueur meurt à l'unload, donc un vrai anti-loop
      // sur la page rechargée beacone normalement.
      if (!isChunkReloadRecoveryActive(now)) {
        reportChunkResolvedInvalid({
          stage: "rejected",
          source: "vite_preload_error_guard",
          recovery: "skipped_antiloop",
          error_message,
        });
      }
      return;
    }

    // Handle it ourselves: stop Vite from throwing the unhandled preload error,
    // beacon the failure (sendBeacon survives the unload), open the recovery
    // window for the Sentry classifier, record the attempt, then fetch fresh
    // HTML + chunk graph.
    recoveryTriggeredAt = now;
    // `stage: "rejected"` = le PRÉCHARGEMENT a physiquement rejeté (c'est ce que
    // porte `event.payload`) ; nuance : pour une dep CSS rejetée, le module JS
    // lui-même aurait pu charger — `error_message` ("Unable to preload CSS…")
    // conserve la vérité terrain pour la ventilation.
    reportChunkResolvedInvalid({
      stage: "rejected",
      source: "vite_preload_error_guard",
      recovery: "reload",
      error_message,
    });
    event.preventDefault();
    safeSessionStorage.setItem(CHUNK_RELOAD_TS_KEY, String(now));
    reload();
  };

  window.addEventListener("vite:preloadError", onPreloadError);
  return () => {
    window.removeEventListener("vite:preloadError", onPreloadError);
    recoveryTriggeredAt = null;
  };
}
