import { Controller, Post, Body, Get, Param, Logger } from '@nestjs/common';
import { PromoService } from './promo.service';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface ValidatePromoDto {
  code: string;
  cart: {
    userId: number;
    subtotal: number;
    shipping?: number;
    items?: any[];
  };
}

@Controller('api/promo')
// @UseGuards(JwtAuthGuard)
export class PromoController {
  private readonly logger = new Logger(PromoController.name);

  constructor(private readonly promoService: PromoService) {}

  /**
   * Valider un code promo
   */
  @Post('validate')
  async validatePromoCode(@Body() dto: ValidatePromoDto) {
    this.logger.log('Validation code promo demandée', {
      code: dto.code,
      userId: dto.cart.userId,
    });

    const cartData = {
      userId: dto.cart.userId,
      subtotal: dto.cart.subtotal,
      shipping: dto.cart.shipping || 0,
      items: dto.cart.items || [],
    };

    return this.promoService.validatePromoCode(dto.code, cartData);
  }

  /**
   * Récupérer un code promo par son code
   */
  @Get(':code')
  async getPromoByCode(@Param('code') code: string) {
    return this.promoService.getPromoByCode(code);
  }

  /**
   * Endpoint de test
   */
  @Get('test/health')
  async testHealth() {
    return {
      status: 'healthy',
      service: 'PromoService',
      architecture: 'modular',
      timestamp: new Date().toISOString(),
    };
  }
}
