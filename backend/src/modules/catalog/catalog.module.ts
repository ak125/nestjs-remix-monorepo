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
import { EquipementiersController } from './controllers/equipementiers.controller';
import { VehicleFilteredCatalogV4Controller } from './controllers/vehicle-filtered-catalog-v4-hybrid.controller';
import { PiecesCleanController } from './controllers/pieces-clean.controller';
// import { PiecesDbController } from '../../pieces/pieces-db.controller'; // DÉSACTIVÉ - service manquant
// PiecesRealController utilisé dans catalog-simple.module.ts, pas ici

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
import { VehicleFilteredCatalogV4HybridService } from './services/vehicle-filtered-catalog-v4-hybrid.service';
import { PiecesV4WorkingService } from './services/pieces-v4-working.service';
import { VehiclePiecesCompatibilityService } from './services/vehicle-pieces-compatibility.service';
import { PiecesPhpLogicCompleteService } from './services/pieces-php-logic-complete.service';
import { PiecesEnhancedService } from './services/pieces-enhanced.service';
import { PiecesUltraEnhancedService } from './services/pieces-ultra-enhanced.service';
import { PiecesDbService } from '../../pieces/pieces-db.service';
import { PiecesRealService } from '../../pieces/pieces-real.service';
import { PricingService } from '../products/services/pricing.service';

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
    EquipementiersController,
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
    VehicleFilteredCatalogV4HybridService,
    PiecesV4WorkingService,
    VehiclePiecesCompatibilityService,
    PiecesPhpLogicCompleteService,
    PiecesEnhancedService,
    PiecesUltraEnhancedService,
    PiecesDbService,
    PiecesRealService,
    // 🎯 PRICING SERVICE - Service de prix
    PricingService,
    // Alias pour compatibilité
    { provide: 'PricingServiceV5UltimateFinal', useClass: PricingService },
  ],
  exports: [
    CatalogService,
    EnhancedVehicleCatalogService,
    CatalogFamilyService,
    CatalogGammeService,
    FamilyGammeHierarchyService,
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
