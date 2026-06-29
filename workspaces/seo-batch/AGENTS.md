# AGENTS.md — `workspaces/seo-batch/` ownership canon

> **Phase 1 PR-C** du plan refondation R-stack. Définit **1 LIVE générateur par rôle R0-R8** + liste les 5 déviants à archiver. Implémente [[ADR-046-r-stack-single-generator-and-layers]] + [[ADR-047-seo-role-contracts-as-code]].

## Règle d'ownership

Chaque rôle R0..R8 a **un seul agent / service / skill canon LIVE**. Tout autre générateur est soit `DEPRECATED` (sunset documenté) soit `ARCHIVED` (déplacé en `archive/`).

Référentiel comportemental : **`packages/seo-role-contracts/`** (Phase 2 PR-F, à venir). Tant que ce package n'existe pas, les enrichers backend gardent leurs constants in-place avec note JSDoc `@see ADR-047`.

---

## Tableau ownership R0-R8 (état 2026-05-07)

| Rôle | Générateur LIVE | Type | Fichier | Contract (Phase 2) |
|------|-----------------|------|---------|---------------------|
| **R0_HOME** | `R0HomeAggregatorService` | NestJS service | `backend/src/modules/admin/services/r0-home-aggregator.service.ts` | `packages/seo-role-contracts/src/contracts/r0.ts` (TBD Phase 2) |
| **R1_ROUTER** | `R1EnricherService` | NestJS service (0-LLM) | `backend/src/modules/admin/services/r1-enricher.service.ts` | `r1.ts` |
| **R2_PRODUCT** | `R2EnricherService` | NestJS service | `backend/src/modules/admin/services/r2-enricher.service.ts` | `r2.ts` |
| **R3_CONSEILS** | `ConseilEnricherService` | NestJS service | `backend/src/modules/admin/services/conseil-enricher.service.ts` | `r3.ts` |
| **R4_REFERENCE** | `R4ContentEnricherService` | NestJS service | `backend/src/modules/admin/services/r4-content-enricher.service.ts` | `r4.ts` |
| **R6_GUIDE_ACHAT** | `BuyingGuideEnricherService` | NestJS service | `backend/src/modules/admin/services/buying-guide-enricher.service.ts` | `r6.ts` |
| **R7_BRAND** | `R7BrandEnricherService` | NestJS service | `backend/src/modules/admin/services/r7-brand-enricher.service.ts` | `r7.ts` |
| **R8_VEHICLE** | `R8VehicleEnricherService` | NestJS service | `backend/src/modules/admin/services/r8-vehicle-enricher.service.ts` | `r8.ts` |

**Note R5** : déprécié par [[ADR-027-r5-consolidation-into-r3-s2-diag]]. Aucun générateur LIVE.

---

## Skills Claude Code complémentaires (pas de génération canon)

Les agents `.claude/agents/` de ce workspace orchestrent le LLM Claude Code pour les cas où le 0-LLM template ne suffit pas (richesse RAG insuffisante, content polish). Ils consomment toujours le contract R\* (Phase 2) en runtime, ne dupliquent pas la logique.

| Agent | Rôle ciblé | Usage |
|-------|------------|-------|
| `r1-content-batch.md` | R1_ROUTER | Polish LLM si template R1Enricher produit < min_chars contract |
| `conseil-batch.md` | R3_CONSEILS | Multi-section orchestration |
| `r4-content-batch.md` | R4_REFERENCE | Definition + sections génération LLM |
| `r6-content-batch.md` | R6_GUIDE_ACHAT | Comparison + tier polish |
| `r7-brand-rag-generator.md` | R7_BRAND | Brand FAQ + common issues (depuis brands RAG mirror) |
| `keyword-planner.md` | tous | Génère `__seo_r{N}_keyword_plan` depuis Google Ads CSV |
| `agentic-planner.md` / `agentic-critic.md` / `agentic-solver.md` | meta | Orchestration multi-rôles, audit cross-cutting |

---

## DEPRECATED (sunset 2026-06-07 — EXÉCUTÉ 2026-06-12)

5 générateurs déviants, sunset exécuté (état vérifié 2026-06-12) :

| Path | Type | Raison sunset | Remplacement | Statut |
|------|------|---------------|--------------|--------|
| `archive/2026-06/scripts/seo/generate-content-r1.py` | Python script | Anthropic API direct (non-canon, hors gouvernance rate-limit) | Skill `/content-gen --r1` ou `R1EnricherService` | Archivé 2026-06-12 (lint vocab : déjà porté dans `.claude/prompts/R1_ROUTER/editorial.md` §FORBIDDEN VOCABULARY) |
| `scripts/rag/rag-enrich-from-web-corpus.py` | Python script | Écrit `rag/knowledge/` direct (bypass wiki/exports — viole ADR-031) | Phase 3B PR-O `wiki-to-rag-exporter.py` | Retiré (refactor #270 et purges suivantes) |
| `scripts/seo/materialize-db-to-md.py` | Python script | Écrit `rag/knowledge/diagnostic/` direct | Phase 3B promotion gate | Retiré |
| `workspaces/seo-batch/.claude/agents/phase5-vague{4,5,6}-*.md` | Claude Code agent | Curation humaine direct rag/ (avant pivot ADR-033) | Phase 3A PR-K `legacy-rag-importer.py` (passage par wiki/proposals/) | Retirés (0 fichier restant) |
| `scripts/seo/r7-brand-rag-generator-legacy.py` | Python script (legacy) | Override sync brands canon (PR vault #19) | Sync canon `automecanik-wiki/exports/rag/constructeurs/` | Retiré |

---

## ARCHIVED (déjà déplacés)

Aucun pour l'instant. Ce tableau sera peuplé par Phase 6 PR-V.

---

## Refs

- [[ADR-046-r-stack-single-generator-and-layers]] — cadre L0-L5 + 1 générateur par rôle
- [[ADR-047-seo-role-contracts-as-code]] — contract package SoT comportemental
- [[ADR-050-quality-history-and-drift-detection]] — observabilité enrichers
- Plan : `/home/deploy/.claude/plans/je-remarque-une-faiblesse-eventual-flamingo.md` Phase 1 PR-C
- Memory : `feedback_no_bricolage_clean_layer.md`, `feedback_canon_rule_live_iff_adr_accepted.md`
