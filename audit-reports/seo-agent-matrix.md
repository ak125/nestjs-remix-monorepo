# SEO Agent Operating Matrix

> Généré le : 2026-04-30T21:16:15.907Z
> Sources hash : registry=8efeb1b3 types=6c585a30 catalog=de4b23f1 roleIds=baf84e23
> Registry version : 1.0.0 — Field catalog : 141 entrées

## Matrice principale

| Rôle | Health | Registry | Agents | Tables ownées | # Fields |
|---|---|---|---|---|---|
| R0_HOME | 40 | ❌ | r0-home-execution, r0-home-validator | — | 0 |
| R1_ROUTER | 100 | ✅ | r1-content-batch, r1-keyword-planner, r1-router-validator | __seo_gamme, __seo_r1_gamme_slots, __seo_page_brief | 38 |
| R2_PRODUCT | 100 | ✅ | r2-keyword-planner, r2-product-validator | __seo_r2_keyword_plan | 15 |
| R3_GUIDE (deprecated) | 0 | ❌ | — | — | 0 |
| R3_CONSEILS | 100 | ✅ | conseil-batch, r3-conseils-validator, r3-image-prompt, r3-keyword-plan-batch, r3-keyword-planner | __seo_gamme_conseil | 12 |
| R4_REFERENCE | 100 | ✅ | r4-content-batch, r4-keyword-planner, r4-reference-execution, r4-reference-validator | __seo_reference | 21 |
| R5_DIAGNOSTIC | 100 | ✅ | r5-diagnostic-execution, r5-diagnostic-validator, r5-keyword-planner | __seo_observable | 16 |
| R6_SUPPORT | 40 | ❌ | r6-support-validator | — | 0 |
| R6_GUIDE_ACHAT | 100 | ✅ | r6-content-batch, r6-guide-achat-validator, r6-image-prompt, r6-keyword-planner | __seo_gamme_purchase_guide | 28 |
| R7_BRAND | 70 | ✅ | r7-brand-execution, r7-brand-rag-generator, r7-brand-validator, r7-keyword-planner | — | 0 |
| R8_VEHICLE | 100 | ✅ | r8-keyword-planner, r8-vehicle-execution, r8-vehicle-validator | __seo_r8_pages | 11 |
| R9_GOVERNANCE (deprecated) | 0 | ❌ | — | — | 0 |
| AGENTIC_ENGINE | 40 | ❌ | agentic-critic, agentic-planner, agentic-solver | — | 0 |
| FOUNDATION | 40 | ❌ | blog-hub-planner, brief-enricher, keyword-planner, phase1-auditor, research-agent | — | 0 |

## Gaps (agents sans entrée registry)

_Aucun gap détecté._

## Anomalies

_Aucune anomalie._

## Index inverse (agent → rôle)

| Agent | Rôle résolu |
|---|---|
| agentic-critic | AGENTIC_ENGINE |
| agentic-planner | AGENTIC_ENGINE |
| agentic-solver | AGENTIC_ENGINE |
| blog-hub-planner | FOUNDATION |
| brief-enricher | FOUNDATION |
| conseil-batch | R3_CONSEILS |
| keyword-planner | FOUNDATION |
| phase1-auditor | FOUNDATION |
| r0-home-execution | R0_HOME |
| r0-home-validator | R0_HOME |
| r1-content-batch | R1_ROUTER |
| r1-keyword-planner | R1_ROUTER |
| r1-router-validator | R1_ROUTER |
| r2-keyword-planner | R2_PRODUCT |
| r2-product-validator | R2_PRODUCT |
| r3-conseils-validator | R3_CONSEILS |
| r3-image-prompt | R3_CONSEILS |
| r3-keyword-plan-batch | R3_CONSEILS |
| r3-keyword-planner | R3_CONSEILS |
| r4-content-batch | R4_REFERENCE |
| r4-keyword-planner | R4_REFERENCE |
| r4-reference-execution | R4_REFERENCE |
| r4-reference-validator | R4_REFERENCE |
| r5-diagnostic-execution | R5_DIAGNOSTIC |
| r5-diagnostic-validator | R5_DIAGNOSTIC |
| r5-keyword-planner | R5_DIAGNOSTIC |
| r6-content-batch | R6_GUIDE_ACHAT |
| r6-guide-achat-validator | R6_GUIDE_ACHAT |
| r6-image-prompt | R6_GUIDE_ACHAT |
| r6-keyword-planner | R6_GUIDE_ACHAT |
| r6-support-validator | R6_SUPPORT |
| r7-brand-execution | R7_BRAND |
| r7-brand-rag-generator | R7_BRAND |
| r7-brand-validator | R7_BRAND |
| r7-keyword-planner | R7_BRAND |
| r8-keyword-planner | R8_VEHICLE |
| r8-vehicle-execution | R8_VEHICLE |
| r8-vehicle-validator | R8_VEHICLE |
| research-agent | FOUNDATION |

---

_Paths agent configurés : workspaces/seo-batch/.claude/agents, .claude/agents, backend/.claude/agents_
_Paths agent effectivement scannés : workspaces/seo-batch/.claude/agents_

_Source : OperatingMatrixService (`backend/src/config/operating-matrix.service.ts`). Régénérer via `npm run seo:matrix`._
