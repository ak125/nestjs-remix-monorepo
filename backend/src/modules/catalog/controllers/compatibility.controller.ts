import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { z } from 'zod';
import {
  CompatibilityService,
  CompatibilityResult,
  VehicleSearchResult,
  CompatibilityStats,
} from '../services/compatibility.service';

/**
 * 🎯 COMPATIBILITY CONTROLLER V2
 * @description API endpoints for product-vehicle compatibility
 * @version 2.0.0
 * @pack Pack Confiance V2 - Killer Feature: Compatibilité Instantanée
 *
 * Endpoints:
 * - POST /api/compatibility/check - Check product-vehicle compatibility
 * - GET /api/vehicles/search/cnit/:cnit - Search vehicle by CNIT
 * - GET /api/vehicles/search/mine/:typeMine - Search vehicle by Type Mine
 * - GET /api/compatibility/stats/:productId - Get compatibility stats
 */

// ============================================================================
// Zod Schemas
// ============================================================================

const CheckCompatibilitySchema = z.object({
  productId: z.number().int().positive(),
  typeId: z.number().int().positive(),
});

type CheckCompatibilityDto = z.infer<typeof CheckCompatibilitySchema>;

// ============================================================================
// Controller
// ============================================================================

@Controller()
export class CompatibilityController {
  constructor(private readonly compatibilityService: CompatibilityService) {}

  /**
   * 🎯 POST /api/compatibility/check
   * @description Check if a product is compatible with a vehicle type
   *
   * @example
   * POST /api/compatibility/check
   * Body: { "productId": 12345, "typeId": 33302 }
   *
   * Response:
   * {
   *   "isCompatible": true,
   *   "confidenceScore": 100,
   *   "source": "direct",
   *   "vehicle": {
   *     "typeId": 33302,
   *     "typeName": "1.5 dCi 90ch",
   *     "brandName": "RENAULT",
   *     "modelName": "CLIO IV"
   *   }
   * }
   */
  @Post('api/compatibility/check')
  async checkCompatibility(
    @Body() body: CheckCompatibilityDto,
  ): Promise<CompatibilityResult> {
    // Validate input
    const parsed = CheckCompatibilitySchema.safeParse(body);
    if (!parsed.success) {
      return {
        isCompatible: false,
        confidenceScore: 0,
        source: 'error',
        error: 'Invalid input: productId and typeId must be positive integers',
      };
    }

    const { productId, typeId } = parsed.data;
    return this.compatibilityService.checkCompatibility(productId, typeId);
  }

  /**
   * 🔍 GET /api/vehicles/search/cnit/:cnit
   * @description Search vehicle by CNIT code (from vehicle registration card)
   *
   * @example
   * GET /api/vehicles/search/cnit/M10RENVP000N001
   *
   * Response:
   * {
   *   "found": true,
   *   "vehicle": {
   *     "typeId": 33302,
   *     "typeName": "1.5 dCi 90ch",
   *     "brandName": "RENAULT",
   *     "modelName": "CLIO IV",
   *     "cnit": "M10RENVP000N001"
   *   }
   * }
   */
  @Get('api/vehicles/search/cnit/:cnit')
  async searchByCnit(
    @Param('cnit') cnit: string,
  ): Promise<VehicleSearchResult> {
    if (!cnit || cnit.length < 3) {
      return { found: false, error: 'CNIT must be at least 3 characters' };
    }
    return this.compatibilityService.searchVehicleByCnit(cnit);
  }

  /**
   * 🔍 GET /api/vehicles/search/mine/:typeMine
   * @description Search vehicle by Type Mine code (from vehicle registration card)
   *
   * @example
   * GET /api/vehicles/search/mine/BW00RB
   *
   * Response:
   * {
   *   "found": true,
   *   "vehicle": {
   *     "typeId": 33302,
   *     "typeName": "1.5 dCi 90ch",
   *     "brandName": "RENAULT",
   *     "modelName": "CLIO IV",
   *     "typeMine": "BW00RB"
   *   }
   * }
   */
  @Get('api/vehicles/search/mine/:typeMine')
  async searchByTypeMine(
    @Param('typeMine') typeMine: string,
  ): Promise<VehicleSearchResult> {
    if (!typeMine || typeMine.length < 3) {
      return { found: false, error: 'Type Mine must be at least 3 characters' };
    }
    return this.compatibilityService.searchVehicleByTypeMine(typeMine);
  }

  /**
   * 📊 GET /api/compatibility/stats/:productId
   * @description Get compatibility stats for a product
   *
   * @example
   * GET /api/compatibility/stats/12345
   *
   * Response:
   * {
   *   "compatibleVehiclesCount": 150
   * }
   */
  @Get('api/compatibility/stats/:productId')
  async getCompatibilityStats(
    @Param('productId') productId: string,
  ): Promise<CompatibilityStats> {
    const id = parseInt(productId, 10);
    if (isNaN(id) || id <= 0) {
      return { compatibleVehiclesCount: 0, error: 'Invalid product ID' };
    }
    return this.compatibilityService.getCompatibilityStats(id);
  }
}
