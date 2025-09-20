/**
 * 🚗 MODULE VEHICLES OPTIMAL - Architecture alignée sur ProductsModule
 *
 * Module véhicules avec stratégie optimale :
 * ✅ Pas d'imports de ConfigModule ou DatabaseModule
 * ✅ VehiclesService hérite de SupabaseBaseService
 * ✅ Configuration via getAppConfig() en fallback
 * ✅ Évite toute dépendance circulaire
 * ✅ Service léger et performant pour automobiles
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

// Controllers
import { VehiclesController } from './vehicles.controller';
import { VehiclesFormsController } from './vehicles-forms-simple.controller';
// import { EnhancedVehicleController } from './enhanced-vehicle.controller'; // 🚫 TEMPORAIREMENT DÉSACTIVÉ

// Services
import { VehiclesService } from './vehicles.service';
import { EnhancedVehicleService } from './services/enhanced-vehicle.service';
// Services modulaires
import { VehicleCacheService } from './services/core/vehicle-cache.service';
import { VehicleEnrichmentService } from './services/core/vehicle-enrichment.service';
import { VehicleSearchService } from './services/search/vehicle-search.service';
import { VehicleMineService } from './services/search/vehicle-mine.service';
import { VehicleBrandsService } from './services/data/vehicle-brands.service';
import { VehicleModelsService } from './services/data/vehicle-models.service';
import { VehicleTypesService } from './services/data/vehicle-types.service';

@Module({
  imports: [
    ConfigModule, // ✅ Ajout du ConfigModule pour injection ConfigService
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // max 100 items in cache
    }),
  ],
  controllers: [
    // EnhancedVehicleController, // � TEMPORAIREMENT DÉSACTIVÉ - Erreurs de compilation
    VehiclesController, // ✅ API REST principale pour sélecteur véhicule
    VehiclesFormsController, // ✅ API Forms pour remplacer _form.get.car.*.php
  ],
  providers: [
    VehiclesService, // ✅ Service principal de gestion des véhicules
    EnhancedVehicleService, // ✅ Service optimisé combinant proposé + existant
    // Services modulaires
    VehicleCacheService,
    VehicleEnrichmentService,
    VehicleSearchService,
    VehicleMineService,
    VehicleBrandsService,
    VehicleModelsService,
    VehicleTypesService,
  ],
  exports: [
    VehiclesService, // ✅ Exporté pour utilisation dans d'autres modules
    EnhancedVehicleService, // ✅ Service optimisé exporté
  ],
})
export class VehiclesModule {}
