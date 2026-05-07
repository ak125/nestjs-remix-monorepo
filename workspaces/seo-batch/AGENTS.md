# SEO Batch — AGENTS.md (Ownership canon R0-R8)

> **Phase 1 PR-C** du plan Refondation R-stack ([ADR-046](../../governance-vault-ref:ADR-046)).
> Ownership canonique des **services backend enrichers** (L4 GENERATORS) et
> de leurs **agents seo-batch orchestrateurs**, avec règle 1 LIVE par rôle.
>
> Ce fichier est l'**index de propriété**. Il sera étendu en Phase 2 avec
> liens explicites vers `packages/seo-role-contracts/src/contracts/r{N}.ts`
> (SoT comportemental — [ADR-047](../../governance-vault-ref:ADR-047)).

## Règle canon

**1 service backend canonique par rôle R0..R8** (L4 GENERATORS de la
chaîne L0-L5). Tout service additionnel touchant un rôle doit avoir un
scope **orthogonal** (KP, image-prompt, related-resources, validator) —
pas de duplication de règles métier.

> **Anti-pattern AP-11** (duplication) : si tu ajoutes un nouveau service
> qui contient `min_chars`, `max_chars`, `FORBIDDEN_TERMS` ou
> `allowed_sections` en dur pour un rôle déjà pourvu, ta PR est rejetée.
> Lis le contract via `import { CONTRACTS } from '@repo/seo-role-contracts'`
> (Phase 2 PR-F/H/I).

## Ownership table — services backend (L4)

| Rôle | Service canonique LIVE | Scope |
|---|---|---|
| R0 (HOME) | composé via R1+R6+R7 (pas d'enricher dédié) | Surface navigation globale |
| R1 (ROUTER) | `backend/src/modules/admin/services/r1-enricher.service.ts` | Slots gamme (5 colonnes compatibilité/sélection) |
| R1 (ROUTER) | `backend/src/modules/admin/services/r1-content-from-rag.service.ts` | Page HTML R1 (rendu serveur) — **scope orthogonal**, ne fusionne pas avec r1-enricher |
| R2 (PRODUCT) | `backend/src/modules/admin/services/r2-enricher.service.ts` | Specs produit gamme |
| R3 (CONSEILS) | `backend/src/modules/admin/services/conseil-enricher.service.ts` | Conseils maintenance / montage / usage |
| R4 (REFERENCE) | `backend/src/modules/admin/services/r4-content-enricher.service.ts` | Encyclopédique contexte mécanique |
| R5 (DIAGNOSTIC) | _N/A — sunset_ ([ADR-027](../../governance-vault-ref:ADR-027)) | Section S2_DIAG dans R3 (`#diagnostic-rapide`) — pas d'URL R5 dédiée |
| R6 (GUIDE_ACHAT) | `backend/src/modules/admin/services/buying-guide-enricher.service.ts` | Comparatifs, budgets, top marques |
| R7 (BRAND) | `backend/src/modules/admin/services/r7-brand-enricher.service.ts` | Hub marque transversal |
| R8 (VEHICLE) | `backend/src/modules/admin/services/r8-vehicle-enricher.service.ts` | Hub véhicule × motorisation |
| Transversal | `backend/src/modules/admin/services/gamme-detail-enricher.service.ts` | Cross-rôle — à reclasser en Phase 2 |

## Services orthogonaux R1 (scopes distincts, pas de fusion)

R1 est le rôle le plus instrumenté du repo. Les **10 fichiers** R1 sont
des composants orthogonaux, pas des duplications :

| Fichier | Scope | Status |
|---|---|---|
| `backend/src/modules/admin/services/r1-enricher.service.ts` | LIVE — slots DB | Canonique |
| `backend/src/modules/admin/services/r1-content-from-rag.service.ts` | LIVE — page HTML | Canonique |
| `backend/src/modules/admin/services/r1-keyword-plan-batch.service.ts` | LIVE — KP batch | Orthogonal (Keyword Planner) |
| `backend/src/modules/admin/services/r1-keyword-plan-gates.service.ts` | LIVE — KP gates | Orthogonal (validation KP) |
| `backend/src/modules/admin/services/r1-image-prompt.service.ts` | LIVE — prompts images | Orthogonal (media generation) |
| `backend/src/modules/gamme-rest/services/r1-related-resources.service.ts` | LIVE — liens connexes | Orthogonal (cross-linking R5/R6) |
| `backend/src/modules/gamme-rest/utils/r1-image-normalizer.ts` | LIVE — utilitaire | Helper |
| `backend/src/modules/gamme-rest/types/r1-related-links.types.ts` | LIVE — types | TypeScript types |
| `backend/src/config/r1-keyword-plan.constants.ts` | LIVE — config KP | Phase-priority, seo_priority (KP-specific). **Phase 2 PR-H** : ces constants perdent les valeurs role-behavior (déplacées en `seo-role-contracts/r1.ts`) |
| `backend/src/config/r1-media-rules.constants.ts` | LIVE — règles media | Image dimensions, alt-text rules |

## Agents seo-batch orchestrateurs (40 fichiers)

Localisation : `workspaces/seo-batch/.claude/agents/*.md` (40 agents,
incl. `_shared/`). Voir `workspaces/seo-batch/CLAUDE.md` pour la liste
complète et le contrat de sortie.

Mapping rôle → agents principaux :

| Rôle | Agent execution | Agent validator | Agent KP |
|---|---|---|---|
| R0 | `r0-home-execution.md` | `r0-home-validator.md` | _N/A_ |
| R1 | `r1-content-batch.md` | `r1-router-validator.md` | `r1-keyword-planner.md` |
| R2 | _N/A (pas d'execution batch dédié)_ | `r2-product-validator.md` | `r2-keyword-planner.md` |
| R3 | `conseil-batch.md` | `r3-conseils-validator.md` | `r3-keyword-planner.md`, `r3-keyword-plan-batch.md` |
| R4 | `r4-content-batch.md`, `r4-reference-execution.md` | `r4-reference-validator.md` | `r4-keyword-planner.md` |
| R5 | `r5-diagnostic-execution.md` | `r5-diagnostic-validator.md` | `r5-keyword-planner.md` |
| R6 | `r6-content-batch.md` | `r6-guide-achat-validator.md`, `r6-support-validator.md` | `r6-keyword-planner.md` |
| R7 | `r7-brand-execution.md`, `r7-brand-rag-generator.md` | `r7-brand-validator.md` | `r7-keyword-planner.md` |
| R8 | `r8-vehicle-execution.md` | `r8-vehicle-validator.md` | `r8-keyword-planner.md` |
| Transversal | `research-agent.md`, `phase1-auditor.md`, `brief-enricher.md`, `blog-hub-planner.md`, `conseil-batch.md`, `keyword-planner.md` (legacy wrapper), `agentic-critic.md`, `agentic-planner.md`, `agentic-solver.md`, `r3-image-prompt.md`, `r6-image-prompt.md` | — | — |

## Architecture chain rappel

```
[Claude Code skill] → [scripts/seo/*.py] → [backend NestJS *-enricher.service.ts] → DB cache
       LLM                orchestration            0-LLM, lit contracts                read-only runtime
       (skills-first)     (CLI/HTTP wrapper)       (L4 GENERATORS)                    (L5)
```

- **LLM vit côté skill**, pas côté service backend (anti-pattern :
  bloqué par `.ast-grep/rules/no-anthropic-direct-import-in-scripts-seo.yml`
  — Phase 1 PR-B)
- **Enrichers backend = 0-LLM**, lisent règles depuis
  `@repo/seo-role-contracts` (Phase 2 PR-F/H/I), écrivent DB cache
- **L3 RAG MIRROR read-only** : aucun service écrit dans
  `rag/knowledge/` directement (Phase 1 PR-A + Phase 1 PR-E)

## Déviants à archiver (Phase 1 PR-D — sunset 2026-06-07)

Liste précise des 5 fichiers déviants à identifier en Phase 1 PR-D et
archiver sous `archive/2026-05/` (pattern `git mv` —
[memory `feedback_refactor_placement_avant_logique`](../../governance-vault-ref:feedback_refactor_placement_avant_logique)).

Critères de déviance :
- Service touchant un rôle R\* déjà pourvu d'un canonical LIVE
- Sans scope orthogonal clair (duplication règles métier)
- Sans test ni run récent dans CI

À compléter en PR-D avec liste finale + deprecate banners.

## Références

- Plan détaillé : `/home/deploy/.claude/plans/je-remarque-une-faiblesse-eventual-flamingo.md`
- ADR-046 : R-stack canonique L0-L5 (vault PR #183, 2026-05-07)
- ADR-047 : Contract-as-code `@repo/seo-role-contracts` (vault PR #183)
- ADR-040 : Foundation `@repo/seo-roles` (à amender pour identité only)
- ADR-027 : R5 sunset (R5 = section S2_DIAG dans R3)
- ADR-031 : Architecture canonique 4-layer (étendue 6-layer dans ADR-046)
- Audit baseline : `governance-vault/ledger/audit-trail/2026-05-07-r-stack-audit.md`
