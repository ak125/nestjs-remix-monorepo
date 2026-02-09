import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodQueryValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'query') {
      return value;
    }

    try {
      // Transform query parameters (which are strings) to appropriate types
      const transformedValue = this.transformQueryParams(
        value as Record<string, any>,
      );
      const parsedValue = this.schema.parse(transformedValue);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        throw new BadRequestException({
          message: 'Validation failed',
          errors: errorMessages,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }

  private transformQueryParams(
    params: Record<string, any>,
  ): Record<string, any> {
    const transformed: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Transform specific fields that should be numbers
      if (
        [
          'page',
          'limit',
          'rangeId',
          'brandId',
          'minPrice',
          'maxPrice',
          'yearFrom',
          'yearTo',
        ].includes(key)
      ) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          transformed[key] = numValue;
        } else {
          transformed[key] = value; // Keep original value if not a valid number
        }
      }
      // Transform boolean fields
      else if (['isActive', 'inStock', 'lowStock'].includes(key)) {
        if (value === 'true' || value === true) {
          transformed[key] = true;
        } else if (value === 'false' || value === false) {
          transformed[key] = false;
        } else {
          transformed[key] = value;
        }
      }
      // Keep string fields as is
      else {
        transformed[key] = value;
      }
    }

    return transformed;
  }
}
