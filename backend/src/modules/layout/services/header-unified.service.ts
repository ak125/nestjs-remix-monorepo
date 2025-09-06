import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../cache/cache.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { QuickSearchService } from './quick-search.service';

export interface HeaderData {
  title: string;
  version?: string;
  logo: {
    src: string;
    alt: string;
    link: string;
  };
  navigation?: {
    main?: any[];
    secondary?: any[];
    categories?: any[];
    type?: string;
    items?: any[];
  };
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role: string;
    isActive: boolean;
    isPro: boolean;
  };
  search?: {
    type?: 'inline' | 'separate_page';
    placeholder?: string;
    action?: string;
    enabled?: boolean;
    config?: any;
  };
  quickSearch?: {
    enabled: boolean;
    config: any;
    placeholder: string;
  };
  topBar?: {
    show: boolean;
    content?: {
      phone: string;
      email: string;
      social: any[];
    };
  };
  mobile?: {
    menuType: string;
    searchButton: boolean;
  };
  breadcrumbs?: Array<{
    label: string;
    url?: string;
  }>;
  actions?: Array<{
    label: string;
    url: string;
    icon?: string;
    variant?: 'primary' | 'secondary';
  }>;
  notifications?: {
    count: number;
    items: Array<{
      id: string;
      title: string;
      message: string;
      type: 'info' | 'warning' | 'error' | 'success';
      timestamp: Date;
    }>;
  };
  stats?: {
    totalUsers: number;
    totalProducts: number;
    lowStockProducts: number;
    activeOrders: number;
  };
  layout?: string;
  sections?: any[];
}

@Injectable()
export class HeaderUnifiedService extends SupabaseBaseService {
  private readonly logger = new Logger(HeaderUnifiedService.name);

  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly quickSearchService: QuickSearchService,
  ) {
    super(configService);
  }

  /**
   * Point d'entrée principal - détecte automatiquement la meilleure approche
   */
  async getHeader(
    context: 'admin' | 'commercial' | 'public' | string = 'public',
    version: 'v2' | 'v7' | 'v8' | 'auto' = 'auto',
    userId?: string,
  ): Promise<HeaderData> {
    try {
      const cacheKey = `header_unified:${context}:${version}:${userId || 'anonymous'}`;
      const cached = await this.cacheService.get<HeaderData>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Header unified cache hit: ${context}/${version}`);
        return cached;
      }

      // Auto-détection de la version optimale
      const finalVersion = version === 'auto' ? await this.detectOptimalVersion(context) : version;
      
      // Récupération des sections de layout si disponibles
      const sections = await this.getLayoutSections('header', finalVersion);
      
      // Construction du header selon le contexte ET la version
      const headerData = await this.buildUnifiedHeader(context, finalVersion, userId, sections);
      
      await this.cacheService.set(cacheKey, headerData, 900); // 15 minutes
      
      this.logger.log(`Header unified généré: ${context}/${finalVersion}`);
      return headerData;

    } catch (error) {
      this.logger.error(`Error unified header: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.getFallbackHeader(context, version);
    }
  }

  /**
   * Construction unifiée du header
   */
  private async buildUnifiedHeader(
    context: string,
    version: string,
    userId?: string,
    sections?: any[],
  ): Promise<HeaderData> {
    // Données communes récupérées en parallèle
    const [userStats, productStats, orderStats, realUser, quickSearchConfig] = await Promise.all([
      this.getUserStats(),
      this.getProductStats(),
      this.getOrderStats(),
      userId ? this.getRealUser(userId) : null,
      this.quickSearchService.getConfig('main'),
    ]);

    // Base commune pour tous les headers
    const baseHeader: Partial<HeaderData> = {
      stats: {
        totalUsers: userStats.total,
        totalProducts: productStats.total,
        lowStockProducts: productStats.lowStock,
        activeOrders: orderStats.active,
      },
      user: realUser,
      sections: sections?.map(s => ({
        key: s.section_key,
        content: s.content,
        styles: s.styles,
      })),
    };

    // Construction selon la version
    switch (version) {
      case 'v8':
        return this.buildV8Header(baseHeader, context, quickSearchConfig);
      case 'v7':
        return this.buildV7Header(baseHeader, context);
      case 'v2':
        return this.buildV2Header(baseHeader, context);
      default:
        return this.buildModernHeader(baseHeader, context, quickSearchConfig);
    }
  }

  /**
   * Header V8 (moderne avec toutes les fonctionnalités)
   */
  private async buildV8Header(base: Partial<HeaderData>, context: string, quickSearchConfig: any): Promise<HeaderData> {
    return {
      ...base,
      version: 'v8',
      title: this.getContextTitle(context),
      logo: {
        src: '/images/logo.svg',
        alt: 'Logo Moderne',
        link: '/',
      },
      navigation: {
        main: await this.getMainNavigation(),
        secondary: await this.getSecondaryNavigation(context),
      },
      quickSearch: {
        enabled: true,
        config: quickSearchConfig,
        placeholder: 'Rechercher une pièce, référence...',
      },
      user: base.user,
      mobile: {
        menuType: 'hamburger',
        searchButton: true,
      },
      actions: await this.getContextActions(context),
      notifications: context === 'admin' ? await this.getRealNotifications() : undefined,
    } as HeaderData;
  }

  /**
   * Header V7 (avec top bar et catégories)
   */
  private async buildV7Header(base: Partial<HeaderData>, context: string): Promise<HeaderData> {
    return {
      ...base,
      version: 'v7',
      title: 'Pièces Auto V7',
      logo: {
        src: '/images/logo-v7.png',
        alt: 'Logo V7',
        link: '/v7',
      },
      navigation: {
        main: await this.getV7Navigation(),
        categories: await this.getV7Categories(),
      },
      search: {
        type: 'inline',
        placeholder: 'Rechercher...',
        action: '/v7/search',
      },
      topBar: {
        show: true,
        content: {
          phone: '+33 1 23 45 67 89',
          email: 'contact@example.com',
          social: await this.getSocialLinks(),
        },
      },
    } as HeaderData;
  }

  /**
   * Header V2 (simple et rétro)
   */
  private async buildV2Header(base: Partial<HeaderData>, context: string): Promise<HeaderData> {
    return {
      ...base,
      version: 'v2',
      title: 'Pièces Auto V2',
      logo: {
        src: '/images/logo-v2.gif',
        alt: 'Logo V2',
        link: '/v2',
      },
      navigation: {
        type: 'simple',
        items: await this.getV2Navigation(),
      },
      search: {
        type: 'separate_page',
        placeholder: 'Rechercher...',
        action: '/v2/search',
      },
      layout: 'horizontal',
    } as HeaderData;
  }

  /**
   * Header moderne (admin/commercial/public optimisé)
   */
  private async buildModernHeader(base: Partial<HeaderData>, context: string, quickSearchConfig: any): Promise<HeaderData> {
    const contextTitles = {
      admin: 'Administration - Données Réelles',
      commercial: 'Espace Commercial',
      public: 'Boutique',
    };

    return {
      ...base,
      version: 'modern',
      title: contextTitles[context as keyof typeof contextTitles] || 'Pièces Auto',
      logo: {
        src: context === 'admin' ? '/images/admin-logo.png' : '/images/logo.png',
        alt: context === 'admin' ? 'Admin Dashboard' : 'Boutique',
        link: '/',
      },
      quickSearch: context !== 'v2' ? {
        enabled: true,
        config: quickSearchConfig,
        placeholder: 'Rechercher une pièce, référence...',
      } : undefined,
      actions: await this.getContextActions(context),
      notifications: context === 'admin' ? await this.getRealNotifications() : undefined,
      breadcrumbs: context === 'admin' ? await this.getAdminBreadcrumbs() : undefined,
    } as HeaderData;
  }

  /**
   * Auto-détection de la version optimale
   */
  private async detectOptimalVersion(context: string): Promise<string> {
    // Logique intelligente pour choisir la version
    if (context === 'admin') return 'modern';
    if (context === 'commercial') return 'v8';
    
    // Vérifier si des sections layout existent
    const hasV8Sections = await this.hasLayoutSections('header', 'v8');
    const hasV7Sections = await this.hasLayoutSections('header', 'v7');
    
    if (hasV8Sections) return 'v8';
    if (hasV7Sections) return 'v7';
    
    return 'modern';
  }

  /**
   * Récupération des sections de layout
   */
  private async getLayoutSections(sectionType: string, version: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('layout_sections')
        .select('*')
        .eq('section_type', sectionType)
        .eq('version', version)
        .eq('is_visible', true)
        .order('position');

      if (error) {
        this.logger.debug(`No layout_sections table or error: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.debug('layout_sections table not available, using fallback');
      return [];
    }
  }

  /**
   * Vérifie si des sections layout existent
   */
  private async hasLayoutSections(sectionType: string, version: string): Promise<boolean> {
    const sections = await this.getLayoutSections(sectionType, version);
    return sections.length > 0;
  }

  // Toutes les méthodes utilitaires existantes...
  private getContextTitle(context: string): string {
    const titles = {
      admin: 'Administration',
      commercial: 'Espace Commercial', 
      public: 'Boutique',
      products: 'Gestion Produits',
      orders: 'Gestion Commandes',
      users: 'Gestion Utilisateurs',
    };
    return titles[context as keyof typeof titles] || 'Pièces Auto';
  }

  private async getContextActions(context: string): Promise<any[]> {
    switch (context) {
      case 'admin':
        return [
          { label: 'Dashboard', url: '/admin', icon: 'dashboard' },
          { label: 'Paramètres', url: '/admin/settings', icon: 'settings' },
        ];
      case 'commercial':
        return [
          { label: 'Devis', url: '/commercial/quotes', icon: 'quote' },
          { label: 'Clients', url: '/commercial/clients', icon: 'users' },
        ];
      default:
        return [
          { label: 'Connexion', url: '/login', variant: 'secondary' },
          { label: 'Inscription', url: '/register', variant: 'primary' },
        ];
    }
  }

  private getFallbackHeader(context: string, version?: string): HeaderData {
    return {
      title: context.charAt(0).toUpperCase() + context.slice(1),
      version: version || 'fallback',
      logo: {
        src: '/images/logo.png',
        alt: 'Logo',
        link: '/',
      },
    };
  }

  // Importation des méthodes des autres services existants
  private async getUserStats(): Promise<{ total: number; active: number }> {
    try {
      const { count: total } = await this.supabase
        .from('___xtr_customer')
        .select('*', { count: 'exact', head: true });

      const { count: active } = await this.supabase
        .from('___xtr_customer')
        .select('*', { count: 'exact', head: true })
        .gte('customer_date_upd', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      return { total: total || 0, active: active || 0 };
    } catch (error) {
      return { total: 0, active: 0 };
    }
  }

  private async getProductStats(): Promise<{ total: number; lowStock: number }> {
    try {
      const { count: total } = await this.supabase
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', 1);

      const { count: lowStock } = await this.supabase
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', 1)
        .lte('piece_qty_sale', 5);

      return { total: total || 0, lowStock: lowStock || 0 };
    } catch (error) {
      return { total: 0, lowStock: 0 };
    }
  }

  private async getOrderStats(): Promise<{ active: number; pending: number }> {
    // Simulation - adapter selon votre table commandes
    return { active: 0, pending: 0 };
  }

  private async getRealUser(userId: string): Promise<any> {
    try {
      const { data } = await this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('customer_id', userId)
        .single();

      if (data) {
        return {
          name: `${data.customer_fname} ${data.customer_name}`,
          email: data.customer_email,
          role: data.customer_is_pro ? 'pro' : 'particulier',
          isActive: true,
          isPro: data.customer_is_pro,
        };
      }
    } catch (error) {
      this.logger.debug(`User ${userId} not found`);
    }
    return null;
  }

  private async getRealNotifications(): Promise<any> {
    return {
      count: 3,
      items: [
        {
          id: '1',
          title: 'Nouveau produit',
          message: 'Un nouveau produit a été ajouté',
          type: 'info',
          timestamp: new Date(),
        },
      ],
    };
  }

  private async getAdminBreadcrumbs(): Promise<any[]> {
    return [
      { label: 'Admin', url: '/admin' },
      { label: 'Dashboard', url: '/admin/dashboard' },
    ];
  }

  // Méthodes de navigation (réutilisent les services existants)
  private async getMainNavigation(): Promise<any[]> {
    try {
      const { data } = await this.supabase
        .from('navigation_menus')
        .select('items')
        .eq('menu_key', 'main_navigation')
        .eq('is_active', true)
        .single();
      return data?.items || this.getDefaultNavigation();
    } catch {
      return this.getDefaultNavigation();
    }
  }

  private getDefaultNavigation(): any[] {
    return [
      { label: 'Accueil', href: '/', icon: 'home' },
      { label: 'Produits', href: '/products', icon: 'box' },
      { label: 'Commandes', href: '/orders', icon: 'shopping-cart' },
      { label: 'Utilisateurs', href: '/users', icon: 'users' },
    ];
  }

  private async getSecondaryNavigation(context: string): Promise<any[]> {
    const menuKey = context === 'admin' ? 'admin_navigation' : 'secondary_navigation';
    try {
      const { data } = await this.supabase
        .from('navigation_menus')
        .select('items')
        .eq('menu_key', menuKey)
        .eq('is_active', true)
        .single();
      return data?.items || [];
    } catch {
      return [];
    }
  }

  private async getV7Navigation(): Promise<any[]> {
    return [
      { label: 'Accueil V7', link: '/v7' },
      { label: 'Catalogue V7', link: '/v7/catalog' },
      { label: 'Recherche V7', link: '/v7/search' },
    ];
  }

  private async getV7Categories(): Promise<any[]> {
    try {
      const { data } = await this.supabase
        .from('PIECES_GAMME')
        .select('id, code, name')
        .eq('is_active', true)
        .order('position')
        .limit(10);
      return data || [];
    } catch {
      return [];
    }
  }

  private async getV2Navigation(): Promise<any[]> {
    return [
      { label: 'Accueil', link: '/v2' },
      { label: 'Catalogue', link: '/v2/catalog' },
      { label: 'Recherche', link: '/v2/search' },
      { label: 'Contact', link: '/v2/contact' },
    ];
  }

  private async getSocialLinks(): Promise<any[]> {
    try {
      const { data } = await this.supabase
        .from('social_share_configs')
        .select('platform, icon, base_url')
        .eq('is_active', true)
        .order('position');
      return data || [];
    } catch {
      return [];
    }
  }
}
