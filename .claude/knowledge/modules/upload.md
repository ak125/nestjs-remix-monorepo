---
module: upload
sources:
- backend/src/modules/upload
last_scan: '2026-04-27'
primary_files:
- backend/src/modules/upload/dto/index.ts
- backend/src/modules/upload/dto/upload.dto.ts
- backend/src/modules/upload/services/file-validation.service.ts
- backend/src/modules/upload/services/image-processing.service.ts
- backend/src/modules/upload/services/supabase-storage.service.ts
- backend/src/modules/upload/services/upload-analytics.service.ts
- backend/src/modules/upload/services/upload-optimization.service.ts
- backend/src/modules/upload/services/upload.service.ts
depends_on:
- ConfigModule
- MulterModule
---

# Module Upload

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `UploadService`
- `ImageProcessingService`
- `SupabaseStorageService`

### Providers (top 15)
- `UploadService`
- `ImageProcessingService`
- `SupabaseStorageService`
- `FileValidationService`
- `UploadAnalyticsService`
- `UploadOptimizationService`

### Fichiers primaires
- [backend/src/modules/upload/dto/index.ts](../../../backend/src/modules/upload/dto/index.ts)
- [backend/src/modules/upload/dto/upload.dto.ts](../../../backend/src/modules/upload/dto/upload.dto.ts)
- [backend/src/modules/upload/services/file-validation.service.ts](../../../backend/src/modules/upload/services/file-validation.service.ts)
- [backend/src/modules/upload/services/image-processing.service.ts](../../../backend/src/modules/upload/services/image-processing.service.ts)
- [backend/src/modules/upload/services/supabase-storage.service.ts](../../../backend/src/modules/upload/services/supabase-storage.service.ts)
- [backend/src/modules/upload/services/upload-analytics.service.ts](../../../backend/src/modules/upload/services/upload-analytics.service.ts)
- [backend/src/modules/upload/services/upload-optimization.service.ts](../../../backend/src/modules/upload/services/upload-optimization.service.ts)
- [backend/src/modules/upload/services/upload.service.ts](../../../backend/src/modules/upload/services/upload.service.ts)

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
