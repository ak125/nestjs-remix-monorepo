/**
 * 📝 GÉNÉRATEUR SITEMAP BLOG (REMIX)
 * Petit volume optimisé avec cache HTTP natif
 */

import { createHash } from "crypto";
import { logger } from "~/utils/logger";

interface BlogArticle {
  slug: string;
  title: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
}

interface SitemapResult {
  xml: string;
  etag: string;
  lastModified: string;
}

/**
 * Cache en mémoire (simple pour demo)
 * En prod: utiliser Redis ou KV store
 */
let cachedSitemap: SitemapResult | null = null;
let cacheExpiry: number = 0;

/**
 * Générer le sitemap blog avec cache
 */
export async function generateBlogSitemap(): Promise<SitemapResult> {
  const now = Date.now();

  // Retourner cache si valide (24h)
  if (cachedSitemap && now < cacheExpiry) {
    return cachedSitemap;
  }

  // Récupérer articles depuis NestJS
  const articles = await fetchBlogArticles();

  // Générer XML
  const xml = buildBlogSitemapXml(articles);

  // Calculer ETag (hash du contenu)
  const etag = `"${createHash("md5").update(xml).digest("hex")}"`;

  // Last-Modified = article le plus récent
  const lastModified = getLatestModifiedDate(articles);

  const result: SitemapResult = {
    xml,
    etag,
    lastModified,
  };

  // Mettre en cache (24h)
  cachedSitemap = result;
  cacheExpiry = now + 86400000; // 24h en ms

  return result;
}

/**
 * Récupérer articles depuis API NestJS
 */
async function fetchBlogArticles(): Promise<BlogArticle[]> {
  try {
    const response = await fetch("http://localhost:3000/blog/articles", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.articles || [];
  } catch (error) {
    logger.error("Failed to fetch blog articles:", error);
    // Fallback: retourner données mockées
    return getMockArticles();
  }
}

/**
 * Construire XML du sitemap
 */
function buildBlogSitemapXml(articles: BlogArticle[]): string {
  const urls = articles.map((article) => {
    const loc = `https://www.automecanik.com/blog/${article.slug}`;
    const lastmod = article.updatedAt || article.publishedAt;
    const changefreq = "monthly";
    const priority = 0.6;

    return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

/**
 * Obtenir la date de dernière modification
 */
function getLatestModifiedDate(articles: BlogArticle[]): string {
  if (articles.length === 0) {
    return new Date().toUTCString();
  }

  const latest = articles.reduce((max, article) => {
    const date = new Date(article.updatedAt || article.publishedAt);
    return date > new Date(max)
      ? article.updatedAt || article.publishedAt
      : max;
  }, articles[0].updatedAt || articles[0].publishedAt);

  return new Date(latest).toUTCString();
}

/**
 * Échapper caractères spéciaux XML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Données mockées (fallback)
 */
function getMockArticles(): BlogArticle[] {
  return [
    {
      slug: "comment-changer-filtre-huile",
      title: "Comment changer un filtre à huile",
      publishedAt: "2025-01-15T10:00:00.000Z",
      updatedAt: "2025-01-20T14:30:00.000Z",
      category: "entretien",
    },
    {
      slug: "choisir-plaquettes-frein",
      title: "Guide pour choisir ses plaquettes de frein",
      publishedAt: "2025-01-10T09:00:00.000Z",
      updatedAt: "2025-01-18T11:00:00.000Z",
      category: "guide",
    },
    {
      slug: "vidange-moteur-etapes",
      title: "Les étapes d'une vidange moteur",
      publishedAt: "2025-01-05T08:00:00.000Z",
      updatedAt: "2025-01-05T08:00:00.000Z",
      category: "entretien",
    },
  ];
}

/**
 * Invalider le cache (à appeler après publication article)
 */
export function invalidateBlogSitemapCache(): void {
  cachedSitemap = null;
  cacheExpiry = 0;
}
