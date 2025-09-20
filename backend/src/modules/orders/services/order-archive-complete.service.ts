import { Injectable } from '@nestjs/common';
import { OrdersServiceEnhanced } from './orders-enhanced-minimal.service';

@Injectable()
export class OrderArchiveCompleteService {
  constructor(private readonly ordersService: OrdersServiceEnhanced) {}

  /**
   * Vérifier si une commande est archivée (statut final simplifié)
   */
  private isOrderArchived(order: any): boolean {
    if (!order) return false;

    // Statuts finaux simulés
    const finalStatuses = [6, 91, 92, 94];
    return finalStatuses.includes(parseInt(order.status || '0'));
  }

  /**
   * Obtenir une commande archivée spécifique
   */
  async getArchivedOrder(orderId: number): Promise<any> {
    try {
      const order = await this.ordersService.getOrderById(orderId);

      if (!order || !this.isOrderArchived(order)) {
        return null;
      }

      return {
        id: order.id,
        orderNumber: order.order_number,
        customer: {
          id: order.customer_id,
          name: 'Client Test',
          email: 'test@example.com',
        },
        status: {
          id: order.status,
          name: this.getStatusName(parseInt(order.status || '0')),
        },
        dates: {
          created: order.created_at,
          archived: new Date().toISOString(),
          updated: order.updated_at,
        },
        amounts: {
          totalHT: parseFloat(order.total_ht || '0'),
          totalTTC: parseFloat(order.total_ttc || '0'),
          shipping: parseFloat(order.shipping_cost || '0'),
        },
        lines: order.orderLines || [],
        tickets: [],
        invoices: [],
      };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération de la commande archivée:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(`Erreur base de données: ${errorMessage}`);
    }
  }

  /**
   * Lister les commandes archivées d'un client (simulation)
   */
  async listArchivedOrders(
    customerId: number,
    page = 1,
    limit = 10,
  ): Promise<any> {
    try {
      // Simulation - dans un vrai système, on ferait une requête filtrée
      const mockArchivedOrders = Array.from({ length: 3 }, (_, i) => ({
        id: i + 1,
        orderNumber: `CMD202508110${i + 1}`,
        status: {
          id: 6,
          name: this.getStatusName(6),
        },
        dates: {
          created: new Date().toISOString(),
          archived: new Date().toISOString(),
        },
        totalTTC: 100 + i * 50,
      }));

      return {
        orders: mockArchivedOrders.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total: mockArchivedOrders.length,
          totalPages: Math.ceil(mockArchivedOrders.length / limit),
        },
      };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des commandes archivées:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(`Erreur base de données: ${errorMessage}`);
    }
  }

  /**
   * Préparer l'export PDF d'une commande archivée
   */
  async exportOrderForPdf(orderId: number): Promise<any> {
    try {
      const archivedOrder = await this.getArchivedOrder(orderId);

      if (!archivedOrder) {
        throw new Error('Commande archivée non trouvée');
      }

      return {
        exportReady: true,
        order: archivedOrder,
        metadata: {
          exportDate: new Date().toISOString(),
          exportType: 'PDF',
          fileName: `order_${archivedOrder.orderNumber}_archive.pdf`,
        },
      };
    } catch (error) {
      console.error("Erreur lors de la préparation de l'export PDF:", error);
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(`Erreur export: ${errorMessage}`);
    }
  }

  /**
   * Obtenir les statistiques d'archivage pour un client
   */
  async getArchiveStats(customerId: number): Promise<any> {
    try {
      // Statistiques simulées
      return {
        total_archived: 5,
        delivered: 3,
        cancelled: 1,
        refunded: 1,
        total_delivered_amount: 350.0,
        first_order_year: 2024,
        last_order_year: 2025,
      };
    } catch (error) {
      console.error(
        "Erreur lors du calcul des statistiques d'archivage:",
        error,
      );
      return {
        total_archived: 0,
        delivered: 0,
        cancelled: 0,
        refunded: 0,
        total_delivered_amount: 0,
        first_order_year: null,
        last_order_year: null,
      };
    }
  }

  /**
   * Archiver une commande (simulation)
   */
  async archiveOrder(orderId: number): Promise<boolean> {
    try {
      console.log(`Simulation archivage commande ${orderId}`);
      return true;
    } catch (error) {
      console.error("Erreur lors de l'archivage de la commande:", error);
      return false;
    }
  }

  /**
   * Restaurer une commande archivée (simulation)
   */
  async restoreOrder(orderId: number): Promise<boolean> {
    try {
      console.log(`Simulation restauration commande ${orderId}`);
      return true;
    } catch (error) {
      console.error('Erreur lors de la restauration de la commande:', error);
      return false;
    }
  }

  /**
   * Obtenir le nom d'un statut
   */
  private getStatusName(statusId: number): string {
    const statusNames: Record<number, string> = {
      1: 'En attente',
      2: 'Confirmée',
      3: 'En préparation',
      4: 'Expédiée',
      5: 'En livraison',
      6: 'Livrée',
      91: 'Annulée (client)',
      92: 'Annulée (magasin)',
      93: 'Retournée',
      94: 'Remboursée',
    };
    return statusNames[statusId] || `Statut ${statusId}`;
  }
}
