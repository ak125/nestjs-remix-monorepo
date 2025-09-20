// app/routes/sitemap[.]xml.tsx
import { type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // ✅ Utiliser l'API REST existante - 714K+ enregistrements, service complet
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/sitemap/index`);
    
    if (!response.ok) {
      throw new Error(`Backend API Error: ${response.status} ${response.statusText}`);
    }
    
    const sitemap = await response.text();
    
    // ✅ Headers optimisés pour SEO et performance
    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=7200", // 1h browser, 2h CDN
        "X-Robots-Tag": "noindex", // Pas d'indexation du sitemap lui-même
        "Vary": "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error('[Sitemap Index] Erreur:', error);
    
    // ✅ Fallback sitemap minimal mais fonctionnel
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://automecanik.com/sitemap-main.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-constructeurs.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-products.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-blog.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;
    
    return new Response(fallbackSitemap, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300", // Cache plus court en cas d'erreur
        "X-Error": "Backend unavailable - fallback sitemap",
      },
    });
  }
}
