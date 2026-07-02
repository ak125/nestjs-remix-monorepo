/**
 * runtime-errors.client — Bloc 5 / CWV Runtime Observability.
 *
 * Capture côté navigateur des évènements runtime qui ne sont PAS des Web
 * Vitals mais corrèlent avec l'expérience utilisateur :
 *   - hydration_error    : React 19 hydration mismatch (via onRecoverableError)
 *   - long_task          : PerformanceObserver longtask > 200ms (CPU stall)
 *   - navigation_abort   : useNavigation interrompue (user back ou error boundary)
 *   - chunk_load_error   : import() dynamique échoue (deploy gap, network drop)
 *
 * Discipline :
 *   - sample throttling : max 5 events / session / event_type (anti-flood)
 *   - sendBeacon fire-on-pagehide (non-bloquant)
 *   - honor navigator.doNotTrack
 *   - feature-detect PerformanceObserver longtask (Chromium-only)
 *   - reporter passif : try/catch wrap, ne propage jamais
 *
 * Initialisé depuis `entry.client.tsx` après `reportWebVitals()`.
 */

import {
  classifyRoute,
  priorityTierFromSurface,
  type DeviceType,
  type Surface,
} from "@repo/cwv-taxonomy";

import { isChunkLoadErrorMessage } from "~/utils/chunk-error-classification";
import { safeSessionStorage } from "~/utils/safe-storage";

const SESSION_ID_KEY = "_aut_cwv_sid";
const EVENT_QUOTA_KEY = "_aut_runtime_quota";
const MAX_PER_TYPE = 5;
const LONG_TASK_THRESHOLD_MS = 200;

type EventType =
  | "seo.runtime.hydration_error"
  | "seo.runtime.long_task"
  | "seo.runtime.navigation_abort"
  | "seo.runtime.chunk_load_error";

interface QuotaState {
  [eventType: string]: number;
}

function getSessionId(): string | null {
  // safeSessionStorage never throws (blocked storage → null, Sentry 181aeb23).
  return safeSessionStorage.getItem(SESSION_ID_KEY);
}

function getQuotaState(): QuotaState {
  try {
    const raw = safeSessionStorage.getItem(EVENT_QUOTA_KEY);
    return raw ? (JSON.parse(raw) as QuotaState) : {};
  } catch {
    // JSON.parse can still throw on corrupt data → best-effort empty quota.
    return {};
  }
}

function consumeQuota(eventType: EventType): boolean {
  const quota = getQuotaState();
  const current = quota[eventType] ?? 0;
  if (current >= MAX_PER_TYPE) return false;
  quota[eventType] = current + 1;
  // safeSessionStorage.setItem is a no-op (returns false) when storage is
  // disabled — quota stays best-effort without a throw.
  safeSessionStorage.setItem(EVENT_QUOTA_KEY, JSON.stringify(quota));
  return true;
}

function detectDevice(): DeviceType {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua) && !/mobile/.test(ua))
    return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

function dntOptedOut(): boolean {
  if (typeof navigator === "undefined") return false;
  const dnt = navigator.doNotTrack;
  return dnt === "1" || dnt === "yes";
}

function sendEvent(
  eventType: EventType,
  meta: Record<string, unknown>,
  message?: string,
): void {
  if (typeof window === "undefined") return;
  if (typeof navigator.sendBeacon !== "function") return;
  if (dntOptedOut()) return;
  if (!consumeQuota(eventType)) return;

  try {
    const pathname = window.location.pathname;
    const classification = classifyRoute(pathname);
    const surface = classification.surface as Surface;

    const payload = {
      event_type: eventType,
      surface,
      route_group: classification.route_group,
      // priority_tier sera ré-écrit côté serveur (canon anti-spoofing) ; on
      // l'envoie quand même pour cohérence client.
      priority_tier: priorityTierFromSurface(surface),
      device: detectDevice(),
      url: window.location.href.slice(0, 2000),
      session_id: getSessionId() ?? undefined,
      message: message?.slice(0, 500),
      meta,
    };

    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    navigator.sendBeacon("/api/seo/runtime-event", blob);
  } catch {
    // reporter passif — never throw
  }
}

// ---------------------------------------------------------------------------
// Captures
// ---------------------------------------------------------------------------

/**
 * Émet l'évènement interne `seo.runtime.hydration_error` avec un message
 * **normalisé** + métadonnées bornées. JAMAIS le diff React brut (server/client
 * mismatch peut contenir du texte rendu dynamiquement → fuite si persisté dans
 * `__seo_event_log`). La classification "hydration" se fait en amont via
 * `isHydrationRecoverableError` (cf. `react-error-handlers.client`), branchée
 * sur `onRecoverableError` de React 19 — plus de proxy `console.error`.
 */
export function reportHydrationError(meta: Record<string, unknown> = {}): void {
  sendEvent("seo.runtime.hydration_error", meta, "React hydration mismatch");
}

/**
 * Dérive `(reason, message)` de la balise depuis le `stage` de l'appelant.
 * Distingue le REJET réel (`stage: "rejected"` : stale chunk / réseau →
 * `reason: "load_rejected"`) de la classe fulfill-with-undefined
 * (`resolved_undefined` | `boundary` | défaut → `reason: "resolved_undefined"`).
 * Sans cette dérivation, un rejet réel serait mislabelisé `resolved_undefined`
 * (review PR #1200) → ventilation dashboard `meta.reason` faussée. Pur/testable.
 */
export function resolveChunkEventLabels(stage?: string): {
  reason: string;
  message: string;
} {
  if (stage === "rejected") {
    return {
      reason: "load_rejected",
      message: "Dynamic import rejected (chunk load failed)",
    };
  }
  return {
    reason: "resolved_undefined",
    message: "Dynamic import fulfilled with undefined",
  };
}

/**
 * Émet un évènement pour un `import()` dynamique en échec — soit résolu SANS
 * default utilisable (fulfill-with-undefined, artefact Rolldown mixed-chunk),
 * soit rejeté (stale chunk / réseau). Réutilise l'enum existant
 * `seo.runtime.chunk_load_error` + un discriminant `meta.reason` DÉRIVÉ du
 * `stage` (`meta` est free-form `z.record` côté contrat → aucune migration DB).
 * Appelé par `resilient-lazy.client.ts` ET `LazyBoundary` : chaque échec est
 * compté → pas de silent fallback même quand irrécupérable. Le `stage`
 * (`resolved_undefined` | `rejected` | `boundary`) reste dans `meta` pour la
 * ventilation fine.
 */
export function reportChunkResolvedInvalid(
  meta: Record<string, unknown> = {},
): void {
  const { reason, message } = resolveChunkEventLabels(
    typeof meta.stage === "string" ? meta.stage : undefined,
  );
  sendEvent("seo.runtime.chunk_load_error", { ...meta, reason }, message);
}

function captureLongTasks(): void {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= LONG_TASK_THRESHOLD_MS) {
          sendEvent(
            "seo.runtime.long_task",
            {
              duration_ms: Math.round(entry.duration),
              start_time_ms: Math.round(entry.startTime),
            },
            `Long task ${Math.round(entry.duration)}ms`,
          );
        }
      }
    });
    obs.observe({ type: "longtask", buffered: true });
  } catch {
    // longtask non supporté (Safari) — silent skip
  }
}

function captureChunkLoadErrors(): void {
  // window.onerror catch les import() dynamiques qui échouent. Filtre sur
  // message typé (varie par bundler — Vite, Rollup, Webpack).
  window.addEventListener("error", (event) => {
    const msg = event.message ?? "";
    if (isChunkLoadErrorMessage(msg)) {
      sendEvent(
        "seo.runtime.chunk_load_error",
        {
          filename: event.filename ?? "unknown",
          lineno: event.lineno ?? 0,
        },
        msg,
      );
    }
  });

  // unhandledrejection : import() dynamique rejette parfois en promise
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "";
    if (isChunkLoadErrorMessage(msg)) {
      sendEvent("seo.runtime.chunk_load_error", { source: "rejection" }, msg);
    }
  });
}

/**
 * Démarre le reporter runtime. À appeler une seule fois depuis `entry.client.tsx`
 * après `reportWebVitals()`. Idempotent (mais sample quota survit aux re-appels).
 */
export function startRuntimeErrorReporter(): void {
  if (typeof window === "undefined") return;

  try {
    // hydration_error n'est plus capturé via console.error : il est émis par
    // `reportHydrationError()` depuis `onRecoverableError` (React 19).
    captureLongTasks();
    captureChunkLoadErrors();
  } catch {
    // passif
  }
}

/**
 * Helper exporté pour tracer manuellement une navigation_abort depuis
 * `useNavigation()` (Remix) — appelé par un composant racine au unmount
 * d'une transition non-completed. (Non auto-attaché — décision pull plutôt
 * que push pour ce cas, owner-controlled.)
 */
export function reportNavigationAbort(targetUrl: string): void {
  sendEvent(
    "seo.runtime.navigation_abort",
    { target_url: targetUrl.slice(0, 500) },
    "Navigation aborted",
  );
}
