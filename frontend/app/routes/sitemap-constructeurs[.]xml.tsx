// app/routes/sitemap-constructeurs[.]xml.tsx
import { type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // ✅ Utiliser l'API REST existante pour les constructeurs (117 marques)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/sitemap/constructeurs`);
    
    if (!response.ok) {
      throw new Error(`Backend API Error: ${response.status} ${response.statusText}`);
    }
    
    const sitemap = await response.text();
    
    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=7200, s-maxage=14400", // 2h browser, 4h CDN - données stables
        "X-Robots-Tag": "noindex",
        "Vary": "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error('[Sitemap Constructeurs] Erreur:', error);
    
    // Fallback sitemap constructeurs générique
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://automecanik.com/constructeurs</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://automecanik.com/constructeurs/renault</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://automecanik.com/constructeurs/peugeot</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://automecanik.com/constructeurs/citroen</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
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
