---
integration: Supabase
project_id: cxpojprgwgubzjyqzmoq
last_scan: 2026-04-24
---

# Intégration Supabase

## Projet

- **Project ID** : `cxpojprgwgubzjyqzmoq`
- **DB size** : 221 GB
- **Storage** : ~101 GB (Transforms DÉSACTIVÉES)

## Accès côté app

- `SupabaseBaseService` (base NestJS)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (backend)
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (frontend SSR)

**PAS de Prisma.** Tout passe par `supabase.from().select().eq()` ou `supabase.rpc()`.

## RLS & sécurité

- **ADR-021 RLS Hardening MERGED** (PR #42, 2026-04-23) : 204 objets DB hardenisés sur 2 jours + INC-2026-011 (admin password hashes leak via anon key).
- Weekly-lint post-merge : 0 new findings (ADR-020, cron Mon 02:00 UTC).
- Collision ID INC-2026-009 résolue via règle FIFO (PR #36 garde 009, PR #42 → 011, PR #40 Paybox = 010).

## Accès MCP

- MCP Supabase connecté (`mcp__supabase__*` outils)
- **Règle** : PAS de DROP/TRUNCATE sans validation humaine explicite
- **Limitation MCP** : pas de `CREATE INDEX CONCURRENTLY`, pas de queries > 60s → utiliser Python psycopg2 direct (port 5432, autocommit, `statement_timeout=0`). Voir vault knowledge `mcp-vs-python-direct-pg.md`.

## Migrations

- Path : `backend/supabase/migrations/*.sql`
- Nommage : `YYYYMMDD_<verbe>_<feature>.sql`
- Appliquer via `mcp__supabase__apply_migration` OU script direct psycopg2 pour DDL lourd

## Storage

- Buckets organisés (voir MEMORY.md `supabase-cleanup-2026-03.md`)
- Cleanup 2026-03 : -77 GB DB, -105 GB Storage
- Transforms **DÉSACTIVÉES** (ne pas réactiver sans ADR)

## Gotchas

- Service role key JAMAIS dans le code frontend (anon key only côté client)
- RLS activée sur toutes les tables métier récentes (si ajout nouvelle table, prévoir RLS dans la migration)
- Cleanup historique : 38 tables + 44 RPC supprimées vers schema `_archive` (MEMORY.md `db-cleanup.md`)

## Règles associées

- MEMORY.md : `db-governance.md`, `supabase-cleanup-2026-03.md`, `db-cleanup.md`, `adr-017-rpc-cleanup.md`, `adr-021-db-rls-hardening.md`
- ADR-015 : Vault is SoT
- `.claude/rules/backend.md` — pas de Prisma
