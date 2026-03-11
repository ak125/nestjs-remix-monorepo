import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from '../../database/database.module';

// ========================================
// 📋 CONTROLLERS - API REST complets
// ========================================
import { CatalogController } from './catalog.controller';
import { EnhancedVehicleCatalogController } from './controllers/enhanced-vehicle-catalog.controller';
import { GammeUnifiedController } from './controllers/gamme-unified.controller';
import { EquipementiersController } from './controllers/equipementiers.controller';
import { VehicleFilteredCatalogV4Controller } from './controllers/vehicle-filtered-catalog-v4-hybrid.controller';
import { PiecesCleanController } from './controllers/pieces-clean.controller';
import { PiecesDiagnosticController } from './controllers/pieces-diagnostic.controller';
import { CatalogIntegrityController } from './controllers/catalog-integrity.controller';
import { VehicleHierarchyController } from './controllers/vehicle-hierarchy.controller'; // 🚗 API hiérarchie véhicules
import { CompatibilityController } from './controllers/compatibility.controller'; // 🎯 API compatibilité pièce/véhicule
// import { PiecesDbController } from '../../pieces/pieces-db.controller'; // DÉSACTIVÉ - service manquant

// ========================================
// 🔧 SERVICES PRINCIPAUX - Logique métier
// ========================================
import { CatalogService } from './catalog.service';
import { EnhancedVehicleCatalogService } from './services/enhanced-vehicle-catalog.service';
import { GammeUnifiedService } from './services/gamme-unified.service';
import { EquipementiersService } from './services/equipementiers.service';
import { VehicleFilteredCatalogV4HybridService } from './services/vehicle-filtered-catalog-v4-hybrid.service';
import { VehiclePiecesCompatibilityService } from './services/vehicle-pieces-compatibility.service';
import { CatalogDataIntegrityService } from './services/catalog-data-integrity.service';
import { PricingService } from '../products/services/pricing.service';
import { OemPlatformMappingService } from './services/oem-platform-mapping.service';
import { UnifiedPageDataService } from './services/unified-page-data.service';
import { SeoTemplateService } from './services/seo-template.service'; // ⚡ SEO processing NestJS (RPC V4)
import { HomepageRpcService } from './services/homepage-rpc.service';
import { CatalogHierarchyService } from './services/catalog-hierarchy.service';
import { CacheWarmingService } from './services/cache-warming.service';
import { CompatibilityService } from './services/compatibility.service'; // 🎯 Service compatibilité pièce/véhicule
import { PopularGammesService } from './services/popular-gammes.service'; // 🔗 Service maillage SEO (découplage Catalog↔Vehicles)
import { GammePricePreviewService } from './services/gamme-price-preview.service'; // 💰 Prix indicatifs gamme (conversion P0)

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
    NestCacheModule.register({ ttl: 300, max: 200 }), // Cache pour CacheInterceptor
  ],
  controllers: [
    CatalogController,
    EnhancedVehicleCatalogController,
    GammeUnifiedController, // ✅ Controller unifié actif
    EquipementiersController,
    VehicleFilteredCatalogV4Controller,
    PiecesCleanController,
    PiecesDiagnosticController, // 🔍 DIAGNOSTIC des relations pièces-véhicules
    CatalogIntegrityController, // 🛡️ VALIDATION de l'intégrité des données
    VehicleHierarchyController, // 🚗 API hiérarchie véhicules pour pages motorisation
    CompatibilityController, // 🎯 API compatibilité pièce/véhicule (Pack Confiance V2)
    // PiecesDbController, // DÉSACTIVÉ - service manquant
  ],
  providers: [
    // 🔧 Services principaux
    CatalogService,
    EnhancedVehicleCatalogService,
    GammeUnifiedService,
    EquipementiersService,
    VehicleFilteredCatalogV4HybridService,
    VehiclePiecesCompatibilityService,
    CatalogDataIntegrityService, // 🛡️ Service de validation de l'intégrité
    // 🎯 PRICING SERVICE - Service de prix
    PricingService,
    // 🔧 OEM PLATFORM MAPPING - Filtrage OEM par plateforme véhicule (SEO)
    OemPlatformMappingService,
    // ⚡ SEO TEMPLATE SERVICE - Processing NestJS avec cache Redis (RPC V4)
    SeoTemplateService,
    // ⚡ UNIFIED PAGE DATA - RPC V4 (1 requête + SEO NestJS)
    UnifiedPageDataService,
    // 🏠 HOMEPAGE RPC - below-fold (brands/blog/equipementiers)
    HomepageRpcService,
    // 🏗️ CATALOG HIERARCHY - Single source of truth pour familles → gammes
    CatalogHierarchyService,
    // 🔥 CACHE WARMING - Préchauffage au démarrage
    CacheWarmingService,
    // 🎯 COMPATIBILITY SERVICE - Vérification compatibilité pièce/véhicule (Pack Confiance V2)
    CompatibilityService,
    // 🔗 POPULAR GAMMES SERVICE - Maillage SEO (découplage Catalog↔Vehicles)
    PopularGammesService,
    // 💰 PRICE PREVIEW SERVICE - Prix indicatifs sans véhicule (conversion P0)
    GammePricePreviewService,
    // Alias pour compatibilité
    { provide: 'PricingServiceV5UltimateFinal', useClass: PricingService },
  ],
  exports: [
    CatalogService,
    EnhancedVehicleCatalogService,
    VehicleFilteredCatalogV4HybridService,
    CatalogDataIntegrityService, // 🛡️ Exporté pour validation sitemap
    GammeUnifiedService, // ✅ Exporté pour GammeRestModule
    VehiclePiecesCompatibilityService, // ✅ Exporté pour GammeRestModule
    OemPlatformMappingService, // 🔧 Exporté pour filtrage OEM SEO
    SeoTemplateService, // ⚡ Exporté pour traitement SEO externe
    UnifiedPageDataService, // ✅ Exporté pour GammeRestModule (RPC V4)
    HomepageRpcService, // 🏠 Exporté pour homepage RPC
    CatalogHierarchyService, // 🏗️ Single source of truth hiérarchie catalogue
    CompatibilityService, // 🎯 Exporté pour Pack Confiance V2
    PopularGammesService, // 🔗 Exporté pour VehiclesModule (maillage SEO)
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
