---
name: db-migration
description: Use when writing or reviewing a Supabase migration — applies safe DDL patterns (idempotent, reversible, additive-first), RLS audit, schema validation against canonical types. Triggers — "create migration X", "audit migration Y", "add RLS policy", "alter table Z safely", or any task in backend/supabase/migrations/.
type: discipline
status: stable
owners: ['@ak125']
domain: D15
runtime_class: privileged
llm_safe: false
last_verified: '2026-09-30'
license: Internal - Automecanik
compatibility: Designed for Claude Code in the AutoMecanik monorepo. Stack — Supabase + PostgreSQL. Touches backend/supabase/migrations/ and __* canonical tables. Privileged because DDL is irreversible on prod.
tags: [supabase, postgres, ddl, rls, migration, governance]
argument-hint: "[migration-name]"
disable-model-invocation: true
metadata:
  version: "1.3"
  spec: agentskills.io/specification v1
---

# Database Migration Skill

Supabase migration patterns, RLS audit, schema validation. Guides safe DDL operations against the Supabase database.

## Quand proposer ce skill

| Contexte detecte | Proposition |
|------------------|------------|
| User mentionne migration, DDL, ALTER TABLE | `/db-migration [nom]` |
| Modification schema Supabase ou RLS | `/db-migration` |
| Ajout/suppression colonne ou index | `/db-migration [table_action]` |
| Nouveau module avec tables propres | `/db-migration create_[module]_tables` |

---

## Workflow 4 Phases (OBLIGATOIRE)

### Phase 1 — Analyse

1. **Identifier l'operation** : CREATE TABLE, ALTER TABLE (ADD/DROP/RENAME COLUMN), CREATE INDEX, DROP TABLE, RLS policy
2. **Evaluer l'impact** :
   - Taille de la table cible : `SELECT pg_size_pretty(pg_total_relation_size('table_name'));`
   - Nombre de rows : `SELECT count(*) FROM table_name;`
   - Dependances : FK, triggers, RPC functions, views
3. **Classifier le risque** :

| Operation | Risque | Lock | Downtime potentiel |
|-----------|--------|------|--------------------|
| ADD COLUMN (nullable) | Bas | ACCESS EXCLUSIVE (instant) | 0 |
| ADD COLUMN (DEFAULT) | Moyen | ACCESS EXCLUSIVE (rewrite < PG14) | Minutes si table large |
| DROP COLUMN | Haut | ACCESS EXCLUSIVE | Perte de donnees irreversible |
| CREATE INDEX | Moyen | SHARE lock (bloque writes) | Minutes si table large |
| CREATE INDEX CONCURRENTLY | Bas | Pas de lock | 0 (mais plus lent) |
| DROP TABLE | Critique | ACCESS EXCLUSIVE | Perte complete |
| ALTER TYPE | Haut | ACCESS EXCLUSIVE (rewrite) | Minutes |

### Phase 2 — Plan

1. **Ecrire le SQL** de migration dans `backend/supabase/migrations/YYYYMMDD_description.sql`
2. **Ecrire le SQL de rollback** (voir section Rollback ci-dessous)
3. **Preparer les validations** before/after (voir section Data Validation)
4. **Verifier les safe patterns** (IF NOT EXISTS, timeouts, **pas** de BEGIN/COMMIT — cf. Safe Patterns)

### Phase 3 — Execute

1. Executer les queries de validation BEFORE
2. Appliquer = **decision owner** (zone STOP DB), par le seul canal gouverne : le workflow manuel
   `.github/workflows/apply-supabase-migrations.yml` (`dry_run=true` d'abord, puis `confirm=APPLY` ;
   `only_ids` pour viser un fichier). Moteur `scripts/ci/apply-supabase-migration.py`, ledger
   `infra.schema_migrations` — procedure : `backend/supabase/migrations/README.md`.
   **Jamais** `mcp__claude_ai_Supabase__apply_migration` : il ecrit dans un autre ledger
   (`supabase_migrations.schema_migrations`) que le moteur ne lit pas — le fichier reste `pending`
   et le moteur le rejouera (le README range ce canal parmi ceux qui imposent un `--baseline`).
3. Verifier l'etat au ledger : workflow en `status_only=true` (sort non-zero sur drift / applying / failed).
   Exit 0 ne prouve pas l'application — un fichier encore `pending` sort aussi 0 : lire la ligne de l'id
   (`applied`, checksum = sha256 du fichier sur `main`)
4. Executer les queries de validation AFTER

### Phase 4 — Verify

1. `mcp__supabase__list_tables` → verifier le schema
2. `mcp__supabase__get_advisors(type: "security")` → verifier RLS
3. `mcp__supabase__get_advisors(type: "performance")` → verifier index
4. Tester les queries applicatives impactees

---

## Rollback Templates

Preparer le rollback AVANT d'executer la migration :

```sql
-- Rollback: ADD COLUMN
ALTER TABLE my_table DROP COLUMN IF EXISTS new_column;

-- Rollback: DROP COLUMN (IMPOSSIBLE sans backup)
-- ⚠️ Sauvegarder les donnees AVANT :
-- CREATE TABLE _backup_my_table_col AS SELECT id, dropped_col FROM my_table;

-- Rollback: CREATE TABLE
DROP TABLE IF EXISTS my_table;

-- Rollback: CREATE INDEX
DROP INDEX IF EXISTS idx_name;

-- Rollback: ALTER TYPE
ALTER TABLE my_table ALTER COLUMN col TYPE old_type USING col::old_type;

-- Rollback: RLS policy
DROP POLICY IF EXISTS policy_name ON my_table;
```

**Regle** : Si le rollback est impossible (DROP COLUMN, DROP TABLE), **exiger confirmation utilisateur** avant execution.

---

## Backfill Strategy (tables larges)

Pour les tables > 100K rows, utiliser le batching :

```sql
-- Backfill par batch de 10K rows
DO $$
DECLARE
  batch_size INT := 10000;
  total_updated INT := 0;
  rows_affected INT;
BEGIN
  LOOP
    UPDATE my_table
    SET new_column = compute_value(old_column)
    WHERE new_column IS NULL
    LIMIT batch_size;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    total_updated := total_updated + rows_affected;
    RAISE NOTICE 'Updated % rows (total: %)', rows_affected, total_updated;

    EXIT WHEN rows_affected = 0;
    PERFORM pg_sleep(0.1);  -- Pause pour ne pas saturer
  END LOOP;
END $$;
```

**Index sur tables larges** : toujours utiliser `CONCURRENTLY` (fichier `-- @non_transactional`,
timeouts a `0` — cf. Safe Patterns) :
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON my_table (column);
```

---

## Data Validation Queries

Executer AVANT et APRES la migration :

```sql
-- Row counts
SELECT count(*) AS row_count FROM my_table;

-- Null check sur nouvelle colonne
SELECT count(*) FILTER (WHERE new_col IS NULL) AS nulls,
       count(*) FILTER (WHERE new_col IS NOT NULL) AS filled
FROM my_table;

-- Constraint check
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'my_table'::regclass;

-- Index check
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'my_table';

-- RLS check
SELECT polname, polcmd, polroles FROM pg_policy WHERE polrelid = 'my_table'::regclass;
```

---

## Migration File Location

- `backend/supabase/migrations/YYYYMMDD_description.sql`

## Pre-Migration Checklist

1. **Lint local, sans base** — il n'y a pas de base de dev separee (DB partagee, `.claude/rules/deployment.md`
   axe 4) : aucun DDL « d'essai » via `execute_sql`. `node_modules/.bin/squawk --config .squawk.toml <fichier>`
   (gate CI `Migration Safety`) + `python3 scripts/ci/apply-supabase-migration.py --lint-markers <fichier>`,
   puis le `dry_run=true` de la Phase 3
2. **Verify no breaking changes** to existing RPC functions
3. **Check RLS impact** on existing queries
4. **Verify key access patterns** — service_role (backend) vs anon (frontend)
5. **Run advisors after migration** — `mcp__supabase__get_advisors` for security + performance

## Safe Patterns

```sql
-- Pas de BEGIN; / COMMIT; : le moteur enveloppe deja chaque fichier dans une transaction
-- (squawk `assume_in_transaction = true` -> `transaction-nesting`, la CI echoue).
-- Timeouts explicites en tete (squawk `require-timeout-settings`).
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Always use IF NOT EXISTS / IF EXISTS
CREATE TABLE IF NOT EXISTS my_table (id bigint);
ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;
CREATE INDEX IF NOT EXISTS idx_new ON my_table (new_col);

-- Add comments explaining purpose
COMMENT ON TABLE my_table IS 'Description of table purpose';
```

Ce bloc passe squawk a 0 issue ; l'ancien (BEGIN/COMMIT, sans timeouts) en levait 4. Index
`CONCURRENTLY` sur une table existante : il refuse la transaction -> marqueur `-- @non_transactional`
et les deux timeouts a `0` explicites (les 60 s ci-dessus tuent le build : incident du 2026-09-04,
`.claude/rules/guardrails.md`), cf. `backend/supabase/migrations/README.md` §Non-transactional migrations.

## RLS Audit Patterns

- **Every new table MUST have RLS enabled :** `ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;`
- Verify policies cover : SELECT, INSERT, UPDATE, DELETE
- Backend uses `service_role` key (bypasses RLS)
- Frontend uses `anon` key (subject to RLS)
- After adding RLS, test with both keys

## Scheduled DB Automation — pg_cron

Pour planifier du travail **idempotent local à la donnée** (agrégats SQL/RPC, rotations de
partitions), le bon endroit est **pg_cron** (là où vit la donnée), pas une queue applicative.
Une chaîne de données PROD ne doit **jamais** dépendre d'un worker DEV (`deployment.md`).

> **Placement (quel orchestrateur ?)** : pg_cron pour le SQL/RPC déterministe DB-local.
> BullMQ/Bull (queue applicative) pour le travail à **I/O externe** (HTTP authentifié,
> secrets, retry applicatif). Un travail = **un seul** orchestrateur.

### Convergence d'un job nommé (exact-match / fail-closed)

Un `cron.schedule(...)` créé dans une migration doit **converger vers une définition
attendue ou échouer explicitement** — jamais ignorer silencieusement une dérive, jamais
écraser un état préexistant sans un `.down` capable de le restaurer :

```sql
DO $$
DECLARE v_job cron.job%ROWTYPE;
        v_cmd text := $c$/* migration:20260626_xxx */ SELECT public.my_rpc(); $c$;  -- marqueur de provenance
BEGIN
  -- garde homonyme : refuser un job de même nom appartenant à un AUTRE owner
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='my-job' AND username<>current_user)
    THEN RAISE EXCEPTION 'my-job exists under another owner'; END IF;
  SELECT * INTO v_job FROM cron.job WHERE jobname='my-job' AND username=current_user;
  IF NOT FOUND THEN
    PERFORM cron.schedule('my-job','5 * * * *',v_cmd);                 -- absent → créer
  ELSIF v_job.schedule<>'5 * * * *' OR btrim(v_job.command)<>btrim(v_cmd) OR v_job.active IS NOT TRUE THEN
    RAISE EXCEPTION 'Unexpected existing definition for my-job';       -- dérive → STOP (pas d'alter aveugle)
  END IF;  -- match exact (marqueur inclus) = no-op idempotent
END $$;
```

`.down.sql` ne `cron.unschedule` **que** le job possédé par cette migration
(`jobname + username=current_user + command LIKE '%migration:<id>%'`). Une **transition
contrôlée** d'un job préexistant (ex. resserrer un schedule) vérifie l'état EXACT attendu
avant `cron.alter_job`, et le `.down` fait l'inverse exact. Appliquer le **prédécesseur
avant** la migration de tuning (jamais un CREATE-OR-ALTER qui contredit la réversibilité).

### Preuve d'exécution (pas seulement d'existence)

Un job présent ≠ un job qui tourne. Vérifier APRÈS apply (run **postérieur** à
`migration_applied_at`, pas un statut périmé) :

```sql
SELECT current_setting('cron.log_run', true);   -- doit être 'on' pour peupler job_run_details
SELECT j.jobname, j.schedule, j.active, r.status, r.return_message, r.end_time
FROM cron.job j
LEFT JOIN LATERAL (SELECT * FROM cron.job_run_details d
                   WHERE d.jobid=j.jobid ORDER BY d.start_time DESC LIMIT 1) r ON true
WHERE j.jobname = 'my-job';
```

Gate = run `succeeded` + **sortie réelle produite** (l'effet métier existe) + **consommateur
l'observe**. `cron.timezone`/session `TimeZone` : utiliser des bornes **UTC-explicites** dans
la command (`now() AT TIME ZONE 'UTC'`), jamais un fuseau implicite.

### Baseline AVANT backfill ; swap d'orchestrateur = nettoyage d'état

- Mesurer + logger la **perte** avant tout write de récupération (fenêtre déjà perdue =
  permanente si la source a un TTL).
- Bascule d'orchestrateur (ex. Bull → pg_cron) : **supprimer l'état persistant** de l'ancien
  (repeatables Redis) sinon **double orchestrateur** silencieux. Auditer via
  `runtime-truth-audit` → `scheduled-orchestrator-drift`.

### DDL via fichier de migration + workflow a ledger, jamais execute_sql

`cron.schedule`/`cron.alter_job`/`cron.unschedule` + `CREATE OR REPLACE FUNCTION` = DDL →
fichier dans `backend/supabase/migrations/`, applique par `apply-supabase-migrations.yml`
(trace d'audit = `infra.schema_migrations`, cf. Phase 3). `execute_sql` reste pour les SELECT
de validation / backfill DML one-shot.

## MCP Tools Available

| Tool | Use |
|------|-----|
| `mcp__claude_ai_Supabase__apply_migration` | **Ne pas utiliser** pour les migrations du depot — contourne le ledger (Phase 3) |
| `mcp__claude_ai_Supabase__execute_sql` | DML/queries (SELECT, INSERT, UPDATE) |
| `mcp__supabase__list_tables` | Verify schema after changes |
| `mcp__supabase__get_advisors` | Security + performance check |
| `mcp__supabase__list_migrations` | Lit `supabase_migrations.schema_migrations`, pas le ledger du moteur — etat reel : `status_only=true` |

## Anti-Patterns (BLOCK)

- `DROP TABLE` without backup/confirmation
- `ALTER TABLE` with data loss potential (dropping columns with data)
- Disabling RLS on tables with user data
- Running DDL directly via `execute_sql` or MCP `apply_migration` — both bypass the `infra.schema_migrations` ledger (use a migration file + `apply-supabase-migrations.yml`)
- Missing `IF NOT EXISTS` on CREATE statements
- Forgetting to add RLS policies on new tables

---

## Format de Sortie

```markdown
## Migration Report — [nom_migration]

### Phase 1 — Analyse
- Table(s) cible : [liste]
- Taille : [size] / [row_count] rows
- Operation : [type]
- Risque : Bas / Moyen / Haut / Critique

### Phase 2 — Plan
- SQL migration : [resume]
- SQL rollback : [resume]
- Validations preparees : [N] queries

### Phase 3 — Execution
- Migration appliquee : OUI/NON
- Version : [timestamp]

### Phase 4 — Verification
| Check | Status |
|-------|--------|
| Schema correct | PASS/FAIL |
| RLS advisors | PASS/FAIL |
| Performance advisors | PASS/FAIL |
| Queries applicatives | PASS/FAIL |
```

---

## Interaction avec Autres Skills

| Skill | Direction | Declencheur |
|-------|-----------|-------------|
| `rag-ops` | ← recoit | Modifications schema `__rag_knowledge`, `kg_rag_*` |
| `seo-content-architect` | ← recoit | Modifications schema `__seo_*`, `pieces_gamme` |
| `code-review` | ← recoit | `/code-review` detecte des fichiers `.sql` dans le diff |
