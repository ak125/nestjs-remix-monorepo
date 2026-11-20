// @vitest-environment node
/** Lien de récupération de panier (e-mail de relance) : la route
 * `/panier/recover/:token` doit ramener sur la page du panier, qui est `/cart`.
 * Aucune route `/panier` n'existe : y rediriger rend une page 404 au client
 * qui vient de cliquer dans son e-mail. Valeurs fictives uniquement. */

import { type LoaderFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import routes from "~/routes";
import { loader } from "~/routes/panier.recover.$token";

const TOKEN = "a".repeat(64);

function callLoader(token: string | undefined) {
  return loader({
    params: { token },
    request: new Request(`http://localhost/panier/recover/${token ?? ""}`),
    context: {},
  } as unknown as LoaderFunctionArgs);
}

function backendAnswers(location: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(null, {
          status: location ? 302 : 200,
          headers: location ? { Location: location } : {},
        }),
    ),
  );
}

describe("panier.recover.$token — destination de la redirection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("la page du panier est servie sur /cart, aucune route /panier n'existe", async () => {
    const config = await routes;
    expect(config.find((route) => route.path === "cart")).toMatchObject({
      file: "routes/cart.tsx",
    });
    expect(config.find((route) => route.path === "panier")).toBeUndefined();
  });

  it("jeton mal formé : redirige vers /cart avec le motif", async () => {
    const res = await callLoader("trop-court");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/cart?error=invalid_token");
  });

  it("réponse du backend vers /panier : ramenée sur /cart, paramètres conservés", async () => {
    backendAnswers("/panier?recovered=1");
    const res = await callLoader(TOKEN);
    expect(res.headers.get("Location")).toBe("/cart?recovered=1");
  });

  it("motif d'erreur du backend : conservé sur /cart", async () => {
    backendAnswers("/panier?error=expired_token");
    const res = await callLoader(TOKEN);
    expect(res.headers.get("Location")).toBe("/cart?error=expired_token");
  });

  it("backend sans en-tête Location : /cart?recovered=1", async () => {
    backendAnswers(null);
    const res = await callLoader(TOKEN);
    expect(res.headers.get("Location")).toBe("/cart?recovered=1");
  });

  it("backend injoignable : /cart avec le motif", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const res = await callLoader(TOKEN);
    expect(res.headers.get("Location")).toBe("/cart?error=recovery_failed");
  });
});
