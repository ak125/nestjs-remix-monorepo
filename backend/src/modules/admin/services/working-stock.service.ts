import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface StockItemWorkingVersion {
  pri_piece_id: string;
  pri_ref: string;
  pri_des: string;
  pri_dispo: string; // '1' = disponible, '0' = indisponible
  pri_vente_ttc: string;
  pri_vente_ht: string;
  pri_qte_vente: string;
  pri_marge: string;
  piece_name?: string; // Optionnel si on fait le JOIN
  piece_year?: number; // Optionnel si on fait le JOIN
}

export interface StockDashboardData {
  totalItems: number;
  availableItems: number;
  unavailableItems: number;
  lowStockItems: number;
  items: StockItemWorkingVersion[];
}

@Injectable()
export class WorkingStockService extends SupabaseBaseService {
  protected readonly logger = new Logger(WorkingStockService.name);

  constructor() {
    super();
    this.logger.log(
      'WorkingStockService initialized - Using pieces_price as primary table',
    );
  }

  /**
   * Dashboard stock basé sur pieces_price
   */
  async getDashboard(
    page: number = 1,
    limit: number = 20,
    filters?: {
      search?: string;
      available?: boolean;
      minPrice?: number;
      maxPrice?: number;
    },
  ): Promise<StockDashboardData> {
    try {
      this.logger.debug(
        `Getting stock dashboard - page: ${page}, limit: ${limit}`,
      );

      // Construire la requête
      let query = this.client.from('pieces_price').select(`
          pri_piece_id,
          pri_ref,
          pri_des,
          pri_dispo,
          pri_vente_ttc,
          pri_vente_ht,
          pri_qte_vente,
          pri_marge
        `);

      // Appliquer les filtres
      if (filters?.search) {
        query = query.or(
          `pri_ref.ilike.%${filters.search}%,pri_des.ilike.%${filters.search}%`,
        );
      }

      if (filters?.available !== undefined) {
        query = query.eq('pri_dispo', filters.available ? '1' : '0');
      }

      if (filters?.minPrice) {
        query = query.gte('pri_vente_ttc', filters.minPrice.toString());
      }

      if (filters?.maxPrice) {
        query = query.lte('pri_vente_ttc', filters.maxPrice.toString());
      }

      // Pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      // Ordonner par référence
      query = query.order('pri_ref', { ascending: true });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erreur récupération stock: ${error.message}`);
      }

      // Récupérer les statistiques
      const stats = await this.getStockStatistics();

      return {
        totalItems: data?.length || 0,
        availableItems: stats.availableItems,
        unavailableItems: stats.unavailableItems,
        lowStockItems: stats.lowStockItems,
        items: (data as StockItemWorkingVersion[]) || [],
      };
    } catch (error) {
      this.logger.error('Erreur dashboard stock', error);
      throw error;
    }
  }

  /**
   * Statistiques du stock
   */
  async getStockStatistics() {
    try {
      // Articles disponibles
      const { count: availableCount } = await this.client
        .from('pieces_price')
        .select('*', { count: 'exact', head: true })
        .eq('pri_dispo', '1');

      // Articles indisponibles
      const { count: unavailableCount } = await this.client
        .from('pieces_price')
        .select('*', { count: 'exact', head: true })
        .eq('pri_dispo', '0');

      // Articles avec marge faible (< 20%)
      const { count: lowMarginCount } = await this.client
        .from('pieces_price')
        .select('*', { count: 'exact', head: true })
        .lte('pri_marge', '20')
        .eq('pri_dispo', '1');

      return {
        availableItems: availableCount || 0,
        unavailableItems: unavailableCount || 0,
        lowStockItems: lowMarginCount || 0, // On utilise la marge comme proxy pour "attention requise"
      };
    } catch (error) {
      this.logger.error('Erreur statistiques stock', error);
      return {
        availableItems: 0,
        unavailableItems: 0,
        lowStockItems: 0,
      };
    }
  }

  /**
   * Rechercher des articles
   */
  async searchItems(
    query: string,
    limit: number = 50,
    availableOnly: boolean = true,
  ): Promise<StockItemWorkingVersion[]> {
    try {
      let searchQuery = this.client
        .from('pieces_price')
        .select(
          `
          pri_piece_id,
          pri_ref,
          pri_des,
          pri_dispo,
          pri_vente_ttc,
          pri_vente_ht,
          pri_qte_vente,
          pri_marge
        `,
        )
        .or(`pri_ref.ilike.%${query}%,pri_des.ilike.%${query}%`)
        .limit(limit);

      if (availableOnly) {
        searchQuery = searchQuery.eq('pri_dispo', '1');
      }

      const { data, error } = await searchQuery;

      if (error) {
        throw new Error(`Erreur recherche: ${error.message}`);
      }

      return (data as StockItemWorkingVersion[]) || [];
    } catch (error) {
      this.logger.error('Erreur recherche articles', error);
      throw error;
    }
  }

  /**
   * Mettre à jour la disponibilité
   */
  async updateAvailability(
    pieceId: string,
    available: boolean,
  ): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('pieces_price')
        .update({ pri_dispo: available ? '1' : '0' })
        .eq('pri_piece_id', pieceId);

      if (error) {
        throw new Error(`Erreur mise à jour: ${error.message}`);
      }

      this.logger.log(`Disponibilité mise à jour: ${pieceId} -> ${available}`);
      return true;
    } catch (error) {
      this.logger.error('Erreur update disponibilité', error);
      throw error;
    }
  }

  /**
   * Obtenir les articles les plus vendus (prix élevés comme proxy)
   */
  async getTopItems(limit: number = 10): Promise<StockItemWorkingVersion[]> {
    try {
      const { data, error } = await this.client
        .from('pieces_price')
        .select(
          `
          pri_piece_id,
          pri_ref,
          pri_des,
          pri_dispo,
          pri_vente_ttc,
          pri_vente_ht,
          pri_qte_vente,
          pri_marge
        `,
        )
        .eq('pri_dispo', '1')
        .order('pri_vente_ttc', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Erreur top items: ${error.message}`);
      }

      return (data as StockItemWorkingVersion[]) || [];
    } catch (error) {
      this.logger.error('Erreur top items', error);
      throw error;
    }
  }
}
