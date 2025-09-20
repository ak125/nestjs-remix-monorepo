import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorService } from '../services/error.service';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalErrorFilter.name);

  constructor(private readonly errorService: ErrorService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erreur interne du serveur';
    let code = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
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

      if (result.shouldRedirect && result.redirectUrl) {
        response.redirect(result.statusCode || 302, result.redirectUrl);
        return;
      }

      // Page 404 personnalisée pour le frontend
      if (this.isApiRequest(request)) {
        response.status(404).json({
          statusCode: 404,
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
      this.logger.error('Erreur dans handle404:', error);
      response.status(404).json({
        statusCode: 404,
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
    try {
      const result = await this.errorService.handle410(request);

      if (result.shouldRedirect && result.redirectUrl) {
        response.redirect(result.statusCode || 302, result.redirectUrl);
        return;
      }

      // Page 410 personnalisée pour le frontend
      if (this.isApiRequest(request)) {
        response.status(410).json({
          statusCode: 410,
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
      this.logger.error('Erreur dans handle410:', error);
      response.status(410).json({
        statusCode: 410,
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
          const errorDetails = exceptionResponse as any;
          condition = errorDetails.condition || errorDetails.failedCondition;
          requirement =
            errorDetails.requirement || errorDetails.expectedCondition;
        }
      }

      // Page 412 personnalisée pour le frontend
      if (this.isApiRequest(request)) {
        response.status(412).json({
          statusCode: 412,
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
      this.logger.error('Erreur dans handle412:', error);
      response.status(412).json({
        statusCode: 412,
        message: 'Condition préalable échouée',
        error: 'PreconditionFailed',
      });
    }
  }

  private async handle451(request: Request, response: Response) {
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
    // Enregistrer l'erreur
    if (exception instanceof Error) {
      this.errorService.logError(exception, request, {
        status,
        handled_by: 'GlobalErrorFilter',
      });
    }

    // Logger l'erreur
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Réponse d'erreur
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: code,
    };

    response.status(status).json(errorResponse);
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
    try {
      // Chercher une redirection vers le nouveau format
      const result = await this.errorService.handle410(request);

      if (result.shouldRedirect && result.redirectUrl) {
        response.redirect(result.statusCode || 302, result.redirectUrl);
        return;
      }

      // Réponse 410 pour ancien lien
      if (this.isApiRequest(request)) {
        response.status(410).json({
          statusCode: 410,
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
      this.logger.error('Erreur dans handle410OldLink:', error);
      response.status(410).json({
        statusCode: 410,
        message: "Format d'URL obsolète",
        error: 'Gone',
        isOldLink: true,
      });
    }
  }
}
