// app/routes/sitemap-gamme-produits[.]xml.tsx
/**
 * 🔧 SITEMAP GAMMES PRODUITS - Système V2 avec filtres SEO
 * Filtre: pg_display=1, pg_level IN [1,2], pg_relfollow=1 ou null
 * Format URL: /pieces/{pg_alias}-{pg_id}.html
 * Priority: 0.8
 * 
 * Optimisations v2:
 * - Timeout 5s + retry avec backoff
 * - Fetch parallèle niveau1 et niveau2
 * - Combinaison intelligente des URLs
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import {
  SITEMAP_CONFIG,
  fetchWithRetry,
  getSitemapHeaders,
  generateSingleUrlFallback,
  logSitemapError,
} from "~/lib/sitemap-fetch";

/**
 * Extraire les URLs d'un sitemap XML
 */
function extractUrls(xml: string): string[] {
  return xml.match(/<url>[\s\S]*?<\/url>/g) || [];
}

/**
 * Combiner plusieurs sitemaps en un seul
 */
function combineSitemaps(xmlContents: string[]): string {
  const allUrls = xmlContents.flatMap(extractUrls);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${allUrls.join('\n')}
</urlset>`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  try {
    // ✅ V2 avec cache Redis (TTL 4h) - fetch parallèle des deux niveaux
    const [resp1, resp2] = await Promise.all([
      fetchWithRetry(`${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-products-niveau1.xml`),
      fetchWithRetry(`${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-products-niveau2.xml`),
    ]);
    
    const [xml1, xml2] = await Promise.all([
      resp1.text(),
      resp2.text(),
    ]);
    
    const combinedSitemap = combineSitemaps([xml1, xml2]);
    const duration = Date.now() - startTime;
    
    return new Response(combinedSitemap, {
      headers: {
        ...getSitemapHeaders({ responseTime: duration }),
        "X-Url-Count": String(extractUrls(xml1).length + extractUrls(xml2).length),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError('Gammes Produits', error, duration);
    
    // Fallback avec page pièces générique
    const fallbackSitemap = generateSingleUrlFallback(`${SITEMAP_CONFIG.BASE_URL}/pieces`, 0.8);
    
    return new Response(fallbackSitemap, {
      headers: getSitemapHeaders({
        responseTime: duration,
        isError: true,
        errorMessage: 'Backend unavailable - fallback sitemap',
      }),
    });
  }
}
