import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from '../../database/database.module';

// Services modulaires
import { VehicleCacheService } from './services/core/vehicle-cache.service';
import { VehicleEnrichmentService } from './services/core/vehicle-enrichment.service';
import { VehicleBrandsService } from './services/data/vehicle-brands.service';
import { VehicleModelsService } from './services/data/vehicle-models.service';
import { VehicleTypesService } from './services/data/vehicle-types.service';
import { VehicleSearchService } from './services/search/vehicle-search.service';
import { VehicleMineService } from './services/search/vehicle-mine.service';
import { VehiclesPerformanceService } from './services/vehicles-performance.service';

// Service orchestrateur et contrôleur
import { EnhancedVehicleService } from './services/enhanced-vehicle.service';
import { EnhancedVehicleController } from './enhanced-vehicle-simple.controller';

/**
 * 🚗 ENHANCED VEHICLES MODULE - Version Simplifiée
 * 
 * Module temporaire avec architecture modulaire mais contrôleur simplifié
 * pour résoudre rapidement les problèmes du sélecteur véhicule
 */
@Module({
  imports: [
    DatabaseModule,
    CacheModule.register({
      ttl: 1800, // 30 minutes par défaut
      max: 1000, // Maximum 1000 items en cache
    }),
  ],
  controllers: [
    EnhancedVehicleController, // Contrôleur simplifié
  ],
  providers: [
    // 🔧 Services modulaires de base
    VehicleCacheService,
    VehicleEnrichmentService,
    VehicleBrandsService,
    VehicleModelsService, 
    VehicleTypesService,
    VehicleSearchService,
    VehicleMineService,
    VehiclesPerformanceService,
    
    // 🎯 Service orchestrateur principal
    EnhancedVehicleService,
  ],
  exports: [
    EnhancedVehicleService,
    VehicleCacheService,
    VehicleEnrichmentService,
  ],
})
export class EnhancedVehiclesSimpleModule {}