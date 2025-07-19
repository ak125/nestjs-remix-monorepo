/**
 * Module Orders étendu avec fonctionnalités automobiles
 * 
 * Intégration du module automobile existant avec les vraies tables:
 * - ___xtr_order, ___xtr_order_line, ___xtr_customer
 * - Schéma Prisma moderne (Order, OrderLine)
 * - Services automobiles avancés (vehicle-data, advanced-shipping, tax-calculation)
 */

import { Module } from '@nestjs/common';

// Contrôleurs de base
import { OrdersController } from './orders.controller';
import { OrdersApiController } from './orders-api.controller';

// Services de base
import { OrdersService } from './orders.service';
import { OrdersCompleteService } from './orders-complete.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';

// Import des services automobiles existants
import { AutomotiveOrdersService } from './services/automotive-orders.service';
import { TaxCalculationService } from './services/tax-calculation.service';
import { AdvancedShippingService } from './services/advanced-shipping.service';
import { VehicleDataService } from './services/vehicle-data.service';

// Nouveau contrôleur pour les fonctionnalités automobiles
import { AutomotiveOrdersController } from './controllers/automotive-orders.controller';

// Service d'intégration avec les tables existantes
import { OrdersAutomotiveIntegrationService } from './services/orders-automotive-integration.service';

@Module({
  imports: [],
  controllers: [
    OrdersController, 
    OrdersApiController, 
    AutomotiveOrdersController  // Nouveau contrôleur automobile
  ],
  providers: [
    // Services existants
    OrdersService, 
    OrdersCompleteService, 
    SupabaseRestService,
    
    // Services automobiles
    AutomotiveOrdersService,
    TaxCalculationService,
    AdvancedShippingService,
    VehicleDataService,
    
    // Service d'intégration
    OrdersAutomotiveIntegrationService
  ],
  exports: [
    OrdersService, 
    OrdersCompleteService,
    AutomotiveOrdersService,
    OrdersAutomotiveIntegrationService
  ]
})
export class OrdersModule {}
