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
import { CacheModule } from '@nestjs/cache-manager';

// Controllers
import { VehiclesController } from './vehicles.controller';
import { VehiclesFormsController } from './vehicles-forms-simple.controller';

// Services
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // max 100 items in cache
    }),
  ],
  controllers: [
    VehiclesController, // ✅ API REST pour la gestion des véhicules
    VehiclesFormsController, // ✅ API Forms pour remplacer _form.get.car.*.php
  ],
  providers: [
    VehiclesService, // ✅ Service principal de gestion des véhicules
  ],
  exports: [
    VehiclesService, // ✅ Exporté pour utilisation dans d'autres modules
  ],
})
export class VehiclesModule {}
