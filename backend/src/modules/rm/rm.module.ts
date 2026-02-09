import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RmBuilderService } from './services/rm-builder.service';
import { RmController } from './controllers/rm.controller';

/**
 * 🏗️ RM (Read Model) Module - CQRS Read Model for Product Listings
 *
 * Module for accessing pre-computed product listings.
 * Part of CQRS architecture pattern separating Read from Write operations.
 *
 * Features:
 * - Get products with quality scoring (OE/EQUIV/ECO)
 * - Get stock status (IN_STOCK/LOW_STOCK/OUT_OF_STOCK/PREORDER)
 * - Access cached listings from rm_listing table
 * - Redis caching for performance (~50ms cache hit vs ~400ms RPC)
 * - Complete page data with SEO, OEM refs, cross-selling
 * - Health and stats endpoints
 *
 * Endpoints:
 * - GET /api/rm/products - Fetch scored products
 * - GET /api/rm/page - Get complete page data (v1)
 * - GET /api/rm/page-v2 - Get complete page data with ALL features (v2)
 * - GET /api/rm/listing - Get cached listing page
 * - GET /api/rm/listing/metadata - Get listing metadata
 * - GET /api/rm/listing/ready - Check if listing is ready
 * - GET /api/rm/health - System health
 * - GET /api/rm/stats - Listing statistics
 *
 * Dependencies:
 * - DatabaseModule (SupabaseBaseService)
 * - CacheModule (Redis caching)
 *
 * PostgreSQL RPCs used:
 * - get_listing_products_for_build
 * - rm_get_page_complete (v1)
 * - rm_get_page_complete_v2 (v2 with SEO, OEM, cross-selling)
 * - rm_get_listing_page
 * - rm_health
 */
@Module({
  imports: [DatabaseModule],
  providers: [RmBuilderService],
  controllers: [RmController],
  exports: [RmBuilderService],
})
export class RmModule {}
