import { createRequire } from "node:module";
import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { handleError } from "~/entry.server";
import {
  createAppLoadContext,
  type AppLoadContextValues,
} from "~/utils/load-context";

/**
 * RR8 `v8_middleware` DEV dual-realm regression guard.
 *
 * The load-bearing fix lives in the CJS façade `frontend/index.cjs`:
 * `getCreateAppLoadContext` curries a node-realm provider factory into the SSR
 * build's `createAppLoadContext`, so RR8's `instanceof RouterContextProvider`
 * check (run by `@react-router/express`, node realm) passes even when the SSR
 * build is a SEPARATE react-router instance (Vite `ssrLoadModule` in DEV).
 *
 * Neither the identity test (factory `makeProvider` param) nor the backend
 * controller test (mocks `@fafa/frontend` wholesale) exercises that wrapper — so
 * a revert of `index.cjs` to `return build.entry.module.createAppLoadContext`
 * would reintroduce the DEV-on-every-page 500 with all other gates green. This
 * test requires the REAL façade (plain JS — no type resolution needed) and asserts
 * the wrapper supplies the provider factory. A pure unit run is single-realm, so
 * it cannot reproduce the cross-realm class divergence itself (that is covered by
 * the DEV `curl home/R1/R2 = 200` smoke); it locks the BEHAVIOUR that flips on
 * revert: the façade passes a `makeProvider`.
 */
const requireCjs = createRequire(import.meta.url);
const facade = requireCjs("../../index.cjs") as {
  getServerBuild: () => Promise<unknown>;
  getCreateAppLoadContext: () => Promise<
    (values: AppLoadContextValues) => RouterContextProvider
  >;
};

describe("dual-realm provider injection (RR8 v8_middleware DEV fix)", () => {
  it("getCreateAppLoadContext curries a provider factory into the build factory", async () => {
    // Spy records the 2nd arg (makeProvider) the façade passes, and delegates to
    // the REAL factory so a provider is actually built.
    const factorySpy = vi.fn(
      (values: AppLoadContextValues, makeProvider?: () => RouterContextProvider) =>
        createAppLoadContext(values, makeProvider),
    );
    const fakeBuild = { entry: { module: { createAppLoadContext: factorySpy } } };
    const original = facade.getServerBuild;
    facade.getServerBuild = async () => fakeBuild;
    try {
      const wrapped = await facade.getCreateAppLoadContext();
      const provider = wrapped({
        user: null,
        remixService: null,
        remixIntegration: null,
        cspNonce: "",
        serverObservability: null,
      });
      // LOAD-BEARING: the façade MUST supply a makeProvider. This flips to `false`
      // if index.cjs is reverted to `return build.entry.module.createAppLoadContext`
      // — i.e. it is the regression guard for the actual fix.
      expect(typeof factorySpy.mock.calls[0]?.[1]).toBe("function");
      expect(provider).toBeInstanceOf(RouterContextProvider);
    } finally {
      facade.getServerBuild = original;
    }
  });

  it("handleError tolerates an undefined context (RR early-error path) without throwing", () => {
    // RR's server runtime invokes handleError BEFORE assigning loadContext when it
    // rejects an invalid context value, so `context` is undefined there. The
    // optional chain in entry.server must keep handleError from crashing itself
    // (which masked the real error and produced an opaque 500 on every DEV page).
    expect(() =>
      handleError(new Error("boom"), {
        request: new Request("http://dual-realm.test/"),
        params: {},
        context: undefined,
      } as never),
    ).not.toThrow();
  });
});
