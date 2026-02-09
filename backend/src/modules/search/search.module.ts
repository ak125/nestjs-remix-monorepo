import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { SearchController } from './controllers/search.controller';
import { SearchEnhancedExistingController } from './controllers/search-enhanced-existing.controller';
import { SearchDebugController } from './controllers/search-debug.controller';
import { PiecesController } from './controllers/pieces.controller';

// Core Services
import { MeilisearchService } from './services/meilisearch.service';
import { SearchMonitoringService } from './services/search-monitoring.service';

// Specialized Services
import { SearchCacheService } from './services/search-cache.service';
import { DatabaseAnalysisService } from './services/database-analysis.service';
import { VehicleNamingService } from './services/vehicle-naming.service';
import { PiecesAnalysisService } from './services/pieces-analysis.service';
import { SearchSuggestionService } from './services/search-suggestion.service';
import { SearchFilterService } from './services/search-filter.service';
import { IndexationService } from './services/indexation.service';
import { SupabaseIndexationService } from './services/supabase-indexation.service';
import { SearchEnhancedExistingService } from './services/search-enhanced-existing.service';
import { SearchSimpleService } from './services/search-simple.service';

// External modules
import { DatabaseModule } from '../../database/database.module';

/**
 * 🔍 SearchModule - Moteur de recherche clean
 *
 * Version simplifiée et fonctionnelle avec uniquement
 * les services et contrôleurs qui existent réellement.
 */
@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [
    SearchController, // ✅ Réactivé - utilise SearchSimpleService
    SearchEnhancedExistingController, // ✅ Fonctionnel - recherche avancée
    SearchDebugController,
    PiecesController,
  ],
  providers: [
    // Core Services
    MeilisearchService,
    SearchMonitoringService,

    // Specialized Services
    SearchCacheService,
    DatabaseAnalysisService,
    VehicleNamingService,
    PiecesAnalysisService,
    SearchSuggestionService,
    SearchFilterService,
    IndexationService,
    SupabaseIndexationService,
    SearchEnhancedExistingService,
    SearchSimpleService,
  ],
  exports: [
    MeilisearchService,
    SearchMonitoringService,
    SearchCacheService,
    SearchEnhancedExistingService,
    SupabaseIndexationService,
  ],
})
export class SearchModule {}
