import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagProxyController } from './rag-proxy.controller';
import { RagProxyService } from './rag-proxy.service';

// Existing extracted services
import { FrontmatterValidatorService } from './services/frontmatter-validator.service';
import { RagCleanupService } from './services/rag-cleanup.service';
import { WebhookAuditService } from './services/webhook-audit.service';

// P1 — extracted sub-services (dependency order)
import { RagCircuitBreakerService } from './services/rag-circuit-breaker.service';
import { RagRedisJobService } from './services/rag-redis-job.service';
import { RagKnowledgeService } from './services/rag-knowledge.service';
import { RagChatService } from './services/rag-chat.service';
import { RagGammeDetectionService } from './services/rag-gamme-detection.service';
import { RagIngestionService } from './services/rag-ingestion.service';
import { RagWebhookCompletionService } from './services/rag-webhook-completion.service';

// NOTE: CacheModule is @Global() (registered in app.module.ts) — CacheService
// is available everywhere without explicit import.
// EventEmitterModule.forRoot() is also imported globally in app.module.ts.
@Module({
  imports: [ConfigModule],
  controllers: [RagProxyController],
  providers: [
    // Existing services
    FrontmatterValidatorService,
    RagCleanupService,
    WebhookAuditService,
    // P1 sub-services (leaf deps first)
    RagCircuitBreakerService,
    RagRedisJobService,
    RagKnowledgeService,
    RagChatService,
    RagGammeDetectionService,
    RagIngestionService,
    RagWebhookCompletionService,
    // Facade (depends on all above)
    RagProxyService,
  ],
  exports: [
    // Backward compat — external modules inject RagProxyService
    RagProxyService,
    FrontmatterValidatorService,
    RagCleanupService,
    WebhookAuditService,
    // New exports for future direct injection
    RagKnowledgeService,
    RagChatService,
    RagGammeDetectionService,
    RagIngestionService,
    RagWebhookCompletionService,
  ],
})
export class RagProxyModule {}
