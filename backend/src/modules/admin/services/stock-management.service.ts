import { TABLES } from '@repo/database-types';
/**
 * 📦 StockManagementService - Service de gestion des stocks
 *
 * Service aligné sur l'approche des modules users/orders/cart :
 * ✅ Hérite de SupabaseBaseService pour accès Supabase
 * ✅ Méthodes async avec gestion d'erreurs
 * ✅ Architecture modulaire et testable
 * ✅ Intégration avec cache pour performance
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';

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

  constructor(private readonly cacheService: CacheService) {
    super();
    this.logger.log('StockManagementService initialized');
  }

  /**
   * Récupérer le dashboard stock
   */
  async getStockDashboard(filters?: StockDashboardFilters) {
    try {
      this.logger.debug('Récupération du dashboard stock', { filters });

      // Vérifier le cache
      const cacheKey = `stock:dashboard:${JSON.stringify(filters || {})}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug('Dashboard stock récupéré depuis le cache');
        return cached;
      }

      // Construire la requête de base
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
        throw new Error(`Erreur récupération stock: ${error.message}`);
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
        message: 'Dashboard stock récupéré avec succès',
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
   * Mettre à jour le stock d'un produit
   */
  async updateStock(
    productId: string,
    updateData: StockUpdateData,
    adminUserId: string,
    reason: string,
  ) {
    try {
      this.logger.debug('Mise à jour stock', {
        productId,
        updateData,
        adminUserId,
      });

      // Récupérer l'état actuel
      const { data: currentStock, error: fetchError } = await this.client
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (fetchError || !currentStock) {
        throw new BadRequestException('Produit introuvable dans le stock');
      }

      // Préparer les données de mise à jour
      const updatePayload: any = {
        updated_at: new Date().toISOString(),
      };

      // Gérer la mise à jour de quantité
      if (updateData.quantity !== undefined) {
        const difference = updateData.quantity - currentStock.quantity;

        // Créer un mouvement de stock
        if (difference !== 0) {
          await this.createStockMovement({
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

      // Autres mises à jour
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

      // Exécuter la mise à jour
      const { data: updatedStock, error: updateError } = await this.client
        .from('stock')
        .update(updatePayload)
        .eq('product_id', productId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Erreur mise à jour: ${updateError.message}`);
      }

      // Logger l'action
      this.logger.log('Stock mis à jour', {
        productId,
        adminUserId,
        changes: updatePayload,
        reason,
      });

      // Invalider le cache
      await this.invalidateStockCache(productId);

      // Vérifier les alertes
      if (updatedStock) {
        await this.checkStockAlerts(updatedStock);
      }

      return {
        success: true,
        data: updatedStock,
        message: 'Stock mis à jour avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur mise à jour stock', error);
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Désactiver un produit
   */
  async disableProduct(productId: string, adminUserId: string, reason: string) {
    try {
      this.logger.debug('Désactivation produit', {
        productId,
        adminUserId,
        reason,
      });

      // Vérifier s'il y a des commandes en cours (simplifié)
      const { data: activeOrders, error: ordersError } = await this.client
        .from(TABLES.xtr_order_line)
        .select('id, order_id')
        .eq('product_id', productId)
        .in('status', [1, 2, 3]); // statuts actifs

      if (ordersError) {
        this.logger.warn('Erreur vérification commandes', ordersError);
      }

      if (activeOrders && activeOrders.length > 0) {
        throw new BadRequestException(
          `Impossible de désactiver: ${activeOrders.length} commandes en cours`,
        );
      }

      // Désactiver le produit
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
        throw new Error(`Erreur désactivation: ${disableError.message}`);
      }

      // Récupérer le stock actuel et libérer les réserves
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
      this.logger.warn('Produit désactivé', {
        productId,
        adminUserId,
        reason,
      });

      return {
        success: true,
        data: product,
        message: 'Produit désactivé avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur désactivation produit', error);
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Réserver du stock pour une commande
   */
  async reserveStock(productId: string, quantity: number, orderId: string) {
    try {
      this.logger.debug('Réservation stock', { productId, quantity, orderId });

      // Récupérer le stock actuel
      const { data: stock, error: fetchError } = await this.client
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (fetchError || !stock) {
        throw new BadRequestException('Produit introuvable dans le stock');
      }

      // Vérifier la disponibilité
      if (stock.available < quantity) {
        throw new BadRequestException(
          `Stock insuffisant. Disponible: ${stock.available}, Demandé: ${quantity}`,
        );
      }

      // Mettre à jour le stock
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
        throw new Error(`Erreur réservation: ${updateError.message}`);
      }

      // Créer un mouvement de stock
      await this.createStockMovement({
        product_id: productId,
        type: 'OUT',
        quantity,
        reason: `Réservation pour commande ${orderId}`,
        order_id: orderId,
        user_id: 'system',
      });

      this.logger.log('Stock réservé', {
        productId,
        quantity,
        orderId,
      });

      return {
        success: true,
        data: updatedStock,
        message: 'Stock réservé avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur réservation stock', error);
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Libérer du stock réservé
   */
  async releaseStock(productId: string, quantity: number, orderId: string) {
    try {
      this.logger.debug('Libération stock', { productId, quantity, orderId });

      // Récupérer le stock actuel
      const { data: stock, error: fetchError } = await this.client
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (fetchError || !stock) {
        throw new BadRequestException('Produit introuvable dans le stock');
      }

      // Mettre à jour le stock
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
        throw new Error(`Erreur libération: ${updateError.message}`);
      }

      // Créer un mouvement de stock
      await this.createStockMovement({
        product_id: productId,
        type: 'RETURN',
        quantity,
        reason: `Libération pour commande ${orderId}`,
        order_id: orderId,
        user_id: 'system',
      });

      this.logger.log('Stock libéré', {
        productId,
        quantity,
        orderId,
      });

      return {
        success: true,
        data: updatedStock,
        message: 'Stock libéré avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur libération stock', error);
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Obtenir les mouvements de stock d'un produit
   */
  async getStockMovements(productId: string, limit = 50) {
    try {
      this.logger.debug('Récupération mouvements stock', { productId, limit });

      const { data: movements, error } = await this.client
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Erreur récupération mouvements: ${error.message}`);
      }

      return {
        success: true,
        data: movements || [],
        message: 'Mouvements récupérés avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur récupération mouvements', error);
      return {
        success: false,
        data: [],
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Obtenir les alertes de stock
   */
  async getStockAlerts() {
    try {
      this.logger.debug('Récupération alertes stock');

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
        throw new Error(`Erreur récupération alertes: ${error.message}`);
      }

      return {
        success: true,
        data: alerts || [],
        message: 'Alertes récupérées avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur récupération alertes', error);
      return {
        success: false,
        data: [],
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Méthodes privées
   */

  private async getStockStatistics() {
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

  private async createStockMovement(movement: StockMovement) {
    try {
      const { error } = await this.client.from('stock_movements').insert({
        ...movement,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error('Erreur création mouvement', error);
      }
    } catch (error) {
      this.logger.error('Erreur création mouvement stock', error);
    }
  }

  private async checkStockAlerts(stock: StockItem) {
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
          this.logger.error('Erreur création alerte', error);
        } else {
          this.logger.warn('Alerte stock créée', {
            productId: stock.product_id,
            type: alertType,
            level: alertLevel,
          });
        }
      }
    } catch (error) {
      this.logger.error('Erreur vérification alertes', error);
    }
  }

  private async invalidateStockCache(productId?: string) {
    try {
      // Invalider le cache spécifique du produit
      if (productId) {
        await this.cacheService.del(`stock:${productId}`);
      }

      // Invalider le cache du dashboard
      await this.cacheService.del('stock:dashboard');
    } catch (error) {
      this.logger.error('Erreur invalidation cache', error);
    }
  }

  /**
   * Health check du service de gestion de stock
   */
  async healthCheck() {
    try {
      // Test simple de connectivité à la base
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

  /**
   * =====================================================
   * NOUVELLES MÉTHODES ENRICHIES - INSPIRÉES DU SERVICE FOURNI
   * =====================================================
   */

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
  }): Promise<{ items: StockItem[]; total: number; stats: any }> {
    try {
      this.logger.debug('Récupération stock avec filtres avancés', { filters });

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
        .from(TABLES.pieces)
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
   * Méthodes privées supplémentaires
   */

  private async updateStockAfterMovement(
    productId: string,
    movementType: string,
    quantity: number,
  ): Promise<void> {
    try {
      // Cette logique peut être gérée par des triggers en base
      // ou ici selon l'architecture choisie

      // Récupérer le stock actuel
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
          // Pour les ajustements, la quantité est déjà la nouvelle valeur
          // Cette logique dépend de l'implémentation choisie
          break;
        case 'RETURN':
          newQuantity += quantity;
          break;
      }

      // Mettre à jour le stock
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
}
