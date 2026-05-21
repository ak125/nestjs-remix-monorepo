import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  OperationFailedException,
  DomainNotFoundException,
} from '@common/exceptions';
import { RmBuilderService } from '../services/rm-builder.service';
import { RmAlternativesService } from '../services/rm-alternatives.service';
import { RmSoft404TrackerService } from '../services/rm-soft404-tracker.service';
import { TrackSoft404BodySchema } from '../dto/alternatives-v2.dto';
import { classifyPageV2Result } from '../utils/page-v2-response';

/**
 * 🏗️ RM Controller
 *
 * API endpoints for Read Model listing access.
 *
 * Endpoints:
 * - GET /api/rm/products - Get products for gamme+vehicle
 * - GET /api/rm/listing - Get cached listing page
 * - GET /api/rm/health - Get RM system health
 * - GET /api/rm/stats - Get listing statistics
 */
@Controller('api/rm')
export class RmController {
  private readonly logger = new Logger(RmController.name);

  constructor(
    private readonly rmBuilder: RmBuilderService,
    private readonly rmAlternatives: RmAlternativesService,
    private readonly rmTracker: RmSoft404TrackerService,
  ) {}

  /**
   * 📦 GET /api/rm/products
   *
   * Fetches products for a gamme+vehicle pair with scoring.
   *
   * @param gamme_id - Product family ID (required)
   * @param vehicle_id - Vehicle type ID (required)
   * @param limit - Max products to return (default: 500, max: 1000)
   *
   * @example
   * GET /api/rm/products?gamme_id=273&vehicle_id=7765&limit=50
   */
  @Get('products')
  async getProducts(
    @Query('gamme_id', ParseIntPipe) gamme_id: number,
    @Query('vehicle_id', ParseIntPipe) vehicle_id: number,
    @Query('limit', new DefaultValuePipe(500), ParseIntPipe) limit: number,
  ) {
    // Clamp limit to valid range
    const clampedLimit = Math.min(Math.max(limit, 1), 1000);

    const result = await this.rmBuilder.getProducts({
      gamme_id,
      vehicle_id,
      limit: clampedLimit,
    });

    if (!result.success) {
      throw new OperationFailedException({
        message: `Failed to fetch products for gamme_id=${gamme_id}, vehicle_id=${vehicle_id}`,
      });
    }

    return result;
  }

  /**
   * 🚀 GET /api/rm/page
   *
   * Returns complete page data in a single call (~350ms).
   * Replaces batch-loader for product listing pages.
   *
   * @param gamme_id - Product family ID (required)
   * @param vehicle_id - Vehicle type ID (required)
   * @param limit - Max products to return (default: 200, max: 500)
   *
   * @example
   * GET /api/rm/page?gamme_id=2066&vehicle_id=17484&limit=200
   */
  @Get('page')
  async getPage(
    @Query('gamme_id', ParseIntPipe) gamme_id: number,
    @Query('vehicle_id', ParseIntPipe) vehicle_id: number,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number,
  ) {
    const startTime = performance.now();
    const clampedLimit = Math.min(Math.max(limit, 1), 500);

    const result = await this.rmBuilder.getPageComplete({
      gamme_id,
      vehicle_id,
      limit: clampedLimit,
    });

    // Add server-side timing if RPC returned 0
    if (result.success && result.duration_ms === 0) {
      result.duration_ms = Math.round(performance.now() - startTime);
    }

    if (!result.success) {
      throw new OperationFailedException({
        message: `Failed to fetch page data for gamme_id=${gamme_id}, vehicle_id=${vehicle_id}`,
      });
    }

    return result;
  }

  /**
   * 🚀 GET /api/rm/page-v2
   *
   * V2: Returns complete page data with ALL features in a single call (~400ms).
   * Combines best of batch-loader and RM:
   * - Products with RM scoring (OE/EQUIV/ECO, stock status)
   * - Grouped pieces with OEM refs per group
   * - Complete vehicle info (motor/mine/cnit codes)
   * - Fully processed SEO (all switches resolved)
   * - Cross-selling gammes
   * - Filters with counts
   * - Validation/data quality metrics
   *
   * @param gamme_id - Product family ID (required)
   * @param vehicle_id - Vehicle type ID (required)
   * @param limit - Max products to return (default: 200, max: 500)
   *
   * @example
   * GET /api/rm/page-v2?gamme_id=402&vehicle_id=100413&limit=200
   */
  @Get('page-v2')
  async getPageV2(
    @Query('gamme_id', ParseIntPipe) gamme_id: number,
    @Query('vehicle_id', ParseIntPipe) vehicle_id: number,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number,
  ) {
    const startTime = performance.now();
    const clampedLimit = Math.min(Math.max(limit, 1), 500);

    const result = await this.rmBuilder.getPageCompleteV2({
      gamme_id,
      vehicle_id,
      limit: clampedLimit,
    });

    // Add server-side timing if RPC returned 0
    if (result.success && result.duration_ms === 0) {
      result.duration_ms = Math.round(performance.now() - startTime);
    }

    switch (classifyPageV2Result(result)) {
      case 'error': // real RPC/infra failure → 503 so crawlers retry
        this.logger.error(
          `page-v2 RPC failure gamme_id=${gamme_id} vehicle_id=${vehicle_id}`,
        );
        throw new ServiceUnavailableException({
          message: `Upstream data temporarily unavailable for gamme_id=${gamme_id}, vehicle_id=${vehicle_id}`,
        });
      case 'empty': // valid combo, 0 products → 200; loader renders soft-404
        this.logger.debug(
          `page-v2 empty combo gamme_id=${gamme_id} vehicle_id=${vehicle_id} -> soft-404`,
        );
        return result;
      default:
        return result;
    }
  }

  /**
   * 📄 GET /api/rm/listing
   *
   * Retrieves a cached listing page from rm_get_listing_page RPC.
   *
   * @param gamme_id - Product family ID (required)
   * @param vehicle_id - Vehicle type ID (required)
   *
   * @example
   * GET /api/rm/listing?gamme_id=273&vehicle_id=7765
   */
  @Get('listing')
  async getListing(
    @Query('gamme_id', ParseIntPipe) gamme_id: number,
    @Query('vehicle_id', ParseIntPipe) vehicle_id: number,
  ) {
    const result = await this.rmBuilder.getListingPage({
      gamme_id,
      vehicle_id,
    });

    if (!result.success) {
      throw new DomainNotFoundException({
        message: `Listing not found for gamme_id=${gamme_id}, vehicle_id=${vehicle_id}`,
      });
    }

    return result;
  }

  /**
   * 🔍 GET /api/rm/listing/metadata
   *
   * Retrieves listing metadata from rm_listing table.
   *
   * @param gamme_id - Product family ID (required)
   * @param vehicle_id - Vehicle type ID (required)
   *
   * @example
   * GET /api/rm/listing/metadata?gamme_id=273&vehicle_id=7765
   */
  @Get('listing/metadata')
  async getListingMetadata(
    @Query('gamme_id', ParseIntPipe) gamme_id: number,
    @Query('vehicle_id', ParseIntPipe) vehicle_id: number,
  ) {
    const listing = await this.rmBuilder.getListing(gamme_id, vehicle_id);

    if (!listing) {
      throw new DomainNotFoundException({
        message: `Listing not found for gamme_id=${gamme_id}, vehicle_id=${vehicle_id}`,
      });
    }

    return {
      success: true,
      gamme_id,
      vehicle_id,
      listing,
    };
  }

  /**
   * ✅ GET /api/rm/listing/ready
   *
   * Checks if a listing exists and is ready to serve.
   *
   * @param gamme_id - Product family ID (required)
   * @param vehicle_id - Vehicle type ID (required)
   *
   * @example
   * GET /api/rm/listing/ready?gamme_id=273&vehicle_id=7765
   */
  @Get('listing/ready')
  async isListingReady(
    @Query('gamme_id', ParseIntPipe) gamme_id: number,
    @Query('vehicle_id', ParseIntPipe) vehicle_id: number,
  ) {
    const ready = await this.rmBuilder.isListingReady(gamme_id, vehicle_id);

    return {
      success: true,
      gamme_id,
      vehicle_id,
      ready,
    };
  }

  /**
   * 🔄 GET /api/rm/alternatives
   *
   * Returns alternative gammes for a vehicle and alternative vehicles for a gamme.
   * Used when a gamme+vehicle combination has 0 products.
   *
   * @param gamme_id - Product family ID to exclude / find alternatives for
   * @param type_id - Vehicle type ID to exclude / find alternatives for
   * @param limit - Max results per category (default: 12)
   *
   * @example
   * GET /api/rm/alternatives?gamme_id=620&type_id=500&limit=12
   */
  @Get('alternatives')
  async getAlternatives(
    @Query('gamme_id', ParseIntPipe) gamme_id: number,
    @Query('type_id', ParseIntPipe) type_id: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ) {
    try {
      const clampedLimit = Math.min(Math.max(limit, 1), 24);
      return await this.rmAlternatives.compute(type_id, gamme_id, clampedLimit);
    } catch (err) {
      this.logger.warn(
        `Alternatives v2 endpoint error gamme=${gamme_id} type=${type_id}: ${err instanceof Error ? err.message : err}`,
      );
      return {
        success: true,
        version: 'v2',
        etag: 'sha256-empty',
        alternativeVehicles: [],
        alternativeGammes: [],
        relatedModels: [],
      };
    }
  }

  /**
   * 📡 POST /api/rm/alternatives/track-soft-404
   *
   * Append-only beacon for soft-404 tracking.
   * Fire-and-forget, returns 204 No Content.
   * Invalid bodies are silently rejected.
   */
  @Post('alternatives/track-soft-404')
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackSoft404(
    @Body() body: unknown,
    @Req() req: Request,
    @Headers('user-agent') ua: string | undefined,
    @Headers('referer') referer: string | undefined,
  ): Promise<void> {
    const parsed = TrackSoft404BodySchema.safeParse(body);
    if (!parsed.success) return; // fire-and-forget : silent reject on invalid body

    const sessionId = (req as any)?.session?.id ?? null;
    await this.rmTracker.track(
      parsed.data as { pg_id: number; type_id: number },
      {
        sessionId,
        ua: ua ?? null,
        referrer: referer ?? null,
      },
    );
  }

  /**
   * 📈 GET /api/rm/health
   *
   * Returns RM system health status.
   *
   * @example
   * GET /api/rm/health
   */
  @Get('health')
  async getHealth() {
    const health = await this.rmBuilder.getHealth();

    return {
      success: true,
      ...health,
    };
  }

  /**
   * 📊 GET /api/rm/stats
   *
   * Returns listing statistics by build status.
   *
   * @example
   * GET /api/rm/stats
   */
  @Get('stats')
  async getStats() {
    const stats = await this.rmBuilder.getStats();

    return {
      success: true,
      ...stats,
    };
  }
}
