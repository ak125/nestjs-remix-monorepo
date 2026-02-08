import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { BotGuardService } from './bot-guard.service';
import { BotGuardMiddleware } from './bot-guard.middleware';
import { BotGuardController } from './bot-guard.controller';

@Module({
  controllers: [BotGuardController],
  providers: [BotGuardService],
  exports: [BotGuardService],
})
export class BotGuardModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BotGuardMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
