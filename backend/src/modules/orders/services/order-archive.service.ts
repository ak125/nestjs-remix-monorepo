import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';

export interface ArchiveFilters {
  customerId?: number;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Service d'Archivage des Commandes - Version Consolidée
 *
 * Responsabilités:
 * - Archivage commandes anciennes
 * - Restauration commandes archivées
 * - Export données (PDF, JSON, CSV)
 * - Statistiques archives
 * - Nettoyage données temporaires
 */
@Injectable()
export class OrderArchiveService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderArchiveService.name);

  constructor() {
    super();
  }

  /**
   * Archiver une commande
   */
  async archiveOrder(orderId: number): Promise<any> {
    try {
      this.logger.log(`Archivage commande #${orderId}`);

      // Vérifier existence
      const { data: order, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error || !order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      // Marquer comme archivée
      const { error: updateError } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      if (updateError) {
        throw new DatabaseException({
          code: ErrorCodes.ORDER.ARCHIVE_FAILED,
          message: `Échec archivage: ${updateError.message}`,
          details: updateError.message,
          cause: updateError instanceof Error ? updateError : undefined,
        });
      }

      this.logger.log(`Commande #${orderId} archivée`);
      return { success: true, message: 'Commande archivée' };
    } catch (error: any) {
      this.logger.error(`Erreur archiveOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Restaurer une commande archivée
   */
  async restoreOrder(orderId: number): Promise<any> {
    try {
      this.logger.log(`Restauration commande #${orderId}`);

      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          is_archived: false,
          archived_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ORDER.RESTORE_FAILED,
          message: `Échec restauration: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }

      this.logger.log(`Commande #${orderId} restaurée`);
      return { success: true, message: 'Commande restaurée' };
    } catch (error: any) {
      this.logger.error(`Erreur restoreOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Récupérer une commande archivée par ID
   */
  async getArchivedOrder(orderId: number): Promise<any> {
    try {
      this.logger.log(`Récupération commande archivée #${orderId}`);

      const { data: order, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*')
        .eq('order_id', orderId)
        .eq('is_archived', true)
        .single();

      if (error || !order) {
        throw new NotFoundException(
          `Commande archivée #${orderId} introuvable`,
        );
      }

      // Récupérer les lignes
      const { data: lines } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('*')
        .eq('order_id', orderId);

      // Récupérer l'historique
      const { data: statusHistory } = await this.supabase
        .from(TABLES.xtr_order_status)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      return {
        ...order,
        lines: lines || [],
        statusHistory: statusHistory || [],
      };
    } catch (error: any) {
      this.logger.error(`Erreur getArchivedOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Lister les commandes archivées
   */
  async listArchivedOrders(filters: ArchiveFilters = {}): Promise<any> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from(TABLES.xtr_order)
        .select(
          '*, customer:customer_id(cst_id, cst_mail, cst_fname, cst_name)',
          {
            count: 'exact',
          },
        )
        .eq('is_archived', true);

      if (filters.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }

      if (filters.startDate) {
        query = query.gte('archived_at', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('archived_at', filters.endDate.toISOString());
      }

      query = query
        .range(offset, offset + limit - 1)
        .order('archived_at', { ascending: false });

      const { data: orders, error, count } = await query;

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ORDER.ARCHIVE_FAILED,
          message: `Erreur récupération archives: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }

      return {
        data: orders || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error: any) {
      this.logger.error('Erreur listArchivedOrders:', error);
      throw error;
    }
  }

  /**
   * Exporter une commande pour PDF
   */
  async exportOrderForPdf(orderId: number): Promise<any> {
    try {
      this.logger.log(`Export PDF commande #${orderId}`);

      const archivedOrder = await this.getArchivedOrder(orderId);

      return {
        exportReady: true,
        order: archivedOrder,
        metadata: {
          exportDate: new Date().toISOString(),
          exportType: 'PDF',
          fileName: `order_${archivedOrder.order_number}_archive.pdf`,
          format: 'A4',
        },
      };
    } catch (error: any) {
      this.logger.error(`Erreur exportOrderForPdf(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Exporter une commande (JSON)
   */
  async exportOrder(
    orderId: number,
    format: 'json' | 'pdf' = 'json',
  ): Promise<any> {
    try {
      // Récupérer commande complète
      const { data: order } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (!order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      // Récupérer lignes
      const { data: lines } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('*')
        .eq('order_id', orderId);

      // Récupérer historique statuts
      const { data: statusHistory } = await this.supabase
        .from(TABLES.xtr_order_status)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      const exportData = {
        order,
        lines: lines || [],
        statusHistory: statusHistory || [],
        exportedAt: new Date().toISOString(),
      };

      if (format === 'json') {
        return exportData;
      }

      // Pour PDF, retourner données formatées
      // (L'implémentation PDF serait dans un service dédié)
      return {
        format: 'pdf',
        data: exportData,
        message: 'PDF generation not implemented yet',
      };
    } catch (error: any) {
      this.logger.error(`Erreur exportOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Statistiques d'archivage pour un client
   */
  async getArchiveStats(customerId?: number): Promise<any> {
    try {
      let query = this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: false })
        .eq('is_archived', true);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data: orders, count } = await query;

      const totalRevenue = (orders || []).reduce(
        (sum, order) => sum + (order.total_ttc || 0),
        0,
      );

      const oldestArchive =
        orders && orders.length > 0
          ? orders.reduce((oldest, order) =>
              new Date(order.archived_at) < new Date(oldest.archived_at)
                ? order
                : oldest,
            )
          : null;

      return {
        totalArchived: count || 0,
        totalRevenue,
        oldestArchiveDate: oldestArchive?.archived_at || null,
        averageOrderValue: count && count > 0 ? totalRevenue / count : 0,
      };
    } catch (error: any) {
      this.logger.error('Erreur getArchiveStats:', error);
      throw error;
    }
  }

  /**
   * Nettoyer les données temporaires
   * Supprime les commandes temporaires (status = temp) de plus de 24h
   */
  async cleanupTempOrderData(): Promise<{ deleted: number; message: string }> {
    try {
      this.logger.log('Nettoyage données temporaires');

      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      // Rechercher commandes temporaires anciennes
      const { data: tempOrders } = await this.supabase
        .from(TABLES.xtr_order)
        .select('order_id')
        .eq('order_status', 0) // 0 = temporaire
        .lt('created_at', yesterday.toISOString());

      if (!tempOrders || tempOrders.length === 0) {
        this.logger.log('Aucune commande temporaire à nettoyer');
        return { deleted: 0, message: 'Aucune commande à nettoyer' };
      }

      const orderIds = tempOrders.map((o) => o.order_id);

      // Supprimer lignes
      await this.supabase
        .from(TABLES.xtr_order_line)
        .delete()
        .in('order_id', orderIds);

      // Supprimer commandes
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .delete()
        .in('order_id', orderIds);

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ORDER.DELETE_FAILED,
          message: `Erreur suppression: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }

      this.logger.log(`${tempOrders.length} commandes temporaires supprimées`);
      return {
        deleted: tempOrders.length,
        message: `${tempOrders.length} commandes temporaires nettoyées`,
      };
    } catch (error: any) {
      this.logger.error('Error cleaning temp order data:', error);
      throw error;
    }
  }

  /**
   * Archiver automatiquement les anciennes commandes
   * Archive les commandes livrées de plus de 6 mois
   */
  async autoArchiveOldOrders(): Promise<{ archived: number; message: string }> {
    try {
      this.logger.log('Archivage automatique commandes anciennes');

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Rechercher commandes livrées anciennes non archivées
      const { data: oldOrders } = await this.supabase
        .from(TABLES.xtr_order)
        .select('order_id')
        .eq('order_status', 5) // 5 = livrée
        .eq('is_archived', false)
        .lt('updated_at', sixMonthsAgo.toISOString());

      if (!oldOrders || oldOrders.length === 0) {
        this.logger.log('Aucune commande à archiver automatiquement');
        return { archived: 0, message: 'Aucune commande à archiver' };
      }

      const orderIds = oldOrders.map((o) => o.order_id);

      // Archiver en masse
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .in('order_id', orderIds);

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ORDER.ARCHIVE_FAILED,
          message: `Erreur archivage: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }

      this.logger.log(
        `${oldOrders.length} commandes archivées automatiquement`,
      );
      return {
        archived: oldOrders.length,
        message: `${oldOrders.length} commandes archivées`,
      };
    } catch (error: any) {
      this.logger.error('Error auto-archiving old orders:', error);
      throw error;
    }
  }
}
