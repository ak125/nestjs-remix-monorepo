// app/routes/sitemap-products[.]xml.tsx  
import { type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // ✅ Utiliser l'API REST existante pour les produits (714K+ entrées)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/sitemap/products`);
    
    if (!response.ok) {
      throw new Error(`Backend API Error: ${response.status} ${response.statusText}`);
    }
    
    const sitemap = await response.text();
    
    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=7200", // 1h browser, 2h CDN - données produits
        "X-Robots-Tag": "noindex",
        "Vary": "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error('[Sitemap Products] Erreur:', error);
    
    // Fallback sitemap produits générique
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://automecanik.com/products</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://automecanik.com/products/pieces-moteur</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://automecanik.com/products/pieces-carrosserie</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://automecanik.com/products/pieces-freinage</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.7</priority>
  </url>
</urlset>`;
    
    return new Response(fallbackSitemap, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Error": "Backend unavailable - fallback sitemap",
      },
    });
  }
}
