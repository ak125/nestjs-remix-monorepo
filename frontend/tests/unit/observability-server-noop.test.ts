import { describe, it, expect, vi } from "vitest";
import { reportLoaderError } from "~/utils/observability.server";

/**
 * No-op robustness for the SSR observability bridge.
 *
 * The reporter is injected from `AppLoadContext.serverObservability` (the NestJS
 * pont). In standalone mode (SSR not embedded in NestJS) it is `undefined` — a
 * DELIBERATE no-op (STANDALONE_FRONTEND_SERVER_OBSERVABILITY = NOT_SUPPORTED).
 * Observability must NEVER break the render: missing reporter, or a reporter
 * that throws, must both be swallowed.
 */
describe("reportLoaderError — bridge no-op robustness", () => {
  it("never throws when the reporter is absent (standalone SSR)", () => {
    expect(() =>
      reportLoaderError(undefined, "cart_load_failed", new Error("boom"), {
        method: "GET",
        pathname: "/panier",
      }),
    ).not.toThrow();
  });

  it("forwards to the injected reporter with the loader-caught mechanism + event tag", () => {
    const captureException = vi.fn();
    reportLoaderError({ captureException }, "cart_load_failed", new Error("x"), {
      method: "GET",
      pathname: "/panier",
    });
    expect(captureException).toHaveBeenCalledTimes(1);
    const [err, ctx] = captureException.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(ctx).toEqual(
      expect.objectContaining({
        mechanism: { type: "react-router-loader-caught", handled: true },
        tags: { observability_event: "cart_load_failed" },
      }),
    );
  });

  it("never throws when the injected reporter itself throws", () => {
    const captureException = vi.fn(() => {
      throw new Error("reporter down");
    });
    expect(() =>
      reportLoaderError({ captureException }, "checkout_cart_load_failed", "y"),
    ).not.toThrow();
  });
});
