import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PromoDataService } from '../../database/services/promo-data.service';
import { CacheService } from '@cache/cache.service';
import { z } from 'zod';

// 🎯 SCHEMAS ZOD pour validation stricte des types
export const PromoCodeSchema = z.object({
  id: z.number(),
  code: z.string().min(1),
  type: z.enum(['PERCENT', 'AMOUNT', 'SHIPPING']),
  value: z.number().min(0),
  minAmount: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  validFrom: z.string().or(z.date()),
  validUntil: z.string().or(z.date()),
  usageLimit: z.number().min(0).optional(),
  usageCount: z.number().min(0),
  active: z.boolean(),
});

export const CartSummarySchema = z.object({
  userId: z.number(),
  subtotal: z.number().min(0),
  shipping: z.number().min(0).optional().default(0),
  items: z.array(z.any()).optional().default([]),
});

// 🎯 TYPES inférés automatiquement
export type PromoCode = z.infer<typeof PromoCodeSchema>;
export type CartSummary = z.infer<typeof CartSummarySchema>;

export interface PromoValidationResult {
  valid: boolean;
  discount: number;
  message?: string;
  promoCode?: PromoCode;
}

/**
 * 🎫 SERVICE CODES PROMO - Architecture modulaire
 *
 * Service moderne pour la gestion des codes promotionnels
 * Utilise PromoDataService pour l'accès aux données
 *
 * Fonctionnalités:
 * - Validation des codes promo avec cache
 * - Calcul automatique des remises
 * - Gestion des limites d'utilisation
 * - Types stricts avec Zod
 */
@Injectable()
export class PromoService {
  private readonly logger = new Logger(PromoService.name);
  private readonly CACHE_TTL = 1800; // 30 minutes

  constructor(
    private readonly promoDataService: PromoDataService,
    private readonly cacheService: CacheService,
  ) {
    this.logger.log('PromoService initialisé avec architecture modulaire');
  }

  /**
   * 🎯 POINT D'ENTRÉE PRINCIPAL - Validation d'un code promo
   */
  async validatePromoCode(
    code: string,
    cart: CartSummary,
  ): Promise<PromoValidationResult> {
    try {
      // Validation des paramètres
      const validatedCart = CartSummarySchema.parse(cart);

      if (!code || code.trim().length === 0) {
        return {
          valid: false,
          discount: 0,
          message: 'Code promo requis',
        };
      }

      this.logger.log('Validation code promo', {
        code: code.toUpperCase(),
        userId: validatedCart.userId,
        subtotal: validatedCart.subtotal,
      });

      // 🚀 Cache
      const cacheKey = `promo:${code.toUpperCase()}:${validatedCart.userId}`;
      const cached =
        await this.cacheService.get<PromoValidationResult>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit pour code promo ${code}`);
        return cached;
      }

      // Récupérer le code promo valide
      const promo = await this.promoDataService.getValidPromoByCode(code);
      if (!promo) {
        const result = {
          valid: false,
          discount: 0,
          message: 'Code promo invalide ou expiré',
        };

        // Cache négatif court (5 minutes)
        await this.cacheService.set(cacheKey, JSON.stringify(result), 300);
        return result;
      }

      // Validation avec Zod
      const validatedPromo = PromoCodeSchema.parse({
        ...promo,
        validFrom: new Date(promo.valid_from),
        validUntil: new Date(promo.valid_until),
        minAmount: promo.min_amount,
        maxDiscount: promo.max_discount,
        usageLimit: promo.usage_limit,
        usageCount: promo.usage_count,
      });

      // Vérifications métier
      const validation = await this.performBusinessValidation(
        validatedPromo,
        validatedCart,
      );

      if (!validation.valid) {
        const negativeResult = {
          ...validation,
          discount: 0,
        };
        // Cache négatif court
        await this.cacheService.set(
          cacheKey,
          JSON.stringify(negativeResult),
          300,
        );
        return negativeResult;
      }

      // Calculer la remise
      const discount = this.calculateDiscount(validatedPromo, validatedCart);

      const result: PromoValidationResult = {
        valid: true,
        discount,
        message: `Remise de ${discount.toFixed(2)}€ appliquée`,
        promoCode: validatedPromo,
      };

      // 💾 Cache
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(result),
        this.CACHE_TTL,
      );

      return result;
    } catch (error) {
      this.logger.error('Erreur lors de la validation du code promo', error);

      if (error instanceof z.ZodError) {
        throw new BadRequestException('Données de validation invalides');
      }

      return {
        valid: false,
        discount: 0,
        message: 'Erreur lors de la validation',
      };
    }
  }

  /**
   * 📝 ENREGISTREMENT D'UTILISATION
   */
  async recordPromoUsage(
    promoId: number,
    userId: number,
    orderId: number,
  ): Promise<boolean> {
    try {
      const success = await this.promoDataService.recordPromoUsage(
        promoId,
        userId,
        orderId,
      );

      if (success) {
        // Invalider le cache
        await this.invalidatePromoCache(promoId, userId);
        this.logger.log('Utilisation code promo enregistrée', {
          promoId,
          userId,
          orderId,
        });
      }

      return success;
    } catch (error) {
      this.logger.error('Erreur enregistrement utilisation code promo', error);
      return false;
    }
  }

  /**
   * 🔍 RÉCUPÉRATION D'UN CODE PROMO
   */
  async getPromoByCode(code: string): Promise<PromoCode | null> {
    try {
      const promo = await this.promoDataService.getPromoByCode(code);
      if (!promo) {
        return null;
      }

      return PromoCodeSchema.parse({
        ...promo,
        validFrom: new Date(promo.valid_from),
        validUntil: new Date(promo.valid_until),
        minAmount: promo.min_amount,
        maxDiscount: promo.max_discount,
        usageLimit: promo.usage_limit,
        usageCount: promo.usage_count,
      });
    } catch (error) {
      this.logger.error('Erreur récupération code promo', error);
      return null;
    }
  }

  /**
   * 🔒 VALIDATIONS MÉTIER PRIVÉES
   */
  private async performBusinessValidation(
    promo: PromoCode,
    cart: CartSummary,
  ): Promise<Pick<PromoValidationResult, 'valid' | 'message'>> {
    // Vérifier le montant minimum
    if (promo.minAmount && cart.subtotal < promo.minAmount) {
      return {
        valid: false,
        message: `Montant minimum de ${promo.minAmount}€ requis`,
      };
    }

    // Vérifier la limite d'utilisation globale
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
      return {
        valid: false,
        message: 'Code promo épuisé',
      };
    }

    // Vérifier si déjà utilisé par cet utilisateur
    const alreadyUsed = await this.promoDataService.checkPromoUsage(
      promo.id,
      cart.userId,
    );

    if (alreadyUsed) {
      return {
        valid: false,
        message: 'Code promo déjà utilisé',
      };
    }

    return { valid: true };
  }

  /**
   * 💰 CALCUL DE LA REMISE
   */
  private calculateDiscount(promo: PromoCode, cart: CartSummary): number {
    let discount = 0;

    switch (promo.type) {
      case 'PERCENT':
        discount = cart.subtotal * (promo.value / 100);
        if (promo.maxDiscount && discount > promo.maxDiscount) {
          discount = promo.maxDiscount;
        }
        break;

      case 'AMOUNT':
        discount = Math.min(promo.value, cart.subtotal);
        break;

      case 'SHIPPING':
        discount = cart.shipping || 0;
        break;

      default:
        discount = 0;
    }

    return Math.round(discount * 100) / 100; // Arrondir à 2 décimales
  }

  /**
   * 🗑️ INVALIDATION DU CACHE
   */
  private async invalidatePromoCache(
    promoId: number,
    userId: number,
  ): Promise<void> {
    try {
      // Invalider le cache spécifique à cet utilisateur
      const pattern = `promo:*:${userId}`;
      await this.cacheService.delete(pattern);

      this.logger.log('Cache promo invalidé', { promoId, userId });
    } catch (error) {
      this.logger.warn('Erreur invalidation cache promo', error);
    }
  }
}
