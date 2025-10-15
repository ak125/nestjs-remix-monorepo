import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { SupabaseBaseService } from '../../supabase/supabase-base.service';

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

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);
  private readonly cachePrefix = 'metadata:';
  private readonly cacheTTL = 1800; // 30 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly dbConfigService: DatabaseConfigService,
    private readonly cacheService: CacheService,
  ) {}

  async getPageMetadata(
    route: string,
    lang: string = 'fr',
  ): Promise<PageMetadata> {
    try {
      const cacheKey = `${this.cachePrefix}page:${route}:${lang}`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(
          `Métadonnées récupérées depuis le cache pour ${route}`,
        );
        return cached as PageMetadata;
      }

      // Récupérer les métadonnées par défaut
      const defaultMetadata = await this.getDefaultMetadata(lang);

      // Récupérer les métadonnées spécifiques à la route
      const routeMetadata = await this.getRouteSpecificMetadata(route, lang);

      // Fusionner les métadonnées
      const metadata: PageMetadata = {
        ...defaultMetadata,
        ...routeMetadata,
      };

      // Générer les URLs canoniques et alternatives
      metadata.canonical = await this.generateCanonicalUrl(route);
      metadata.alternateLanguages =
        await this.generateAlternateLanguages(route);

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

  async getPageSEO(route: string, lang: string = 'fr'): Promise<any> {
    try {
      const metadata = await this.getPageMetadata(route, lang);

      return {
        title: metadata.title,
        description: metadata.description,
        keywords: metadata.keywords,
        canonical: metadata.canonical,
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

      // Routes statiques
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

      // Routes dynamiques (produits, articles, etc.)
      const dynamicRoutes = await this.getDynamicRoutes(lang);
      sitemap.push(...dynamicRoutes);

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

  private async getDefaultMetadata(
    lang: string,
  ): Promise<Partial<PageMetadata>> {
    const siteTitle = (await this.dbConfigService.getConfig(
      `site.title.${lang}`,
    )) ||
      (await this.dbConfigService.getConfig('site.title')) || {
        value: 'Mon Site',
      };

    const siteDescription = (await this.dbConfigService.getConfig(
      `site.description.${lang}`,
    )) ||
      (await this.dbConfigService.getConfig('site.description')) || {
        value: 'Description par défaut',
      };

    const siteKeywords = (await this.dbConfigService.getConfig(
      `site.keywords.${lang}`,
    )) ||
      (await this.dbConfigService.getConfig('site.keywords')) || { value: [] };

    return {
      title: siteTitle.value,
      description: siteDescription.value,
      keywords: Array.isArray(siteKeywords.value) ? siteKeywords.value : [],
      robots: 'index,follow',
    };
  }

  private async getRouteSpecificMetadata(
    route: string,
    lang: string,
  ): Promise<Partial<PageMetadata>> {
    try {
      const routeKey = route.replace(/\//g, '.');
      const metadataConfig =
        (await this.dbConfigService.getConfig(
          `metadata.${routeKey}.${lang}`,
        )) || (await this.dbConfigService.getConfig(`metadata.${routeKey}`));

      if (metadataConfig && metadataConfig.value) {
        return typeof metadataConfig.value === 'string'
          ? JSON.parse(metadataConfig.value)
          : metadataConfig.value;
      }

      return {};
    } catch (error) {
      this.logger.warn(
        `Impossible de récupérer les métadonnées pour ${route}`,
        error,
      );
      return {};
    }
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
    const config = await this.dbConfigService.getConfig('site.baseUrl');
    return config?.value || 'https://example.com';
  }

  private async getSupportedLanguages(): Promise<string[]> {
    const config = await this.dbConfigService.getConfig('site.languages');
    return config?.value || ['fr', 'en'];
  }

  private async getStaticRoutes(): Promise<any[]> {
    const config = await this.dbConfigService.getConfig('sitemap.staticRoutes');
    return (
      config?.value || [
        { path: '/', priority: 1.0, changeFrequency: 'daily' },
        { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
        { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
      ]
    );
  }

  private async getDynamicRoutes(lang: string): Promise<SitemapEntry[]> {
    // Ici, vous devriez récupérer les routes dynamiques depuis votre base de données
    // Par exemple, les produits, articles de blog, etc.
    return [];
  }

  private async getRobotsConfig(): Promise<any> {
    const config = await this.dbConfigService.getConfig('seo.robots');
    return (
      config?.value || {
        disallow: ['/admin', '/api', '/private'],
        allow: ['/api/public'],
        crawlDelay: 1,
      }
    );
  }

  private getFallbackMetadata(route: string, lang: string): PageMetadata {
    return {
      title: 'Page non trouvée',
      description: "Cette page n'existe pas ou a été déplacée.",
      robots: 'noindex,nofollow',
    };
  }
}
