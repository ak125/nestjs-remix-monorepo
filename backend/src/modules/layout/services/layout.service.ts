import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { NavigationService } from '../../navigation/navigation.service';
import { HeaderService } from './header.service';
import { FooterService } from './footer.service';
import { QuickSearchService } from './quick-search.service';
import { SocialShareService } from './social-share.service';
import { MetaTagsService } from './meta-tags.service';

export interface LayoutConfig {
  theme: 'admin' | 'commercial' | 'public';
  showHeader: boolean;
  showFooter: boolean;
  showSidebar: boolean;
  showQuickSearch: boolean;
  customCss?: string;
  metadata?: Record<string, any>;
}

export interface LayoutData {
  header: any;
  footer: any;
  navigation: any;
  quickSearch: any;
  socialShare: any;
  metaTags: any;
  config: LayoutConfig;
}

@Injectable()
export class LayoutService {
  private readonly logger = new Logger(LayoutService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly navigationService: NavigationService,
    private readonly headerService: HeaderService,
    private readonly footerService: FooterService,
    private readonly quickSearchService: QuickSearchService,
    private readonly socialShareService: SocialShareService,
    private readonly metaTagsService: MetaTagsService,
  ) {}

  /**
   * Génère la configuration layout complète pour un contexte donné
   */
  async getLayoutData(
    context: 'admin' | 'commercial' | 'public',
    userId?: string,
    options: Partial<LayoutConfig> = {},
  ): Promise<LayoutData> {
    try {
      const cacheKey = `layout:${context}:${userId || 'anonymous'}`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Layout ${context} servi depuis le cache`);
        return cached as LayoutData;
      }

      // Configuration par défaut selon le contexte
      const defaultConfig = this.getDefaultConfig(context);
      const config = { ...defaultConfig, ...options };

      // Charger tous les composants du layout en parallèle pour optimiser les performances
      const [header, footer, navigation, quickSearch, socialShare, metaTags] =
        await Promise.all([
          this.headerService.getHeader(context, userId),
          this.footerService.getFooter(context),
          this.navigationService.getMainNavigation(
            context === 'public' ? 'user' : context,
          ),
          this.quickSearchService.getSearchData(context),
          this.getSocialShareConfig(context),
          this.getMetaTags(context),
        ]);

      const layoutData: LayoutData = {
        header,
        footer,
        navigation,
        quickSearch,
        socialShare,
        metaTags,
        config,
      };

      // Mettre en cache pour 30 minutes
      await this.cacheService.set(cacheKey, layoutData, 1800);

      this.logger.log(`Layout ${context} généré et mis en cache`);
      return layoutData;
    } catch (error) {
      this.logger.error(`Erreur génération layout ${context}:`, error);
      return this.getFallbackLayout(context);
    }
  }

  /**
   * Configuration par défaut selon le contexte
   */
  private getDefaultConfig(context: string): LayoutConfig {
    const configs: Record<string, LayoutConfig> = {
      admin: {
        theme: 'admin',
        showHeader: true,
        showFooter: false,
        showSidebar: true,
        showQuickSearch: true,
      },
      commercial: {
        theme: 'commercial',
        showHeader: true,
        showFooter: true,
        showSidebar: true,
        showQuickSearch: true,
      },
      public: {
        theme: 'public',
        showHeader: true,
        showFooter: true,
        showSidebar: false,
        showQuickSearch: true,
      },
    };

    return configs[context] || configs.public;
  }

  /**
   * Layout de fallback en cas d'erreur
   */
  private getFallbackLayout(context: string): LayoutData {
    return {
      header: { title: 'Application', logo: null, user: null },
      footer: { links: [], copyright: '2025 - Application' },
      navigation: { items: [] },
      quickSearch: { enabled: false },
      socialShare: { platforms: [] },
      metaTags: {
        title: 'Application',
        description: 'Application description',
      },
      config: this.getDefaultConfig(context),
    };
  }

  /**
   * Configuration par défaut pour le partage social
   */
  private async getSocialShareConfig(context: string): Promise<any> {
    return {
      platforms: ['facebook', 'twitter', 'linkedin', 'email'],
      defaultUrl: context === 'admin' ? '/admin' : '/',
      defaultTitle: `${context.charAt(0).toUpperCase() + context.slice(1)} - MonEntreprise`,
    };
  }

  /**
   * Configuration par défaut des meta tags
   */
  private async getMetaTags(context: string): Promise<any> {
    return {
      title: `${context.charAt(0).toUpperCase() + context.slice(1)} - MonEntreprise`,
      description: `Interface ${context} de MonEntreprise`,
      robots: context === 'admin' ? 'noindex, nofollow' : 'index, follow',
    };
  }

  /**
   * Configuration par défaut pour les meta tags
   */
  private async getMetaTagsConfig(context: string): Promise<any> {
    return {
      title: `${context.charAt(0).toUpperCase() + context.slice(1)} - MonEntreprise`,
      description: `Interface ${context} de MonEntreprise`,
      robots: context === 'admin' ? 'noindex, nofollow' : 'index, follow',
    };
  }

  /**
   * Invalide le cache pour un contexte donné
   */
  async invalidateCache(context: string, userId?: string): Promise<void> {
    try {
      const cacheKey = `layout:${context}:${userId || 'anonymous'}`;
      await this.cacheService.del(cacheKey);
      this.logger.log(`Cache layout invalidé pour ${context}`);
    } catch (error) {
      this.logger.error('Erreur invalidation cache layout:', error);
    }
  }
}
