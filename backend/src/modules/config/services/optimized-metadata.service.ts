import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  alternateLanguages?: Array<{
    lang: string;
    url: string;
  }>;
  h1?: string;
  breadcrumb?: string;
  robots?: string;
  schemaMarkup?: any;
  lastModified?: Date;
}

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
  alternates?: Array<{
    lang: string;
    url: string;
  }>;
}

/**
 * Service de métadonnées amélioré - Utilise uniquement les tables existantes dans Supabase
 * Remplace meta.conf.php et utilise ___meta_tags_ariane
 */
@Injectable()
export class MetadataService extends SupabaseBaseService {
  protected readonly logger = new Logger(MetadataService.name);
  private readonly cachePrefix = 'metadata:';
  private readonly cacheTTL = 1800; // 30 minutes

  constructor(
    configService: NestConfigService,
    private readonly cacheService: CacheService,
  ) {
    super(configService);
  }

  /**
   * Récupérer les métadonnées d'une page - Utilise table existante ___meta_tags_ariane
   * Remplace meta.conf.php
   */
  async getPageMetadata(
    route: string,
    lang: string = 'fr',
  ): Promise<PageMetadata> {
    try {
      const cacheKey = `${this.cachePrefix}page:${route}:${lang}`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'object' && 'title' in cached) {
        this.logger.debug(
          `Métadonnées récupérées depuis le cache pour ${route}`,
        );
        return cached as PageMetadata;
      }

      // Nettoyer le path
      const cleanPath = this.cleanPath(route);

      // Récupérer depuis la table existante ___meta_tags_ariane
      const { data, error } = await this.client
        .from('___meta_tags_ariane')
        .select('*')
        .eq('mta_alias', cleanPath)
        .single();

      if (error && error.code !== 'PGRST116') {
        this.logger.warn(
          `Erreur récupération métadonnées pour ${route}:`,
          error,
        );
        return await this.getDefaultMetadata(route, lang);
      }

      if (!data) {
        this.logger.debug(
          `Aucune métadonnée trouvée pour ${route}, utilisation des défauts`,
        );
        return await this.getDefaultMetadata(route, lang);
      }

      const metadata: PageMetadata = {
        title: data.mta_title || this.getDefaultTitle(),
        description: data.mta_descrip || this.getDefaultDescription(),
        keywords: this.parseKeywords(data.mta_keywords),
        ogTitle: data.mta_title || this.getDefaultTitle(),
        ogDescription: data.mta_descrip || this.getDefaultDescription(),
        ogImage: await this.getDefaultOgImage(),
        canonicalUrl: await this.generateCanonicalUrl(cleanPath),
        h1: data.mta_h1,
        breadcrumb: data.mta_ariane,
        robots: data.mta_relfollow || 'index,follow',
        schemaMarkup: await this.generateSchemaMarkup(cleanPath, data),
        lastModified: new Date(), // Table n'a pas de timestamp, utiliser date actuelle
      };

      // Générer les URLs alternatives
      metadata.alternateLanguages = await this.generateAlternateLanguages(
        route,
      );

      // Mettre en cache
      await this.cacheService.set(cacheKey, metadata, this.cacheTTL);

      return metadata;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des métadonnées pour ${route}`,
        error,
      );
      return this.getFallbackMetadata(route, lang);
    }
  }

  /**
   * Mettre à jour les métadonnées d'une page - Utilise table existante ___meta_tags_ariane
   */
  async updatePageMetadata(
    path: string,
    metadata: Partial<PageMetadata>,
  ): Promise<PageMetadata> {
    try {
      const cleanPath = this.cleanPath(path);
      const mtaId = `seo_${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

      const updateData = {
        mta_id: mtaId,
        mta_alias: cleanPath,
        mta_title: metadata.title,
        mta_descrip: metadata.description,
        mta_keywords: Array.isArray(metadata.keywords)
          ? metadata.keywords.join(', ')
          : metadata.keywords,
        mta_h1: metadata.h1 || metadata.title,
        mta_content: metadata.description,
        mta_ariane: metadata.breadcrumb || '',
        mta_relfollow: metadata.robots || 'index,follow',
      };

      const { error } = await this.client
        .from('___meta_tags_ariane')
        .upsert(updateData);

      if (error) {
        throw error;
      }

      // Invalider le cache
      const cacheKey = `${this.cachePrefix}page:${cleanPath}:fr`;
      await this.cacheService.del(cacheKey);

      this.logger.log(`Métadonnées mises à jour pour ${cleanPath}`);

      // Retourner les métadonnées complètes
      return await this.getPageMetadata(cleanPath);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour des métadonnées pour ${path}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Récupérer les données SEO formatées pour Remix
   */
  async getPageSEO(route: string, lang: string = 'fr'): Promise<any> {
    try {
      const metadata = await this.getPageMetadata(route, lang);

      return {
        title: metadata.title,
        description: metadata.description,
        keywords: metadata.keywords,
        canonical: metadata.canonicalUrl,
        openGraph: {
          title: metadata.ogTitle || metadata.title,
          description: metadata.ogDescription || metadata.description,
          image: metadata.ogImage,
          url: metadata.ogUrl,
        },
        twitter: {
          card: metadata.twitterCard || 'summary_large_image',
          title: metadata.twitterTitle || metadata.title,
          description: metadata.twitterDescription || metadata.description,
          image: metadata.twitterImage,
        },
        robots: metadata.robots || 'index,follow',
        alternateLanguages: metadata.alternateLanguages,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des données SEO pour ${route}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Générer le sitemap XML
   */
  async generateSitemap(lang: string = 'fr'): Promise<SitemapEntry[]> {
    try {
      const cacheKey = `${this.cachePrefix}sitemap:${lang}`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Sitemap récupéré depuis le cache pour ${lang}`);
        return cached as SitemapEntry[];
      }

      const sitemap: SitemapEntry[] = [];
      const baseUrl = await this.getBaseUrl();

      // Récupérer toutes les pages avec métadonnées depuis ___meta_tags_ariane
      const { data: pages } = await this.client
        .from('___meta_tags_ariane')
        .select('mta_alias')
        .not('mta_alias', 'is', null);

      if (pages) {
        for (const page of pages) {
          sitemap.push({
            url: `${baseUrl}${page.mta_alias}`,
            lastModified: new Date(), // Table n'a pas de timestamp
            changeFrequency: 'monthly',
            priority: 0.5,
            alternates: await this.generateAlternateLanguages(page.mta_alias),
          });
        }
      }

      // Ajouter les routes statiques
      const staticRoutes = await this.getStaticRoutes();
      for (const route of staticRoutes) {
        sitemap.push({
          url: `${baseUrl}${route.path}`,
          lastModified: route.lastModified || new Date(),
          changeFrequency: route.changeFrequency || 'monthly',
          priority: route.priority || 0.5,
          alternates: await this.generateAlternateLanguages(route.path),
        });
      }

      // Mettre en cache
      await this.cacheService.set(cacheKey, sitemap, this.cacheTTL);

      return sitemap;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération du sitemap pour ${lang}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Générer le fichier robots.txt
   */
  async generateRobotsTxt(): Promise<string> {
    try {
      const cacheKey = `${this.cachePrefix}robots`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug('Robots.txt récupéré depuis le cache');
        return cached as string;
      }

      const baseUrl = await this.getBaseUrl();
      const robotsConfig = await this.getRobotsConfig();

      let robotsTxt = 'User-agent: *\n';

      // Règles de désallowage
      if (robotsConfig.disallow && robotsConfig.disallow.length > 0) {
        for (const path of robotsConfig.disallow) {
          robotsTxt += `Disallow: ${path}\n`;
        }
      }

      // Règles d'autorisation
      if (robotsConfig.allow && robotsConfig.allow.length > 0) {
        for (const path of robotsConfig.allow) {
          robotsTxt += `Allow: ${path}\n`;
        }
      }

      // Delay de crawl
      if (robotsConfig.crawlDelay) {
        robotsTxt += `Crawl-delay: ${robotsConfig.crawlDelay}\n`;
      }

      // Sitemap
      robotsTxt += `\nSitemap: ${baseUrl}/sitemap.xml\n`;

      // Mettre en cache
      await this.cacheService.set(cacheKey, robotsTxt, this.cacheTTL * 2);

      return robotsTxt;
    } catch (error) {
      this.logger.error('Erreur lors de la génération du robots.txt', error);
      throw error;
    }
  }

  /**
   * Générer les balises meta HTML
   */
  generateMetaTags(metadata: PageMetadata): string {
    const tags = [
      `<title>${this.escapeHtml(metadata.title)}</title>`,
      `<meta name="description" content="${this.escapeHtml(metadata.description)}" />`,
    ];

    if (metadata.keywords?.length) {
      tags.push(
        `<meta name="keywords" content="${this.escapeHtml(metadata.keywords.join(', '))}" />`,
      );
    }

    if (metadata.robots) {
      tags.push(`<meta name="robots" content="${metadata.robots}" />`);
    }

    if (metadata.ogTitle) {
      tags.push(
        `<meta property="og:title" content="${this.escapeHtml(metadata.ogTitle)}" />`,
      );
    }

    if (metadata.ogDescription) {
      tags.push(
        `<meta property="og:description" content="${this.escapeHtml(metadata.ogDescription)}" />`,
      );
    }

    if (metadata.ogImage) {
      tags.push(
        `<meta property="og:image" content="${metadata.ogImage}" />`,
      );
    }

    if (metadata.canonicalUrl) {
      tags.push(`<link rel="canonical" href="${metadata.canonicalUrl}" />`);
    }

    if (metadata.schemaMarkup) {
      tags.push(
        `<script type="application/ld+json">${JSON.stringify(metadata.schemaMarkup)}</script>`,
      );
    }

    return tags.join('\n');
  }

  // === MÉTHODES PRIVÉES === //

  private async getDefaultMetadata(
    route: string,
    lang: string,
  ): Promise<PageMetadata> {
    return {
      title: this.getDefaultTitle(),
      description: this.getDefaultDescription(),
      keywords: [
        'pieces detachees',
        'pieces auto',
        'pieces voiture',
        'pieces automobile',
      ],
      ogTitle: 'Automecanik - Pièces auto pas cher',
      ogDescription: 'Trouvez vos pièces détachées auto au meilleur prix',
      ogImage: await this.getDefaultOgImage(),
      canonicalUrl: await this.generateCanonicalUrl(route),
      robots: 'index,follow',
    };
  }

  private getDefaultTitle(): string {
    return 'Vente pièces détachées auto neuves & à prix pas cher';
  }

  private getDefaultDescription(): string {
    return 'Votre catalogue de pièces détachées automobile neuves et d\'origine pour toutes les marques & modèles de voitures';
  }

  private async getDefaultOgImage(): Promise<string> {
    return 'https://www.automecanik.com/og-image.jpg';
  }

  private async generateCanonicalUrl(route: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    return `${baseUrl}${route}`;
  }

  private async generateAlternateLanguages(
    route: string,
  ): Promise<Array<{ lang: string; url: string }>> {
    const baseUrl = await this.getBaseUrl();
    const supportedLanguages = await this.getSupportedLanguages();

    return supportedLanguages.map((lang) => ({
      lang,
      url: `${baseUrl}/${lang}${route}`,
    }));
  }

  private async getBaseUrl(): Promise<string> {
    // Récupérer depuis la configuration Supabase ou utiliser une valeur par défaut
    return process.env.FRONTEND_URL || 'https://www.automecanik.com';
  }

  private async getSupportedLanguages(): Promise<string[]> {
    return ['fr', 'en'];
  }

  private async getStaticRoutes(): Promise<any[]> {
    return [
      { path: '/', priority: 1.0, changeFrequency: 'daily' },
      { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
      { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    ];
  }

  private async getRobotsConfig(): Promise<any> {
    return {
      disallow: ['/admin', '/api', '/private'],
      allow: ['/api/public'],
      crawlDelay: 1,
    };
  }

  private getFallbackMetadata(route: string, lang: string): PageMetadata {
    return {
      title: 'Page non trouvée | Automecanik',
      description: 'Cette page n\'existe pas ou a été déplacée.',
      robots: 'noindex,nofollow',
    };
  }

  private cleanPath(path: string): string {
    // Nettoyer et normaliser le chemin
    return path
      .replace(/\/+/g, '/') // Supprimer les doubles slashes
      .replace(/\/$/, '') // Supprimer le slash final
      .replace(/^\//g, '') // Supprimer le slash initial
      .split('?')[0] // Supprimer les query params
      .split('#')[0]; // Supprimer les anchors
  }

  private parseKeywords(keywords: string): string[] {
    if (!keywords) return [];
    if (Array.isArray(keywords)) return keywords;
    return keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  private async generateSchemaMarkup(path: string, data: any): Promise<any> {
    // Générer le markup Schema.org basé sur le type de page
    const baseSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: data.mta_title,
      description: data.mta_descrip,
      url: await this.generateCanonicalUrl(path),
    };

    // Ajouter des schémas spécifiques selon le type de page
    if (path.includes('/product/') || path.includes('/piece/')) {
      return {
        ...baseSchema,
        '@type': 'Product',
        category: 'Automotive Parts',
      };
    }

    return baseSchema;
  }
}
