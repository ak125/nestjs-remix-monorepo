/**
 * StockMovementService - Stock movement operations
 *
 * Extracted from StockManagementService for separation of concerns.
 * Handles: movement recording, movement history, inventory adjustments,
 * and stock updates after movements.
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';
import type { StockMovement } from './stock-management.service';

@Injectable()
export class StockMovementService extends SupabaseBaseService {
  protected readonly logger = new Logger(StockMovementService.name);

  constructor() {
    super();
    this.logger.log('StockMovementService initialized');
  }

  /**
   * Obtenir les mouvements de stock d'un produit
   */
  async getStockMovements(productId: string, limit = 50) {
    try {
      this.logger.debug('Recuperation mouvements stock', { productId, limit });

      const { data: movements, error } = await this.client
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur recuperation mouvements: ${error.message}`,
          details: error.message,
        });
      }

      return {
        success: true,
        data: movements || [],
        message: 'Mouvements recuperes avec succes',
      };
    } catch (error) {
      this.logger.error('Erreur recuperation mouvements', error);
      return {
        success: false,
        data: [],
        message: `Erreur: ${(error as Error).message}`,
      };
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
  ): Promise<Record<string, unknown>[]> {
    try {
      this.logger.debug('Recuperation historique mouvements', {
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
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur recuperation historique: ${error.message}`,
          details: error.message,
        });
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur recuperation historique', error);
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

      // Verifier que le produit existe
      const { data: product, error: productError } = await this.client
        .from(TABLES.pieces)
        .select('id, reference, name')
        .eq('id', movement.productId)
        .single();

      if (productError || !product) {
        throw new BadRequestException('Produit non trouve');
      }

      // Creer le mouvement
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
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.STOCK_ERROR,
          message: `Erreur enregistrement mouvement: ${movementError.message}`,
          details: movementError.message,
        });
      }

      // Mettre a jour le stock
      await this.updateStockAfterMovement(
        movement.productId,
        movement.movementType,
        movement.quantity,
      );

      this.logger.log('Mouvement de stock enregistre', {
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

      // Recuperer le stock actuel
      const { data: currentStock, error: stockError } = await this.client
        .from('stock')
        .select('quantity, available, reserved')
        .eq('product_id', productId)
        .single();

      if (stockError || !currentStock) {
        throw new BadRequestException('Stock non trouve pour ce produit');
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

        this.logger.log("Ajustement d'inventaire effectue", {
          productId,
          oldQuantity: currentStock.quantity,
          newQuantity: actualQuantity,
          difference,
        });

        return {
          success: true,
          difference,
          message: `Ajustement effectue: ${difference > 0 ? '+' : ''}${difference} unites`,
        };
      } else {
        return {
          success: true,
          difference: 0,
          message: 'Aucun ajustement necessaire',
        };
      }
    } catch (error) {
      this.logger.error('Erreur ajustement inventaire', error);
      throw error;
    }
  }

  /**
   * Creer un mouvement de stock simple (usage interne)
   */
  async createStockMovement(movement: StockMovement) {
    try {
      const { error } = await this.client.from('stock_movements').insert({
        ...movement,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error('Erreur creation mouvement', error);
      }
    } catch (error) {
      this.logger.error('Erreur creation mouvement stock', error);
    }
  }

  /**
   * Mettre a jour le stock apres un mouvement
   */
  async updateStockAfterMovement(
    productId: string,
    movementType: string,
    quantity: number,
  ): Promise<void> {
    try {
      // Recuperer le stock actuel
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
          // Pour les ajustements, la quantite est deja la nouvelle valeur
          // Cette logique depend de l'implementation choisie
          break;
        case 'RETURN':
          newQuantity += quantity;
          break;
      }

      // Mettre a jour le stock
      const { error } = await this.client
        .from('stock')
        .update({
          quantity: newQuantity,
          available: newQuantity - currentStock.reserved,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId);

      if (error) {
        this.logger.error('Erreur mise a jour stock apres mouvement', error);
      }
    } catch (error) {
      this.logger.error('Erreur updateStockAfterMovement', error);
    }
  }
}
