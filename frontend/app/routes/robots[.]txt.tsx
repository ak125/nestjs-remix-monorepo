// app/routes/robots[.]txt.tsx
import { type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // ✅ Utiliser l'API REST existante pour robots.txt
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/sitemap/robots.txt`);
    
    if (!response.ok) {
      throw new Error(`Backend API Error: ${response.status} ${response.statusText}`);
    }
    
    const robotsTxt = await response.text();
    
    return new Response(robotsTxt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=172800", // 24h browser, 48h CDN
        "Vary": "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error('[Robots.txt] Erreur:', error);
    
    // Fallback robots.txt sécurisé
    const fallbackRobots = `User-agent: *
Allow: /

# Sitemaps
Sitemap: https://automecanik.com/sitemap.xml

# Restrictions communes
Disallow: /admin/
Disallow: /api/
Disallow: /auth/
Disallow: /_/
Disallow: /temp/

# Crawl delay pour éviter la surcharge
Crawl-delay: 1`;
    
    return new Response(fallbackRobots, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Error": "Backend unavailable - fallback robots.txt",
      },
    });
  }
}
