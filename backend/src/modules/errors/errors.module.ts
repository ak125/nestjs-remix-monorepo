import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErrorController } from './controllers/error.controller';
import { InternalErrorLogController } from './controllers/internal-error-log.controller'; // INC-2026-007 Étape 7
import { ErrorService } from './services/error.service';
import { ErrorLogService } from './services/error-log.service';
import { RedirectService } from './services/redirect.service';
import { GlobalErrorFilter } from './filters/global-error.filter';
import { InternalApiKeyGuard } from '../../auth/internal-api-key.guard';

@Global()
@Module({
  controllers: [ErrorController, InternalErrorLogController],
  providers: [
    ErrorService,
    ErrorLogService,
    RedirectService,
    InternalApiKeyGuard, // INC-2026-007 Étape 7 : guard pour /api/internal/error-log
    {
      provide: APP_FILTER,
      useClass: GlobalErrorFilter,
    },
  ],
  exports: [ErrorService, ErrorLogService, RedirectService],
})
export class ErrorsModule {}
