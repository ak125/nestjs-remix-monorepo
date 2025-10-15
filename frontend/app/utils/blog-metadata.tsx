/**
 * 📝 BLOG METADATA HELPER - Frontend Remix
 * 
 * Hooks et utilitaires pour utiliser les métadonnées SEO
 * dans toutes les pages du blog
 */

import { Fragment } from 'react';

export interface BlogMetadata {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  ariane: string;
  content: string | null;
  relfollow: string;
}

export interface BlogMetadataLoaderData {
  metadata?: BlogMetadata | null;
}

/**
 * Charger les métadonnées depuis l'API backend
 * À utiliser dans le loader Remix
 * 
 * @example
 * export const loader = async () => {
 *   const metadata = await loadBlogMetadata('constructeurs');
 *   return json({ metadata });
 * };
 */
export async function loadBlogMetadata(
  alias: string,
  backendUrl?: string
): Promise<BlogMetadata | null> {
  try {
    const url = backendUrl || process.env.BACKEND_URL || "http://localhost:3000";
    
    const response = await fetch(`${url}/api/blog/metadata/${alias}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.warn(`⚠️ Erreur chargement métadonnées pour "${alias}"`);
      return null;
    }

    const data = await response.json();
    
    return data?.success && data?.data ? data.data : null;
  } catch (error) {
    console.error(`❌ Erreur loadBlogMetadata("${alias}"):`, error);
    return null;
  }
}

/**
 * Générer les meta tags pour Remix à partir des métadonnées
 * À utiliser dans l'export meta
 * 
 * @example
 * export const meta: MetaFunction<typeof loader> = ({ data }) => {
 *   return generateBlogMeta(data?.metadata, {
 *     titleSuffix: ' | Automecanik',
 *     defaultTitle: 'Page Blog'
 *   });
 * };
 */
export function generateBlogMeta(
  metadata: BlogMetadata | null | undefined,
  options?: {
    titleSuffix?: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultKeywords?: string;
    ogImage?: string;
    twitterCard?: 'summary' | 'summary_large_image';
  }
) {
  const opts = {
    titleSuffix: options?.titleSuffix || '',
    defaultTitle: options?.defaultTitle || 'Automecanik',
    defaultDescription: options?.defaultDescription || 'Pièces détachées automobiles',
    defaultKeywords: options?.defaultKeywords || 'pièces auto',
    ogImage: options?.ogImage,
    twitterCard: options?.twitterCard || 'summary_large_image',
  };

  const title = metadata?.title 
    ? `${metadata.title}${opts.titleSuffix}` 
    : opts.defaultTitle;
  
  const description = metadata?.description || opts.defaultDescription;
  const keywords = metadata?.keywords || opts.defaultKeywords;
  const robots = metadata?.relfollow || 'index, follow';

  const metaTags = [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { name: "robots", content: robots },
  ];

  // OpenGraph tags
  if (opts.ogImage) {
    metaTags.push(
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: opts.ogImage },
      { property: "og:type", content: "website" }
    );
  }

  // Twitter Card tags
  metaTags.push(
    { name: "twitter:card", content: opts.twitterCard },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description }
  );

  return metaTags;
}

/**
 * Parser le fil d'Ariane (breadcrumb) depuis mta_ariane
 * Format attendu: "Accueil > Section > Page"
 * 
 * @example
 * const breadcrumb = parseBreadcrumb(metadata?.ariane);
 * // Returns: [{ label: 'Accueil', url: '/' }, { label: 'Section', url: '/section' }]
 */
export function parseBreadcrumb(
  ariane: string | null | undefined,
  urlMap?: Record<string, string>
): Array<{ label: string; url?: string }> {
  if (!ariane) {
    return [{ label: 'Accueil', url: '/' }];
  }

  const defaultUrlMap: Record<string, string> = {
    'Accueil': '/',
    'Blog': '/blog',
    'Conseils': '/blog-pieces-auto/conseils',
    'Constructeurs': '/blog-pieces-auto/auto',
    'Pièces Auto': '/blog-pieces-auto',
    'Guides': '/guides',
    ...(urlMap || {}),
  };

  return ariane.split('>').map((item, index, array) => {
    const label = item.trim();
    
    // Dernier élément = page actuelle (pas de lien)
    if (index === array.length - 1) {
      return { label };
    }

    // Chercher l'URL dans le mapping
    const url = defaultUrlMap[label];
    
    return { label, url };
  });
}

/**
 * Hook React pour utiliser les métadonnées dans un composant
 * (si besoin d'accès direct aux métadonnées dans le component)
 * 
 * @example
 * const { metadata, h1, breadcrumb } = useBlogMetadata(loaderData);
 */
export function useBlogMetadata(data: BlogMetadataLoaderData) {
  const metadata = data?.metadata;
  
  return {
    metadata,
    h1: metadata?.h1 || '',
    title: metadata?.title || '',
    description: metadata?.description || '',
    breadcrumb: parseBreadcrumb(metadata?.ariane),
    content: metadata?.content,
    hasMetadata: !!metadata,
  };
}

/**
 * Composant React pour afficher le fil d'Ariane
 * 
 * @example
 * <Breadcrumb ariane={metadata?.ariane} className="mb-4" />
 */
export function Breadcrumb({
  ariane,
  separator = '/',
  className = '',
  itemClassName = '',
  activeClassName = 'text-white font-medium',
}: {
  ariane?: string | null;
  separator?: string;
  className?: string;
  itemClassName?: string;
  activeClassName?: string;
}) {
  const items = parseBreadcrumb(ariane);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span className={itemClassName}>{separator}</span>}
          {item.url ? (
            <a href={item.url} className={`${itemClassName} hover:text-white transition-colors`}>
              {item.label}
            </a>
          ) : (
            <span className={`${itemClassName} ${activeClassName}`}>
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
