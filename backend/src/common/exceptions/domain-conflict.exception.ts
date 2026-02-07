import { HttpStatus } from '@nestjs/common';
import { DomainException, DomainExceptionOptions } from './domain.exception';

export class DomainConflictException extends DomainException {
  constructor(
    options: Omit<DomainExceptionOptions, 'code'> & { code?: string },
  ) {
    super(HttpStatus.CONFLICT, {
      code: options.code || 'RESOURCE.CONFLICT',
      ...options,
    });
  }
}
