// app/routes/sitemap-constructeurs[.]xml.tsx
/**
 * 🚗 SITEMAP CONSTRUCTEURS - Système V2 avec filtres SEO
 * Filtre: marque_display=1, marque_relfollow=1 ou null
 * Format URL: /constructeurs/{marque_alias}-{marque_id}.html
 * Priority: 0.9
 * 
 * Optimisations v2:
 * - Timeout 5s + retry avec backoff
 * - Validation XML
 * - Cache stable (données rarement modifiées)
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
    const response = await fetchWithRetry(`${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-constructeurs.xml`);
    const sitemap = await response.text();
    
    if (!isValidSitemapXml(sitemap)) {
      throw new Error('Invalid XML response from backend');
    }
    
    const duration = Date.now() - startTime;
    
    return new Response(sitemap, {
      headers: getSitemapHeaders({ responseTime: duration, isStable: true }),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError('Constructeurs', error, duration);
    
    // Fallback avec page constructeurs générique
    const fallbackSitemap = generateSingleUrlFallback(`${SITEMAP_CONFIG.BASE_URL}/constructeurs`, 0.9);
    
    return new Response(fallbackSitemap, {
      headers: getSitemapHeaders({
        responseTime: duration,
        isError: true,
        errorMessage: 'Backend unavailable - fallback sitemap',
      }),
    });
  }
}
