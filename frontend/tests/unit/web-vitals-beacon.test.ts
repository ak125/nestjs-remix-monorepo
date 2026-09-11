/**
 * Tests unitaires — beacon CWV interne (`frontend/app/utils/web-vitals.client.ts`).
 *
 * Contrat épinglé :
 *   - l'INP porte la décomposition LoAF, le script le plus long (source réduite
 *     à origine + chemin), l'horodatage du tap et le mark d'hydratation ;
 *   - toutes les métriques portent `metric.id`, la visibilité au report, le type
 *     de navigation brut (`back-forward-cache` compris) et l'URL de départ ;
 *   - chaque payload produit passe `CwvBeaconClientPayloadSchema` : une clé
 *     ajoutée côté client sans le schéma serveur (rejet du beacon entier) casse
 *     ce test au lieu de disparaître en production ;
 *   - ces clés à forte cardinalité restent hors des paramètres GA4.
 */

import { CwvBeaconClientPayloadSchema } from "@repo/cwv-taxonomy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as WebVitalsClient from "~/utils/web-vitals.client";

type MetricCallback = (metric: unknown) => void;

const webVitals = vi.hoisted(() => ({
  handlers: {} as Record<string, MetricCallback>,
}));

vi.mock("web-vitals/attribution", () => ({
  onLCP: (cb: MetricCallback) => {
    webVitals.handlers.LCP = cb;
  },
  onCLS: (cb: MetricCallback) => {
    webVitals.handlers.CLS = cb;
  },
  onINP: (cb: MetricCallback) => {
    webVitals.handlers.INP = cb;
  },
  onFCP: (cb: MetricCallback) => {
    webVitals.handlers.FCP = cb;
  },
  onTTFB: (cb: MetricCallback) => {
    webVitals.handlers.TTFB = cb;
  },
}));

type WebVitalsModule = typeof WebVitalsClient;

const START_PATH = "/pieces/plaquette-de-frein-402/renault-140/clio-iii-140004/1-5-dci-19065.html";

function inpMetric(attribution: Record<string, unknown> = {}) {
  return {
    name: "INP",
    value: 512,
    rating: "poor",
    delta: 512,
    id: "v5-1757590000000-1234567890123",
    entries: [],
    navigationType: "back-forward-cache",
    attribution: {
      interactionTarget: "div#card-42>img.photo",
      interactionTime: 184_250.4,
      interactionType: "pointer",
      nextPaintTime: 184_762,
      processedEventEntries: [],
      inputDelay: 18.2,
      processingDuration: 107.4,
      presentationDelay: 386.6,
      loadState: "complete",
      longAnimationFrameEntries: [{}],
      longestScript: {
        entry: {
          sourceURL: "https://www.automecanik.com/assets/app-core-Doz3nLV1.js?v=3#L10",
          invokerType: "event-listener",
          invoker: "IMG#card-42.onclick",
        },
        subpart: "processing-duration",
        intersectingDuration: 96.6,
      },
      totalScriptDuration: 101.2,
      totalStyleAndLayoutDuration: 96.4,
      totalPaintDuration: 18.5,
      // web-vitals calcule ce total par différence : il peut devenir négatif.
      totalUnattributedDuration: -3.2,
      ...attribution,
    },
  };
}

function lcpMetric() {
  return {
    name: "LCP",
    value: 2400,
    rating: "good",
    delta: 2400,
    id: "v5-1757590000001-2234567890123",
    entries: [],
    navigationType: "navigate",
    attribution: {
      target: "h1.hero",
      timeToFirstByte: 700.2,
      resourceLoadDelay: 0,
      resourceLoadDuration: 0,
      elementRenderDelay: 1699.8,
    },
  };
}

function fcpMetric() {
  return {
    name: "FCP",
    value: 1500,
    rating: "good",
    delta: 1500,
    id: "v5-1757590000002-3234567890123",
    entries: [],
    navigationType: "reload",
    attribution: {},
  };
}

describe("web-vitals beacon enrichment", () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  let mod: WebVitalsModule;

  async function lastBeaconPayload(): Promise<Record<string, unknown>> {
    expect(sendBeacon).toHaveBeenCalled();
    const [url, blob] = sendBeacon.mock.lastCall as [string, Blob];
    expect(url).toBe("/api/seo/cwv/beacon");
    return JSON.parse(await blob.text()) as Record<string, unknown>;
  }

  function attributionOf(payload: Record<string, unknown>): Record<string, unknown> {
    return payload.attribution as Record<string, unknown>;
  }

  beforeEach(async () => {
    vi.resetModules();
    for (const k of Object.keys(webVitals.handlers)) delete webVitals.handlers[k];
    sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeacon,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    vi.spyOn(console, "info").mockImplementation(() => {});
    performance.clearMarks();
    window.history.replaceState({}, "", `${START_PATH}?utm_source=google&gclid=abc#avis`);
    mod = await import("~/utils/web-vitals.client");
    mod.reportWebVitals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("sends the INP LoAF breakdown, longest script and interaction timing", async () => {
    performance.mark(mod.HYDRATION_COMMIT_MARK);
    const [hydrationMark] = performance.getEntriesByName(mod.HYDRATION_COMMIT_MARK, "mark");

    webVitals.handlers.INP(inpMetric());
    const payload = await lastBeaconPayload();

    expect(attributionOf(payload)).toEqual({
      attr_target: "div#dyn>img.photo",
      attr_interaction_type: "pointer",
      attr_load_state: "complete",
      attr_input_delay: 18,
      attr_processing_duration: 107,
      attr_presentation_delay: 387,
      attr_total_script_duration: 101,
      attr_total_style_layout_duration: 96,
      attr_total_paint_duration: 19,
      attr_total_unattributed_duration: 0,
      attr_longest_script_src: "https://www.automecanik.com/assets/app-core-Doz3nLV1.js",
      attr_longest_script_invoker_type: "event-listener",
      attr_longest_script_subpart: "processing-duration",
      attr_longest_script_intersecting_duration: 97,
      attr_interaction_time: 184_250,
      attr_hydrated_at: Math.round(hydrationMark.startTime),
      attr_metric_id: "v5-1757590000000-1234567890123",
      attr_visibility_state: "hidden",
      attr_navigation_type: "back-forward-cache",
      attr_start_url: `${window.location.origin}${START_PATH}`,
    });
    // La colonne `nav_type` garde son enum fermé : la valeur brute est dans l'attribution.
    expect(payload.nav_type).toBe("unknown");
    const parsed = CwvBeaconClientPayloadSchema.safeParse(payload);
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it("omits LoAF keys when the browser exposes no Long Animation Frame", async () => {
    webVitals.handlers.INP(
      inpMetric({
        longAnimationFrameEntries: [],
        longestScript: undefined,
        totalScriptDuration: undefined,
        totalStyleAndLayoutDuration: undefined,
        totalPaintDuration: undefined,
        totalUnattributedDuration: undefined,
      }),
    );
    const attribution = attributionOf(await lastBeaconPayload());

    for (const key of Object.keys(attribution)) {
      expect(key).not.toMatch(/^attr_(total|longest_script)_/);
    }
    expect(attribution.attr_interaction_time).toBe(184_250);
  });

  it("omits the hydration timestamp when the root never committed before the report", async () => {
    webVitals.handlers.INP(inpMetric());
    const attribution = attributionOf(await lastBeaconPayload());

    expect(attribution).not.toHaveProperty("attr_hydrated_at");
  });

  it("keeps the first hydration commit mark when marked twice", () => {
    mod.markHydrationCommit();
    mod.markHydrationCommit();

    expect(performance.getEntriesByName(mod.HYDRATION_COMMIT_MARK, "mark")).toHaveLength(1);
  });

  it("reduces a non-web script source to its scheme and drops an empty one", async () => {
    webVitals.handlers.INP(
      inpMetric({
        longestScript: {
          entry: { sourceURL: "chrome-extension://abcdefghijklmnop/content.js", invokerType: "user-callback" },
          subpart: "presentation-delay",
          intersectingDuration: 12,
        },
      }),
    );
    expect(attributionOf(await lastBeaconPayload()).attr_longest_script_src).toBe("chrome-extension:");

    webVitals.handlers.INP(
      inpMetric({
        longestScript: {
          entry: { sourceURL: "", invokerType: "event-listener" },
          subpart: "processing-duration",
          intersectingDuration: 12,
        },
      }),
    );
    expect(attributionOf(await lastBeaconPayload())).not.toHaveProperty("attr_longest_script_src");
  });

  it("keeps the URL captured when the metric started, not the URL at send time", async () => {
    window.history.pushState({}, "", "/panier");
    webVitals.handlers.LCP(lcpMetric());
    const payload = await lastBeaconPayload();

    expect(payload.url).toBe(`${window.location.origin}/panier`);
    expect(attributionOf(payload).attr_start_url).toBe(`${window.location.origin}${START_PATH}`);
  });

  it("re-captures the start URL when the page is restored from the back/forward cache", async () => {
    window.history.pushState({}, "", "/pieces/filtre-a-huile-7.html");
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    window.history.pushState({}, "", "/panier");
    webVitals.handlers.FCP(fcpMetric());

    expect(attributionOf(await lastBeaconPayload()).attr_start_url).toBe(
      `${window.location.origin}/pieces/filtre-a-huile-7.html`,
    );
  });

  it("updates the start URL before web-vitals reports TTFB synchronously on bfcache restore", async () => {
    // web-vitals `onBFCacheRestore` : écouteur `pageshow` en phase de capture,
    // enregistré après le lancement du reporter, qui reporte TTFB sans attendre.
    const onBFCacheRestore = (event: Event) => {
      if ((event as PageTransitionEvent).persisted) {
        webVitals.handlers.TTFB({ ...fcpMetric(), name: "TTFB", navigationType: "back-forward-cache" });
      }
    };
    window.addEventListener("pageshow", onBFCacheRestore, true);
    try {
      window.history.pushState({}, "", "/pieces/filtre-a-huile-7.html");
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));

      expect(attributionOf(await lastBeaconPayload()).attr_start_url).toBe(
        `${window.location.origin}/pieces/filtre-a-huile-7.html`,
      );
    } finally {
      window.removeEventListener("pageshow", onBFCacheRestore, true);
    }
  });

  it("gives every metric its report context and stays within the server contract", async () => {
    for (const metric of [lcpMetric(), fcpMetric()]) {
      webVitals.handlers[metric.name](metric);
      const payload = await lastBeaconPayload();
      const attribution = attributionOf(payload);

      expect(attribution).toMatchObject({
        attr_metric_id: metric.id,
        attr_visibility_state: "hidden",
        attr_navigation_type: metric.navigationType,
        attr_start_url: `${window.location.origin}${START_PATH}`,
      });
      expect(attribution).not.toHaveProperty("attr_interaction_time");
      const parsed = CwvBeaconClientPayloadSchema.safeParse(payload);
      expect(parsed.error?.issues ?? []).toEqual([]);
    }
  });

  it("still sends a valid beacon with an ephemeral session when storage is blocked", async () => {
    window.sessionStorage.setItem("_aut_cwv_prev_step", "view_listing");
    const descriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      webVitals.handlers.LCP(lcpMetric());
      const payload = await lastBeaconPayload();

      expect(typeof payload.session_id).toBe("string");
      expect((payload.session_id as string).length).toBeGreaterThanOrEqual(8);
      expect(payload.previous_funnel_step).toBeNull();
      const parsed = CwvBeaconClientPayloadSchema.safeParse(payload);
      expect(parsed.error?.issues ?? []).toEqual([]);
    } finally {
      if (descriptor) Object.defineProperty(window, "sessionStorage", descriptor);
    }
  });

  it("keeps the beacon-only keys out of the GA4 event", () => {
    const gtag = vi.fn();
    Object.defineProperty(window, "gtag", { value: gtag, configurable: true, writable: true });
    try {
      webVitals.handlers.INP(inpMetric());
      const params = gtag.mock.lastCall?.[2] as Record<string, unknown>;

      expect(params).toHaveProperty("attr_presentation_delay");
      expect(params).not.toHaveProperty("attr_start_url");
      expect(params).not.toHaveProperty("attr_longest_script_src");
      expect(params).not.toHaveProperty("attr_interaction_time");
    } finally {
      Reflect.deleteProperty(window, "gtag");
    }
  });
});
