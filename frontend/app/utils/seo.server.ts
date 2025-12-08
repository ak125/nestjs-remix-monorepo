// app/utils/seo.server.ts
import { type MetaFunction } from "@remix-run/node";

export interface SeoData {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
  noindex?: boolean;
  ogType?: string;
  twitterCard?: string;
}

export async function getSeoMetadata(
  url: string,
  fallbacks?: Partial<SeoData>
): Promise<SeoData> {
  try {
    // ✅ Utiliser l'API backend existante (714K+ entrées, services 518 lignes)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const encodedUrl = encodeURIComponent(url);
    const response = await fetch(`${backendUrl}/api/seo/metadata/${encodedUrl}`);
    
    if (!response.ok) {
      throw new Error(`SEO API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      title: data.meta_title || fallbacks?.title || generateSmartTitle(url),
      description: data.meta_description || fallbacks?.description || generateSmartDescription(url),
      keywords: data.meta_keywords || fallbacks?.keywords,
      canonical: `https://www.automecanik.com${url}`,
      ogImage: data.og_image || fallbacks?.ogImage || 'https://www.automecanik.com/images/og-default.jpg',
      ogType: data.og_type || fallbacks?.ogType || 'website',
      twitterCard: data.twitter_card || fallbacks?.twitterCard || 'summary_large_image',
      noindex: data.robots?.includes('noindex') || fallbacks?.noindex || false,
    };
  } catch (error) {
    console.error('[SEO] Erreur récupération métadonnées:', error);
    
    // Fallback intelligent basé sur l'URL
    return {
      title: fallbacks?.title || generateSmartTitle(url),
      description: fallbacks?.description || generateSmartDescription(url),
      keywords: fallbacks?.keywords,
      canonical: `https://www.automecanik.com${url}`,
      ogImage: fallbacks?.ogImage || 'https://www.automecanik.com/images/og-default.jpg',
      ogType: fallbacks?.ogType || 'website',
      twitterCard: fallbacks?.twitterCard || 'summary_large_image',
      noindex: fallbacks?.noindex || false,
    };
  }
}

function generateSmartTitle(url: string): string {
  const segments = url.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return 'Automecanik - Pièces automobiles en ligne | Qualité & Service';
  }
  
  // Logique intelligente par section
  if (segments[0] === 'products') {
    const category = segments[1] || 'Pièces Auto';
    return `${formatSegment(category)} | Pièces Auto - Automecanik`;
  }
  
  if (segments[0] === 'constructeurs') {
    const brand = segments[1] || 'Constructeurs';
    return `${formatSegment(brand)} - Pièces Auto | Automecanik`;
  }
  
  if (segments[0] === 'admin') {
    const section = segments[1] || 'Administration';
    return `${formatSegment(section)} - Admin | Automecanik`;
  }
  
  if (segments[0] === 'blog') {
    const article = segments[1] || 'Blog';
    return `${formatSegment(article)} | Blog Auto - Automecanik`;
  }
  
  // Fallback générique
  const pageTitle = formatSegment(segments[segments.length - 1]);
  return `${pageTitle} | Automecanik`;
}

function generateSmartDescription(url: string): string {
  const segments = url.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return 'Découvrez notre large gamme de pièces automobiles de qualité. Livraison rapide, prix compétitifs et service client expert pour tous véhicules.';
  }
  
  // Descriptions intelligentes par section
  if (segments[0] === 'products') {
    const category = segments[1] || 'pièces auto';
    return `Large sélection de ${formatSegment(category).toLowerCase()} pour toutes marques. Qualité garantie, livraison rapide et prix compétitifs.`;
  }
  
  if (segments[0] === 'constructeurs') {
    const brand = segments[1] || 'constructeurs';
    return `Pièces détachées ${formatSegment(brand)} d'origine et compatibles. Catalogue complet avec références OEM et garantie constructeur.`;
  }
  
  if (segments[0] === 'blog') {
    return 'Conseils d\'experts, guides techniques et actualités du monde automobile. Restez informé des dernières tendances et innovations.';
  }
  
  // Fallback générique
  return 'Pièces automobiles de qualité sur Automecanik. Service client expert, livraison rapide et garantie satisfaction.';
}

function formatSegment(segment: string): string {
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper pour créer MetaFunction complète
export function createSeoMeta(seoData: SeoData): ReturnType<MetaFunction> {
  const meta: ReturnType<MetaFunction> = [
    // Titre principal
    { title: seoData.title },
    
    // Métadonnées essentielles
    { name: "description", content: seoData.description },
    
    // Open Graph (Facebook, LinkedIn, etc.)
    { property: "og:title", content: seoData.title },
    { property: "og:description", content: seoData.description },
    { property: "og:image", content: seoData.ogImage },
    { property: "og:url", content: seoData.canonical },
    { property: "og:type", content: seoData.ogType || "website" },
    { property: "og:site_name", content: "Automecanik" },
    
    // Twitter Cards
    { name: "twitter:card", content: seoData.twitterCard || "summary_large_image" },
    { name: "twitter:title", content: seoData.title },
    { name: "twitter:description", content: seoData.description },
    { name: "twitter:image", content: seoData.ogImage },
    { name: "twitter:site", content: "@Automecanik" },
    
    // URL canonique
    { tagName: "link", rel: "canonical", href: seoData.canonical },
  ];
  
  // Mots-clés (optionnel)
  if (seoData.keywords) {
    meta.push({ name: "keywords", content: seoData.keywords });
  }
  
  // Robots (si noindex)
  if (seoData.noindex) {
    meta.push({ name: "robots", content: "noindex,nofollow" });
  } else {
    meta.push({ name: "robots", content: "index,follow" });
  }
  
  return meta;
}

// Helper pour pages avec données spécifiques
export function createProductSeoMeta(product: {
  name: string;
  description: string;
  category: string;
  brand: string;
  price?: number;
  image?: string;
  sku?: string;
}): ReturnType<MetaFunction> {
  const title = `${product.name} ${product.brand} | ${product.category} - Automecanik`;
  const description = `${product.description} - ${product.brand}. ${product.price ? `À partir de ${product.price}€. ` : ''}Livraison rapide et garantie qualité.`;
  
  const meta: ReturnType<MetaFunction> = [
    { title },
    { name: "description", content: description },
    
    // Schema.org pour produit
    { property: "product:brand", content: product.brand },
    { property: "product:category", content: product.category },
    
    // Open Graph Product
    { property: "og:type", content: "product" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: product.image || 'https://www.automecanik.com/images/og-product-default.jpg' },
    
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: product.image || 'https://www.automecanik.com/images/og-product-default.jpg' },
  ];
  
  if (product.price) {
    meta.push(
      { property: "product:price:amount", content: product.price.toString() },
      { property: "product:price:currency", content: "EUR" }
    );
  }
  
  if (product.sku) {
    meta.push({ property: "product:retailer_item_id", content: product.sku });
  }
  
  return meta;
}

// Helper pour articles de blog
export function createArticleSeoMeta(article: {
  title: string;
  description: string;
  author: string;
  publishedTime: string;
  modifiedTime?: string;
  image?: string;
  tags?: string[];
}): ReturnType<MetaFunction> {
  const title = `${article.title} | Blog Auto - Automecanik`;
  
  const meta: ReturnType<MetaFunction> = [
    { title },
    { name: "description", content: article.description },
    
    // Article metadata
    { name: "author", content: article.author },
    { name: "article:author", content: article.author },
    { name: "article:published_time", content: article.publishedTime },
    
    // Open Graph Article
    { property: "og:type", content: "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: article.description },
    { property: "og:image", content: article.image || 'https://www.automecanik.com/images/og-blog-default.jpg' },
    { property: "article:author", content: article.author },
    { property: "article:published_time", content: article.publishedTime },
    
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: article.description },
    { name: "twitter:image", content: article.image || 'https://www.automecanik.com/images/og-blog-default.jpg' },
  ];
  
  if (article.modifiedTime) {
    meta.push(
      { name: "article:modified_time", content: article.modifiedTime },
      { property: "article:modified_time", content: article.modifiedTime }
    );
  }
  
  if (article.tags && article.tags.length > 0) {
    article.tags.forEach(tag => {
      meta.push({ property: "article:tag", content: tag });
    });
    meta.push({ name: "keywords", content: article.tags.join(', ') });
  }
  
  return meta;
}
