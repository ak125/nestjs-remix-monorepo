import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseStorageService } from '../upload/services/supabase-storage.service';
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
import { RagWebIngestDbService } from './services/rag-web-ingest-db.service';

// PDF merge pipeline services
import { PdfTextExtractorService } from './services/pdf-text-extractor.service';
import { PdfRagClassifierService } from './services/pdf-rag-classifier.service';
import { RagMdMergerService } from './services/rag-md-merger.service';

// Image & Video management services
import { RagImageManagementService } from './services/rag-image-management.service';
import { RagVideoManagementService } from './services/rag-video-management.service';

// Phase 1 — Ingestion Foundation services
import { RagFingerprintService } from './services/rag-fingerprint.service';
import { RagValidationService } from './services/rag-validation.service';
import { RagFoundationGateService } from './services/rag-foundation-gate.service';

// Phase 1.5 — Normalization & Identity Resolution
import { RagNormalizationService } from './services/rag-normalization.service';

// Phase 1.6 — Business Admissibility Gate
import { RagAdmissibilityGateService } from './services/rag-admissibility-gate.service';

// Phase 2A — Legacy Adapted Shadow Audit
import { RagPhase2aShadowAuditService } from './services/rag-phase2a-shadow-audit.service';

// NOTE: CacheModule is @Global() (registered in app.module.ts) — CacheService
// is available everywhere without explicit import.
// EventEmitterModule.forRoot() is also imported globally in app.module.ts.
@Module({
  imports: [ConfigModule],
  controllers: [RagProxyController],
  providers: [
    // Phase 1 — Ingestion Foundation (leaf deps, before consumers)
    RagFingerprintService,
    RagValidationService,
    RagFoundationGateService,
    // Phase 1.5 — Normalization & Identity Resolution
    RagNormalizationService,
    // Phase 1.6 — Business Admissibility Gate
    RagAdmissibilityGateService,
    // Phase 2A — Legacy Adapted Shadow Audit
    RagPhase2aShadowAuditService,
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
    RagWebIngestDbService,
    // PDF merge pipeline
    PdfTextExtractorService,
    PdfRagClassifierService,
    RagMdMergerService,
    // Image management (SupabaseStorageService registered locally to avoid UploadModule CACHE_MANAGER dep)
    SupabaseStorageService,
    RagImageManagementService,
    RagVideoManagementService,
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
    RagWebIngestDbService,
    PdfTextExtractorService,
    PdfRagClassifierService,
    RagMdMergerService,
    RagImageManagementService,
    RagVideoManagementService,
    // Phase 1 — Ingestion Foundation
    RagFingerprintService,
    RagValidationService,
    RagFoundationGateService,
    // Phase 1.5 — Normalization
    RagNormalizationService,
    // Phase 1.6 — Business Admissibility Gate
    RagAdmissibilityGateService,
    // Phase 2A — Legacy Adapted Shadow Audit
    RagPhase2aShadowAuditService,
  ],
})
export class RagProxyModule {}
