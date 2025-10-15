import { Injectable, Logger } from '@nestjs/common';

export interface OrderCalculation {
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  consigne_total: number; // ✅ Phase 5: Total consignes
  total: number;
}

export interface OrderLineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  consigne_unit?: number; // ✅ Phase 5: Consigne unitaire
  has_consigne?: boolean; // ✅ Phase 5: Produit avec consigne
}

@Injectable()
export class OrderCalculationService {
  private readonly logger = new Logger(OrderCalculationService.name);

  /**
   * Calcule le total d'une commande avec tous les frais
   */
  async calculateOrderTotal(
    items: OrderLineItem[],
    shippingCost: number = 0,
    discountAmount: number = 0,
    taxRate: number = 0.2, // TVA française par défaut
  ): Promise<OrderCalculation> {
    try {
      // Calcul du sous-total
      const subtotal = items.reduce((sum, item) => {
        return sum + item.quantity * item.unitPrice;
      }, 0);

      // ✅ Phase 5: Calcul des consignes
      const consigne_total = items.reduce((sum, item) => {
        if (item.has_consigne && item.consigne_unit) {
          return sum + item.quantity * item.consigne_unit;
        }
        return sum;
      }, 0);

      // Calcul de la TVA
      const taxAmount = subtotal * taxRate;

      // Calcul du total (consignes incluses)
      const total =
        subtotal + taxAmount + shippingCost + consigne_total - discountAmount;

      return {
        subtotal,
        taxAmount,
        shippingCost,
        discountAmount,
        consigne_total,
        total: Math.max(0, total), // Ne peut pas être négatif
      };
    } catch (error) {
      this.logger.error('Error calculating order total:', error);
      throw new Error('Failed to calculate order total');
    }
  }

  /**
   * Calcule les frais par ligne de commande
   */
  async calculateLineItemTotal(item: OrderLineItem): Promise<number> {
    return item.quantity * item.unitPrice;
  }

  /**
   * Applique une remise sur le total
   */
  async applyDiscount(
    subtotal: number,
    discountPercentage?: number,
    discountAmount?: number,
  ): Promise<number> {
    if (discountPercentage) {
      return subtotal * (discountPercentage / 100);
    }
    if (discountAmount) {
      return Math.min(discountAmount, subtotal);
    }
    return 0;
  }
}
