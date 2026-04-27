import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule'; // Temporairement désactivé
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/**
 * Service d'archives commerciales (remplace archive.index.php)
 * ✅ Intégré à l'architecture moderne avec SupabaseBaseService
 * ✅ Gestion automatisée des archives de commandes
 * ✅ Système de pagination et filtrage avancé
 * 🚧 Archivage automatique par CRON (à réactiver une fois le module stable)
 */
@Injectable()
export class CommercialArchivesService extends SupabaseBaseService {
  protected readonly logger = new Logger(CommercialArchivesService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Service d'archives (remplace archive.index.php)
   * ✅ Utilise la table existante ___xtr_order avec colonnes d'archivage
   */
  async getArchives(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      this.logger.log(
        `Récupération archives avec filtres: ${JSON.stringify(filters)}`,
      );

      // Utiliser ___xtr_order avec filtre is_archived = true
      let query = this.supabase
        .from(TABLES.xtr_order)
        .select(
          `
          id,
          order_number,
          customer_id,
          status,
          total_ht,
          total_ttc,
          date_order,
          is_archived,
          archived_at,
          created_at,
          updated_at
        `,
          { count: 'exact' },
        )
        .eq('is_archived', true); // Filtrer uniquement les commandes archivées

      // Appliquer les filtres
      if (filters.dateFrom) {
        query = query.gte('archived_at', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        query = query.lte('archived_at', filters.dateTo.toISOString());
      }
      // Le type est ignoré car nous utilisons une seule table

      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;

      const { data, error, count } = await query
        .order('archived_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('Erreur récupération archives:', error);
        // Retour gracieux au lieu de throw
        return {
          success: false,
          error: error.message,
          archives: [],
          pagination: { total: 0, page: 1, limit: 50, pages: 0 },
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.log(
        `✅ ${data?.length || 0} archives récupérées sur ${count || 0} total`,
      );

      return {
        success: true,
        archives: data || [],
        pagination: {
          total: count || 0,
          page,
          limit,
          pages: Math.ceil((count || 0) / limit),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error fetching archives:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        archives: [],
        pagination: { total: 0, page: 1, limit: 50, pages: 0 },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Archiver automatiquement les anciennes commandes
   * 🚧 CRON temporairement désactivé - Peut être appelé manuellement
   * TODO: Réactiver avec @Cron(CronExpression.EVERY_DAY_AT_2AM) une fois stable
   */
  // @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async autoArchiveOrders() {
    try {
      this.logger.log("🔄 Démarrage processus d'archivage automatique...");

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Récupérer les commandes à archiver depuis ___xtr_order
      const { data: ordersToArchive, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*')
        .in('status', [6, 91, 92, 93, 94]) // Statuts terminés/finalisés
        .lt('date_order', threeMonthsAgo.toISOString())
        .eq('is_archived', false) // Seulement les non-archivées
        .limit(1000); // Traiter par batch pour éviter les surcharges

      if (error) {
        this.logger.error('Erreur récupération commandes à archiver:', error);
        return { success: false, error: error.message, archived: 0 };
      }

      if (!ordersToArchive || ordersToArchive.length === 0) {
        this.logger.log('✅ Aucune commande à archiver');
        return {
          success: true,
          message: 'Aucune commande à archiver',
          archived: 0,
        };
      }

      // Archiver chaque commande (marquer comme archivée)
      let archivedCount = 0;
      for (const order of ordersToArchive) {
        const success = await this.archiveOrder(order);
        if (success) archivedCount++;
      }

      this.logger.log(
        `✅ ${archivedCount}/${ordersToArchive.length} commandes archivées avec succès`,
      );

      return {
        success: true,
        message: `${archivedCount} commandes archivées`,
        archived: archivedCount,
        total: ordersToArchive.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur processus archivage automatique:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        archived: 0,
      };
    }
  }

  /**
   * Archiver une commande spécifique - utilise les colonnes existantes de ___xtr_order
   */
  private async archiveOrder(order: any): Promise<boolean> {
    try {
      // Vérifier si déjà archivée pour éviter les doublons
      if (order.is_archived === true) {
        this.logger.debug(`Commande ${order.id} déjà archivée, ignorée`);
        return true;
      }

      // Marquer la commande comme archivée dans la table existante
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) {
        this.logger.error(`Erreur archivage commande ${order.id}:`, error);
        return false;
      }

      this.logger.debug(`✅ Commande ${order.id} archivée avec succès`);
      return true;
    } catch (error) {
      this.logger.error(`Erreur archivage commande ${order.id}:`, error);
      return false;
    }
  }

  /**
   * Archiver manuellement une commande
   */
  async manualArchiveOrder(
    orderId: number,
    reason?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Archivage manuel commande ${orderId}`);

      // Récupérer la commande
      const { data: order, error: orderError } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return {
          success: false,
          message: `Commande ${orderId} non trouvée`,
        };
      }

      const success = await this.archiveOrder({
        ...order,
        reason: reason || 'Archivage manuel',
      });

      return success
        ? {
            success: true,
            message: `Commande ${orderId} archivée avec succès`,
          }
        : {
            success: false,
            message: `Erreur lors de l'archivage de la commande ${orderId}`,
          };
    } catch (error) {
      this.logger.error(`Erreur archivage manuel commande ${orderId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Obtenir les statistiques d'archivage - utilise ___xtr_order
   */
  async getArchiveStats(): Promise<{
    totalArchives: number;
    archivesByType: Record<string, number>;
    recentArchives: number;
    oldestArchive?: string;
  }> {
    try {
      this.logger.log('Récupération statistiques archives');

      // Total des archives (commandes marquées comme archivées)
      const { count: totalArchives } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', true);

      // Archives par type (pour cette version, on n'a que des commandes)
      const archivesByType = {
        order: totalArchives || 0,
      };

      // Archives récentes (7 derniers jours)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentArchives } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', true)
        .gte('archived_at', sevenDaysAgo.toISOString());

      // Archive la plus ancienne
      const { data: oldestArchiveData } = await this.supabase
        .from(TABLES.xtr_order)
        .select('archived_at')
        .eq('is_archived', true)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: true })
        .limit(1)
        .single();

      const stats = {
        totalArchives: totalArchives || 0,
        archivesByType,
        recentArchives: recentArchives || 0,
        oldestArchive: oldestArchiveData?.archived_at,
      };

      this.logger.log(
        `✅ Stats archives: ${stats.totalArchives} total, ${stats.recentArchives} récentes`,
      );
      return stats;
    } catch (error) {
      this.logger.error('Erreur récupération stats archives:', error);
      return {
        totalArchives: 0,
        archivesByType: {},
        recentArchives: 0,
      };
    }
  }

  /**
   * Restaurer une commande archivée - utilise ___xtr_order
   */
  async restoreArchivedOrder(
    orderId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Restauration commande archivée ${orderId}`);

      // Récupérer la commande archivée
      const { data: order, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*')
        .eq('id', orderId)
        .eq('is_archived', true)
        .single();

      if (error || !order) {
        return {
          success: false,
          message: `Commande archivée ${orderId} non trouvée`,
        };
      }

      // Marquer la commande comme non archivée
      const { error: updateError } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          is_archived: false,
          archived_at: null,
        })
        .eq('id', orderId);

      if (updateError) {
        this.logger.error('Erreur restauration commande:', updateError);
        return { success: false, message: 'Erreur lors de la restauration' };
      }

      this.logger.log(`✅ Commande ${orderId} restaurée avec succès`);
      return {
        success: true,
        message: `Commande ${orderId} restaurée depuis l'archive`,
      };
    } catch (error) {
      this.logger.error(`Erreur restauration commande ${orderId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
