import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * Metadata key for rate limit configuration
 */
export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in seconds */
  ttl: number;
  /** Optional name for this rate limit */
  name?: string;
  /** Skip rate limiting for admin users */
  skipAdmin?: boolean;
}

/**
 * Custom rate limit decorator with intuitive API
 *
 * @param limit - Maximum requests allowed in the time window
 * @param ttlSeconds - Time window in seconds (default: 60)
 * @param options - Additional options
 *
 * @example
 * ```typescript
 * // 10 requests per minute
 * @RateLimit(10, 60)
 * @Get('/heavy-endpoint')
 * async heavyOperation() { ... }
 *
 * // 5 requests per 10 seconds, skip for admins
 * @RateLimit(5, 10, { skipAdmin: true })
 * @Get('/api-intensive')
 * async apiIntensive() { ... }
 * ```
 */
export function RateLimit(
  limit: number,
  ttlSeconds = 60,
  options?: Partial<RateLimitConfig>,
) {
  const config: RateLimitConfig = {
    limit,
    ttl: ttlSeconds,
    name: options?.name || 'custom',
    skipAdmin: options?.skipAdmin ?? false,
  };

  return applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, config),
    Throttle({
      [config.name || 'custom']: {
        ttl: ttlSeconds * 1000, // Convert to milliseconds for Throttler
        limit,
      },
    }),
  );
}

/**
 * Strict rate limit for expensive operations
 * 5 requests per minute
 */
export function RateLimitStrict() {
  return RateLimit(5, 60, { name: 'strict' });
}

/**
 * Moderate rate limit for standard API endpoints
 * 30 requests per minute
 */
export function RateLimitModerate() {
  return RateLimit(30, 60, { name: 'moderate' });
}

/**
 * Relaxed rate limit for lightweight endpoints
 * 100 requests per minute
 */
export function RateLimitRelaxed() {
  return RateLimit(100, 60, { name: 'relaxed' });
}

/**
 * Sitemap-specific rate limit
 * 3 requests per minute (sitemaps are heavy)
 */
export function RateLimitSitemap() {
  return RateLimit(3, 60, { name: 'sitemap' });
}

/**
 * Search-specific rate limit
 * 20 requests per minute
 */
export function RateLimitSearch() {
  return RateLimit(20, 60, { name: 'search' });
}

/**
 * Skip rate limiting entirely (use with caution)
 * Alias for @SkipThrottle()
 */
export { SkipThrottle as NoRateLimit };
