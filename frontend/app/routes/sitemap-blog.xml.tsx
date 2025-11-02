/**
 * 📝 SITEMAP BLOG (REMIX - PETIT VOLUME)
 * 
 * Performance optimisée :
 * - ETag + Last-Modified (cache HTTP)
 * - Cache-Control: public, max-age=86400 (24h)
 * - stale-while-revalidate (7 jours)
 * - 304 Not Modified sur cache hit
 * 
 * Idéal pour :
 * - 500-1000 articles max
 * - Latence ultra-faible (15ms sur cache hit)
 * - CDN-friendly
 */

import  { type LoaderFunctionArgs } from '@remix-run/node';
import { generateBlogSitemap } from '~/utils/seo/blog-sitemap.server';

/**
 * Loader Remix pour sitemap blog
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Vérifier cache via If-None-Match (ETag)
    const ifNoneMatch = request.headers.get('If-None-Match');
    const ifModifiedSince = request.headers.get('If-Modified-Since');

    // 2. Générer sitemap (ou récupérer du cache)
    const { xml, etag, lastModified } = await generateBlogSitemap();

    // 3. Retourner 304 si cache valide
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Last-Modified': lastModified,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    // Vérifier If-Modified-Since
    if (ifModifiedSince) {
      const ifModifiedDate = new Date(ifModifiedSince);
      const lastModifiedDate = new Date(lastModified);

      if (lastModifiedDate <= ifModifiedDate) {
        return new Response(null, {
          status: 304,
          headers: {
            'ETag': etag,
            'Last-Modified': lastModified,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }
    }

    // 4. Retourner XML avec headers optimisés
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'ETag': etag,
        'Last-Modified': lastModified,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
        'Vary': 'Accept-Encoding',
        'X-Sitemap-Type': 'blog',
        'X-Sitemap-Generator': 'remix-optimized',
      },
    });
  } catch (error) {
    console.error('Blog sitemap generation error:', error);

    // Retourner erreur 500
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Error generating sitemap -->
</urlset>`,
      {
        status: 500,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}
