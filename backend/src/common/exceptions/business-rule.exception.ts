import { HttpStatus } from '@nestjs/common';
import { DomainException, DomainExceptionOptions } from './domain.exception';

export class BusinessRuleException extends DomainException {
  constructor(
    options: Omit<DomainExceptionOptions, 'code'> & { code?: string },
  ) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: options.code || 'BUSINESS.RULE_VIOLATED',
      ...options,
    });
  }
}
