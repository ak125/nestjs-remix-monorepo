import { Injectable, BadRequestException } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export enum OrderLineStatusCode {
  PENDING = 1, // En attente
  CONFIRMED = 2, // Confirmée
  PREPARING = 3, // En préparation
  READY = 4, // Prête
  SHIPPED = 5, // Expédiée
  DELIVERED = 6, // Livrée
  CANCELLED_CLIENT = 91, // Annulée client
  CANCELLED_STOCK = 92, // Annulée stock
  RETURNED = 93, // Retour
  REFUNDED = 94, // Remboursée
}

@Injectable()
export class OrderStatusService extends SupabaseBaseService {
  constructor() {
    super();
  }

  // Machine d'état des transitions autorisées
  private readonly statusTransitions = new Map<number, number[]>([
    [1, [2, 91, 92]], // En attente -> Confirmée, Annulée
    [2, [3, 91, 92]], // Confirmée -> En préparation, Annulée
    [3, [4, 91, 92]], // En préparation -> Prête, Annulée
    [4, [5, 91]], // Prête -> Expédiée, Annulée client
    [5, [6, 93]], // Expédiée -> Livrée, Retour
    [6, [93]], // Livrée -> Retour
    [91, []], // Annulée client -> Terminal
    [92, []], // Annulée stock -> Terminal
    [93, [94]], // Retour -> Remboursée
    [94, []], // Remboursée -> Terminal
  ]);

  /**
   * Mettre à jour le statut d'une ligne (équivalent commande.line.status.X.php)
   */
  async updateLineStatus(
    lineId: number,
    newStatus: number,
    comment?: string,
    userId?: number,
  ): Promise<Record<string, unknown>> {
    try {
      // Récupérer la ligne actuelle avec Supabase
      const { data: currentLine, error: fetchError } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('*')
        .eq('id', lineId)
        .single();

      if (fetchError || !currentLine) {
        throw new BadRequestException('Ligne de commande introuvable');
      }

      // Vérifier la transition
      if (!this.canTransition(currentLine.status, newStatus)) {
        throw new BadRequestException(
          `Transition impossible de ${currentLine.status} vers ${newStatus}`,
        );
      }

      // Mettre à jour la ligne avec Supabase
      const { data: updatedLine, error: updateError } = await this.supabase
        .from(TABLES.xtr_order_line)
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lineId)
        .select()
        .single();

      if (updateError) {
        this.logger.error('Erreur mise à jour ligne:', updateError);
        throw updateError;
      }

      // Créer l'historique de statut
      const { error: historyError } = await this.supabase
        .from('___xtr_order_line_status')
        .insert({
          order_line_id: lineId,
          previous_status: currentLine.status,
          new_status: newStatus,
          comment: comment || '',
          user_id: userId || null,
          created_at: new Date().toISOString(),
        });

      if (historyError) {
        this.logger.error('Erreur historique statut:', historyError);
        throw historyError;
      }

      // Actions spécifiques selon le statut
      await this.executeStatusActions(currentLine, newStatus);

      // Vérifier si toutes les lignes ont le même statut
      await this.checkAndUpdateOrderStatus(currentLine.order_id);

      return updatedLine;
    } catch (error) {
      this.logger.error('Erreur updateLineStatus:', error);
      throw error;
    }
  }

  /**
   * Actions spécifiques pour chaque statut (version simplifiée)
   */
  private async executeStatusActions(
    _line: any,
    status: number,
  ): Promise<void> {
    // Version simplifiée - TODO: Réimplémenter avec Supabase
    this.logger.log(
      `Action statut ${status} - TODO: implémenter avec Supabase`,
    );
  }

  /**
   * Vérifier si une transition est autorisée
   */
  private canTransition(currentStatus: number, targetStatus: number): boolean {
    const allowedTransitions = this.statusTransitions.get(currentStatus);
    return allowedTransitions?.includes(targetStatus) || false;
  }

  /**
   * Obtenir le libellé d'un statut
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
   * Mettre à jour le statut global de la commande
   */
  private async checkAndUpdateOrderStatus(orderId: number): Promise<void> {
    const { data: lines, error } = await this.supabase
      .from(TABLES.xtr_order_line)
      .select('status')
      .eq('order_id', orderId);

    if (error) {
      this.logger.error('Erreur récupération lignes commande:', error);
      return;
    }

    // Si toutes les lignes ont le même statut
    const allSameStatus = lines?.every(
      (l: any) => l.status === lines[0].status,
    );

    if (allSameStatus && lines && lines.length > 0) {
      const globalStatus = this.mapLineStatusToOrderStatus(lines[0].status);

      const { error: updateError } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          status: globalStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) {
        this.logger.error('Erreur mise à jour statut commande:', updateError);
        return;
      }

      const { error: historyError } = await this.supabase
        .from(TABLES.xtr_order_status)
        .insert({
          order_id: orderId,
          status: globalStatus,
          comment: 'Mise à jour automatique',
          created_at: new Date().toISOString(),
        });

      if (historyError) {
        this.logger.error('Erreur historique commande:', historyError);
      }
    }
  }

  /**
   * Mapper le statut ligne vers statut commande
   */
  private mapLineStatusToOrderStatus(lineStatus: number): number {
    const mapping: Record<number, number> = {
      1: 1, // En attente
      2: 2, // Confirmée
      3: 3, // En préparation
      4: 3, // En préparation (prête)
      5: 4, // Expédiée
      6: 5, // Livrée
      91: 91, // Annulée
      92: 91, // Annulée
      93: 93, // Retour
      94: 94, // Remboursée
    };
    return mapping[lineStatus] || lineStatus;
  }

  /**
   * Obtenir les informations d'un statut (compatibilité existante)
   */
  getStatusInfo(status: number): {
    label: string;
    color: string;
    isFinal: boolean;
    isActive: boolean;
  } {
    return {
      label: this.getStatusLabel(status),
      color: this.getStatusColor(status),
      isFinal: this.isFinalStatus(status),
      isActive: this.isActiveStatus(status),
    };
  }

  /**
   * Obtenir la couleur d'un statut
   */
  getStatusColor(status: number): string {
    const colors: Record<number, string> = {
      1: '#fbbf24', // En attente - jaune
      2: '#3b82f6', // Confirmée - bleu
      3: '#8b5cf6', // En préparation - violet
      4: '#059669', // Prête - vert
      5: '#f59e0b', // Expédiée - orange
      6: '#10b981', // Livrée - vert
      91: '#ef4444', // Annulée client - rouge
      92: '#ef4444', // Annulée stock - rouge
      93: '#f59e0b', // Retour - orange
      94: '#6b7280', // Remboursée - gris
    };
    return colors[status] || '#6b7280';
  }

  /**
   * Vérifier si un statut est final
   */
  isFinalStatus(status: number): boolean {
    return [6, 91, 92, 94].includes(status); // Livrée, Annulées, Remboursée
  }

  /**
   * Vérifier si un statut est actif
   */
  isActiveStatus(status: number): boolean {
    return [1, 2, 3, 4, 5].includes(status); // Statuts en cours de traitement
  }

  /**
   * Obtenir tous les statuts disponibles
   */
  getAllStatuses(): number[] {
    return Object.values(OrderLineStatusCode).filter(
      (v) => typeof v === 'number',
    ) as number[];
  }

  /**
   * Créer un historique de statut pour une commande (version simplifiée)
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

  /**
   * Récupérer l'historique des statuts d'une commande (version simplifiée)
   * TODO: Créer une vraie table d'historique (ex: ___xtr_order_history)
   * Note: ___xtr_order_status est une table de référence des statuts, pas d'historique
   */
  async getOrderStatusHistory(orderId: number): Promise<any[]> {
    // Temporairement désactivé car ___xtr_order_status n'a pas de colonne order_id
    // C'est une table de référence (enum) des statuts possibles
    this.logger.warn(
      `Historique des statuts non disponible pour commande ${orderId} - table d'historique à créer`,
    );
    return [];

    /* Code original à réactiver une fois la table d'historique créée
    const { data, error } = await this.supabase
      .from('___xtr_order_history')  // Utiliser une vraie table d'historique
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Erreur récupération historique:', error);
      throw error;
    }

    return data || [];
    */
  }
}
