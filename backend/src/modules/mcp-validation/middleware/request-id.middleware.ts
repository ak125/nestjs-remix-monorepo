import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Request ID Middleware
 *
 * Generates a unique request ID for each request.
 * - Uses X-Request-ID header if provided (for distributed tracing)
 * - Generates UUID v4 otherwise
 * - Attaches to req.requestId and response header
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use existing X-Request-ID header or generate new one
    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      uuidv4();

    // Attach to request object
    req.requestId = requestId;

    // Set response header for tracing
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
