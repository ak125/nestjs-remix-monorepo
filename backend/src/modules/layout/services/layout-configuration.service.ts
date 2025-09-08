import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface LayoutConfigData {
  id: string;
  name: string;
  type: 'core' | 'massdoc' | 'admin' | 'commercial' | 'public';
  version: string;
  config: {
    header: any;
    footer: any;
    navigation: any;
    widgets: any[];
    styles: any;
    responsive: any;
    features: any;
  };
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class LayoutConfigurationService {
  private readonly logger = new Logger(LayoutConfigurationService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly supabase: SupabaseService,
  ) {}

  async getLayoutConfiguration(
    type: string,
    version: string = 'latest',
  ): Promise<LayoutConfigData | null> {
    const cacheKey = `layout_config:${type}:${version}`;

    try {
      const cached = await this.cacheService.get<LayoutConfigData>(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await this.supabase
        .getClient()
        .from('layout_configurations')
        .select('*')
        .eq('type', type)
        .eq('version', version)
        .eq('is_active', true)
        .single();

      if (error) {
        this.logger.error(`Erreur config layout ${type}:`, error);
        return await this.getDefaultConfiguration(type);
      }

      await this.cacheService.set(cacheKey, data, 3600);
      return data;
    } catch (error) {
      this.logger.error(`Erreur getLayoutConfiguration:`, error);
      return await this.getDefaultConfiguration(type);
    }
  }

  async getAllConfigurations(): Promise<LayoutConfigData[]> {
    const cacheKey = 'layout_configs:all';

    try {
      const cached = await this.cacheService.get<LayoutConfigData[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await this.supabase
        .getClient()
        .from('layout_configurations')
        .select('*')
        .eq('is_active', true)
        .order('type, version');

      if (error) {
        throw error;
      }

      await this.cacheService.set(cacheKey, data || [], 1800);
      return data || [];
    } catch (error) {
      this.logger.error('Erreur getAllConfigurations:', error);
      return [];
    }
  }

  async saveConfiguration(
    config: Partial<LayoutConfigData>,
  ): Promise<LayoutConfigData | null> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('layout_configurations')
        .upsert(config)
        .select()
        .single();

      if (error) {
        throw error;
      }

      await this.invalidateCache(config.type, config.version);
      return data;
    } catch (error) {
      this.logger.error('Erreur saveConfiguration:', error);
      return null;
    }
  }

  async invalidateCache(type?: string, version?: string): Promise<void> {
    try {
      if (type && version) {
        await this.cacheService.del(`layout_config:${type}:${version}`);
      } else {
        await this.cacheService.del('layout_configs:all');
      }
    } catch (error) {
      this.logger.error('Erreur invalidateCache:', error);
    }
  }

  private async getDefaultConfiguration(
    type: string,
  ): Promise<LayoutConfigData> {
    const coreConfig: LayoutConfigData = {
      id: 'core-default',
      name: 'Core Layout Default',
      type: 'core',
      version: '1.0',
      config: {
        header: {
          show: true,
          variant: 'minimal',
          logo: { src: '/logo-core.svg', alt: 'Core', link: '/core' },
          navigation: { show: true, style: 'horizontal', items: [] },
          search: { enabled: true, placeholder: 'Rechercher...' },
        },
        footer: { show: false, variant: 'minimal' },
        navigation: { main: [], breadcrumbs: { enabled: true } },
        widgets: [],
        styles: { theme: 'light', primaryColor: '#3b82f6' },
        responsive: { breakpoints: { mobile: 640, desktop: 1024 } },
        features: { darkMode: false, animations: false },
      },
      is_active: true,
    };

    const massdocConfig: LayoutConfigData = {
      id: 'massdoc-default',
      name: 'Massdoc Layout Default',
      type: 'massdoc',
      version: '1.0',
      config: {
        header: {
          show: true,
          variant: 'extended',
          logo: { src: '/logo-massdoc.svg', alt: 'Massdoc', link: '/massdoc' },
          navigation: { show: true, style: 'mega', items: [] },
          search: { enabled: true, placeholder: 'Rechercher...' },
        },
        footer: { show: true, variant: 'complete' },
        navigation: { main: [], breadcrumbs: { enabled: true } },
        widgets: [],
        styles: { theme: 'light', primaryColor: '#059669' },
        responsive: { breakpoints: { mobile: 640, desktop: 1024 } },
        features: { darkMode: true, animations: true },
      },
      is_active: true,
    };

    return type === 'massdoc' ? massdocConfig : coreConfig;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface LayoutConfigData {
  id: string;
  name: string;
  type: 'core' | 'massdoc' | 'admin' | 'commercial' | 'public';
  version: string;
  config: {
    header: LayoutHeaderConfig;
    footer: LayoutFooterConfig;
    navigation: LayoutNavigationConfig;
    widgets: LayoutWidgetConfig[];
    styles: LayoutStyleConfig;
    responsive: LayoutResponsiveConfig;
    features: LayoutFeatureConfig;
  };
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LayoutHeaderConfig {
  show: boolean;
  variant: 'default' | 'minimal' | 'extended';
  logo: {
    src: string;
    alt: string;
    link: string;
    height?: number;
  };
  navigation: {
    show: boolean;
    style: 'horizontal' | 'dropdown' | 'mega';
    items: NavigationItem[];
  };
  topBar: {
    show: boolean;
    content: {
      phone?: string;
      email?: string;
      social?: SocialLink[];
    };
  };
  search: {
    enabled: boolean;
    placeholder: string;
    modules: string[];
  };
  userMenu: {
    show: boolean;
    position: 'left' | 'right';
  };
}

export interface LayoutFooterConfig {
  show: boolean;
  variant: 'complete' | 'simple' | 'minimal';
  columns: FooterColumn[];
  newsletter: {
    enabled: boolean;
    title: string;
    description: string;
  };
  social: {
    enabled: boolean;
    platforms: SocialLink[];
  };
  legal: {
    enabled: boolean;
    links: LegalLink[];
  };
  copyright: string;
}

export interface LayoutNavigationConfig {
  main: NavigationItem[];
  secondary?: NavigationItem[];
  breadcrumbs: {
    enabled: boolean;
    separator: string;
  };
  contextual?: {
    [key: string]: NavigationItem[];
  };
}

export interface LayoutWidgetConfig {
  id: string;
  type: 'banner' | 'sidebar' | 'content' | 'modal' | 'floating';
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  content: {
    html?: string;
    component?: string;
    data?: any;
  };
  conditions: {
    pages?: string[];
    user_roles?: string[];
    device?: 'mobile' | 'tablet' | 'desktop';
  };
  styles?: {
    css?: string;
    classes?: string[];
  };
  priority: number;
  is_active: boolean;
}

export interface LayoutStyleConfig {
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  secondaryColor: string;
  fonts: {
    primary: string;
    secondary: string;
  };
  spacing: 'compact' | 'normal' | 'relaxed';
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  customCSS?: string;
}

export interface LayoutResponsiveConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
    wide: number;
  };
  behavior: {
    sidebar: 'hidden' | 'collapsed' | 'overlay' | 'push';
    navigation: 'hamburger' | 'tabs' | 'accordion';
    header: 'fixed' | 'sticky' | 'static';
  };
}

export interface LayoutFeatureConfig {
  darkMode: boolean;
  animations: boolean;
  lazyLoading: boolean;
  offline: boolean;
  analytics: {
    enabled: boolean;
    provider: string;
    trackingId?: string;
  };
  seo: {
    enabled: boolean;
    autoMetaTags: boolean;
    structuredData: boolean;
  };
  performance: {
    cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
    prefetch: boolean;
    compression: boolean;
  };
}

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  description?: string;
  children?: NavigationItem[];
  meta?: {
    target?: '_blank' | '_self';
    rel?: string;
    class?: string;
  };
  conditions?: {
    user_roles?: string[];
    permissions?: string[];
  };
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
  label: string;
}

export interface FooterColumn {
  title: string;
  items: Array<{
    label: string;
    url: string;
    external?: boolean;
  }>;
}

export interface LegalLink {
  label: string;
  url: string;
  required?: boolean;
}

@Injectable()
export class LayoutConfigurationService {
  private readonly logger = new Logger(LayoutConfigurationService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Récupère la configuration layout par type et version
   */
  async getLayoutConfiguration(
    type: string,
    version: string = 'latest',
  ): Promise<LayoutConfigData | null> {
    const cacheKey = `layout_config:${type}:${version}`;

    try {
      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<LayoutConfigData>(cacheKey);
      if (cached) {
        this.logger.debug(
          `Configuration layout ${type}:${version} depuis le cache`,
        );
        return cached;
      }

      // Récupérer depuis Supabase
      const { data, error } = await this.supabase
        .getClient()
        .from('layout_configurations')
        .select('*')
        .eq('type', type)
        .eq('version', version)
        .eq('is_active', true)
        .single();

      if (error) {
        this.logger.error(`Erreur récupération config layout ${type}:`, error);
        return await this.getDefaultConfiguration(type);
      }

      // Mettre en cache pour 1 heure
      await this.cacheService.set(cacheKey, data, 3600);

      this.logger.log(
        `Configuration layout ${type}:${version} chargée depuis Supabase`,
      );
      return data;
    } catch (error) {
      this.logger.error(`Erreur getLayoutConfiguration ${type}:`, error);
      return await this.getDefaultConfiguration(type);
    }
  }

  /**
   * Récupère toutes les configurations disponibles
   */
  async getAllConfigurations(): Promise<LayoutConfigData[]> {
    const cacheKey = 'layout_configs:all';
    
    try {
      const cached = await this.cacheService.get<LayoutConfigData[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await this.supabase
        .getClient()
        .from('layout_configurations')
        .select('*')
        .eq('is_active', true)
        .order('type, version');

      if (error) {
        throw error;
      }

      // Cache pour 30 minutes
      await this.cacheService.set(cacheKey, data || [], 1800);
      
      return data || [];

    } catch (error) {
      this.logger.error('Erreur getAllConfigurations:', error);
      return [];
    }
  }

  /**
   * Sauvegarde une configuration layout
   */
  async saveConfiguration(
    config: Partial<LayoutConfigData>,
  ): Promise<LayoutConfigData | null> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('layout_configurations')
        .upsert(config)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Invalider le cache
      await this.invalidateCache(config.type, config.version);

      this.logger.log(
        `Configuration layout ${config.type}:${config.version} sauvegardée`,
      );
      return data;
    } catch (error) {
      this.logger.error('Erreur saveConfiguration:', error);
      return null;
    }
  }

  /**
   * Récupère les widgets pour une page/contexte spécifique
   */
  async getWidgetsForContext(
    type: string,
    page: string,
    userRole?: string
  ): Promise<LayoutWidgetConfig[]> {
    const cacheKey = `layout_widgets:${type}:${page}:${userRole || 'anonymous'}`;
    
    try {
      const cached = await this.cacheService.get<LayoutWidgetConfig[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await this.supabase
        .getClient()
        .from('layout_widgets')
        .select('*')
        .eq('layout_type', type)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        throw error;
      }

      // Filtrer les widgets selon les conditions
      const filteredWidgets = (data || []).filter(widget => {
        // Vérifier les conditions de page
        if (widget.conditions?.pages && !widget.conditions.pages.includes(page)) {
          return false;
        }

        // Vérifier les conditions de rôle utilisateur
        if (widget.conditions?.user_roles && userRole) {
          if (!widget.conditions.user_roles.includes(userRole)) {
            return false;
          }
        }

        return true;
      });

      // Cache pour 15 minutes
      await this.cacheService.set(cacheKey, filteredWidgets, 900);
      
      return filteredWidgets;

    } catch (error) {
      this.logger.error('Erreur getWidgetsForContext:', error);
      return [];
    }
  }

  /**
   * Invalide le cache pour un type/version spécifique
   */
  async invalidateCache(type?: string, version?: string): Promise<void> {
    try {
      if (type && version) {
        await this.cacheService.del(`layout_config:${type}:${version}`);
      } else if (type) {
        // Invalider toutes les versions d'un type
        const keys = await this.cacheService.keys(`layout_config:${type}:*`);
        for (const key of keys) {
          await this.cacheService.del(key);
        }
      } else {
        // Invalider tout le cache layout
        const keys = await this.cacheService.keys('layout_config:*');
        for (const key of keys) {
          await this.cacheService.del(key);
        }
        await this.cacheService.del('layout_configs:all');
      }

      this.logger.log(`Cache layout invalidé${type ? ` pour ${type}` : ''}${version ? `:${version}` : ''}`);

    } catch (error) {
      this.logger.error('Erreur invalidateCache:', error);
    }
  }

  /**
   * Configuration par défaut pour un type donné
   */
  private async getDefaultConfiguration(type: string): Promise<LayoutConfigData> {
    const defaultConfigs: Record<string, LayoutConfigData> = {
      core: {
        id: 'core-default',
        name: 'Core Layout Default',
        type: 'core',
        version: '1.0',
        config: {
          header: {
            show: true,
            variant: 'minimal',
            logo: {
              src: '/logo-core.svg',
              alt: 'Core',
              link: '/core',
            },
            navigation: {
              show: true,
              style: 'horizontal',
              items: [
                { id: '1', label: 'Dashboard', href: '/core/dashboard' },
                { id: '2', label: 'Documents', href: '/core/documents' },
                { id: '3', label: 'Settings', href: '/core/settings' },
              ],
            },
            topBar: { show: false, content: {} },
            search: {
              enabled: true,
              placeholder: 'Rechercher dans Core...',
              modules: ['documents', 'users'],
            },
            userMenu: { show: true, position: 'right' },
          },
          footer: {
            show: false,
            variant: 'minimal',
            columns: [],
            newsletter: { enabled: false, title: '', description: '' },
            social: { enabled: false, platforms: [] },
            legal: { enabled: false, links: [] },
            copyright: '© Core System',
          },
          navigation: {
            main: [
              { id: '1', label: 'Dashboard', href: '/core/dashboard', icon: 'dashboard' },
              { id: '2', label: 'Documents', href: '/core/documents', icon: 'documents' },
            ],
            breadcrumbs: { enabled: true, separator: '>' },
          },
          widgets: [],
          styles: {
            theme: 'light',
            primaryColor: '#3b82f6',
            secondaryColor: '#64748b',
            fonts: { primary: 'Inter', secondary: 'ui-monospace' },
            spacing: 'compact',
            borderRadius: 'small',
          },
          responsive: {
            breakpoints: { mobile: 640, tablet: 768, desktop: 1024, wide: 1280 },
            behavior: {
              sidebar: 'collapsed',
              navigation: 'hamburger',
              header: 'sticky',
            },
          },
          features: {
            darkMode: false,
            animations: false,
            lazyLoading: true,
            offline: false,
            analytics: { enabled: false, provider: '' },
            seo: { enabled: false, autoMetaTags: false, structuredData: false },
            performance: { cacheStrategy: 'aggressive', prefetch: true, compression: true },
          },
        },
        is_active: true,
      },
      massdoc: {
        id: 'massdoc-default',
        name: 'Massdoc Layout Default',
        type: 'massdoc',
        version: '1.0',
        config: {
          header: {
            show: true,
            variant: 'extended',
            logo: {
              src: '/logo-massdoc.svg',
              alt: 'Massdoc',
              link: '/massdoc',
            },
            navigation: {
              show: true,
              style: 'mega',
              items: [
                { id: '1', label: 'Catalogue', href: '/massdoc/catalogue' },
                { id: '2', label: 'Documentation', href: '/massdoc/docs' },
                { id: '3', label: 'Support', href: '/massdoc/support' },
              ],
            },
            topBar: { 
              show: true, 
              content: {
                phone: '+33 1 23 45 67 89',
                email: 'support@massdoc.com',
              },
            },
            search: {
              enabled: true,
              placeholder: 'Rechercher dans Massdoc...',
              modules: ['documents', 'products', 'support'],
            },
            userMenu: { show: true, position: 'right' },
          },
          footer: {
            show: true,
            variant: 'complete',
            columns: [
              {
                title: 'Produits',
                items: [
                  { label: 'Catalogue', url: '/massdoc/catalogue' },
                  { label: 'Solutions', url: '/massdoc/solutions' },
                ],
              },
              {
                title: 'Support',
                items: [
                  { label: 'Documentation', url: '/massdoc/docs' },
                  { label: 'Contact', url: '/massdoc/contact' },
                ],
              },
            ],
            newsletter: { 
              enabled: true, 
              title: 'Newsletter Massdoc',
              description: 'Restez informé des nouveautés',
            },
            social: { enabled: true, platforms: [] },
            legal: { 
              enabled: true, 
              links: [
                { label: 'CGV', url: '/legal/cgv', required: true },
                { label: 'Mentions légales', url: '/legal/mentions', required: true },
              ],
            },
            copyright: '© Massdoc - Tous droits réservés',
          },
          navigation: {
            main: [
              { id: '1', label: 'Catalogue', href: '/massdoc/catalogue', icon: 'catalogue' },
              { id: '2', label: 'Documentation', href: '/massdoc/docs', icon: 'docs' },
            ],
            breadcrumbs: { enabled: true, separator: '/' },
          },
          widgets: [],
          styles: {
            theme: 'light',
            primaryColor: '#059669',
            secondaryColor: '#6b7280',
            fonts: { primary: 'Roboto', secondary: 'Roboto Mono' },
            spacing: 'normal',
            borderRadius: 'medium',
          },
          responsive: {
            breakpoints: { mobile: 640, tablet: 768, desktop: 1024, wide: 1280 },
            behavior: {
              sidebar: 'overlay',
              navigation: 'tabs',
              header: 'fixed',
            },
          },
          features: {
            darkMode: true,
            animations: true,
            lazyLoading: true,
            offline: true,
            analytics: { enabled: true, provider: 'ga4' },
            seo: { enabled: true, autoMetaTags: true, structuredData: true },
            performance: { cacheStrategy: 'moderate', prefetch: true, compression: true },
          },
        },
        is_active: true,
      },
    };

    return defaultConfigs[type] || defaultConfigs.core;
  }
}
