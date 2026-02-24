import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

/**
 * Interceptor that wraps admin controller responses in the standard
 * AdminApiResponse<T> shape: { success, data, meta: { timestamp } }
 *
 * - If the response already has a `success` boolean property, it is
 *   passed through as-is (to avoid double-wrapping).
 * - Otherwise, the raw response is wrapped as `data`.
 * - Adds X-Data-Timestamp header on every response.
 */
@Injectable()
export class AdminResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = new Date().toISOString();

    return next.handle().pipe(
      map((responseBody) => {
        const response = context.switchToHttp().getResponse<Response>();
        response.setHeader('X-Data-Timestamp', now);

        // Already wrapped — pass through
        if (
          responseBody &&
          typeof responseBody === 'object' &&
          'success' in responseBody &&
          typeof (responseBody as Record<string, unknown>).success === 'boolean'
        ) {
          const existing = responseBody as Record<string, unknown>;
          // Ensure meta.timestamp exists even on pre-wrapped responses
          if (!existing.meta) {
            existing.meta = { timestamp: now };
          } else if (
            typeof existing.meta === 'object' &&
            !(existing.meta as Record<string, unknown>).timestamp
          ) {
            (existing.meta as Record<string, unknown>).timestamp = now;
          }
          return existing;
        }

        // Wrap raw response
        return {
          success: true,
          data: responseBody,
          meta: {
            timestamp: now,
          },
        };
      }),
    );
  }
}
