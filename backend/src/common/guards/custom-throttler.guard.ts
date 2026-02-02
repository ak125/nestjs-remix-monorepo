import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  RateLimitConfig,
} from '../decorators/rate-limit.decorator';

/**
 * Custom throttler guard that:
 * 1. Skips rate limiting for admin users (level >= 7)
 * 2. Adds rate limit info to response headers
 * 3. Provides custom error messages
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly customLogger = new Logger(CustomThrottlerGuard.name);

  constructor(
    options: any,
    storageService: any,
    private readonly customReflector: Reflector,
  ) {
    super(options, storageService, customReflector);
  }

  /**
   * Check if request should skip rate limiting
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Skip for admin users (level >= 7)
    if (user?.isAdmin === true || parseInt(user?.level) >= 7) {
      this.customLogger.debug(
        `Rate limit skipped for admin user: ${user?.email}`,
      );
      return true;
    }

    // Check if endpoint has skipAdmin: true in RateLimit decorator
    const rateLimitConfig =
      this.customReflector.getAllAndOverride<RateLimitConfig>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (rateLimitConfig?.skipAdmin && user) {
      this.customLogger.debug(
        `Rate limit skipped for authenticated user: ${user?.email}`,
      );
      return true;
    }

    return false;
  }

  /**
   * Custom error response when rate limit is exceeded
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const ip = request.ip || request.connection?.remoteAddress;

    // Add retry-after header
    const retryAfter = Math.ceil(throttlerLimitDetail.timeToExpire / 1000);
    response.setHeader('Retry-After', retryAfter.toString());
    response.setHeader(
      'X-RateLimit-Limit',
      throttlerLimitDetail.limit.toString(),
    );
    response.setHeader('X-RateLimit-Remaining', '0');
    response.setHeader(
      'X-RateLimit-Reset',
      Math.floor(
        (Date.now() + throttlerLimitDetail.timeToExpire) / 1000,
      ).toString(),
    );

    this.customLogger.warn(
      `Rate limit exceeded for IP ${ip} on ${request.url}. ` +
        `Limit: ${throttlerLimitDetail.limit}, TTL: ${throttlerLimitDetail.ttl}ms`,
    );

    throw new ThrottlerException(
      `Trop de requêtes. Réessayez dans ${retryAfter} secondes.`,
    );
  }

  /**
   * Get tracker key (IP address by default)
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use X-Forwarded-For if behind proxy (Caddy), otherwise use IP
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // Take first IP from comma-separated list
      return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }
}
