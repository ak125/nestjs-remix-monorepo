import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErrorController } from './controllers/error.controller';
import { ErrorService } from './services/error.service';
import { ErrorLogService } from './services/error-log.service';
import { RedirectService } from './services/redirect.service';
import { GlobalErrorFilter } from './filters/global-error.filter';

@Global()
@Module({
  controllers: [ErrorController],
  providers: [
    ErrorService,
    ErrorLogService,
    RedirectService,
    {
      provide: APP_FILTER,
      useClass: GlobalErrorFilter,
    },
  ],
  exports: [ErrorService, ErrorLogService, RedirectService],
})
export class ErrorsModule {}
