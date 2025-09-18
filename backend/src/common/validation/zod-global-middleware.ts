/**
 * 🛡️ MIDDLEWARE GLOBAL DE VALIDATION ZOD
 * 
 * Intercepteur global pour capturer et formater les erreurs de validation Zod
 * Fournit une réponse standardisée pour toutes les erreurs de validation
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { z } from 'zod';

/**
 * Filtre d'exception pour intercepter les erreurs de validation Zod
 */
@Catch(BadRequestException)
export class ZodValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ZodValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Extraire les détails de l'erreur
    const exceptionResponse = exception.getResponse();
    const status = exception.getStatus();

    // Formater la réponse d'erreur
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.extractErrorMessage(exceptionResponse),
      ...(typeof exceptionResponse === 'object' && exceptionResponse !== null 
        ? { details: this.formatValidationErrors(exceptionResponse) }
        : {}),
    };

    // Logger l'erreur pour le débogage
    this.logger.warn(
      `🛡️ Validation échouée: ${request.method} ${request.url} - ${JSON.stringify(errorResponse.message)}`,
    );

    response.status(status).json(errorResponse);
  }

  /**
   * Extrait le message d'erreur principal
   */
  private extractErrorMessage(exceptionResponse: any): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (exceptionResponse?.message) {
      return Array.isArray(exceptionResponse.message) 
        ? exceptionResponse.message.join(', ')
        : exceptionResponse.message;
    }

    return 'Erreur de validation';
  }

  /**
   * Formate les erreurs de validation Zod pour une meilleure lisibilité
   */
  private formatValidationErrors(exceptionResponse: any): any {
    if (!exceptionResponse?.errors || !Array.isArray(exceptionResponse.errors)) {
      return exceptionResponse;
    }

    return {
      field_errors: exceptionResponse.errors.map((error: any) => ({
        field: error.path?.length > 0 ? error.path.join('.') : 'root',
        message: error.message,
        code: error.code,
        received: error.received,
      })),
      error_count: exceptionResponse.errors.length,
    };
  }
}

/**
 * Décorateur pour appliquer la validation Zod à une méthode de contrôleur
 */
export function ValidateWith(schema: z.ZodSchema) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        // Valider les arguments avec le schéma fourni
        const [body] = args;
        if (body) {
          schema.parse(body);
        }
        return await method.apply(this, args);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const logger = new Logger(`${target.constructor.name}.${propertyName}`);
          logger.warn(`🛡️ Validation Zod échouée: ${error.message}`);
          
          throw new BadRequestException({
            message: `Validation échouée: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
            errors: error.errors,
            statusCode: HttpStatus.BAD_REQUEST,
          });
        }
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Intercepteur global pour la validation des query parameters
 */
export class QueryValidationInterceptor {
  static validateQuery(schema: z.ZodSchema) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        try {
          // Extraire et valider les query parameters
          const request = args.find(arg => arg?.query);
          if (request?.query) {
            const validatedQuery = schema.parse(request.query);
            request.query = validatedQuery;
          }
          return await method.apply(this, args);
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new BadRequestException({
              message: `Paramètres de requête invalides: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
              errors: error.errors,
              statusCode: HttpStatus.BAD_REQUEST,
            });
          }
          throw error;
        }
      };

      return descriptor;
    };
  }
}

/**
 * Service d'utilitaires pour la validation
 */
export class ValidationUtilsService {
  private static readonly logger = new Logger(ValidationUtilsService.name);

  /**
   * Valide une donnée contre un schéma Zod et retourne le résultat
   */
  static async validateAsync<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
    try {
      return await schema.parseAsync(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.warn(`🛡️ Validation async échouée: ${error.message}`);
        throw new BadRequestException({
          message: `Validation échouée: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          errors: error.errors,
          statusCode: HttpStatus.BAD_REQUEST,
        });
      }
      throw error;
    }
  }

  /**
   * Valide une donnée et retourne un résultat safe (sans exception)
   */
  static validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    errors?: z.ZodError;
  } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  }

  /**
   * Transforme les erreurs Zod en format lisible
   */
  static formatZodErrors(errors: z.ZodError): Array<{
    field: string;
    message: string;
    code: string;
    value?: any;
  }> {
    return errors.errors.map(error => ({
      field: error.path.length > 0 ? error.path.join('.') : 'root',
      message: error.message,
      code: error.code,
      value: 'received' in error ? error.received : undefined,
    }));
  }
}