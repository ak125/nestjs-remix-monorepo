/**
 * chunk-error-classification — classe (sans jamais DROP) les erreurs de
 * chargement de chunk dynamique remontées à Sentry, pour rendre la règle
 * d'alerte chirurgicale.
 *
 * Contexte (incident 2026-07-01) : un Cloudflare Managed/JS challenge sert son
 * interstitiel `text/html` à la place des chunks `/assets/*.js` d'une session
 * challengée → l'`import()` rejette sur le MIME (« Failed to fetch dynamically
 * imported module ») ou résout un doc HTML sans `default` export (`safeLazy`
 * lève « [safeLazy:…] resolved without a default export »). Ces erreurs sont
 * gérées gracieusement (#1200/#1201 : LazyBoundary → `null`, route intacte) mais
 * remontent quand même à Sentry via le canal React `onCaughtError`, et pagent
 * comme « first error PROD ».
 *
 * Ce module NE SUPPRIME AUCUN event (canon « no silent fallback » : tout reste
 * observable). Il pose un `tag` + `fingerprint` stables distinguant :
 *   - `cf_challenge`     : erreur chunk ET token `__cf_chl_*` dans l'URL de
 *                          l'event → environnemental, non-actionnable, non-pageable.
 *   - `stale_or_network` : erreur chunk SANS token CF → actionnable (vraie
 *                          tempête de chunks périmés post-deploy).
 *
 * Pur & isomorphe (aucun accès `window`) → testable et sûr côté serveur.
 * Taxonomie de chaînes = source UNIQUE (importée aussi par
 * `runtime-errors.client.ts`, plus de duplication inline).
 *
 * Voir audit/sentry-cf-challenge-chunk-noise-design-2026-07-02.md.
 */

/**
 * Messages émis par les bundlers (Vite / Rollup / Webpack) quand un `import()`
 * dynamique échoue au fetch. Source unique — réutilisée par le beacon interne
 * `runtime-errors.client.ts` (`seo.runtime.chunk_load_error`).
 */
export const CHUNK_LOAD_ERROR_MARKERS = [
  "Loading chunk",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
] as const;

/** Préfixe du throw synthétique de `safeLazy` (`resilient-lazy.ts`). */
export const SAFE_LAZY_ERROR_PREFIX = "[safeLazy:";

/** Préfixe des query params de challenge Cloudflare (`__cf_chl_f_tk`, …). */
const CF_CHALLENGE_PARAM_PREFIX = "__cf_chl_";

/**
 * Classe d'erreur chunk posée en tag Sentry `chunk_error_class`.
 * `reload_recovery_race` (incident 2026-07-10) : erreur émise pendant la
 * fenêtre de recovery du guard `chunk-reload.client.ts` (preventDefault →
 * `__vitePreload` résout `undefined` → TypeError en aval, ex. React Router
 * prefetch `reading 'links'`) — artefact de course, l'utilisateur récupère
 * via le reload déjà déclenché.
 */
export type ChunkErrorClass =
  | "cf_challenge"
  | "stale_or_network"
  | "reload_recovery_race";

/** Vrai si le message correspond à un échec de fetch de chunk (3 markers bundler). */
export function isChunkLoadErrorMessage(msg: string): boolean {
  if (!msg) return false;
  return CHUNK_LOAD_ERROR_MARKERS.some((m) => msg.includes(m));
}

/**
 * Plus large que {@link isChunkLoadErrorMessage} : couvre aussi le throw
 * `safeLazy` et la signature React « reading 'default' … undefined » (miroir de
 * `LazyBoundary.isLazyInitError`). Utilisé pour la classification Sentry, où ces
 * trois formes apparaissent selon le mode d'échec du même `import()`.
 */
export function isLazyOrChunkErrorMessage(msg: string): boolean {
  if (!msg) return false;
  if (isChunkLoadErrorMessage(msg)) return true;
  if (msg.startsWith(SAFE_LAZY_ERROR_PREFIX)) return true;
  return msg.includes("reading 'default'") && msg.includes("undefined");
}

/** Vrai si l'URL porte un token de challenge Cloudflare (`__cf_chl_*`). */
export function hasCfChallengeToken(url: string | undefined | null): boolean {
  return typeof url === "string" && url.includes(CF_CHALLENGE_PARAM_PREFIX);
}

/** Shape minimal d'un event Sentry lu/écrit par le classifieur (defensive). */
interface SentryEventLike {
  message?: unknown;
  exception?: { values?: Array<{ value?: unknown } | null> } | unknown;
  request?: { url?: unknown } | unknown;
  tags?: Record<string, string> | unknown;
  fingerprint?: unknown;
}

/** Toutes les chaînes de message candidates d'un event (message + exceptions). */
function extractMessages(event: SentryEventLike): string[] {
  const out: string[] = [];
  if (typeof event.message === "string") out.push(event.message);
  const exception = event.exception as
    | { values?: Array<{ value?: unknown } | null> }
    | undefined;
  const values = exception?.values;
  if (Array.isArray(values)) {
    for (const v of values) {
      if (v && typeof v.value === "string") out.push(v.value);
    }
  }
  return out;
}

function extractUrl(event: SentryEventLike): string | undefined {
  const req = event.request as { url?: unknown } | undefined;
  return req && typeof req.url === "string" ? req.url : undefined;
}

/**
 * Contexte injecté par le beforeSend (le classifieur reste pur — aucun accès
 * `window` ici). `inRecoveryWindow` = `isChunkReloadRecoveryActive()` du guard
 * `chunk-reload.client.ts` au moment de la capture.
 */
export interface ChunkClassificationContext {
  inRecoveryWindow?: boolean;
}

const FINGERPRINT_SLUG: Record<ChunkErrorClass, string> = {
  cf_challenge: "cf-challenge",
  stale_or_network: "stale-or-network",
  reload_recovery_race: "reload-recovery-race",
};

/**
 * Étape `beforeSend` composable : si l'event est une erreur lazy/chunk — OU si
 * la fenêtre de recovery du guard chunk-reload est active (course
 * post-preventDefault, incident 2026-07-10) — pose `tags.chunk_error_class` +
 * un `fingerprint` stable (regroupe le bruit en une seule issue par classe).
 * La classe par message (plus spécifique) prime sur la fenêtre de recovery.
 * Trade-off assumé : un event NON-chunk capté pendant la fenêtre (quelques
 * secondes max, bornée par l'unload + TTL du guard) est volontairement regroupé
 * dans l'issue chunk-load au lieu de son grouping naturel — fidélité de
 * grouping sacrifiée contre l'arrêt du paging "first error" sur artefacts.
 * **Ne supprime jamais l'event, ne throw jamais** — retourne l'event (inchangé
 * si ce n'est pas une erreur chunk hors fenêtre, ou si l'input est malformé).
 * Compose après le PII-scrub :
 *   `beforeSend: (e) => applyChunkErrorClassification(sentryBeforeSend(e), ctx)`.
 */
export function applyChunkErrorClassification<E>(
  event: E,
  context?: ChunkClassificationContext,
): E {
  if (!event || typeof event !== "object") return event;
  const e = event as SentryEventLike;

  const isChunk = extractMessages(e).some(isLazyOrChunkErrorMessage);
  if (!isChunk && !context?.inRecoveryWindow) return event;

  const klass: ChunkErrorClass = isChunk
    ? hasCfChallengeToken(extractUrl(e))
      ? "cf_challenge"
      : "stale_or_network"
    : "reload_recovery_race";

  const tags =
    e.tags && typeof e.tags === "object"
      ? (e.tags as Record<string, string>)
      : ((e.tags = {} as Record<string, string>) as Record<string, string>);
  tags.chunk_error_class = klass;

  e.fingerprint = ["chunk-load", FINGERPRINT_SLUG[klass]];

  return event;
}
