/**
 * Funnel beacon — Commerce-Loop V1 étape 4-A.
 *
 * Émet les events du funnel outil diagnostic → commande vers
 * `POST /api/seo/funnel/event` (backend FunnelEventsController) via
 * `navigator.sendBeacon` (non-bloquant, survit à l'unload), fallback `fetch`
 * keepalive. Strictement additif, SSR-safe (no-op côté serveur), et ne lève
 * jamais (un beacon raté ne doit jamais casser l'UX).
 *
 * Le `session_id` (localStorage) stitche les marches du funnel pour un visiteur.
 */
import type { FunnelEventInput } from "@repo/seo-types";
import { safeLocalStorage } from "~/utils/safe-storage";

const ENDPOINT = "/api/seo/funnel/event";
const SID_KEY = "amk_funnel_sid";

/**
 * Génère un id de session aléatoire. Crypto uniquement (jamais `Math.random`,
 * cryptographiquement faible — CodeQL js/insecure-randomness, l'id sert de
 * contexte de session).
 */
function generateSessionId(): string {
  const c = typeof window !== "undefined" ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Crypto indisponible (très vieux navigateur) : horodatage seul, pas d'aléa faible.
  return `s_${Date.now()}`;
}

/** Identifiant de session funnel (persistant sur la visite). "" côté serveur. */
export function getFunnelSessionId(): string {
  if (typeof window === "undefined") return "";
  // safeLocalStorage : ne throw jamais (SecurityError WebView, mode privé…).
  let sid = safeLocalStorage.getItem(SID_KEY);
  if (!sid) {
    sid = generateSessionId();
    safeLocalStorage.setItem(SID_KEY, sid);
  }
  return sid;
}

export type FunnelDevice = "mobile" | "desktop" | "tablet" | "unknown";

/** Bucket device — le drop-off mobile est un suspect prioritaire (Reality Audit). */
export function getFunnelDevice(): FunnelDevice {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator?.userAgent ?? "";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "unknown";
}

/**
 * Envoie un event funnel. No-op côté serveur. `entity_url` par défaut =
 * URL courante. Ne lève jamais.
 */
export function emitFunnel(input: FunnelEventInput): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      ...input,
      entity_url: input.entity_url ?? window.location.href,
    });
    if (typeof window.navigator?.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      window.navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* never break UX */
  }
}
