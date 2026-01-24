/**
 * 🎯 INTERCEPTOR VALIDATION RÔLES DE PAGES SEO
 *
 * Phase B: Enforcement Pipeline
 * Valide chaque page HTML contre les règles de son rôle.
 *
 * Mode: Monitoring (logs violations, ne bloque pas)
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import {
  PageRoleValidatorService,
  PageValidationResult,
} from '../services/page-role-validator.service';
import { getPageRoleFromUrl, PAGE_ROLE_META } from '../types/page-role.types';

/**
 * Extensions de fichiers à ignorer (assets)
 */
const ASSET_EXTENSIONS = [
  'js',
  'css',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'map',
  'json',
  'xml',
];

/**
 * Préfixes de routes à ignorer
 */
const IGNORED_PREFIXES = [
  '/api/',
  '/_',
  '/admin/',
  '/commercial/',
  '/health',
  '/metrics',
  '/favicon',
  '/robots.txt',
  '/sitemap',
];

@Injectable()
export class PageRoleValidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PageRoleValidationInterceptor.name);

  constructor(private readonly pageRoleValidator: PageRoleValidatorService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const path = request.url.split('?')[0]; // Sans query params

    // Ne valider que les pages HTML publiques
    if (!this.shouldValidate(path)) {
      return next.handle();
    }

    const detectedRole = getPageRoleFromUrl(path);

    return next.handle().pipe(
      tap((data) => {
        // Valider uniquement si c'est du HTML
        if (typeof data === 'string' && this.isHtmlResponse(data)) {
          this.validateAsync(path, data, detectedRole);
        }
      }),
    );
  }

  /**
   * Détermine si une route doit être validée
   */
  private shouldValidate(path: string): boolean {
    // Ignorer les préfixes connus
    for (const prefix of IGNORED_PREFIXES) {
      if (path.startsWith(prefix)) {
        return false;
      }
    }

    // Ignorer les assets (fichiers avec extension)
    if (path.includes('.')) {
      const ext = path.split('.').pop()?.toLowerCase();
      if (ext && ASSET_EXTENSIONS.includes(ext)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Vérifie si la réponse est du HTML
   */
  private isHtmlResponse(data: string): boolean {
    return (
      data.includes('<!DOCTYPE html>') ||
      data.includes('<!doctype html>') ||
      data.trimStart().startsWith('<html')
    );
  }

  /**
   * Validation asynchrone (ne bloque pas la réponse)
   */
  private async validateAsync(
    url: string,
    html: string,
    detectedRole: ReturnType<typeof getPageRoleFromUrl>,
  ): Promise<void> {
    try {
      const textContent = this.extractTextContent(html);
      const result = this.pageRoleValidator.validatePageWithHtml(
        url,
        textContent,
        html,
        detectedRole || undefined,
      );

      // Logger les résultats
      this.logValidationResult(url, result);
    } catch (error) {
      this.logger.error(
        `❌ Validation error for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extrait le texte visible d'une page HTML
   * (Version simple sans cheerio pour éviter les dépendances)
   */
  private extractTextContent(html: string): string {
    return (
      html
        // Supprimer les scripts
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        // Supprimer les styles
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Supprimer les commentaires HTML
        .replace(/<!--[\s\S]*?-->/g, '')
        // Supprimer les balises
        .replace(/<[^>]+>/g, ' ')
        // Normaliser les espaces
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * Log les résultats de validation
   */
  private logValidationResult(url: string, result: PageValidationResult): void {
    const roleLabel = result.detectedRole
      ? PAGE_ROLE_META[result.detectedRole]?.label || result.detectedRole
      : 'UNKNOWN';

    const errors = result.violations.filter((v) => v.severity === 'error');
    const warnings = result.violations.filter((v) => v.severity === 'warning');

    // Log les erreurs (toujours)
    if (errors.length > 0) {
      this.logger.warn(
        `🚨 [${roleLabel}] ${url} - ${errors.length} error(s): ${errors
          .map((e) => e.message)
          .join(' | ')}`,
      );
    }

    // Log les warnings (en debug uniquement)
    if (warnings.length > 0) {
      this.logger.debug(
        `⚠️ [${roleLabel}] ${url} - ${warnings.length} warning(s): ${warnings
          .map((w) => w.message)
          .join(' | ')}`,
      );
    }

    // Log succès (verbose)
    if (errors.length === 0 && warnings.length === 0) {
      this.logger.verbose(`✅ [${roleLabel}] ${url} - Valid`);
    }
  }
}
