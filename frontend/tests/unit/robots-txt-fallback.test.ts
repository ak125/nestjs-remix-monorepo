/**
 * /robots.txt — le repli (backend indisponible) sert la MÊME politique que le
 * backend, depuis la source unique `@repo/seo-url-contract/robots-policy`.
 *
 * Défaut corrigé 2026-09-11 : le repli codait en dur une autre politique
 * (`Disallow: /account/` contraire à la décision noindex, aucun groupe
 * Googlebot, 4 sitemaps). Le repli doit rester un 200 observable (`X-Error`).
 */
import {
  buildRobotsTxt,
  isRobotsProductionEnv,
} from "@repo/seo-url-contract/robots-policy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loader } from "~/routes/robots[.]txt";

// vi.mock est remonté par vitest avant les imports : le loader importé
// ci-dessus reçoit bien le module simulé.
const fetchWithRetry = vi.fn();
const logSitemapError = vi.fn();

vi.mock("~/lib/sitemap-fetch", () => ({
  SITEMAP_CONFIG: {
    BACKEND_URL: "http://backend.test",
    BASE_URL: "https://www.automecanik.com",
  },
  fetchWithRetry: (...args: unknown[]) => fetchWithRetry(...args),
  logSitemapError: (...args: unknown[]) => logSitemapError(...args),
}));

const NOW = new Date("2026-09-11T08:00:00Z");

function callLoader() {
  return loader({
    request: new Request("https://www.automecanik.com/robots.txt"),
    params: {},
    context: {},
  } as never) as Promise<Response>;
}

describe("/robots.txt — repli", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    fetchWithRetry.mockReset();
    logSitemapError.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("production : backend KO → 200 avec le corps EXACT de la politique partagée, observable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fetchWithRetry.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await callLoader();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Error")).toBe(
      "Backend unavailable - fallback robots.txt",
    );
    expect(logSitemapError).toHaveBeenCalledTimes(1);
    expect(body).toBe(
      buildRobotsTxt({
        production: true,
        baseUrl: "https://www.automecanik.com",
        now: NOW,
      }),
    );
    // l'ancienne politique divergente ne réapparaît pas
    expect(body).not.toMatch(/^Disallow: \/account\//m);
    expect(body).toMatch(/^User-agent: Googlebot$/m);
    expect(body.match(/^Sitemap: .*$/gm)).toEqual([
      "Sitemap: https://www.automecanik.com/sitemap.xml",
    ]);
  });

  it("hors production : backend KO → repli qui bloque tout (même critère que le backend)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isRobotsProductionEnv(process.env.NODE_ENV)).toBe(false);
    fetchWithRetry.mockRejectedValue(new Error("timeout"));

    const body = await (await callLoader()).text();
    expect(body).toBe(
      buildRobotsTxt({
        production: false,
        baseUrl: "https://www.automecanik.com",
        now: NOW,
      }),
    );
    expect(body).toMatch(/^User-agent: \*\nDisallow: \/$/m);
  });

  it("backend OK → corps relayé tel quel, sans X-Error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fetchWithRetry.mockResolvedValue(
      new Response("User-agent: *\nAllow: /\n", { status: 200 }),
    );

    const res = await callLoader();
    expect(await res.text()).toBe("User-agent: *\nAllow: /\n");
    expect(res.headers.get("X-Error")).toBeNull();
    expect(fetchWithRetry).toHaveBeenCalledWith(
      "http://backend.test/api/seo/robots.txt",
    );
  });
});
