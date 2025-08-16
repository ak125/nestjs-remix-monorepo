import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../shared/services/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class StockManagementService extends SupabaseBaseService {
  private readonly logger = new Logger(StockManagementService.name);

  constructor(
    cacheService: CacheService,
    private eventEmitter: EventEmitter2,
  ) {
    super(cacheService);
  }

  /**
   * Obtenir le tableau de bord du stock
   */
  async getStockDashboard() {
    try {
      this.logger.debug('Récupération dashboard stock');

      const cacheKey = 'stock:dashboard';
      const cached = await this.getCached(cacheKey);
      if (cached) return cached;

      // Statistiques générales
      const stats = await this.getStockStatistics();

      // Mouvements récents (3 derniers jours)
      const { data: recentMovements } = await this.client
        .from('stock_movements')
        .select(`
          *,
          pieces!inner(reference, name)
        `)
        .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      // Alertes actives
      const alerts = await this.getStockAlerts();

      // Top 10 des produits avec le plus de mouvements
      const { data: topProducts } = await this.client
        .from('stock_movements')
        .select(`
          product_id,
          count() as movement_count,
          pieces!inner(reference, name)
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('movement_count', { ascending: false })
        .limit(10);

      const dashboard = {
        statistics: stats,
        recentMovements: recentMovements || [],
        alerts: alerts || [],
        topProducts: topProducts || [],
        lastUpdated: new Date(),
      };

      await this.setCached(cacheKey, dashboard, 300); // 5 minutes
      return dashboard;
    } catch (error) {
      this.logger.error('Erreur récupération dashboard stock', error);
      throw error;
    }
  }

  /**
   * Obtenir l'état du stock avec filtres avancés
   */
  async getStockWithAdvancedFilters(filters?: {
    search?: string;
    location?: string;
    lowStock?: boolean;
    outOfStock?: boolean;
    page?: number;
    limit?: number;
    warehouseId?: string;
    isActive?: boolean;
  }): Promise<{ items: any[]; total: number; stats: any }> {
    try {
      this.logger.debug('Récupération stock avec filtres avancés', {
        filters,
      });

      // Construire la requête
      let query = this.client.from('stock').select(
        `
          *,
          pieces!inner(
            id,
            reference,
            name,
            description,
            is_active
          )
        `,
        { count: 'exact' },
      );

      // Appliquer les filtres
      if (filters?.search) {
        query = query.or(
          `pieces.reference.ilike.%${filters.search}%,pieces.name.ilike.%${filters.search}%`,
        );
      }

      if (filters?.location) {
        query = query.eq('location', filters.location);
      }

      if (filters?.lowStock) {
        query = query.lte('available', 'min_stock');
      }

      if (filters?.outOfStock) {
        query = query.lte('available', 0);
      }

      if (filters?.isActive !== undefined) {
        query = query.eq('pieces.is_active', filters.isActive);
      }

      // Pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      query = query.range(from, to).order('available', { ascending: true });

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Erreur récupération stock: ${error.message}`);
      }

      // Calculer les statistiques
      const stats = await this.getStockStatistics();

      return {
        items: data || [],
        total: count || 0,
        stats,
      };
    } catch (error) {
      this.logger.error('Erreur récupération stock avancée', error);
      throw error;
    }
  }

  /**
   * Enregistrer un mouvement de stock avec validation
   */
  async recordStockMovement(movement: {
    productId: string;
    movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
    quantity: number;
    referenceType?: string;
    referenceId?: string;
    unitCost?: number;
    reason?: string;
    notes?: string;
    userId: string;
  }): Promise<void> {
    try {
      this.logger.debug('Enregistrement mouvement de stock', movement);

      // Vérifier que le produit existe
      const { data: product, error: productError } = await this.client
        .from('pieces')
        .select('id, reference, name')
        .eq('id', movement.productId)
        .single();

      if (productError || !product) {
        throw new BadRequestException('Produit non trouvé');
      }

      // Créer le mouvement
      const { error: movementError } = await this.client
        .from('stock_movements')
        .insert({
          product_id: movement.productId,
          type: movement.movementType,
          quantity: movement.quantity,
          reference_type: movement.referenceType,
          reference_id: movement.referenceId,
          unit_cost: movement.unitCost,
          reason: movement.reason || 'Mouvement de stock',
          notes: movement.notes,
          user_id: movement.userId,
          created_at: new Date().toISOString(),
        });

      if (movementError) {
        throw new Error(
          `Erreur enregistrement mouvement: ${movementError.message}`,
        );
      }

      // Mettre à jour le stock si nécessaire
      await this.updateStockAfterMovement(
        movement.productId,
        movement.movementType,
        movement.quantity,
      );

      // Vérifier les alertes
      const { data: currentStock } = await this.client
        .from('stock')
        .select('*')
        .eq('product_id', movement.productId)
        .single();

      if (currentStock) {
        await this.checkStockAlerts(currentStock);
      }

      // Invalider le cache
      await this.invalidateStockCache(movement.productId);

      this.logger.log('Mouvement de stock enregistré', {
        productId: movement.productId,
        type: movement.movementType,
        quantity: movement.quantity,
      });
    } catch (error) {
      this.logger.error('Erreur enregistrement mouvement', error);
      throw error;
    }
  }

  /**
   * Ajustement d'inventaire complet
   */
  async performInventoryAdjustment(
    productId: string,
    actualQuantity: number,
    reason: string,
    userId: string,
    notes?: string,
  ): Promise<{ success: boolean; difference: number; message: string }> {
    try {
      this.logger.debug("Ajustement d'inventaire", {
        productId,
        actualQuantity,
        reason,
      });

      // Récupérer le stock actuel
      const { data: currentStock, error: stockError } = await this.client
        .from('stock')
        .select('quantity, available, reserved')
        .eq('product_id', productId)
        .single();

      if (stockError || !currentStock) {
        throw new BadRequestException('Stock non trouvé pour ce produit');
      }

      const difference = actualQuantity - currentStock.quantity;

      if (difference !== 0) {
        // Enregistrer le mouvement d'ajustement
        await this.recordStockMovement({
          productId,
          movementType: 'ADJUSTMENT',
          quantity: Math.abs(difference),
          reason,
          notes: `Ajustement d'inventaire: ${difference > 0 ? '+' : ''}${difference}. ${notes || ''}`,
          userId,
        });

        this.logger.log("Ajustement d'inventaire effectué", {
          productId,
          oldQuantity: currentStock.quantity,
          newQuantity: actualQuantity,
          difference,
        });

        return {
          success: true,
          difference,
          message: `Ajustement effectué: ${difference > 0 ? '+' : ''}${difference} unités`,
        };
      } else {
        return {
          success: true,
          difference: 0,
          message: 'Aucun ajustement nécessaire',
        };
      }
    } catch (error) {
      this.logger.error('Erreur ajustement inventaire', error);
      throw error;
    }
  }

  /**
   * Générer un rapport de stock complet
   */
  async generateComprehensiveStockReport(): Promise<{
    summary: {
      totalProducts: number;
      totalValue: number;
      lowStockItems: number;
      outOfStockItems: number;
      overstockItems: number;
    };
    lowStockDetails: any[];
    outOfStockDetails: any[];
    overstockDetails: any[];
    movements: any[];
  }> {
    try {
      this.logger.debug('Génération rapport de stock complet');

      // Récupérer tous les stocks avec détails produits
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
        throw new Error(`Erreur récupération stocks: ${stocksError.message}`);
      }

      // Récupérer les mouvements récents (7 derniers jours)
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

      const lowStockDetails: any[] = [];
      const outOfStockDetails: any[] = [];
      const overstockDetails: any[] = [];

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
      this.logger.error('Erreur génération rapport', error);
      throw error;
    }
  }

  /**
   * Obtenir l'historique des mouvements avec filtres
   */
  async getMovementHistory(
    productId?: string,
    filters?: {
      movementType?: string;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      userId?: string;
    },
  ): Promise<any[]> {
    try {
      this.logger.debug('Récupération historique mouvements', {
        productId,
        filters,
      });

      let query = this.client.from('stock_movements').select(`
          *,
          pieces!inner(reference, name)
        `);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      if (filters?.movementType) {
        query = query.eq('type', filters.movementType);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      query = query
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erreur récupération historique: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur récupération historique', error);
      throw error;
    }
  }

  /**
   * Health check du service de gestion de stock
   */
  async healthCheck() {
    try {
      const { error } = await this.client
        .from('products')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connectionTest: 'ok',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Méthodes privées et utilitaires
   */

  private async getStockStatistics() {
    try {
      const { data: stats } = await this.client
        .from('stock')
        .select('available, min_stock, max_stock');

      if (!stats) return { outOfStock: 0, lowStock: 0, totalProducts: 0 };

      const outOfStock = stats.filter((s) => s.available === 0).length;
      const lowStock = stats.filter(
        (s) => s.available > 0 && s.available <= s.min_stock,
      ).length;

      return {
        totalProducts: stats.length,
        outOfStock,
        lowStock,
        overstock: stats.filter((s) => s.available >= s.max_stock).length,
      };
    } catch (error) {
      this.logger.error('Erreur calcul statistiques', error);
      return { outOfStock: 0, lowStock: 0, totalProducts: 0 };
    }
  }

  private async getStockAlerts() {
    try {
      const { data } = await this.client
        .from('stock_alerts')
        .select(
          `
          *,
          pieces!inner(reference, name)
        `,
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (error) {
      this.logger.error('Erreur récupération alertes', error);
      return [];
    }
  }

  private async checkStockAlerts(stock: any) {
    // Logique de vérification des alertes
    if (stock.available === 0) {
      this.eventEmitter.emit('stock.out_of_stock', {
        productId: stock.product_id,
        available: stock.available,
      });
    } else if (stock.available <= stock.min_stock) {
      this.eventEmitter.emit('stock.low_stock', {
        productId: stock.product_id,
        available: stock.available,
        minStock: stock.min_stock,
      });
    }
  }

  private async updateStockAfterMovement(
    productId: string,
    movementType: string,
    quantity: number,
  ): Promise<void> {
    try {
      const { data: currentStock } = await this.client
        .from('stock')
        .select('quantity, reserved')
        .eq('product_id', productId)
        .single();

      if (!currentStock) return;

      let newQuantity = currentStock.quantity;

      switch (movementType) {
        case 'IN':
          newQuantity += quantity;
          break;
        case 'OUT':
          newQuantity -= quantity;
          break;
        case 'ADJUSTMENT':
          // Pour les ajustements, recalculer selon la logique métier
          break;
        case 'RETURN':
          newQuantity += quantity;
          break;
      }

      const { error } = await this.client
        .from('stock')
        .update({
          quantity: newQuantity,
          available: newQuantity - currentStock.reserved,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId);

      if (error) {
        this.logger.error('Erreur mise à jour stock après mouvement', error);
      }
    } catch (error) {
      this.logger.error('Erreur updateStockAfterMovement', error);
    }
  }

  private async invalidateStockCache(productId: string) {
    const cacheKeys = [
      'stock:dashboard',
      `stock:product:${productId}`,
      'stock:statistics',
    ];

    for (const key of cacheKeys) {
      await this.deleteCached(key);
    }
  }
}
