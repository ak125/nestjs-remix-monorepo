import { HttpException, HttpStatus } from '@nestjs/common';

export interface DomainExceptionOptions {
  code: string;
  message: string;
  details?: string;
  field?: string;
  cause?: Error;
  context?: Record<string, unknown>;
}

export abstract class DomainException extends HttpException {
  public readonly code: string;
  public readonly details?: string;
  public readonly field?: string;
  public readonly originalCause?: Error;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(status: HttpStatus, options: DomainExceptionOptions) {
    const timestamp = new Date().toISOString();
    super(
      {
        statusCode: status,
        code: options.code,
        message: options.message,
        details: options.details,
        field: options.field,
        timestamp,
      },
      status,
      { cause: options.cause },
    );
    this.code = options.code;
    this.details = options.details;
    this.field = options.field;
    this.originalCause = options.cause;
    this.context = options.context;
    this.timestamp = timestamp;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toApiError() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      field: this.field,
      timestamp: this.timestamp,
    };
  }
}
