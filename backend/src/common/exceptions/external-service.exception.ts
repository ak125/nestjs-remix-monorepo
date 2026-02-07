import { HttpStatus } from '@nestjs/common';
import { DomainException, DomainExceptionOptions } from './domain.exception';

export class ExternalServiceException extends DomainException {
  public readonly serviceName?: string;

  constructor(
    options: Omit<DomainExceptionOptions, 'code'> & {
      code?: string;
      serviceName?: string;
    },
  ) {
    super(HttpStatus.BAD_GATEWAY, {
      code: options.code || 'EXTERNAL.SERVICE_ERROR',
      ...options,
    });
    this.serviceName = options.serviceName;
  }
}
