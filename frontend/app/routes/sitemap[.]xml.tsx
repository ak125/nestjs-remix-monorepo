// app/routes/sitemap[.]xml.tsx
/**
 * 🗺️ SITEMAP INDEX - Système V2 Scalable
 * 
 * Structure optimale:
 * - sitemap-racine.xml (homepage)
 * - sitemap-constructeurs.xml (marques avec relfollow)
 * - sitemap-modeles.xml (sharding alphabétique A-M + N-Z)
 * - sitemap-types-*.xml (sharding numérique avec type_relfollow=1|null)
 * - sitemap-gamme-produits.xml (gammes pièces niveau 1 & 2)
 * - sitemap-pieces-index.xml (714k+ URLs depuis __sitemap_p_link)
 * - sitemap-blog.xml (articles)
 * 
 * 📊 URLs totales estimées: ~750,000+
 * - Constructeurs: ~250
 * - Modèles: ~8,000
 * - Types: ~15,000-24,000
 * - Gammes: ~800
 * - Pièces: ~714,000
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
  generateFallbackSitemapIndex,
  logSitemapError,
} from "~/lib/sitemap-fetch";

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  try {
    const response = await fetchWithRetry(`${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-index.xml`);
    const sitemap = await response.text();
    
    // Validation XML
    if (!isValidSitemapXml(sitemap)) {
      throw new Error('Invalid XML response from backend');
    }
    
    const duration = Date.now() - startTime;
    
    return new Response(sitemap, {
      headers: getSitemapHeaders({ responseTime: duration }),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError('Index', error, duration);
    
    // Fallback sitemap index complet avec tous les sitemaps
    const fallbackSitemap = generateFallbackSitemapIndex([
      // Static & racine
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-racine.xml` },
      // Gammes produits
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-gamme-produits.xml` },
      // Catalogue véhicules
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-constructeurs.xml` },
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-modeles.xml` },
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-types-1.xml` },
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-types-2.xml` },
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-types-3.xml` },
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-types-4.xml` },
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-types-5.xml` },
      // 🔗 Pièces détaillées (714k+ URLs)
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-pieces-index.xml` },
      // Blog
      { loc: `${SITEMAP_CONFIG.BASE_URL}/sitemap-blog.xml` },
    ]);
    
    return new Response(fallbackSitemap, {
      headers: getSitemapHeaders({
        responseTime: duration,
        isError: true,
        errorMessage: 'Backend unavailable - fallback sitemap index',
      }),
    });
  }
}
