/**
 * 🤖 SERVICE ROBOTS.TXT DYNAMIQUE
 * Génération intelligente selon environnement
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SITE_ORIGIN } from '../../../config/app.config';

@Injectable()
export class RobotsTxtService {
  private readonly logger = new Logger(RobotsTxtService.name);
  private readonly isProduction: boolean;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
    this.baseUrl = this.configService.get('BASE_URL', SITE_ORIGIN);

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
   * 🤖 Robots.txt PRODUCTION - Aligné avec l'ancien système PHP
   *
   * Règles PHP originales:
   * - Disallow: /_form.get.car.* (formulaires AJAX)
   * - Disallow: /fiche/ (fiches produits - duplicate content)
   * - Disallow: /find/ (recherche générale)
   * - Disallow: /searchmine/ (recherche par type mine)
   * - Disallow: /account/ (espace client privé)
   *
   * ✅ Ce qui N'EST PAS bloqué (stratégie positive):
   * - /constructeurs/ → Indexé (sitemap constructeurs)
   * - /pieces/ → Indexé (sitemap gammes produits)
   * - /blog-pieces-auto/ → Indexé (sitemap blog)
   * - / → Indexé (homepage)
   */
  private generateProduction(): string {
    return `# ===========================================
# 🤖 ROBOTS.TXT PRODUCTION - AutoMecanik.com
# ===========================================
# Migré depuis PHP le ${new Date().toISOString().split('T')[0]}
# Structure alignée sur l'ancien système
# ===========================================

# 🌍 Règles par défaut (tous les crawlers)
User-agent: *
Allow: /

# ❌ Blocages hérités du système PHP
Disallow: /_form.get.car.*    # Formulaires AJAX sélection véhicule
Disallow: /fiche/              # Fiches produits (duplicate avec /pieces/)
Disallow: /find/               # Résultats recherche générale
Disallow: /searchmine/         # Recherche par type mine
Disallow: /account/            # Espace client privé

# ❌ Blocages additionnels NestJS
Disallow: /api/                # Endpoints API REST
Disallow: /admin/              # Backoffice administration
Disallow: /checkout/           # Processus de commande
Disallow: /cart/               # Panier d'achat
Disallow: /private/            # Ressources privées
Disallow: /imgproxy/           # Transformations d'images (pas du contenu indexable)
Disallow: /img/                # Proxy images brutes

# ❌ Paramètres de tracking (éviter duplicate content)
Disallow: /*?utm_*
Disallow: /*?fbclid=*
Disallow: /*?gclid=*
Disallow: /search?*

# ⏱️ Crawl-delay recommandé
Crawl-delay: 1

# 🤖 Googlebot (prioritaire, sans délai)
User-agent: Googlebot
Allow: /
Disallow: /_form.get.car.*
Disallow: /fiche/
Disallow: /find/
Disallow: /searchmine/
Disallow: /account/
Disallow: /api/
Disallow: /admin/
Disallow: /imgproxy/
Disallow: /img/
Crawl-delay: 0.5

# 🖼️ Googlebot-Image (autorisé sur /images/)
User-agent: Googlebot-Image
Allow: /
Allow: /images/
Allow: /uploads/
Disallow: /api/

# 🛒 Googlebot-Shopping (e-commerce)
User-agent: Googlebot-Shopping
Allow: /pieces/
Allow: /constructeurs/
Disallow: /api/
Disallow: /fiche/

# 🔍 Bingbot
User-agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /fiche/
Crawl-delay: 1

# 🚫 Bad bots SEO (bloquer complètement)
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

User-agent: DataForSeoBot
Disallow: /

User-agent: serpstatbot
Disallow: /

User-agent: SEOkicks
Disallow: /

# 🇨🇳 Bots chinois agressifs
User-agent: Baiduspider
Disallow: /

User-agent: Baiduspider-image
Disallow: /

User-agent: Baiduspider-video
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Sogou
Disallow: /

User-agent: sogou spider
Disallow: /

User-agent: YisouSpider
Disallow: /

User-agent: PetalBot
Disallow: /

User-agent: EtaoSpider
Disallow: /

# 🇷🇺 Bots russes
User-agent: YandexBot
Disallow: /

User-agent: YandexImages
Disallow: /

User-agent: YandexMedia
Disallow: /

User-agent: Mail.RU_Bot
Disallow: /

# 🤖 Bots IA / LLM (scraping pour entraînement)
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: Bytedance
Disallow: /

User-agent: Omgilibot
Disallow: /

User-agent: Cohere-ai
Disallow: /

# 🕷️ Scrapers et bots malveillants
User-agent: Scrapy
Disallow: /

User-agent: python-requests
Disallow: /

User-agent: Go-http-client
Disallow: /

User-agent: Java
Disallow: /

User-agent: libwww-perl
Disallow: /

User-agent: Wget
Disallow: /

User-agent: curl
Disallow: /

User-agent: HTTrack
Disallow: /

User-agent: WebCopier
Disallow: /

User-agent: TurnitinBot
Disallow: /

User-agent: Nutch
Disallow: /

User-agent: ZoominfoBot
Disallow: /

User-agent: archive.org_bot
Disallow: /

User-agent: ia_archiver
Disallow: /

# ===========================================
# 📍 SITEMAPS
# ===========================================
# Index principal unique (contient tous les sitemaps thématiques)
# V6: sitemap-vehicules.xml inclut marques + modèles + types
Sitemap: ${this.baseUrl}/sitemap.xml

# ===========================================
# ℹ️ INFORMATIONS
# ===========================================
# Contact SEO: seo@automecanik.com
# Dernière mise à jour: ${new Date().toISOString().split('T')[0]}
# ===========================================
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
      /^\/cart\//,
      /^\/compte\//,
      /\?utm_/,
      /\?fbclid=/,
      /\?gclid=/,
      /\/search\?/,
    ];

    return !noIndexPatterns.some((pattern) => pattern.test(path));
  }
}
