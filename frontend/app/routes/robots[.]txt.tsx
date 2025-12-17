// app/routes/robots[.]txt.tsx
/**
 * 🤖 ROBOTS.TXT - Aligné avec structure PHP
 * 
 * Règles PHP originales:
 * - Disallow: /_form.get.car.* (formulaires AJAX)
 * - Disallow: /fiche/ (fiches produits - duplicate content)
 * - Disallow: /find/ (recherche générale)
 * - Disallow: /searchmine/ (recherche par type mine)
 * - Disallow: /account/ (espace client privé)
 * 
 * Optimisations v2:
 * - Timeout + retry automatique
 * - Cache long (24h browser, 48h CDN)
 * - Fallback complet si backend indisponible
 * 
 * @see backend/src/modules/seo/services/robots-txt.service.ts
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import {
  SITEMAP_CONFIG,
  fetchWithRetry,
  logSitemapError,
} from "~/lib/sitemap-fetch";

/**
 * Générer le robots.txt de fallback
 */
function generateFallbackRobots(): string {
  return `# ===========================================
# 🤖 ROBOTS.TXT - AutoMecanik.com (Fallback)
# ===========================================

User-agent: *
Allow: /

# ❌ Blocages hérités du système PHP
Disallow: /_form.get.car.*
Disallow: /fiche/
Disallow: /find/
Disallow: /searchmine/
Disallow: /account/

# ❌ Blocages additionnels
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/

# ⏱️ Crawl-delay
Crawl-delay: 1

# 📍 Sitemaps
Sitemap: ${SITEMAP_CONFIG.BASE_URL}/sitemap.xml
Sitemap: ${SITEMAP_CONFIG.BASE_URL}/sitemap-constructeurs.xml
Sitemap: ${SITEMAP_CONFIG.BASE_URL}/sitemap-types.xml
Sitemap: ${SITEMAP_CONFIG.BASE_URL}/sitemap-blog.xml`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  try {
    // ✅ Robots.txt depuis backend via API (évite boucle récursive /robots.txt)
    // IMPORTANT: On utilise /api/seo/robots.txt au lieu de /robots.txt
    // car /robots.txt serait intercepté par Remix lui-même (boucle infinie)
    const response = await fetchWithRetry(
      `${SITEMAP_CONFIG.BACKEND_URL}/api/seo/robots.txt`
    );

    const robotsTxt = await response.text();
    const duration = Date.now() - startTime;

    return new Response(robotsTxt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=172800, stale-while-revalidate=3600",
        "Vary": "Accept-Encoding",
        "X-Response-Time": `${duration}ms`,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError('Robots.txt', error, duration);

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
