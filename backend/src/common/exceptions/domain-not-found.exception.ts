import { HttpStatus } from '@nestjs/common';
import { DomainException, DomainExceptionOptions } from './domain.exception';

export class DomainNotFoundException extends DomainException {
  constructor(options: Omit<DomainExceptionOptions, 'code'> & { code?: string }) {
    super(HttpStatus.NOT_FOUND, {
      code: options.code || 'RESOURCE.NOT_FOUND',
      ...options,
    });
  }
}
