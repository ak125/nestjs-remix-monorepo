import { Injectable, Logger, Optional } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { ExternalCompatibilityScrapingService } from './external-compatibility-scraping.service';

import {
  ExternalVerificationResult,
  VehicleInfo,
  CACHE_TTL_CONFIG,
} from './external-compatibility.types';

/**
 * External Compatibility Cache Service
 *
 * Redis cache layer for external verification results.
 * Wraps scraping operations with TTL-based caching per source type.
 */
@Injectable()
export class ExternalCompatibilityCacheService {
  private readonly logger = new Logger(ExternalCompatibilityCacheService.name);

  constructor(
    @Optional() private readonly cacheService: CacheService | undefined,
    private readonly scrapingService: ExternalCompatibilityScrapingService,
  ) {}

  /**
   * Create a hash from vehicle info for cache key
   * Ensures consistent cache keys across requests
   */
  private hashVehicle(vehicleInfo: VehicleInfo): string {
    const normalized = [
      vehicleInfo.brand?.toLowerCase().replace(/\s+/g, '-') || '',
      vehicleInfo.model?.toLowerCase().replace(/\s+/g, '-') || '',
      vehicleInfo.year?.toString() || '',
      vehicleInfo.ktypnr?.toString() || '',
      vehicleInfo.engine_code?.toLowerCase() || '',
    ]
      .filter(Boolean)
      .join(':');

    // Simple hash for shorter keys
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Get cache TTL for a specific source
   */
  private getCacheTtl(source: string): number {
    const sourceLower = source.toLowerCase();

    // Check specific source TTLs
    if (sourceLower === 'tecdoc') {
      return CACHE_TTL_CONFIG['ext:tecdoc'];
    }
    if (sourceLower === 'partslink24') {
      return CACHE_TTL_CONFIG['ext:pl24'];
    }

    // Default scraping TTL
    return CACHE_TTL_CONFIG['ext:scrape'] || CACHE_TTL_CONFIG.default;
  }

  /**
   * Build cache key for external verification
   *
   * Key patterns:
   * - ext:scrape:{source}:{pieceRef}:{vehicleHash}
   */
  getCacheKey(
    source: string,
    pieceRef: string,
    vehicleInfo: VehicleInfo,
  ): string {
    const vehicleHash = this.hashVehicle(vehicleInfo);
    const sourceKey = source.toLowerCase();
    const normalizedRef = pieceRef.replace(/[\s\-]/g, '').toUpperCase();

    return `ext:scrape:${sourceKey}:${normalizedRef}:${vehicleHash}`;
  }

  /**
   * Scrape source with caching layer
   *
   * Phase 6: Caches external scraping results to:
   * - Reduce load on external sources
   * - Improve response times
   * - Respect rate limits
   */
  async scrapeSourceCached(
    source: string,
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    timeout: number,
    takeScreenshot: boolean,
    bypassCache = false,
  ): Promise<ExternalVerificationResult | null> {
    const cacheKey = this.getCacheKey(source, pieceRef, vehicleInfo);
    const ttl = this.getCacheTtl(source);

    // Try cache first (unless bypass requested)
    if (!bypassCache && this.cacheService) {
      try {
        const cached =
          await this.cacheService.get<ExternalVerificationResult>(cacheKey);
        if (cached) {
          this.logger.debug(`Cache HIT for ${source}: ${cacheKey}`);
          return {
            ...cached,
            // Mark as cached result
            timestamp: new Date().toISOString(),
          };
        }
        this.logger.debug(`Cache MISS for ${source}: ${cacheKey}`);
      } catch (error) {
        this.logger.warn(`Cache read error for ${cacheKey}: ${error.message}`);
      }
    }

    // Scrape from source
    const result = await this.scrapingService.scrapeSource(
      source,
      pieceRef,
      vehicleInfo,
      timeout,
      takeScreenshot,
    );

    // Cache successful results
    if (result && !result.error && this.cacheService) {
      try {
        // Don't cache screenshots to save space
        const toCache = { ...result };
        delete toCache.screenshot;

        await this.cacheService.set(cacheKey, toCache, ttl);
        this.logger.debug(`Cached ${source} result for ${ttl}s: ${cacheKey}`);
      } catch (error) {
        this.logger.warn(`Cache write error for ${cacheKey}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Clear cache for a specific piece/vehicle combination
   */
  async clearCacheForPiece(
    pieceRef: string,
    vehicleInfo?: VehicleInfo,
  ): Promise<number> {
    if (!this.cacheService) {
      return 0;
    }

    let pattern: string;
    if (vehicleInfo) {
      const vehicleHash = this.hashVehicle(vehicleInfo);
      const normalizedRef = pieceRef.replace(/[\s\-]/g, '').toUpperCase();
      pattern = `ext:scrape:*:${normalizedRef}:${vehicleHash}`;
    } else {
      const normalizedRef = pieceRef.replace(/[\s\-]/g, '').toUpperCase();
      pattern = `ext:scrape:*:${normalizedRef}:*`;
    }

    return await this.cacheService.clearByPattern(pattern);
  }

  /**
   * Clear all external verification cache
   */
  async clearAllExternalCache(): Promise<number> {
    if (!this.cacheService) {
      return 0;
    }

    return await this.cacheService.clearByPattern('ext:*');
  }
}
