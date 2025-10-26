/**
 * 📄 SITEMAP PAGES STATIQUES (REMIX - PETIT VOLUME)
 * 
 * Pages statiques du site :
 * - Accueil, À propos, Contact, etc.
 * - CGV, Mentions légales, Politique de confidentialité
 * - Pages aide/support
 * 
 * Cache agressif (7 jours) car contenu rarement modifié
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { createHash } from 'crypto';

interface StaticPage {
  loc: string;
  lastmod: string;
  changefreq: 'yearly' | 'monthly' | 'weekly' | 'daily';
  priority: number;
}

/**
 * Définition des pages statiques
 */
const STATIC_PAGES: StaticPage[] = [
  // Pages principales
  {
    loc: 'https://automecanik.com/',
    lastmod: '2025-10-26',
    changefreq: 'weekly',
    priority: 1.0,
  },
  {
    loc: 'https://automecanik.com/a-propos',
    lastmod: '2025-10-20',
    changefreq: 'monthly',
    priority: 0.5,
  },
  {
    loc: 'https://automecanik.com/contact',
    lastmod: '2025-10-20',
    changefreq: 'monthly',
    priority: 0.5,
  },
  {
    loc: 'https://automecanik.com/blog',
    lastmod: '2025-10-26',
    changefreq: 'daily',
    priority: 0.8,
  },

  // Pages légales (FR-only)
  {
    loc: 'https://automecanik.com/mentions-legales',
    lastmod: '2025-01-01',
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    loc: 'https://automecanik.com/cgv',
    lastmod: '2025-01-01',
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    loc: 'https://automecanik.com/politique-confidentialite',
    lastmod: '2025-01-01',
    changefreq: 'yearly',
    priority: 0.3,
  },

  // Pages aide
  {
    loc: 'https://automecanik.com/aide',
    lastmod: '2025-10-15',
    changefreq: 'monthly',
    priority: 0.6,
  },
  {
    loc: 'https://automecanik.com/faq',
    lastmod: '2025-10-15',
    changefreq: 'monthly',
    priority: 0.6,
  },
  {
    loc: 'https://automecanik.com/livraison',
    lastmod: '2025-10-01',
    changefreq: 'monthly',
    priority: 0.5,
  },
  {
    loc: 'https://automecanik.com/retours',
    lastmod: '2025-10-01',
    changefreq: 'monthly',
    priority: 0.5,
  },
];

/**
 * Cache statique (les pages changent rarement)
 */
let cachedXml: string | null = null;
let cachedETag: string | null = null;
const LAST_MODIFIED = new Date().toUTCString();

export async function loader({ request }: LoaderFunctionArgs) {
  // Générer XML si pas en cache
  if (!cachedXml) {
    cachedXml = buildStaticPagesXml(STATIC_PAGES);
    cachedETag = `"${createHash('md5').update(cachedXml).digest('hex')}"`;
  }

  // Vérifier cache client
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === cachedETag) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': cachedETag,
        'Last-Modified': LAST_MODIFIED,
        'Cache-Control': 'public, max-age=604800', // 7 jours
      },
    });
  }

  // Retourner XML
  return new Response(cachedXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'ETag': cachedETag,
      'Last-Modified': LAST_MODIFIED,
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000', // 7j + 30j stale
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Accept-Encoding',
      'X-Sitemap-Type': 'static-pages',
      'X-Sitemap-Generator': 'remix-static',
    },
  });
}

/**
 * Construire XML
 */
function buildStaticPagesXml(pages: StaticPage[]): string {
  const urls = pages.map((page) => {
    return `  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

/**
 * Échapper XML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
