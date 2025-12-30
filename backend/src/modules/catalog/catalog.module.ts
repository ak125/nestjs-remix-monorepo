import { Module, forwardRef } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';
import { VehiclesModule } from '../vehicles/vehicles.module'; // 🚗 Import pour batch-loader vehicleInfo

// ========================================
// 📋 CONTROLLERS - API REST complets
// ========================================
import { CatalogController } from './catalog.controller';
import { EnhancedVehicleCatalogController } from './controllers/enhanced-vehicle-catalog.controller';
// import { CatalogGammeController } from './controllers/catalog-gamme.controller'; // ❌ DÉSACTIVÉ - Conflit avec GammeUnifiedController
import { FamilyGammeHierarchyController } from './controllers/family-gamme-hierarchy.controller';
import { GammeUnifiedController } from './controllers/gamme-unified.controller';
import { EquipementiersController } from './controllers/equipementiers.controller';
import { VehicleFilteredCatalogV4Controller } from './controllers/vehicle-filtered-catalog-v4-hybrid.controller';
import { PiecesCleanController } from './controllers/pieces-clean.controller';
import { PiecesDiagnosticController } from './controllers/pieces-diagnostic.controller';
import { CatalogIntegrityController } from './controllers/catalog-integrity.controller';
import { BatchLoaderController } from './controllers/batch-loader.controller';
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
import { VehiclePiecesCompatibilityService } from './services/vehicle-pieces-compatibility.service';
import { CatalogDataIntegrityService } from './services/catalog-data-integrity.service';
import { PiecesRealService } from '../../pieces/pieces-real.service';
import { PricingService } from '../products/services/pricing.service';
import { OemPlatformMappingService } from './services/oem-platform-mapping.service';
import { UnifiedPageDataService } from './services/unified-page-data.service';
import { HomepageRpcService } from './services/homepage-rpc.service';

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
    CacheModule, // ⚡ Cache Redis pour optimisation validations (optionnel)
    NestCacheModule.register({ ttl: 300, max: 200 }), // Cache pour CacheInterceptor
    forwardRef(() => VehiclesModule), // 🚗 Import pour batch-loader vehicleInfo (forwardRef pour éviter dépendance circulaire)
  ],
  controllers: [
    CatalogController,
    EnhancedVehicleCatalogController,
    // CatalogGammeController, // ❌ DÉSACTIVÉ - Conflit avec GammeUnifiedController sur /api/catalog/gammes/hierarchy
    FamilyGammeHierarchyController,
    GammeUnifiedController, // ✅ Controller unifié actif
    EquipementiersController,
    VehicleFilteredCatalogV4Controller,
    PiecesCleanController,
    PiecesDiagnosticController, // 🔍 DIAGNOSTIC des relations pièces-véhicules
    CatalogIntegrityController, // 🛡️ VALIDATION de l'intégrité des données
    BatchLoaderController, // 🚀 BATCH LOADER pour optimisation performance
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
    VehiclePiecesCompatibilityService,
    CatalogDataIntegrityService, // 🛡️ Service de validation de l'intégrité
    PiecesRealService, // ✅ Service SQL brut - remplace PiecesDbService
    // 🎯 PRICING SERVICE - Service de prix
    PricingService,
    // 🔧 OEM PLATFORM MAPPING - Filtrage OEM par plateforme véhicule (SEO)
    OemPlatformMappingService,
    // ⚡ UNIFIED PAGE DATA - RPC V3 (1 requête avec SEO intégré PostgreSQL)
    UnifiedPageDataService,
    // 🏠 HOMEPAGE RPC - 4 appels API en 1
    HomepageRpcService,
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
    CatalogDataIntegrityService, // 🛡️ Exporté pour validation sitemap
    GammeUnifiedService, // ✅ Exporté pour GammeRestModule
    VehiclePiecesCompatibilityService, // ✅ Exporté pour GammeRestModule
    OemPlatformMappingService, // 🔧 Exporté pour filtrage OEM SEO
    UnifiedPageDataService, // ✅ Exporté pour GammeRestModule (RPC V3)
    HomepageRpcService, // 🏠 Exporté pour homepage RPC
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
