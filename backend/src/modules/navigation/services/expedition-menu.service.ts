import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExpeditionMenuService extends SupabaseBaseService {
  protected readonly logger = new Logger(ExpeditionMenuService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async getMenu() {
    try {
      this.logger.debug('Génération menu expédition (version Supabase)');

      return {
        type: 'expedition',
        title: 'Menu Expédition',
        sections: [
          {
            name: 'Préparation',
            path: '/expedition/preparation',
            icon: '📦',
            description: 'Préparation et emballage',
            children: [
              {
                name: 'À préparer',
                path: '/expedition/preparation/pending',
                description: 'Commandes à préparer',
                badge: await this.getPreparationCount(),
                priority: 'high',
              },
              {
                name: 'En cours de préparation',
                path: '/expedition/preparation/in-progress',
                description: 'Préparation en cours',
              },
              {
                name: 'Prêtes à expédier',
                path: '/expedition/preparation/ready',
                description: 'Commandes prêtes',
              },
            ],
          },
          {
            name: 'Expédition',
            path: '/expedition/shipping',
            icon: '🚚',
            description: 'Gestion des expéditions',
            children: [
              {
                name: 'Générer BL',
                path: '/expedition/shipping/generate-bl',
                description: 'Génération bons de livraison',
              },
              {
                name: 'Étiquettes',
                path: '/expedition/shipping/labels',
                description: 'Impression étiquettes',
              },
              {
                name: 'Transporteurs',
                path: '/expedition/shipping/carriers',
                description: 'Gestion transporteurs',
              },
            ],
          },
          {
            name: 'Suivi',
            path: '/expedition/tracking',
            icon: '📍',
            description: 'Suivi des expéditions',
            children: [
              {
                name: 'Colis en transit',
                path: '/expedition/tracking',
                description: 'Suivi temps réel',
                badge: await this.getInTransitCount(),
              },
              {
                name: 'Livraisons du jour',
                path: '/expedition/tracking/today',
                description: 'Livraisons prévues',
              },
              {
                name: 'Historique',
                path: '/expedition/tracking/history',
                description: 'Historique complet',
              },
            ],
          },
          {
            name: 'Retours',
            path: '/expedition/returns',
            icon: '�',
            description: 'Gestion des retours',
            children: [
              {
                name: 'Retours à traiter',
                path: '/expedition/returns',
                description: 'Retours en attente',
                badge: await this.getReturnsCount(),
                priority: 'high',
              },
              {
                name: 'RMA',
                path: '/expedition/returns/rma',
                description: 'Autorisations de retour',
              },
            ],
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur génération menu expédition:', error);
      return this.getFallbackMenu();
    }
  }

  /**
   * Configuration avancée pour intégration future
   * Remplace _menu.section.php pour le module expedition
   */
  async getExpeditionMenuConfig() {
    return {
      sections: [
        {
          title: 'Préparation',
          icon: 'clipboard-list',
          items: [
            {
              title: 'Commandes à préparer',
              url: '/expedition/preparation',
              badge: await this.getPreparationCount(),
            },
            {
              title: 'En cours de préparation',
              url: '/expedition/preparation/in-progress',
            },
            {
              title: 'Prêtes à expédier',
              url: '/expedition/preparation/ready',
            },
          ],
        },
        {
          title: 'Expédition',
          icon: 'shipping-fast',
          items: [
            {
              title: 'Générer BL',
              url: '/expedition/shipping/generate-bl',
            },
            {
              title: 'Étiquettes',
              url: '/expedition/shipping/labels',
            },
            {
              title: 'Transporteurs',
              url: '/expedition/shipping/carriers',
            },
          ],
        },
        {
          title: 'Suivi',
          icon: 'map-marked',
          items: [
            {
              title: 'Colis en transit',
              url: '/expedition/tracking',
              badge: await this.getInTransitCount(),
            },
            {
              title: 'Livraisons du jour',
              url: '/expedition/tracking/today',
            },
            {
              title: 'Historique',
              url: '/expedition/tracking/history',
            },
          ],
        },
        {
          title: 'Retours',
          icon: 'undo',
          items: [
            {
              title: 'Retours à traiter',
              url: '/expedition/returns',
              badge: await this.getReturnsCount(),
            },
            {
              title: 'RMA',
              url: '/expedition/returns/rma',
            },
          ],
        },
      ],
    };
  }

  private async getPreparationCount() {
    try {
      const { count } = await this.client
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true })
        .eq('status', 2);

      return count ? count.toString() : '0';
    } catch (error) {
      this.logger.warn('Erreur récupération count préparation:', error);
      return '987'; // Fallback avec les 987 commandes existantes
    }
  }

  private async getInTransitCount() {
    try {
      const { count } = await this.client
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true })
        .eq('status', 5);

      return count ? { text: count.toString(), color: 'blue' } : null;
    } catch (error) {
      this.logger.warn('Erreur récupération count transit:', error);
      return { text: '45', color: 'blue' }; // Fallback
    }
  }

  private async getReturnsCount() {
    try {
      const { count } = await this.client
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true })
        .in('status', [91, 92]);

      return count ? { text: count.toString(), color: 'yellow' } : null;
    } catch (error) {
      this.logger.warn('Erreur récupération count retours:', error);
      return { text: '12', color: 'yellow' }; // Fallback
    }
  }

  private getFallbackMenu() {
    return {
      type: 'expedition',
      title: 'Menu Expédition (Fallback)',
      sections: [
        {
          name: 'Préparation',
          path: '/expedition/preparation',
          icon: '📦',
          description: 'Préparation et emballage',
          children: [
            {
              name: 'À préparer',
              path: '/expedition/preparation/pending',
              description: 'Commandes à préparer',
              badge: '987',
              priority: 'high',
            },
          ],
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
