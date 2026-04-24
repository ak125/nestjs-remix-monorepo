---
scope: RPCs critiques
last_scan: 2026-04-24
---

# RPCs Supabase critiques

## ADR-017 RPC cleanup (LIVE depuis 2026-04-21)

Phase 1 terminée : RPC #1 gain -96% (395ms vs 10.5s baseline). Index 2.6 GB.
8 RPCs restantes à valider J+1 via `pg_stat_statements` avant RPC #2.

**Règle canon** : pour `CREATE INDEX CONCURRENTLY` ou queries > 60s,
utiliser `scripts/db/adr017-create-index-concurrently.py` (Python psycopg2,
port 5432, autocommit, `statement_timeout=0`). MCP Supabase ne le supporte pas.

## RPCs SEO

| RPC | Rôle | Notes |
|---|---|---|
| `match_keyword_text_to_vehicle(p_text)` | Extrait véhicules d'un keyword texte (cas anciens : 2cv, 4L, C15, Espace, Xantia, Saxo...) | PR #132. Remplace regex hardcodé du script `insert-missing-keywords.ts`. |
| `extract_vehicle_keywords(pg_id)` / `_batch(text[])` | Batch : keyword → vehicles + type_ids | STABLE, cache-friendly. |
| `sgpg_gatekeeper_*` | Gate R6 (symétrie R1) | PR #130. Protège Purchase Guide gamme contre insertion sans gate. |

## RPCs Véhicule & compatibilité

| RPC | Rôle | Notes |
|---|---|---|
| `get_piece_detail(piece_id_i)` | Détail pièce + média + compat | Cache Redis 10 min. |
| `compat_vehicle_piece(type_id, piece_id)` | Test compat bool | Pas de FK (design imposé par le flux fournisseur). |
| V-Level classification | SQL port depuis Python archivé | Script `scripts/seo/rebuild-type-vlevel.py` (canon, PR #131). |

## RPCs Recherche

| RPC | Rôle | Notes |
|---|---|---|
| `search_unaccent_*` | Recherche texte sans accents | Utilisé par diagnostic-engine |
| `diagnostic_search(q)` | Branche sur `__diag_*` (13 systèmes, 62 symptômes, 30 ops entretien) | 97 sessions, unaccent. |

## Gotchas RPC

- **Jamais `DROP FUNCTION` sans validation** (voir MEMORY.md, DB protection)
- **RPC batch KP DROPPED** — remplacées par NestJS. Moteur agentique déprécié pour KP
- **type_display filter** : utiliser `type_display` (pas `type_relfollow`) dans vehicle-rag-generator (fix commit 729ff632)
- **Cache invalidation** : après update via RPC, flush Redis pattern approprié

## Règles associées

- MEMORY.md : `adr-017-rpc-cleanup.md`, `adr-016-vehicle-page-cache.md`
- Vault knowledge `mcp-vs-python-direct-pg.md` : limitations MCP pour DDL + queries > 60s
- Scripts canon : `scripts/db/adr017-*.py`, `scripts/seo/rebuild-type-vlevel.py`
