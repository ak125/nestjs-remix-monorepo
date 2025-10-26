/**
 * 🔒 SECURITY HEADERS SERVICE
 * Headers de sécurité et SEO optimisés
 */

import { Injectable } from '@nestjs/common';

export interface SecurityHeaders {
  // Security
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Content-Security-Policy'?: string;

  // SEO
  'X-Robots-Tag'?: string;
  Link?: string;
}

@Injectable()
export class SecurityHeadersService {
  /**
   * Headers de sécurité standards
   */
  getSecurityHeaders(): SecurityHeaders {
    return {
      // Empêcher MIME type sniffing
      'X-Content-Type-Options': 'nosniff',

      // Empêcher iframe embedding (clickjacking)
      'X-Frame-Options': 'SAMEORIGIN',

      // Protection XSS (legacy, pour vieux navigateurs)
      'X-XSS-Protection': '1; mode=block',

      // Politique referrer
      'Referrer-Policy': 'strict-origin-when-cross-origin',

      // Permissions API
      'Permissions-Policy':
        'geolocation=(), microphone=(), camera=(), payment=()',
    };
  }

  /**
   * CSP (Content Security Policy) strict
   */
  getCSPHeader(nonce?: string): string {
    const directives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${nonce ? `'nonce-${nonce}'` : ''} https://www.googletagmanager.com https://www.google-analytics.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://www.google-analytics.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ];

    return directives.join('; ');
  }

  /**
   * Headers SEO pour pages indexables
   */
  getIndexableHeaders(): SecurityHeaders {
    return {
      ...this.getSecurityHeaders(),
      'X-Robots-Tag': 'index, follow, max-image-preview:large',
    };
  }

  /**
   * Headers SEO pour pages NON indexables
   */
  getNoIndexHeaders(): SecurityHeaders {
    return {
      ...this.getSecurityHeaders(),
      'X-Robots-Tag': 'noindex, nofollow',
    };
  }

  /**
   * Headers avec canonical
   */
  getCanonicalHeaders(canonicalUrl: string): SecurityHeaders {
    return {
      ...this.getIndexableHeaders(),
      Link: `<${canonicalUrl}>; rel="canonical"`,
    };
  }

  /**
   * Headers pour sitemaps XML
   */
  getSitemapHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      Vary: 'Accept-Encoding',
    };
  }

  /**
   * Headers pour robots.txt
   */
  getRobotsTxtHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400',
    };
  }

  /**
   * Headers CORS pour API publique
   */
  getCORSHeaders(origin?: string): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }

  /**
   * Headers cache pour assets statiques
   */
  getStaticAssetHeaders(): Record<string, string> {
    return {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    };
  }

  /**
   * Headers cache pour pages dynamiques
   */
  getDynamicPageHeaders(): Record<string, string> {
    return {
      'Cache-Control':
        'public, max-age=3600, stale-while-revalidate=86400, must-revalidate',
      Vary: 'Accept-Encoding, Cookie',
    };
  }
}
