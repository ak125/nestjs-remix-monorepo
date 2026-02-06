/**
 * 🎯 MODULE PRODUCTS CONSOLIDÉ - Architecture propre et maintenable
 *
 * Module products après consolidation Phase 2 & 3 :
 * ✅ Services consolidés : 13 → 7 (-46%)
 * ✅ Code nettoyé : 8,190 → 4,137 lignes (-49%)
 * ✅ Controllers split Phase 5 : 1 monolithique → 5 focalisés (max ~220L)
 * ✅ Noms clairs et explicites
 * ✅ 0 duplication, 0 code mort
 * ✅ Architecture Domain-Driven
 * ✅ Performance optimisée
 * ✅ Tests déplacés hors production
 * 🎯 Phase 2 consolidation: 6 octobre 2025
 * 🎯 Phase 3 consolidation: 6 octobre 2025
 */

import { Module, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from '../../database/database.module';

// Controllers - Split Phase 5 (février 2026)
import { ProductsAdminController } from './controllers/products-admin.controller';
import { ProductsSearchController } from './controllers/products-search.controller';
import { ProductsInventoryController } from './controllers/products-inventory.controller';
import { ProductsCatalogController } from './controllers/products-catalog.controller';
import { ProductsCoreController } from './controllers/products-core.controller';
import { FilteringController } from './filtering.controller';
import { CrossSellingController } from './cross-selling.controller';

// Services - Consolidés Phase 2 (6 octobre 2025) + Split Phase 4 (février 2026)
import { ProductsService } from './products.service';
import { ProductsCatalogService } from './services/products-catalog.service';
import { ProductsAdminService } from './services/products-admin.service';
import { ProductsTechnicalService } from './services/products-technical.service';
import { ProductEnhancementService } from './services/product-enhancement.service';
import { ProductFilteringService } from './services/product-filtering.service';
import { PricingService } from './services/pricing.service';
import { CrossSellingService } from './services/cross-selling.service';
import { StockService } from './services/stock.service';

@Module({
  imports: [
    // 🚀 P7.1 PERF: DatabaseModule pour accès RedisCacheService
    DatabaseModule,
    // Cache Redis pour améliorer les performances + V4 Ultimate
    CacheModule.register({
      ttl: 300, // 5 minutes par défaut
      max: 1000, // 1000 entrées max en cache
      isGlobal: false,
    }),
  ],
  controllers: [
    // Ordre CRITIQUE : routes statiques avant /:id (ProductsCoreController en dernier)
    ProductsAdminController, // /admin/*, /debug/*, /filters/*, /:id/status
    ProductsSearchController, // /search, /search/vehicle, /search/:reference, /popular
    ProductsInventoryController, // /inventory/*
    ProductsCatalogController, // /gammes, /brands, /models, /stats
    ProductsCoreController, // /, /pieces, /pieces-catalog, /:id (catch-all — LAST)
    FilteringController, // api/products/filters/*
    CrossSellingController, // api/cross-selling/*
  ],
  providers: [
    // Services principaux - Split Phase 4
    ProductsService, // ✅ CRUD + Search core
    ProductsCatalogService, // ✅ Gammes, Marques, Stats, Debug
    ProductsAdminService, // ✅ Commercial, Filtres dynamiques, Toggle
    ProductsTechnicalService, // ✅ OEM, Critères, Compatibilités
    ProductEnhancementService, // ✅ Enrichissement produits
    ProductFilteringService, // ✅ Filtrage avancé
    PricingService, // ✅ Calcul prix
    CrossSellingService, // ✅ Ventes croisées
    StockService, // ✅ Gestion stock
  ],
  exports: [
    ProductsService,
    ProductsCatalogService,
    ProductsAdminService,
    ProductsTechnicalService,
    ProductEnhancementService,
    ProductFilteringService,
    PricingService,
    CrossSellingService,
    StockService,
  ],
})
export class ProductsModule {
  private readonly logger = new Logger(ProductsModule.name);

  constructor() {
    this.logger.log(
      '🎯 Products Module - Phase 5 Split (9 services, 7 controllers)',
    );
    this.logger.log('✅ Services actifs (9):');
    this.logger.log('   • ProductsService - CRUD + Search core (~570L)');
    this.logger.log(
      '   • ProductsCatalogService - Gammes, Marques, Stats, Debug',
    );
    this.logger.log('   • ProductsAdminService - Commercial, Filtres, Toggle');
    this.logger.log(
      '   • ProductsTechnicalService - OEM, Critères, Compatibilités',
    );
    this.logger.log('   • ProductEnhancementService - Enrichissement');
    this.logger.log('   • ProductFilteringService - Filtrage avancé');
    this.logger.log('   • PricingService - Calcul prix');
    this.logger.log('   • CrossSellingService - Ventes croisées');
    this.logger.log('   • StockService - Gestion stock');
    this.logger.log('🚀 Module prêt pour production');
  }
}
