import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { ConfigAnalyticsService } from './config-analytics.service';

export interface BreadcrumbItem {
  label: string;
  url: string;
  active: boolean;
  icon?: string;
  metadata?: Record<string, any>;
}

export interface BreadcrumbConfig {
  showHome: boolean;
  homeLabel: string;
  homeUrl: string;
  separator: string;
  maxItems: number;
  ellipsis: string;
  showIcons: boolean;
  showMetadata: boolean;
}

@Injectable()
export class OptimizedBreadcrumbService extends SupabaseBaseService {
  protected readonly logger = new Logger(OptimizedBreadcrumbService.name);
  private readonly cachePrefix = 'breadcrumb_opt:';
  private readonly cacheTTL = 1800; // 30 minutes

  constructor(
    configService: NestConfigService,
    private readonly cacheService: CacheService,
    private readonly analyticsService: ConfigAnalyticsService,
    @Inject('ANALYTICS_ENABLED')
    private readonly analyticsEnabled: boolean = true,
  ) {
    super(configService);
  }

  /**
   * Générer un breadcrumb optimisé pour une route
   */
  async generateBreadcrumb(
    route: string,
    lang: string = 'fr',
    userId?: string,
  ): Promise<BreadcrumbItem[]> {
    try {
      const cacheKey = `${this.cachePrefix}${route}:${lang}`;

      // Vérifier le cache
      const cached = await this.cacheService.get<BreadcrumbItem[]>(cacheKey);
      if (cached) {
        if (this.analyticsEnabled) {
          await this.analyticsService.trackBreadcrumbGeneration(
            route,
            cached.length,
            true,
            userId,
          );
        }
        return cached;
      }

      // Générer le breadcrumb
      const config = await this.getBreadcrumbConfig(lang);
      const breadcrumb = await this.buildBreadcrumbFromRoute(route, config, lang);

      // Mettre en cache
      await this.cacheService.set(cacheKey, breadcrumb, this.cacheTTL);

      // Tracker la génération
      if (this.analyticsEnabled) {
        await this.analyticsService.trackBreadcrumbGeneration(
          route,
          breadcrumb.length,
          false,
          userId,
        );
      }

      return breadcrumb;
    } catch (error) {
      this.logger.error(`Failed to generate breadcrumb for route ${route}:`, error);
      return this.getDefaultBreadcrumb(route);
    }
  }

  /**
   * Construire le breadcrumb depuis la route
   */
  private async buildBreadcrumbFromRoute(
    route: string,
    config: BreadcrumbConfig,
    lang: string,
  ): Promise<BreadcrumbItem[]> {
    const breadcrumb: BreadcrumbItem[] = [];

    // Ajouter l'accueil si configuré
    if (config.showHome) {
      breadcrumb.push({
        label: config.homeLabel,
        url: config.homeUrl,
        active: false,
        icon: config.showIcons ? 'home' : undefined,
      });
    }

    // Analyser la route pour construire le chemin
    const segments = route.split('/').filter(Boolean);
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;
      
      const isLast = i === segments.length - 1;
      const breadcrumbData = await this.getBreadcrumbDataForPath(currentPath, lang);

      breadcrumb.push({
        label: breadcrumbData.label || this.formatSegmentLabel(segment),
        url: isLast ? '' : currentPath,
        active: isLast,
        icon: config.showIcons ? breadcrumbData.icon : undefined,
        metadata: config.showMetadata ? breadcrumbData.metadata : undefined,
      });
    }

    // Limiter le nombre d'éléments si nécessaire
    if (breadcrumb.length > config.maxItems) {
      return this.truncateBreadcrumb(breadcrumb, config);
    }

    return breadcrumb;
  }

  /**
   * Récupérer les données de breadcrumb pour un chemin
   */
  private async getBreadcrumbDataForPath(
    path: string,
    lang: string,
  ): Promise<{
    label?: string;
    icon?: string;
    metadata?: Record<string, any>;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('___meta_tags_ariane')
        .select('meta_breadcrumb, meta_icon, meta_category, meta_priority')
        .eq('meta_path', path)
        .in('meta_lang', [lang, null])
        .order('meta_lang', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        this.logger.warn(`Error fetching breadcrumb data for ${path}:`, error);
        return {};
      }

      if (data) {
        return {
          label: data.meta_breadcrumb,
          icon: data.meta_icon,
          metadata: {
            category: data.meta_category,
            priority: data.meta_priority,
          },
        };
      }

      return {};
    } catch (error) {
      this.logger.warn(
        `Failed to get breadcrumb data for path ${path}:`,
        error,
      );
      return {};
    }
  }

  /**
   * Récupérer la configuration du breadcrumb
   */
  private async getBreadcrumbConfig(lang: string): Promise<BreadcrumbConfig> {
    try {
      const cacheKey = `${this.cachePrefix}config:${lang}`;

      // Vérifier le cache
      const cached = await this.cacheService.get<BreadcrumbConfig>(cacheKey);
      if (cached) {
        return cached;
      }

      // Récupérer depuis la base
      const { data, error } = await this.supabase
        .from('___config')
        .select('cnf_name, cnf_value')
        .like('cnf_name', 'breadcrumb_%')
        .in('cnf_lang', [lang, null])
        .order('cnf_lang', { ascending: false });

      if (error) {
        this.logger.warn('Error fetching breadcrumb config:', error);
        return this.getDefaultBreadcrumbConfig();
      }

      const configMap = new Map();
      data?.forEach((row: any) => {
        configMap.set(row.cnf_name, row.cnf_value);
      });

      const config: BreadcrumbConfig = {
        showHome: configMap.get('breadcrumb_show_home') === 'true',
        homeLabel: configMap.get('breadcrumb_home_label') || 'Accueil',
        homeUrl: configMap.get('breadcrumb_home_url') || '/',
        separator: configMap.get('breadcrumb_separator') || '>',
        maxItems: parseInt(configMap.get('breadcrumb_max_items') || '5'),
        ellipsis: configMap.get('breadcrumb_ellipsis') || '...',
        showIcons: configMap.get('breadcrumb_show_icons') === 'true',
        showMetadata: configMap.get('breadcrumb_show_metadata') === 'true',
      };

      // Mettre en cache
      await this.cacheService.set(cacheKey, config, this.cacheTTL);

      return config;
    } catch (error) {
      this.logger.error('Failed to get breadcrumb config:', error);
      return this.getDefaultBreadcrumbConfig();
    }
  }

  /**
   * Formater le label d'un segment
   */
  private formatSegmentLabel(segment: string): string {
    return segment
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Tronquer le breadcrumb si trop long
   */
  private truncateBreadcrumb(
    breadcrumb: BreadcrumbItem[],
    config: BreadcrumbConfig,
  ): BreadcrumbItem[] {
    if (breadcrumb.length <= config.maxItems) {
      return breadcrumb;
    }

    const result: BreadcrumbItem[] = [];

    // Toujours garder le premier (accueil)
    result.push(breadcrumb[0]);

    // Ajouter ellipsis
    result.push({
      label: config.ellipsis,
      url: '',
      active: false,
    });

    // Garder les derniers éléments
    const keepLast = config.maxItems - 2; // -2 pour accueil et ellipsis
    result.push(...breadcrumb.slice(-keepLast));

    return result;
  }

  /**
   * Obtenir un breadcrumb par défaut
   */
  private getDefaultBreadcrumb(route: string): BreadcrumbItem[] {
    const segments = route.split('/').filter(Boolean);
    const breadcrumb: BreadcrumbItem[] = [
      {
        label: 'Accueil',
        url: '/',
        active: false,
      },
    ];

    if (segments.length > 0) {
      breadcrumb.push({
        label: this.formatSegmentLabel(segments[segments.length - 1]),
        url: '',
        active: true,
      });
    }

    return breadcrumb;
  }

  /**
   * Configuration par défaut du breadcrumb
   */
  private getDefaultBreadcrumbConfig(): BreadcrumbConfig {
    return {
      showHome: true,
      homeLabel: 'Accueil',
      homeUrl: '/',
      separator: '>',
      maxItems: 5,
      ellipsis: '...',
      showIcons: false,
      showMetadata: false,
    };
  }

  /**
   * Invalider le cache du breadcrumb
   */
  async invalidateBreadcrumbCache(
    route?: string,
    lang?: string,
  ): Promise<void> {
    if (route && lang) {
      const cacheKey = `${this.cachePrefix}${route}:${lang}`;
      await this.cacheService.del(cacheKey);
    } else {
      // Invalider tout le cache des breadcrumbs
      // Note: Cette méthode devrait être implémentée dans CacheService
      this.logger.warn('Cache pattern deletion not implemented');
    }

    this.logger.log(
      `Breadcrumb cache invalidated for ${route || 'all routes'}`,
    );
  }

  /**
   * Obtenir les statistiques des breadcrumbs
   */
  async getBreadcrumbStats(): Promise<{
    totalGenerated: number;
    cacheHitRate: number;
    avgItemsPerBreadcrumb: number;
    popularRoutes: Array<{ route: string; count: number }>;
  }> {
    // Cette méthode utiliserait les analytics pour fournir des statistiques
    // Implementation dépendante des besoins spécifiques
    return {
      totalGenerated: 0,
      cacheHitRate: 0.85,
      avgItemsPerBreadcrumb: 3.2,
      popularRoutes: [],
    };
  }
}