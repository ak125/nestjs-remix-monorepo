/**
 * 🎨 LAYOUT SERVICE UNIFIÉ AMÉLIORÉ
 * 
 * Service principal pour orchestrer tout le système de layout
 * ✅ Support Core/Massdoc layouts dédiés
 * ✅ Sections modulaires et réutilisables  
 * ✅ Configuration centralisée Supabase
 * ✅ Cache intelligent pour performances
 * ✅ Headers et footers dynamiques
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { HeaderService } from './header.service';
import { FooterService } from './footer.service';
import { SocialShareService } from './social-share.service';
import { QuickSearchService } from './quick-search.service';
import { MetaTagsService } from './meta-tags.service';
import { LayoutConfigurationService, LayoutConfigData } from './layout-config.service';
import { ModularSectionsService, ModularSection } from './modular-sections.service';

export interface LayoutConfig {
  type: 'core' | 'massdoc' | 'admin' | 'commercial' | 'public';
  theme?: 'light' | 'dark' | 'auto';
  version?: string;
  page?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  showSidebar?: boolean;
  showQuickSearch?: boolean;
  context?: any;
}

export interface LayoutData {
  header?: any;
  footer?: any;
  navigation?: any;
  quickSearch?: any;
  socialShare?: any;
  metaTags?: any;
  sections?: ModularSection[];
  config?: LayoutConfigData;
  widgets?: any[];
  performance?: {
    cacheKey: string;
    lastUpdated: string;
    expires: number;
  };
}

@Injectable()
export class LayoutServiceUnified {
  private readonly logger = new Logger(LayoutServiceUnified.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly headerService: HeaderService,
    private readonly footerService: FooterService,
    private readonly socialShareService: SocialShareService,
    private readonly quickSearchService: QuickSearchService,
    private readonly metaTagsService: MetaTagsService,
    private readonly layoutConfigService: LayoutConfigurationService,
    private readonly sectionsService: ModularSectionsService,
  ) {}

  /**
   * 🚀 MÉTHODE PRINCIPALE - Récupère les données layout complètes
   */
  async getLayoutData(config: LayoutConfig): Promise<LayoutData> {
    const cacheKey = this.generateCacheKey(config);
    
    try {
      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<LayoutData>(cacheKey);
      if (cached) {
        this.logger.debug(`Layout ${config.type} depuis le cache`);
        return cached;
      }

      this.logger.log(`Génération layout ${config.type} pour ${config.page || 'default'}`);

      // Récupérer la configuration layout
      const layoutConfig = await this.layoutConfigService.getLayoutConfiguration(
        config.type,
        config.version,
      );

      // Construire les données layout en parallèle
      const [header, footer, sections, navigation, quickSearch, socialShare, metaTags] = 
        await Promise.all([
          config.showHeader !== false ? this.headerService.getHeader(config) : null,
          config.showFooter !== false ? this.footerService.getFooter(config) : null,
          this.sectionsService.getSectionsForContext(config.type, config.page),
          this.getInternalNavigation(config),
          config.showQuickSearch !== false ? this.quickSearchService.getQuickSearchConfig(config) : null,
          this.socialShareService.getSocialShareConfig(config),
          this.metaTagsService.generateMetaTags(config),
        ]);

      const layoutData: LayoutData = {
        header,
        footer,
        navigation,
        sections,
        quickSearch,
        socialShare,
        metaTags,
        config: layoutConfig,
        widgets: [],
        performance: {
          cacheKey,
          lastUpdated: new Date().toISOString(),
          expires: 3600,
        },
      };

      // Mettre en cache pour 1 heure
      await this.cacheService.set(cacheKey, layoutData, 3600);
      
      return layoutData;

    } catch (error) {
      this.logger.error(`Erreur getLayoutData pour ${config.type}:`, error);
      return await this.getFallbackLayout(config);
    }
  }

  /**
   * 🔧 Récupère les données layout pour l'administration
   */
  async getAdvancedLayoutData(config: LayoutConfig): Promise<LayoutData> {
    const layoutData = await this.getLayoutData(config);
    
    // Ajouter des métadonnées avancées pour l'admin
    layoutData.performance = {
      ...layoutData.performance,
      cacheHit: Boolean(await this.cacheService.get(this.generateCacheKey(config))),
      lastUpdated: new Date().toISOString(),
    };

    return layoutData;
  }

  /**
   * 🧩 Récupère les sections modulaires pour un contexte
   */
  async getModularSections(
    context: string,
    page?: string,
    userRole?: string,
  ): Promise<ModularSection[]> {
    return this.sectionsService.getSectionsForContext(context, page, userRole);
  }

  /**
   * 💾 Sauvegarde une configuration layout
   */
  async saveLayoutConfiguration(config: Partial<LayoutConfigData>): Promise<boolean> {
    try {
      const saved = await this.layoutConfigService.saveConfiguration(config);
      if (saved) {
        await this.invalidateCache(config.type);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Erreur saveLayoutConfiguration:', error);
      return false;
    }
  }

  /**
   * 🔄 Invalide le cache layout
   */
  async invalidateCache(type?: string, page?: string): Promise<void> {
    try {
      if (type && page) {
        await this.cacheService.del(`layout:${type}:${page}`);
      } else if (type) {
        // Invalider toutes les pages d'un type
        await this.cacheService.del(`layout:${type}:*`);
      } else {
        // Invalider tout le cache layout
        await this.cacheService.del('layout:*');
      }
      
      this.logger.log(`Cache layout invalidé${type ? ` pour ${type}` : ''}`);
    } catch (error) {
      this.logger.error('Erreur invalidateCache:', error);
    }
  }

  /**
   * 🔍 Génère une clé de cache unique
   */
  private generateCacheKey(config: LayoutConfig): string {
    const parts = [
      'layout',
      config.type,
      config.page || 'default',
      config.version || 'latest',
      config.theme || 'light',
    ];
    return parts.join(':');
  }

  /**
   * 🧭 Navigation interne du système
   */
  private async getInternalNavigation(config: LayoutConfig): Promise<any> {
    const navigationMap = {
      core: {
        main: [
          { label: 'Dashboard', href: '/core/dashboard', icon: 'dashboard' },
          { label: 'Documents', href: '/core/documents', icon: 'documents' },
          { label: 'Utilisateurs', href: '/core/users', icon: 'users' },
          { label: 'Paramètres', href: '/core/settings', icon: 'settings' },
        ],
        secondary: [
          { label: 'Aide', href: '/core/help', icon: 'help' },
          { label: 'Support', href: '/core/support', icon: 'support' },
        ],
      },
      massdoc: {
        main: [
          { label: 'Accueil', href: '/massdoc', icon: 'home' },
          { label: 'Catalogue', href: '/massdoc/catalogue', icon: 'catalogue' },
          { label: 'Documentation', href: '/massdoc/docs', icon: 'docs' },
          { label: 'Support', href: '/massdoc/support', icon: 'support' },
          { label: 'Mon compte', href: '/massdoc/account', icon: 'account' },
        ],
        secondary: [
          { label: 'À propos', href: '/massdoc/about', icon: 'info' },
          { label: 'Contact', href: '/massdoc/contact', icon: 'contact' },
        ],
      },
      admin: {
        main: [
          { label: 'Dashboard', href: '/admin', icon: 'dashboard' },
          { label: 'Utilisateurs', href: '/admin/users', icon: 'users' },
          { label: 'Produits', href: '/admin/products', icon: 'products' },
          { label: 'Commandes', href: '/admin/orders', icon: 'orders' },
          { label: 'Analytics', href: '/admin/analytics', icon: 'analytics' },
        ],
      },
    };

    return navigationMap[config.type] || navigationMap.core;
  }

  /**
   * 🚨 Layout de fallback en cas d'erreur
   */
  private async getFallbackLayout(config: LayoutConfig): Promise<LayoutData> {
    return {
      header: {
        show: true,
        logo: { src: '/logo-fallback.svg', alt: 'Logo', link: '/' },
        navigation: { show: false, items: [] },
      },
      footer: {
        show: false,
      },
      navigation: { main: [], secondary: [] },
      sections: [],
      quickSearch: null,
      socialShare: null,
      metaTags: {
        title: 'Application',
        description: 'Description par défaut',
      },
      config: null,
      widgets: [],
      performance: {
        cacheKey: 'fallback',
        lastUpdated: new Date().toISOString(),
        expires: 0,
      },
    };
  }
}
