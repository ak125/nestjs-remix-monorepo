import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Pipe de validation personnalisé utilisant Zod
 * Valide les données d'entrée selon un schéma Zod
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((err: any) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });

        throw new BadRequestException({
          message: 'Données de validation invalides',
          errors: errorMessages,
          statusCode: 400,
        });
      }
      throw new BadRequestException('Erreur de validation');
    }
  }
}
