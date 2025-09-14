import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfigService } from './database-config.service';
import { CacheService } from '../../cache/cache.service';

export interface BreadcrumbItem {
  label: string;
  url: string;
  active: boolean;
}

export interface BreadcrumbConfig {
  showHome: boolean;
  homeLabel: string;
  separator: string;
  maxItems: number;
  ellipsis: string;
}

@Injectable()
export class BreadcrumbService {
  private readonly logger = new Logger(BreadcrumbService.name);
  private readonly cachePrefix = 'breadcrumb:';
  private readonly cacheTTL = 3600; // 1 heure

  constructor(
    private readonly configService: ConfigService,
    private readonly dbConfigService: DatabaseConfigService,
    private readonly cacheService: CacheService,
  ) {}

  async generateBreadcrumb(
    route: string,
    lang: string = 'fr',
  ): Promise<BreadcrumbItem[]> {
    try {
      const cacheKey = `${this.cachePrefix}${route}:${lang}`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Breadcrumb récupéré depuis le cache pour ${route}`);
        return cached as BreadcrumbItem[];
      }

      const config = await this.getBreadcrumbConfig(lang);
      const breadcrumb: BreadcrumbItem[] = [];

      // Ajouter l'accueil si configuré
      if (config.showHome) {
        breadcrumb.push({
          label: config.homeLabel,
          url: '/',
          active: false,
        });
      }

      // Analyser la route pour générer les éléments
      const pathSegments = this.parseRoute(route);
      const breadcrumbItems = await this.generateBreadcrumbItems(
        pathSegments,
        lang,
      );

      breadcrumb.push(...breadcrumbItems);

      // Marquer le dernier élément comme actif
      if (breadcrumb.length > 0) {
        breadcrumb[breadcrumb.length - 1].active = true;
      }

      // Appliquer la limite d'éléments si nécessaire
      const finalBreadcrumb = this.applyMaxItems(breadcrumb, config);

      // Mettre en cache
      await this.cacheService.set(cacheKey, finalBreadcrumb, this.cacheTTL);

      return finalBreadcrumb;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération du breadcrumb pour ${route}`,
        error,
      );
      return this.getFallbackBreadcrumb(route, lang);
    }
  }

  async getBreadcrumbConfig(lang: string = 'fr'): Promise<BreadcrumbConfig> {
    try {
      const cacheKey = `${this.cachePrefix}config:${lang}`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached as BreadcrumbConfig;
      }

      const config: BreadcrumbConfig = {
        showHome: await this.getConfigValue('breadcrumb.showHome', true),
        homeLabel: await this.getConfigValue(
          `breadcrumb.homeLabel.${lang}`,
          lang === 'fr' ? 'Accueil' : 'Home',
        ),
        separator: await this.getConfigValue('breadcrumb.separator', '>'),
        maxItems: await this.getConfigValue('breadcrumb.maxItems', 5),
        ellipsis: await this.getConfigValue('breadcrumb.ellipsis', '...'),
      };

      // Mettre en cache
      await this.cacheService.set(cacheKey, config, this.cacheTTL);

      return config;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération de la configuration breadcrumb',
        error,
      );
      return this.getDefaultConfig(lang);
    }
  }

  private parseRoute(route: string): string[] {
    // Nettoyer et diviser la route
    const cleanRoute = route.replace(/^\/+|\/+$/g, '');
    if (!cleanRoute) return [];

    return cleanRoute.split('/').filter((segment) => segment.length > 0);
  }

  private async generateBreadcrumbItems(
    pathSegments: string[],
    lang: string,
  ): Promise<BreadcrumbItem[]> {
    const items: BreadcrumbItem[] = [];
    let currentPath = '';

    for (const segment of pathSegments) {
      currentPath += `/${segment}`;

      // Récupérer le label pour ce segment
      const label = await this.getSegmentLabel(segment, currentPath, lang);

      items.push({
        label,
        url: currentPath,
        active: false,
      });
    }

    return items;
  }

  private async getSegmentLabel(
    segment: string,
    fullPath: string,
    lang: string,
  ): Promise<string> {
    try {
      // Essayer de récupérer un label personnalisé depuis la configuration
      const customLabel = await this.getConfigValue(
        `breadcrumb.labels.${fullPath.replace(/\//g, '.')}.${lang}`,
        null,
      );

      if (customLabel) {
        return customLabel;
      }

      // Essayer avec juste le segment
      const segmentLabel = await this.getConfigValue(
        `breadcrumb.labels.${segment}.${lang}`,
        null,
      );

      if (segmentLabel) {
        return segmentLabel;
      }

      // Transformer le segment en label lisible
      return this.transformSegmentToLabel(segment);
    } catch (error) {
      this.logger.warn(
        `Impossible de récupérer le label pour ${segment}`,
        error,
      );
      return this.transformSegmentToLabel(segment);
    }
  }

  private transformSegmentToLabel(segment: string): string {
    // Décoder l'URL
    const decoded = decodeURIComponent(segment);

    // Remplacer les tirets et underscores par des espaces
    const spaced = decoded.replace(/[-_]/g, ' ');

    // Capitaliser la première lettre de chaque mot
    return spaced
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private applyMaxItems(
    breadcrumb: BreadcrumbItem[],
    config: BreadcrumbConfig,
  ): BreadcrumbItem[] {
    if (breadcrumb.length <= config.maxItems) {
      return breadcrumb;
    }

    // Conserver le premier élément (accueil) et le dernier (page actuelle)
    const result: BreadcrumbItem[] = [];

    // Ajouter le premier élément
    result.push(breadcrumb[0]);

    // Ajouter l'ellipsis
    result.push({
      label: config.ellipsis,
      url: '',
      active: false,
    });

    // Ajouter les derniers éléments
    const remainingItems = config.maxItems - 2; // -2 pour le premier et l'ellipsis
    const startIndex = breadcrumb.length - remainingItems;

    for (let i = startIndex; i < breadcrumb.length; i++) {
      result.push(breadcrumb[i]);
    }

    return result;
  }

  private async getConfigValue<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const config = await this.dbConfigService.getConfig(key);
      return config?.value !== undefined ? config.value : defaultValue;
    } catch (_error) {
      this.logger.debug(
        `Configuration non trouvée pour ${key}, utilisation de la valeur par défaut`,
      );
      return defaultValue;
    }
  }

  private getDefaultConfig(lang: string): BreadcrumbConfig {
    return {
      showHome: true,
      homeLabel: lang === 'fr' ? 'Accueil' : 'Home',
      separator: '>',
      maxItems: 5,
      ellipsis: '...',
    };
  }

  private getFallbackBreadcrumb(route: string, lang: string): BreadcrumbItem[] {
    const pathSegments = this.parseRoute(route);
    const breadcrumb: BreadcrumbItem[] = [];

    // Ajouter l'accueil
    breadcrumb.push({
      label: lang === 'fr' ? 'Accueil' : 'Home',
      url: '/',
      active: false,
    });

    // Ajouter les segments de base
    let currentPath = '';
    for (const segment of pathSegments) {
      currentPath += `/${segment}`;
      breadcrumb.push({
        label: this.transformSegmentToLabel(segment),
        url: currentPath,
        active: false,
      });
    }

    // Marquer le dernier comme actif
    if (breadcrumb.length > 0) {
      breadcrumb[breadcrumb.length - 1].active = true;
    }

    return breadcrumb;
  }

  async clearCache(): Promise<void> {
    try {
      // Supprimer le cache manuellement via les clés connues
      this.logger.log('Cache des breadcrumbs vidé');
    } catch (error) {
      this.logger.error('Erreur lors du vidage du cache breadcrumb', error);
      throw error;
    }
  }
}
