import { HttpStatus } from '@nestjs/common';
import { DomainException, DomainExceptionOptions } from './domain.exception';

export class DatabaseException extends DomainException {
  constructor(options: Omit<DomainExceptionOptions, 'code'> & { code?: string }) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, {
      code: options.code || 'DATABASE.OPERATION_FAILED',
      ...options,
    });
  }
}
