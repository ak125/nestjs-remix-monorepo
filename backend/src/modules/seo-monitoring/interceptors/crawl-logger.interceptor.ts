import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { GooglebotDetectorService } from '../../seo/services/googlebot-detector.service';

@Injectable()
export class CrawlLoggerInterceptor implements NestInterceptor {
  constructor(private readonly googlebotDetector: GooglebotDetectorService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const userAgent = (req.headers['user-agent'] as string) || '';

    // Only log bot requests (skip human traffic)
    if (!this.googlebotDetector.isBot(userAgent)) {
      return next.handle();
    }

    // Skip static assets and health checks
    const path = req.path;
    if (
      path === '/health' ||
      path.startsWith('/build/') ||
      path.startsWith('/assets/') ||
      path === '/favicon.ico'
    ) {
      return next.handle();
    }

    const startTime = Date.now();
    const botInfo = this.googlebotDetector.detectGooglebot(userAgent);

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.googlebotDetector
            .logCrawl({
              url: req.originalUrl || req.url,
              userAgent,
              botName: botInfo.botName,
              isGooglebot: botInfo.isGooglebot,
              statusCode: res.statusCode,
              responseMs: Date.now() - startTime,
              contentType: res.getHeader('content-type') as string,
              referer: req.headers['referer'] as string,
              requestMethod: req.method,
            })
            .catch(() => {});
        },
        error: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.googlebotDetector
            .logCrawl({
              url: req.originalUrl || req.url,
              userAgent,
              botName: botInfo.botName,
              isGooglebot: botInfo.isGooglebot,
              statusCode: res.statusCode || 500,
              responseMs: Date.now() - startTime,
              contentType: res.getHeader('content-type') as string,
              referer: req.headers['referer'] as string,
              requestMethod: req.method,
            })
            .catch(() => {});
        },
      }),
    );
  }
}
