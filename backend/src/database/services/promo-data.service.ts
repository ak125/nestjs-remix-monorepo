import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { DatabaseException, ErrorCodes } from '../../common/exceptions';

/**
 * 🎫 SERVICE DE DONNÉES CODES PROMO
 *
 * Service spécialisé pour la gestion des codes promotionnels
 * Suit l'architecture modulaire mise en place
 *
 * Responsabilités:
 * - Validation des codes promo
 * - Historique d'utilisation
 * - Gestion des limites d'usage
 */
@Injectable()
export class PromoDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(PromoDataService.name);

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('PromoDataService initialized');
  }

  /**
   * Récupère un code promo par son code
   */
  async getPromoByCode(code: string): Promise<any | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_codes?code=eq.${code.toUpperCase()}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `HTTP error! status: ${response.status}`,
        });
      }

      const data = await response.json();
      return data[0] || null;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération du code promo', error);
      return null;
    }
  }

  /**
   * Récupère un code promo actif et valide
   */
  async getValidPromoByCode(code: string): Promise<any | null> {
    try {
      const now = new Date().toISOString();
      const response = await fetch(
        `${this.baseUrl}/promo_codes?code=eq.${code.toUpperCase()}&active=eq.true&valid_from=lte.${now}&valid_until=gte.${now}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `HTTP error! status: ${response.status}`,
        });
      }

      const data = await response.json();
      return data[0] || null;
    } catch (error) {
      this.logger.error('Erreur lors de la validation du code promo', error);
      return null;
    }
  }

  /**
   * Valider un code promo avec toutes les règles AVANCÉES
   *
   * Validations:
   * - Dates de validité
   * - Limite globale d'utilisation
   * - Limite par client
   * - Montant minimum d'achat
   * - Produits/catégories applicables
   * - Stackable (cumulable avec autres promos)
   */
  async validatePromoCode(
    code: string,
    cartSubtotal: number = 0,
    cartItems: Array<{ product_id: string; quantity: number }> = [],
    userId?: string,
    currentPromos: string[] = [],
  ): Promise<{
    valid: boolean;
    message?: string;
    promo?: {
      id: number;
      code: string;
      discount_type: string;
      discount_value: number;
      min_purchase_amount: number | null;
      description: string | null;
      stackable?: boolean;
    };
  }> {
    try {
      this.logger.log(`🔍 Validation AVANCÉE code promo: ${code}`);

      const promo = await this.getValidPromoByCode(code);

      if (!promo) {
        return {
          valid: false,
          message: 'Code promo invalide ou expiré',
        };
      }

      // ✅ 1. Vérifier limite globale d'utilisation
      if (promo.max_usage && promo.usage_count >= promo.max_usage) {
        this.logger.warn(
          `❌ Limite globale atteinte pour ${code}: ${promo.usage_count}/${promo.max_usage}`,
        );
        return {
          valid: false,
          message: "Ce code promo a atteint sa limite d'utilisation",
        };
      }

      // ✅ 2. Vérifier limite par client
      if (userId && promo.usage_limit_per_customer) {
        const userUsageCount = await this.getUserPromoUsageCount(
          promo.id,
          parseInt(userId),
        );
        if (userUsageCount >= promo.usage_limit_per_customer) {
          this.logger.warn(
            `❌ Limite client atteinte pour ${code}: ${userUsageCount}/${promo.usage_limit_per_customer}`,
          );
          return {
            valid: false,
            message: `Vous avez déjà utilisé ce code promo ${userUsageCount} fois (limite: ${promo.usage_limit_per_customer})`,
          };
        }
      }

      // ✅ 3. Vérifier montant minimum d'achat
      if (promo.min_amount && cartSubtotal < parseFloat(promo.min_amount)) {
        const remaining = parseFloat(promo.min_amount) - cartSubtotal;
        this.logger.warn(
          `❌ Montant minimum non atteint: ${cartSubtotal}€ < ${promo.min_amount}€`,
        );
        return {
          valid: false,
          message: `Ajoutez ${remaining.toFixed(2)}€ pour bénéficier de cette promo (minimum: ${promo.min_amount}€)`,
        };
      }

      // ✅ 4. Vérifier produits applicables (si défini)
      if (promo.applicable_products && promo.applicable_products.length > 0) {
        const hasApplicableProduct = cartItems.some((item) =>
          promo.applicable_products.includes(parseInt(item.product_id)),
        );
        if (!hasApplicableProduct) {
          this.logger.warn(
            `❌ Aucun produit applicable dans le panier pour ${code}`,
          );
          return {
            valid: false,
            message:
              "Ce code promo ne s'applique à aucun produit de votre panier",
          };
        }
      }

      // ✅ 5. Vérifier catégories applicables (si défini)
      if (
        promo.applicable_categories &&
        promo.applicable_categories.length > 0
      ) {
        const hasApplicableCategory = await this.checkCartHasCategories(
          cartItems,
          promo.applicable_categories,
        );
        if (!hasApplicableCategory) {
          this.logger.warn(
            `❌ Aucune catégorie applicable dans le panier pour ${code}`,
          );
          return {
            valid: false,
            message:
              "Ce code promo ne s'applique à aucune catégorie de votre panier",
          };
        }
      }

      // ✅ 6. Vérifier stackable (cumulable avec autres promos)
      if (!promo.stackable && currentPromos.length > 0) {
        this.logger.warn(
          `❌ Code ${code} non cumulable avec: ${currentPromos.join(', ')}`,
        );
        return {
          valid: false,
          message: "Ce code promo n'est pas cumulable avec d'autres promotions",
        };
      }

      // ✅ 7. Vérifier limite par client (ancienne méthode pour compatibilité)
      if (userId && promo.usage_limit_per_customer) {
        const hasUsed = await this.checkPromoUsage(promo.id, parseInt(userId));
        if (hasUsed) {
          return {
            valid: false,
            message: 'Vous avez déjà utilisé ce code promo',
          };
        }
      }

      // Normaliser le type de promo (DB: PERCENT/FIXED → App: percentage/fixed)
      const normalizedType =
        promo.type === 'PERCENT'
          ? 'percentage'
          : promo.type === 'FIXED'
            ? 'fixed'
            : promo.type.toLowerCase();

      return {
        valid: true,
        promo: {
          id: promo.id,
          code: promo.code,
          discount_type: normalizedType, // Normalisé : PERCENT → percentage
          discount_value: parseFloat(promo.value), // Colonne réelle : value
          min_purchase_amount: promo.min_amount
            ? parseFloat(promo.min_amount)
            : null, // Colonne réelle : min_amount
          description: promo.description,
        },
      };
    } catch (error) {
      this.logger.error('Erreur validation code promo', error);
      return {
        valid: false,
        message: 'Erreur lors de la validation',
      };
    }
  }

  /**
   * Calculer le montant de réduction
   */
  calculateDiscount(
    discountType: string,
    discountValue: number,
    cartSubtotal: number,
  ): number {
    switch (discountType) {
      case 'percentage':
        return Math.round(((cartSubtotal * discountValue) / 100) * 100) / 100;
      case 'fixed':
        return Math.min(discountValue, cartSubtotal);
      case 'free_shipping':
        return 0; // Géré séparément
      default:
        return 0;
    }
  }

  /**
   * Vérifie si un utilisateur a déjà utilisé un code promo
   */
  async checkPromoUsage(promoId: number, userId: number): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_usage?promo_id=eq.${promoId}&user_id=eq.${userId}&select=id`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `HTTP error! status: ${response.status}`,
        });
      }

      const data = await response.json();
      return data.length > 0;
    } catch (error) {
      this.logger.error("Erreur lors de la vérification d'utilisation", error);
      return false;
    }
  }

  /**
   * Compte le nombre d'utilisations d'un promo par un client
   */
  async getUserPromoUsageCount(
    promoId: number,
    userId: number,
  ): Promise<number> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_usage?promo_id=eq.${promoId}&user_id=eq.${userId}&select=id`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `HTTP error! status: ${response.status}`,
        });
      }

      const data = await response.json();
      return data.length;
    } catch (error) {
      this.logger.error("Erreur lors du comptage d'utilisations", error);
      return 0;
    }
  }

  /**
   * Vérifie si le panier contient des produits de catégories spécifiques
   */
  async checkCartHasCategories(
    cartItems: Array<{ product_id: string; quantity: number }>,
    categoryIds: number[],
  ): Promise<boolean> {
    try {
      if (cartItems.length === 0 || categoryIds.length === 0) {
        return false;
      }

      const productIds = cartItems.map((item) => parseInt(item.product_id));

      // Récupérer les catégories des produits du panier
      const response = await fetch(
        `${this.baseUrl}/pieces?piece_id=in.(${productIds.join(',')})&select=piece_gamme_id`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `HTTP error! status: ${response.status}`,
        });
      }

      const products = await response.json();
      const productCategories = products
        .map((p: any) => p.piece_gamme_id)
        .filter(Boolean);

      // Vérifier si au moins une catégorie correspond
      return productCategories.some((catId: number) =>
        categoryIds.includes(catId),
      );
    } catch (error) {
      this.logger.error('Erreur lors de la vérification des catégories', error);
      return false;
    }
  }

  /**
   * Enregistre l'utilisation d'un code promo
   */
  async recordPromoUsage(
    promoId: number,
    userId: number,
    orderId: number,
  ): Promise<boolean> {
    try {
      // Enregistrer l'utilisation
      const usageResponse = await fetch(`${this.baseUrl}/promo_usage`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          promo_id: promoId,
          user_id: userId,
          order_id: orderId,
          used_at: new Date().toISOString(),
        }),
      });

      if (!usageResponse.ok) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `HTTP error! status: ${usageResponse.status}`,
        });
      }

      // Incrémenter le compteur d'utilisation
      const updateResponse = await fetch(
        `${this.baseUrl}/promo_codes?id=eq.${promoId}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({
            usage_count: 'usage_count + 1', // PostgreSQL expression
          }),
        },
      );

      return updateResponse.ok;
    } catch (error) {
      this.logger.error("Erreur lors de l'enregistrement d'utilisation", error);
      return false;
    }
  }

  /**
   * Récupère l'historique d'utilisation d'un code promo
   */
  async getPromoUsageHistory(promoId: number): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_usage?promo_id=eq.${promoId}&select=*,___xtr_customer(*)&order=used_at.desc`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `HTTP error! status: ${response.status}`,
        });
      }

      return await response.json();
    } catch (error) {
      this.logger.error(
        "Erreur lors de la récupération de l'historique",
        error,
      );
      return [];
    }
  }

  /**
   * Met à jour un code promo
   */
  async updatePromoCode(promoId: number, updates: any): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_codes?id=eq.${promoId}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify(updates),
        },
      );

      return response.ok;
    } catch (error) {
      this.logger.error('Erreur lors de la mise à jour du code promo', error);
      return false;
    }
  }
}
