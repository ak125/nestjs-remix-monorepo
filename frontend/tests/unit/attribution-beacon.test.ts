/**
 * Tests unitaires — landing attribution capture/send
 * (frontend/app/utils/attribution-beacon.client.ts).
 *
 * Pins the first-touch correctness contract required by the PR A review:
 * the landing is CAPTURED synchronously at bootstrap, and the SNAPSHOT is
 * delivered later — so a Remix client navigation between capture and the idle
 * send can never overwrite the recorded landing (path / UTM / referrer).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureLandingAttribution,
  sendLandingAttribution,
} from "~/utils/attribution-beacon.client";

// Mock the beacon transport so we can assert the exact payload sent. `vi.hoisted`
// + `vi.mock` are hoisted above the imports at transform time by vitest, so the
// mock is applied before the module under test is loaded.
const { postJsonBeacon } = vi.hoisted(() => ({ postJsonBeacon: vi.fn() }));
vi.mock("~/utils/beacon", () => ({ postJsonBeacon }));

function setReferrer(value: string) {
  Object.defineProperty(document, "referrer", {
    value,
    configurable: true,
  });
}

describe("landing attribution — capture-before-idle (first-touch)", () => {
  beforeEach(() => {
    postJsonBeacon.mockClear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    setReferrer("");
  });

  it("sends the captured snapshot even after a client navigation (UTM preserved)", () => {
    // Landing = external organic with UTM + click-id.
    window.history.replaceState(
      {},
      "",
      "/pieces/plaquettes-de-frein?utm_source=news&utm_medium=cpc&gclid=abc123",
    );
    setReferrer("https://www.google.com/search?q=freins");

    // 1) capture at bootstrap (synchronous)
    const snapshot = captureLandingAttribution();

    // 2) user navigates (Remix client nav) to a 2nd page — UTM gone, referrer now internal
    window.history.pushState({}, "", "/panier");
    setReferrer("https://www.automecanik.com/pieces/plaquettes-de-frein");

    // 3) idle callback fires and delivers the SNAPSHOT (not the current location)
    sendLandingAttribution(snapshot);

    expect(postJsonBeacon).toHaveBeenCalledTimes(1);
    const [url, payload] = postJsonBeacon.mock.calls[0];
    expect(url).toBe("/api/attribution/landing");
    expect(payload).toEqual({
      path: "/pieces/plaquettes-de-frein",
      referer: "https://www.google.com/search?q=freins",
      query: { utm_source: "news", utm_medium: "cpc", gclid: "abc123" },
    });
  });

  it("forwards only allowlisted query keys (drops arbitrary params)", () => {
    window.history.replaceState(
      {},
      "",
      "/x?utm_source=a&fbclid=xyz&evil=1&msclkid=m1",
    );
    const snapshot = captureLandingAttribution();
    sendLandingAttribution(snapshot);
    const [, payload] = postJsonBeacon.mock.calls[0];
    expect(payload.query).toEqual({ utm_source: "a", msclkid: "m1" });
  });

  it("is once-per-session: a second capture after send returns null (no double beacon)", () => {
    window.history.replaceState({}, "", "/pieces/x?utm_source=a");
    sendLandingAttribution(captureLandingAttribution());
    expect(postJsonBeacon).toHaveBeenCalledTimes(1);

    const second = captureLandingAttribution();
    expect(second).toBeNull();
    sendLandingAttribution(second);
    expect(postJsonBeacon).toHaveBeenCalledTimes(1); // unchanged
  });

  it("omits query/referer when there is no landing signal", () => {
    window.history.replaceState({}, "", "/pieces/x");
    setReferrer("");
    sendLandingAttribution(captureLandingAttribution());
    const [, payload] = postJsonBeacon.mock.calls[0];
    expect(payload).toEqual({ path: "/pieces/x" });
  });
});
