# scripts/raw-downloaders/

Scripts qui **téléchargent des sources externes** (Wikipedia, OEM PDFs, brand pages) vers `automecanik-raw/recycled/rag-knowledge/web/` ou similaire.

> Pipeline canon (ADR-031 §D16) :
> Sources externes (Wikipedia, OEM) → **`scripts/raw-downloaders/`** → `automecanik-raw/recycled/rag-knowledge/web/<hash>.{html,json}`.

## Scripts hébergés

> **⚠️ NEUTRALISÉS — PR-C (2026-07-02).** Les deux scripts ci-dessous alimentaient l'ancien
> pipeline content-RAG (`recycled/rag-knowledge/`), direction abandonnée par ADR-031/046
> (RAG = retrieval chatbot uniquement). Ils sont désormais **inertes** (corps retiré, `exit 1`).
> Capture de sources canon = boucle RAW → WIKI via le skill `/seo-content-loop`.
> Détail : `audit/rag-legacy-inventory-2026-07-02.md`.

- `download-oem-corpus.py` (anciennement `scripts/rag/download-oem-corpus.py`) — **[NEUTRALISÉ PR-C]** téléchargeait un corpus technique Wikipedia FR + OEM pages.
- `download-brand-oem-corpus.py` (anciennement `scripts/rag/download-brand-oem-corpus.py`) — **[NEUTRALISÉ PR-C]** téléchargeait un corpus brand-specific.

## Convention OUTPUT

Path canonique via env var :
```python
RAW_KNOWLEDGE_ROOT = os.getenv("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw")
WEB_DIR = f"{RAW_KNOWLEDGE_ROOT}/recycled/rag-knowledge/web"
```

Phase D (PR monorepo #205) a uniformisé l'env var. Default historique
(`/opt/automecanik/rag/knowledge`) est conservé pour rétrocompatibilité
mais le default canon est désormais `automecanik-raw`.

## Référence

- ADR-031 — pipeline raw → wiki → rag
- Plan v3 §Étape 5 Groupe D
