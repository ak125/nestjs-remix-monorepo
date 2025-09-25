import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

// ========================================
// 📋 CONTROLLERS - API REST complets
// ========================================
import { CatalogController } from './catalog.controller';
import { EnhancedVehicleCatalogController } from './controllers/enhanced-vehicle-catalog.controller';
import { CatalogGammeController } from './controllers/catalog-gamme.controller';
import { FamilyGammeHierarchyController } from './controllers/family-gamme-hierarchy.controller';
import { GammeUnifiedController } from './controllers/gamme-unified.controller'; // 🎯 NOUVEAU - Controller unifié
import { ImageProcessingController } from './controllers/image-test.controller'; // 🖼️ Test controller images
import { EquipementiersController } from './controllers/equipementiers.controller'; // 🏭 NOUVEAU - Controller équipementiers
import { VehicleFilteredCatalogV3Controller } from './controllers/vehicle-filtered-catalog-v3.controller'; // 🚗 V3 - Controller catalogue filtré
import { VehicleFilteredCatalogV4Controller } from './controllers/vehicle-filtered-catalog-v4-hybrid.controller'; // 🚀 V4 - Controller hybride ultime
// import { GammeController } from './controllers/gamme.controller'; // TEMPORAIREMENT DÉSACTIVÉ

// ========================================
// 🔧 SERVICES PRINCIPAUX - Logique métier
// ========================================
import { CatalogService } from './catalog.service';
import { EnhancedVehicleCatalogService } from './services/enhanced-vehicle-catalog.service';
// import { GammeService } from './services/gamme.service'; // TEMPORAIREMENT DÉSACTIVÉ - dépendance VehicleCacheService
import { CatalogFamilyService } from './services/catalog-family.service';
import { CatalogGammeService } from './services/catalog-gamme.service';
import { FamilyGammeHierarchyService } from './services/family-gamme-hierarchy.service';
import { GammeUnifiedService } from './services/gamme-unified.service'; // 🎯 NOUVEAU - Service unifié
import { EquipementiersService } from './services/equipementiers.service'; // 🏭 NOUVEAU - Service équipementiers
import { VehicleFilteredCatalogService } from './services/vehicle-filtered-catalog-v2.service'; // 🚗 V2 - Service catalogue filtré par véhicule
import { VehicleFilteredCatalogServiceV3 } from './services/vehicle-filtered-catalog-v3-simple.service'; // 🚗 V3 - Service avec logique PHP complète
import { VehicleFilteredCatalogV4HybridService } from './services/vehicle-filtered-catalog-v4-hybrid.service'; // 🚀 V4 - Service hybride ultime
// import { ImageProcessingService } from './services/image-processing.service'; // 🖼️ TEMPORAIREMENT DÉSACTIVÉ - erreurs compilation

// ========================================
// 🚗 SERVICES VÉHICULES - Importation du module véhicules (TEMPORAIREMENT DÉSACTIVÉ)
// ========================================
// import { VehiclesModule } from '../vehicles/vehicles.module';

// ========================================
// ⚡ SERVICES TRANSVERSAUX - Cache et métadonnées (TEMPORAIREMENT DÉSACTIVÉ)
// ========================================
// import { VehicleCacheService } from '../vehicles/services/core/vehicle-cache.service';
// import { MetadataService } from '../config/services/metadata.service';

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
    CatalogGammeController, // 🔧 NOUVEAU - Contrôleur gammes catalog_gamme
    FamilyGammeHierarchyController, // 🏗️ NOUVEAU - Contrôleur hiérarchie Familles → Gammes
    GammeUnifiedController, // 🎯 NOUVEAU - Contrôleur unifié simplifié
    ImageProcessingController, // 🖼️ NOUVEAU - Contrôleur traitement images
    EquipementiersController, // 🏭 NOUVEAU - Contrôleur équipementiers
    VehicleFilteredCatalogV3Controller, // 🚗 V3 - NOUVEAU - Contrôleur catalogue véhicule PHP exact
    VehicleFilteredCatalogV4Controller, // 🚀 V4 - NOUVEAU - Contrôleur hybride ultime avec cache Redis
    // GammeController, // TEMPORAIREMENT DÉSACTIVÉ - utilise GammeService problématique
  ],
  providers: [
    // 🔧 Services principaux
    CatalogService,
    EnhancedVehicleCatalogService,
    // GammeService, // TEMPORAIREMENT DÉSACTIVÉ - dépendance VehicleCacheService
    CatalogFamilyService, // 🔧 NOUVEAU - Service familles de catalogue
    CatalogGammeService, // 🔧 NOUVEAU - Service gammes catalog_gamme
    FamilyGammeHierarchyService, // 🏗️ NOUVEAU - Service hiérarchie Familles → Gammes
    GammeUnifiedService, // 🎯 NOUVEAU - Service unifié simplifié
    EquipementiersService, // 🏭 NOUVEAU - Service équipementiers
    VehicleFilteredCatalogService, // 🚗 V2 - Service catalogue filtré par véhicule
    VehicleFilteredCatalogServiceV3, // 🚗 V3 - Service avec logique PHP complète
    VehicleFilteredCatalogV4HybridService, // 🚀 V4 - Service hybride ultime avec cache Redis
    // ImageProcessingService, // 🖼️ TEMPORAIREMENT DÉSACTIVÉ - erreurs de compilation

    // ⚡ Services de support - TEMPORAIREMENT DÉSACTIVÉS
    // VehicleCacheService,
    // MetadataService,
  ],
  exports: [
    // 📤 Exports pour autres modules
    CatalogService,
    EnhancedVehicleCatalogService,
    // GammeService, // TEMPORAIREMENT DÉSACTIVÉ
    CatalogFamilyService, // 🔧 NOUVEAU - Export service familles
    CatalogGammeService, // 🔧 NOUVEAU - Export service gammes catalog_gamme
    FamilyGammeHierarchyService, // 🏗️ NOUVEAU - Export service hiérarchie
    VehicleFilteredCatalogService, // 🚗 V2 - Export service catalogue filtré
    VehicleFilteredCatalogServiceV3, // 🚗 V3 - Export service avec logique PHP complète
    VehicleFilteredCatalogV4HybridService, // 🚀 V4 - Export service hybride ultime avec cache Redis
    // VehicleCacheService, // TEMPORAIREMENT DÉSACTIVÉ
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
