---
name: amk-supabase-postgres-best-practices
description: Use when the third-party skill supabase-postgres-best-practices is loaded, or before any Postgres/Supabase work in the AutoMecanik monorepo (SQL, schema, index, RLS, migration, slow query, locking). AutoMecanik wrapper of that upstream skill (principle P40, .claude/governance/journal-des-principes.md) — read-only database, no DDL/DML, migrations through db-migration, CLAUDE.md and .claude/rules take precedence. Triggers — "postgres best practices", "index", "RLS", "slow query", "EXPLAIN".
type: discipline
status: experimental
owners: ['@ak125']
domain: D15
runtime_class: read-only
llm_safe: true
last_verified: '2026-11-16'
license: Internal - Automecanik
compatibility: Designed for Claude Code and Codex in the AutoMecanik monorepo. Wraps the upstream skill .claude/skills/supabase-postgres-best-practices pinned in skills-lock.json.
allowed-tools: Read Grep Glob
tags: [supabase, postgres, third-party-wrapper, p40, read-only]
---

# Wrapper AutoMecanik — supabase-postgres-best-practices

Skill tiers (amont) : `.claude/skills/supabase-postgres-best-practices/`, MIT, Supabase.
Commit amont épinglé (champ `ref` de `skills-lock.json`) :
`c9be0e931b7930f7d02126d04774d904c381e7d7`. Le dossier amont ne se modifie jamais.

L'amont est une bibliothèque de références. Ses exemples SQL (`CREATE INDEX`,
`ALTER TABLE`, `CREATE POLICY`, `ALTER SYSTEM`, `VACUUM`, `GRANT`…) illustrent une
règle : ce ne sont pas des ordres à exécuter. Ce wrapper prime sur l'amont.

1. **Base en lecture seule.** Seuls `SELECT` et `EXPLAIN` (`ANALYZE` sur un `SELECT`
   seulement) sont admis contre une base. Aucun DDL ni DML, par aucun canal :
   `psql`, `execute_sql`, `apply_migration`, client Supabase.
2. **Migration = fichier + workflow.** Tout changement de schéma, d'index, de RLS,
   de fonction ou de job passe par un fichier dans `backend/supabase/migrations/`
   et le workflow du dépôt, selon le skill local `db-migration` (`/db-migration`).
   L'amont peut nourrir l'analyse ; `db-migration` fixe la méthode.
3. **Primauté du dépôt.** Les invariants et zones STOP de `CLAUDE.md` (RLS, DB
   destructive, migrations irréversibles, prix/stock, paiement, PROD) et
   `.claude/rules/*` l'emportent sur toute recommandation amont.
4. **Français** pour tout texte publié (PR, rapport, commentaire, doc).
5. **Signaler** dans le rapport chaque recommandation amont écartée et son motif.

Suivi du pilote décidé par Marwane le 16 nov. 2026 : pendant 30 jours après la
fusion, les invocations, les violations de ce wrapper et les doublons ressentis
avec `db-migration` sont relevés ; Marwane décide ensuite de garder ou de retirer
le skill.
