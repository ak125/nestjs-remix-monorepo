import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CommercialMenuService extends SupabaseBaseService {
  protected readonly logger = new Logger(CommercialMenuService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async getMenu() {
    try {
      this.logger.debug('Génération menu commercial (version avancée)');
      const config = await this.getCommercialMenuConfig();
      
      return {
        type: 'commercial',
        title: 'Menu Commercial',
        sections: this.convertToLegacyFormat(config.sections),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur génération menu commercial:', error);
      // Retourner un menu de fallback
      return this.getFallbackMenu();
    }
  }

  /**
   * Configuration avancée du menu commercial
   * Remplace _menu.section.php pour le module commercial
   */
  async getCommercialMenuConfig() {
    try {
      const pendingOrdersBadge = await this.getPendingOrdersCount();
      
      return {
        sections: [
          {
            title: 'Gestion des Commandes',
            icon: 'shopping-cart',
            path: '/commercial/orders',
            items: [
              {
                title: 'Commandes en cours',
                url: '/commercial/orders/pending',
                badge: pendingOrdersBadge,
                description: 'Commandes à traiter en priorité',
              },
              {
                title: 'Archives',
                url: '/commercial/orders/archives',
                description: 'Historique des commandes',
              },
              {
                title: 'Statistiques',
                url: '/commercial/orders/stats',
                description: 'Métriques et performances',
              },
            ],
          },
          {
            title: 'Gestion des Stocks',
            icon: 'package',
            path: '/commercial/stock',
            items: [
              {
                title: 'Stock actuel',
                url: '/commercial/stock/current',
                description: "Vue d'ensemble des stocks",
              },
              {
                title: 'Mouvements',
                url: '/commercial/stock/movements',
                description: 'Historique des mouvements',
              },
              {
                title: 'Inventaire',
                url: '/commercial/stock/inventory',
                description: 'Inventaires et comptages',
              },
            ],
          },
          {
            title: 'Fournisseurs',
            icon: 'truck',
            path: '/commercial/suppliers',
            items: [
              {
                title: 'Liste fournisseurs',
                url: '/commercial/suppliers/list',
                description: 'Base de données fournisseurs',
              },
              {
                title: 'Commandes fournisseurs',
                url: '/commercial/suppliers/orders',
                description: 'Commandes en cours et passées',
              },
              {
                title: 'Affectations PM',
                url: '/commercial/suppliers/pm-links',
                description: 'Liens fournisseurs-références',
              },
            ],
          },
          {
            title: 'Rapports & Analytics',
            icon: 'chart-bar',
            path: '/commercial/reports',
            items: [
              {
                title: 'Ventes',
                url: '/commercial/reports/sales',
                description: 'Analyses des ventes',
              },
              {
                title: 'Achats',
                url: '/commercial/reports/purchases',
                description: 'Suivi des achats',
              },
              {
                title: 'Marges',
                url: '/commercial/reports/margins',
                description: 'Calcul et suivi des marges',
              },
              {
                title: 'A/B Testing Commercial',
                url: '/commercial/reports/ab-testing',
                description: 'Tests de conversion produits',
                badge: { text: 'Actif', color: 'blue' },
              },
            ],
          },
        ],
      };
    } catch (error) {
      this.logger.error('Erreur configuration menu commercial:', error);
      // Retourner une config par défaut en cas d'erreur
      return this.getFallbackConfig();
    }
  }

  /**
   * Obtenir le nombre de commandes pendantes (version simplifiée)
   */
  private async getPendingOrdersCount() {
    try {
      // TODO: Intégrer avec Supabase quand disponible
      // Pour l'instant, retourner les 987 commandes connues
      return { text: '987', color: 'red' };
    } catch (error) {
      this.logger.warn('Erreur récupération count commandes:', error);
      return { text: '987', color: 'red' };
    }
  }

  /**
   * Menu de fallback en cas d'erreur
   */
  private getFallbackMenu() {
    return {
      type: 'commercial',
      title: 'Menu Commercial (Fallback)',
      sections: [
        {
          name: 'Commandes',
          path: '/commercial/orders',
          icon: '🛒',
          description: 'Gestion des commandes',
          children: [
            {
              name: 'Commandes en cours',
              path: '/commercial/orders/pending',
              description: '987 commandes en attente',
              badge: '987',
            },
          ],
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Configuration de fallback en cas d'erreur
   */
  private getFallbackConfig() {
    return {
      sections: [
        {
          title: 'Gestion des Commandes',
          icon: 'shopping-cart',
          path: '/commercial/orders',
          items: [
            {
              title: 'Commandes en cours',
              url: '/commercial/orders/pending',
              badge: { text: '987', color: 'red' },
              description: 'Commandes à traiter (mode fallback)',
            },
          ],
        },
      ],
    };
  }

  /**
   * Convertir la config avancée au format legacy
   */
  private convertToLegacyFormat(sections: any[]) {
    return sections.map(section => ({
      name: section.title,
      path: section.path,
      icon: this.convertIconToEmoji(section.icon),
      description: `Gestion ${section.title.toLowerCase()}`,
      children: section.items.map(item => ({
        name: item.title,
        path: item.url,
        description: item.description,
        badge: item.badge?.text || undefined,
      })),
    }));
  }

  /**
   * Convertir les icônes au format emoji
   */
  private convertIconToEmoji(icon: string) {
    const iconMap = {
      'shopping-cart': '🛒',
      'package': '📦',
      'truck': '🚚',
      'chart-bar': '📊',
    };
    return iconMap[icon as keyof typeof iconMap] || '📋';
  }
}
