# scripts/rag-sync/

Sync `automecanik-wiki/exports/rag/` → `automecanik-rag/knowledge/` (mirror read-only).

> Pipeline canon (ADR-031 §D20) :
> `automecanik-wiki/exports/rag/` → **`scripts/rag-sync/`** (CI workflow) → `automecanik-rag/knowledge/` (mirror).

## Scripts hébergés

- `sync-wiki-exports-to-rag.py` (anciennement `scripts/rag/sync-from-wiki.py`) — sync idempotent sha256, refuse toute source autre que `wiki/exports/rag/` (garde D20 enforcement). Mode `--dry-run` par défaut, `--apply` explicite.

## Invocation

Manuel (DEV) :
```bash
python3 scripts/rag-sync/sync-wiki-exports-to-rag.py \
  --wiki-repo /opt/automecanik/automecanik-wiki \
  --rag-repo  /opt/automecanik/rag \
  --apply
```

CI workflow (plan v3 §Étape 7, à activer) :
- Trigger : push sur `automecanik-wiki/main` qui modifie `exports/rag/**`
- Action : `repository_dispatch` vers `automecanik-rag` qui exécute le sync
- Commit auto sur `automecanik-rag/main` avec marker `synced-from-wiki: <wiki-sha>`

## Référence

- ADR-031 §D20 — sync-from-wiki STRICT lit `wiki/exports/rag/` ONLY
- Plan v3 §Étape 5 Groupe C + §Étape 7 (workflow CI)
