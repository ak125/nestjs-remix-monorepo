import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';

export interface MetaTagsData {
  title: string;
  description: string;
  keywords?: string[];
  author?: string;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  canonical?: string;
  robots?: string;
  viewport?: string;
  charset?: string;
  language?: string;
  openGraph?: {
    type: string;
    title: string;
    description: string;
    image: string;
    url: string;
    siteName: string;
    locale?: string;
  };
  twitter?: {
    card: string;
    site?: string;
    creator?: string;
    title: string;
    description: string;
    image: string;
  };
  structured?: Record<string, any>;
}

@Injectable()
export class MetaTagsService {
  private readonly logger = new Logger(MetaTagsService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Génère les meta tags pour une page
   */
  async generateMetaTags(
    pageType: string,
    data: Partial<MetaTagsData> = {},
  ): Promise<MetaTagsData> {
    try {
      const cacheKey = `meta-tags:${pageType}:${JSON.stringify(data)}`;

      // Vérifier le cache (1 heure)
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached as MetaTagsData;
      }

      // Générer les meta tags selon le type de page
      const metaTags = await this.buildMetaTagsForPage(pageType, data);

      // Mettre en cache
      await this.cacheService.set(cacheKey, metaTags, 3600);

      return metaTags;
    } catch (error) {
      this.logger.error('Erreur génération meta tags:', error);
      return this.getFallbackMetaTags();
    }
  }

  /**
   * Construit les meta tags selon le type de page
   */
  private async buildMetaTagsForPage(
    pageType: string,
    data: Partial<MetaTagsData>,
  ): Promise<MetaTagsData> {
    switch (pageType) {
      case 'home':
        return this.buildHomeMetaTags(data);
      case 'product':
        return this.buildProductMetaTags(data);
      case 'category':
        return this.buildCategoryMetaTags(data);
      case 'article':
        return this.buildArticleMetaTags(data);
      case 'admin':
        return this.buildAdminMetaTags(data);
      default:
        return this.buildDefaultMetaTags(data);
    }
  }

  /**
   * Meta tags pour la page d'accueil
   */
  private buildHomeMetaTags(data: Partial<MetaTagsData>): MetaTagsData {
    const defaultTitle = 'Automecanik - Votre boutique en ligne de confiance';
    const defaultDescription =
      'Découvrez notre large gamme de produits de qualité. Livraison rapide, prix compétitifs et service client exceptionnel.';

    return {
      title: data.title || defaultTitle,
      description: data.description || defaultDescription,
      keywords: data.keywords || [
        'boutique en ligne',
        'e-commerce',
        'livraison rapide',
        'qualité',
        'prix compétitifs',
      ],
      author: 'Automecanik',
      canonical: data.canonical || '/',
      robots: 'index, follow',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
      language: 'fr',
      openGraph: {
        type: 'website',
        title: data.title || defaultTitle,
        description: data.description || defaultDescription,
        image: data.image?.url || '/images/og-home.jpg',
        url: '/',
        siteName: 'Automecanik',
        locale: 'fr_FR',
      },
      twitter: {
        card: 'summary_large_image',
        site: '@Automecanik',
        title: data.title || defaultTitle,
        description: data.description || defaultDescription,
        image: data.image?.url || '/images/twitter-home.jpg',
      },
      structured: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Automecanik',
        url: 'https://www.automecanik.com',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://www.automecanik.com/search?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    };
  }

  /**
   * Meta tags pour une page produit
   */
  private buildProductMetaTags(data: Partial<MetaTagsData>): MetaTagsData {
    const title = data.title || 'Produit - Automecanik';
    const description =
      data.description || 'Découvrez ce produit sur Automecanik';

    return {
      title,
      description,
      keywords: data.keywords || ['produit', 'achat', 'boutique'],
      robots: 'index, follow',
      canonical: data.canonical,
      openGraph: {
        type: 'product',
        title,
        description,
        image: data.image?.url || '/images/product-default.jpg',
        url: data.canonical || '',
        siteName: 'Automecanik',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        image: data.image?.url || '/images/product-default.jpg',
      },
      structured: data.structured || {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: title,
        description,
        image: data.image?.url,
      },
    };
  }

  /**
   * Meta tags pour une page catégorie
   */
  private buildCategoryMetaTags(data: Partial<MetaTagsData>): MetaTagsData {
    const title = data.title || 'Catégorie - Automecanik';
    const description =
      data.description || 'Explorez notre sélection de produits';

    return {
      title,
      description,
      keywords: data.keywords || ['catégorie', 'produits', 'boutique'],
      robots: 'index, follow',
      canonical: data.canonical,
      openGraph: {
        type: 'website',
        title,
        description,
        image: data.image?.url || '/images/category-default.jpg',
        url: data.canonical || '',
        siteName: 'Automecanik',
      },
      twitter: {
        card: 'summary',
        title,
        description,
        image: data.image?.url || '/images/category-default.jpg',
      },
    };
  }

  /**
   * Meta tags pour un article de blog
   */
  private buildArticleMetaTags(data: Partial<MetaTagsData>): MetaTagsData {
    const title = data.title || 'Article - Automecanik';
    const description = data.description || 'Lisez notre dernier article';

    return {
      title,
      description,
      keywords: data.keywords || ['article', 'blog', 'actualités'],
      author: data.author || 'Automecanik',
      robots: 'index, follow',
      canonical: data.canonical,
      openGraph: {
        type: 'article',
        title,
        description,
        image: data.image?.url || '/images/article-default.jpg',
        url: data.canonical || '',
        siteName: 'Automecanik',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        image: data.image?.url || '/images/article-default.jpg',
      },
      structured: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        image: data.image?.url,
        author: {
          '@type': 'Organization',
          name: data.author || 'Automecanik',
        },
      },
    };
  }

  /**
   * Meta tags pour l'administration
   */
  private buildAdminMetaTags(data: Partial<MetaTagsData>): MetaTagsData {
    return {
      title: data.title || 'Administration - Automecanik',
      description: "Interface d'administration",
      robots: 'noindex, nofollow',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
    };
  }

  /**
   * Meta tags par défaut
   */
  private buildDefaultMetaTags(data: Partial<MetaTagsData>): MetaTagsData {
    return {
      title: data.title || 'Automecanik',
      description: data.description || 'Bienvenue sur Automecanik',
      robots: 'index, follow',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
      language: 'fr',
    };
  }

  /**
   * Meta tags de fallback
   */
  private getFallbackMetaTags(): MetaTagsData {
    return {
      title: 'Automecanik',
      description: 'Boutique en ligne',
      robots: 'index, follow',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
    };
  }

  /**
   * Génère les balises HTML des meta tags
   */
  generateHtmlTags(metaTags: MetaTagsData): string[] {
    const tags: string[] = [];

    // Meta tags basiques
    tags.push(`<title>${metaTags.title}</title>`);
    tags.push(`<meta name="description" content="${metaTags.description}">`);

    if (metaTags.keywords?.length) {
      tags.push(
        `<meta name="keywords" content="${metaTags.keywords.join(', ')}">`,
      );
    }

    if (metaTags.author) {
      tags.push(`<meta name="author" content="${metaTags.author}">`);
    }

    if (metaTags.robots) {
      tags.push(`<meta name="robots" content="${metaTags.robots}">`);
    }

    if (metaTags.canonical) {
      tags.push(`<link rel="canonical" href="${metaTags.canonical}">`);
    }

    if (metaTags.viewport) {
      tags.push(`<meta name="viewport" content="${metaTags.viewport}">`);
    }

    if (metaTags.charset) {
      tags.push(`<meta charset="${metaTags.charset}">`);
    }

    if (metaTags.language) {
      tags.push(
        `<meta http-equiv="content-language" content="${metaTags.language}">`,
      );
    }

    // Open Graph
    if (metaTags.openGraph) {
      const og = metaTags.openGraph;
      tags.push(`<meta property="og:type" content="${og.type}">`);
      tags.push(`<meta property="og:title" content="${og.title}">`);
      tags.push(`<meta property="og:description" content="${og.description}">`);
      tags.push(`<meta property="og:image" content="${og.image}">`);
      tags.push(`<meta property="og:url" content="${og.url}">`);
      tags.push(`<meta property="og:site_name" content="${og.siteName}">`);
      if (og.locale) {
        tags.push(`<meta property="og:locale" content="${og.locale}">`);
      }
    }

    // Twitter
    if (metaTags.twitter) {
      const tw = metaTags.twitter;
      tags.push(`<meta name="twitter:card" content="${tw.card}">`);
      tags.push(`<meta name="twitter:title" content="${tw.title}">`);
      tags.push(
        `<meta name="twitter:description" content="${tw.description}">`,
      );
      tags.push(`<meta name="twitter:image" content="${tw.image}">`);
      if (tw.site) {
        tags.push(`<meta name="twitter:site" content="${tw.site}">`);
      }
      if (tw.creator) {
        tags.push(`<meta name="twitter:creator" content="${tw.creator}">`);
      }
    }

    // Structured Data
    if (metaTags.structured) {
      tags.push(
        `<script type="application/ld+json">${JSON.stringify(metaTags.structured)}</script>`,
      );
    }

    return tags;
  }
}
