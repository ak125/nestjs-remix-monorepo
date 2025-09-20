import { Injectable, Logger } from '@nestjs/common';

export interface OrderCalculation {
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  total: number;
}

export interface OrderLineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
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

      // Calcul de la TVA
      const taxAmount = subtotal * taxRate;

      // Calcul du total
      const total = subtotal + taxAmount + shippingCost - discountAmount;

      return {
        subtotal,
        taxAmount,
        shippingCost,
        discountAmount,
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
