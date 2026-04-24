---
scope: RAG tables & sync
sources:
  - backend/supabase/migrations/**/20260313_rag_documents_v2.sql
  - backend/supabase/migrations/**/20260125_kg_v3_rag_sync.sql
last_scan: 2026-04-24
---

# Tables RAG (Supabase projection)

Le RAG canonique vit dans Weaviate (`/opt/automecanik/rag/`). Ces tables Supabase sont
la projection structurée (métadonnées, audit, lifecycle) avec tsvector français.

## Tables

| Table | Rôle |
|---|---|
| `rag_documents` | Documents RAG : truth_level, domain, lifecycle_status, hashes MD5/SHA, frontmatter JSONB. Fulltext tsvector FR. |
| `rag_document_versions` | Historique immutable de toute version (append-only). |
| `rag_job_history` | Log des ingestions (par job, par source). |
| `kg_rag_sync_log` | Sync KG ↔ RAG (depuis 20260125). |
| `__rag_knowledge` | Miroir hash des `.md` dans `/opt/automecanik/rag/knowledge/`. Script `sync-rag-knowledge.ts`. |
| `__rag_proposals` | **Stage 0 ADR-022 (2026-04-23)** — propose-before-write pour éviter écritures hallucinées RAG. RLS actif. |

## Pipeline d'ingestion

```
Markdown/PDF  →  Python ingestor  →  Weaviate (embeddings all-MiniLM-L6-v2)
               + hash MD5/SHA       ↓
                                 rag_documents (Supabase projection)
                                    ↓
                                 trg_rag_content_changed → poll 60s → ContentMerger (merge-only)
```

## Feature flags actifs

- **Stage 1 A10 propose-before-write** : `RagProposalService` + flag (MEMORY : `adr-022-vehicle-page-cache` trail)
- **Stage 0 migration** : `__rag_proposals` + tests + RLS audit (commit 598d4b63)

## Gotchas

- Les embeddings Weaviate sont `all-MiniLM-L6-v2` (384 dims), pas OpenAI
- `rag_documents` ne stocke PAS les embeddings, uniquement métadonnées
- Le RAG **n'indexe PAS le code** (contenu métier uniquement). Pour le code → `.claude/knowledge/`
- Sync `knowledge/` → `__rag_knowledge` par hash MD5 (pas par mtime — git-safe)
- Transforms Supabase **désactivées** (voir MEMORY.md `supabase-cleanup-2026-03.md`)

## Règles associées

- MEMORY.md : `rag.md`, `rag-foundation-baseline.md`, `rag-enrichment-pipeline.md`, `rag-pipeline-strategy.md`
- ADR-022 : propose-before-write (vault)
- Circuit breaker : `RagProxyModule.services.CircuitBreaker`
