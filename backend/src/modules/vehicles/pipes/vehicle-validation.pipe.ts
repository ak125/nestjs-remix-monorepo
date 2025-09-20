import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Pipe de validation Zod pour les véhicules
 */
@Injectable()
export class VehicleZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, _metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => {
          const path = issue.path.join('.');
          return `${path}: ${issue.message}`;
        });

        throw new BadRequestException({
          message: 'Erreur de validation des données véhicules',
          errors: errorMessages,
          statusCode: 400,
        });
      }
      throw new BadRequestException('Données invalides');
    }
  }
}
