// app/routes/sitemap-modeles[.]xml.tsx
/**
 * 🚙 SITEMAP MODÈLES - Système V2 avec sharding alphabétique
 * Filtre: modele_display=1, modele_relfollow=1 ou null
 * Format URL: /constructeurs/{marque}-{id}/{modele}-{id}.html
 * Priority: 0.8
 * Sharding: A-M et N-Z combinés pour une seule réponse
 * 
 * Optimisations v2:
 * - Timeout 5s + retry avec backoff
 * - Fetch parallèle des deux shards
 * - Combinaison intelligente des URLs
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import {
  SITEMAP_CONFIG,
  fetchWithRetry,
  getSitemapHeaders,
  generateEmptyFallbackSitemap,
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allUrls.join('\n')}
</urlset>`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  try {
    // Fetch parallèle des deux shards alphabétiques
    const [respAM, respNZ] = await Promise.all([
      fetchWithRetry(`${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-modeles-a-m.xml`),
      fetchWithRetry(`${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-modeles-n-z.xml`),
    ]);
    
    const [xmlAM, xmlNZ] = await Promise.all([
      respAM.text(),
      respNZ.text(),
    ]);
    
    const combinedSitemap = combineSitemaps([xmlAM, xmlNZ]);
    const duration = Date.now() - startTime;
    
    return new Response(combinedSitemap, {
      headers: {
        ...getSitemapHeaders({ responseTime: duration }),
        "X-Url-Count": String(extractUrls(xmlAM).length + extractUrls(xmlNZ).length),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError('Modèles', error, duration);
    
    return new Response(generateEmptyFallbackSitemap(), {
      headers: getSitemapHeaders({
        responseTime: duration,
        isError: true,
        errorMessage: 'Backend unavailable - fallback sitemap',
      }),
    });
  }
}
