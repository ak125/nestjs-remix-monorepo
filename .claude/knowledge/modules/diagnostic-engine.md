---
module: diagnostic-engine
sources:
- backend/src/modules/diagnostic-engine
last_scan: '2026-09-28'
primary_files:
- backend/src/modules/diagnostic-engine/constants/gamme-map.constants.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.controller.test.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.controller.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts
- backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts
depends_on:
- DatabaseModule
- VehicleContextModule
---

# Module Diagnostic Engine

## Rôle
Le diagnostic assemble les résultats de cinq moteurs métier (signaux, hypothèses, sécurité, catalogue et entretien) à partir des données DB. Les écrans de configuration et d’aide lisent séparément le contenu WIKI via `DiagnosticContentService`.

ADR-031 : aucun enrichissement RAG ne produit de faits diagnostic. La voie `RagEnrichmentEngine` et son affichage « faits vérifiés » sont retirés ; une ancienne réponse contenant `rag_facts` est ignorée par le rendu et ce champ est retiré par le schéma `EvidencePackSchema`. Le RAG reste une couche consommatrice destinée au chatbot.

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `DiagnosticEngineDataService`
- `MaintenanceCalculatorService`
- `DiagnosticContentService`
- `DiagnosticResolutionPipelineService`
- `OutcomeEmitterService`

### Providers (top 15)
- `DiagnosticEngineDataService`
- `MaintenanceCalculatorService`
- `DiagnosticContentService`
- `KgShadowService`
- `IntentClassifierService`
- `ActionRecommenderService`
- `HumanEscalationBuilderService`
- `InvariantAsserterService`
- `OutcomeEmitterService`
- `DiagnosticResolutionPipelineService`

### Fichiers primaires
- [backend/src/modules/diagnostic-engine/constants/gamme-map.constants.ts](../../../backend/src/modules/diagnostic-engine/constants/gamme-map.constants.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.controller.test.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.controller.test.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.controller.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.controller.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts)

<!-- END AUTO-GENERATED -->

## Pourquoi
Le niveau L1/L2 et un chemin source retournés par `/search` ne prouvent pas l’approbation WIKI. Le diagnostic ne doit ni utiliser cette recherche comme autorité de contenu, ni présenter ses extraits comme des faits vérifiés.

## Gotchas
- Ne pas réintroduire `RagProxyModule` dans le module diagnostic ni recréer un producteur `RAG → diagnostic`.
- La suppression de cet ancien enrichissement ne prouve pas la validation de toute la chaîne WIKI : le contrôle du frontmatter dans `DiagnosticContentService` reste à vérifier séparément.
- Régressions ciblées : `diagnostic-engine.orchestrator.test.ts` (moteur autonome, preuves métier, ancien champ écarté) et `diagnostic-results-content-authority.test.tsx` (anciens extraits ignorés, sécurité et résultats visibles).

## Références
<!-- À compléter à la main : liens vers `.claude/rules/`, vault ADRs, MEMORY.md entries. -->
_Section à rédiger._
