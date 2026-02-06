import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';

/**
 * Service pour les métadonnées du catalogue : gammes, marques, modèles, types
 * + statistiques et endpoints de debug
 *
 * Extrait de ProductsService pour séparation des responsabilités.
 */
@Injectable()
export class ProductsCatalogService extends SupabaseBaseService {
  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Récupérer toutes les gammes de pièces (vraie méthode)
   */
  async getGammes() {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias, pg_pic, pg_display, pg_top')
        .eq('pg_display', '1')
        .order('pg_name', { ascending: true })
        .limit(50);

      if (error) {
        this.logger.error('Erreur getGammes:', error);
        throw error;
      }

      return (
        data?.map((gamme) => ({
          id: gamme.pg_id,
          name: gamme.pg_name,
          alias: gamme.pg_alias,
          image: gamme.pg_pic,
          is_active: gamme.pg_display === '1',
          is_top: gamme.pg_top === '1',
        })) || []
      );
    } catch (error) {
      this.logger.error('Erreur dans getGammes:', error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les marques automobiles (simplifié)
   */
  async getBrands() {
    try {
      const { data, error } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name, marque_logo, marque_activ')
        .eq('marque_activ', '1')
        .order('marque_name', { ascending: true })
        .limit(50);

      if (error) {
        this.logger.error('Erreur getBrands:', error);
        throw error;
      }

      return (
        data?.map((brand) => ({
          id: brand.marque_id,
          name: brand.marque_name,
          logo: brand.marque_logo,
          is_active: brand.marque_activ === '1',
        })) || []
      );
    } catch (error) {
      this.logger.error('Erreur dans getBrands:', error);
      throw error;
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  async getModels(brandId: number) {
    try {
      const { data, error } = await this.client
        .from(TABLES.auto_modele)
        .select('*')
        .eq('brand_id', brandId)
        .order('name', { ascending: true });

      if (error) {
        this.logger.error(`Erreur getModels pour brand ${brandId}:`, error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Erreur dans getModels pour brand ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Récupérer les types d'un modèle
   */
  async getTypes(modelId: number) {
    try {
      const { data, error } = await this.client
        .from(TABLES.auto_type)
        .select('*')
        .eq('model_id', modelId)
        .order('name', { ascending: true });

      if (error) {
        this.logger.error(`Erreur getTypes pour model ${modelId}:`, error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Erreur dans getTypes pour model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques réelles des produits
   */
  async getStats() {
    try {
      // 🎯 Compter uniquement les pièces AFFICHABLES (piece_display = true)
      const { count: totalPieces, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true);

      // Compter les pièces actives disponibles (avec stock > 0)
      const { count: activePieces, error: activeError } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true)
        .not('piece_qty_sale', 'is', null)
        .gt('piece_qty_sale', 0);

      // Compter les gammes actives uniquement (pg_display = '1')
      const { count: totalGammes, error: gammesError } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', '1');

      // Compter les marques de pièces actives (pm_display = '1')
      const { count: totalMarques, error: marquesError } = await this.client
        .from(TABLES.pieces_marque)
        .select('*', { count: 'exact', head: true })
        .eq('pm_display', '1');

      // Compter les pièces avec stock faible (piece_qty_sale = 1)
      const { count: lowStockCount, error: lowStockError } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true)
        .eq('piece_qty_sale', 1);

      if (
        piecesError ||
        activeError ||
        gammesError ||
        marquesError ||
        lowStockError
      ) {
        this.logger.error(
          '⚠️ Erreur getStats (certaines requêtes ont échoué):',
          {
            piecesError: piecesError?.message,
            activeError: activeError?.message,
            gammesError: gammesError?.message,
            marquesError: marquesError?.message,
            lowStockError: lowStockError?.message,
          },
        );
      }

      const stats = {
        totalProducts: totalPieces || 0,
        activeProducts: activePieces || 0,
        totalCategories: totalGammes || 0,
        totalBrands: totalMarques || 0,
        lowStockItems: lowStockCount || 0,
      };

      this.logger.log(
        '📊 Statistiques produits (affichables uniquement):',
        stats,
      );
      return stats;
    } catch (error) {
      this.logger.error('❌ Erreur dans getStats:', error);
      return {
        totalProducts: 0,
        activeProducts: 0,
        totalCategories: 0,
        totalBrands: 0,
        lowStockItems: 0,
      };
    }
  }

  /**
   * Debug : vérifier le contenu des tables
   */
  async debugTables() {
    try {
      const { data: gammes, error: gammeError } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*')
        .limit(3);

      const { data: marques, error: marqueError } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name')
        .limit(5);

      const { data: pieces, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select('piece_id, piece_name')
        .limit(5);

      return {
        gammes: {
          count: gammes?.length || 0,
          data: gammes,
          error: gammeError?.message,
        },
        marques: {
          count: marques?.length || 0,
          data: marques,
          error: marqueError?.message,
        },
        pieces: {
          count: pieces?.length || 0,
          data: pieces,
          error: piecesError?.message,
        },
      };
    } catch (error) {
      this.logger.error('Erreur debug:', error);
      return { error: (error as Error).message };
    }
  }

  /**
   * DEBUG: Examiner la vraie structure des données Supabase
   */
  async debugRealData() {
    try {
      const { data: samplePieces, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select('*')
        .limit(2);

      const { data: sampleMarques, error: marquesError } = await this.client
        .from(TABLES.pieces_marque)
        .select('*')
        .limit(2);

      const { data: tables, error: tablesError } = await this.client
        .rpc('get_table_names')
        .limit(10);

      return {
        debug: true,
        message: 'Vraie structure des tables Supabase',
        samplePieces: samplePieces || [],
        sampleMarques: sampleMarques || [],
        tables: tables || [],
        errors: {
          piecesError: piecesError?.message || null,
          marquesError: marquesError?.message || null,
          tablesError: tablesError?.message || null,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur debug:', error);
      return {
        debug: true,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * DEBUG: Analyser la distribution des stocks
   */
  async debugStockDistribution() {
    try {
      const { data: stockSample, error: stockError } = await this.client
        .from(TABLES.pieces)
        .select('piece_id, piece_name, piece_qty_sale, piece_display')
        .eq('piece_display', true)
        .not('piece_qty_sale', 'is', null)
        .order('piece_qty_sale', { ascending: false })
        .limit(10);

      // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
      const { data: rangeData } = await this.callRpc<any>(
        'get_stock_distribution',
        {},
        { source: 'admin', role: 'service_role' },
      );

      let rangeCounts: any = {};
      if (rangeData) {
        rangeCounts = rangeData;
      } else {
        const { data: stockData } = await this.client
          .from(TABLES.pieces)
          .select('piece_qty_sale')
          .eq('piece_display', true)
          .not('piece_qty_sale', 'is', null)
          .limit(10000);

        rangeCounts = {
          'Stock 0': 0,
          'Stock 1-5': 0,
          'Stock 6-10': 0,
          'Stock 11-50': 0,
          'Stock 51+': 0,
        };

        stockData?.forEach((item) => {
          const qty = item.piece_qty_sale || 0;
          if (qty === 0) rangeCounts['Stock 0']++;
          else if (qty <= 5) rangeCounts['Stock 1-5']++;
          else if (qty <= 10) rangeCounts['Stock 6-10']++;
          else if (qty <= 50) rangeCounts['Stock 11-50']++;
          else rangeCounts['Stock 51+']++;
        });
      }

      return {
        debug: 'Stock Distribution Analysis',
        stockSample: stockSample || [],
        rangeCounts,
        errors: { stockError },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        debug: 'Stock Distribution Error',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
