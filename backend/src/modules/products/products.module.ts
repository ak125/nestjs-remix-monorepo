/**
 * 🎯 MODULE PRODUCTS OPTIMAL - Architecture sans dépendances circulaires
 *
 * Module products avec stratégie optimale :
 * ✅ Pas d'imports de ConfigModule ou DatabaseModule
 * ✅ ProductsService hérite de SupabaseBaseService
 * ✅ Configuration via getAppConfig() en fallback
 * ✅ Évite toute dépendance circulaire
 * ✅ Service léger et performant
 * ✅ Support du cache Redis pour les performances
 */

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

// Controllers
import { ProductsController } from './products.controller';

// Services
import { ProductsService } from './products.service';
import { ProductsEnhancementService } from './services/products-enhancement.service';

@Module({
  imports: [
    // Cache Redis pour améliorer les performances
    CacheModule.register({
      ttl: 300, // 5 minutes par défaut
      max: 1000, // 1000 entrées max en cache
    }),
  ],
  controllers: [
    ProductsController, // ✅ API REST pour la gestion des produits
  ],
  providers: [
    ProductsService, // ✅ Service principal de gestion des produits
    ProductsEnhancementService, // ✅ Service d'amélioration avec règles métier avancées
  ],
  exports: [
    ProductsService, // ✅ Exporté pour utilisation dans d'autres modules
    ProductsEnhancementService, // ✅ Service d'amélioration exporté
  ],
})
export class ProductsModule {}
