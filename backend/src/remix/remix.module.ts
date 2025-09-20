import { Module, forwardRef } from '@nestjs/common';
import { RemixController } from './remix.controller';
import { RemixService } from './remix.service';
import { RemixApiService } from './remix-api.service'; // ✅ Import du service existant
import { OrdersModule } from '../modules/orders/orders.module';
import { UsersModule } from '../modules/users/users.module';
import { CartModule } from '../modules/cart/cart.module';
import { DatabaseModule } from '../database/database.module';
import { MessagesModule } from '../modules/messages/messages.module';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../cache/cache.module';

// Services spécialisés - TOUS SUPPRIMÉS car obsolètes
// import { OrdersIntegrationService } from './integration/orders/orders-integration.service'; // Obsolète
// import { UsersIntegrationService } from './integration/users/users-integration.service'; // Obsolète
// import { AuthIntegrationService } from './integration/auth/auth-integration.service'; // Obsolète

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    forwardRef(() => UsersModule),
    forwardRef(() => CartModule),
    forwardRef(() => DatabaseModule),
    forwardRef(() => MessagesModule),
    forwardRef(() => AuthModule),
    CacheModule,
  ],
  controllers: [RemixController],
  providers: [
    RemixService,
    RemixApiService,
    // Tous les services d'intégration supprimés car obsolètes
  ],
  exports: [RemixService],
})
export class RemixModule {}
