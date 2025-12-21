import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  schemaMarkup?: any;
  h1?: string;
  breadcrumb?: string;
  robots?: string;
  lastModified?: Date;
}

export interface SeoAnalytics {
  totalPages: number;
  pagesWithMetadata: number;
  pagesWithoutMetadata: number;
  completionRate: number;
  recentUpdates: any[];
}

@Injectable()
export class EnhancedMetadataService extends SupabaseBaseService {
  protected readonly logger = new Logger(EnhancedMetadataService.name);
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
   */
  async getPageMetadata(path: string): Promise<PageMetadata> {
    try {
      // Vérifier le cache en premier
      const cacheKey = `${this.cachePrefix}${path}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'object' && 'title' in cached) {
        this.logger.debug(`Cache hit pour ${path}`);
        return cached as PageMetadata;
      }

      // Nettoyer le path (supprimer query params, etc.)
      const cleanPath = this.cleanPath(path);

      // Récupérer depuis la table existante ___meta_tags_ariane
      const { data, error } = await this.client
        .from(TABLES.meta_tags_ariane)
        .select('*')
        .eq('mta_alias', cleanPath)
        .single();

      if (error && error.code !== 'PGRST116') {
        this.logger.warn(
          `Erreur récupération métadonnées pour ${path}:`,
          error,
        );
        return await this.getDefaultMetadata(path);
      }

      if (!data) {
        this.logger.debug(
          `Aucune métadonnée trouvée pour ${path}, utilisation des défauts`,
        );
        return await this.getDefaultMetadata(path);
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
        lastModified: data.updated_at ? new Date(data.updated_at) : new Date(),
      };

      // Mettre en cache
      await this.cacheService.set(cacheKey, metadata, this.cacheTTL);

      return metadata;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des métadonnées pour ${path}:`,
        error,
      );
      return await this.getDefaultMetadata(path);
    }
  }

  /**
   * Mettre à jour les métadonnées d'une page
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
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.client
        .from(TABLES.meta_tags_ariane)
        .upsert(updateData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Invalider le cache
      const cacheKey = `${this.cachePrefix}${cleanPath}`;
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
   * Supprimer les métadonnées d'une page
   */
  async deletePageMetadata(path: string): Promise<void> {
    try {
      const cleanPath = this.cleanPath(path);

      const { error } = await this.client
        .from(TABLES.meta_tags_ariane)
        .delete()
        .eq('mta_alias', cleanPath);

      if (error) {
        throw error;
      }

      // Invalider le cache
      const cacheKey = `${this.cachePrefix}${cleanPath}`;
      await this.cacheService.del(cacheKey);

      this.logger.log(`Métadonnées supprimées pour ${cleanPath}`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression des métadonnées pour ${path}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lister les pages sans métadonnées (pour le SEO)
   */
  async getPagesWithoutMetadata(
    limit: number = 100,
  ): Promise<{ pages: string[]; count: number; timestamp: string }> {
    try {
      // Cette méthode nécessiterait une table des pages existantes
      // Pour l'instant, on peut utiliser les logs d'erreur pour identifier les pages populaires sans SEO
      const { data: errorLogs, error } = await this.client
        .from('error_logs')
        .select('url')
        .eq('status_code', 200)
        .is('metadata_found', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.warn('Erreur récupération pages sans métadonnées:', error);
        return { pages: [], count: 0, timestamp: new Date().toISOString() };
      }

      const uniquePages = Array.from(
        new Set((errorLogs || []).map((log) => log.url)),
      );

      return {
        pages: uniquePages,
        count: uniquePages.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des pages sans métadonnées:',
        error,
      );
      return { pages: [], count: 0, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Analytics SEO - Statistiques sur les métadonnées
   */
  async getSeoAnalytics(): Promise<SeoAnalytics> {
    try {
      // Compter le total de pages avec métadonnées
      const { count: totalWithMetadata, error: countError } = await this.client
        .from(TABLES.meta_tags_ariane)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw countError;
      }

      // Récupérer les mises à jour récentes
      const { data: recentUpdates, error: updatesError } = await this.client
        .from(TABLES.meta_tags_ariane)
        .select('mta_alias, mta_title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (updatesError) {
        this.logger.warn(
          'Erreur récupération mises à jour récentes:',
          updatesError,
        );
      }

      // Estimation du total de pages (basé sur les logs ou autres tables)
      const estimatedTotalPages = await this.estimateTotalPages();

      const pagesWithMetadata = totalWithMetadata || 0;
      const pagesWithoutMetadata = Math.max(
        0,
        estimatedTotalPages - pagesWithMetadata,
      );
      const completionRate =
        estimatedTotalPages > 0
          ? (pagesWithMetadata / estimatedTotalPages) * 100
          : 0;

      return {
        totalPages: estimatedTotalPages,
        pagesWithMetadata,
        pagesWithoutMetadata,
        completionRate: Math.round(completionRate * 100) / 100,
        recentUpdates: recentUpdates || [],
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des analytics SEO:',
        error,
      );
      return {
        totalPages: 0,
        pagesWithMetadata: 0,
        pagesWithoutMetadata: 0,
        completionRate: 0,
        recentUpdates: [],
      };
    }
  }

  /**
   * Générer le rendu HTML des balises meta
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
      tags.push(`<meta property="og:image" content="${metadata.ogImage}" />`);
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

  /**
   * Métadonnées par défaut
   */
  private async getDefaultMetadata(path?: string): Promise<PageMetadata> {
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
      canonicalUrl: path ? await this.generateCanonicalUrl(path) : undefined,
      robots: 'index,follow',
    };
  }

  private getDefaultTitle(): string {
    return 'Vente pièces détachées auto neuves & à prix pas cher';
  }

  private getDefaultDescription(): string {
    return "Votre catalogue de pièces détachées automobile neuves et d'origine pour toutes les marques & modèles de voitures";
  }

  private async getDefaultOgImage(): Promise<string> {
    return 'https://www.automecanik.com/og-image.jpg';
  }

  private async generateCanonicalUrl(path: string): Promise<string> {
    const baseUrl = process.env.SITE_BASE_URL || 'https://www.automecanik.com';
    return `${baseUrl}${path}`;
  }

  private async generateSchemaMarkup(path: string, data: any): Promise<any> {
    // Générer un schema.org basique
    const baseUrl = process.env.SITE_BASE_URL || 'https://www.automecanik.com';

    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: data.mta_title || this.getDefaultTitle(),
      description: data.mta_descrip || this.getDefaultDescription(),
      url: `${baseUrl}${path}`,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: this.parseBreadcrumb(data.mta_ariane || '', path),
      },
    };
  }

  private cleanPath(path: string): string {
    // Supprimer les query params et normaliser
    return path.split('?')[0].toLowerCase();
  }

  private parseKeywords(keywords: string | null): string[] {
    if (!keywords) return [];
    if (typeof keywords === 'string') {
      return keywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    }
    return [];
  }

  private parseBreadcrumb(breadcrumb: string, path: string): any[] {
    if (!breadcrumb) return [];

    const baseUrl = process.env.SITE_BASE_URL || 'https://www.automecanik.com';
    const items = breadcrumb.split(' > ').filter((item) => item.trim());

    // Extract path segments (excluding file extension)
    const cleanPath = path.replace(/\.html$/, '');
    const pathSegments = cleanPath.split('/').filter((seg) => seg);

    return items.map((item, index) => {
      const listItem: any = {
        '@type': 'ListItem',
        position: index + 1,
        name: item.trim(),
      };

      // Build URL from path segments
      // index 0 (Accueil) → home "/"
      // index 1..n-2 → progressive path segments
      // last item → current page (no 'item' needed per Schema.org spec)
      if (index === 0) {
        listItem.item = baseUrl + '/';
      } else if (index < items.length - 1) {
        // Map breadcrumb index to path: index 1 → slice(0,1), index 2 → slice(0,2), etc.
        const urlPath = '/' + pathSegments.slice(0, index).join('/');
        listItem.item = baseUrl + urlPath;
      }
      // Last item: no 'item' property (it's the current page URL)

      return listItem;
    });
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async estimateTotalPages(): Promise<number> {
    try {
      // Estimation basée sur différentes sources
      const sources = await Promise.allSettled([
        this.client
          .from(TABLES.pieces)
          .select('*', { count: 'exact', head: true }),
        // Utiliser auto_type pour compter les types de véhicules
        this.client
          .from(TABLES.auto_type)
          .select('*', { count: 'exact', head: true }),
        this.client
          .from(TABLES.auto_marque)
          .select('*', { count: 'exact', head: true }),
      ]);

      let total = 100; // Pages statiques de base

      sources.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.count) {
          total += result.value.count;
        }
      });

      return total;
    } catch (error) {
      this.logger.warn('Erreur estimation total pages:', error);
      return 1000; // Estimation conservative
    }
  }
}
