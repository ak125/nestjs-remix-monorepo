import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ShippingModule } from '../shipping/shipping.module';

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

// Services minimaux fonctionnels
import { OrderCalculationService } from './services/order-calculation.service';
import { OrdersServiceEnhanced } from './services/orders-enhanced-minimal.service';
import { OrderArchiveService } from './services/order-archive-minimal.service';

// Service Fusion - Version Complète (NOUVEAU)
import { OrdersService } from './services/orders-fusion.service';

// Service Simple - Version Test Tables Legacy (NOUVEAU)
import { OrdersSimpleService } from './services/orders-simple.service';

// Service de gestion des statuts (NOUVEAU)
import { OrderStatusService } from './services/order-status.service';

// Contrôleur de test des statuts (NOUVEAU)
import { OrderStatusController } from './controllers/order-status.controller';

// Contrôleur d'archivage complet (NOUVEAU)
import { OrderArchiveController } from './controllers/order-archive.controller';

// Service d'archivage complet (NOUVEAU)
import { OrderArchiveCompleteService } from './services/order-archive-complete.service';

// Service tickets avancés (NOUVEAU)
import { TicketsAdvancedService } from './services/tickets-advanced.service';
import { TicketsController } from './controllers/tickets.controller';

/**
 * Module Orders - Version avec Service Tickets Avancés
 * ✅ Service minimal conservé pour compatibilité
 * ✅ Service tickets avancés avec Supabase direct
 * ✅ TicketEquivalentService obsolète retiré
 */
@Module({
  imports: [forwardRef(() => DatabaseModule), ShippingModule],
  controllers: [
    AutomotiveOrdersController,
    OrdersFusionController, // Controller fusion NOUVEAU
    OrdersSimpleController, // Controller simple NOUVEAU - ACTIVÉ
    CustomerOrdersController, // Controller client dédié NOUVEAU
    AdminOrdersController, // Controller admin dédié NOUVEAU
    OrderStatusController, // Controller statuts NOUVEAU
    OrderArchiveController, // Controller archivage NOUVEAU
    TicketsController, // Controller tickets avancés NOUVEAU
  ],
  providers: [
    OrderCalculationService,
    OrdersServiceEnhanced, // Service minimal existant
    OrderArchiveService,
    OrdersService, // Service fusion NOUVEAU
    OrdersSimpleService, // Service simple NOUVEAU
    OrderStatusService, // Service statuts NOUVEAU
    OrderArchiveCompleteService, // Service archivage complet NOUVEAU
    TicketsAdvancedService, // Service tickets avancés NOUVEAU
  ],
  exports: [
    OrderCalculationService,
    OrdersServiceEnhanced,
    OrderArchiveService,
    OrdersService, // Disponible pour injection
    OrdersSimpleService, // Disponible pour injection
    OrderStatusService, // Disponible pour injection
    OrderArchiveCompleteService, // Disponible pour injection
    TicketsAdvancedService, // Disponible pour injection
  ],
})
export class OrdersModule {}
