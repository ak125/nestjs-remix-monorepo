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
import { Request, Response } from 'express';
import { SeoHeadersService } from '../infrastructure/seo-headers.service';
import { RobotsTxtService } from '../infrastructure/robots-txt.service';
import { SITE_ORIGIN } from '../../../config/app.config';

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
    const path = request.path || request.url.split('?')[0];

    // Déterminer type de page
    let headers = this.seoHeadersService.getDefaultHeaders();

    // API routes - ne pas indexer
    if (path.startsWith('/api/')) {
      headers = this.seoHeadersService.getApiHeaders();
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
    else if (
      path === '/pieces' ||
      path.startsWith('/pieces/') ||
      path.startsWith('/produits/')
    ) {
      const canonical = `${SITE_ORIGIN}${path.split('?')[0]}`;
      headers = this.seoHeadersService.getProductHeaders(canonical);
      // Les routes Remix /pieces gèrent elles-mêmes robots + canonical (incluant 404/410).
      // Évite les headers contradictoires (double X-Robots-Tag, canonical sur erreur).
      delete headers['X-Robots-Tag'];
      delete headers.Link;
    }
    // Pages véhicule R8 (/constructeurs/...) : la route Remix possède robots via <meta>
    // (succès = data.seo.robots, erreur = noindex). On supprime le X-Robots-Tag par défaut
    // pour ne JAMAIS servir `index, follow` sur un 404/410/503 (cause GSC "Erreur serveur 5xx").
    else if (path.startsWith('/constructeurs/')) {
      delete headers['X-Robots-Tag'];
    }
    // Blog
    else if (path.startsWith('/blog/') || path.startsWith('/conseils/')) {
      const canonical = `${SITE_ORIGIN}${path.split('?')[0]}`;
      headers = this.seoHeadersService.getBlogHeaders(canonical);
    }
    // Vérifier si doit être indexé
    else if (!this.robotsTxtService.shouldIndex(path)) {
      headers = this.seoHeadersService.getNoIndexHeaders();
    }
    // Fallthrough = route document générique indexable (home, pages statiques) OU
    // un 404/410 servi par le catch-all Remix ($.tsx). `index, follow` est le défaut
    // implicite de Google quand aucun X-Robots-Tag n'est présent : l'affirmer via
    // header est redondant sur un succès et NUISIBLE sur une erreur (il fuyait sur
    // les 404/410 du catch-all, contredisant le `noindex` throw de la route — cf.
    // catch-all-404-noindex.test.ts). On laisse la route Remix posséder robots via
    // <meta> / `headers`. Les autres headers par défaut (Vary, Referrer-Policy,
    // X-Content-Type-Options) restent appliqués.
    else {
      delete headers['X-Robots-Tag'];
    }

    // Appliquer headers globaux (n'écrase pas les headers explicites définis ensuite)
    Object.entries(headers).forEach(([key, value]) => {
      if (value) {
        response.setHeader(key, value);
      }
    });

    return next.handle();
  }
}
