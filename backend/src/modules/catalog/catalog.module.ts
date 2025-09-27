import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

// ========================================
// 📋 CONTROLLERS - API REST complets
// ========================================
import { CatalogController } from './catalog.controller';
import { EnhancedVehicleCatalogController } from './controllers/enhanced-vehicle-catalog.controller';
import { CatalogGammeController } from './controllers/catalog-gamme.controller';
import { FamilyGammeHierarchyController } from './controllers/family-gamme-hierarchy.controller';
import { GammeUnifiedController } from './controllers/gamme-unified.controller';
import { ImageProcessingController } from './controllers/image-test.controller';
import { EquipementiersController } from './controllers/equipementiers.controller';
import { VehicleFilteredCatalogV3Controller } from './controllers/vehicle-filtered-catalog-v3.controller';
import { VehicleFilteredCatalogV4Controller } from './controllers/vehicle-filtered-catalog-v4-hybrid.controller';
import { PiecesCleanController } from './controllers/pieces-clean.controller';
// import { PiecesDbController } from '../../pieces/pieces-db.controller'; // DÉSACTIVÉ - service manquant
import { PiecesRealController } from '../../pieces/pieces-real.controller';

// ========================================
// 🔧 SERVICES PRINCIPAUX - Logique métier
// ========================================
import { CatalogService } from './catalog.service';
import { EnhancedVehicleCatalogService } from './services/enhanced-vehicle-catalog.service';
import { CatalogFamilyService } from './services/catalog-family.service';
import { CatalogGammeService } from './services/catalog-gamme.service';
import { FamilyGammeHierarchyService } from './services/family-gamme-hierarchy.service';
import { GammeUnifiedService } from './services/gamme-unified.service';
import { EquipementiersService } from './services/equipementiers.service';
import { VehicleFilteredCatalogService } from './services/vehicle-filtered-catalog-v2.service';
import { VehicleFilteredCatalogServiceV3 } from './services/vehicle-filtered-catalog-v3-simple.service';
import { VehicleFilteredCatalogV4HybridService } from './services/vehicle-filtered-catalog-v4-hybrid.service';
import { PiecesV4WorkingService } from './services/pieces-v4-working.service';
import { VehiclePiecesCompatibilityService } from './services/vehicle-pieces-compatibility.service';
import { PiecesPhpLogicCompleteService } from './services/pieces-php-logic-complete.service';
import { PiecesEnhancedService } from './services/pieces-enhanced.service';
import { PiecesUltraEnhancedService } from './services/pieces-ultra-enhanced.service';
import { PiecesDbService } from '../../pieces/pieces-db.service';
import { PiecesRealService } from '../../pieces/pieces-real.service';
import { PricingServiceV5UltimateFinal } from '../products/pricing-service-v5-ultimate-final.service';

/**
 * 📂 MODULE CATALOGUE CONSOLIDÉ
 *
 * ✅ Intègre tous les services de catalogue existants
 * ✅ Fournit une API complète pour la page d'accueil
 * ✅ Gère les marques, modèles, types et gammes de produits
 * ✅ Cache intelligent pour des performances optimales
 * ✅ Validation Zod et documentation Swagger automatique
 *
 * 🔗 ENDPOINTS DISPONIBLES :
 * - GET /api/catalog/brands - Liste des marques automobiles
 * - GET /api/catalog/models/:brandId - Modèles par marque
 * - GET /api/catalog/types/:modelId - Types par modèle
 * - GET /api/catalog/gammes - Gammes de produits
 * - GET /api/catalog/homepage-data - Données complètes pour page d'accueil
 * - GET /api/enhanced-vehicle-catalog/* - API véhicules avancée
 *
 * 🎯 OPTIMISÉ POUR :
 * - Page d'accueil avec sélecteur de véhicule
 * - Catalogue de produits par véhicule
 * - Performance avec cache multi-niveaux
 * - Intégration avec système de migration URLs
 */
@Module({
  imports: [
    DatabaseModule,
    // forwardRef(() => VehiclesModule), // Import circulaire géré - TEMPORAIREMENT DÉSACTIVÉ
  ],
  controllers: [
    CatalogController,
    EnhancedVehicleCatalogController,
    CatalogGammeController,
    FamilyGammeHierarchyController,
    GammeUnifiedController,
    ImageProcessingController,
    EquipementiersController,
    VehicleFilteredCatalogV3Controller,
    VehicleFilteredCatalogV4Controller,
    PiecesCleanController,
    // PiecesDbController, // DÉSACTIVÉ - service manquant
  ],
  providers: [
    // 🔧 Services principaux
    CatalogService,
    EnhancedVehicleCatalogService,
    CatalogFamilyService,
    CatalogGammeService,
    FamilyGammeHierarchyService,
    GammeUnifiedService,
    EquipementiersService,
    VehicleFilteredCatalogService,
    VehicleFilteredCatalogServiceV3,
    VehicleFilteredCatalogV4HybridService,
    PiecesV4WorkingService,
    VehiclePiecesCompatibilityService,
    PiecesPhpLogicCompleteService,
    PiecesEnhancedService,
    PiecesUltraEnhancedService,
    PiecesDbService,
    PiecesRealService,
    // 🎯 V5 ULTIMATE PRICING - Service de prix avancé
    PricingServiceV5UltimateFinal,
  ],
  exports: [
    CatalogService,
    EnhancedVehicleCatalogService,
    CatalogFamilyService,
    CatalogGammeService,
    FamilyGammeHierarchyService,
    VehicleFilteredCatalogService,
    VehicleFilteredCatalogServiceV3,
    VehicleFilteredCatalogV4HybridService,
  ],
})
export class CatalogModule {
  /**
   * 📊 Configuration du module
   */
  static readonly MODULE_CONFIG = {
    name: 'CatalogModule',
    version: '2.0.0',
    description: 'Module catalogue consolidé avec support véhicules et gammes',
    features: [
      'API REST complète pour catalogue véhicules',
      'Gammes de produits avec cache intelligent',
      "Intégration page d'accueil optimisée",
      'Support migration URLs SEO',
      'Validation Zod et documentation Swagger',
    ],
    endpoints: {
      catalog: '/api/catalog/*',
      enhanced: '/api/enhanced-vehicle-catalog/*',
    },
  };

  /**
   * 🚀 Méthode statique pour obtenir la configuration
   */
  static getModuleInfo() {
    return this.MODULE_CONFIG;
  }
}
