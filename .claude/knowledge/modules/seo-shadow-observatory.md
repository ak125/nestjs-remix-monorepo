---
module: seo-shadow-observatory
sources:
- backend/src/modules/seo-shadow-observatory
last_scan: '2026-06-02'
primary_files:
- backend/src/modules/seo-shadow-observatory/env.schema.ts
- backend/src/modules/seo-shadow-observatory/seo-shadow-chain-runner.service.ts
- backend/src/modules/seo-shadow-observatory/seo-shadow-diff-engine.service.ts
- backend/src/modules/seo-shadow-observatory/seo-shadow-event-sink.service.ts
- backend/src/modules/seo-shadow-observatory/seo-shadow-observatory.module.ts
- backend/src/modules/seo-shadow-observatory/seo-shadow-observatory.service.ts
- backend/src/modules/seo-shadow-observatory/seo-shadow-purge.cron.ts
- backend/src/modules/seo-shadow-observatory/seo-shadow-sampler.service.ts
depends_on:
- SeoModule
- ConfigModule
---

# Module Seo Shadow Observatory

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- _(aucun export dans le `@Module({exports: [...]})`)_

### Providers (top 15)
- _(aucun provider détecté)_

### Fichiers primaires
- [backend/src/modules/seo-shadow-observatory/env.schema.ts](../../../backend/src/modules/seo-shadow-observatory/env.schema.ts)
- [backend/src/modules/seo-shadow-observatory/seo-shadow-chain-runner.service.ts](../../../backend/src/modules/seo-shadow-observatory/seo-shadow-chain-runner.service.ts)
- [backend/src/modules/seo-shadow-observatory/seo-shadow-diff-engine.service.ts](../../../backend/src/modules/seo-shadow-observatory/seo-shadow-diff-engine.service.ts)
- [backend/src/modules/seo-shadow-observatory/seo-shadow-event-sink.service.ts](../../../backend/src/modules/seo-shadow-observatory/seo-shadow-event-sink.service.ts)
- [backend/src/modules/seo-shadow-observatory/seo-shadow-observatory.module.ts](../../../backend/src/modules/seo-shadow-observatory/seo-shadow-observatory.module.ts)
- [backend/src/modules/seo-shadow-observatory/seo-shadow-observatory.service.ts](../../../backend/src/modules/seo-shadow-observatory/seo-shadow-observatory.service.ts)
- [backend/src/modules/seo-shadow-observatory/seo-shadow-purge.cron.ts](../../../backend/src/modules/seo-shadow-observatory/seo-shadow-purge.cron.ts)
- [backend/src/modules/seo-shadow-observatory/seo-shadow-sampler.service.ts](../../../backend/src/modules/seo-shadow-observatory/seo-shadow-sampler.service.ts)

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
