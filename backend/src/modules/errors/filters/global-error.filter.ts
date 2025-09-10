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

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
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

    // Gestion spéciale pour les erreurs 404
    if (status === HttpStatus.NOT_FOUND) {
      this.handle404(request, response);
      return;
    }

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

  private async handle404(request: Request, response: Response) {
    try {
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
      request.headers['content-type']?.includes('application/json')
    );
  }
}
