# scripts/wiki-exports/

Scripts qui **transforment du contenu wiki humainement promu** (`automecanik-wiki/wiki/<entity>/<slug>.md`) vers le format consommable par downstream (`automecanik-wiki/exports/rag/<entity>/<slug>.md`).

> Pipeline canon (ADR-031 §D20) :
> `automecanik-wiki/wiki/<entity>/<slug>.md` (humain promu) → **`scripts/wiki-exports/`** → `automecanik-wiki/exports/rag/<entity>/<slug>.md` (override auto-gen) → CI sync → `automecanik-rag/knowledge/`.

## Scripts hébergés

À créer (plan v3 §Étape 5 Groupe B) :

- `export-wiki-to-rag.py` (TODO) — lit `wiki/<entity>/<slug>.md`, strip metadata legacy (`legacy_origin_metadata`, `_legacy_full_frontmatter`), sérialise selon schema `_meta/schema/exports/rag.schema.json`, écrit `exports/rag/<entity>/<slug>.md`. Idempotent sha256.

## Wiki-generators vs Wiki-exports

- **Wiki-generators** (`scripts/wiki-generators/`) : produisent l'auto-gen direct dans `wiki/exports/rag/` (cas par défaut quand aucune fiche humaine n'existe).
- **Wiki-exports (cette catégorie)** : produisent depuis fiche humaine promue (`wiki/<entity>/<slug>.md`). Écrivent au même path, **écrasent** l'auto-gen → la version humaine prime.

## Convention OUTPUT

Frontmatter écrit :

```yaml
kind: human-derived
produced_by: <script-name>@<git-sha>
source_wiki_path: wiki/<entity>/<slug>.md
```

## Référence

- ADR-031 §D20 — wiki/exports/rag/ STRICT
- Plan v3 §Étape 5 Groupe B
