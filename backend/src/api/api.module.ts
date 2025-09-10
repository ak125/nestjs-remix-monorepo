import { Module } from '@nestjs/common';
import {
  ErrorsApiController,
  RedirectsApiController,
} from './errors-api.controller';
import { ErrorsModule } from '../modules/errors/errors.module';

@Module({
  imports: [ErrorsModule],
  controllers: [ErrorsApiController, RedirectsApiController],
})
export class ApiModule {}
