import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Variante stricte de `ZodQueryValidationPipe` : passe la valeur **directement**
 * au schéma Zod, sans le `transformQueryParams` legacy qui faisait
 * `Number(value)` puis `keep original if NaN` (cf.
 * [`zod-query-validation.pipe.ts:64`](./zod-query-validation.pipe.ts) lignes
 * 50-67). Ce keep-string-on-NaN était la racine du bug Sentry 2026-05-23
 * (`invalid input syntax for type smallint: "NaN"` en PROD sur
 * `GET /api/vehicles/brands/:brandId/models`) — les chaînes `"NaN"`/`"abc"`
 * passaient comme valeurs string, ré-injectées dans un schéma qui faisait
 * lui-même `parseInt`, et NaN propageait jusqu'au SQL.
 *
 * Contrat de ce pipe :
 *   1. Si `metadata.type !== 'query'` → passthrough (no-op).
 *   2. Sinon → `schema.parse(value)` direct. Le schéma porte les
 *      `.regex(...)`, `.transform(Number)`, `.pipe(z.number()...)`, etc.
 *   3. `ZodError` → `BadRequestException(400)` avec body
 *      `{ message: 'Validation failed', errors: [{ field, message }] }`
 *      (format compatible avec `ZodQueryValidationPipe` legacy pour
 *      les clients qui le parsent).
 *
 * Toute logique de coercition appartient au schéma, pas au pipe. Anti-bricolage :
 * pas de fallback silencieux, pas de tolérance NaN, pas de conversion implicite.
 */
@Injectable()
export class StrictZodQueryValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T | unknown {
    if (metadata.type !== 'query') {
      return value;
    }

    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          message: issue.message,
        }));
        throw new BadRequestException({
          message: 'Validation failed',
          errors,
        });
      }
      throw new BadRequestException({ message: 'Validation failed' });
    }
  }
}
