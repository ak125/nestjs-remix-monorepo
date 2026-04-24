---
module: rag-proxy
sources:
- backend/src/modules/rag-proxy
last_scan: '2026-04-24'
primary_files:
- backend/src/modules/rag-proxy/dto/chat.dto.ts
- backend/src/modules/rag-proxy/dto/manual-ingest.dto.ts
- backend/src/modules/rag-proxy/dto/pdf-ingest.dto.ts
- backend/src/modules/rag-proxy/dto/pipeline.dto.ts
- backend/src/modules/rag-proxy/dto/search.dto.ts
- backend/src/modules/rag-proxy/dto/web-ingest.dto.ts
- backend/src/modules/rag-proxy/dto/webhook-ingest.dto.ts
- backend/src/modules/rag-proxy/events/rag-ingestion.events.ts
depends_on:
- ConfigModule
---

# Module Rag Proxy

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `Backward`
- `RagProxyService`
- `FrontmatterValidatorService`
- `RagCleanupService`
- `WebhookAuditService`
- `New`
- `RagKnowledgeService`
- `RagChatService`
- `RagGammeDetectionService`
- `RagIngestionService`
- `RagWebhookCompletionService`
- `RagWebIngestDbService`
- `PdfTextExtractorService`
- `PdfRagClassifierService`
- `RagMdMergerService`
- `RagImageManagementService`
- `RagVideoManagementService`
- `Phase`
- `Ingestion`
- `Foundation`
- `RagFingerprintService`
- `RagValidationService`
- `RagFoundationGateService`
- `Normalization`
- `RagNormalizationService`
- `Business`
- `Admissibility`
- `Gate`
- `RagAdmissibilityGateService`
- `Legacy`
- `Adapted`
- `Shadow`
- `Audit`
- `RagPhase2aShadowAuditService`

### Providers (top 15)
- `Phase`
- `Ingestion`
- `Foundation`
- `RagFingerprintService`
- `RagValidationService`
- `RagFoundationGateService`
- `Normalization`
- `Identity`
- `Resolution`
- `RagNormalizationService`
- `Business`
- `Admissibility`
- `Gate`
- `RagAdmissibilityGateService`
- `Legacy`

### Fichiers primaires
- [backend/src/modules/rag-proxy/dto/chat.dto.ts](../../../backend/src/modules/rag-proxy/dto/chat.dto.ts)
- [backend/src/modules/rag-proxy/dto/manual-ingest.dto.ts](../../../backend/src/modules/rag-proxy/dto/manual-ingest.dto.ts)
- [backend/src/modules/rag-proxy/dto/pdf-ingest.dto.ts](../../../backend/src/modules/rag-proxy/dto/pdf-ingest.dto.ts)
- [backend/src/modules/rag-proxy/dto/pipeline.dto.ts](../../../backend/src/modules/rag-proxy/dto/pipeline.dto.ts)
- [backend/src/modules/rag-proxy/dto/search.dto.ts](../../../backend/src/modules/rag-proxy/dto/search.dto.ts)
- [backend/src/modules/rag-proxy/dto/web-ingest.dto.ts](../../../backend/src/modules/rag-proxy/dto/web-ingest.dto.ts)
- [backend/src/modules/rag-proxy/dto/webhook-ingest.dto.ts](../../../backend/src/modules/rag-proxy/dto/webhook-ingest.dto.ts)
- [backend/src/modules/rag-proxy/events/rag-ingestion.events.ts](../../../backend/src/modules/rag-proxy/events/rag-ingestion.events.ts)

<!-- END AUTO-GENERATED -->

## Pourquoi
<!-- À compléter à la main : contraintes architecturales, décisions historiques, trade-offs. -->
_Section à rédiger._

## Gotchas
<!-- À compléter à la main : pièges connus, bugs célèbres, invariants non évidents. -->
_Section à rédiger._

## Références
<!-- À compléter à la main : liens vers `.claude/rules/`, vault ADRs, MEMORY.md entries. -->
_Section à rédiger._
