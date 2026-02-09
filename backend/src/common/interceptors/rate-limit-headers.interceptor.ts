import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  RATE_LIMIT_KEY,
  RateLimitConfig,
} from '../decorators/rate-limit.decorator';
import { Response } from 'express';

/**
 * Interceptor that adds standard rate limit headers to HTTP responses
 *
 * Headers added:
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests remaining in current window
 * - X-RateLimit-Reset: Unix timestamp when the rate limit resets
 * - X-RateLimit-Policy: Human-readable policy description
 *
 * These headers follow the IETF draft standard for rate limiting headers
 * @see https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 */
@Injectable()
export class RateLimitHeadersInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rateLimitConfig = this.reflector.getAllAndOverride<RateLimitConfig>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no custom rate limit is set, use default medium tier
    const config = rateLimitConfig || { limit: 100, ttl: 60, name: 'default' };

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();

        // Calculate reset time (current time + ttl)
        const resetTime = Math.floor(Date.now() / 1000) + config.ttl;

        // Add standard rate limit headers
        response.setHeader('X-RateLimit-Limit', config.limit.toString());
        response.setHeader(
          'X-RateLimit-Policy',
          `${config.limit};w=${config.ttl}`,
        );
        response.setHeader('X-RateLimit-Reset', resetTime.toString());

        // Note: X-RateLimit-Remaining would require Redis integration
        // to track per-IP counters. ThrottlerModule handles this internally
        // but doesn't expose the remaining count easily.
        // For now, we set a placeholder that indicates the limit exists.
        response.setHeader('X-RateLimit-Remaining', '-'); // Managed by ThrottlerGuard
      }),
    );
  }
}
