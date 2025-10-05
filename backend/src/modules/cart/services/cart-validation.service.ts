/**
 * ✅ SERVICE VALIDATION PANIER - Architecture moderne
 *
 * Service spécialisé dans la validation du panier :
 * ✅ Validation des stocks
 * ✅ Validation des prix
 * ✅ Validation des règles métier
 * ✅ Validation des promotions
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CartItem, CartMetadata } from '../../../database/services/cart-data.service';

// Type local pour compatibilité avec l'ancienne interface Cart
interface Cart {
  items: CartItem[];
  metadata?: CartMetadata;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class CartValidationService extends SupabaseBaseService {
  protected readonly logger = new Logger(CartValidationService.name);

  constructor() {
    super();
    this.logger.log('CartValidationService initialized');
  }

  /**
   * Valider complètement un panier
   */
  async validateCart(cart: Cart): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation basique
    if (!cart.items || cart.items.length === 0) {
      errors.push('Le panier est vide');
      return { valid: false, errors, warnings };
    }

    // Valider chaque item
    for (const item of cart.items) {
      const itemValidation = await this.validateCartItem(item);
      if (!itemValidation.valid) {
        errors.push(...itemValidation.errors);
      }
      warnings.push(...itemValidation.warnings);
    }

    // Validation des montants
    const amountValidation = this.validateAmounts(cart);
    if (!amountValidation.valid) {
      errors.push(...amountValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valider un item du panier
   */
  private async validateCartItem(item: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Vérifier la quantité
    if (item.quantity <= 0) {
      errors.push(`Quantité invalide pour l'article ${item.product_id}`);
    }

    // Vérifier le prix
    if (item.price <= 0) {
      errors.push(`Prix invalide pour l'article ${item.product_id}`);
    }

    // Vérifier le stock (simulation)
    const stockAvailable = await this.checkStock(item.product_id);
    if (stockAvailable < item.quantity) {
      if (stockAvailable === 0) {
        errors.push(`Article ${item.product_id} en rupture de stock`);
      } else {
        warnings.push(
          `Stock limité pour ${item.product_id}: ${stockAvailable} disponible(s)`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valider les montants du panier
   */
  private validateAmounts(cart: Cart): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Vérifier les montants cohérents
    if (cart.metadata.subtotal < 0) {
      errors.push('Sous-total invalide');
    }

    if (cart.metadata.total_amount < 0) {
      errors.push('Total invalide');
    }

    // Avertissements pour gros montants
    if (cart.metadata.total_amount > 1000) {
      warnings.push('Montant élevé, vérification recommandée');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Vérifier le stock d'un produit
   */
  private async checkStock(productId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();

      if (error || !data) {
        this.logger.warn(`Impossible de vérifier le stock pour ${productId}`);
        return 0;
      }

      return data.stock_quantity || 0;
    } catch (error) {
      this.logger.error(
        `Erreur checkStock: ${(error as any)?.message || error}`,
      );
      return 0;
    }
  }

  /**
   * Valider un code promo
   */
  async validatePromoCode(
    promoCode: string,
    cart: Cart,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation basique du code
    if (!promoCode || promoCode.length < 3) {
      errors.push('Code promo invalide');
      return { valid: false, errors, warnings };
    }

    // Vérifier si le code existe (simulation)
    const promoExists = await this.checkPromoCodeExists(promoCode);
    if (!promoExists) {
      errors.push('Code promo inexistant ou expiré');
    }

    // Vérifier les conditions d'utilisation
    if (cart.metadata.subtotal < 50) {
      warnings.push('Montant minimum de 50€ requis pour certaines promotions');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Vérifier l'existence d'un code promo
   */
  private async checkPromoCodeExists(promoCode: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('promo_codes')
        .select('id')
        .eq('code', promoCode)
        .eq('is_active', true)
        .single();

      return !error && !!data;
    } catch (error) {
      this.logger.error(
        `Erreur checkPromoCodeExists: ${(error as any)?.message || error}`,
      );
      return false;
    }
  }
}
