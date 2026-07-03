---
name: seo-content-architect
description: "[NEUTRALISÉ PR-C 2026-07-02 → /seo-content-loop] Corps retiré. Ce skill lisait le RAG (via /api/rag/search + frontmatter) pour générer du contenu multi-rôle — direction RAG→contenu abandonnée (ADR-031/046, RAG = chatbot only). La vérité contenu vient du WIKI. Utiliser /seo-content-loop."
license: Internal - Automecanik
version: "2.4"
disable-model-invocation: true
allowed-tools: Read
---

# seo-content-architect — NEUTRALISÉ (PR-C, 2026-07-02)

Ce skill est **neutralisé**. Son corps opératoire (interrogation du RAG puis génération
de contenu multi-rôle R1/R3/R4/R6 écrit en base) a été **retiré** : c'est la direction
**RAG→contenu abandonnée** par ADR-031 / ADR-046 — le RAG est un retrieval chatbot,
jamais une source de contenu/SEO.

## Remplacement

- **Méthode contenu** : `/seo-content-loop` (boucle no-RAG : RAW → WIKI → projection → R*).
- La vérité contenu vient du **WIKI** (sourcée, lintée, validée humainement), jamais du RAG.

L'outil `execute_sql` a été retiré d'`allowed-tools` : même recopié, ce skill ne peut
plus écrire en base.

> Réf : `audit/rag-legacy-inventory-2026-07-02.md` (§2, §12bis, §13). Rollback = `git revert`.
