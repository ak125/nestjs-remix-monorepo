import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';

let app: NestExpressApplication;

export async function bootstrapNest() {
  if (!app) {
    app = await NestFactory.create<NestExpressApplication>(AppModule);
    await app.init();
  }
  return app;
}
