import { describe, it, expect } from "vitest";

// Import the `.html` wrapper route — the one that actually serves real vehicle
// URLs (`/constructeurs/{brand}/{model}/{type}.html`). It is a thin re-export of
// the source route `constructeurs.$brand.$model.$type`.
//
// Régression #798 follow-up : la PR #798 a ajouté `export const headers =
// buildCacheHeaders(...)` sur la route SOURCE, mais le wrapper `.html`
// ré-exportait `loader/meta/default/...` SANS `headers`. Conséquence : Remix v2
// retombe sur `root.tsx headers()` et DROP le `X-Robots-Tag: noindex, follow`
// throw par `seoError()` sur les 404/410 des vraies URLs véhicules → la page
// d'erreur fuit en `index, follow`. Ce test couvre explicitement la route `.html`
// (pas seulement la route source) pour empêcher la récidive.
import * as htmlRoute from "~/routes/constructeurs.$brand.$model.$type[.]html";

type HeadersArgs = Parameters<NonNullable<typeof htmlRoute.headers>>[0];

describe("constructeurs .html wrapper — re-exports headers (noindex propagation)", () => {
  it("ré-exporte bien une fonction `headers` (régression : le wrapper l'omettait)", () => {
    expect(typeof htmlRoute.headers).toBe("function");
  });

  it("404/410 (loader throw) → X-Robots-Tag: noindex, follow + Cache-Control de seoError (pas le fallback root)", () => {
    // Simule un loader-throw : Remix passe les headers de la Response jetée via `errorHeaders`.
    const errorHeaders = new Headers({
      "X-Robots-Tag": "noindex, follow",
      "Cache-Control": "public, max-age=300", // seoError(404)
    });

    const result = htmlRoute.headers!({
      loaderHeaders: new Headers(),
      parentHeaders: new Headers(),
      errorHeaders,
      actionHeaders: new Headers(),
    } as HeadersArgs);

    const out = new Headers(result);
    expect(out.get("X-Robots-Tag")).toBe("noindex, follow");
    // La policy d'erreur prime sur le fallback root — preuve que le throw a bien atteint le doc.
    expect(out.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("200 (succès) → aucun noindex accidentel, garde la policy de succès `private, max-age=60`", () => {
    const result = htmlRoute.headers!({
      loaderHeaders: new Headers(),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
    } as HeadersArgs);

    const out = new Headers(result);
    expect(out.get("X-Robots-Tag")).toBeNull();
    expect(out.get("Cache-Control")).toBe("private, max-age=60");
  });
});
