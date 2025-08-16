import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

@Injectable()
export class UserShipmentService extends SupabaseBaseService {
  private readonly logger = new Logger(UserShipmentService.name);

  async getUserShipments(userId: string) {
    try {
      this.logger.log(`Recherche des commandes pour l'utilisateur: ${userId}`);

      // Récupérer les commandes de l'utilisateur spécifique
      const { data: orders, error: ordersError } = await this.supabase
        .from('___xtr_order')
        .select('ord_id, ord_cst_id, ord_total_ttc, ord_date')
        .eq('ord_cst_id', userId)
        .limit(10);

      if (ordersError) {
        this.logger.error('Erreur lors de la récupération des commandes:', ordersError);
        return {
          success: false,
          error: ordersError.message,
          shipments: [],
          count: 0
        };
      }

      if (!orders || orders.length === 0) {
        this.logger.log(`Aucune commande trouvée pour l'utilisateur ${userId}`);
        return {
          success: true,
          shipments: [],
          count: 0,
          message: 'Aucune commande trouvée'
        };
      }

      this.logger.log(`${orders.length} commandes trouvées pour l'utilisateur ${userId}`);

      // Créer des données de suivi simulées pour chaque commande
      const shipments = orders.map((order) => ({
        id: `ship_${order.ord_id}`,
        orderId: order.ord_id,
        orderNumber: `CMD-${order.ord_id}`,
        trackingNumber: `TR${String(order.ord_id).padStart(8, '0')}`,
        status: 'delivered',
        carrier: {
          name: 'Colissimo',
          logo: '/images/carriers/colissimo.png',
        },
        shippedDate: order.ord_date,
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        currentLocation: {
          city: 'Lyon',
          country: 'France',
        },
        lastUpdate: new Date().toISOString(),
        events: [
          {
            status: 'delivered',
            location: 'Lyon',
            timestamp: new Date().toISOString(),
            description: 'Colis livré',
          },
        ],
      }));

      return {
        success: true,
        shipments,
        count: shipments.length,
      };
    } catch (error) {
      this.logger.error('Erreur inattendue:', error);
      return {
        success: false,
        error: error.message,
        shipments: [],
        count: 0,
      };
    }
  }

  async getUserShipmentStats(userId: string) {
    try {
      const result = await this.getUserShipments(userId);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          stats: null,
        };
      }

      const stats = {
        total: result.count,
        delivered: result.count,
        inTransit: 0,
        pending: 0,
      };

      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error('Erreur lors du calcul des statistiques:', error);
      return {
        success: false,
        error: error.message,
        stats: null,
      };
    }
  }
}
