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
import { EnhancedVehicleController } from '../catalog/controllers/enhanced-vehicle.controller';

// Services
import { VehiclesService } from './vehicles.service';
import { EnhancedVehicleService } from '../catalog/services/enhanced-vehicle.service';

@Module({
  imports: [
    ConfigModule, // ✅ Ajout du ConfigModule pour injection ConfigService
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // max 100 items in cache
    }),
  ],
  controllers: [
    EnhancedVehicleController, // 🚀 PRIORITÉ: API Enhanced pour service optimisé
    VehiclesController, // ✅ API REST pour la gestion des véhicules (fallback)
    VehiclesFormsController, // ✅ API Forms pour remplacer _form.get.car.*.php
  ],
  providers: [
    VehiclesService, // ✅ Service principal de gestion des véhicules
    EnhancedVehicleService, // ✅ Service optimisé combinant proposé + existant
  ],
  exports: [
    VehiclesService, // ✅ Exporté pour utilisation dans d'autres modules
    EnhancedVehicleService, // ✅ Service optimisé exporté
  ],
})
export class VehiclesModule {}
