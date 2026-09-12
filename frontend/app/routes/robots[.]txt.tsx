// app/routes/robots[.]txt.tsx
/**
 * 🤖 ROBOTS.TXT
 *
 * Corps normal : relais de GET /api/seo/robots.txt (backend RobotsTxtService).
 * Repli (backend indisponible / timeout / non-2xx) : MÊME politique, construite
 * localement depuis la source unique `@repo/seo-url-contract/robots-policy`.
 * Avant 2026-09-11 le repli codait en dur une autre politique (Disallow:
 * /account/ contraire à la décision noindex, aucun blocage des bots, 4 sitemaps
 * dont 2 en 302). Le repli reste un 200 (un 5xx sur robots.txt suspend
 * l'exploration Google) et reste observable via `X-Error` + log.
 *
 * Optimisations v2:
 * - Timeout + retry automatique
 * - Cache long (24h browser, 48h CDN) ; repli 1h
 *
 * @see backend/src/modules/seo/infrastructure/robots-txt.service.ts
 */
import {
  buildRobotsTxt,
  isRobotsProductionEnv,
} from "@repo/seo-url-contract/robots-policy";
import { type LoaderFunctionArgs } from "react-router";
import {
  SITEMAP_CONFIG,
  fetchWithRetry,
  logSitemapError,
} from "~/lib/sitemap-fetch";

/**
 * Générer le robots.txt de repli — même source et même critère d'environnement
 * que le backend (même process, même NODE_ENV).
 */
function generateFallbackRobots(): string {
  return buildRobotsTxt({
    production: isRobotsProductionEnv(process.env.NODE_ENV),
    baseUrl: SITEMAP_CONFIG.BASE_URL,
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  try {
    // ✅ Robots.txt depuis backend via API (évite boucle récursive /robots.txt)
    // IMPORTANT: On utilise /api/seo/robots.txt au lieu de /robots.txt
    // car /robots.txt serait intercepté par Remix lui-même (boucle infinie)
    const response = await fetchWithRetry(
      `${SITEMAP_CONFIG.BACKEND_URL}/api/seo/robots.txt`,
    );

    const robotsTxt = await response.text();
    const duration = Date.now() - startTime;

    return new Response(robotsTxt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control":
          "public, max-age=86400, s-maxage=172800, stale-while-revalidate=3600",
        Vary: "Accept-Encoding",
        "X-Response-Time": `${duration}ms`,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError("Robots.txt", error, duration);

    return new Response(generateFallbackRobots(), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Error": "Backend unavailable - fallback robots.txt",
        "X-Response-Time": `${duration}ms`,
      },
    });
  }
}
