import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  Logger,
  PipeTransform,
} from '@nestjs/common';
import { ZodValidationPipe } from '../zod-validation.pipe';

/**
 * Base abstraite des typed param pipes numériques.
 *
 * Centralise :
 *  - le try/catch sur la validation Zod
 *  - le log debug structuré (paramName + rejectedValue safe-encoded)
 *  - le contrat `PipeTransform<string, number>`
 *
 * Les concrétisations injectent uniquement leur schéma Zod
 * (int4 aujourd'hui ; futur uuid/slug/alias-id, etc.).
 *
 * SCALAR PARAM ONLY — usage attendu :
 *   `@Param('id', PositiveIntParamPipe) id: number`
 * jamais `@Param(PositiveIntParamPipe)` (passerait l'objet `params`).
 */
@Injectable()
export abstract class BaseNumericParamPipe
  extends ZodValidationPipe
  implements PipeTransform<string, number>
{
  protected abstract readonly logger: Logger;

  override transform(value: string, metadata: ArgumentMetadata): number {
    try {
      return super.transform(value, metadata) as number;
    } catch (err) {
      if (err instanceof BadRequestException) {
        const paramName = metadata.data ?? 'unknown';
        this.logger.debug(
          `Param validation failed: ${metadata.type}.${paramName} ` +
            `rejected=${JSON.stringify(String(value))}`,
        );
      }
      throw err;
    }
  }
}
