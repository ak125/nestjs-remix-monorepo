import { HttpStatus } from '@nestjs/common';
import { DomainException, DomainExceptionOptions } from './domain.exception';

export class DomainValidationException extends DomainException {
  constructor(options: Omit<DomainExceptionOptions, 'code'> & { code?: string }) {
    super(HttpStatus.BAD_REQUEST, {
      code: options.code || 'VALIDATION.FAILED',
      ...options,
    });
  }
}
