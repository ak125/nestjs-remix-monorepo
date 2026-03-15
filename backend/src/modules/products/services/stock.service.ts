import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';

/**
 * 📦 SERVICE DE GESTION DU STOCK - MODE FLUX TENDU
 *
 * Modes de fonctionnement:
 * - UNLIMITED: Stock illimité (flux tendu, réapprovisionnement automatique)
 * - TRACKED: Suivi du stock réel avec alertes de réapprovisionnement
 *
 * Responsabilités:
 * - Vérifier le stock disponible d'un produit
 * - Calculer le stock réservé (dans les paniers)
 * - Générer des alertes de réapprovisionnement
 * - Gérer l'inventaire avec seuils configurables
 * - Valider les quantités lors de l'ajout au panier
 */
@Injectable()
export class StockService extends SupabaseBaseService {
  protected readonly logger = new Logger(StockService.name);

  // 🔧 Configuration du mode de stock
  private readonly STOCK_MODE: 'UNLIMITED' | 'TRACKED';

  // Seuils de stock pour le mode TRACKED
  private readonly LOW_STOCK_THRESHOLD = 10; // Alerte stock faible
  private readonly REORDER_THRESHOLD = 20; // Seuil de réapprovisionnement
  private readonly DEFAULT_STOCK = 50; // Stock par défaut si non défini

  // Configuration flux tendu
  private readonly UNLIMITED_DISPLAY_STOCK = 999; // Stock affiché en mode illimité
  private readonly REORDER_QUANTITY = 100; // Quantité de réapprovisionnement

  constructor(configService: ConfigService) {
    super(configService);

    // Lire le mode depuis les variables d'environnement
    // Par défaut: UNLIMITED pour flux tendu
    const stockModeValue = configService.get<string>('STOCK_MODE');
    this.STOCK_MODE = stockModeValue === 'TRACKED' ? 'TRACKED' : 'UNLIMITED';

    this.logger.log(`🔧 StockService initialized - Mode: ${this.STOCK_MODE}`);

    if (this.STOCK_MODE === 'UNLIMITED') {
      this.logger.warn(
        '⚠️  MODE FLUX TENDU ACTIVÉ - Stock illimité avec réapprovisionnement automatique',
      );
    }
  }

  /**
   * 📊 Récupérer les informations de stock d'un produit
   *
   * En mode UNLIMITED: Retourne toujours un stock disponible
   * En mode TRACKED: Suit le stock réel et génère des alertes
   */
  async getProductStock(productId: number | string): Promise<{
    available: number;
    reserved: number;
    total: number;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
    needsReorder?: boolean;
    reorderQuantity?: number;
  }> {
    try {
      const pieceId =
        typeof productId === 'string' ? parseInt(productId) : productId;

      // 🚀 MODE FLUX TENDU: Stock illimité
      if (this.STOCK_MODE === 'UNLIMITED') {
        return {
          available: this.UNLIMITED_DISPLAY_STOCK,
          reserved: 0,
          total: this.UNLIMITED_DISPLAY_STOCK,
          status: 'in_stock',
          needsReorder: false,
        };
      }

      // 📊 MODE SUIVI: Vérifier le stock réel
      // 1. Récupérer le stock depuis pieces_price (pri_qte_cond = quantité en stock)
      const { data: priceData, error } = await this.client
        .from(TABLES.pieces_price)
        .select('pri_qte_cond, pri_qte_vente')
        .eq('pri_piece_id_i', pieceId)
        .limit(1);

      if (error) {
        this.logger.error(
          `Erreur récupération stock produit ${pieceId}:`,
          error,
        );
      }

      // Calculer le stock total (utiliser pri_qte_cond ou valeur par défaut)
      let totalStock = this.DEFAULT_STOCK;

      if (priceData && priceData.length > 0) {
        const qtyString = priceData[0]?.pri_qte_cond;
        if (qtyString && qtyString.trim() !== '') {
          const parsed = parseFloat(qtyString);
          if (!isNaN(parsed) && parsed > 0) {
            totalStock = Math.floor(parsed);
          }
        }
      }

      // 2. Calculer le stock réservé (dans les paniers)
      // TODO: Implémenter si nécessaire avec Redis
      const reserved = 0;

      // 3. Calculer le stock disponible
      const available = totalStock - reserved;

      // 4. Déterminer le statut et besoin de réapprovisionnement
      let status: 'in_stock' | 'low_stock' | 'out_of_stock';
      let needsReorder = false;
      let reorderQuantity = 0;

      if (available <= 0) {
        status = 'out_of_stock';
        needsReorder = true;
        reorderQuantity = this.REORDER_QUANTITY;
      } else if (available <= this.LOW_STOCK_THRESHOLD) {
        status = 'low_stock';
        needsReorder = true;
        reorderQuantity = this.REORDER_QUANTITY - available;
      } else if (available <= this.REORDER_THRESHOLD) {
        status = 'in_stock';
        needsReorder = true;
        reorderQuantity = this.REORDER_QUANTITY - available;
      } else {
        status = 'in_stock';
      }

      // 🔔 Logger les alertes de réapprovisionnement
      if (needsReorder) {
        this.logger.warn(
          `🔔 ALERTE RÉAPPRO: Produit ${pieceId} - Stock: ${available} - Commander: ${reorderQuantity} unités`,
        );
      }

      this.logger.log(
        `📦 Stock produit ${pieceId}: ${available}/${totalStock} (${status})`,
      );

      return {
        available,
        reserved,
        total: totalStock,
        status,
        needsReorder,
        reorderQuantity: needsReorder ? reorderQuantity : undefined,
      };
    } catch (error) {
      this.logger.error('Erreur getProductStock:', error);
      // En cas d'erreur, retourner un stock disponible en mode UNLIMITED
      return {
        available: this.UNLIMITED_DISPLAY_STOCK,
        reserved: 0,
        total: this.UNLIMITED_DISPLAY_STOCK,
        status: 'in_stock',
        needsReorder: false,
      };
    }
  }

  /**
   * ✅ Valider si une quantité est disponible pour un produit
   *
   * En mode UNLIMITED: Accepte toujours (flux tendu)
   * En mode TRACKED: Vérifie le stock réel
   */
  async validateStock(
    productId: number | string,
    requestedQuantity: number,
  ): Promise<{
    isValid: boolean;
    available: number;
    message?: string;
  }> {
    try {
      // 🚀 MODE FLUX TENDU: Toujours valide
      if (this.STOCK_MODE === 'UNLIMITED') {
        return {
          isValid: true,
          available: this.UNLIMITED_DISPLAY_STOCK,
        };
      }

      // 📊 MODE SUIVI: Vérifier le stock réel
      const stock = await this.getProductStock(productId);

      const isValid = stock.available >= requestedQuantity;

      if (!isValid) {
        return {
          isValid: false,
          available: stock.available,
          message:
            stock.available > 0
              ? `Seulement ${stock.available} unité(s) disponible(s)`
              : 'Produit en rupture de stock',
        };
      }

      return {
        isValid: true,
        available: stock.available,
      };
    } catch (error) {
      this.logger.error('Erreur validateStock:', error);
      // En cas d'erreur, accepter en mode dégradé (flux tendu)
      return {
        isValid: true,
        available: this.UNLIMITED_DISPLAY_STOCK,
      };
    }
  }

  /**
   * 📊 Récupérer le stock pour plusieurs produits
   * ✅ P3.3 Optimisé: Batch query au lieu de N requêtes
   */
  async getBulkStock(productIds: (number | string)[]): Promise<
    Record<
      string,
      {
        available: number;
        total: number;
        status: string;
      }
    >
  > {
    try {
      const results: Record<string, any> = {};

      // 🚀 MODE FLUX TENDU: Retourner stock illimité pour tous
      if (this.STOCK_MODE === 'UNLIMITED') {
        productIds.forEach((id) => {
          results[id.toString()] = {
            available: this.UNLIMITED_DISPLAY_STOCK,
            total: this.UNLIMITED_DISPLAY_STOCK,
            status: 'in_stock',
          };
        });
        return results;
      }

      // 📊 MODE SUIVI: Batch query en une seule requête
      const pieceIds = productIds.map((id) =>
        typeof id === 'string' ? parseInt(id) : id,
      );

      // BATCH: Récupérer tous les stocks en une requête
      const { data: priceData, error } = await this.client
        .from(TABLES.pieces_price)
        .select('pri_piece_id_i, pri_qte_cond')
        .in('pri_piece_id_i', pieceIds);

      if (error) {
        this.logger.error('Erreur batch stock:', error);
      }

      // Créer Map pour lookup O(1)
      const stockMap = new Map<number, number>();
      (priceData || []).forEach((p) => {
        const qtyString = p.pri_qte_cond;
        let stock = this.DEFAULT_STOCK;
        if (qtyString && qtyString.trim() !== '') {
          const parsed = parseFloat(qtyString);
          if (!isNaN(parsed) && parsed > 0) {
            stock = Math.floor(parsed);
          }
        }
        stockMap.set(p.pri_piece_id_i, stock);
      });

      // Assembler les résultats avec Map lookup
      pieceIds.forEach((pieceId) => {
        const totalStock = stockMap.get(pieceId) || this.DEFAULT_STOCK;
        let status: string;
        if (totalStock <= 0) {
          status = 'out_of_stock';
        } else if (totalStock <= this.LOW_STOCK_THRESHOLD) {
          status = 'low_stock';
        } else {
          status = 'in_stock';
        }

        results[pieceId.toString()] = {
          available: totalStock,
          total: totalStock,
          status,
        };
      });

      return results;
    } catch (error) {
      this.logger.error('Erreur getBulkStock:', error);
      return {};
    }
  }

  /**
   * 🚨 Vérifier si un produit est en stock faible
   */
  isLowStock(available: number): boolean {
    return available > 0 && available <= this.LOW_STOCK_THRESHOLD;
  }

  /**
   * 🚫 Vérifier si un produit est en rupture
   */
  isOutOfStock(available: number): boolean {
    return available <= 0;
  }

  /**
   * 📋 Obtenir la liste des produits nécessitant un réapprovisionnement
   * Utile pour générer des bons de commande automatiques
   */
  async getReorderList(): Promise<
    Array<{
      productId: number;
      productName: string;
      currentStock: number;
      reorderQuantity: number;
      status: string;
    }>
  > {
    try {
      // Mode UNLIMITED: Pas de réapprovisionnement nécessaire
      if (this.STOCK_MODE === 'UNLIMITED') {
        this.logger.log('📋 Mode UNLIMITED: Aucun réapprovisionnement requis');
        return [];
      }

      // Récupérer tous les produits avec stock faible
      const { data: lowStockProducts, error } = await this.client
        .from(TABLES.pieces_price)
        .select(
          `
          pri_piece_id_i,
          pri_qte_cond,
          pieces:pri_piece_id_i (
            piece_id,
            piece_name,
            piece_ref
          )
        `,
        )
        .lte('pri_qte_cond', this.REORDER_THRESHOLD.toString());

      if (error) {
        this.logger.error('Erreur getReorderList:', error);
        return [];
      }

      const reorderList = (lowStockProducts || [])
        .map((item: any) => {
          const currentStock = parseFloat(item.pri_qte_cond) || 0;
          const reorderQty = Math.max(
            this.REORDER_QUANTITY - currentStock,
            this.REORDER_QUANTITY / 2,
          );

          return {
            productId: item.pri_piece_id_i,
            productName: item.pieces?.piece_name || 'Produit inconnu',
            currentStock,
            reorderQuantity: Math.ceil(reorderQty),
            status:
              currentStock <= 0
                ? 'urgent'
                : currentStock <= this.LOW_STOCK_THRESHOLD
                  ? 'high'
                  : 'normal',
          };
        })
        .filter((item: any) => item.productId);

      this.logger.log(
        `📋 Liste de réapprovisionnement: ${reorderList.length} produits`,
      );

      return reorderList;
    } catch (error) {
      this.logger.error('Erreur getReorderList:', error);
      return [];
    }
  }

  /**
   * 📊 Obtenir un rapport d'inventaire global
   */
  async getInventoryReport(): Promise<{
    totalProducts: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    needsReorder: number;
    mode: string;
  }> {
    try {
      // Mode UNLIMITED: Rapport simplifié
      if (this.STOCK_MODE === 'UNLIMITED') {
        const { count } = await this.client
          .from(TABLES.pieces)
          .select('*', { count: 'exact', head: true });

        return {
          totalProducts: count || 0,
          inStock: count || 0,
          lowStock: 0,
          outOfStock: 0,
          needsReorder: 0,
          mode: 'FLUX_TENDU',
        };
      }

      // Mode TRACKED: Rapport complet
      const reorderList = await this.getReorderList();

      const stats = {
        totalProducts: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        needsReorder: reorderList.length,
        mode: 'SUIVI_STOCK',
      };

      // Calculer les statistiques depuis la liste de réappro
      reorderList.forEach((item) => {
        if (item.currentStock <= 0) {
          stats.outOfStock++;
        } else if (item.currentStock <= this.LOW_STOCK_THRESHOLD) {
          stats.lowStock++;
        }
      });

      // Total des produits
      const { count } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true });

      stats.totalProducts = count || 0;
      stats.inStock = stats.totalProducts - stats.lowStock - stats.outOfStock;

      this.logger.log('📊 Rapport inventaire généré:', stats);

      return stats;
    } catch (error) {
      this.logger.error('Erreur getInventoryReport:', error);
      return {
        totalProducts: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        needsReorder: 0,
        mode: this.STOCK_MODE,
      };
    }
  }

  /**
   * 🔄 Simuler un réapprovisionnement automatique (pour tests)
   */
  async simulateRestock(productId: number, quantity: number): Promise<boolean> {
    try {
      this.logger.log(
        `🔄 Simulation réapprovisionnement: Produit ${productId} +${quantity} unités`,
      );

      // En mode UNLIMITED, pas besoin de modifier le stock
      if (this.STOCK_MODE === 'UNLIMITED') {
        this.logger.log('✅ Mode UNLIMITED: Réappro automatique virtuel');
        return true;
      }

      // En mode TRACKED, mettre à jour le stock dans pieces_price
      const { error } = await this.client
        .from(TABLES.pieces_price)
        .update({
          pri_qte_cond: quantity.toString(),
        })
        .eq('pri_piece_id_i', productId);

      if (error) {
        this.logger.error('Erreur simulateRestock:', error);
        return false;
      }

      this.logger.log(
        `✅ Réapprovisionnement effectué: Produit ${productId} = ${quantity} unités`,
      );
      return true;
    } catch (error) {
      this.logger.error('Erreur simulateRestock:', error);
      return false;
    }
  }
}
