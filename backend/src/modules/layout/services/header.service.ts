import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../cache/cache.service';
import { createClient } from '@supabase/supabase-js';

export interface HeaderData {
  title: string;
  logo: {
    url: string;
    alt: string;
    link?: string;
  };
  navigation: {
    main: any[];
    secondary: any[];
  };
  userStats?: {
    total: number;
    active: number;
  };
  quickSearch: {
    enabled: boolean;
    placeholder: string;
  };
  user: {
    showAccount: boolean;
    showCart: boolean;
    cartPosition: string;
  };
  mobile: {
    menuType: string;
    searchButton: boolean;
  };
}

@Injectable()
export class HeaderService {
  private readonly logger = new Logger(HeaderService.name);
  private supabase: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    // Initialisation simple de Supabase
    const supabaseUrl = this.configService.get('SUPABASE_URL');
    const supabaseKey = this.configService.get('SUPABASE_ANON_KEY');
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Obtient les données du header moderne
   */
  async getHeader(
    context: string = 'default',
    _userId?: string,
  ): Promise<HeaderData> {
    return this.generateHeader(context);
  }

  /**
   * Version moderne unifiée du header
   */
  async getHeaderData(type: string): Promise<HeaderData> {
    try {
      const cacheKey = `header_${type}`;
      const cached = await this.cacheService.get<HeaderData>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Header cache hit for ${type}`);
        return cached;
      }

      const headerData = await this.buildModernHeader(type);
      await this.cacheService.set(cacheKey, headerData, 300);
      return headerData;
    } catch (error) {
      this.logger.error(`Error generating header for ${type}:`, error);
      return this.getFallbackHeader(type);
    }
  }

  /**
   * Génère les données du header avec vraies données
   */
  private async generateHeader(
    context: string = 'default',
  ): Promise<HeaderData> {
    try {
      const cacheKey = `header_${context}`;
      const cached = await this.cacheService.get<HeaderData>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Header cache hit for context: ${context}`);
        return cached;
      }

      const headerData = await this.buildModernHeader(context);
      await this.cacheService.set(cacheKey, headerData, 300);
      return headerData;
    } catch (error) {
      this.logger.error(
        `Error generating header: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.getFallbackHeader(context);
    }
  }

  /**
   * Construit le header moderne unifié
   */
  private async buildModernHeader(type: string): Promise<HeaderData> {
    const [userStats, mainNavigation, secondaryNavigation] = await Promise.all([
      this.getUserStats(),
      this.getMainNavigation(),
      this.getSecondaryNavigation(type),
    ]);

    return {
      title: this.getContextTitle(type),
      logo: {
        url: '/images/logo.svg',
        alt: 'Logo Application',
        link: '/',
      },
      navigation: {
        main: mainNavigation,
        secondary: secondaryNavigation,
      },
      userStats,
      quickSearch: {
        enabled: true,
        placeholder: 'Rechercher une pièce, référence...',
      },
      user: {
        showAccount: true,
        showCart: true,
        cartPosition: 'right',
      },
      mobile: {
        menuType: 'hamburger',
        searchButton: true,
      },
    };
  }

  /**
   * Header de fallback en cas d'erreur
   */
  private getFallbackHeader(context: string): HeaderData {
    return {
      title: context.charAt(0).toUpperCase() + context.slice(1),
      logo: {
        url: '/images/logo.png',
        alt: 'Logo',
        link: '/',
      },
      navigation: {
        main: [],
        secondary: [],
      },
      quickSearch: {
        enabled: false,
        placeholder: 'Rechercher...',
      },
      user: {
        showAccount: true,
        showCart: true,
        cartPosition: 'right',
      },
      mobile: {
        menuType: 'hamburger',
        searchButton: true,
      },
    };
  }

  /**
   * Récupère les statistiques utilisateurs depuis Supabase
   */
  private async getUserStats(): Promise<{ total: number; active: number }> {
    try {
      const { count: total, error: totalError } = await this.supabase
        .from('___xtr_customer')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        this.logger.error('Error fetching total users:', totalError);
        return { total: 0, active: 0 };
      }

      return {
        total: total || 0,
        active: Math.floor((total || 0) * 0.1), // Estimation 10% actifs
      };
    } catch (error) {
      this.logger.error(
        `Error in getUserStats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { total: 0, active: 0 };
    }
  }

  /**
   * Génère le titre selon le contexte
   */
  private getContextTitle(context: string): string {
    const titles = {
      admin: 'Administration',
      commercial: 'Espace Commercial',
      public: 'Pièces Auto',
      products: 'Gestion Produits',
      orders: 'Gestion Commandes',
      users: 'Gestion Utilisateurs',
      main: 'Application Principale',
      core: 'Système Central',
      massdoc: 'Gestion Documents',
      default: 'Application',
    };

    return titles[context as keyof typeof titles] || titles.default;
  }

  /**
   * Récupérer la navigation principale
   */
  private async getMainNavigation(): Promise<any[]> {
    try {
      return [
        { label: 'Accueil', href: '/', icon: 'home' },
        { label: 'Produits', href: '/products', icon: 'box' },
        { label: 'Commandes', href: '/orders', icon: 'shopping-cart' },
        { label: 'Contact', href: '/contact', icon: 'phone' },
      ];
    } catch (error) {
      this.logger.error('Error fetching main navigation:', error);
      return [];
    }
  }

  /**
   * Récupérer la navigation secondaire
   */
  private async getSecondaryNavigation(type: string): Promise<any[]> {
    try {
      const navigationMap: Record<string, any[]> = {
        admin: [
          { label: 'Dashboard', href: '/admin' },
          { label: 'Utilisateurs', href: '/admin/users' },
          { label: 'Paramètres', href: '/admin/settings' },
        ],
        commercial: [
          { label: 'Dashboard', href: '/commercial' },
          { label: 'Clients', href: '/commercial/clients' },
          { label: 'Rapports', href: '/commercial/reports' },
        ],
        public: [
          { label: 'Mon compte', href: '/account' },
          { label: 'Aide', href: '/help' },
          { label: 'Contact', href: '/contact' },
        ],
        core: [
          { label: 'Dashboard', href: '/core' },
          { label: 'Analytics', href: '/core/analytics' },
        ],
        massdoc: [
          { label: 'Documents', href: '/massdoc' },
          { label: 'Templates', href: '/massdoc/templates' },
        ],
        default: [
          { label: 'Mon compte', href: '/account' },
          { label: 'Aide', href: '/help' },
        ],
      };

      return navigationMap[type] || navigationMap.default;
    } catch (error) {
      this.logger.error('Error fetching secondary navigation:', error);
      return [];
    }
  }
}
