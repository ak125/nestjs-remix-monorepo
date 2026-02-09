/**
 * StockReportService - Stock reporting, alerts, and statistics
 *
 * Extracted from StockManagementService for separation of concerns.
 * Handles: comprehensive reports, alerts, alert checks, and statistics.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';
import type {
  StockItem,
  StockStatistics,
  StockReportDetail,
} from './stock-management.service';

@Injectable()
export class StockReportService extends SupabaseBaseService {
  protected readonly logger = new Logger(StockReportService.name);

  constructor() {
    super();
    this.logger.log('StockReportService initialized');
  }

  /**
   * Generer un rapport de stock complet
   */
  async generateComprehensiveStockReport(): Promise<{
    summary: {
      totalProducts: number;
      totalValue: number;
      lowStockItems: number;
      outOfStockItems: number;
      overstockItems: number;
    };
    lowStockDetails: StockReportDetail[];
    outOfStockDetails: StockReportDetail[];
    overstockDetails: StockReportDetail[];
    movements: Record<string, unknown>[];
  }> {
    try {
      this.logger.debug('Generation rapport de stock complet');

      // Recuperer tous les stocks avec details produits
      const { data: stocks, error: stocksError } = await this.client
        .from('stock')
        .select(
          `
          *,
          pieces!inner(
            id,
            reference,
            name,
            description,
            average_cost
          )
        `,
        )
        .order('pieces.reference');

      if (stocksError) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur recuperation stocks: ${stocksError.message}`,
          details: stocksError.message,
        });
      }

      // Recuperer les mouvements recents (7 derniers jours)
      const { data: recentMovements } = await this.client
        .from('stock_movements')
        .select(
          `
          *,
          pieces!inner(reference, name)
        `,
        )
        .gte(
          'created_at',
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        )
        .order('created_at', { ascending: false })
        .limit(100);

      // Calculer les statistiques
      const summary = {
        totalProducts: stocks?.length || 0,
        totalValue: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        overstockItems: 0,
      };

      const lowStockDetails: StockReportDetail[] = [];
      const outOfStockDetails: StockReportDetail[] = [];
      const overstockDetails: StockReportDetail[] = [];

      stocks?.forEach((stock) => {
        const avgCost = parseFloat(stock.pieces?.average_cost || '0');
        const value = stock.available * avgCost;
        summary.totalValue += value;

        if (stock.available === 0) {
          summary.outOfStockItems++;
          outOfStockDetails.push({
            ...stock,
            productName: stock.pieces?.name,
            productReference: stock.pieces?.reference,
            value,
          });
        } else if (stock.available <= stock.min_stock) {
          summary.lowStockItems++;
          lowStockDetails.push({
            ...stock,
            productName: stock.pieces?.name,
            productReference: stock.pieces?.reference,
            value,
          });
        } else if (stock.available >= stock.max_stock) {
          summary.overstockItems++;
          overstockDetails.push({
            ...stock,
            productName: stock.pieces?.name,
            productReference: stock.pieces?.reference,
            value,
          });
        }
      });

      return {
        summary,
        lowStockDetails,
        outOfStockDetails,
        overstockDetails,
        movements: recentMovements || [],
      };
    } catch (error) {
      this.logger.error('Erreur generation rapport', error);
      throw error;
    }
  }

  /**
   * Obtenir les alertes de stock
   */
  async getStockAlerts() {
    try {
      this.logger.debug('Recuperation alertes stock');

      const { data: alerts, error } = await this.client
        .from('stock_alerts')
        .select(
          `
          *,
          stock!inner(
            *,
            pieces!inner(
              id,
              reference,
              name
            )
          )
        `,
        )
        .eq('resolved', false)
        .order('alert_level', { ascending: false });

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur recuperation alertes: ${error.message}`,
          details: error.message,
        });
      }

      return {
        success: true,
        data: alerts || [],
        message: 'Alertes recuperees avec succes',
      };
    } catch (error) {
      this.logger.error('Erreur recuperation alertes', error);
      return {
        success: false,
        data: [],
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Verifier et creer des alertes de stock si necessaire
   */
  async checkStockAlerts(stock: StockItem) {
    try {
      let alertType: string | null = null;
      let alertLevel = 'WARNING';

      if (stock.available <= 0) {
        alertType = 'OUT_OF_STOCK';
        alertLevel = 'CRITICAL';
      } else if (stock.available <= stock.min_stock) {
        alertType = 'LOW_STOCK';
        alertLevel = 'WARNING';
      } else if (stock.available > stock.max_stock) {
        alertType = 'OVERSTOCK';
        alertLevel = 'INFO';
      }

      if (alertType) {
        const { error } = await this.client.from('stock_alerts').insert({
          product_id: stock.product_id,
          alert_type: alertType,
          alert_level: alertLevel,
          message: `Stock alert: ${alertType} for product ${stock.product_id}`,
          resolved: false,
          created_at: new Date().toISOString(),
        });

        if (error) {
          this.logger.error('Erreur creation alerte', error);
        } else {
          this.logger.warn('Alerte stock creee', {
            productId: stock.product_id,
            type: alertType,
            level: alertLevel,
          });
        }
      }
    } catch (error) {
      this.logger.error('Erreur verification alertes', error);
    }
  }

  /**
   * Obtenir les statistiques de stock
   */
  async getStockStatistics(): Promise<StockStatistics> {
    try {
      const { data: stocks, error } = await this.client
        .from('stock')
        .select('quantity, available, min_stock, max_stock');

      if (error || !stocks || stocks.length === 0) {
        return {
          totalProducts: 0,
          outOfStock: 0,
          lowStock: 0,
          overstock: 0,
          avgStockLevel: 0,
        };
      }

      return {
        totalProducts: stocks.length,
        outOfStock: stocks.filter((s) => s.available <= 0).length,
        lowStock: stocks.filter((s) => s.available <= s.min_stock).length,
        overstock: stocks.filter((s) => s.available > s.max_stock).length,
        avgStockLevel: Math.round(
          stocks.reduce((sum, s) => sum + s.available, 0) / stocks.length,
        ),
      };
    } catch (error) {
      this.logger.error('Erreur calcul statistiques', error);
      return {
        totalProducts: 0,
        outOfStock: 0,
        lowStock: 0,
        overstock: 0,
        avgStockLevel: 0,
      };
    }
  }
}
