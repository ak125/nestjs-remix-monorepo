import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagProxyController } from './rag-proxy.controller';
import { RagProxyService } from './rag-proxy.service';
import { FrontmatterValidatorService } from './services/frontmatter-validator.service';
import { RagCleanupService } from './services/rag-cleanup.service';

// NOTE: RagProxyService uses EventEmitter2 (inject @nestjs/event-emitter).
// EventEmitterModule.forRoot() is imported globally in app.module.ts,
// so it is available here without an explicit import.
@Module({
  imports: [ConfigModule],
  controllers: [RagProxyController],
  providers: [RagProxyService, FrontmatterValidatorService, RagCleanupService],
  exports: [RagProxyService, FrontmatterValidatorService, RagCleanupService],
})
export class RagProxyModule {}
