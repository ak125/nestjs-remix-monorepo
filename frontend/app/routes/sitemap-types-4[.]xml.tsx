// app/routes/sitemap-types-4[.]xml.tsx
/**
 * 🏎️ SITEMAP TYPES/MOTORISATIONS - Partie 4 (30001-40000)
 * Système V2 avec filtres SEO critiques
 * Filtre CRITIQUE: type_display=1, type_relfollow=1
 * Format URL: /constructeurs/{marque}/{modele}/{type}.html
 * Priority: 0.7
 * 
 * Optimisations v2:
 * - Timeout 5s + retry avec backoff exponentiel
 * - Validation XML avant proxy
 * - Headers stale-while-revalidate
 * - Cache Redis TTL 6h
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import {
  SITEMAP_CONFIG,
  fetchWithRetry,
  isValidSitemapXml,
  getSitemapHeaders,
  generateEmptyFallbackSitemap,
  logSitemapError,
} from "~/lib/sitemap-fetch";

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  try {
    // ✅ V2 avec cache Redis (TTL 6h) + filtre type_relfollow=1
    const response = await fetchWithRetry(
      `${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/types-30001-40000`
    );
    
    const sitemap = await response.text();
    
    // Validation XML
    if (!isValidSitemapXml(sitemap)) {
      throw new Error('Invalid XML response from backend');
    }
    
    const duration = Date.now() - startTime;
    
    return new Response(sitemap, {
      headers: {
        ...getSitemapHeaders({ responseTime: duration }),
        "X-Shard": "types-30001-40000",
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError('Types 4 (30001-40000)', error, duration);
    
    return new Response(generateEmptyFallbackSitemap(), {
      headers: getSitemapHeaders({
        responseTime: duration,
        isError: true,
        errorMessage: 'Backend unavailable - empty sitemap',
      }),
    });
  }
}
