/**
 * 🚗 VehiclesModule — version nettoyée et optimisée
 * - API REST principale (VehiclesController) + Forms (VehiclesFormsController)
 * - Services : VehiclesService (principal), EnhancedVehicleService (orchestrateur),
 *   services core/data/search (cache, enrichment, brands, models, types, search, mine)
 * - Cache configurable via ENV (VEHICLES_CACHE_TTL, VEHICLES_CACHE_MAX)
 * - Imports stricts, pas de doublons ni de dépendances circulaires
 */

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

// Controllers
import { VehiclesController } from './vehicles.controller';
import { VehiclesFormsController } from './vehicles-forms-simple.controller';
import { BrandsController } from './brands.controller'; // 🏷️ API marques automobiles /api/brands/*
import { AdminVehicleCacheController } from './controllers/admin-vehicle-cache.controller'; // 🗄️ ADR-016 __vehicle_page_cache
// import { VehiclesEnhancedController } from './vehicles-enhanced.controller'; // 👉 Décommente si présent et compilable

// Services principaux
import { VehiclesService } from './vehicles.service';
import { EnhancedVehicleService } from './services/enhanced-vehicle.service';

// Services core
import { VehicleCacheService } from './services/core/vehicle-cache.service';
import { VehicleEnrichmentService } from './services/core/vehicle-enrichment.service';

// Services data
import { VehicleBrandsService } from './services/data/vehicle-brands.service';
import { VehicleModelsService } from './services/data/vehicle-models.service';
import { VehicleTypesService } from './services/data/vehicle-types.service';

// Services search
import { VehicleSearchService } from './services/search/vehicle-search.service';
import { VehicleMineService } from './services/search/vehicle-mine.service';

// Services SEO
import { BrandSeoService } from './services/seo/brand-seo.service';

// Services Meta (extrait de VehiclesService)
import { VehicleMetaService } from './services/vehicle-meta.service';

// Services Bestsellers (extrait de VehiclesService)
import { BrandBestsellersService } from './services/brand-bestsellers.service';

// Services Motor Codes (extrait de VehiclesService)
import { VehicleMotorCodesService } from './services/vehicle-motor-codes.service';

// Services Profile (extrait de VehiclesService)
import { VehicleProfileService } from './services/vehicle-profile.service';

// Service RPC optimisé (LCP)
import { VehicleRpcService } from './services/vehicle-rpc.service';
import { BrandRpcService } from './services/brand-rpc.service';

// Module Catalog pour le maillage interne
import { CatalogModule } from '../catalog/catalog.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    forwardRef(() => CatalogModule), // 🔗 Pour le maillage interne (gammes populaires)
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // TTL défaut 300s, max 100 éléments — surchargés via ENV
        ttl: Number(config.get('VEHICLES_CACHE_TTL', 300)),
        max: Number(config.get('VEHICLES_CACHE_MAX', 100)),
        // keyPrefix: 'vehicles:', // 👉 active si besoin d'isoler les clés
        // store: await redisStore({ url: config.get('REDIS_URL') }), // 👉 switch Redis en prod
      }),
    }),
  ],
  controllers: [
    VehiclesController,
    VehiclesFormsController,
    BrandsController, // 🏷️ API marques /api/brands/*
    AdminVehicleCacheController, // 🗄️ ADR-016 /api/admin/vehicle-cache/*
    // VehiclesEnhancedController,
  ],
  providers: [
    // Services principaux
    VehiclesService,
    EnhancedVehicleService,

    // Core
    VehicleCacheService,
    VehicleEnrichmentService,

    // Data
    VehicleBrandsService,
    VehicleModelsService,
    VehicleTypesService,

    // Search
    VehicleSearchService,
    VehicleMineService,

    // SEO
    BrandSeoService,

    // Meta (extrait de VehiclesService)
    VehicleMetaService,

    // Bestsellers (extrait de VehiclesService)
    BrandBestsellersService,

    // Motor Codes (extrait de VehiclesService)
    VehicleMotorCodesService,

    // Profile (extrait de VehiclesService)
    VehicleProfileService,

    // RPC optimisé (LCP)
    VehicleRpcService,
    BrandRpcService,
  ],
  exports: [
    VehiclesService,
    EnhancedVehicleService,
    // (optionnel) export si consommés ailleurs :
    VehicleBrandsService,
    VehicleModelsService,
    VehicleTypesService,
    VehicleSearchService,
    VehicleMineService,
    VehicleCacheService,
    VehicleRpcService,
    BrandRpcService,
    VehicleMetaService,
    BrandBestsellersService,
    VehicleMotorCodesService,
    VehicleProfileService,
  ],
})
export class VehiclesModule {}
