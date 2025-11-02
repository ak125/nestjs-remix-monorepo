/**
 * 💡 SITEMAP CONSEILS/GUIDES (REMIX - PETIT VOLUME)
 * 
 * Guides pratiques et conseils techniques
 * Cache 24h avec revalidation
 */

import { createHash } from 'crypto';
import  { type LoaderFunctionArgs } from '@remix-run/node';

interface ConseilArticle {
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  updatedAt?: string;
}

/**
 * Cache en mémoire
 */
let cachedSitemap: { xml: string; etag: string; lastModified: string } | null = null;
let cacheExpiry: number = 0;

export async function loader({ request }: LoaderFunctionArgs) {
  const now = Date.now();

  // Générer sitemap si cache expiré
  if (!cachedSitemap || now > cacheExpiry) {
    const articles = await fetchConseilsArticles();
    const xml = buildConseilsXml(articles);
    const etag = `"${createHash('md5').update(xml).digest('hex')}"`;
    const lastModified = getLatestDate(articles);

    cachedSitemap = { xml, etag, lastModified };
    cacheExpiry = now + 86400000; // 24h
  }

  // Vérifier cache client
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === cachedSitemap.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': cachedSitemap.etag,
        'Last-Modified': cachedSitemap.lastModified,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  return new Response(cachedSitemap.xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'ETag': cachedSitemap.etag,
      'Last-Modified': cachedSitemap.lastModified,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Accept-Encoding',
      'X-Sitemap-Type': 'conseils',
    },
  });
}

/**
 * Récupérer articles depuis NestJS
 */
async function fetchConseilsArticles(): Promise<ConseilArticle[]> {
  try {
    const response = await fetch('http://localhost:3000/blog/conseils', {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    return data.conseils || [];
  } catch (error) {
    console.error('Failed to fetch conseils:', error);
    return getMockConseils();
  }
}

/**
 * Construire XML
 */
function buildConseilsXml(articles: ConseilArticle[]): string {
  const urls = articles.map((article) => {
    const loc = `https://automecanik.com/conseils/${article.slug}`;
    const lastmod = article.updatedAt || article.publishedAt;

    return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

/**
 * Date la plus récente
 */
function getLatestDate(articles: ConseilArticle[]): string {
  if (articles.length === 0) return new Date().toUTCString();

  const latest = articles.reduce((max, article) => {
    const date = article.updatedAt || article.publishedAt;
    return date > max ? date : max;
  }, articles[0].updatedAt || articles[0].publishedAt);

  return new Date(latest).toUTCString();
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

/**
 * Mock data
 */
function getMockConseils(): ConseilArticle[] {
  return [
    {
      slug: 'entretien-freins-voiture',
      title: 'Entretien des freins de voiture',
      category: 'entretien',
      publishedAt: '2025-09-15T10:00:00.000Z',
      updatedAt: '2025-10-10T14:00:00.000Z',
    },
    {
      slug: 'choisir-huile-moteur',
      title: 'Comment choisir son huile moteur',
      category: 'guide',
      publishedAt: '2025-09-10T09:00:00.000Z',
    },
    {
      slug: 'controle-technique-preparation',
      title: 'Préparer son contrôle technique',
      category: 'administratif',
      publishedAt: '2025-09-05T08:00:00.000Z',
    },
  ];
}
