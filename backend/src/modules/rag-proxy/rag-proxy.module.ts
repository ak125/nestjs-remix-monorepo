import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagProxyController } from './rag-proxy.controller';
import { RagProxyService } from './rag-proxy.service';

// NOTE: RagProxyService uses EventEmitter2 (inject @nestjs/event-emitter).
// EventEmitterModule.forRoot() is imported globally in app.module.ts,
// so it is available here without an explicit import.
@Module({
  imports: [ConfigModule],
  controllers: [RagProxyController],
  providers: [RagProxyService],
  exports: [RagProxyService],
})
export class RagProxyModule {}
