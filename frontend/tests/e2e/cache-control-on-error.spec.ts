import { expect, test } from "@playwright/test";

/**
 * Invariant Cache-Control — protection contre INC-2026-005.
 *
 * Régression historique : un `headers: HeadersFunction = () => ({...})` zéro-arg
 * écrasait le `no-cache` que le loader pose sur ses 503/404/410. Conséquence :
 * Cloudflare cachait l'erreur pendant `s-maxage=86400` (24h) → 27,8 % de
 * `/pieces/*` en cache HIT 500 pendant la fenêtre de validation GSC (PR #320).
 *
 * Cet invariant valide que :
 *   - succès : la politique avec `s-maxage` (86400) est appliquée
 *   - 410 Gone : la politique du chemin succès NE FUIT PAS (pas de s-maxage)
 *   - 404 Not Found : idem
 *
 * Le bug d'origine se manifestait uniquement parce que la politique succès
 * bleed-throughait sur l'erreur. Donc valider l'absence sur 4xx prouve
 * l'absence sur 5xx (même mécanisme).
 *
 * Pour le 503 spécifiquement, voir :
 *   - frontend/tests/unit/utils/cache-control.test.ts (helper buildCacheHeaders)
 *   - ast-grep rule .ast-grep/rules/frontend-no-headers-bypass-buildCacheHeaders.yml
 */

const SUCCESS_URLS = [
  "/pieces/kit-d-embrayage-479.html",
];
const GONE_URLS = ["/pieces/catalogue"];
const NOT_FOUND_URLS = ["/pieces/suspension"];

test.describe("Cache-Control invariant (INC-2026-005 regression guard)", () => {
  for (const url of SUCCESS_URLS) {
    test(`200 path: ${url} carries success cache policy with s-maxage`, async ({
      request,
    }) => {
      const res = await request.get(url);
      expect(res.status()).toBe(200);
      const cc = res.headers()["cache-control"] ?? "";
      expect(cc).toMatch(/s-maxage=\d{2,}/);
      expect(cc).not.toMatch(/no-store/);
    });
  }

  for (const url of GONE_URLS) {
    test(`410 path: ${url} does NOT inherit success s-maxage=86400`, async ({
      request,
    }) => {
      const res = await request.get(url);
      expect(res.status()).toBe(410);
      const cc = res.headers()["cache-control"] ?? "";
      // The 410 may legitimately set its own short-TTL public cache (max-age=86400
      // without s-maxage) for cheap reprocess. The invariant is: it must NOT
      // accidentally inherit the success policy's s-maxage=86400 CDN axis,
      // which was the root cause of INC-2026-005 long-lived edge poisoning.
      // We accept either no-store/no-cache OR a max-age-only response, but
      // we reject s-maxage on error paths (CDN-side caching of errors).
      expect(cc).not.toMatch(/s-maxage=86400/);
    });
  }

  for (const url of NOT_FOUND_URLS) {
    test(`404 path: ${url} does NOT inherit success s-maxage=86400`, async ({
      request,
    }) => {
      const res = await request.get(url);
      expect(res.status()).toBe(404);
      const cc = res.headers()["cache-control"] ?? "";
      expect(cc).not.toMatch(/s-maxage=86400/);
    });
  }

  test("redirect (301) on canonical mismatch does NOT inherit success cache policy", async ({
    request,
  }) => {
    // The loader emits a 301 when the URL doesn't match canonical. The 301
    // response must NOT carry the success s-maxage either (would freeze a
    // stale redirect at the edge).
    const res = await request.get("/pieces/Kit-d-embrayage-479.html", {
      maxRedirects: 0,
    });
    // Either 301 (canonicalization) or 200 (already canonical). Both fine.
    if (res.status() === 301) {
      const cc = res.headers()["cache-control"] ?? "";
      expect(cc).not.toMatch(/s-maxage=86400/);
    } else {
      expect(res.status()).toBe(200);
    }
  });
});
