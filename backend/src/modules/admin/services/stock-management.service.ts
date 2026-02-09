import { TABLES } from '@repo/database-types';
/**
 * StockManagementService - Facade for stock management
 *
 * This service delegates to specialized sub-services:
 * - StockMovementService: movement recording, history, inventory adjustments
 * - StockReportService: reports, alerts, statistics
 *
 * All public method signatures are preserved for backward compatibility.
 */

import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';
import { StockMovementService } from './stock-movement.service';
import { StockReportService } from './stock-report.service';

export interface StockItem {
  id: string;
  product_id: string;
  quantity: number;
  reserved: number;
  available: number;
  min_stock: number;
  max_stock: number;
  location?: string;
  last_restock_date?: Date;
  next_restock_date?: Date;
  updated_at?: Date;
}

export interface StockMovement {
  id?: string;
  product_id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  reason: string;
  order_id?: string;
  user_id: string;
  created_at?: Date;
}

export interface StockDashboardFilters {
  search?: string;
  minStock?: boolean;
  outOfStock?: boolean;
  supplierId?: string;
  categoryId?: string;
  isActive?: boolean;
}

export interface StockStatistics {
  totalProducts: number;
  outOfStock: number;
  lowStock: number;
  overstock: number;
  avgStockLevel: number;
}

export interface StockReportDetail {
  productName?: string;
  productReference?: string;
  value: number;
  [key: string]: unknown;
}

export interface StockUpdateData {
  quantity?: number;
  minStock?: number;
  maxStock?: number;
  location?: string;
  nextRestockDate?: Date;
}

@Injectable()
export class StockManagementService extends SupabaseBaseService {
  protected readonly logger = new Logger(StockManagementService.name);

  constructor(
    private readonly cacheService: CacheService,
    @Inject(forwardRef(() => StockMovementService))
    private readonly stockMovementService: StockMovementService,
    @Inject(forwardRef(() => StockReportService))
    private readonly stockReportService: StockReportService,
  ) {
    super();
    this.logger.log('StockManagementService initialized');
  }

  /**
   * Recuperer le dashboard stock
   */
  async getStockDashboard(filters?: StockDashboardFilters) {
    try {
      this.logger.debug('Recuperation du dashboard stock', { filters });

      // Verifier le cache
      const cacheKey = `stock:dashboard:${JSON.stringify(filters || {})}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug('Dashboard stock recupere depuis le cache');
        return cached;
      }

      // Construire la requete de base
      let query = this.client.from('stock').select(`
          *,
          pieces!inner(
            id,
            reference,
            name,
            description,
            is_active
          )
        `);

      // Appliquer les filtres
      if (filters?.minStock) {
        query = query.lte('available', 'min_stock');
      }

      if (filters?.outOfStock) {
        query = query.lte('available', 0);
      }

      if (filters?.isActive !== undefined) {
        query = query.eq('pieces.is_active', filters.isActive);
      }

      // Ordonner par stock disponible
      query = query.order('available', { ascending: true });

      const { data: items, error } = await query;

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur recuperation stock: ${error.message}`,
          details: error.message,
        });
      }

      // Calculer les statistiques basiques
      const stats = {
        totalProducts: items?.length || 0,
        lowStock:
          items?.filter((item) => item.available <= (item.min_stock || 0))
            .length || 0,
        outOfStock: items?.filter((item) => item.available <= 0).length || 0,
      };

      const result = {
        success: true,
        data: {
          items: items || [],
          stats,
          totalItems: items?.length || 0,
        },
        message: 'Dashboard stock recupere avec succes',
      };

      // Mettre en cache pour 1 minute
      await this.cacheService.set(cacheKey, result, 60);

      return result;
    } catch (error) {
      this.logger.error('Erreur dashboard stock', error);
      return {
        success: false,
        data: { items: [], stats: {}, totalItems: 0 },
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Mettre a jour le stock d'un produit
   */
  async updateStock(
    productId: string,
    updateData: StockUpdateData,
    adminUserId: string,
    reason: string,
  ) {
    try {
      this.logger.debug('Mise a jour stock', {
        productId,
        updateData,
        adminUserId,
      });

      // Recuperer l'etat actuel
      const { data: currentStock, error: fetchError } = await this.client
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (fetchError || !currentStock) {
        throw new BadRequestException('Produit introuvable dans le stock');
      }

      // Preparer les donnees de mise a jour
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Gerer la mise a jour de quantite
      if (updateData.quantity !== undefined) {
        const difference = updateData.quantity - currentStock.quantity;

        // Creer un mouvement de stock
        if (difference !== 0) {
          await this.stockMovementService.createStockMovement({
            product_id: productId,
            type: difference > 0 ? 'IN' : 'ADJUSTMENT',
            quantity: Math.abs(difference),
            reason,
            user_id: adminUserId,
          });
        }

        updatePayload.quantity = updateData.quantity;
        updatePayload.available = updateData.quantity - currentStock.reserved;
      }

      // Autres mises a jour
      if (updateData.minStock !== undefined) {
        updatePayload.min_stock = updateData.minStock;
      }

      if (updateData.maxStock !== undefined) {
        updatePayload.max_stock = updateData.maxStock;
      }

      if (updateData.location !== undefined) {
        updatePayload.location = updateData.location;
      }

      if (updateData.nextRestockDate !== undefined) {
        updatePayload.next_restock_date =
          updateData.nextRestockDate.toISOString();
      }

      // Executer la mise a jour
      const { data: updatedStock, error: updateError } = await this.client
        .from('stock')
        .update(updatePayload)
        .eq('product_id', productId)
        .select()
        .single();

      if (updateError) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur mise a jour: ${updateError.message}`,
          details: updateError.message,
        });
      }

      // Logger l'action
      this.logger.log('Stock mis a jour', {
        productId,
        adminUserId,
        changes: updatePayload,
        reason,
      });

      // Invalider le cache
      await this.invalidateStockCache(productId);

      // Verifier les alertes
      if (updatedStock) {
        await this.stockReportService.checkStockAlerts(updatedStock);
      }

      return {
        success: true,
        data: updatedStock,
        message: 'Stock mis a jour avec succes',
      };
    } catch (error) {
      this.logger.error('Erreur mise a jour stock', error);
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Desactiver un produit
   */
  async disableProduct(productId: string, adminUserId: string, reason: string) {
    try {
      this.logger.debug('Desactivation produit', {
        productId,
        adminUserId,
        reason,
      });

      // Verifier s'il y a des commandes en cours (simplifie)
      const { data: activeOrders, error: ordersError } = await this.client
        .from(TABLES.xtr_order_line)
        .select('id, order_id')
        .eq('product_id', productId)
        .in('status', [1, 2, 3]); // statuts actifs

      if (ordersError) {
        this.logger.warn('Erreur verification commandes', ordersError);
      }

      if (activeOrders && activeOrders.length > 0) {
        throw new BadRequestException(
          `Impossible de desactiver: ${activeOrders.length} commandes en cours`,
        );
      }

      // Desactiver le produit
      const { data: product, error: disableError } = await this.client
        .from(TABLES.pieces)
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .select()
        .single();

      if (disableError) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur desactivation: ${disableError.message}`,
          details: disableError.message,
        });
      }

      // Recuperer le stock actuel et liberer les reserves
      const { data: currentStock } = await this.client
        .from('stock')
        .select('quantity, reserved')
        .eq('product_id', productId)
        .single();

      if (currentStock) {
        await this.client
          .from('stock')
          .update({
            reserved: 0,
            available: currentStock.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('product_id', productId);
      }

      // Logger l'action
      this.logger.warn('Produit desactive', {
        productId,
        adminUserId,
        reason,
      });

      return {
        success: true,
        data: product,
        message: 'Produit desactive avec succes',
      };
    } catch (error) {
      this.logger.error('Erreur desactivation produit', error);
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Reserver du stock pour une commande
   */
  async reserveStock(productId: string, quantity: number, orderId: string) {
    try {
      this.logger.debug('Reservation stock', { productId, quantity, orderId });

      // Recuperer le stock actuel
      const { data: stock, error: fetchError } = await this.client
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (fetchError || !stock) {
        throw new BadRequestException('Produit introuvable dans le stock');
      }

      // Verifier la disponibilite
      if (stock.available < quantity) {
        throw new BadRequestException(
          `Stock insuffisant. Disponible: ${stock.available}, Demande: ${quantity}`,
        );
      }

      // Mettre a jour le stock
      const { data: updatedStock, error: updateError } = await this.client
        .from('stock')
        .update({
          reserved: stock.reserved + quantity,
          available: stock.available - quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId)
        .select()
        .single();

      if (updateError) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur reservation: ${updateError.message}`,
          details: updateError.message,
        });
      }

      // Creer un mouvement de stock
      await this.stockMovementService.createStockMovement({
        product_id: productId,
        type: 'OUT',
        quantity,
        reason: `Reservation pour commande ${orderId}`,
        order_id: orderId,
        user_id: 'system',
      });

      this.logger.log('Stock reserve', {
        productId,
        quantity,
        orderId,
      });

      return {
        success: true,
        data: updatedStock,
        message: 'Stock reserve avec succes',
      };
    } catch (error) {
      this.logger.error('Erreur reservation stock', error);
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Liberer du stock reserve
   */
  async releaseStock(productId: string, quantity: number, orderId: string) {
    try {
      this.logger.debug('Liberation stock', { productId, quantity, orderId });

      // Recuperer le stock actuel
      const { data: stock, error: fetchError } = await this.client
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (fetchError || !stock) {
        throw new BadRequestException('Produit introuvable dans le stock');
      }

      // Mettre a jour le stock
      const { data: updatedStock, error: updateError } = await this.client
        .from('stock')
        .update({
          reserved: Math.max(0, stock.reserved - quantity),
          available: stock.available + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId)
        .select()
        .single();

      if (updateError) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur liberation: ${updateError.message}`,
          details: updateError.message,
        });
      }

      // Creer un mouvement de stock
      await this.stockMovementService.createStockMovement({
        product_id: productId,
        type: 'RETURN',
        quantity,
        reason: `Liberation pour commande ${orderId}`,
        order_id: orderId,
        user_id: 'system',
      });

      this.logger.log('Stock libere', {
        productId,
        quantity,
        orderId,
      });

      return {
        success: true,
        data: updatedStock,
        message: 'Stock libere avec succes',
      };
    } catch (error) {
      this.logger.error('Erreur liberation stock', error);
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  // =========================================================================
  // Delegated methods - StockMovementService
  // =========================================================================

  async getStockMovements(productId: string, limit = 50) {
    return this.stockMovementService.getStockMovements(productId, limit);
  }

  async getMovementHistory(
    productId?: string,
    filters?: {
      movementType?: string;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      userId?: string;
    },
  ): Promise<Record<string, unknown>[]> {
    return this.stockMovementService.getMovementHistory(productId, filters);
  }

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
    await this.stockMovementService.recordStockMovement(movement);
    // Check alerts after movement (cross-service coordination)
    const { data: currentStock } = await this.client
      .from('stock')
      .select('*')
      .eq('product_id', movement.productId)
      .single();
    if (currentStock) {
      await this.stockReportService.checkStockAlerts(currentStock);
    }
    // Invalidate cache
    await this.invalidateStockCache(movement.productId);
  }

  async performInventoryAdjustment(
    productId: string,
    actualQuantity: number,
    reason: string,
    userId: string,
    notes?: string,
  ): Promise<{ success: boolean; difference: number; message: string }> {
    return this.stockMovementService.performInventoryAdjustment(
      productId,
      actualQuantity,
      reason,
      userId,
      notes,
    );
  }

  // =========================================================================
  // Delegated methods - StockReportService
  // =========================================================================

  async generateComprehensiveStockReport() {
    return this.stockReportService.generateComprehensiveStockReport();
  }

  async getStockAlerts() {
    return this.stockReportService.getStockAlerts();
  }

  // =========================================================================
  // Methods that remain in this service
  // =========================================================================

  /**
   * Obtenir l'etat du stock avec filtres avances
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
  }): Promise<{ items: StockItem[]; total: number; stats: StockStatistics }> {
    try {
      this.logger.debug('Recuperation stock avec filtres avances', { filters });

      // Construire la requete
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
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur recuperation stock: ${error.message}`,
          details: error.message,
        });
      }

      // Calculer les statistiques via sub-service
      const stats = await this.stockReportService.getStockStatistics();

      return {
        items: data || [],
        total: count || 0,
        stats,
      };
    } catch (error) {
      this.logger.error('Erreur recuperation stock avancee', error);
      throw error;
    }
  }

  /**
   * Health check du service de gestion de stock
   */
  async healthCheck() {
    try {
      // Test simple de connectivite a la base
      const { error } = await this.supabase
        .from(TABLES.pieces)
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

  // =========================================================================
  // Private helpers
  // =========================================================================

  private async invalidateStockCache(productId?: string) {
    try {
      // Invalider le cache specifique du produit
      if (productId) {
        await this.cacheService.del(`stock:${productId}`);
      }

      // Invalider le cache du dashboard
      await this.cacheService.del('stock:dashboard');
    } catch (error) {
      this.logger.error('Erreur invalidation cache', error);
    }
  }
}
