/**
 * 🎯 MODULE PRODUCTS OPTIMAL - Architecture sans dépendances circulaires
 *
 * Module products avec stratégie optimale :
 * ✅ Pas d'imports de ConfigModule ou DatabaseModule
 * ✅ ProductsService hérite de SupabaseBaseService
 * ✅ Configuration via getAppConfig() en fallback
 * ✅ Évite toute dépendance circulaire
 * ✅ Service léger et performant
 */

import { Module } from '@nestjs/common';

// Controllers
import { ProductsController } from './products.controller';

// Services
import { ProductsService } from './products.service';

@Module({
  // Pas d'imports - évite les dépendances circulaires
  // SupabaseBaseService utilise getAppConfig() en fallback
  controllers: [
    ProductsController, // ✅ API REST pour la gestion des produits
  ],
  providers: [
    ProductsService, // ✅ Service principal de gestion des produits
  ],
  exports: [
    ProductsService, // ✅ Exporté pour utilisation dans d'autres modules
  ],
})
export class ProductsModule {}
