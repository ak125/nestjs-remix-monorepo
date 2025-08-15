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

      // Calculer les statistiques
      const stats = await this.getStockStatistics();

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
        .from('___xtr_order_line')
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
        .from('pieces')
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
      const { data, error } = await this.supabase
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
}
