# scripts/wiki-generators/

Scripts qui **produisent du contenu candidat** pour `automecanik-wiki/` en lisant des sources externes (Wikidata, Wikipedia, OEM PDFs, DB Supabase).

> Pipeline canon (ADR-031 §D20) :
> `automecanik-raw/` (sources brutes) → **`scripts/wiki-generators/`** → `automecanik-wiki/exports/rag/<cat>/<slug>.md` → CI sync → `automecanik-rag/knowledge/<cat>/<slug>.md` (mirror read-only).

## Scripts hébergés

| Script | Input | Output (cible plan v3 §Étape 5) |
|---|---|---|
| `brand-fiche-generator.py` | Wikidata SPARQL + Wikipedia REST + Supabase RPC | `wiki/exports/rag/constructeurs/<slug>.md` |
| `gamme-from-web-corpus-generator.py` | `automecanik-raw/recycled/rag-knowledge/web/` | `wiki/exports/rag/gammes/<slug>.md` |
| `gamme-from-db-template-generator.py` | Supabase RPC `__rag_knowledge` (template DB) | DB Supabase `__rag_knowledge` table (pas filesystem) |

## Convention OUTPUT

Chaque générateur écrit un frontmatter qui inclut :

```yaml
kind: generated
produced_by: <script-name>@<git-sha>
produced_at: <iso>
target_consumer: rag
```

Pour traçabilité dans le mirror downstream.

## Wiki-exports vs Wiki-generators

- **Wiki-generators (cette catégorie)** : produisent l'auto-gen direct dans `wiki/exports/rag/`
- **Wiki-exports** (`scripts/wiki-exports/`) : transforment `wiki/<entity>/<slug>.md` (humain promu) → `wiki/exports/rag/<entity>/<slug>.md`. Override l'auto-gen si présent (la version humaine prime).

## Référence

- ADR-031 — Raw / Wiki / RAG / SEO Separation
- Plan v3 (`/home/deploy/.claude/plans/je-comprend-rien-a-spicy-reddy.md`)
