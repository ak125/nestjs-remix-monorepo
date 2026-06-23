import { createStaticHandler, RouterContextProvider } from "react-router";
import { describe, it, expect } from "vitest";
import {
  createAppLoadContext,
  userContext,
  cspNonceContext,
  remixServiceContext,
  remixIntegrationContext,
  serverObservabilityContext,
} from "~/utils/load-context";

/**
 * RR8 `v8_middleware` context-identity guard (A6).
 *
 * The CJS→ESM bridge (NestJS → SSR build) hands NestJS a FACTORY
 * (`createAppLoadContext`) rather than the identity-keyed `createContext()` keys,
 * precisely so the keys are never duplicated across realms (dual-realm hazard,
 * incident #1106). This test proves, at the unit level, that a value SET through
 * the factory is observable via the SAME key when read inside a REAL loader run
 * (`createStaticHandler().query`) — not a same-line set/get, which would prove
 * nothing about key identity. If the factory and the loader ever resolved two
 * distinct key instances, `context.get` would return the nullable DEFAULT and
 * the assertion would fail.
 */
describe("load-context identity (RR8 v8_middleware bridge)", () => {
  it("a value set by createAppLoadContext is read back via the SAME key inside a real loader run", async () => {
    const SENTINEL_USER = { id: "sentinel-123", email: "s@a.z" };
    const provider = createAppLoadContext({
      user: SENTINEL_USER,
      remixService: null,
      remixIntegration: null,
      cspNonce: "nonce-xyz",
      serverObservability: null,
    });

    const handler = createStaticHandler([
      {
        id: "root",
        path: "/",
        loader({ context }) {
          // Read exactly as app loaders do — via the typed keys imported from
          // the same module the factory uses.
          return {
            user: context.get(userContext),
            nonce: context.get(cspNonceContext),
          };
        },
      },
    ]);

    const result = await handler.query(new Request("http://identity.test/"), {
      requestContext: provider,
    });

    if (result instanceof Response) {
      throw new Error("expected StaticHandlerContext, got a Response");
    }

    // Same OBJECT identity (toBe), not merely structural — proves single-instance keys.
    expect(result.loaderData.root.user).toBe(SENTINEL_USER);
    expect(result.loaderData.root.nonce).toBe("nonce-xyz");
  });

  it("unset keys return their nullable default — context.get never throws", () => {
    const empty = new RouterContextProvider();
    expect(empty.get(userContext)).toBeNull();
    expect(empty.get(cspNonceContext)).toBe("");
    expect(empty.get(remixServiceContext)).toBeNull();
    expect(empty.get(remixIntegrationContext)).toBeNull();
    expect(empty.get(serverObservabilityContext)).toBeNull();
  });
});
