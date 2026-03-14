# Canon Registry — Artefacts par rôle R0-R8

> Dernière mise à jour : 2026-03-14
> Source de vérité pour la complétude canonique par rôle.

---

### R0 — HOME

| Layer | Path | Status |
|-------|------|--------|
| Planner | — | N/A (non-editorial) |
| Generator | — | N/A |
| Validator | `.claude/agents/r0-home-validator.md` | ✅ |
| Execution | `.claude/agents/r0-home-execution.md` | ✅ |
| Skill ref | — | N/A |
| Page contract | `backend/src/config/r0-page-contract.constants.ts` | ✅ |
| Keyword plan | — | N/A |
| Consumer | — (non-editorial) | — |
| Frontend | `frontend/app/routes/_index.tsx` | ✅ |

### R1 — ROUTER

| Layer | Path | Status |
|-------|------|--------|
| Planner | `.claude/prompts/R1_ROUTER/planner.md` | ✅ |
| Generator | `.claude/prompts/R1_ROUTER/generator.md` | ✅ |
| Validator prompt | `.claude/prompts/R1_ROUTER/validator.md` | ✅ |
| Validator agent | `.claude/agents/r1-router-validator.md` | ✅ |
| Execution | `.claude/agents/r1-content-batch.md` | ✅ |
| Skill ref | `.claude/skills/.../references/r1-router-role.md` | ✅ |
| Page contract | `backend/src/config/page-contract-r1.schema.ts` | ✅ |
| Keyword plan | `backend/src/config/r1-keyword-plan.constants.ts` | ✅ |
| Consumer | `r1-content-pipeline.service.ts`, `r1-keyword-plan-gates.service.ts` | ✅ |
| Frontend | `frontend/app/routes/pieces.$slug.tsx` | ✅ |

### R2 — PRODUCT

| Layer | Path | Status |
|-------|------|--------|
| Planner | — | N/A (transactional) |
| Generator | — | N/A |
| Validator agent | `.claude/agents/r2-product-validator.md` | ✅ |
| Execution | `.claude/agents/r2-keyword-planner.md` | ✅ |
| Skill ref | `.claude/skills/.../references/r2-product-role.md` | ✅ |
| Page contract | — | ❌ gap |
| Keyword plan | `backend/src/config/r2-keyword-plan.constants.ts` | ✅ |
| Consumer | — (transactional, no enricher) | — |
| Frontend | product detail routes | ✅ |

### R3 — CONSEILS

| Layer | Path | Status |
|-------|------|--------|
| Planner | `.claude/prompts/R3_CONSEILS/planner.md` | ✅ |
| Generator | `.claude/prompts/R3_CONSEILS/generator.md` | ✅ |
| Validator prompt | `.claude/prompts/R3_CONSEILS/validator.md` | ✅ |
| Validator agent | `.claude/agents/r3-conseils-validator.md` | ✅ |
| Execution | `.claude/agents/conseil-batch.md` | ✅ |
| Skill ref | `.claude/skills/.../references/conseils-role.md` | ✅ |
| Page contract | `backend/src/config/page-contract-r3.schema.ts` | ✅ |
| Keyword plan | `backend/src/config/keyword-plan.constants.ts` (shared) | ✅ |
| Consumer | `conseil-enricher.service.ts` | ✅ |
| Frontend | `blog-pieces-auto/{alias}` | ✅ |

### R4 — REFERENCE

| Layer | Path | Status |
|-------|------|--------|
| Planner | `.claude/prompts/R4_REFERENCE/planner.md` | ✅ |
| Generator | `.claude/prompts/R4_REFERENCE/generator.md` | ✅ |
| Validator prompt | `.claude/prompts/R4_REFERENCE/validator.md` | ✅ |
| Validator agent | `.claude/agents/r4-reference-validator.md` | ✅ |
| Execution | `.claude/agents/r4-reference-execution.md` + `r4-content-batch.md` | ✅ |
| Skill ref | `.claude/skills/.../references/r4-reference-role.md` | ✅ |
| Page contract | `backend/src/config/page-contract-r4.schema.ts` + `page-contract-r4-media.schema.ts` | ✅ |
| Keyword plan | `backend/src/config/r4-keyword-plan.constants.ts` | ✅ |
| Consumer | `page-role-validator.service.ts` | ✅ |
| Frontend | `reference-auto.$slug.tsx`, `reference-auto._index.tsx` | ✅ |

### R5 — DIAGNOSTIC

| Layer | Path | Status |
|-------|------|--------|
| Planner | `.claude/prompts/R5_DIAGNOSTIC/planner.md` | ✅ |
| Generator | `.claude/prompts/R5_DIAGNOSTIC/generator.md` | ✅ |
| Validator prompt | `.claude/prompts/R5_DIAGNOSTIC/validator.md` | ✅ |
| Validator agent | `.claude/agents/r5-diagnostic-validator.md` | ✅ |
| Execution | `.claude/agents/r5-diagnostic-execution.md` | ✅ |
| Skill ref | `.claude/skills/.../references/r5-diagnostic-role.md` | ✅ |
| Page contract | `backend/src/config/page-contract-r5.schema.ts` | ✅ |
| Keyword plan | `backend/src/config/r5-diagnostic.constants.ts` | ✅ |
| Consumer | `diagnostic.service.ts`, `diagnostic.controller.ts` | ✅ |
| Frontend | `diagnostic-auto.$slug.tsx`, `diagnostic-auto._index.tsx` | ✅ |

### R6 — GUIDE ACHAT

| Layer | Path | Status |
|-------|------|--------|
| Planner | `.claude/prompts/R6_GUIDE_ACHAT/planner.md` | ✅ |
| Generator | `.claude/prompts/R6_GUIDE_ACHAT/generator.md` | ✅ |
| Validator prompt | `.claude/prompts/R6_GUIDE_ACHAT/validator.md` | ✅ |
| Validator agent | `.claude/agents/r6-guide-achat-validator.md` | ✅ |
| Support validator | `.claude/agents/r6-support-validator.md` | ✅ |
| Execution | `.claude/agents/r6-content-batch.md` + `r6-keyword-planner.md` | ✅ |
| Skill ref | `.claude/skills/.../references/guide-achat-role.md` | ✅ |
| Page contract | `backend/src/config/page-contract-r6.schema.ts` | ✅ |
| Keyword plan | `backend/src/config/r6-keyword-plan.constants.ts` | ✅ |
| Consumer | `buying-guide-enricher.service.ts`, `content-refresh.service.ts` | ✅ |
| Frontend | `blog-pieces-auto/guide-achat/*` | ✅ |

### R7 — BRAND

| Layer | Path | Status |
|-------|------|--------|
| Planner | `.claude/prompts/R7_BRAND/planner.md` | ✅ |
| Generator | `.claude/prompts/R7_BRAND/generator.md` | ✅ |
| Validator prompt | `.claude/prompts/R7_BRAND/validator.md` | ✅ |
| Validator agent | `.claude/agents/r7-brand-validator.md` | ✅ |
| Execution | `.claude/agents/r7-brand-execution.md` + `r7-brand-rag-generator.md` | ✅ |
| Skill ref | `.claude/skills/.../references/r7-brand-role.md` | ✅ |
| Page contract | `backend/src/config/page-contract-r7.schema.ts` | ✅ |
| Keyword plan | `backend/src/config/r7-keyword-plan.constants.ts` | ✅ |
| Consumer | — (no dedicated enricher) | ❌ gap |
| Frontend | `constructeurs.$.tsx` | ✅ |

### R8 — VEHICLE

| Layer | Path | Status |
|-------|------|--------|
| Planner | `.claude/prompts/R8_VEHICLE/planner.md` | ✅ |
| Generator | `.claude/prompts/R8_VEHICLE/generator.md` | ✅ |
| Validator prompt | `.claude/prompts/R8_VEHICLE/validator.md` | ✅ |
| Validator agent | `.claude/agents/r8-vehicle-validator.md` | ✅ |
| Execution | `.claude/agents/r8-vehicle-execution.md` + `r8-keyword-planner.md` | ✅ |
| Skill ref | `.claude/skills/.../references/r8-vehicle-role.md` | ✅ |
| Page contract | `backend/src/config/page-contract-r8.schema.ts` | ✅ |
| Keyword plan | `backend/src/config/r8-keyword-plan.constants.ts` | ✅ |
| Consumer | `vehicle-rag-generator.service.ts` | ✅ |
| Frontend | vehicle routes | ✅ |

---

## Shared / Transverse

| Artefact | Path |
|----------|------|
| Stop conditions | `.claude/prompts/_shared/stop-conditions.md` |
| Quality constraints | `.claude/prompts/_shared/quality-constraints.md` |
| Upstream required | `.claude/prompts/_shared/upstream-required.md` |
| Write/publish boundary | `.claude/prompts/_shared/write-publish-boundary.md` |
| Page roles canon | `.claude/skills/.../references/page-roles.md` |
| Keyword planner orchestrator | `.claude/agents/keyword-planner.md` |

## Gaps identifiés

| Gap | Rôle | Impact | Action recommandée |
|-----|------|--------|--------------------|
| Pas de page-contract R2 | R2 | Faible (transactional) | Créer si R2 editorial enrichment prévu |
| Pas d'enricher R7 | R7 | Moyen | Créer quand pipeline R7 sera opérationnel |
| R0 sans prompts 3-prompt | R0 | Faible (hub non-editorial) | Acceptable |

## Vérification

```bash
# Compter les artefacts par rôle
for r in R0 R1 R2 R3 R4 R5 R6 R7 R8; do
  echo "$r: prompts=$(ls .claude/prompts/${r}_*/  2>/dev/null | wc -l) agents=$(ls .claude/agents/r${r:1}*  2>/dev/null | wc -l)"
done

# Vérifier zéro R3_guide* comme vérité
grep -rn "R3_guide" .claude/agents/ .claude/prompts/ .claude/skills/ 2>/dev/null | grep -v "legacy\|bridge\|ancien" | wc -l
```
