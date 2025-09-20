/**
 * 🛒 MODULE CART MODERNE - Architecture finale
 *
 * Module cart moderne avec :
 * ✅ Contrôleur API REST fonctionnel
 * ✅ Services spécialisés (calculs, validation)
 * ✅ Architecture modulaire et extensible
 * ✅ Intégration avec base de données et cache
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';
import { ShippingModule } from '../shipping/shipping.module';

// Controllers
import { CartController } from './cart.controller';

// Services
import { CartService } from './services/cart.service';
import { CartCalculationService } from './services/cart-calculation.service';
import { CartValidationService } from './services/cart-validation.service';
import { PromoService } from './promo.service';

@Module({
  imports: [
    DatabaseModule, // Pour accès Supabase/PostgREST
    CacheModule, // Pour Redis cache et sessions
    ShippingModule, // Pour les services de livraison
  ],
  controllers: [
    CartController, // Controller principal
  ],
  providers: [
    // Services modernes
    CartService, // Service principal moderne
    CartCalculationService, // Service de calculs
    CartValidationService, // Service de validation
    PromoService, // Service de gestion des promotions
  ],
  exports: [
    CartService, // Service moderne exporté
    CartCalculationService, // Service calculs exporté
    CartValidationService, // Service validation exporté
    PromoService, // Service promotions exporté
  ],
})
export class CartModule {}
