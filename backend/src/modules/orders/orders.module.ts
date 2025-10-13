import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ShippingModule } from '../shipping/shipping.module';
import { ApiModule } from '../api.module';

// 🆕 Contrôleur unifié Phase 3
import { OrdersController } from './controllers/orders.controller';

// ✅ Contrôleurs spécialisés (à garder)
import { OrderStatusController } from './controllers/order-status.controller';
import { OrderArchiveController } from './controllers/order-archive.controller';
import { TicketsController } from './controllers/tickets.controller';
import { OrderActionsController } from './controllers/order-actions.controller';

// Services consolidés - Phase 2
import { OrderCalculationService } from './services/order-calculation.service';
import { OrdersService } from './services/orders.service';
import { OrderStatusService } from './services/order-status.service';
import { OrderArchiveService } from './services/order-archive.service';
import { TicketsService } from './services/tickets.service';
import { OrderActionsService } from './services/order-actions.service';

// 🆕 Service Email pour notifications
import { EmailService } from '../../services/email.service';

/**
 * 📦 MODULE ORDERS - Version Consolidée Phase 3
 *
 * Phase 2 (Complétée) ✅:
 * - Services consolidés: 8 → 5 services
 * - Doublons éliminés: -66%
 * - Architecture services claire
 *
 * Phase 3 (En cours) 🚀:
 * - Contrôleurs consolidés: 10 → 4 contrôleurs (-60%)
 * - Routes unifiées sous /api/orders/*
 * - Architecture finale propre
 *
 * Contrôleurs actifs:
 * 1. OrdersController: Routes principales (client + admin + legacy)
 * 2. OrderStatusController: Workflow statuts
 * 3. OrderArchiveController: Archivage
 * 4. TicketsController: SAV
 *
 * Services actifs:
 * 1. OrdersService: CRUD principal
 * 2. OrderCalculationService: Calculs
 * 3. OrderStatusService: Workflow statuts
 * 4. OrderArchiveService: Archivage
 * 5. TicketsService: SAV
 */
@Module({
  imports: [
    forwardRef(() => DatabaseModule),
    ShippingModule,
    ApiModule, // Pour accéder au LegacyOrderService si besoin
  ],
  controllers: [
    // 🆕 Phase 3: Contrôleur unifié principal
    OrdersController, // /api/orders/* (client + admin + legacy)

    // ✅ Contrôleurs spécialisés (gardés)
    OrderStatusController, // /order-status/* (workflow statuts)
    OrderArchiveController, // /order-archive/* (archivage)
    TicketsController, // /api/tickets/* (SAV)
    OrderActionsController, // /api/admin/orders/* (ACTIONS BACKOFFICE)
  ],
  providers: [
    // Services consolidés Phase 2
    OrdersService, // Service principal CRUD
    OrderCalculationService, // Calculs
    OrderStatusService, // Workflow statuts
    OrderArchiveService, // Archivage
    TicketsService, // SAV
    OrderActionsService, // Actions backoffice
    EmailService, // 🆕 Notifications email
  ],
  exports: [
    // Export des services consolidés
    OrdersService,
    OrderCalculationService,
    OrderStatusService,
    OrderArchiveService,
    TicketsService,
    OrderActionsService,
  ],
})
export class OrdersModule {}
