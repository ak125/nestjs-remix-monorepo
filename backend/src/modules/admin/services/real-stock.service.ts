import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface RealStockItem {
  piece_id: number;
  piece_ref: string;
  piece_name: string;
  piece_des: string;
  pri_dispo: string; // '1' = disponible, '0' = indisponible
  pri_qte_vente: string;
  pri_vente_ttc: string;
  pri_vente_ht: string;
  pri_marge: string;
}

export interface StockDashboard {
  totalItems: number;
  availableItems: number;
  unavailableItems: number;
  items: RealStockItem[];
}

@Injectable()
export class RealStockService extends SupabaseBaseService {
  protected readonly logger = new Logger(RealStockService.name);

  constructor() {
    super();
    this.logger.log('RealStockService initialized with real DB structure');
  }

  /**
   * Dashboard stock avec les vraies tables
   */
  async getDashboard(
    page: number = 1,
    limit: number = 20,
    filters?: {
      search?: string;
      available?: boolean;
    },
  ): Promise<StockDashboard> {
    try {
      this.logger.debug('Getting real stock dashboard', { page, limit, filters });

      // Requête avec JOIN entre pieces et pieces_price
      let query = this.client
        .from('pieces')
        .select(`
          piece_id,
          piece_ref,
          piece_name,
          piece_des,
          pieces_price!inner(
            pri_dispo,
            pri_qte_vente,
            pri_vente_ttc,
            pri_vente_ht,
            pri_marge
          )
        `);

      // Filtres
      if (filters?.search) {
        query = query.or(
          `piece_ref.ilike.%${filters.search}%,piece_name.ilike.%${filters.search}%`,
        );
      }

      if (filters?.available !== undefined) {
        query = query.eq('pieces_price.pri_dispo', filters.available ? '1' : '0');
      }

      // Pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erreur dashboard: ${error.message}`);
      }

      // Statistiques rapides
      const stats = await this.getQuickStats();

      return {
        totalItems: data?.length || 0,
        availableItems: stats.availableItems,
        unavailableItems: stats.unavailableItems,
        items: data as RealStockItem[] || [],
      };
    } catch (error) {
      this.logger.error('Erreur dashboard stock réel', error);
      throw error;
    }
  }

  /**
   * Statistiques rapides
   */
  async getQuickStats() {
    try {
      // Compter les items disponibles
      const { count: availableCount } = await this.client
        .from('pieces_price')
        .select('*', { count: 'exact', head: true })
        .eq('pri_dispo', '1');

      // Compter les items indisponibles
      const { count: unavailableCount } = await this.client
        .from('pieces_price')
        .select('*', { count: 'exact', head: true })
        .eq('pri_dispo', '0');

      return {
        availableItems: availableCount || 0,
        unavailableItems: unavailableCount || 0,
      };
    } catch (error) {
      this.logger.error('Erreur stats rapides', error);
      return {
        availableItems: 0,
        unavailableItems: 0,
      };
    }
  }

  /**
   * Rechercher des pièces
   */
  async searchPieces(query: string, limit: number = 50): Promise<RealStockItem[]> {
    try {
      const { data, error } = await this.client
        .from('pieces')
        .select(`
          piece_id,
          piece_ref,
          piece_name,
          piece_des,
          pieces_price!inner(
            pri_dispo,
            pri_qte_vente,
            pri_vente_ttc,
            pri_vente_ht,
            pri_marge
          )
        `)
        .or(`piece_ref.ilike.%${query}%,piece_name.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        throw new Error(`Erreur recherche: ${error.message}`);
      }

      return (data as RealStockItem[]) || [];
    } catch (error) {
      this.logger.error('Erreur recherche pièces', error);
      throw error;
    }
  }

  /**
   * Mettre à jour la disponibilité d'une pièce
   */
  async updateAvailability(pieceId: number, available: boolean): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('pieces_price')
        .update({ pri_dispo: available ? '1' : '0' })
        .eq('pri_piece_id', pieceId.toString());

      if (error) {
        throw new Error(`Erreur mise à jour: ${error.message}`);
      }

      this.logger.log(`Disponibilité mise à jour: pièce ${pieceId} -> ${available}`);
      return true;
    } catch (error) {
      this.logger.error('Erreur update disponibilité', error);
      throw error;
    }
  }
}
