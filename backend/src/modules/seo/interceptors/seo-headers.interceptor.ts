/**
 * 🛡️ INTERCEPTOR HEADERS SEO
 * Injection automatique headers SEO
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { SeoHeadersService } from '../services/seo-headers.service';
import { RobotsTxtService } from '../services/robots-txt.service';

@Injectable()
export class SeoHeadersInterceptor implements NestInterceptor {
  constructor(
    private readonly seoHeadersService: SeoHeadersService,
    private readonly robotsTxtService: RobotsTxtService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const path = request.url;

    // Déterminer type de page
    let headers = this.seoHeadersService.getDefaultHeaders();

    // API routes - ne pas indexer (sauf endpoints cacheables)
    if (path.startsWith('/api/')) {
      // 🚀 LCP Optimization: batch-loader GET doit être cacheable par le navigateur
      // Pattern: /api/catalog/batch-loader/{typeId}/{gammeId}
      const isCacheableBatchLoader = /^\/api\/catalog\/batch-loader\/\d+\/\d+/.test(path);

      if (isCacheableBatchLoader) {
        // Laisser le contrôleur définir ses propres headers Cache-Control
        headers = {
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Content-Type-Options': 'nosniff',
          // Cache-Control est défini par @Header() dans le contrôleur
        };
      } else {
        headers = this.seoHeadersService.getApiHeaders();
      }
    }
    // Routes privées
    else if (
      path.startsWith('/admin/') ||
      path.startsWith('/compte/') ||
      path.startsWith('/checkout/')
    ) {
      headers = this.seoHeadersService.getNoIndexHeaders();
    }
    // Produits
    else if (path.startsWith('/pieces/') || path.startsWith('/produits/')) {
      const canonical = `https://www.automecanik.com${path.split('?')[0]}`;
      headers = this.seoHeadersService.getProductHeaders(canonical);
    }
    // Blog
    else if (path.startsWith('/blog/') || path.startsWith('/conseils/')) {
      const canonical = `https://www.automecanik.com${path.split('?')[0]}`;
      headers = this.seoHeadersService.getBlogHeaders(canonical);
    }
    // Vérifier si doit être indexé
    else if (!this.robotsTxtService.shouldIndex(path)) {
      headers = this.seoHeadersService.getNoIndexHeaders();
    }

    // Appliquer headers
    Object.entries(headers).forEach(([key, value]) => {
      if (value) {
        response.setHeader(key, value);
      }
    });

    return next.handle().pipe(
      map((data) => {
        return data;
      }),
    );
  }
}
