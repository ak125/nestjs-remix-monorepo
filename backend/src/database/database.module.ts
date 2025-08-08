import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services de base
import { SupabaseBaseService } from './services/supabase-base.service';

// Services métier
import { UserService } from './services/user.service';
import { OrderService } from './services/order.service';
import { RedisCacheService } from './services/redis-cache.service';

// Service facade
import { SupabaseServiceFacade } from './supabase-service-facade';

@Module({
  imports: [ConfigModule],
  providers: [
    // Services métier
    UserService,
    OrderService,
    RedisCacheService,

    // Service facade (nouveau)
    SupabaseServiceFacade,
  ],
  exports: [
    // Exporter le nouveau service facade comme principal
    SupabaseServiceFacade,

    // Services métier accessibles directement si besoin
    UserService,
    OrderService,
    RedisCacheService,
  ],
})
export class DatabaseModule {}
