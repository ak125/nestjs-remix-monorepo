#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NEUTRALISÉ — PR-C (2026-07-02). Script inerte, ne rien exécuter.

Ancien rôle : enrichissait les fichiers RAG `.md` (`rag/knowledge/gammes/`) depuis un
export DB de `__seo_gamme_purchase_guide` (direction DB → RAG alimentant l'ancien
pipeline content-RAG).

Motif : maintient l'ancien pipeline content-RAG abandonné par ADR-031 / ADR-046
(RAG = retrieval chatbot uniquement). La vérité contenu vient du WIKI.

Remplacement : skill /seo-content-loop (méthode boucle no-RAG).

Corps retiré volontairement : aucune lecture/écriture RAG, aucune écriture DB, aucun
appel LLM. Sort en erreur pour empêcher toute exécution accidentelle.

Réf : audit/rag-legacy-inventory-2026-07-02.md. Rollback = git revert.
"""
import sys

sys.stderr.write(
    "NEUTRALISÉ (PR-C) — script inerte. RAG != source de contenu (ADR-031/046). "
    "Utiliser le skill /seo-content-loop. Voir audit/rag-legacy-inventory-2026-07-02.md.\n"
)
sys.exit(1)
