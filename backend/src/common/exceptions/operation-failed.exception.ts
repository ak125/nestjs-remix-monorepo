import { HttpStatus } from '@nestjs/common';
import { DomainException, DomainExceptionOptions } from './domain.exception';

export class OperationFailedException extends DomainException {
  constructor(
    options: Omit<DomainExceptionOptions, 'code'> & { code?: string },
  ) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, {
      code: options.code || 'OPERATION.FAILED',
      ...options,
    });
  }
}
