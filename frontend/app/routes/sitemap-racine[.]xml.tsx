// app/routes/sitemap-racine[.]xml.tsx
/**
 * 🏠 SITEMAP RACINE - Homepage uniquement
 * Aligné avec PHP: https-sitemap-racine.xml
 * Priority: 1.0 (maximale)
 * 
 * Optimisations v2:
 * - Timeout 5s + retry avec backoff
 * - Validation XML
 * - Stale-while-revalidate
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import {
  SITEMAP_CONFIG,
  fetchWithRetry,
  isValidSitemapXml,
  getSitemapHeaders,
  generateSingleUrlFallback,
  logSitemapError,
} from "~/lib/sitemap-fetch";

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  try {
    // ✅ V2 avec cache Redis (TTL 24h)
    const response = await fetchWithRetry(`${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-pages.xml`);
    const sitemap = await response.text();
    
    // Validation XML
    if (!isValidSitemapXml(sitemap)) {
      throw new Error('Invalid XML response from backend');
    }
    
    const duration = Date.now() - startTime;
    
    return new Response(sitemap, {
      headers: getSitemapHeaders({ responseTime: duration, isStable: true }),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError('Racine', error, duration);
    
    // Fallback avec homepage uniquement (priority 1.0)
    const fallbackSitemap = generateSingleUrlFallback(`${SITEMAP_CONFIG.BASE_URL}/`, 1.0);
    
    return new Response(fallbackSitemap, {
      headers: getSitemapHeaders({
        responseTime: duration,
        isError: true,
        errorMessage: 'Backend unavailable - fallback sitemap',
      }),
    });
  }
}
