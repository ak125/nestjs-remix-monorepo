/**
 * Module Orders - Gestion complète des commandes  
 * 
 * ÉTAT ACTUEL:
 * ✅ OrdersService - Fonctionnel avec SupabaseRestService
 * ✅ OrdersCompleteService - Fonctionnel avec SupabaseRestService  
 * ✅ Approche intégrée NestJS-Remix - Performance optimale
 * 
 * SERVICES AUTOMOBILES TEMPORAIREMENT DÉSACTIVÉS:
 * ❌ Services nécessitent refactorisation complète Prisma -> SupabaseRestService
 * ❌ 15 erreurs TypeScript à résoudre avant réactivation
 * 
 * PLAN DE REFACTORISATION:
 * 1. Migrer TaxCalculationService vers SupabaseRestService
 * 2. Migrer VehicleDataService vers SupabaseRestService
 * 3. Migrer AdvancedShippingService vers SupabaseRestService
 * 4. Recréer AutomotiveOrdersService avec nouvelle architecture
 * 5. Réactiver AutomotiveOrdersController
 * 
 * Fonctionnalités principales actives:
 * - Gestion complète du cycle de vie des commandes
 * - Intégration directe avec Remix (zéro latence)
 * - Cache pour les performances
 * - Audit trail complet
 */

import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersApiController } from './orders-api.controller';
import { OrdersService } from './orders.service';
import { OrdersCompleteService } from './orders-complete.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Module({
  imports: [],
  controllers: [
    OrdersController, 
    OrdersApiController,
  ],
  providers: [
    OrdersService, 
    OrdersCompleteService, 
    SupabaseRestService,
  ],
  exports: [
    OrdersService, 
    OrdersCompleteService,
  ]
})
export class OrdersModule {}
