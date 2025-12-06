// app/routes/sitemap-pieces-$range[.]xml.tsx
/**
 * 🔗 SITEMAP PIÈCES DÉTAILLÉES (DYNAMIQUE)
 * Route dynamique pour tous les shards de pièces: 0-50000, 50001-100000, etc.
 * Système V2 avec 714k+ URLs depuis __sitemap_p_link
 * 
 * Format URL: /pieces/{gamme}/{marque}/{modele}/{type}.html
 * Filtre: map_has_item > 0 (seulement les pièces en stock)
 * Priority: 0.6
 * 
 * Shards supportés (50k URLs chacun):
 * - 0-50000, 50001-100000, 100001-150000, ...
 * - jusqu'à 700001-750000 (15 shards total)
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

// Shards valides (jusqu'à 500k URLs, en réalité ~481k avec map_has_item > 0)
const VALID_RANGES = [
  '0-50000',
  '50001-100000',
  '100001-150000',
  '150001-200000',
  '200001-250000',
  '250001-300000',
  '300001-350000',
  '350001-400000',
  '400001-450000',
  '450001-500000',
];

export async function loader({ params }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const range = params.range;
  
  // Validation du range
  if (!range || !VALID_RANGES.includes(range)) {
    return new Response(generateEmptyFallbackSitemap(), {
      status: 404,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "X-Error": `Invalid range: ${range}`,
      },
    });
  }
  
  try {
    const response = await fetchWithRetry(
      `${SITEMAP_CONFIG.BACKEND_URL}/sitemap-v2/sitemap-pieces-${range}.xml`
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
        "X-Shard": `pieces-${range}`,
        "X-Max-URLs": "50000",
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSitemapError(`Pieces ${range}`, error, duration);
    
    return new Response(generateEmptyFallbackSitemap(), {
      headers: getSitemapHeaders({
        responseTime: duration,
        isError: true,
        errorMessage: 'Backend unavailable - empty sitemap',
      }),
    });
  }
}
