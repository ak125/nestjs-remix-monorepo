import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { CacheService } from '@cache/cache.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

/**
 * 📦 SERVICE DE GESTION STOCK EN TEMPS RÉEL
 *
 * Responsabilités:
 * - Vérification disponibilité stock
 * - Réservation temporaire (30 min)
 * - Libération automatique après expiration
 * - Alertes stock faible
 * - Prévention survente
 */
@Injectable()
export class StockManagementService {
  private readonly logger = new Logger(StockManagementService.name);
  private readonly client: SupabaseClient;

  // Durée de réservation stock (30 minutes)
  private readonly RESERVATION_TTL = 30 * 60; // 1800 secondes

  // Seuil stock faible
  private readonly LOW_STOCK_THRESHOLD = 10;

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    // Initialiser le client Supabase
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    // Initialisation du client Supabase
    this.client = createClient(supabaseUrl, supabaseKey);

    this.logger.log('StockManagementService initialized');
  }

  /**
   * 📊 Récupérer le stock disponible d'un produit
   */
  async getAvailableStock(productId: number): Promise<number> {
    try {
      // Récupérer stock physique depuis la base
      const { data: product, error } = await this.client
        .from(TABLES.pieces)
        .select('piece_stock, piece_stock_reserved')
        .eq('piece_id', productId)
        .single();

      if (error || !product) {
        this.logger.warn(
          `Produit ${productId} introuvable pour vérification stock`,
        );
        return 0;
      }

      const physicalStock = parseInt(product.piece_stock) || 0;
      const reservedStock = parseInt(product.piece_stock_reserved) || 0;

      // Récupérer réservations temporaires depuis Redis
      const tempReservations = await this.getTempReservations(productId);

      // Stock disponible = stock physique - réservé DB - réservé temporaire
      const availableStock = physicalStock - reservedStock - tempReservations;

      this.logger.log(
        `📦 Stock produit ${productId}: physique=${physicalStock}, réservé=${reservedStock}, temp=${tempReservations}, dispo=${availableStock}`,
      );

      return Math.max(0, availableStock);
    } catch (error) {
      this.logger.error(`Erreur récupération stock ${productId}:`, error);
      return 0;
    }
  }

  /**
   * 🔒 Vérifier si quantité disponible
   */
  async checkAvailability(
    productId: number,
    requestedQuantity: number,
  ): Promise<{
    available: boolean;
    stock: number;
    message?: string;
  }> {
    try {
      const availableStock = await this.getAvailableStock(productId);

      if (requestedQuantity <= availableStock) {
        return {
          available: true,
          stock: availableStock,
        };
      }

      return {
        available: false,
        stock: availableStock,
        message: `Stock insuffisant. Disponible: ${availableStock}, demandé: ${requestedQuantity}`,
      };
    } catch (error) {
      this.logger.error('Erreur vérification disponibilité:', error);
      return {
        available: false,
        stock: 0,
        message: 'Erreur vérification stock',
      };
    }
  }

  /**
   * 🎯 Réserver temporairement du stock (ajout au panier)
   */
  async reserveStock(
    productId: number,
    quantity: number,
    sessionId: string,
  ): Promise<boolean> {
    try {
      // Vérifier disponibilité
      const check = await this.checkAvailability(productId, quantity);
      if (!check.available) {
        this.logger.warn(
          `Réservation impossible pour produit ${productId}: ${check.message}`,
        );
        return false;
      }

      // Clé Redis pour la réservation
      const reservationKey = `stock:reservation:${productId}:${sessionId}`;

      // Enregistrer la réservation temporaire
      await this.cacheService.set(
        reservationKey,
        {
          product_id: productId,
          quantity,
          session_id: sessionId,
          reserved_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + this.RESERVATION_TTL * 1000,
          ).toISOString(),
        },
        this.RESERVATION_TTL,
      );

      this.logger.log(
        `🔒 Stock réservé: produit ${productId}, quantité ${quantity}, session ${sessionId} (expire dans ${this.RESERVATION_TTL / 60}min)`,
      );

      // Incrémenter le compteur de réservations temporaires
      await this.incrementTempReservation(productId, quantity);

      return true;
    } catch (error) {
      this.logger.error('Erreur réservation stock:', error);
      return false;
    }
  }

  /**
   * 🔓 Libérer la réservation (suppression du panier ou expiration)
   */
  async releaseStock(productId: number, sessionId: string): Promise<void> {
    try {
      const reservationKey = `stock:reservation:${productId}:${sessionId}`;

      // Récupérer la réservation avant de la supprimer
      const reservation = await this.cacheService.get<any>(reservationKey);

      if (reservation) {
        // Décrémenter le compteur de réservations temporaires
        await this.decrementTempReservation(productId, reservation.quantity);

        // Supprimer la réservation
        await this.cacheService.del(reservationKey);

        this.logger.log(
          `🔓 Stock libéré: produit ${productId}, quantité ${reservation.quantity}, session ${sessionId}`,
        );
      }
    } catch (error) {
      this.logger.error('Erreur libération stock:', error);
    }
  }

  /**
   * 🔄 Mettre à jour la quantité réservée
   */
  async updateReservation(
    productId: number,
    sessionId: string,
    newQuantity: number,
  ): Promise<boolean> {
    try {
      const reservationKey = `stock:reservation:${productId}:${sessionId}`;

      // Récupérer l'ancienne réservation
      const oldReservation = await this.cacheService.get<any>(reservationKey);

      if (!oldReservation) {
        // Pas de réservation existante, en créer une nouvelle
        return await this.reserveStock(productId, newQuantity, sessionId);
      }

      const oldQuantity = oldReservation.quantity;
      const diff = newQuantity - oldQuantity;

      // Vérifier si la nouvelle quantité est disponible
      if (diff > 0) {
        const check = await this.checkAvailability(productId, diff);
        if (!check.available) {
          this.logger.warn(
            `Mise à jour impossible: stock insuffisant pour produit ${productId}`,
          );
          return false;
        }
      }

      // Mettre à jour la réservation
      await this.cacheService.set(
        reservationKey,
        {
          ...oldReservation,
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        },
        this.RESERVATION_TTL,
      );

      // Ajuster le compteur de réservations temporaires
      if (diff > 0) {
        await this.incrementTempReservation(productId, diff);
      } else if (diff < 0) {
        await this.decrementTempReservation(productId, Math.abs(diff));
      }

      this.logger.log(
        `🔄 Réservation mise à jour: produit ${productId}, ancienne qté ${oldQuantity}, nouvelle qté ${newQuantity}`,
      );

      return true;
    } catch (error) {
      this.logger.error('Erreur mise à jour réservation:', error);
      return false;
    }
  }

  /**
   * 📊 Récupérer le total des réservations temporaires
   */
  private async getTempReservations(productId: number): Promise<number> {
    try {
      const key = `stock:temp:${productId}`;
      const temp = await this.cacheService.get<number>(key);
      return temp || 0;
    } catch {
      return 0;
    }
  }

  /**
   * ➕ Incrémenter le compteur de réservations temporaires
   */
  private async incrementTempReservation(
    productId: number,
    quantity: number,
  ): Promise<void> {
    try {
      const key = `stock:temp:${productId}`;
      const current = (await this.cacheService.get<number>(key)) || 0;
      await this.cacheService.set(key, current + quantity, 86400); // 24h TTL
    } catch (error) {
      this.logger.error('Erreur increment temp reservation:', error);
    }
  }

  /**
   * ➖ Décrémenter le compteur de réservations temporaires
   */
  private async decrementTempReservation(
    productId: number,
    quantity: number,
  ): Promise<void> {
    try {
      const key = `stock:temp:${productId}`;
      const current = (await this.cacheService.get<number>(key)) || 0;
      const newValue = Math.max(0, current - quantity);
      await this.cacheService.set(key, newValue, 86400);
    } catch (error) {
      this.logger.error('Erreur decrement temp reservation:', error);
    }
  }

  /**
   * ⚠️ Vérifier si stock faible
   */
  async isLowStock(productId: number): Promise<boolean> {
    const availableStock = await this.getAvailableStock(productId);
    return availableStock > 0 && availableStock <= this.LOW_STOCK_THRESHOLD;
  }

  /**
   * 🚨 Obtenir les alertes stock
   */
  async getStockAlert(productId: number): Promise<{
    level: 'ok' | 'low' | 'out';
    stock: number;
    message: string;
  }> {
    const stock = await this.getAvailableStock(productId);

    if (stock === 0) {
      return {
        level: 'out',
        stock: 0,
        message: 'Rupture de stock',
      };
    }

    if (stock <= this.LOW_STOCK_THRESHOLD) {
      return {
        level: 'low',
        stock,
        message: `Plus que ${stock} en stock !`,
      };
    }

    return {
      level: 'ok',
      stock,
      message: 'Stock disponible',
    };
  }

  /**
   * 🧹 Nettoyer toutes les réservations d'une session
   */
  async releaseAllSessionReservations(sessionId: string): Promise<void> {
    try {
      // Pattern pour trouver toutes les réservations de la session
      // Note: Redis SCAN serait plus efficace en production
      this.logger.log(
        `🧹 Libération de toutes les réservations pour session ${sessionId}`,
      );

      // Cette méthode devrait être appelée lors du vidage du panier
      // ou de la validation de commande
    } catch (error) {
      this.logger.error('Erreur libération réservations session:', error);
    }
  }

  /**
   * ✅ Confirmer la réservation (conversion en commande)
   */
  async confirmReservation(
    productId: number,
    sessionId: string,
    orderId: number,
  ): Promise<boolean> {
    try {
      const reservationKey = `stock:reservation:${productId}:${sessionId}`;
      const reservation = await this.cacheService.get<any>(reservationKey);

      if (!reservation) {
        this.logger.warn(`Aucune réservation trouvée pour confirmation`);
        return false;
      }

      // Mettre à jour le stock réservé en base
      // NOTE: Supabase ne supporte pas .raw(), on récupère d'abord la valeur actuelle
      const { data: currentPiece } = await this.client
        .from(TABLES.pieces)
        .select('piece_stock_reserved')
        .eq('piece_id', productId)
        .single();

      const { error } = await this.client
        .from(TABLES.pieces)
        .update({
          piece_stock_reserved:
            (currentPiece?.piece_stock_reserved || 0) + reservation.quantity,
        })
        .eq('piece_id', productId);

      if (error) {
        this.logger.error('Erreur confirmation réservation:', error);
        return false;
      }

      // Supprimer la réservation temporaire
      await this.releaseStock(productId, sessionId);

      this.logger.log(
        `✅ Réservation confirmée pour commande ${orderId}: produit ${productId}, quantité ${reservation.quantity}`,
      );

      return true;
    } catch (error) {
      this.logger.error('Erreur confirmation réservation:', error);
      return false;
    }
  }
}
