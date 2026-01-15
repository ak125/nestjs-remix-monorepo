import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RmBuilderService } from './services/rm-builder.service';
import { RmController } from './controllers/rm.controller';

/**
 * 🏗️ RM (Read Model) Module
 *
 * Module for accessing pre-computed product listings.
 *
 * Features:
 * - Get products with quality scoring (OE/EQUIV/ECO)
 * - Get stock status (IN_STOCK/LOW_STOCK/OUT_OF_STOCK/PREORDER)
 * - Access cached listings from rm_listing table
 * - Health and stats endpoints
 *
 * Endpoints:
 * - GET /api/rm/products - Fetch scored products
 * - GET /api/rm/listing - Get cached listing page
 * - GET /api/rm/listing/metadata - Get listing metadata
 * - GET /api/rm/listing/ready - Check if listing is ready
 * - GET /api/rm/health - System health
 * - GET /api/rm/stats - Listing statistics
 *
 * Dependencies:
 * - DatabaseModule (SupabaseBaseService)
 *
 * PostgreSQL RPCs used:
 * - get_listing_products_for_build
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
