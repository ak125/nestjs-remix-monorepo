---
name: content-gen
disable-model-invocation: true
description: "[NEUTRALISÉ PR-C 2026-07-02 → /seo-content-loop] Corps retiré. Ce skill lisait le RAG puis écrivait du contenu en base — direction RAG→contenu abandonnée (ADR-031/046, RAG = chatbot only). La vérité contenu vient du WIKI (RAW→WIKI→projection). Utiliser /seo-content-loop."
allowed-tools: Read
---

# content-gen — NEUTRALISÉ (PR-C, 2026-07-02)

Ce skill est **neutralisé**. Son corps opératoire (lecture du corpus RAG puis
écritures `sg_content` / `__seo_*` en base) a été **retiré** : c'est la direction
**RAG→contenu abandonnée** par ADR-031 / ADR-046 — le RAG est un retrieval chatbot,
jamais une source de contenu/SEO.

## Remplacement

- **Méthode contenu** : `/seo-content-loop` (boucle no-RAG : RAW → WIKI → projection → R*).
- La vérité contenu vient du **WIKI** (sourcée, lintée, validée humainement), jamais du RAG.

L'outil `execute_sql` a été retiré d'`allowed-tools` : même recopié, ce skill ne peut
plus écrire en base.

> Le dossier `references/` est conservé (lu par `rag-phase2a-shadow-audit.service.ts`).
> Réf : `audit/rag-legacy-inventory-2026-07-02.md` (§2, §12bis, §13). Rollback = `git revert`.
