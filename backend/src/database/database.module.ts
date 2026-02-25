import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services métier spécialisés (architecture modulaire)
import { CartDataService } from './services/cart-data.service';
import { UserDataService } from './services/user-data.service';
import { OrdersService } from './services/orders.service';
import { ShippingDataService } from './services/shipping-data.service';
import { PromoDataService } from './services/promo-data.service';
import { DatabaseCompositionService } from './services/database-composition.service';

// Services métier pour rétrocompatibilité (à migrer progressivement)
import { UserService } from './services/user.service';

/**
 * DatabaseModule - Architecture Modulaire Pure
 * ✅ DatabaseService supprimé (était cassé avec RPC inexistante)
 * ✅ Services spécialisés par domaine métier
 * ✅ Composition modulaire via DatabaseCompositionService
 * ✅ Services critiques migré vers SupabaseBaseService
 * ✅ OrdersService unifié (anciennement LegacyOrderService)
 */
@Module({
  imports: [ConfigModule],
  providers: [
    // Services de données spécialisés (architecture modulaire)
    CartDataService,
    UserDataService,
    OrdersService, // Service unifié de commandes
    ShippingDataService,
    PromoDataService,
    DatabaseCompositionService,

    // Services métier legacy (à migrer progressivement)
    UserService,
  ],
  exports: [
    // Export principal - service de composition modulaire
    DatabaseCompositionService,

    // Services spécialisés disponibles individuellement
    CartDataService,
    UserDataService,
    OrdersService, // Service unifié de commandes
    ShippingDataService,
    PromoDataService,

    // Services legacy (rétrocompatibilité)
    UserService,
  ],
})
export class DatabaseModule {}
