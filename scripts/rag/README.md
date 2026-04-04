# scripts/rag/ — Scripts domaine RAG

Source de vérité : [`.spec/00-canon/repo-map.md`](../../.spec/00-canon/repo-map.md)

Ce répertoire contient les scripts opérant directement sur le corpus RAG :
fichiers `.md` dans `/opt/automecanik/rag/knowledge/`, table `__rag_knowledge` Supabase, index Weaviate.

## Règle de nommage

`rag-*.py` pour les scripts d'opération RAG (enrichissement, ingestion, vérification).

## Prérequis

- `INTERNAL_API_KEY` (dans `backend/.env`) — auth machine-to-machine vers NestJS
- `DATABASE_URL` — accès Supabase direct
- Container `rag-api-prod` actif (pour reindex via pipeline API)

## Scripts migrés (Phase F — 2026-04-04)

| Script | Rôle |
|--------|------|
| `download-oem-corpus.py` | Télécharge corpus OEM depuis Wikipedia + sources web par gamme |
| `rag-enrich-from-web-corpus.py` | Enrichit les fichiers `.md` gammes avec le corpus téléchargé (bloc `phase5_enrichment`) |
| `ingest-oem-enriched-gammes.py` | Ingère les blocs `phase5_enrichment` (statut `oem_verified`) vers `__rag_knowledge` via `POST /api/rag/internal/ingest/manual` |

Ces 3 scripts forment le **pipeline Phase F** orchestré par `/opt/automecanik/rag/scripts/pipeline/run-phase-f.sh`.

## Scripts encore dans `scripts/seo/` (migration chantier séparé)

Les scripts suivants opèrent sur le domaine RAG mais n'ont pas encore été migrés :

| Script | Rôle |
|--------|------|
| `rag-check.py` | Vérifie l'état des fichiers RAG |
| `rag-enrich-from-db.py` | Enrichit les `.md` depuis la DB Supabase |
| `rag-enrich-from-purchase-guide.py` | Enrichit depuis les purchase guides |
| `rag-enrich-metier-templates.py` | Enrichit avec des templates métier |
| `rag-fill-frontmatter-gaps.py` | Complète les frontmatters manquants |
| `rag-upgrade-v4.py` | Migration vers format V4 |

Migration complète des 26 scripts RAG = chantier séparé.
