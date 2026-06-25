import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import { Request, Response } from 'express';
import { ErrorService } from '../services/error.service';
import { DomainException } from '@common/exceptions';
import { RedirectException } from '../../../auth/redirected-error.exception';

/**
 * Libellés FR par code HTTP pour la page d'erreur générique servie aux
 * navigateurs/crawlers (429, 5xx et autres 4xx non spécialisés). Miroir
 * volontairement minimal de `getStatusDescription()` côté frontend
 * (`frontend/app/components/errors/ErrorGeneric.tsx`) — le rendu Remix reste la
 * surface riche ; ceci est le repli serveur lorsqu'un throttler (429) ou une
 * 5xx court-circuite avant que Remix ne rende. 404/410/412/451 sont traités
 * en amont (handlers dédiés) et n'atteignent jamais ce chemin.
 */
const GENERIC_ERROR_LABELS_FR: Record<number, string> = {
  400: 'Requête incorrecte',
  401: 'Non autorisé',
  403: 'Accès interdit',
  405: 'Méthode non autorisée',
  408: "Délai d'attente dépassé",
  422: 'Entité non traitable',
  429: 'Trop de requêtes',
  500: 'Erreur serveur interne',
  502: 'Passerelle incorrecte',
  503: 'Service indisponible',
  504: "Délai d'attente de la passerelle",
};

/** Retry-After (secondes) pour les statuts où il a un sens sémantique. */
const RETRY_AFTER_SECONDS: Record<number, number> = {
  429: 60, // throttler: fenêtre `medium` = 60s (app.module.ts)
  503: 120,
};

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalErrorFilter.name);

  constructor(private readonly errorService: ErrorService) {}

  // @SentryExceptionCaptured forwards every caught exception to Sentry BEFORE
  // the handler logic below runs. Filtering of expected client-side noise
  // (e.g. raw-body `request aborted` from TCP cuts on tracking beacons) is
  // applied in the `beforeSend` hook exported from `instrument.ts`
  // (`sanitizeSentryEvent`). To silence additional false-positives, extend
  // that predicate there rather than adding logic here.
  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 🔒 Vérification immédiate si headers déjà envoyés
    if (response.headersSent) {
      this.logger.warn(
        `Headers already sent for ${request.method} ${request.url} - Skipping error handler`,
      );
      return;
    }

    // RedirectException — handle before status-code routing
    if (exception instanceof RedirectException) {
      const { redirectUrl, message } = exception;
      return response.redirect(302, `${redirectUrl}?error=${message}`);
    }

    // DomainException — typed domain errors with error codes
    if (exception instanceof DomainException) {
      const status = exception.getStatus();

      this.logger.error(
        `${request.method} ${request.url} - ${status} [${exception.code}] ${exception.message}`,
        exception.originalCause?.stack || exception.stack,
      );

      // Log 5xx to error service
      if (status >= 500) {
        this.errorService
          .logError(exception.originalCause || exception, request, {
            status,
            code: exception.code,
            handled_by: 'GlobalErrorFilter',
            context: exception.context,
          })
          .catch((err) => {
            this.logger.error('Failed to log error to service:', err.message);
          });
      }

      if (response.headersSent) return;

      const errorResponse: Record<string, unknown> = {
        statusCode: status,
        code: exception.code,
        message: exception.message,
        timestamp: exception.timestamp,
        path: request.url,
        method: request.method,
      };
      if (exception.details) errorResponse.details = exception.details;
      if (exception.field) errorResponse.field = exception.field;

      try {
        response.status(status).json(errorResponse);
      } catch (err) {
        this.logger.error('Failed to send error response:', err);
      }
      return;
    }

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erreur interne du serveur';
    let code = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as Record<string, unknown>)
              ?.message as string) || exception.message;
      code = exception.constructor.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name;
    }

    // Gestion intelligente par code de statut
    switch (status) {
      case HttpStatus.NOT_FOUND:
        this.handle404(request, response);
        return;
      case HttpStatus.GONE:
        this.handle410(request, response);
        return;
      case HttpStatus.PRECONDITION_FAILED:
        this.handle412(request, response, exception);
        return;
      default:
        // Gestion spéciale pour 451 et autres codes non-standards
        if (status === 451) {
          this.handle451(request, response);
          return;
        }
        this.handleGenericError(
          request,
          response,
          status,
          message,
          code,
          exception,
        );
        return;
    }
  }

  private async handle404(request: Request, response: Response) {
    if (response.headersSent) return;

    try {
      // 1. Vérifier si c'est un ancien format d'URL → 410 Old Link
      const isOldFormat = this.detectOldLinkPattern(request.path);
      this.logger.debug(
        `Checking old format for ${request.path}: ${isOldFormat}`,
      );

      if (isOldFormat) {
        this.logger.log(`Old link format detected: ${request.path} → 410`);
        this.handle410OldLink(request, response);
        return;
      }

      // 2. Gérer la 404 standard
      const result = await this.errorService.handle404(request);

      if (response.headersSent) return;

      if (result.shouldRedirect && result.redirectUrl) {
        response.redirect(result.statusCode || 302, result.redirectUrl);
        return;
      }

      // Page 404 personnalisée pour le frontend
      if (this.isApiRequest(request)) {
        response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          message: 'Ressource non trouvée',
          error: 'NotFound',
        });
      } else {
        // Rediriger vers la page 404 du frontend
        response.redirect('/404');
      }
    } catch (error) {
      if (response.headersSent) return;

      this.logger.error('Erreur dans handle404:', error);
      response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Page non trouvée',
        error: 'NotFound',
      });
    }
  }

  private isApiRequest(request: Request): boolean {
    return (
      request.url.startsWith('/api/') ||
      request.headers.accept?.includes('application/json') ||
      request.headers['content-type']?.includes('application/json') ||
      false
    );
  }

  private async handle410(request: Request, response: Response) {
    if (response.headersSent) return;

    try {
      const result = await this.errorService.handle410(request);

      if (response.headersSent) return;

      if (result.shouldRedirect && result.redirectUrl) {
        response.redirect(result.statusCode || 302, result.redirectUrl);
        return;
      }

      // Page 410 personnalisée pour le frontend
      if (this.isApiRequest(request)) {
        response.status(HttpStatus.GONE).json({
          statusCode: HttpStatus.GONE,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          message:
            result.message || 'Cette ressource a été définitivement supprimée',
          error: 'Gone',
        });
      } else {
        // Rediriger vers la page 410 du frontend
        response.redirect('/gone');
      }
    } catch (error) {
      if (response.headersSent) return;

      this.logger.error('Erreur dans handle410:', error);
      response.status(HttpStatus.GONE).json({
        statusCode: HttpStatus.GONE,
        message: 'Ressource définitivement supprimée',
        error: 'Gone',
      });
    }
  }

  private async handle412(
    request: Request,
    response: Response,
    exception: unknown,
  ) {
    if (response.headersSent) return;

    try {
      // Extraire les détails de l'exception si possible
      let condition: string | undefined;
      let requirement: string | undefined;

      if (exception instanceof HttpException) {
        const exceptionResponse = exception.getResponse();
        if (
          typeof exceptionResponse === 'object' &&
          exceptionResponse !== null
        ) {
          const errorDetails = exceptionResponse as Record<string, unknown>;
          condition = (errorDetails.condition ||
            errorDetails.failedCondition) as string | undefined;
          requirement = (errorDetails.requirement ||
            errorDetails.expectedCondition) as string | undefined;
        }
      }

      if (response.headersSent) return;

      // Page 412 personnalisée pour le frontend
      if (this.isApiRequest(request)) {
        response.status(HttpStatus.PRECONDITION_FAILED).json({
          statusCode: HttpStatus.PRECONDITION_FAILED,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          message: 'Condition préalable échouée',
          error: 'PreconditionFailed',
          details: {
            condition: condition || 'Condition non spécifiée',
            requirement: requirement || 'Exigence non spécifiée',
          },
        });
      } else {
        // Rediriger vers la page 412 du frontend avec paramètres
        const params = new URLSearchParams();
        if (condition) params.set('condition', condition);
        if (requirement) params.set('requirement', requirement);
        params.set('url', request.url);

        response.redirect(`/precondition-failed?${params.toString()}`);
      }
    } catch (error) {
      if (response.headersSent) return;

      this.logger.error('Erreur dans handle412:', error);
      response.status(HttpStatus.PRECONDITION_FAILED).json({
        statusCode: HttpStatus.PRECONDITION_FAILED,
        message: 'Condition préalable échouée',
        error: 'PreconditionFailed',
      });
    }
  }

  private async handle451(request: Request, response: Response) {
    if (response.headersSent) return;

    try {
      // Pour l'instant, gestion basique - pourra être étendue avec un service dédié
      if (this.isApiRequest(request)) {
        response.status(451).json({
          statusCode: 451,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          message: 'Contenu indisponible pour des raisons légales',
          error: 'UnavailableForLegalReasons',
          contact: 'legal@company.com',
        });
      } else {
        // Rediriger vers la page 451 du frontend
        response.redirect('/legal-block');
      }
    } catch (error) {
      if (response.headersSent) return;

      this.logger.error('Erreur dans handle451:', error);
      response.status(451).json({
        statusCode: 451,
        message: 'Contenu indisponible pour des raisons légales',
        error: 'UnavailableForLegalReasons',
      });
    }
  }

  private handleGenericError(
    request: Request,
    response: Response,
    status: number,
    message: string,
    code: string,
    exception: unknown,
  ) {
    // Vérifier si les headers ont déjà été envoyés
    if (response.headersSent) {
      this.logger.warn(
        `Headers already sent for ${request.method} ${request.url} - Cannot send error response`,
      );
      return;
    }

    // Enregistrer l'erreur (async mais sans bloquer)
    if (exception instanceof Error) {
      this.errorService
        .logError(exception, request, {
          status,
          handled_by: 'GlobalErrorFilter',
        })
        .catch((err) => {
          // Si l'enregistrement échoue (ex: Redis down), on ne bloque pas la réponse
          this.logger.error('Failed to log error to service:', err.message);
        });
    }

    // Logger l'erreur
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Réponse d'erreur — content negotiation (même pattern isApiRequest que
    // handle404/410/412/451) : navigateur/crawler → page HTML status-aware
    // (code HTTP préservé, jamais de 302, noindex) ; client API → JSON inchangé.
    // NB : 429/5xx sont rendus en HTML INLINE (et non via une route Remix comme
    // /404) car le throttler (APP_GUARD) et les erreurs serveur court-circuitent
    // AVANT que Remix ne rende ; un 302 vers une route Remix perdrait le code
    // HTTP (un 429/503 doit rester 429/503 pour les crawlers).
    try {
      if (this.isApiRequest(request)) {
        response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          message,
          error: code,
        });
      } else {
        this.sendErrorHtml(request, response, status);
      }
    } catch (err) {
      this.logger.error('Failed to send error response:', err);
    }
  }

  /**
   * Sert une page d'erreur HTML status-aware au navigateur/crawler.
   * Code HTTP PRÉSERVÉ (jamais de 302), `X-Robots-Tag: noindex, follow`,
   * `Retry-After` sur 429/503. Aucune donnée dynamique/interne n'est reflétée
   * dans le HTML (pas de fuite d'info ni de surface XSS).
   */
  private sendErrorHtml(
    request: Request,
    response: Response,
    status: number,
  ): void {
    if (response.headersSent) return;

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('X-Robots-Tag', 'noindex, follow');

    const retryAfter = RETRY_AFTER_SECONDS[status];
    if (retryAfter) response.setHeader('Retry-After', String(retryAfter));

    response.status(status).send(this.renderErrorPageHtml(status));
  }

  /**
   * Page d'erreur autonome (aucune dépendance, mobile-first, accessible).
   * Ne rend QUE le code HTTP (entier contrôlé) + un libellé FR statique —
   * aucune chaîne dynamique reflétée.
   */
  private renderErrorPageHtml(status: number): string {
    const label = GENERIC_ERROR_LABELS_FR[status] ?? 'Erreur';
    const isServerError = status >= 500;
    const accent = isServerError ? '#dc2626' : '#ea580c'; // red-600 / orange-600
    const help = isServerError
      ? 'Un problème technique est survenu de notre côté. Nos équipes ont été notifiées.'
      : 'Veuillez réessayer dans quelques instants.';

    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>${status} — ${label} | Automecanik</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#f3f4f6;color:#111827;padding:24px;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  main{max-width:32rem;text-align:center}
  .code{font-size:4rem;font-weight:800;line-height:1;color:${accent};margin:0}
  h1{font-size:1.5rem;font-weight:700;margin:.5rem 0 0}
  p{color:#6b7280;margin:.75rem 0 0}
  a{display:inline-block;margin-top:1.5rem;padding:.625rem 1.25rem;border-radius:.5rem;
    background:${accent};color:#fff;text-decoration:none;font-weight:600}
</style>
</head>
<body>
<main>
  <p class="code">${status}</p>
  <h1>${label}</h1>
  <p>${help}</p>
  <a href="/">Retour à l'accueil</a>
</main>
</body>
</html>`;
  }

  /**
   * Détecte si une URL correspond à un ancien format obsolète
   */
  private detectOldLinkPattern(path: string): boolean {
    const oldPatterns = [
      /^\/old-format-/i, // URL commençant par "old-format-"
      /^\/legacy-/i, // URL commençant par "legacy-"
      /^\/v1\//i, // Ancienne API version 1
      /^\/v2\//i, // Ancienne API version 2
      /\.php$/i, // Ancien système PHP
      /\.asp$/i, // Ancien système ASP
      /\.jsp$/i, // Ancien système JSP
      /\/index\.html?$/i, // Fichiers index statiques
      /\/default\.html?$/i, // Pages par défaut
      /^\/app\//i, // Ancien répertoire app
      /^\/old\//i, // Répertoire old
      /^\/archive\//i, // Répertoire archive
      /\/product-(\d+)\.html$/i, // Ancien format produit
      /\/category-(\d+)\.html$/i, // Ancien format catégorie
      /\/page-(\d+)\.html$/i, // Ancien format page
      /\?id=\d+/, // URL avec paramètre ID simple
      /\/content\.php/i, // Script PHP générique
      /\/show\.php/i, // Script PHP d'affichage
    ];

    return oldPatterns.some((pattern) => pattern.test(path));
  }

  /**
   * Gère spécifiquement les erreurs 410 pour anciens liens
   */
  private async handle410OldLink(request: Request, response: Response) {
    if (response.headersSent) return;

    try {
      // Chercher une redirection vers le nouveau format
      const result = await this.errorService.handle410(request);

      if (response.headersSent) return;

      if (result.shouldRedirect && result.redirectUrl) {
        response.redirect(result.statusCode || 302, result.redirectUrl);
        return;
      }

      // Réponse 410 pour ancien lien
      if (this.isApiRequest(request)) {
        response.status(HttpStatus.GONE).json({
          statusCode: HttpStatus.GONE,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          message:
            "Format d'URL obsolète - Contenu migré vers nouvelle structure",
          error: 'Gone',
          type: 'old_link_format',
          isOldLink: true,
        });
      } else {
        // Rediriger vers la page 410 avec indication d'ancien lien
        const params = new URLSearchParams();
        params.set('url', request.url);
        params.set('isOldLink', 'true');
        params.set('type', 'legacy_url');

        response.redirect(`/gone?${params.toString()}`);
      }
    } catch (error) {
      if (response.headersSent) return;

      this.logger.error('Erreur dans handle410OldLink:', error);
      response.status(HttpStatus.GONE).json({
        statusCode: HttpStatus.GONE,
        message: "Format d'URL obsolète",
        error: 'Gone',
        isOldLink: true,
      });
    }
  }
}
