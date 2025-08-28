import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

export interface MenuItem {
  id: number;
  title: string;
  url?: string;
  icon?: string;
  component?: string;
  children?: MenuItem[];
  badge?: {
    text: string;
    color: string;
  };
  metadata?: Record<string, any>;
}

export interface MenuConfig {
  module: 'commercial' | 'expedition' | 'seo' | 'staff' | 'admin';
  userRole?: string;
  userId?: string;
}

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Génère la navigation complète de l'application
   */
  async getMainNavigation(context: 'admin' | 'user' | 'commercial' = 'user') {
    try {
      const cacheKey = `navigation:${context}`;
      
      // Essayer de récupérer depuis le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Navigation ${context} servie depuis le cache`);
        return cached;
      }

      // Générer la navigation selon le contexte
      const navigation = await this.buildNavigationForContext(context);

      // Mettre en cache pour 10 minutes
      await this.cacheService.set(cacheKey, navigation, 600);
      
      this.logger.log(`Navigation ${context} générée et mise en cache`);
      return navigation;
    } catch (error) {
      this.logger.error('Erreur lors de la génération de la navigation:', error);
      throw error;
    }
  }

  private async buildNavigationForContext(context: string) {
    const baseNavigation = {
      timestamp: new Date().toISOString(),
      context,
      sections: []
    };

    switch (context) {
      case 'admin':
        return {
          ...baseNavigation,
          sections: [
            {
              name: 'Dashboard',
              path: '/admin',
              icon: '📊',
              description: 'Vue d\'ensemble et métriques'
            },
            {
              name: 'A/B Testing',
              path: '/admin/checkout-ab-test',
              icon: '🚀',
              description: 'Tests de conversion checkout',
              badge: '987 commandes'
            },
            {
              name: 'Commandes',
              path: '/admin/orders',
              icon: '📦',
              description: 'Gestion des commandes'
            },
            {
              name: 'Staff',
              path: '/admin/staff',
              icon: '👥',
              description: 'Administration du personnel'
            }
          ]
        };
        
      case 'commercial':
        return {
          ...baseNavigation,
          sections: [
            {
              name: 'Catalogue',
              path: '/catalog',
              icon: '🛍️',
              description: 'Produits et services'
            },
            {
              name: 'Mon Panier',
              path: '/cart',
              icon: '🛒',
              description: 'Panier d\'achat'
            }
          ]
        };
        
      default:
        return {
          ...baseNavigation,
          sections: [
            {
              name: 'Accueil',
              path: '/',
              icon: '🏠',
              description: 'Page d\'accueil'
            }
          ]
        };
    }
  }

  /**
   * Invalide le cache de navigation
   */
  async invalidateCache(context?: string) {
    try {
      if (context) {
        await this.cacheService.del(`navigation:${context}`);
        this.logger.log(`Cache navigation invalidé pour ${context}`);
      } else {
        // Invalider tous les caches de navigation
        const contexts = ['admin', 'user', 'commercial'];
        await Promise.all(
          contexts.map((ctx) => this.cacheService.del(`navigation:${ctx}`)),
        );
        this.logger.log('Cache navigation invalidé pour tous les contextes');
      }
    } catch (error) {
      this.logger.error("Erreur lors de l'invalidation du cache:", error);
      throw error;
    }
  }

  /**
   * Récupérer le menu complet pour un module avec support avancé
   */
  async getMenuByModule(config: MenuConfig): Promise<MenuItem[]> {
    const cacheKey = `menu:${config.module}:${config.userRole || 'public'}`;
    const cached = await this.cacheService.get<MenuItem[]>(cacheKey);

    if (cached) {
      this.logger.debug(`Menu ${config.module} servi depuis le cache`);
      return cached;
    }

    // Pour l'instant, on utilise des données statiques
    // TODO: Remplacer par un appel Supabase quand les tables seront disponibles
    const menuItems = await this.buildStaticMenuForModule(config);

    await this.cacheService.set(cacheKey, menuItems, 600);
    this.logger.log(`Menu ${config.module} généré et mis en cache`);

    return menuItems;
  }

  /**
   * Construction statique des menus en attendant l'intégration Supabase
   */
  private async buildStaticMenuForModule(config: MenuConfig): Promise<MenuItem[]> {
    switch (config.module) {
      case 'admin':
        return [
          {
            id: 1,
            title: 'Dashboard',
            url: '/admin',
            icon: '📊',
            children: [],
          },
          {
            id: 2,
            title: 'A/B Testing',
            url: '/admin/checkout-ab-test',
            icon: '🚀',
            badge: {
              text: '987',
              color: 'red',
            },
            children: [],
          },
          {
            id: 3,
            title: 'Commandes',
            url: '/admin/orders',
            icon: '📦',
            children: [
              {
                id: 31,
                title: 'En attente',
                url: '/admin/orders/pending',
                icon: '⏳',
                badge: {
                  text: '987',
                  color: 'orange',
                },
                children: [],
              },
              {
                id: 32,
                title: 'Terminées',
                url: '/admin/orders/completed',
                icon: '✅',
                children: [],
              },
            ],
          },
        ];

      case 'commercial':
        return [
          {
            id: 10,
            title: 'Catalogue',
            url: '/commercial/catalog',
            icon: '🛍️',
            children: [
              {
                id: 101,
                title: 'Tous les produits',
                url: '/commercial/catalog/products',
                children: [],
              },
              {
                id: 102,
                title: 'Promotions',
                url: '/commercial/catalog/promotions',
                badge: {
                  text: 'Nouveau',
                  color: 'green',
                },
                children: [],
              },
            ],
          },
          {
            id: 11,
            title: 'Ventes',
            url: '/commercial/sales',
            icon: '💰',
            children: [],
          },
        ];

      case 'seo':
        return [
          {
            id: 20,
            title: 'Analytics',
            url: '/seo/analytics',
            icon: '📈',
            children: [],
          },
          {
            id: 21,
            title: 'A/B Testing',
            url: '/seo/ab-testing',
            icon: '🧪',
            badge: {
              text: 'Actif',
              color: 'blue',
            },
            children: [],
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Obtenir les préférences utilisateur (placeholder)
   */
  async getUserMenuPreferences(userId: string, menuId: number) {
    const cacheKey = `menu:preferences:${userId}:${menuId}`;
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Valeurs par défaut
    const preferences = {
      collapsed_items: [],
      favorite_items: [],
      hidden_items: [],
    };

    await this.cacheService.set(cacheKey, preferences, 3600); // 1 heure
    return preferences;
  }

  /**
   * Sauvegarder les préférences utilisateur (placeholder)
   */
  async saveUserMenuPreferences(
    userId: string,
    menuId: number,
    preferences: any,
  ) {
    const cacheKey = `menu:preferences:${userId}:${menuId}`;

    // Sauvegarder en cache (en attendant l'intégration Supabase)
    await this.cacheService.set(cacheKey, {
      ...preferences,
      updated_at: new Date().toISOString(),
    }, 3600);

    this.logger.log(`Préférences sauvegardées pour user ${userId}, menu ${menuId}`);
  }
}
