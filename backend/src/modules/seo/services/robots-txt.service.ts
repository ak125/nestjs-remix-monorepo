/**
 * 🤖 SERVICE ROBOTS.TXT DYNAMIQUE
 * Génération intelligente selon environnement
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RobotsTxtService {
  private readonly logger = new Logger(RobotsTxtService.name);
  private readonly isProduction: boolean;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
    this.baseUrl = this.configService.get(
      'BASE_URL',
      'https://automecanik.com',
    );

    this.logger.log(
      `🤖 RobotsTxtService initialized (${this.isProduction ? 'PRODUCTION' : 'DEV'})`,
    );
  }

  /**
   * Générer robots.txt selon environnement
   */
  generate(): string {
    if (this.isProduction) {
      return this.generateProduction();
    }

    return this.generateDevelopment();
  }

  /**
   * Robots.txt PRODUCTION - Autoriser crawl
   */
  private generateProduction(): string {
    return `# Robots.txt Production - AutoMecanik.com
# Generated: ${new Date().toISOString()}

# 🌍 All crawlers (default)
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /checkout/
Disallow: /panier/
Disallow: /compte/
Disallow: /search?*
Disallow: /*?utm_*
Disallow: /*?fbclid=*
Disallow: /*?gclid=*
Crawl-delay: 1

# 🤖 Googlebot (prioritaire)
User-agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /checkout/
Disallow: /panier/
Disallow: /compte/
Crawl-delay: 0.5

# 🖼️ Googlebot-Image
User-agent: Googlebot-Image
Allow: /
Allow: /images/
Allow: /uploads/
Disallow: /api/

# 📱 Googlebot-Mobile
User-agent: Googlebot-Mobile
Allow: /
Disallow: /api/
Disallow: /admin/
Crawl-delay: 0.5

# 🛒 Shopping bots
User-agent: Googlebot-Shopping
Allow: /pieces/
Allow: /produits/
Allow: /categories/
Disallow: /api/

# 🔍 Bing
User-agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /admin/
Crawl-delay: 1

# 🦆 DuckDuckGo
User-agent: DuckDuckBot
Allow: /
Disallow: /api/
Disallow: /admin/
Crawl-delay: 1

# 📊 Yandex
User-agent: YandexBot
Allow: /
Disallow: /api/
Disallow: /admin/
Crawl-delay: 2

# 🌐 Baidu
User-agent: Baiduspider
Allow: /
Disallow: /api/
Disallow: /admin/
Crawl-delay: 2

# 🚫 Bad bots (bloquer)
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: BLEXBot
Disallow: /

# 📍 Sitemaps
Sitemap: ${this.baseUrl}/sitemap.xml
Sitemap: ${this.baseUrl}/sitemap-v2/index.xml
Sitemap: ${this.baseUrl}/sitemap-blog.xml
Sitemap: ${this.baseUrl}/sitemap-pages.xml
Sitemap: ${this.baseUrl}/sitemap-conseils.xml

# 🌍 Sitemaps multilingues
Sitemap: ${this.baseUrl}/sitemap-fr.xml
Sitemap: https://be.automecanik.com/sitemap-be.xml
Sitemap: https://uk.automecanik.com/sitemap-uk.xml
Sitemap: https://de.automecanik.com/sitemap-de.xml
Sitemap: https://es.automecanik.com/sitemap-es.xml
Sitemap: https://it.automecanik.com/sitemap-it.xml

# ℹ️ Info
# Contact: seo@automecanik.com
# Last updated: ${new Date().toISOString()}
`;
  }

  /**
   * Robots.txt DEVELOPMENT - Bloquer tout
   */
  private generateDevelopment(): string {
    return `# Robots.txt Development - DO NOT INDEX
# Generated: ${new Date().toISOString()}

# 🚫 Block all crawlers in development
User-agent: *
Disallow: /

# ℹ️ This is a development/staging environment
# Contact: dev@automecanik.com
`;
  }

  /**
   * Générer meta robots tag
   */
  generateMetaRobots(options: {
    index?: boolean;
    follow?: boolean;
    noarchive?: boolean;
    nosnippet?: boolean;
    noimageindex?: boolean;
  }): string {
    const directives: string[] = [];

    // Index/Noindex
    directives.push(options.index !== false ? 'index' : 'noindex');

    // Follow/Nofollow
    directives.push(options.follow !== false ? 'follow' : 'nofollow');

    // Autres directives
    if (options.noarchive) directives.push('noarchive');
    if (options.nosnippet) directives.push('nosnippet');
    if (options.noimageindex) directives.push('noimageindex');

    return directives.join(', ');
  }

  /**
   * Vérifier si URL doit être indexée
   */
  shouldIndex(path: string): boolean {
    // Patterns à ne PAS indexer
    const noIndexPatterns = [
      /^\/api\//,
      /^\/admin\//,
      /^\/checkout\//,
      /^\/panier\//,
      /^\/compte\//,
      /\?utm_/,
      /\?fbclid=/,
      /\?gclid=/,
      /\/search\?/,
    ];

    return !noIndexPatterns.some((pattern) => pattern.test(path));
  }
}
