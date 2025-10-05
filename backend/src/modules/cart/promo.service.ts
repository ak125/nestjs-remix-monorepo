import { Injectable, Logger } from '@nestjs/common';
import { PromoDataService } from '../../database/services/promo-data.service';

/**
 * 💰 PROMO SERVICE - Logique métier codes promotionnels
 * 
 * Version consolidée utilisant PromoDataService
 * Élimine toute redondance et doublon
 */
@Injectable()
export class PromoService {
  private readonly logger = new Logger(PromoService.name);

  constructor(private readonly promoDataService: PromoDataService) {}

  /**
   * Valider un code promo avec toutes les règles métier
   */
  async validatePromoCode(
    code: string,
    userId: string,
    cartSubtotal: number,
  ): Promise<{
    valid: boolean;
    discount: number;
    discountType?: string;
    reason?: string;
    promoId?: number;
  }> {
    try {
      this.logger.log(
        `🔍 Validation promo: ${code} (subtotal: ${cartSubtotal}€)`,
      );

      // Utiliser PromoDataService (source unique de vérité)
      const validation = await this.promoDataService.validatePromoCode(
        code,
        userId,
      );

      if (!validation.valid) {
        return {
          valid: false,
          discount: 0,
          reason: validation.message,
        };
      }

      const promo = validation.promo!;

      // Vérifier montant minimum d'achat
      if (promo.min_purchase_amount && cartSubtotal < promo.min_purchase_amount) {
        return {
          valid: false,
          discount: 0,
          reason: `Montant minimum requis: ${promo.min_purchase_amount}€`,
        };
      }

      // Calculer la réduction selon le type
      const discount = this.promoDataService.calculateDiscount(
        promo.discount_type,
        promo.discount_value,
        cartSubtotal,
      );

      this.logger.log(`✅ Promo valide: -${discount.toFixed(2)}€`);

      return {
        valid: true,
        discount: discount,
        discountType: promo.discount_type,
        promoId: promo.id,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur validation promo:`, error);
      return {
        valid: false,
        discount: 0,
        reason: 'Erreur lors de la validation du code promo',
      };
    }
  }

  /**
   * Calculer le montant de réduction (wrapper simplifié)
   */
  async calculateDiscount(code: string, cartSubtotal: number): Promise<number> {
    const validation = await this.validatePromoCode(code, '', cartSubtotal);
    return validation.valid ? validation.discount : 0;
  }

  /**
   * Enregistrer l'utilisation d'un code promo (lors de la création de commande)
   */
  async recordPromoUsage(
    promoId: number,
    userId: number,
    orderId: number,
  ): Promise<void> {
    try {
      await this.promoDataService.recordPromoUsage(promoId, userId, orderId);
      this.logger.log(`✅ Utilisation promo enregistrée: ${promoId}`);
    } catch (error) {
      this.logger.error(`❌ Erreur enregistrement promo:`, error);
      throw error;
    }
  }
}
