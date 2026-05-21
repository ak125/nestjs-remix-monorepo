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

const ENDPOINT = "/api/seo/funnel/event";
const SID_KEY = "amk_funnel_sid";

/** Identifiant de session funnel (persistant sur la visite). "" côté serveur. */
export function getFunnelSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = window.localStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        window.crypto?.randomUUID?.() ??
        `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
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
