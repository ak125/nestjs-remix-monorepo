# Supabase migrations

This directory holds every schema migration for the canonical Supabase
project. They are applied by the workflow
`.github/workflows/apply-supabase-migrations.yml` (manual trigger),
which runs the engine `scripts/ci/apply-supabase-migration.py`.

## Naming convention

```
YYYYMMDD_name_in_snake_case.sql                 # 8-digit version (date only)
YYYYMMDDHHMMSS_name_in_snake_case.sql           # 14-digit version (timestamp)
```

Filename regex: `^(\d{8}|\d{14})_([a-z0-9_]+)\.sql$`. The runner skips
anything else (with a warning) and refuses out-of-order or duplicate
version prefixes.

`.down.sql` files are **ignored** by the runner — see "Forward-only" below.

## Forward-only policy (canonical)

This project applies migrations in **one direction only**. The engine
ignores `.down.sql` siblings — they exist solely as documentation for
manual operator intervention in emergencies (e.g. wiping a broken
deploy on a staging branch).

To correct a previous migration, ship a **new migration** with a later
version that performs the correction (additive change). The tracking
table `infra.schema_migrations` is append-only (no `DELETE` grant) to
enforce this discipline.

Reference: same pattern used by Flyway, Sqitch, dbmate, golang-migrate
(forward-only mode), Prisma Migrate (`deploy` command).

## Idempotency

Every migration must be safe to **re-run as a no-op**. Use:

- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION`
- `DROP TRIGGER IF EXISTS` followed by `CREATE TRIGGER`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

The engine stores a SHA-256 checksum of each file's bytes the first
time it applies. A later run with the **same version but different
bytes** is a **HARD FAIL** (`drift` state). Append-only edits only.

## Non-transactional migrations

A handful of PostgreSQL commands refuse to run inside a transaction
block:

- `CREATE INDEX CONCURRENTLY`
- `DROP INDEX CONCURRENTLY`
- `REINDEX … CONCURRENTLY`
- `VACUUM`
- `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- `ALTER SYSTEM`

For those, add an **explicit header marker** in the first 20 lines:

```sql
-- @non_transactional
--
-- Rationale : CREATE INDEX CONCURRENTLY ne tolère pas BEGIN/COMMIT.
-- Both timeouts EXPLICIT. Omitted, a GUC inherits the ROLE default — 60 s
-- for `postgres` on this project, which killed 20260529 on 2026-09-04 at
-- 60.6 s. CONCURRENTLY's waits for other transactions count against
-- lock_timeout ; the CI job's `timeout-minutes` bounds the whole run.
SET lock_timeout = 0;
SET statement_timeout = 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foo ON public.bar (col);
```

The engine switches to autocommit, inserts a row with
`status='applying'`, runs the statements one by one, then flips the row
to `status='applied'`. A statement that errors flips it to
`status='failed'` (the error is kept in `error_message`) ; a process
killed mid-run leaves it in `'applying'`. Either row **HARD FAILs**
every later apply and dry-run (exit 5) until resolved, and `--status`
reports it (exit 1) : `failed` → `--retry ID` (cheatsheet below) ;
`applying` → a human confirms the run is really dead before touching
the row. `--retry`, `--reapply` and `--baseline` dispatch before that
gate by design (the first two are the ways out ; `--baseline` is the
adoption mode and does not repair a row).

An interrupted `CREATE INDEX CONCURRENTLY` leaves an INVALID index that
a later `CREATE INDEX CONCURRENTLY IF NOT EXISTS` silently skips — a
retryable file drops it first (`DROP INDEX CONCURRENTLY IF EXISTS`), as
`20260529_xtr_msg_crm_indexes.sql` does.

Why a marker and not a regex SQL parser : comment / dollar-quote /
PL/pgSQL bodies fool regex-based detection of `CONCURRENTLY`. The
marker is deterministic, reviewable, and dialect-agnostic.

### Marker ↔ statement reconciliation (CI gate)

The marker and the statements that need it are reconciled by the engine
itself — `--lint-markers <files…>` (no DB connection) in the CI job
*Migration Safety* on every changed forward migration, and again on every
**pending** migration before an apply / dry-run. It splits the file with
the engine's own lexical splitter (comments, strings and dollar-quoted
bodies are never mistaken for statements) and fails on :

- a non-transactional statement (`CREATE / DROP INDEX CONCURRENTLY`,
  `REINDEX … CONCURRENTLY`, `VACUUM`, `REFRESH MATERIALIZED VIEW
  CONCURRENTLY`, `ALTER SYSTEM`) **without** the marker — the engine would
  wrap it in `BEGIN/COMMIT` and Postgres rejects it (SQLSTATE 25001) ;
- the marker **without** any such statement — every statement would run in
  autocommit, losing atomicity for nothing ;
- the Supabase CLI marker `-- supabase: no-transaction` — not understood by
  this engine (incident : `20260529_xtr_msg_crm_indexes`, applied outside the
  runner and left with an invalid index) ;
- `-- squawk-ignore-file ban-concurrent-index-creation-in-transaction`
  without the marker — the squawk rule was right.

squawk keeps its own responsibility (`ban-concurrent-index-creation-in-
transaction` under `assume_in_transaction = true`, silenced **per file** with
the marker as the documented counterpart). Files already at the ledger are
immutable (checksum) and out of scope by construction.

## CLI cheatsheet

```bash
# Status table (read-only, exits non-zero on drift / applying / failed)
python3 scripts/ci/apply-supabase-migration.py --status

# Dry-run apply (no writes)
python3 scripts/ci/apply-supabase-migration.py --dry-run

# Apply
python3 scripts/ci/apply-supabase-migration.py

# Apply at most N migrations (staged rollout)
python3 scripts/ci/apply-supabase-migration.py --limit 1

# Apply exactly these pending ids (comma-separated), in file order, nothing
# else. Refuses an unknown id or one already at the ledger (exit 10) and
# prints the pending migrations it steps over — the engine does not know
# dependencies, that judgement stays with you.
python3 scripts/ci/apply-supabase-migration.py \
  --only 20260605_vlevel_capture_db_only_functions,20260611_quality_features_r3_guide_semantics

# Re-run ONE migration whose row is 'failed', reopening that row in place
# (never a second row). Accepts @non_transactional files and a file amended
# since the failure — fixing the cause usually means editing it ; the
# previous checksum / runner / git_sha / started_at / error are kept in
# `note`. Refuses any other state (exit 11). Needs the table owner.
python3 scripts/ci/apply-supabase-migration.py --retry 20260529_xtr_msg_crm_indexes

# Re-execute ONE 'applied' migration whose row is in drift, then rewrite the
# row from the run. Transactional files only, and no statement that would
# misbehave on a second run. Needs the table owner.
python3 scripts/ci/apply-supabase-migration.py --reapply 20260518_seo_admin_job_table

# Baseline : mark every local file as applied WITHOUT running it.
# Use ONCE when adopting this engine on a project where migrations are
# already deployed via another channel (Supabase dashboard, MCP, psql).
# Combine with --exclude to keep specific files genuinely pending.
python3 scripts/ci/apply-supabase-migration.py --baseline \
  --exclude 20260518_seo_admin_job_table

# Self-tests (no DB connection)
python3 scripts/ci/apply-supabase-migration.py --self-test

# Reconcile `-- @non_transactional` with the statements of given files (no DB)
python3 scripts/ci/apply-supabase-migration.py --lint-markers \
  backend/supabase/migrations/20260529_xtr_msg_crm_indexes.sql
```

`DATABASE_URL` must be set in env for the non-`--self-test` modes.

## Tracking table

```sql
CREATE SCHEMA IF NOT EXISTS infra;

CREATE TABLE IF NOT EXISTS infra.schema_migrations (
  id             TEXT PRIMARY KEY,                       -- filename stem, e.g. "20260518_seo_admin_job_table"
  checksum       TEXT NOT NULL,                          -- sha256(file bytes)
  status         TEXT NOT NULL DEFAULT 'applied'
                 CHECK (status IN ('applying', 'applied', 'failed')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at     TIMESTAMPTZ,
  execution_ms   INTEGER,
  runner         TEXT,                                   -- ex: gh-actions:25965...
  git_sha        TEXT,
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_status
  ON infra.schema_migrations (status)
  WHERE status IN ('applying', 'failed');

-- Audit trail for --reapply / --retry : why a row was rewritten, and what it
-- held before. Additive and idempotent.
ALTER TABLE infra.schema_migrations ADD COLUMN IF NOT EXISTS note TEXT;

GRANT SELECT, INSERT ON infra.schema_migrations TO service_role;
GRANT UPDATE (status, applied_at, execution_ms, error_message, note)
  ON infra.schema_migrations TO service_role;
-- No DELETE grant : append-only ledger.
```

`--retry` also rewrites `checksum`, `started_at`, `runner` and `git_sha` ;
`--reapply` rewrites `checksum`, `runner` and `git_sha`. The column-scoped
grant deliberately leaves those out : both need the table owner (the
`DATABASE_URL` the engine bootstraps with) and refuse a lesser role with
exit 9 before touching the row.

Why our own schema and not `supabase_migrations.schema_migrations` :
the `supabase_migrations.*` schema is a Supabase **internal** that may
mutate without notice (added columns, renamed fields, semantic shifts).
Vendor coupling avoided.

## Concurrency

The engine acquires `pg_try_advisory_lock(88442211)` at start. If
another runner already holds it the workflow **fails fast** with a
clear message rather than blocking the runner. The lock is
session-scoped — auto-released on disconnect or crash.

## Phase1 — reconciliation preparee le 15 octobre 2026

Périmètre : préparation et qualification isolée du raccordement **brief approuvé →
contenu Social Hub versionné → approbation par réseau**. Ce dossier n'autorise
aucune intervention sur une base partagée, activation de relance ou publication.
La migration historique `20260430_marketing_layer_phase1.sql` reste inchangée.

### Trois responsabilités distinctes

| Bloc livré dans Phase1 | Contrat réel | Décision pour le raccordement Social Hub |
| --- | --- | --- |
| `__marketing_brief` | Brief, états, gates, lien vers le post social ; sept canaux dont Facebook et Instagram | Nécessaire. Réutiliser la préparation ciblée existante et les trois migrations ci-dessous. |
| `__retention_trigger_rules` | Fidélisation : fenêtres depuis la dernière commande, template, `active DEFAULT true` ; quatre seeds actives | Hors réparation minimale. Ne pas rejouer ce bloc ni activer les seeds pour débloquer les briefs. |
| `___xtr_customer.cst_marketing_consent_at` | `timestamptz NULL`, sans défaut, index partiel sur les valeurs non nulles | Hors réparation minimale. Ne pas inférer un consentement des commandes, comptes ou anciennes campagnes. |

« Rétention » désigne ici les **relances clients**, pas la conservation des données
personnelles. Phase1 ne définit aucune durée de conservation, purge ou preuve
d'effacement. Les fenêtres historiques (freinage 180–365 jours, vidange 270–365,
batterie 1095–1825, filtres habitacle 365–540) sont des seeds de segmentation ;
elles ne prouvent ni un intervalle d'entretien adapté à chaque véhicule ni une
validation métier. Aucune nouvelle durée n'est introduite dans ce lot.

Les commentaires historiques annoncent un CRUD `/admin/marketing/retention-rules`,
un consommateur et une collecte du consentement par profil/checkout. La recherche
dans le backend et frontend du candidat n'a pas identifié leur implémentation
avec ces objets. Les commentaires ne prouvent pas leur fonctionnement. Le pilote
`scripts/marketing/reactivation-pilot.ts` conserve ses fixtures et contrôles
synthétiques de marque, finalité, canal, date, opposition et limites ; il n'est
pas raccordé à ces tables. Les capacités live restent indisponibles dans
`marketing-operations.ts` et `retention_policy` reste à décider.

Pour reprendre ultérieurement les relances : identifier les consommateurs et
écrivains réels, la source des contacts, le périmètre marque/finalité/canal, la
preuve de collecte, la version du texte présenté et le retrait/opposition. Un
timestamp seul ne porte pas tout ce contrat ; une approbation éditoriale de post
ne vaut pas consentement du destinataire. Décider séparément la conservation par
catégorie de données, la purge/anonymisation, les exclusions, limites et arrêt
d'urgence. Réutiliser les sources existantes après inventaire ; aucun registre de
consentement parallèle ni backfill présumé n'est créé ici. Cette liste décrit des
besoins de raccordement, pas une validation juridique ou métier acquise.

### Registres et preuve de schéma

La capture historique du 14 octobre 2026 à 22:18:28 UTC montrait Phase1 `applied`
dans `infra.schema_migrations`, avec `runner=baseline-2026-05-16` et
`execution_ms=0`, alors que brief, règles de relance et colonne de consentement
étaient absents. Cette capture n'est **pas** une lecture actuelle du schéma partagé.
Une baseline enregistre un état déclaré, elle n'exécute pas le SQL.

`infra.schema_migrations` suit les fichiers/checksums du moteur du dépôt ;
`supabase_migrations.schema_migrations` est le registre interne Supabase. Ils ne
doivent pas être synchronisés ligne à ligne, ni vidés, ni artificiellement rendus
identiques. Ne pas `--baseline`, `--reapply`, `--retry` Phase1 ou utiliser un
`migration repair` pour masquer cette divergence. Un correctif limité aux briefs
ne constitue pas l'application des trois blocs historiques.

### Préparation hors ligne et contrôle préalable

Depuis la racine du dépôt, choisir deux **nouveaux** chemins de sortie :

```bash
python3 scripts/db/inventory-marketing-tables.py --prepare-phase1 preflight.sql
python3 scripts/db/apply-migration-marketing-phase1.py --prepare-brief-social brief-social-prerequisite.sql
```

Ces modes ne lisent ni `.env` ni secret et n'ouvrent aucune connexion. Ils refusent
d'écraser un fichier. Le prérequis épingle le hash UTF-8/LF de Phase1
`b498fd24ab534abfffe0c55011c1af14a1a675fda627a06db7a39a47b04a7e8b`.
Le préflight embarque le hash de sa source SQL.

Sur une cible explicitement autorisée, le contrôle préalable se lance avec
`psql -X -qAt -v ON_ERROR_STOP=1 -f preflight.sql` et une connexion définie par
l'opérateur (ne pas inscrire de secret dans le dossier de preuve). Sa transaction
`REPEATABLE READ READ ONLY`, ses délais de 15 s/2 s et son `ROLLBACK` sont dans le
SQL. Il lit les métadonnées des six tables pertinentes, types/défauts/nullabilité,
contraintes, index, RLS/policies, privilèges effectifs dont hérités/de colonne,
triggers, dépendances et les deux registres. Il n'exporte aucune ligne client.
Il expose les différences ; il ne décide pas automatiquement de leur conformité.
Un registre absent/inaccessible, une erreur SQL ou un dépassement de délai est un
**arrêt du diagnostic**, jamais un schéma réputé vide. L'inventaire historique sans
option continue à cibler le projet partagé ; ne pas le confondre avec le mode de
préparation hors ligne.

### Ordre candidat et conditions d'arrêt

1. Revalider cible/environnement, HEAD et diff, empreintes, sauvegarde/restauration,
   état des deux registres et métadonnées fraîches. Examiner aussi les consommateurs
   sur les autres candidats/checkpoints avant toute extension des relances.
2. Si le brief **et** `fn_marketing_brief_updated_at()` sont absents et si le contrat
   social/RLS attendu correspond, qualifier le prérequis ciblé. Il crée uniquement
   le bloc brief et retire les écritures directes anon/authenticated du post social.
   Il refuse les objets partiels, policies inattendues, verrou occupé ou privilèges
   d'écriture résiduels. Il ne touche ni client, ni relance, ni registre.
3. Qualifier ensuite, dans cet ordre et avec le moteur transactionnel existant :
   `20261014010000_marketing_social_reviews`,
   `20261014091855_marketing_publication_preparations`,
   `20261014172953_marketing_brief_social_link`.
4. Le correctif enregistré décrit ci-dessous remplace l'extrait de revue pour un
   futur passage par le moteur. Garder l'extrait pour ses consommateurs de tests
   existants ; ne pas l'exécuter en production hors registre. Revalider les preuves
   et l'autorisation de cible avant une application partagée. Conserver l'historique
   de la baseline ; ne pas marquer Phase1 intégralement réparée.
5. Comparer le schéma après application au contrat attendu et vérifier les refus
   anonyme/client, les conflits de version et les approbations par réseau sur
   l'image candidate. Un résultat SQL ne remplace pas cette preuve applicative.

Si un bloc est déjà présent, comparer sa définition et ses consommateurs :
`IF NOT EXISTS` ne réconcilie pas un type, une contrainte ou une policy incorrecte.
Ne pas appliquer la préparation prévue pour un schéma absent à un schéma partiel.
Pour un éventuel lot rétention/consentement, arrêter si defaults, nullabilité,
privilèges, provenance ou activation attendue ne sont pas explicitement décidés.

Retour arrière : avant commit, rollback de la transaction fautive. Après commit,
arrêter le parcours affecté, revenir à l'image précédente si compatible et garder
les données/objets ajoutés ; préparer une correction en avant ou une restauration
testée selon l'incident. Aucun `DROP` de table client/brief, effacement de consentement
ou restauration globale automatique. Le verrou moteur est partagé avec la
préparation ; ne pas lancer deux runners en concurrence.

### Vérification réutilisable

```bash
python3 scripts/db/test-marketing-phase1-inventory.py
python3 scripts/db/test-marketing-brief-preparation.py
# Hôte de qualification uniquement ; image déjà présente, pas de pull automatique.
python3 scripts/db/test-marketing-phase1-inventory-postgres.py
```

Le dernier test crée son propre Postgres avec réseau `none`, aucun port publié,
mémoire/CPU bornés, stockage temporaire et données synthétiques ; il ne prend pas
de DSN externe et supprime uniquement son conteneur à la fin. Il réutilise la
fixture `output/marketing-image-isolated/captured-schema.sql` de la qualification
précédente ; les résultats sont dans `output/marketing-phase1-scope/`. Les tests du
rejeu **complet** y servent à prouver ses effets, pas à le sélectionner pour la
réparation partagée.

### Migration corrective enregistrable après le relevé frais

Relevés du **14 octobre 2026 à 23:46:53 et 23:47:34 UTC** (15 octobre heure de
Paris), projet `massdoc` : transaction `READ ONLY`, PostgreSQL 17.6, 341 entrées
infra et 474 Supabase. Brief, fonction de trigger du brief, règles de relance,
colonne de consentement, historique social et préparations de publication absents.
La baseline Phase1 reste `applied`, checksum historique inchangé, runner
`baseline-2026-05-16`, durée 0. Les trois migrations Social Hub ne sont inscrites
dans aucun registre. Le post social conserve sa policy `service_role_all`, mais
anon/authenticated ont encore des grants directs d'écriture : la réparation les
retire ; les consommateurs utilisant ces rôles doivent être recontrôlés avant application.
Le parcours service_role a été qualifié en isolation. Ces relevés sont datés, à renouveler
avant toute exécution. Aucune donnée client n'a été lue.

Migration créée avec le CLI Supabase 2.81.3 existant :
**`20261014234956_marketing_brief_prerequisite_reconciliation.sql`**.
Le timestamp est UTC. Le corps est généré par le préparateur existant :

```bash
python3 scripts/db/apply-migration-marketing-phase1.py --prepare-brief-social-migration corrective-review.sql
```

Cette forme reprend le contrat brief/ACL vérifié, ajoute un contrôle de la baseline
observée, et laisse **la transaction et l'inscription du checksum au moteur**.
Elle ne contient pas de `BEGIN/COMMIT` de transaction, ni d'écriture directe dans les
registres. Le test du préparateur compare le fichier versionné au SQL généré pour
éviter deux copies divergentes. L'ancien mode `--prepare-brief-social` reste un
artefact de revue autonome pour les tests existants.

Le job existant `Migration Safety` lance aussi, sans condition sur les seuls SQL
modifiés, les suites hors ligne du moteur transactionnel, du préparateur et de
l'inventaire Phase1. Il ne régénère pas le fichier avant de le comparer et n'utilise
aucun secret ni connexion DB pour ces suites.

Squawk 2.52.1 a signalé six compteurs `integer` du contrat historique et l'index
du lien brief-social. Les exceptions sont documentées dans les deux fichiers :
`prefer-bigint-over-int` sur le correctif généré et contrôlé à l'identique, et
`require-concurrent-index-creation` sur cette seule instruction d'index. Les types
Phase1 restent inchangés. L'index reste atomique avec son contrat, mais bloque les
écritures pendant sa construction : attente de verrou bornée à 5 s, instruction à
30 s. Si le brief a déjà été alimenté ou subit des écritures concurrentes, arrêter
et revoir une création concurrente séparée avant exécution ; ne pas augmenter les
délais pour forcer le passage. La configuration globale du linter reste inchangée.

**Ordre de qualification et futur ordre opérateur, sous autorisation séparée :**

```bash
# 1. Sur la cible isolée/autorisée, avec DATABASE_URL fourni par l'opérateur.
python3 scripts/ci/apply-supabase-migration.py --only 20261014234956_marketing_brief_prerequisite_reconciliation

# 2. Après vérification du schéma ET de la nouvelle ligne/checksum du correctif.
python3 scripts/ci/apply-supabase-migration.py --only 20261014010000_marketing_social_reviews,20261014091855_marketing_publication_preparations,20261014172953_marketing_brief_social_link
```

Ces deux étapes réutilisent aussi l'entrée `only_ids` du workflow manuel existant
`apply-supabase-migrations.yml` ; aucune automatisation n'est ajoutée ni déclenchée.
**Ne pas réunir les quatre identités dans un seul appel** : le moteur trie par
fichier et non par ordre de saisie. Le correctif est plus récent que les trois
candidats ; une sélection combinée tente d'abord les reviews et échoue sur leurs
prérequis. Ne pas renommer les candidats ni antidater le correctif pour contourner
cet ordre. Le mode `--dry-run` du moteur peut initialiser son registre : le contrôle
partagé strictement en lecture seule reste le préflight SQL, pas un dry-run supposé
sans écriture.

Postconditions : une ligne infra nouvelle portant le checksum exact du correctif,
puis trois lignes pour les exécutions réelles des candidats ; aucune modification
des 341 entrées historiques ni des 474 entrées Supabase. Le service_role peut utiliser
le brief et le lien Social Hub ; les grants directs anon/authenticated ne permettent
pas leurs écritures. Aucun objet rétention/consentement créé. Une erreur de registre
doit annuler aussi le DDL et les grants du correctif ; un rejeu enregistré est refusé.

Limite de portée : la qualification reproduit les métadonnées marketing et les
registres sur des données synthétiques, pas le schéma entier ni la configuration
de tous les consommateurs. Les objets partiels, une autre baseline, une policy
inattendue ou des droits d'écriture hérités font arrêter la migration au lieu d'être
normalisés silencieusement. La migration historique Phase1 n'est pas modifiée.
