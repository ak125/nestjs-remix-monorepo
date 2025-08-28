// app/routes/sitemap-blog[.]xml.tsx
import { type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // ✅ Utiliser l'API REST existante pour le blog (109 articles)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/sitemap/blog`);
    
    if (!response.ok) {
      throw new Error(`Backend API Error: ${response.status} ${response.statusText}`);
    }
    
    const sitemap = await response.text();
    
    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=3600", // 30min browser, 1h CDN - contenu blog
        "X-Robots-Tag": "noindex",
        "Vary": "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error('[Sitemap Blog] Erreur:', error);
    
    // Fallback sitemap blog générique
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://automecanik.com/blog</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.6</priority>
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
