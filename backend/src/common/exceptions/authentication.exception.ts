import { HttpStatus } from '@nestjs/common';
import { DomainException, DomainExceptionOptions } from './domain.exception';

export class AuthenticationException extends DomainException {
  constructor(options?: Partial<DomainExceptionOptions>) {
    super(HttpStatus.UNAUTHORIZED, {
      code: options?.code || 'AUTH.UNAUTHENTICATED',
      message: options?.message || 'Non autorisé',
      ...options,
    });
  }
}
