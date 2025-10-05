import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ShippingModule } from '../shipping/shipping.module';
import { ApiModule } from '../api.module';

// Controller minimal
import { AutomotiveOrdersController } from './controllers/automotive-orders.controller';

// Controller Fusion - Version Complète (NOUVEAU)
import { OrdersFusionController } from './controllers/orders-fusion.controller';

// Controller Simple - Version Test Tables Legacy (NOUVEAU)
import { OrdersSimpleController } from './controllers/orders-simple.controller';

// Controller Customer - Version dédiée aux clients (NOUVEAU)
import { CustomerOrdersController } from './controllers/customer-orders.controller';

// Controller Admin - Version dédiée aux administrateurs (NOUVEAU)
import { AdminOrdersController } from './controllers/admin-orders.controller';

// Services consolidés - Phase 2
import { OrderCalculationService } from './services/order-calculation.service';
import { OrdersService } from './services/orders.service';
import { OrderStatusService } from './services/order-status.service';
import { OrderArchiveService } from './services/order-archive.service';
import { TicketsService } from './services/tickets.service';

// Contrôleurs spécialisés
import { OrderStatusController } from './controllers/order-status.controller';
import { OrderArchiveController } from './controllers/order-archive.controller';
import { TicketsController } from './controllers/tickets.controller';
import { LegacyOrdersController } from './controllers/legacy-orders.controller';

/**
 * Module Orders - Version Consolidée Phase 2
 * ✅ Services consolidés (5 services au lieu de 8)
 * ✅ Architecture claire et maintenable
 * ✅ Suppression des doublons et services obsolètes
 *
 * Services actifs:
 * - OrdersService: CRUD principal
 * - OrderCalculationService: Calculs
 * - OrderStatusService: Workflow statuts
 * - OrderArchiveService: Archivage
 * - TicketsService: SAV
 */
@Module({
  imports: [
    forwardRef(() => DatabaseModule),
    ShippingModule,
    ApiModule, // Pour accéder au LegacyOrderService
  ],
  controllers: [
    AutomotiveOrdersController,
    OrdersFusionController, // Controller fusion NOUVEAU
    OrdersSimpleController, // Controller simple NOUVEAU - ACTIVÉ
    CustomerOrdersController, // Controller client dédié NOUVEAU
    AdminOrdersController, // Controller admin dédié NOUVEAU
    OrderStatusController, // Controller statuts NOUVEAU
    OrderArchiveController, // Controller archivage NOUVEAU
    TicketsController, // Controller tickets avancés NOUVEAU
    LegacyOrdersController, // Controller legacy orders enrichi NOUVEAU
  ],
  providers: [
    // Services consolidés Phase 2
    OrdersService, // Service principal CRUD
    OrderCalculationService, // Calculs
    OrderStatusService, // Workflow statuts
    OrderArchiveService, // Archivage
    TicketsService, // SAV
  ],
  exports: [
    // Export des services consolidés
    OrdersService,
    OrderCalculationService,
    OrderStatusService,
    OrderArchiveService,
    TicketsService,
  ],
})
export class OrdersModule {}
