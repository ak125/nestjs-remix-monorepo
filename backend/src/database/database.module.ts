import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../modules/cache/cache.module';

// Services métier spécialisés (architecture modulaire)
import { CartDataService } from './services/cart-data.service';
import { UserDataService } from './services/user-data.service';
import { OrderDataService } from './services/order-data.service';
import { ShippingDataService } from './services/shipping-data.service';
import { PromoDataService } from './services/promo-data.service';
import { StaffDataService } from './services/staff-data.service';
import { DatabaseCompositionService } from './services/database-composition.service';

// Services métier pour rétrocompatibilité (à migrer progressivement)
import { UserService } from './services/user.service';
import { OrderService } from './services/order.service';
import { RedisCacheService } from './services/redis-cache.service';

/**
 * DatabaseModule - Architecture Modulaire Pure
 * ✅ DatabaseService supprimé (était cassé avec RPC inexistante)
 * ✅ Services spécialisés par domaine métier
 * ✅ Composition modulaire via DatabaseCompositionService
 * ✅ Services critiques migré vers SupabaseBaseService
 */
@Module({
  imports: [ConfigModule, CacheModule],
  providers: [
    // Services de données spécialisés (architecture modulaire)
    CartDataService,
    UserDataService,
    OrderDataService,
    ShippingDataService,
    PromoDataService,
    StaffDataService,
    DatabaseCompositionService,

    // Services métier legacy (à migrer progressivement)
    UserService,
    OrderService,
    RedisCacheService,
  ],
  exports: [
    // Export principal - service de composition modulaire
    DatabaseCompositionService,

    // Services spécialisés disponibles individuellement
    CartDataService,
    UserDataService,
    OrderDataService,
    ShippingDataService,
    PromoDataService,
    StaffDataService,

    // Services legacy (rétrocompatibilité)
    UserService,
    OrderService,
    RedisCacheService,
  ],
})
export class DatabaseModule {}
