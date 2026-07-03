/**
 * Tests unitaires — `chunk-error-classification`
 * (`frontend/app/utils/chunk-error-classification.ts`).
 *
 * Contexte : deux alertes Sentry PROD (2026-07-01) — ERROR K
 * "Failed to fetch dynamically imported module: /assets/Footer-*.js" et ERROR M
 * "[safeLazy:ChatWidget] resolved without a default export" — toutes deux avec
 * `__cf_chl_f_tk` (challenge Cloudflare) dans l'URL. Cause racine environnementale
 * (interstitiel CF servi à la place des chunks JS), gérée gracieusement par
 * #1200/#1201. Ce module CLASSE ces erreurs (cf_challenge vs stale_or_network)
 * pour la règle d'alerte Sentry — sans jamais DROP un event (observabilité).
 *
 * Voir audit/sentry-cf-challenge-chunk-noise-design-2026-07-02.md.
 */

import { describe, expect, it } from "vitest";

import {
  CHUNK_LOAD_ERROR_MARKERS,
  SAFE_LAZY_ERROR_PREFIX,
  applyChunkErrorClassification,
  hasCfChallengeToken,
  isChunkLoadErrorMessage,
  isLazyOrChunkErrorMessage,
} from "~/utils/chunk-error-classification";

const CF_URL =
  "https://www.automecanik.com/pieces/rotule-de-suspension-2462/smart-151/roadster-coupe-151009/0-7-brabus-18007.html?__cf_chl_f_tk=Dzdq.a3H4fUrsEIwPr1tvr0RAOQahfDbI.S4SW2WMCA-1782934097-1.0.1.1-x";
const PLAIN_URL =
  "https://www.automecanik.com/pieces/rotule-de-suspension-2462/smart-151/roadster-coupe-151009/0-7-brabus-18007.html";

const ERROR_K =
  "Failed to fetch dynamically imported module: /assets/Footer-BcxWX-aI.js";
const ERROR_M = "[safeLazy:ChatWidget] resolved without a default export";

/** Minimal Sentry-event shape the classifier reads. */
function chunkEvent(message: string, url: string | undefined) {
  return {
    exception: { values: [{ type: "Error", value: message }] },
    request: url ? { url } : undefined,
    tags: {} as Record<string, string>,
  };
}

describe("isChunkLoadErrorMessage", () => {
  it("matches each bundler marker", () => {
    for (const m of CHUNK_LOAD_ERROR_MARKERS) {
      expect(isChunkLoadErrorMessage(`Uncaught: ${m} at foo`)).toBe(true);
    }
  });
  it("does NOT match an unrelated message", () => {
    expect(isChunkLoadErrorMessage("Cannot read properties of null")).toBe(
      false,
    );
    expect(isChunkLoadErrorMessage("")).toBe(false);
  });
});

describe("isLazyOrChunkErrorMessage", () => {
  it("matches the 3 bundler markers (ERROR K class)", () => {
    expect(isLazyOrChunkErrorMessage(ERROR_K)).toBe(true);
  });
  it("matches the safeLazy synthetic throw (ERROR M class)", () => {
    expect(isLazyOrChunkErrorMessage(ERROR_M)).toBe(true);
    expect(ERROR_M.startsWith(SAFE_LAZY_ERROR_PREFIX)).toBe(true);
  });
  it("matches the React reading-default-of-undefined signature", () => {
    expect(
      isLazyOrChunkErrorMessage(
        "TypeError: Cannot read properties of undefined (reading 'default')",
      ),
    ).toBe(true);
  });
  it("does NOT match unrelated errors", () => {
    expect(
      isLazyOrChunkErrorMessage("ResizeObserver loop limit exceeded"),
    ).toBe(false);
  });
});

describe("hasCfChallengeToken", () => {
  it("detects __cf_chl_f_tk", () => {
    expect(hasCfChallengeToken(CF_URL)).toBe(true);
  });
  it("detects other __cf_chl_ variants", () => {
    expect(hasCfChallengeToken("https://x/y?__cf_chl_rt_tk=abc")).toBe(true);
    expect(hasCfChallengeToken("https://x/y?__cf_chl_tk=abc")).toBe(true);
  });
  it("is false without a challenge token / for nullish input", () => {
    expect(hasCfChallengeToken(PLAIN_URL)).toBe(false);
    expect(hasCfChallengeToken(undefined)).toBe(false);
    expect(hasCfChallengeToken(null)).toBe(false);
  });
});

describe("applyChunkErrorClassification", () => {
  it("tags ERROR K under a CF challenge as cf_challenge and NEVER drops the event", () => {
    const ev = chunkEvent(ERROR_K, CF_URL);
    const out = applyChunkErrorClassification(ev);
    expect(out).toBe(ev); // same event, not dropped (no null)
    expect(out.tags.chunk_error_class).toBe("cf_challenge");
    expect(Array.isArray((out as { fingerprint?: unknown }).fingerprint)).toBe(
      true,
    );
  });

  it("tags ERROR M under a CF challenge as cf_challenge", () => {
    const out = applyChunkErrorClassification(chunkEvent(ERROR_M, CF_URL));
    expect(out.tags.chunk_error_class).toBe("cf_challenge");
  });

  it("tags a chunk error WITHOUT a CF token as stale_or_network (actionable)", () => {
    const out = applyChunkErrorClassification(chunkEvent(ERROR_K, PLAIN_URL));
    expect(out.tags.chunk_error_class).toBe("stale_or_network");
  });

  it("leaves a non-chunk error untouched (no tag, no fingerprint)", () => {
    const ev = chunkEvent(
      "Cannot read properties of null (reading 'x')",
      CF_URL,
    );
    const out = applyChunkErrorClassification(ev);
    expect(out.tags.chunk_error_class).toBeUndefined();
    expect((out as { fingerprint?: unknown }).fingerprint).toBeUndefined();
  });

  it("reads the message from event.message when there is no exception value", () => {
    const ev = {
      message: ERROR_K,
      request: { url: CF_URL },
      tags: {} as Record<string, string>,
    };
    expect(applyChunkErrorClassification(ev).tags.chunk_error_class).toBe(
      "cf_challenge",
    );
  });

  it("never throws / never returns null on a malformed event", () => {
    // Defensive: classifier must tolerate junk (generic <E> accepts anything).
    expect(() => applyChunkErrorClassification(null)).not.toThrow();
    expect(applyChunkErrorClassification({})).toEqual({});
  });
});
