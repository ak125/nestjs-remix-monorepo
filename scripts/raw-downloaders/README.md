# scripts/raw-downloaders/

Scripts qui **téléchargent des sources externes** (Wikipedia, OEM PDFs, brand pages) vers `automecanik-raw/recycled/rag-knowledge/web/` ou similaire.

> Pipeline canon (ADR-031 §D16) :
> Sources externes (Wikipedia, OEM) → **`scripts/raw-downloaders/`** → `automecanik-raw/recycled/rag-knowledge/web/<hash>.{html,json}`.

## Scripts hébergés

- `download-oem-corpus.py` (anciennement `scripts/rag/download-oem-corpus.py`) — télécharge corpus technique Wikipedia FR + OEM pages.
- `download-brand-oem-corpus.py` (anciennement `scripts/rag/download-brand-oem-corpus.py`) — télécharge corpus brand-specific.

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
