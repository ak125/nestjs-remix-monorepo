// app/routes/sitemap-pieces-index[.]xml.tsx
/**
 * 🔗 SITEMAP PIÈCES INDEX - Liste de tous les sitemaps de pièces
 * Système V2 avec 714k+ URLs pré-calculées depuis __sitemap_p_link
 * 
 * Sharding par 50,000 URLs (limite Google):
 * - pieces-0-50000.xml
 * - pieces-50001-100000.xml
 * - ... jusqu'à pieces-700001-750000.xml
 * 
 * Format URL: /pieces/{gamme}/{marque}/{modele}/{type}.html
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import {
  SITEMAP_CONFIG,
  fetchWithRetry,
  isValidSitemapXml,
  getSitemapHeaders,
  logSitemapError,
} from "~/lib/sitemap-fetch";

// Générer un sitemap index vide en cas d'erreur
function generateEmptyPiecesIndex(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Pieces sitemaps index - empty fallback -->
</sitemapindex>`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  try {
    const response = await fetchWithRetry(
      `${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-pieces-index.xml`
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
        "X-Sitemap-Type": "pieces-index",
        "X-Total-Shards": "10",
        "X-Total-URLs": "~481000",
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError('Pieces Index', error, duration);
    
    return new Response(generateEmptyPiecesIndex(), {
      headers: getSitemapHeaders({
        responseTime: duration,
        isError: true,
        errorMessage: 'Backend unavailable - empty sitemap index',
      }),
    });
  }
}
