import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services métier spécialisés (architecture modulaire)
import { CartDataService } from './services/cart-data.service';
import { PiecePriceDataService } from './services/piece-price-data.service';
import { OrdersService } from './services/orders.service';
import { ShippingDataService } from './services/shipping-data.service';
import { PromoDataService } from './services/promo-data.service';
import { DatabaseCompositionService } from './services/database-composition.service';
import { MetaTagsArianeDataService } from './services/meta-tags-ariane-data.service';

/**
 * DatabaseModule - Architecture Modulaire Pure
 * ✅ DatabaseService supprimé (était cassé avec RPC inexistante)
 * ✅ Services spécialisés par domaine métier
 * ✅ Composition modulaire via DatabaseCompositionService
 * ✅ Services critiques migré vers SupabaseBaseService
 * ✅ OrdersService unifié (anciennement LegacyOrderService)
 * ✅ UserDataService + UserService supprimés (B7 → UserDataConsolidatedService dans UsersModule)
 */
@Module({
  imports: [ConfigModule],
  providers: [
    // Services de données spécialisés (architecture modulaire)
    // Autorité unique du tarif vendable : tout consommateur de prix passe par elle.
    PiecePriceDataService,
    CartDataService,
    OrdersService, // Service unifié de commandes
    ShippingDataService,
    PromoDataService,
    DatabaseCompositionService,
    MetaTagsArianeDataService,
  ],
  exports: [
    // Export principal - service de composition modulaire
    DatabaseCompositionService,

    // Services spécialisés disponibles individuellement
    PiecePriceDataService,
    CartDataService,
    OrdersService, // Service unifié de commandes
    ShippingDataService,
    PromoDataService,
    MetaTagsArianeDataService,
  ],
})
export class DatabaseModule {}
