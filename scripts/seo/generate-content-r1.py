#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NEUTRALISÉ — PR-C (2026-07-02). Script inerte, ne rien exécuter.

Ancien rôle : générait le contenu R1 (`sg_content`) via l'API Anthropic (HTTP direct)
à partir du corpus RAG + KW, puis écrivait `sg_content_draft` dans `__seo_gamme`.

Motif : direction RAG→contenu (lecture `rag/knowledge/` → génération LLM → écriture DB)
INTERDITE par ADR-031 / ADR-046 — le RAG est un retrieval chatbot, jamais une source de
contenu/SEO. La vérité contenu vient du WIKI (RAW → WIKI → projection → R*). L'appel
Anthropic en HTTP direct contournait aussi la gouvernance (rate-limit / observabilité).

Remplacement : skill /seo-content-loop (méthode boucle no-RAG).

Corps retiré volontairement : aucune lecture RAG, aucune écriture DB, aucun appel
LLM/HTTP. Sort en erreur pour empêcher toute exécution accidentelle.

Réf : audit/rag-legacy-inventory-2026-07-02.md. Rollback = git revert.
"""
import sys

sys.stderr.write(
    "NEUTRALISÉ (PR-C) — script inerte. RAG != source de contenu (ADR-031/046). "
    "Utiliser le skill /seo-content-loop. Voir audit/rag-legacy-inventory-2026-07-02.md.\n"
)
sys.exit(1)
