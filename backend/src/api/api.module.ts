import { Module } from '@nestjs/common';
import {
  ErrorsApiController,
  RedirectsApiController,
} from './errors-api.controller';
import { ErrorsModule } from '../modules/errors/errors.module';
import { SeoModule } from '../modules/seo/seo.module';

@Module({
  imports: [ErrorsModule, SeoModule],
  controllers: [ErrorsApiController, RedirectsApiController],
})
export class ApiModule {}
