import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { HeaderService } from './header.service';
import { FooterService } from './footer.service';
import { QuickSearchService } from './quick-search.service';
import { SocialShareService } from './social-share.service';
import { MetaTagsService } from './meta-tags.service';

export interface LayoutConfig {
  type:
    | 'main'
    | 'core'
    | 'massdoc'
    | 'v2'
    | 'v7'
    | 'admin'
    | 'commercial'
    | 'public';
  theme: 'admin' | 'commercial' | 'public';
  version?: string;
  page?: string;
  showHeader: boolean;
  showFooter: boolean;
  showSidebar: boolean;
  showQuickSearch: boolean;
  customCss?: string;
  metadata?: Record<string, any>;
  user?: any;
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
          this.getInternalNavigation(context === 'public' ? 'user' : context),
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
        type: 'admin',
        theme: 'admin',
        showHeader: true,
        showFooter: false,
        showSidebar: true,
        showQuickSearch: true,
      },
      commercial: {
        type: 'commercial',
        theme: 'commercial',
        showHeader: true,
        showFooter: true,
        showSidebar: true,
        showQuickSearch: true,
      },
      public: {
        type: 'public',
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

  /**
   * ✨ NOUVELLES MÉTHODES AVANCÉES
   * Récupérer la configuration complète du layout avec support multi-versions
   */
  async getAdvancedLayoutData(config: LayoutConfig): Promise<LayoutData> {
    const cacheKey = `layout:${config.type}:${config.version}:${config.page}`;
    const cached = await this.cacheService.get<LayoutData>(cacheKey);

    if (cached && !config.user) {
      return cached;
    }

    const _version = config.version || this.getDefaultVersion(config.type);

    // Construire les données du layout avec les services existants
    const [
      header,
      footer,
      navigation,
      quickSearch,
      socialShare,
      metaTags,
      _widgets,
    ] = await Promise.all([
      this.headerService.getHeader(config.theme, config.user?.id),
      this.footerService.getFooter(config.theme),
      this.getInternalNavigation(
        config.theme === 'public' ? 'user' : config.theme,
      ),
      this.quickSearchService.getSearchData(config.theme),
      this.getSocialShareConfig(config.theme),
      this.getMetaTags(config.theme),
      this.getWidgets(config.type, config.page),
    ]);

    const layoutData: LayoutData = {
      header,
      footer,
      navigation,
      quickSearch,
      socialShare,
      metaTags: {
        ...metaTags,
        title: config.metadata?.title || metaTags.title,
        description: config.metadata?.description || metaTags.description,
        keywords: config.metadata?.keywords || [],
        ogImage: config.metadata?.ogImage || '',
        canonical: config.metadata?.canonical || '',
      },
      config,
    };

    // Mettre en cache si pas de contexte utilisateur
    if (!config.user) {
      await this.cacheService.set(cacheKey, layoutData, 3600);
    }

    return layoutData;
  }

  /**
   * Récupérer les widgets pour une page spécifique
   */
  private async getWidgets(_type: string, _page?: string): Promise<any[]> {
    // Pour l'instant retournons un tableau vide,
    // cette méthode peut être étendue avec des vraies données
    return [];
  }

  /**
   * Déterminer la version par défaut selon le type
   */
  private getDefaultVersion(type: string): string {
    const versionMap: Record<string, string> = {
      main: 'v8',
      core: 'v8',
      massdoc: 'v8',
      v2: 'v2',
      v7: 'v7',
      admin: 'v8',
      commercial: 'v8',
      public: 'v8',
    };
    return versionMap[type] || 'v8';
  }

  /**
   * Invalider tout le cache layout pour un type donné
   */
  async invalidateTypeCache(type?: string): Promise<void> {
    try {
      if (type) {
        // Pour l'instant on invalide en supprimant les clés principales
        await this.cacheService.del(`layout:${type}:anonymous`);
        this.logger.log(`Cache layout invalidé pour type ${type}`);
      } else {
        // Invalider les principales clés de cache layout
        const contexts = ['admin', 'commercial', 'public'];
        for (const context of contexts) {
          await this.cacheService.del(`layout:${context}:anonymous`);
        }
        this.logger.log('Cache layout principal invalidé');
      }
    } catch (error) {
      this.logger.error('Erreur invalidation cache layout:', error);
    }
  }

  /**
   * Récupérer la navigation interne
   */
  private getInternalNavigation(type: string): any[] {
    const navigationTemplates: Record<string, any[]> = {
      admin: [
        { title: 'Dashboard', url: '/admin', icon: 'dashboard' },
        { title: 'Produits', url: '/admin/products', icon: 'products' },
        { title: 'Commandes', url: '/admin/orders', icon: 'orders' },
        { title: 'Utilisateurs', url: '/admin/users', icon: 'users' },
        { title: 'Paramètres', url: '/admin/settings', icon: 'settings' },
      ],
      commercial: [
        { title: 'Accueil', url: '/', icon: 'home' },
        { title: 'Produits', url: '/products', icon: 'products' },
        { title: 'Services', url: '/services', icon: 'services' },
        { title: 'Contact', url: '/contact', icon: 'contact' },
      ],
      user: [
        { title: 'Accueil', url: '/', icon: 'home' },
        { title: 'Mon compte', url: '/account', icon: 'account' },
        { title: 'Mes commandes', url: '/orders', icon: 'orders' },
        { title: 'Support', url: '/support', icon: 'support' },
      ],
      public: [
        { title: 'Accueil', url: '/', icon: 'home' },
        { title: 'Produits', url: '/products', icon: 'products' },
        { title: 'À propos', url: '/about', icon: 'about' },
        { title: 'Contact', url: '/contact', icon: 'contact' },
      ],
    };

    return navigationTemplates[type] || navigationTemplates.public;
  }
}
