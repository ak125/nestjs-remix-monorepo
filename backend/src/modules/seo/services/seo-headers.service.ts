/**
 * 📄 SERVICE HEADERS SEO
 * Génération headers HTTP optimisés SEO
 */

import { Injectable } from '@nestjs/common';

export interface SeoHeaders {
  'X-Robots-Tag'?: string;
  Link?: string;
  'Content-Language'?: string;
  Vary?: string;
  'X-Content-Type-Options'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
  'Cache-Control'?: string;
  'Access-Control-Allow-Origin'?: string;
}

@Injectable()
export class SeoHeadersService {
  /**
   * Headers SEO par défaut
   */
  getDefaultHeaders(): SeoHeaders {
    return {
      'X-Robots-Tag': 'index, follow',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      Vary: 'Accept-Encoding',
    };
  }

  /**
   * Headers pour pages produits
   */
  getProductHeaders(canonical: string): SeoHeaders {
    return {
      ...this.getDefaultHeaders(),
      'X-Robots-Tag': 'index, follow, max-image-preview:large',
      Link: `<${canonical}>; rel="canonical"`,
    };
  }

  /**
   * Headers pour pages blog
   */
  getBlogHeaders(canonical: string): SeoHeaders {
    return {
      ...this.getDefaultHeaders(),
      'X-Robots-Tag': 'index, follow, max-snippet:320',
      Link: `<${canonical}>; rel="canonical"`,
    };
  }

  /**
   * Headers pour pages à ne pas indexer
   */
  getNoIndexHeaders(): SeoHeaders {
    return {
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };
  }

  /**
   * Headers multilingues (hreflang)
   */
  getHreflangHeaders(
    alternates: Array<{ href: string; hreflang: string }>,
  ): SeoHeaders {
    const linkHeader = alternates
      .map(
        (alt) => `<${alt.href}>; rel="alternate"; hreflang="${alt.hreflang}"`,
      )
      .join(', ');

    return {
      ...this.getDefaultHeaders(),
      Link: linkHeader,
      Vary: 'Accept-Language, Accept-Encoding',
    };
  }

  /**
   * Headers pour pagination
   */
  getPaginationHeaders(
    prev?: string,
    next?: string,
    canonical?: string,
  ): SeoHeaders {
    const links: string[] = [];

    if (canonical) {
      links.push(`<${canonical}>; rel="canonical"`);
    }

    if (prev) {
      links.push(`<${prev}>; rel="prev"`);
    }

    if (next) {
      links.push(`<${next}>; rel="next"`);
    }

    return {
      ...this.getDefaultHeaders(),
      Link: links.join(', '),
    };
  }

  /**
   * Headers pour images (CDN)
   */
  getImageHeaders(): SeoHeaders {
    return {
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    };
  }

  /**
   * Headers AMP
   */
  getAmpHeaders(ampUrl: string, canonicalUrl: string): SeoHeaders {
    return {
      ...this.getDefaultHeaders(),
      Link: `<${ampUrl}>; rel="amphtml", <${canonicalUrl}>; rel="canonical"`,
    };
  }

  /**
   * Headers pour ressources statiques
   */
  getStaticHeaders(): SeoHeaders {
    return {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    };
  }

  /**
   * Headers pour API (pas d'indexation)
   */
  getApiHeaders(): SeoHeaders {
    return {
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    };
  }
}
