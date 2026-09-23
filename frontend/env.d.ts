/**
 * Environment variable types for the frontend application
 */

// ─── GA4 / GTM strict types ─────────────────────────────────
// Covers: gtag(), dataLayer, GTM bootstrap helpers

/** GA4 command types for gtag() */
type GtagCommand = "config" | "event" | "set" | "consent" | "js";

/** GA4 consent categories (Consent Mode v2 — RGPD) */
interface GtagConsentParams {
  analytics_storage?: "granted" | "denied";
  ad_storage?: "granted" | "denied";
  ad_user_data?: "granted" | "denied";
  ad_personalization?: "granted" | "denied";
  wait_for_update?: number;
}

/** A single dataLayer entry pushed to GTM */
interface DataLayerEntry {
  event?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    ENV?: {
      API_BASE_URL?: string;
      MEILISEARCH_URL?: string;
      NODE_ENV?: string;
      [key: string]: any;
    };

    // ─── GA4 / GTM ────────────────────────────────────────
    /** Google Analytics gtag function */
    gtag?: {
      (command: "js", date: Date): void;
      (command: "config", targetId: string, params?: Record<string, unknown>): void;
      (command: "event", eventName: string, params?: Record<string, unknown>): void;
      (command: "set", params: Record<string, unknown>): void;
      (command: "consent", action: "default" | "update", params: GtagConsentParams): void;
      (...args: unknown[]): void;
    };

    /** Mixpanel analytics (optional third-party) */
    mixpanel?: { track: (event: string, data?: Record<string, unknown>) => void };
    /** Plausible analytics (optional third-party) */
    plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;

    /** GTM dataLayer — array of event/config objects */
    dataLayer: DataLayerEntry[];

    /** Flag: GTM script already loaded (dedup guard) */
    __gtmLoaded?: boolean;
    /** Deferred GTM loader (called on first interaction or idle) */
    __loadGTM?: () => void;
    /** Grant analytics consent after user acceptance */
    __grantAnalyticsConsent?: () => void;
  }

  // Google Analytics gtag (global function used in inline scripts)
  function gtag(...args: unknown[]): void;
}

// Vite CSS URL imports
declare module "*.css?url" {
  const url: string;
  export default url;
}

export {};
