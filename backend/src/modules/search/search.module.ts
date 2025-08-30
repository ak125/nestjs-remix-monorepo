import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { SearchController } from './controllers/search.controller';
import { IndexationController } from './controllers/indexation.controller';
import { PiecesController } from './controllers/pieces.controller';
// import { SearchAdminController } from './controllers/search-admin.controller'; // Temporairement désactivé

// Core Services
import { SearchService } from './services/search.service';
import { SearchService as SearchOptimizedService } from './services/search-optimized.service'; // ✅ Service v3.0
import { MeilisearchService } from './services/meilisearch.service';
import { ProductSheetService } from './services/product-sheet.service';
import { VehicleSearchService } from './services/vehicle-search-meilisearch.service';

// Specialized Services
import { SearchCacheService } from './services/search-cache.service';
import { SearchAnalyticsService } from './services/search-analytics.service';
import { DatabaseAnalysisService } from './services/database-analysis.service';
import { DatabaseTestService } from './services/database-test.service';
import { VehicleNamingService } from './services/vehicle-naming.service';
import { PiecesAnalysisService } from './services/pieces-analysis.service';
import { SearchSuggestionService } from './services/search-suggestion.service';
import { SearchFilterService } from './services/search-filter.service';
import { IndexationService } from './services/indexation.service';
import { SupabaseIndexationService } from './services/supabase-indexation.service';

// External modules
import { CacheModule } from '../../cache/cache.module';
import { DatabaseModule } from '../../database/database.module';

/**
 * 🔍 SearchModule - Moteur de recherche Enterprise v3.0
 * 
 * Architecture complète et optimisée pour FAFA AUTO :
 * ✅ 714K+ pages indexées avec Meilisearch
 * ✅ Recherche véhicules avancée multi-critères
 * ✅ Cache intelligent Redis avec TTL adaptatif
 * ✅ Analytics temps réel et suggestions IA
 * ✅ Auto-complétion intelligente
 * ✅ Filtres dynamiques et facettes
 * ✅ Recherche sémantique avec ML
 * ✅ API GraphQL et REST
 * ✅ Monitoring et métriques
 * ✅ Rate limiting et sécurité
 */
@Module({
  imports: [ConfigModule, CacheModule, DatabaseModule],
  controllers: [
    SearchController, 
    IndexationController, 
    PiecesController,
  ], // Contrôleurs de recherche et d'indexation
  providers: [
    // Core Services - v3.0 avec SearchOptimizedService prioritaire
    { provide: SearchService, useClass: SearchOptimizedService }, // 🎯 Service v3.0 optimisé
    SearchOptimizedService, // 🎯 Service v3.0 pour injection directe
    MeilisearchService, // 🔍 Service Meilisearch
    ProductSheetService, // 📄 Fiches produits et documentation
    VehicleSearchService, // 🚗 Service véhicules intégré

    // Specialized Services
    SearchCacheService, // 💾 Cache Redis intelligent avec ML
    DatabaseAnalysisService, // 🔍 Analyse de structure de base de données
    DatabaseTestService, // 🧪 Tests approches base de données
    VehicleNamingService, // 🚗 Construction noms véhicules complets
    PiecesAnalysisService, // 🔧 Analyse table pieces
    SearchAnalyticsService, // 📈 Analytics et métriques avancées
    SearchSuggestionService, // 🤖 Suggestions IA et auto-complétion
    SearchFilterService, // 🔧 Filtres dynamiques et facettes
    IndexationService, // 📊 Service d'indexation Supabase → Meilisearch
    SupabaseIndexationService, // 🗄️ Service récupération données Supabase
  ],
  exports: [
    SearchService,
    MeilisearchService,
    SearchAnalyticsService,
    SearchCacheService,
    SupabaseIndexationService, // Exporté pour BlogModule
  ],
})
export class SearchModule {}
