#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NEUTRALISÉ — PR-C (2026-07-02). Script inerte, ne rien exécuter.

Ancien rôle : lisait les blocs `phase5_enrichment` des fichiers RAG `.md`
(`rag/knowledge/gammes/`) et les poussait vers `__rag_knowledge` via
`/api/rag/internal/ingest/manual` (enrichissement circulaire de l'ancien
pipeline content-RAG).

Motif : maintient l'ancien pipeline content-RAG abandonné par ADR-031 / ADR-046
(RAG = retrieval chatbot uniquement ; l'ingestion canon passe par le mirror
WIKI → RAG, jamais par un ingester legacy). La vérité contenu vient du WIKI.

Remplacement : skill /seo-content-loop + sync mirror `scripts/rag-sync/`.

Corps retiré volontairement : aucune lecture RAG, aucune écriture DB/API, aucun
appel LLM. Sort en erreur pour empêcher toute exécution accidentelle.

Réf : audit/rag-legacy-inventory-2026-07-02.md. Rollback = git revert.
"""
import sys

sys.stderr.write(
    "NEUTRALISÉ (PR-C) — script inerte. RAG != source de contenu (ADR-031/046). "
    "Ingestion canon = mirror WIKI->RAG (scripts/rag-sync/). "
    "Voir audit/rag-legacy-inventory-2026-07-02.md.\n"
)
sys.exit(1)
