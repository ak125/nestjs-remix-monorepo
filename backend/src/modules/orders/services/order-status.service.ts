import { Injectable } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/**
 * Historique de statut commande.
 *
 * F3 (audit runtime-truth 2026-05-22, governance-vault PR #301) : ce service portait
 * un DOUBLON cassé de la machine d'état statut — enum modèle-colis faux
 * (SHIPPED/DELIVERED/RETURNED/REFUNDED) contredisant la vérité DB `___xtr_order_line_status`
 * (statut-pièce + workflow équivalence 91-94), et des méthodes lisant/écrivant des colonnes
 * inexistantes (`id`/`status`/`order_id` vs `orl_*`/`orl_orls_id`), insérant l'historique de
 * ligne dans une table de **lookup**. La SoT statut ligne réelle = `OrderActionsService`
 * (colonnes `orl_*`, events `ORDER_EVENTS.LINE_STATUS_CHANGED` + audit trail).
 *
 * Le `OrderStatusController` (`/order-status/*`, non appelé par le front) et toute la
 * state-machine cassée + l'enum faux ont été RETIRÉS. Seul `createStatusHistory`
 * (consommé par `OrdersService`) subsiste.
 */
@Injectable()
export class OrderStatusService extends SupabaseBaseService {
  constructor() {
    super();
  }

  /**
   * Libellé d'un statut (pour le commentaire d'historique).
   */
  private getStatusLabel(status: number): string {
    const labels: Record<number, string> = {
      1: 'En attente',
      2: 'Confirmée',
      3: 'En préparation',
      4: 'Prête',
      5: 'Expédiée',
      6: 'Livrée',
      91: 'Annulée client',
      92: 'Annulée stock',
      93: 'Retour',
      94: 'Remboursée',
    };
    return labels[status] || 'Inconnu';
  }

  /**
   * Créer un historique de statut pour une commande.
   */
  async createStatusHistory(
    orderId: number,
    status: number,
    comment?: string,
    userId?: number,
  ): Promise<void> {
    const { error } = await this.supabase.from(TABLES.xtr_order_status).insert({
      order_id: orderId,
      status: status,
      comment: comment || `Statut changé vers ${this.getStatusLabel(status)}`,
      user_id: userId || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      this.logger.error('Erreur création historique:', error);
      throw error;
    }
  }
}
