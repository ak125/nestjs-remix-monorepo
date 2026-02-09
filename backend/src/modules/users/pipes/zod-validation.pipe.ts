/**
 * 🔍 Pipe de Validation Zod
 * ✅ Validation des données d'entrée avec schemas Zod
 * ✅ Messages d'erreur clairs et structurés
 * ✅ Compatible avec l'écosystème NestJS
 */

import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: any) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        );
        throw new BadRequestException({
          message: 'Données de validation invalides',
          errors: validationErrors,
        });
      }
      throw new BadRequestException('Erreur de validation');
    }
  }
}
