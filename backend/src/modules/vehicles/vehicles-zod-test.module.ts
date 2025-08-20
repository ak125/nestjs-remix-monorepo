/**
 * 🧪 MODULE DE TEST ZOD VEHICLES
 * 
 * Module de test pour valider l'intégration Zod
 * avec le système de validation des véhicules.
 * Utilise l'endpoint /api/vehicles-zod pour les tests.
 */

import { Module } from '@nestjs/common';

// Controllers de test
import { VehiclesZodController } from './vehicles-zod.controller';

// Services réutilisés
import { VehiclesService } from './vehicles.service';

@Module({
  controllers: [
    VehiclesZodController, // ✅ Controller de test avec validation Zod
  ],
  providers: [
    VehiclesService, // ✅ Réutilise le service principal
  ],
  exports: [
    VehiclesService, // ✅ Service exporté
  ],
})
export class VehiclesZodTestModule {}
