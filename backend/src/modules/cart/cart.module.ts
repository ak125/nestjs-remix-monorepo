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
import { ProductsModule } from '../products/products.module';
import { PromoModule } from '../promo/promo.module';

// Controllers
import { CartController } from './cart.controller';

// Services
import { CartService } from './services/cart.service';
import { CartCalculationService } from './services/cart-calculation.service';
import { CartValidationService } from './services/cart-validation.service';
import { CartAnalyticsService } from './services/cart-analytics.service';
import { CartDataService } from '../../database/services/cart-data.service';
import { PromoDataService } from '../../database/services/promo-data.service';
import { ShippingDataService } from '../../database/services/shipping-data.service';

@Module({
  imports: [
    DatabaseModule, // Pour accès Supabase/PostgREST
    CacheModule, // Pour Redis cache et sessions
    ShippingModule, // Pour les services de livraison
    ProductsModule, // Pour accès StockService
    PromoModule, // 🆕 Module promo avancé avec Zod et Cache
  ],
  controllers: [
    CartController, // Controller principal
  ],
  providers: [
    // Services modernes
    CartService, // Service principal moderne
    CartCalculationService, // Service de calculs
    CartValidationService, // Service de validation
    CartAnalyticsService, // Service analytics panier
    CartDataService, // Service d'accès aux données
    PromoDataService, // Service données codes promo
    ShippingDataService, // Service données shipping
  ],
  exports: [
    CartService, // Service moderne exporté
    CartCalculationService, // Service calculs exporté
    CartValidationService, // Service validation exporté
    CartAnalyticsService, // Service analytics exporté
    CartDataService, // Service données exporté
  ],
})
export class CartModule {}
