import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ShippingModule } from '../shipping/shipping.module';
import { ProductsModule } from '../products/products.module';
import { PromoModule } from '../promo/promo.module';

// Controllers
import { CartCoreController } from './controllers/cart-core.controller';
import { CartItemsController } from './controllers/cart-items.controller';
import { CartPromoController } from './controllers/cart-promo.controller';
import { CartShippingController } from './controllers/cart-shipping.controller';
import { CartAnalyticsController } from './controllers/cart-analytics.controller';

// Services
import { CartService } from './services/cart.service';
import { CartCalculationService } from './services/cart-calculation.service';
import { CartValidationService } from './services/cart-validation.service';
import { CartAnalyticsService } from './services/cart-analytics.service';
import { CartDataService } from '../../database/services/cart-data.service';
import { PromoDataService } from '../../database/services/promo-data.service';
import { ShippingDataService } from '../../database/services/shipping-data.service';

@Module({
  imports: [DatabaseModule, ShippingModule, ProductsModule, PromoModule],
  controllers: [
    CartCoreController,
    CartItemsController,
    CartPromoController,
    CartShippingController,
    CartAnalyticsController,
  ],
  providers: [
    CartService,
    CartCalculationService,
    CartValidationService,
    CartAnalyticsService,
    CartDataService,
    PromoDataService,
    ShippingDataService,
  ],
  exports: [
    CartService,
    CartCalculationService,
    CartValidationService,
    CartAnalyticsService,
    CartDataService,
  ],
})
export class CartModule {}
