#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NEUTRALISÉ — PR-C (2026-07-02). Script inerte, ne rien exécuter.

Ancien rôle : téléchargeait un corpus technique (Wikipedia FR + pages OEM) vers
`recycled/rag-knowledge/web/`, alimentant l'ancien pipeline content-RAG.

Motif : alimente l'ancien pipeline content-RAG abandonné par ADR-031 / ADR-046
(RAG = retrieval chatbot uniquement). La capture de sources canon passe par la
boucle RAW → WIKI (scraping gouverné → automecanik-raw/sources/ → WIKI).

Remplacement : skill /seo-content-loop (RUN_TARGETED_RAW_TO_WIKI).

Corps retiré volontairement : aucun téléchargement, aucune écriture RAG/DB, aucun
appel réseau. Sort en erreur pour empêcher toute exécution accidentelle.

Réf : audit/rag-legacy-inventory-2026-07-02.md. Rollback = git revert.
"""
import sys

sys.stderr.write(
    "NEUTRALISÉ (PR-C) — script inerte. Capture de sources = boucle RAW->WIKI "
    "(skill /seo-content-loop). Voir audit/rag-legacy-inventory-2026-07-02.md.\n"
)
sys.exit(1)
