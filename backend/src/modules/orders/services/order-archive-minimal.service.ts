import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * Service d'archivage des commandes - Version Minimale
 * ✅ Gestion de l'archivage automatique
 * ✅ Nettoyage des anciennes commandes
 * ✅ Export des données pour audit
 * 
 * 🔄 MIGRÉ : DatabaseService → SupabaseBaseService (direct queries)
 */
@Injectable()
export class OrderArchiveService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderArchiveService.name);

  constructor() {
    super();
  }

  /**
   * Archiver les commandes anciennes
   */
  async archiveOldOrders(daysBefore: number = 365): Promise<number> {
    try {
      this.logger.log(`Archiving orders older than ${daysBefore} days`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBefore);
      
      // Récupérer les commandes anciennes avec Supabase
      const { data: oldOrders, error } = await this.supabase
        .from('___xtr_order')
        .select('order_id, order_date, customer_id')
        .lt('order_date', cutoffDate.toISOString())
        .eq('is_archived', false)
        .limit(1000); // Traiter par batch

      if (error) {
        this.logger.error('Erreur récupération commandes anciennes:', error);
        throw error;
      }

      if (!oldOrders || oldOrders.length === 0) {
        this.logger.log('Aucune commande à archiver');
        return 0;
      }

      // Marquer comme archivées
      const orderIds = oldOrders.map(order => order.order_id);
      const { error: archiveError } = await this.supabase
        .from('___xtr_order')
        .update({ 
          is_archived: true, 
          archived_at: new Date().toISOString() 
        })
        .in('order_id', orderIds);

      if (archiveError) {
        this.logger.error('Erreur archivage commandes:', archiveError);
        throw archiveError;
      }
      
      this.logger.log(`✅ ${oldOrders.length} commandes archivées avec succès`);
      return oldOrders.length;
    } catch (error) {
      this.logger.error('Error archiving orders:', error);
      throw error;
    }
  }

  /**
   * Exporter les données de commande pour audit
   */
  async exportOrdersForAudit(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      this.logger.log(
        `Exporting orders for audit from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
      
      // Récupérer les commandes pour audit avec Supabase
      const { data: auditOrders, error } = await this.supabase
        .from('___xtr_order')
        .select(`
          order_id,
          order_date,
          customer_id,
          order_total,
          order_status,
          created_at,
          updated_at,
          is_archived,
          archived_at
        `)
        .gte('order_date', startDate.toISOString())
        .lte('order_date', endDate.toISOString())
        .order('order_date', { ascending: false });

      if (error) {
        this.logger.error('Erreur export commandes audit:', error);
        throw error;
      }

      this.logger.log(`✅ ${auditOrders?.length || 0} commandes exportées pour audit`);
      return auditOrders || [];
    } catch (error) {
      this.logger.error('Error exporting orders for audit:', error);
      throw error;
    }
  }

  /**
   * Nettoyer les données temporaires des commandes
   */
  async cleanupTempOrderData(): Promise<{ deleted: number; message: string }> {
    try {
      this.logger.log('Cleaning up temporary order data');
      
      // Supprimer les commandes temporaires de plus de 24h
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const { data: tempOrders, error: selectError } = await this.supabase
        .from('___xtr_order')
        .select('order_id')
        .eq('order_status', 'temp')
        .lt('created_at', oneDayAgo.toISOString());

      if (selectError) {
        this.logger.error('Erreur recherche commandes temporaires:', selectError);
        throw selectError;
      }

      if (!tempOrders || tempOrders.length === 0) {
        this.logger.log('Aucune commande temporaire à nettoyer');
        return { deleted: 0, message: 'Aucune donnée à nettoyer' };
      }

      // Supprimer les commandes temporaires
      const { error: deleteError } = await this.supabase
        .from('___xtr_order')
        .delete()
        .eq('order_status', 'temp')
        .lt('created_at', oneDayAgo.toISOString());

      if (deleteError) {
        this.logger.error('Erreur suppression commandes temporaires:', deleteError);
        throw deleteError;
      }

      this.logger.log(`✅ ${tempOrders.length} commandes temporaires supprimées`);
      return { 
        deleted: tempOrders.length, 
        message: `${tempOrders.length} commandes temporaires nettoyées` 
      };
    } catch (error) {
      this.logger.error('Error cleaning temp order data:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques d'archivage
   */
  async getArchiveStats(): Promise<{
    totalOrders: number;
    archivedOrders: number;
    tempOrders: number;
    archiveRate: number;
  }> {
    try {
      this.logger.log('Récupération statistiques archivage');

      // Compter total des commandes
      const { count: totalOrders, error: totalError } = await this.supabase
        .from('___xtr_order')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        this.logger.error('Erreur comptage total commandes:', totalError);
        throw totalError;
      }

      // Compter commandes archivées
      const { count: archivedOrders, error: archivedError } = await this.supabase
        .from('___xtr_order')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', true);

      if (archivedError) {
        this.logger.error('Erreur comptage commandes archivées:', archivedError);
        throw archivedError;
      }

      // Compter commandes temporaires
      const { count: tempOrders, error: tempError } = await this.supabase
        .from('___xtr_order')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'temp');

      if (tempError) {
        this.logger.error('Erreur comptage commandes temporaires:', tempError);
        throw tempError;
      }

      const archiveRate = totalOrders ? (archivedOrders || 0) / totalOrders * 100 : 0;

      const stats = {
        totalOrders: totalOrders || 0,
        archivedOrders: archivedOrders || 0,
        tempOrders: tempOrders || 0,
        archiveRate: Math.round(archiveRate * 100) / 100,
      };

      this.logger.log(`✅ Statistiques: ${stats.totalOrders} total, ${stats.archivedOrders} archivées`);
      return stats;
    } catch (error) {
      this.logger.error('Error getting archive stats:', error);
      throw error;
    }
  }
}
