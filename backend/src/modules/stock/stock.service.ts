import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

@Injectable()
export class StockService extends SupabaseBaseService {
  protected readonly logger = new Logger(StockService.name);

  async getLowStockItems(limit: number = 10): Promise<{
    items: Array<{
      id: string;
      name: string;
      reference: string;
      currentStock: number;
      minStock: number;
      supplier: string;
    }>;
    totalCount: number;
  }> {
    try {
      this.logger.log('Fetching low stock items from pieces table');

      // Récupérer les articles avec stock bas depuis la table pieces
      // On simule un stock minimum de 5 et on cherche les articles avec peu de stock
      const {
        data: stockData,
        error: stockError,
        count,
      } = await this.supabase
        .from('pieces')
        .select(
          `
          pie_id,
          pie_nom,
          pie_ref,
          pie_stock,
          pieces_marque!inner(
            pmq_nom
          )
        `,
          { count: 'exact' },
        )
        .lt('pie_stock', 10) // Stock inférieur à 10
        .gt('pie_stock', 0) // Stock supérieur à 0
        .order('pie_stock', { ascending: true })
        .limit(limit);

      if (stockError) {
        this.logger.error('Error fetching low stock items:', stockError);
        throw stockError;
      }

      const items = (stockData || []).map((item: any) => ({
        id: item.pie_id,
        name: item.pie_nom || 'Article sans nom',
        reference: item.pie_ref || 'REF-UNKNOWN',
        currentStock: parseInt(item.pie_stock || '0', 10),
        minStock: 5, // Seuil minimum simulé
        supplier: item.pieces_marque?.pmq_nom || 'Marque inconnue',
      }));

      this.logger.log(
        `Found ${items.length} low stock items out of ${count} total`,
      );

      return {
        items,
        totalCount: count || 0,
      };
    } catch (error) {
      this.logger.error('Error in getLowStockItems:', error);
      return {
        items: [],
        totalCount: 0,
      };
    }
  }

  async getStockStatistics(): Promise<{
    totalItems: number;
    lowStockCount: number;
    outOfStockCount: number;
    avgStockLevel: number;
  }> {
    try {
      this.logger.log('Calculating stock statistics');

      // Statistiques globales du stock
      const [totalResult, lowStockResult, outOfStockResult] = await Promise.all(
        [
          // Total d'articles
          this.supabase
            .from('pieces')
            .select('pie_id', { count: 'exact', head: true }),

          // Articles avec stock bas (< 10)
          this.supabase
            .from('pieces')
            .select('pie_id', { count: 'exact', head: true })
            .lt('pie_stock', 10)
            .gt('pie_stock', 0),

          // Articles en rupture (stock = 0)
          this.supabase
            .from('pieces')
            .select('pie_id', { count: 'exact', head: true })
            .eq('pie_stock', 0),
        ],
      );

      // Calcul de la moyenne de stock (échantillon)
      const { data: sampleData } = await this.supabase
        .from('pieces')
        .select('pie_stock')
        .limit(1000);

      const avgStock = sampleData?.length
        ? sampleData.reduce(
            (sum, item) => sum + parseInt(item.pie_stock || '0', 10),
            0,
          ) / sampleData.length
        : 0;

      const stats = {
        totalItems: totalResult.count || 0,
        lowStockCount: lowStockResult.count || 0,
        outOfStockCount: outOfStockResult.count || 0,
        avgStockLevel: Math.round(avgStock * 100) / 100,
      };

      this.logger.log('Stock statistics:', stats);
      return stats;
    } catch (error) {
      this.logger.error('Error in getStockStatistics:', error);
      return {
        totalItems: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        avgStockLevel: 0,
      };
    }
  }
}
