import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/$";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Régression — 5xx sur URL au %-encoding corrompu (caractère de remplacement
 * Unicode U+FFFD `�`, encodé `%EF%BF%BD`).
 *
 * Cause : `resolveKnownPattern` décode le pathname, strippe les accents
 * (`normalize("NFD").replace(/[̀-ͯ]/g,"")`) et renvoie la version
 * normalisée comme cible de redirect 301. Le `%EF%BF%BD` décode en U+FFFD
 * (UTF-8 valide → pas de throw au décodage) mais N'EST PAS un diacritique
 * combinant, donc il SURVIT à la normalisation. `redirect(target, 301)`
 * construit alors `new Response(null,{headers:{Location: "...�..."}})`
 * dont la valeur de header contient un octet > 0xFF → `TypeError`
 * (« Cannot convert argument to a ByteString ») / Node `ERR_INVALID_CHAR`.
 * L'appel est HORS du try/catch du loader → l'erreur remonte → 500.
 *
 * Empirique (2026-07-18, DEV:3000 = PROD, même DB) :
 *   /r%C3%A9f%EF%BF%BD%C3%A9rence-auto/bras-de-suspension500 → 500 (PROD live)
 *   Signalé comme « Erreur serveur (5xx) » par Google Search Console
 *   (validation ÉCHOUÉE 2026-07-11, exemple « Manual » en tête du rapport).
 *
 * Attendu après fix : input corrompu (U+FFFD) = garbage → 410 propre
 * (jamais de 5xx sur un lien mort — cf. « not-found = 404/410, pas 5xx »).
 */
describe("catch-all $.tsx — URL au %-encoding corrompu (U+FFFD) → 410, jamais 500", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ found: false }))),
      ),
    );
  });

  const call = (path: string) =>
    loader({
      request: new Request(`https://www.automecanik.com${path}`),
      params: {},
      context: {},
    } as never);

  // `isGarbageUrl` court-circuite via `throw data(...)` → DataWithResponseInit
  // (même forme que les 410 garbage existants, cf. catch-all-404-noindex.test).
  type ThrownData = { init?: { status?: number; headers?: HeadersInit } };

  it("URL corrompue (%EF%BF%BD) → 410 contrôlé (PAS un TypeError → 500)", async () => {
    let thrown: ThrownData | undefined;
    try {
      await call("/r%C3%A9f%EF%BF%BD%C3%A9rence-auto/bras-de-suspension500");
    } catch (e) {
      thrown = e as ThrownData;
    }
    // AVANT le fix : thrown = TypeError (« Cannot convert argument to a
    // ByteString ») → remonte → 500. APRÈS : 410 propre + noindex.
    expect(thrown?.init?.status).toBe(410);
    expect(new Headers(thrown?.init?.headers).get("X-Robots-Tag")).toBe(
      "noindex, follow",
    );
  });

  it("caractère de remplacement seul dans un segment → 410", async () => {
    let thrown: ThrownData | undefined;
    try {
      await call("/pi%C3%A8ces-%EF%BF%BD-auto");
    } catch (e) {
      thrown = e as ThrownData;
    }
    expect(thrown?.init?.status).toBe(410);
  });

  it("NON-régression : accent PROPRE (référence-auto) redirige toujours 301", async () => {
    const res = (await call(
      "/r%C3%A9f%C3%A9rence-auto/bras-de-suspension500",
    )) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(301);
    // accent-strip → cible ASCII propre, header Location valide
    expect(res.headers.get("Location")).toBe(
      "/reference-auto/bras-de-suspension500",
    );
  });
});
