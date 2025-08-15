import { Injectable } from '@nestjs/common';

@Injectable()
export class PromoService {
  async validatePromoCode(
    code: string,
    userId: string,
    amount: number,
  ): Promise<{
    valid: boolean;
    discount: number;
    reason?: string;
  }> {
    // Implémentation simple pour les tests
    if (code === 'TEST10') {
      return {
        valid: true,
        discount: amount * 0.1,
      };
    }

    return {
      valid: false,
      discount: 0,
      reason: 'Code promo invalide',
    };
  }

  async calculateDiscount(code: string, amount: number): Promise<number> {
    const validation = await this.validatePromoCode(code, '', amount);
    return validation.valid ? validation.discount : 0;
  }
}
