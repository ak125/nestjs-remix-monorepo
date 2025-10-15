import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { SearchController } from './controllers/search.controller';
import { SearchEnhancedController } from './controllers/search-enhanced.controller';
import { SearchEnhancedExistingController } from './controllers/search-enhanced-existing.controller';
import { SearchDebugController } from './controllers/search-debug.controller';
import { IndexationController } from './controllers/indexation.controller';
import { PiecesController } from './controllers/pieces.controller';

// Core Services
import { SearchService } from './services/search.service';
import { MeilisearchService } from './services/meilisearch.service';
import { ProductSheetService } from './services/product-sheet.service';
import { VehicleSearchService } from './services/vehicle-search.service';
import { SearchMonitoringService } from './services/search-monitoring.service';

// Specialized Services
import { SearchCacheService } from './services/search-cache.service';
import { SearchAnalyticsService } from './services/search-analytics.service';
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
import { CacheModule } from '../../cache/cache.module';
import { DatabaseModule } from '../../database/database.module';

/**
 * 🔍 SearchModule - Moteur de recherche clean
 * 
 * Version simplifiée et fonctionnelle avec uniquement
 * les services et contrôleurs qui existent réellement.
 */
@Module({
  imports: [ConfigModule, CacheModule, DatabaseModule],
  controllers: [
    SearchController,
    SearchEnhancedController,
    SearchEnhancedExistingController,
    SearchDebugController,
    IndexationController,
    PiecesController,
  ],
  providers: [
    // Core Services
    SearchService,
    MeilisearchService,
    ProductSheetService,
    VehicleSearchService,
    SearchMonitoringService,
    
    // Specialized Services
    SearchCacheService,
    SearchAnalyticsService,
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
    SearchService,
    MeilisearchService,
    SearchAnalyticsService,
    SearchCacheService,
    SupabaseIndexationService,
  ],
})
export class SearchModule {}
