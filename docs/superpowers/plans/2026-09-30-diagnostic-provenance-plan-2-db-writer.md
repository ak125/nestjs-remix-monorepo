# Provenance diagnostic — Plan 2 : tables de provenance, RPC d'application et writer (drapeau OFF)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** projeter `exports/diagnostic/` du WIKI dans une table de provenance `__diag_link_provenance` rattachée aux liens existants de `__diag_symptom_cause_link`, par une seule RPC transactionnelle et un writer NestJS désactivé par défaut — sans jamais créer, modifier ni supprimer un lien.

**Architecture:** une migration additive crée trois tables réservées à `service_role` (`__diag_projection_runs`, `__diag_projection_conflicts`, `__diag_link_provenance`) et la RPC `__diag_projection_apply(jsonb)` : SECURITY INVOKER, verrou consultatif, `FOR SHARE` sur les liens, retrait doux. Le module NestJS `DiagnosticProjectionModule` pré-valide tout l'export (index haché, fichiers listés, enveloppes), lit le référentiel actif page par page à compte exact, résout chaque relation en exactement une projection ou un conflit (fonction pure), puis appelle la RPC une fois, derrière la gate RPC. BullMQ planifie un run nocturne quand `DIAGNOSTIC_PROJECTION_ENABLED` est ON ; le processor re-vérifie le drapeau au moment du job ; un endpoint admin déclenche un run ponctuel, soumis au même drapeau.

**Tech Stack:** PostgreSQL 17 (docker `postgres:17-alpine`, `--network none`) et squawk (version lue dans `ci.yml`) ; NestJS 11, `@nestjs/bull`, Zod 4, jest + ts-jest ; `node:test` + tsx (ratchet) ; Python 3 + PyYAML + jsonschema (frontmatter d'ADR) ; ajv-cli 5 (registre L2).

**Spec:** `docs/superpowers/specs/2026-09-30-diagnostic-wiki-provenance-design.md` — §4.4 (DB), §4.5 (writer), §4.8 (registre, partie projection), §4.9 (ADR-035), §7 (tests), §9 étapes 1, 2 (partie projection), 5 et 6. Les écarts de ce plan par rapport à la première rédaction de la spec y sont reportés en §14 (« Révisions lors de la planification »).

**Plans frères :** Plan 1 — export WIKI + transport (`2026-09-30-diagnostic-provenance-plan-1-wiki-export.md`) : ses Tâches 4 et 5 produisent `exports/diagnostic/` dans le pin du sous-module, que la Tâche 9 de ce plan consomme. Plan 3 — script d'environnement PROD, moteur et frontend (`2026-09-30-diagnostic-provenance-plan-3-engine.md`), différé.

**Résultat attendu au lancement** (canon WIKI `6e3a043`, 3 relations exportées, toutes leurs sources en `raw_proven: false`) : premier run `applied` avec `exported_count=3`, `projected_count=0`, `conflict_count=3` (raison `source_not_raw_proven`), `retired_count=0`. Aucune provenance écrite, aucun lien touché. Rien ne change pour le moteur ni pour le frontend : c'est le Plan 3.

**Hors tâche :** la régénération des types DB. `generate:types` n'est qu'un `echo` dans `packages/database-types/package.json` ; le contrat de retour de la RPC est porté par le schéma Zod `ApplyResultSchema` (Tâche 3), et le contrat SQL par le harnais (Tâche 1).

## Global Constraints

- La projection ne crée, ne modifie ni ne supprime aucune ligne de `__diag_symptom_cause_link`, `__diag_symptom`, `__diag_cause` ou `__diag_system`. Elle n'écrit que dans les trois nouvelles tables, et seulement par `__diag_projection_apply` (plus l'insertion d'un run `failed` par le writer).
- `reviewed`, `diagnostic_safe` et `raw_proven` sont **recopiés** depuis l'export, jamais calculés ni basculés. Aucun `is_trusted`, aucune colonne d'état ajoutée aux liens.
- Une relation exportée aboutit à exactement une ligne : projection ou conflit. Un run `applied` vérifie `exported_count = projected_count + conflict_count` (contrainte CHECK). Zéro candidat ou plusieurs = conflit, jamais une supposition.
- Aucun repli silencieux : tout échec avant ou pendant l'appel RPC est tracé par un run `failed` ; si cette trace échoue, l'exception remonte au job BullMQ. Un retour RPC hors contrat lève une exception.
- Drapeau `DIAGNOSTIC_PROJECTION_ENABLED` : défaut OFF. Ce plan ne l'active ni en PREPROD ni en PROD (PROD = Plan 3, après acceptation d'ADR-035 et tag `v*` décidé par l'owner). `READ_ONLY=true` (PREPROD) fait sauter le run avant toute lecture.
- Base Supabase partagée par DEV, PREPROD et PROD : **lecture seule** via `sweep-psql.sh`. L'application de la migration (Tâche 8) et la preuve sur DEV:3000 (Tâche 9) écrivent dans cette base : GO nominatif de l'owner avant chacune.
- Migration : `SET LOCAL lock_timeout` et `statement_timeout` explicites, aucune directive `squawk-ignore`, aucun `eslint-disable`. Le `.down.sql` est destructif : GO owner, drapeau coupé d'abord.
- `.spec/00-canon/**` (dont `ownership.yaml` et les registres L2) est réservé à l'owner : ce plan fournit des diffs vérifiés, il ne les commite pas. Le vault est en lecture seule : la révision d'ADR-035 est un brouillon remis à l'owner (commit signé G3, ADR-015).
- Travail monorepo dans `/opt/automecanik/app/.claude/worktrees/<nom>` ; le checkout principal `/opt/automecanik/app` reste sur `main` et ne sert qu'à `git -C … fetch`/`worktree add|remove` ; aucun `cd` dedans. Les `node_modules` du worktree sont des liens symboliques vers ceux du checkout principal ; ne jamais lancer `npm ci` ni `npm install` dans un worktree de ce plan.
- Toute action sortante (push, PR, commentaire, `workflow_dispatch`, requête d'écriture sur DEV:3000) attend une confirmation explicite de l'utilisateur. L'agent ne fusionne rien.
- Commits : trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Corps de PR : dernière ligne `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Dépôt public : aucun identifiant, cookie, clé ni mot de passe dans un fichier, un commit ou une PR.
- Vocabulaire : une fusion sur `main` produit le tag `:preprod` et redéploie le container PREPROD, rien de plus. Jamais « déployé en PROD » avant un tag `v*`.
- Interdits : `git stash` nu, `--force` (hors `worktree remove` après inspection), `--no-verify`, édition à la main de `audit/registry/*.json`, `REPO_MAP.md` ou d'un bloc `<!-- AUTO-GENERATED -->` (seul le patch de l'artefact `registry-recovery-<run_id>` les modifie).

## Préparation (une fois par session, depuis n'importe quel répertoire)

- [ ] Installer squawk à la version de la CI, le venv de validation d'ADR et ajv dans un répertoire de travail hors dépôt.

```bash
export SCRATCH="${SCRATCH:-$(mktemp -d)}"
git -C /opt/automecanik/app fetch -q origin
SQUAWK_V=$(git -C /opt/automecanik/app show origin/main:.github/workflows/ci.yml | sed -n 's/^ *SQUAWK_VERSION: "\(.*\)"$/\1/p')
test "$("$SCRATCH/bin/squawk" --version 2>/dev/null)" = "squawk $SQUAWK_V" || {
  mkdir -p "$SCRATCH/bin"
  curl -fsSL "https://github.com/sbdchd/squawk/releases/download/v${SQUAWK_V}/squawk-linux-x64" -o "$SCRATCH/bin/squawk"
  chmod +x "$SCRATCH/bin/squawk"
}
test -x "$SCRATCH/venv/bin/python" || {
  python3 -m venv "$SCRATCH/venv"
  "$SCRATCH/venv/bin/pip" install -q "pyyaml>=6.0,<7" "jsonschema>=4.20,<5"
}
test -x "$SCRATCH/ajv/node_modules/.bin/ajv" || npm install --prefix "$SCRATCH/ajv" --silent ajv-cli@5 ajv-formats
export PATH="$SCRATCH/bin:$SCRATCH/venv/bin:$PATH"
export SWEEP=/opt/automecanik/app/.claude/worktrees/skill-live-evidence/.claude/skills/live-evidence-sweep/scripts/sweep-psql.sh
docker info >/dev/null && test "$(squawk --version)" = "squawk $SQUAWK_V" && python3 -c "import yaml, jsonschema" && echo "ENV_OK SCRATCH=$SCRATCH squawk=$SQUAWK_V"
```

Attendu : dernière ligne `ENV_OK SCRATCH=<chemin> squawk=2.52.1` (version de `ci.yml` au 2026-10-01). Chaque tâche suppose `SCRATCH`, `PATH` et `SWEEP` exportés : dans une nouvelle session, relancer ce bloc avec `SCRATCH=<chemin>`. `SWEEP` n'est utilisé qu'aux Tâches 8 et 9 ; s'il n'est pas exécutable à ce moment-là, s'arrêter et le signaler (ne jamais écrire un autre client SQL).

## Review Focus

1. **Référentiel lu partiellement** (plafond PostgREST de 1000 lignes, page en échec, table qui change pendant la lecture) : une relation serait classée `no_matching_link` alors que le lien existe, et sa provenance retirée. Attendu : exception, run `failed`, rien d'appliqué. Tests : `reads past the 1000-row PostgREST cap, page by page`, `throws when the server serves fewer rows than the exact count`, `throws when the active count changes between pages` (Tâche 2) ; mutants `pagination-single-page` et `count-check-removed` tués (Tâche 7).
2. **Lien désactivé entre la lecture du référentiel et l'application** : attendu, la RPC re-vérifie `active` sous `FOR SHARE` et annule tout le run. Tests : harnais sections 7 et 9 (Tâche 1) ; mutants SQL `m2-no-for-share` et `m3-no-active-check` tués (Tâche 1).
3. **Export vide ou partiel** (index à 0 entrée, fichier listé absent, fichier non listé, empreinte fausse) : un index valide à 0 entrée retire tout ce qui vit, bruyamment ; un export incohérent ne retire rien. Tests : chargeur `listed_file_missing`, `unlisted_file_present`, `sha256_mismatch` (Tâche 3) ; harnais section 10 (Tâche 1) ; writer `empty index: warns with the retired count` (Tâche 5).
4. **Rôle `anon` ou `authenticated` qui appelle la RPC ou lit les tables** (Supabase accorde `EXECUTE` par défaut aux nouvelles fonctions) : attendu, refus. Tests : harnais section 1 (Tâche 1) ; mutants SQL `m1-no-revoke-exec` et `m4-no-revoke-table` tués (Tâche 1) ; contrôle `has_function_privilege` après application (Tâche 8).
5. **Drapeau OFF alors qu'un repeatable reste enregistré dans Redis, ou module qui ne démarre pas** (aucune CI de PR ne démarre le backend) : attendu, le scheduler retire le repeatable résiduel, le processor ignore un job même admin, et le module compile avec les modules globaux réels. Tests : scheduler `OFF: returns synchronously, removes a residual repeatable, never registers one`, processor `flag OFF at job time: skips, even for an admin trigger`, module `SANS RpcGateModule → boot REFUSÉ` (Tâche 6) ; mutants correspondants tués (Tâche 7).

## Carte des fichiers

| Dépôt | Fichier | Tâche | Responsabilité |
|---|---|---|---|
| Vault (owner) | `ledger/decisions/adr/ADR-035-diagnostic-tool-source-trust-flag.md` | 0 | Révision : provenance WIKI, producteur unique, drapeaux |
| Monorepo | `scripts/db/diag-link-provenance-fixture.sql` | 1 | Référentiel minimal : liens 113 / 114 / 117 et leurres |
| Monorepo | `scripts/db/test-diag-link-provenance.sh` | 1 | Harnais PostgreSQL 17 jetable, 69 assertions |
| Monorepo | `backend/supabase/migrations/20261001_diag_link_provenance.sql` | 1 | 3 tables, RLS, RPC `__diag_projection_apply`, droits |
| Monorepo | `backend/supabase/migrations/20261001_diag_link_provenance.down.sql` | 1 | Rollback manuel (GO owner) |
| Monorepo | `scripts/audit/check-served-content-write-sinks-ratchet.ts` | 1, 5 | `SERVED_TABLES` (T1), `SERVED_PUBLISH_RPCS` (T5) |
| Monorepo | `scripts/audit/check-served-content-write-sinks-ratchet.test.ts` | 1, 5 | Un test par nouvelle surface servie |
| Monorepo | `audit/baselines/served-content-write-sinks-baseline.json` | 1, 5 | Baseline rafraîchie par le script, jamais à la main |
| Monorepo | `backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts` | 2 | `DiagProjectionLinksSchema` |
| Monorepo | `backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts` | 2 | `getProjectionReference()` paginé à compte exact |
| Monorepo | `backend/src/modules/diagnostic-engine/diagnostic-projection-reference.test.ts` | 2 | 8 tests |
| Monorepo | `backend/src/modules/diagnostic-engine/projection/diagnostic-projection.types.ts` | 3 | Constantes, schémas Zod d'export et de retour RPC |
| Monorepo | `…/projection/diagnostic-projection-exports-loader.ts` (+ `.test.ts`) | 3 | Pré-validation complète de l'export (17 tests) |
| Monorepo | `…/projection/diagnostic-projection-resolver.ts` (+ `.test.ts`) | 4 | Résolution pure relation → lien (14 tests) |
| Monorepo | `…/projection/diagnostic-projection-writer.service.ts` (+ `.test.ts`) | 5 | Orchestration d'un run (9 tests) |
| Monorepo | `backend/src/config/feature-flags.service.ts` | 6 | `diagnosticProjectionEnabled` + clé autorisée |
| Monorepo | `…/projection/diagnostic-projection-scheduler.service.ts` (+ `.test.ts`) | 6 | Repeatable nocturne, purge si OFF (4 tests) |
| Monorepo | `…/projection/diagnostic-projection.processor.ts` (+ `.test.ts`) | 6 | Consommateur BullMQ, drapeau re-vérifié (5 tests) |
| Monorepo | `…/projection/diagnostic-projection-admin.controller.ts` | 6 | `POST api/admin/diagnostic-projection/trigger` |
| Monorepo | `…/projection/diagnostic-projection.module.ts` (+ `.test.ts`) | 6 | Composition DI (2 tests) |
| Monorepo | `backend/src/app.module.ts` | 6 | Import du module |
| Monorepo (owner) | `.spec/00-canon/repository-registry/ownership.yaml` | 1 | Propriété des deux fichiers de migration (commentaire de PR) |
| Monorepo (owner) | `.spec/00-canon/repository-registry/{projections,pipelines}.registry.json`, `automation-reality.yaml` | 10 | `diagnostic_provenance_v1`, `exports_diagnostic_to_db_projection`, `diagnostic-projection-nightly` |

`…/projection/` = `backend/src/modules/diagnostic-engine/projection/`. Les scripts de mutation (`mut_sql.py`, `mut_ts.py`) et le brouillon d'ADR restent dans `$SCRATCH`, jamais dans un dépôt.

## Ordre et dépendances

```text
Tâche 0 (brouillon ADR-035 → owner)       ── en parallèle ; ne bloque pas les PR à drapeau OFF
Tâche 1 (PR-A : migration + harnais + ratchet tables) → fusion humaine
  → Tâche 8 (application de la migration, GO owner)
Tâches 2 → 3 → 4 → 5 → 6 → 7 (PR-B : writer, branche empilée sur PR-A) → rebase sur main après fusion de PR-A → fusion humaine
Tâche 9 (preuve DEV:3000, GO owner) : après Tâche 8, fusion de PR-B, resynchronisation de DEV:3000, et pin du sous-module contenant exports/diagnostic (Plan 1, Tâche 5)
Tâche 10 (diffs L2 owner) : projections après PR-A ; pipelines après le diff pipelines du Plan 1 et PR-B ; automation après PR-B
```

PR-A se fusionne seule sans risque : elle ne crée que des tables vides et une fonction qu'aucun code n'appelle. PR-B se fusionne avant ou après la Tâche 8 : drapeau OFF, rien n'appelle la RPC tant que la Tâche 9 n'a pas lieu. Une migration fusionnée reste `pending` dans le ledger jusqu'à la Tâche 8 ; la sonde nocturne `migration-ledger-freshness.yml` ne rougit qu'au-delà de 30 jours d'attente.

---

### Tâche 0 : brouillon de révision d'ADR-035 (vault, remis à l'owner)

ADR-035 (statut `proposed`, 2026-05-02) prévoyait des colonnes `is_trusted` sur les liens. La spec la révise : provenance WIKI dans une table séparée, producteur unique, drapeaux. L'agent n'écrit pas dans le vault ; il produit le texte complet, le diff et la preuve de conformité au schéma, et l'owner l'ouvre en PR signée. Les PR de ce plan (drapeau OFF) n'attendent pas l'acceptation ; l'activation PROD et le frontend (Plan 3) l'attendent.

**Files (owner):**
- Modify: `ledger/decisions/adr/ADR-035-diagnostic-tool-source-trust-flag.md` (vault `ak125/governance-vault`)

**Interfaces:**
- Consumes : rien.
- Produces : `$SCRATCH/adr-035-revision.md`, `$SCRATCH/adr-035.diff` ; décisions D1-D7 que la spec §4.9 et le Plan 3 citent.

- [ ] **Étape 1 : écrire le brouillon**

Créer `$SCRATCH/adr-035-revision.md` avec exactement ce contenu :

```markdown
---
id: ADR-035
title: "Diagnostic Tool Source Trust — provenance WIKI des liens __diag_symptom_cause_link"
status: proposed
date: 2026-05-02
decision_date: null
decision_makers: ["@fafa"]
supersedes: []
superseded_by: []
amends: []
related_rules: ["G1", "G2", "G3", "Q1", "Q2"]
related_incidents: ["INC-2026-013"]
related_adr: ["ADR-031", "ADR-032", "ADR-033"]
reviewed_by: ""
---

# ADR-035 : Diagnostic Tool Source Trust — provenance WIKI des liens

> **Révision du 2026-09-30.** La proposition du 2026-05-02 (colonnes `is_trusted` / `source_origin`
> sur `__diag_symptom_cause_link`) n'a jamais été acceptée ni implémentée. Elle est remplacée par
> les décisions D1-D7 ci-dessous ; l'option d'origine est conservée en « Options considérées »
> (option C) pour l'historique. Spec d'implémentation (monorepo) :
> `docs/superpowers/specs/2026-09-30-diagnostic-wiki-provenance-design.md`.

## Contexte

Au 2026-05-02, l'incident [[2026-05-02-diagnostic-tool-unsourced-probas|INC-2026-013]] a documenté que les 162 liens `__diag_symptom_cause_link` du moteur diagnostic portent des `relative_score` copiés depuis un fichier RAG éditorial (truth_level L2, sans source OEM/TecDoc/RTA), affichés au client sur `/diagnostic-auto/*` comme s'ils étaient vérifiés.

Au 2026-09-30 (origin/main et DB en lecture seule), la chaîne SCRAPING → RAW → WIKI → DB est coupée à chaque maillon :

| Maillon | État |
|---|---|
| RAW → WIKI | 3 relations `diagnostic_relations` (filtre-a-air, filtre-a-carburant, filtre-d-habitacle) ; leurs sources sont `to_capture` au catalogue |
| WIKI → DB | aucun producteur : rien ne lit `diagnostic_relations` pour alimenter `__diag_*` |
| DB | aucune colonne ni table de provenance sur les liens |
| Moteur | le score affiché « NN/100 » dérive de `relative_score`, non sourcé |

[[ADR-033-wiki-gamme-diagnostic-relations-contract]] définit côté WIKI `evidence.diagnostic_safe` et la `source_policy`, sans contrepartie DB. Cet ADR définit cette contrepartie.

## Principe directeur

> Une relation symptôme → cause n'est « documentée » en DB que par une provenance WIKI vérifiable, dont toutes les sources sont prouvées dans RAW. Aucun nombre n'est affiché pour un lien tant qu'aucune fréquence sourcée n'existe.

## Décisions

### D1 — Une table de provenance, aucune colonne d'état sur les liens

- `__diag_link_provenance` : une ligne par couple (lien, fiche WIKI) ; `link_id` → `__diag_symptom_cause_link(id)` `ON DELETE RESTRICT`. Colonnes : identité de la fiche (`wiki_path`, `gamme_slug`, `wiki_commit`, `content_hash`), contenu de la relation (`relation_to_part`, `part_role`, `confidence`, `source_policy`, `confidence_score_computed`, `reviewed`, `diagnostic_safe`, `sources`), cycle de vie (`first_run_id`, `last_run_id`, `projected_at`, `retired_at`, `retired_run_id`).
- Un lien est « documenté » si et seulement s'il a une ligne vivante (`retired_at IS NULL`). Retrait doux : une relation qui n'est plus projetée reçoit `retired_at` ; l'historique est conservé.
- `__diag_projection_runs` (un run = une ligne, `exported = projected + conflicts` par `CHECK`) et `__diag_projection_conflicts` (raison bornée par `CHECK`) rendent chaque run et chaque relation non projetée observables.
- `__diag_symptom_cause_link` n'est pas modifiée.
- `wiki_commit` et `content_hash` sont des métadonnées d'audit au sens d'[[ADR-059-seo-runtime-projection]] (§Audit metadata vs replay authority) ; aucune capacité de rejeu n'est revendiquée.

Pourquoi pas des colonnes : un booléen `is_trusted` est un état sans sa preuve (qui l'a basculé, sur quelle source, depuis quand). La table porte la preuve elle-même et se recalcule à chaque run depuis le WIKI.

### D2 — Un seul producteur, qui ne crée rien et ne tranche rien

- Le seul writer est `DiagnosticProjectionModule` (monorepo), par la RPC `__diag_projection_apply(jsonb)` : une transaction, verrou consultatif, droits `service_role` seuls. Il lit `exports/diagnostic/`, vue dérivée déterministe du WIKI publiée par le builder du WIKI ; il ne lit jamais RAW ni RAG ([[ADR-031-four-layer-content-architecture]]).
- Il ne crée aucun symptôme, cause ni lien. Une relation se résout vers un lien existant par une règle déterministe ; zéro ou plusieurs candidats donnent un conflit, jamais un choix.
- Une relation n'est projetée que si toutes ses sources sont `raw_proven` (prédicat G1 : source `active` au catalogue avec `raw_ref.manifest_id`), calculé par le builder du WIKI et recopié tel quel. Sinon : conflit `source_not_raw_proven`.
- Il ne modifie jamais `reviewed` ni `diagnostic_safe`. Leur passage à `true` reste « strictement manuel ou couvert par règle ADR explicite, jamais en automatique » (ADR-033 D4) et se fait dans le WIKI : ni le writer, ni un script, ni une session IA ne le décident.

### D3 — Aucun nombre affiché pour un lien

- Aucun pourcentage, score sur 100 ni sous-score n'est affiché pour un lien tant qu'aucune fréquence sourcée n'existe.
- L'ordre existant, fondé sur `relative_score`, reste transitoire pour les liens non documentés ; il n'est jamais affiché. Le retrait de `relative_score` relève d'une spec distincte.

### D4 — Seuls les liens `diagnostic_safe: true` pondèrent le rang

- En mode primaire (drapeau `PRIMARY`, D5), une contribution pèse 100 si son lien a une ligne vivante avec `diagnostic_safe: true`, 0 sinon (ADR-033, champ `diagnostic_safe` : « autorisé à influencer le moteur diagnostic live »).
- Un lien documenté mais non `diagnostic_safe` est affiché comme documenté, sans jamais peser sur le rang.
- `confidence_score_computed` n'est pas une probabilité et ne pondère pas le rang.

### D5 — Activation par drapeaux, défaut OFF

| Drapeau | Effet |
|---|---|
| `DIAGNOSTIC_PROJECTION_ENABLED` | run quotidien du writer (PROD seul porte le job planifié) |
| `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` | le moteur lit et expose la provenance, sans changer le rang |
| `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED` | pondération D4 ; refusée par la plomberie PROD si EXPOSE est OFF |

Les PR à drapeaux OFF avancent sans attendre cet ADR. Attendent son acceptation : toute activation en PROD et la PR frontend, visible sans drapeau.

### D6 — Critères de succès

1. Le premier run activé donne `exported = 3`, `projected = 0`, `conflicts = 3` (`source_not_raw_proven`) : le résultat honnête tant qu'aucune source n'est capturée.
2. Une source passée `active` par le flux gouverné produit une ligne vivante au run suivant, sans intervention manuelle.
3. Une panne de lecture de la provenance n'est jamais présentée comme une absence de preuve.
4. Aucune fiche WIKI approuvée n'est modifiée ; aucun symptôme, cause ni lien n'est créé.

### D7 — Interdictions

- Écrire `__diag_link_provenance` hors de `__diag_projection_apply`.
- Projeter une relation dont une source n'est pas `raw_proven`.
- Afficher un nombre par lien (D3) ; pondérer le rang par un lien non `diagnostic_safe` (D4).
- Alimenter la provenance depuis RAG ou depuis RAW directement.

## Options considérées

### Option A — Supprimer les `relative_score` existants (rejetée)

Destructif et irréversible, sans gain de preuve. Rejetée le 2026-05-02, toujours rejetée.

### Option B — Colonne `score_confidence` low/medium/high (rejetée)

Analogue à l'anti-pattern `evidence_level` plat rejeté par ADR-033. Rejetée le 2026-05-02, toujours rejetée.

### Option C — Colonnes `is_trusted` + `source_origin` (proposée le 2026-05-02, remplacée)

`ALTER TABLE __diag_symptom_cause_link ADD COLUMN is_trusted BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN source_origin TEXT NOT NULL DEFAULT 'rag_unverified'`, bascule `is_trusted = true` selon la `source_policy`.

**Remplacée** : l'état serait dissocié de sa preuve, sa bascule demanderait un acteur (manuel ou script) que D2 interdit, et la table de liens, lue par le moteur, serait modifiée.

### Option D — Table de provenance projetée depuis le WIKI (retenue)

D1-D7. Additive, observable par run, recalculée depuis le WIKI, sans aucune bascule manuelle.

## Conséquences

### Positives

- La provenance de chaque lien est vérifiable : fiche, commit, sources et leur preuve RAW.
- Le travail de capture RAW (sous-projet suivant) devient mesurable : conflits `source_not_raw_proven` → projections.
- Aucune table existante n'est modifiée ; chaque étape se coupe par son drapeau.

### Négatives

- Au lancement, aucun lien n'est documenté (0 source capturée) : le moteur affiche toutes ses hypothèses comme « non encore documentées ».
- Le mode primaire reste sans effet tant qu'aucune relation n'est `diagnostic_safe: true`.

### Neutres

- `relative_score` reste en DB et ordonne transitoirement les liens non documentés.
- [[ADR-032-diagnostic-maintenance-unification]] (kg_* canon) n'est pas modifié.

## Revue planifiée

**Date** : J+90 après acceptation.

**Critères** :
- runs quotidiens `applied` en PROD, `exported = projected + conflicts` ;
- évolution du nombre de conflits `source_not_raw_proven` avec la capture RAW ;
- aucun nombre par lien affiché sur `/diagnostic-auto/*`.

---

*Proposé le : 2026-05-02*
*Révisé le : 2026-09-30 (D1-D7 remplacent la proposition d'origine)*
*Accepté le : TBD*
*Dernière revue : TBD*
```

- [ ] **Étape 2 : diff contre la version publiée et contrôle du frontmatter**

La version publiée est lue par l'API GitHub, sans toucher au checkout local du vault.

```bash
gh api -H 'Accept: application/vnd.github.raw' 'repos/ak125/governance-vault/contents/ledger/decisions/adr/ADR-035-diagnostic-tool-source-trust-flag.md?ref=main' > "$SCRATCH/adr-035-main.md"
gh api -H 'Accept: application/vnd.github.raw' 'repos/ak125/governance-vault/contents/_scripts/schemas/adr.schema.json?ref=main' > "$SCRATCH/adr.schema.json"
diff -u "$SCRATCH/adr-035-main.md" "$SCRATCH/adr-035-revision.md" > "$SCRATCH/adr-035.diff"; echo "diff_exit=$?"
python3 - "$SCRATCH/adr-035-revision.md" "$SCRATCH/adr.schema.json" <<'EOF'
import datetime, json, sys
import jsonschema, yaml
text = open(sys.argv[1], encoding="utf-8").read()
front = yaml.safe_load(text.split("---\n", 2)[1])
iso = lambda v: v.isoformat() if isinstance(v, datetime.date) else v
jsonschema.validate({k: iso(v) for k, v in front.items()}, json.load(open(sys.argv[2], encoding="utf-8")))
print("ADR_FRONTMATTER_OK", front["status"], front["related_adr"])
EOF
```

Attendu : `diff_exit=1` (des différences), puis `ADR_FRONTMATTER_OK proposed ['ADR-031', 'ADR-032', 'ADR-033']`. La normalisation des dates reproduit ce que fait le validateur du vault : YAML lit une date non quotée comme un objet `date`. Si `adr-035-main.md` a changé depuis le 2026-09-30 (vault `e0fd2bb`), reporter ces changements dans le brouillon avant de le remettre.

- [ ] **Étape 3 : remise à l'owner**

Remettre `$SCRATCH/adr-035-revision.md` et `$SCRATCH/adr-035.diff`. L'owner ouvre la PR vault (commit signé G3), puis, à l'acceptation, renseigne `status: accepted`, `decision_date`, `reviewed_by` et la ligne « Accepté le » (le `TBD` du pied de page est la convention du vault, pas un oubli). Aucune `amends: ADR-033` : ADR-033 reste la norme du contrat de relations, ADR-035 la cite en `related_adr`.

---

### Tâche 1 : migration de provenance, harnais PostgreSQL et ratchet des tables (PR-A)

La migration est écrite contre un harnais qui la joue réellement sous les rôles PostgreSQL, dans un conteneur sans réseau. Le harnais est écrit d'abord : sans migration, il sort en fatal.

**Files:**
- Create: `scripts/db/diag-link-provenance-fixture.sql`
- Create: `scripts/db/test-diag-link-provenance.sh` (mode 755, comme les autres `scripts/db/test-*.sh`)
- Create: `backend/supabase/migrations/20261001_diag_link_provenance.sql`
- Create: `backend/supabase/migrations/20261001_diag_link_provenance.down.sql`
- Modify: `scripts/audit/check-served-content-write-sinks-ratchet.ts` (`SERVED_TABLES`)
- Modify: `scripts/audit/check-served-content-write-sinks-ratchet.test.ts` (1 test)
- Modify: `audit/baselines/served-content-write-sinks-baseline.json` (par le script `:refresh`)

**Interfaces:**
- Consumes : table existante `public.__diag_symptom_cause_link (id bigint, symptom_id, cause_id, active boolean)`.
- Produces : tables `public.__diag_projection_runs`, `public.__diag_projection_conflicts`, `public.__diag_link_provenance` ; RPC `public.__diag_projection_apply(p_run jsonb) RETURNS jsonb` qui renvoie `{run_id, projected_count, conflict_count, retired_count}` ; charge utile `p_run` = `{triggered_by, runtime_env, index_sha256, builder_version, exported_count, started_at, projections[], conflicts[]}` (champs d'une projection : ceux de `ProjectionRow`, Tâche 3 ; d'un conflit : ceux de `ConflictRow`).

- [ ] **Étape 1 : créer le worktree**

```bash
git -C /opt/automecanik/app fetch origin
git -C /opt/automecanik/app worktree add -b feat/diag-provenance-db /opt/automecanik/app/.claude/worktrees/diag-provenance-db origin/main
cd /opt/automecanik/app/.claude/worktrees/diag-provenance-db
ln -s /opt/automecanik/app/node_modules node_modules
ln -s /opt/automecanik/app/backend/node_modules backend/node_modules
git status --porcelain
```

Attendu : `git status` vide (les deux liens sont ignorés par le motif `node_modules` de `.gitignore`). Puis lancer le bloc **Préparation** (attendu : `ENV_OK …`).

- [ ] **Étape 2 : écrire la fixture et le harnais**

Créer `scripts/db/diag-link-provenance-fixture.sql` avec exactement ce contenu :

```sql
-- =============================================================================
-- Fixture — surface du moteur de diagnostic nécessaire à
-- <AAAAMMJJ>_diag_link_provenance.sql, sur un PostgreSQL JETABLE.
--
-- Reproduit ce qui décide du comportement de la migration :
--   * les rôles API Supabase et leurs privilèges PAR DÉFAUT (EXECUTE et ALL
--     accordés à anon/authenticated sur tout objet créé) : c'est ce défaut que
--     la migration doit neutraliser par ses REVOKE ;
--   * service_role en BYPASSRLS, comme sur Supabase ;
--   * les 4 tables __diag_* lues par la RPC, avec les types de
--     20260308_diagnostic_engine_mvp.sql (SERIAL / INT, `active` nullable) ;
--   * les liens réels 113 / 114 / 117 et les deux causes voisines qui mappent
--     les mêmes gammes (filtre_carburant_injection, filtre_habitacle_clim).
--
-- Ne cible JAMAIS une base réelle.
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon NOLOGIN;          END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')  THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Défauts Supabase (fixture UNIQUEMENT — jamais dans une migration).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.__diag_system (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
  description TEXT, display_order INT DEFAULT 0, active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.__diag_symptom (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  system_id INT NOT NULL REFERENCES public.__diag_system(id), label TEXT NOT NULL,
  description TEXT, signal_mode TEXT NOT NULL DEFAULT 'symptom_slugs',
  urgency TEXT DEFAULT 'moyenne', active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.__diag_cause (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  system_id INT NOT NULL REFERENCES public.__diag_system(id), label TEXT NOT NULL,
  cause_type TEXT NOT NULL DEFAULT 'maintenance_related', description TEXT,
  verification_method TEXT, urgency TEXT DEFAULT 'moyenne', active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.__diag_symptom_cause_link (
  id SERIAL PRIMARY KEY,
  symptom_id INT NOT NULL REFERENCES public.__diag_symptom(id),
  cause_id INT NOT NULL REFERENCES public.__diag_cause(id),
  relative_score INT DEFAULT 50 CHECK (relative_score BETWEEN 0 AND 100),
  evidence_for TEXT[] DEFAULT '{}', evidence_against TEXT[] DEFAULT '{}',
  requires_verification BOOLEAN DEFAULT true, active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (symptom_id, cause_id)
);

INSERT INTO public.__diag_system (id, slug, label) VALUES
  (1, 'filtration', 'Filtration'), (2, 'injection', 'Injection'), (3, 'clim', 'Climatisation');
INSERT INTO public.__diag_symptom (id, slug, system_id, label) VALUES
  (10, 'perte_puissance_filtration', 1, 'Perte de puissance'),
  (11, 'odeur_habitacle', 1, 'Odeur dans l''habitacle');
INSERT INTO public.__diag_cause (id, slug, system_id, label) VALUES
  (20, 'filtre_air_colmate', 1, 'Filtre à air colmaté'),
  (21, 'filtre_carburant_colmate', 1, 'Filtre à carburant colmaté'),
  (22, 'filtre_habitacle_sature', 1, 'Filtre d''habitacle saturé'),
  (23, 'filtre_carburant_injection', 2, 'Filtre à carburant (injection)'),
  (24, 'filtre_habitacle_clim', 3, 'Filtre d''habitacle (clim)');
INSERT INTO public.__diag_symptom_cause_link (id, symptom_id, cause_id, relative_score) VALUES
  (113, 10, 20, 60), (114, 10, 21, 50), (117, 11, 22, 70);
DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('public.__diag_symptom_cause_link', 'id'), 200); END $$;
```

Créer `scripts/db/test-diag-link-provenance.sh` avec exactement ce contenu, puis `chmod 755 scripts/db/test-diag-link-provenance.sh` :

```bash
#!/usr/bin/env bash
# =============================================================================
# Test adversarial de la migration <AAAAMMJJ>_diag_link_provenance.sql
#
# Joue RÉELLEMENT la migration et la RPC __diag_projection_apply sous les rôles
# PostgreSQL (SET LOCAL ROLE) et vérifie le COMPORTEMENT : atomicité d'un run,
# complétude, re-vérification `active` sous FOR SHARE, cycle de vie des lignes
# vivantes / retirées, fermeture anon / authenticated, idempotence.
#
# Environnement : conteneur PostgreSQL jetable, sans réseau (même majeure que la
# PROD). Ne touche JAMAIS une base réelle : aucune variable de connexion Supabase
# n'est lue, l'hôte est un conteneur local créé et détruit ici.
#
# Usage   : bash scripts/db/test-diag-link-provenance.sh
# Mutation: MIGRATION_UNDER_TEST=<variante.sql> bash scripts/db/test-diag-link-provenance.sh
# Sortie  : 0 si toutes les assertions passent, 1 si une échoue, 2 si fatal.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$ROOT/scripts/db/diag-link-provenance-fixture.sql"
if [[ -n "${MIGRATION_UNDER_TEST:-}" ]]; then
  MIGRATION="$MIGRATION_UNDER_TEST"
else
  shopt -s nullglob
  found=("$ROOT"/backend/supabase/migrations/*_diag_link_provenance.sql)
  shopt -u nullglob
  [[ ${#found[@]} -eq 1 ]] || { echo "FATAL: ${#found[@]} migration(s) *_diag_link_provenance.sql (1 attendue)"; exit 2; }
  MIGRATION="${found[0]}"
fi
# Le rollback est toujours celui du dépôt : une mutation ne vise que la migration.
shopt -s nullglob
downs=("$ROOT"/backend/supabase/migrations/*_diag_link_provenance.down.sql)
shopt -u nullglob
[[ ${#downs[@]} -eq 1 ]] || { echo "FATAL: ${#downs[@]} rollback(s) *_diag_link_provenance.down.sql (1 attendu)"; exit 2; }
DOWN="${downs[0]}"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="diag-provenance-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
[[ -f "$FIXTURE"   ]] || { echo "FATAL: fixture absente: $FIXTURE"; exit 2; }
[[ -f "$MIGRATION" ]] || { echo "FATAL: migration absente: $MIGRATION"; exit 2; }
[[ -f "$DOWN"      ]] || { echo "FATAL: rollback absent: $DOWN"; exit 2; }

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Image     : $IMAGE"
echo "Migration : ${MIGRATION#"$ROOT"/}"
docker run -d --network none --name "$CT" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test "$IMAGE" >/dev/null || exit 2
# Prêt = le serveur DÉFINITIF répond sur TCP. Le serveur temporaire que l'image
# lance pour son initialisation n'écoute que la socket Unix : sonder la socket
# rend la main pendant l'init, puis le serveur s'arrête sous la fixture.
ready() { docker exec "$CT" pg_isready -h 127.0.0.1 -U postgres -d test >/dev/null 2>&1; }
for _ in $(seq 1 60); do ready && break; sleep 1; done
ready || { echo "FATAL: postgres non prêt"; exit 2; }
echo "PostgreSQL: $(docker exec "$CT" psql -U postgres -d test -tAc 'SHOW server_version')"
echo

psql_run() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q "$@"; }

# Valeur scalaire lue en postgres (superutilisateur de la fixture).
q() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA -c "$1"; }

# Exécute $2 sous le rôle $1 et ANNULE ; imprime OUI / REFUSE_FONCTION / REFUSE /
# ABSENT / ERREUR. REFUSE_FONCTION distingue le refus d'EXECUTE du refus d'une
# table touchée ENSUITE : la fonction étant SECURITY INVOKER, un EXECUTE resté
# ouvert à anon échouerait quand même sur la table, et une sonde qui ne lit que
# « permission denied » ne verrait pas la différence.
probe() {
  local role="$1" sql="$2" out rc
  out=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE $role;
$sql
ROLLBACK;
SQL
)
  rc=$?
  if [[ $rc -eq 0 ]]; then echo "OUI"; return; fi
  case "$out" in
    *"permission denied for function"*)       echo "REFUSE_FONCTION" ;;
    *"permission denied"*|*"42501"*)          echo "REFUSE" ;;
    *"does not exist"*"function"*|*"42883"*)  echo "ABSENT" ;;
    *)                                        echo "ERREUR" ;;
  esac
}

# Exécute $1 sous service_role et VALIDE ; imprime la sortie, rend le code psql.
sr() {
  docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE service_role;
$1
COMMIT;
SQL
}

pass=0; fail=0
assert() {
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1))
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}
# assert_err <libellé> <fragment attendu du message> <sortie> <code>
assert_err() {
  if [[ "$4" -ne 0 && "$3" == *"$2"* ]]; then echo "  PASS  $1 → refusé ($2)"; pass=$((pass+1))
  else echo "  FAIL  $1 → code $4, sortie '${3:0:200}', attendu un refus contenant '$2'"; fail=$((fail+1)); fi
}

# ── Charges utiles ───────────────────────────────────────────────────────────
COMMIT40=$(printf 'a%.0s' $(seq 1 40))
HASH64=$(printf 'b%.0s' $(seq 1 64))
# proj <link_id> <gamme_slug> [sources_json]
proj() {
  local sources
  if [[ $# -ge 3 ]]; then sources="$3"
  else sources=$(printf '[{"slug":"src_%s","catalog_slug":"src_%s","type":"web","status":"active","raw_ref":"raw/src_%s","raw_proven":true}]' "$2" "$2" "$2")
  fi
  printf '{"link_id":%s,"wiki_path":"wiki/gamme/%s.md","gamme_slug":"%s","wiki_commit":"%s","content_hash":"sha256:%s","relation_to_part":"possible_cause","part_role":"Piece en cause pour ce symptome (fixture de test).","confidence":"medium","source_policy":"2_medium_concordant","confidence_score_computed":0.6,"reviewed":false,"diagnostic_safe":false,"sources":%s}' \
    "$1" "$2" "$2" "$COMMIT40" "$HASH64" "$sources"
}
# conf <gamme_slug> <relation_index> <symptom_slug> <reason>
conf() {
  printf '{"wiki_path":"wiki/gamme/%s.md","gamme_slug":"%s","relation_index":%s,"symptom_slug":"%s","system_slug":"filtration","reason":"%s","detail":{}}' \
    "$1" "$1" "$2" "$3" "$4"
}
# payload <exported_count> <projections csv> <conflicts csv>
payload() {
  printf '{"triggered_by":"admin","runtime_env":"test","index_sha256":"sha256:%s","builder_version":"1.0.0","exported_count":%s,"projections":[%s],"conflicts":[%s]}' \
    "$HASH64" "$1" "$2" "$3"
}
apply_sql() { printf 'SELECT public.__diag_projection_apply($j$%s$j$::jsonb);' "$1"; }

P113=$(proj 113 filtre-a-air); P114=$(proj 114 filtre-a-carburant); P117=$(proj 117 filtre-d-habitacle)
runs()  { q "SELECT count(*) FROM public.__diag_projection_runs"; }
live()  { q "SELECT count(*) FROM public.__diag_link_provenance WHERE retired_at IS NULL"; }
total() { q "SELECT count(*) FROM public.__diag_link_provenance"; }

# ── Installation ─────────────────────────────────────────────────────────────
psql_run -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" \
  || { echo "FATAL: migration en échec"; exit 2; }

echo "1. Surface : anon / authenticated fermés, service_role ouvert"
for t in __diag_projection_runs __diag_projection_conflicts __diag_link_provenance; do
  assert "anon SELECT $t"          REFUSE "$(probe anon "SELECT 1 FROM public.$t LIMIT 1;")"
  assert "authenticated SELECT $t" REFUSE "$(probe authenticated "SELECT 1 FROM public.$t LIMIT 1;")"
  assert "service_role SELECT $t"  OUI    "$(probe service_role "SELECT 1 FROM public.$t LIMIT 1;")"
  assert "RLS active sur $t"       t      "$(q "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.$t'::regclass")"
done
EMPTY=$(apply_sql "$(payload 0 '' '')")
assert "anon EXECUTE __diag_projection_apply"          REFUSE_FONCTION "$(probe anon "$EMPTY")"
assert "authenticated EXECUTE __diag_projection_apply" REFUSE_FONCTION "$(probe authenticated "$EMPTY")"
assert "service_role EXECUTE __diag_projection_apply"  OUI    "$(probe service_role "$EMPTY")"
assert "fonction en SECURITY INVOKER" f "$(q "SELECT prosecdef FROM pg_proc WHERE oid = 'public.__diag_projection_apply(jsonb)'::regprocedure")"
assert "search_path figé" "search_path=public, pg_temp" "$(q "SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.__diag_projection_apply(jsonb)'::regprocedure")"

echo
echo "2. État de lancement : 3 relations exportées, 3 conflits source_not_raw_proven"
out=$(sr "$(apply_sql "$(payload 3 '' "$(conf filtre-a-air 0 perte_puissance_filtration source_not_raw_proven),$(conf filtre-a-carburant 0 perte_puissance_filtration source_not_raw_proven),$(conf filtre-d-habitacle 0 odeur_habitacle source_not_raw_proven)")")"); rc=$?
assert "run appliqué" 0 "$rc"
R1=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "run : status / exported / projected / conflicts / retired" "applied|3|0|3|0" \
  "$(q "SELECT concat_ws('|', status, exported_count, projected_count, conflict_count, retired_count) FROM public.__diag_projection_runs WHERE id = $R1")"
assert "run : finished_at posé" t "$(q "SELECT finished_at IS NOT NULL FROM public.__diag_projection_runs WHERE id = $R1")"
assert "3 conflits rattachés au run" 3 "$(q "SELECT count(*) FROM public.__diag_projection_conflicts WHERE run_id = $R1 AND reason = 'source_not_raw_proven'")"
assert "0 ligne de provenance" 0 "$(total)"

echo
echo "3. Projection de 113 / 114 / 117"
out=$(sr "$(apply_sql "$(payload 3 "$P113,$P114,$P117" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
R2=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "3 lignes vivantes" 3 "$(live)"
assert "first_run_id = last_run_id = run courant" 3 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE first_run_id = $R2 AND last_run_id = $R2")"
assert "reviewed / diagnostic_safe copiés tels quels" "f|f" "$(q "SELECT DISTINCT concat_ws('|', reviewed, diagnostic_safe) FROM public.__diag_link_provenance")"
assert "retour de la RPC" "{\"run_id\": $R2, \"retired_count\": 0, \"conflict_count\": 0, \"projected_count\": 3}" "$out"
PA113=$(q "SELECT projected_at FROM public.__diag_link_provenance WHERE link_id = 113")

echo
echo "4. Rejeu du même export : upsert, aucune ligne nouvelle"
sleep 1
out=$(sr "$(apply_sql "$(payload 3 "$P113,$P114,$P117" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
R3=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "toujours 3 lignes au total" 3 "$(total)"
assert "first_run_id inchangé" 3 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE first_run_id = $R2")"
assert "last_run_id avancé" 3 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE last_run_id = $R3")"
assert "projected_at inchangé" "$PA113" "$(q "SELECT projected_at FROM public.__diag_link_provenance WHERE link_id = 113")"

echo
echo "5. Retrait doux : l'export ne porte plus que 113"
out=$(sr "$(apply_sql "$(payload 1 "$P113" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
R4=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "retired_count = 2" 2 "$(q "SELECT retired_count FROM public.__diag_projection_runs WHERE id = $R4")"
assert "1 ligne vivante" 1 "$(live)"
assert "114 et 117 retirées par ce run" 2 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE link_id IN (114, 117) AND retired_run_id = $R4 AND retired_at IS NOT NULL")"

echo
echo "6. Réapparition : 114 revient, nouvelle ligne vivante, l'historique reste"
out=$(sr "$(apply_sql "$(payload 2 "$P113,$P114" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
assert "114 : 1 retirée + 1 vivante" "1|1" "$(q "SELECT concat_ws('|', count(*) FILTER (WHERE retired_at IS NOT NULL), count(*) FILTER (WHERE retired_at IS NULL)) FROM public.__diag_link_provenance WHERE link_id = 114")"
assert "2 lignes vivantes" 2 "$(live)"

echo
echo "7. Atomicité : tout échec annule le run entier"
before_runs=$(runs); before_total=$(total); before_conf=$(q "SELECT count(*) FROM public.__diag_projection_conflicts")
out=$(sr "$(apply_sql "$(payload 5 "$P113" "$(conf filtre-a-air 1 perte_puissance_filtration duplicate_relation)")")"); rc=$?
assert_err "complétude : exported 5 ≠ 1 + 1" "__diag_projection_runs_complete" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 2 "$P113,$(proj 113 filtre-a-air)" '')")"); rc=$?
assert_err "doublon (link_id, wiki_path) dans un run" "cannot affect row a second time" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 1 "$(proj 999 filtre-a-air)" '')")"); rc=$?
assert_err "lien inconnu" "encore actif" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 1 "$(proj 113 filtre-a-air '[]')" '')")"); rc=$?
assert_err "sources vides" "__diag_link_provenance_sources_check" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 1 '' "$(conf filtre-a-air 0 perte_puissance_filtration raison_inventee)")")"); rc=$?
assert_err "raison hors vocabulaire" "__diag_projection_conflicts_reason_check" "$out" "$rc"
q "UPDATE public.__diag_symptom_cause_link SET active = false WHERE id = 117" >/dev/null
out=$(sr "$(apply_sql "$(payload 2 "$P113,$P117" '')")"); rc=$?
assert_err "lien désactivé (active = false)" "encore actif" "$out" "$rc"
q "UPDATE public.__diag_symptom_cause_link SET active = NULL WHERE id = 117" >/dev/null
out=$(sr "$(apply_sql "$(payload 2 "$P113,$P117" '')")"); rc=$?
assert_err "lien à active NULL" "encore actif" "$out" "$rc"
q "UPDATE public.__diag_symptom_cause_link SET active = true WHERE id = 117" >/dev/null
assert "aucun run laissé par les échecs"        "$before_runs"  "$(runs)"
assert "aucune provenance laissée par les échecs" "$before_total" "$(total)"
assert "aucun conflit laissé par les échecs"    "$before_conf"  "$(q "SELECT count(*) FROM public.__diag_projection_conflicts")"

echo
echo "8. Run en échec enregistré à part (insertion directe du writer)"
out=$(sr "INSERT INTO public.__diag_projection_runs (triggered_by, runtime_env, status, error) VALUES ('admin', 'test', 'failed', 'index_missing');"); rc=$?
assert "run failed avec error" 0 "$rc"
out=$(sr "INSERT INTO public.__diag_projection_runs (triggered_by, runtime_env, status) VALUES ('admin', 'test', 'failed');"); rc=$?
assert_err "run failed sans error" "__diag_projection_runs_failed_has_error" "$out" "$rc"
out=$(sr "INSERT INTO public.__diag_projection_runs (triggered_by, runtime_env, status, error) VALUES ('cron', 'test', 'failed', 'index_missing');"); rc=$?
assert_err "triggered_by hors vocabulaire" "__diag_projection_runs_triggered_by_check" "$out" "$rc"
out=$(sr "UPDATE public.__diag_link_provenance SET retired_at = now() WHERE retired_at IS NULL;"); rc=$?
assert_err "retired_at sans retired_run_id" "__diag_link_provenance_retired_pair" "$out" "$rc"

echo
echo "9. Verrous : consultatif pendant le run, FOR SHARE sur les liens projetés"
assert "verrou consultatif tenu dans la transaction" 1 "$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA <<SQL | tail -1
BEGIN;
SET LOCAL ROLE service_role;
$(apply_sql "$(payload 1 "$P113" '')")
SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid();
ROLLBACK;
SQL
)"
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA >/dev/null 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
$(apply_sql "$(payload 1 "$P113" '')")
SELECT pg_sleep(4);
ROLLBACK;
SQL
holder=$!
# Attente déterministe, pas un délai fixe : sur un runner chargé, l'UPDATE
# passerait avant les verrous. Le run concurrent est prêt quand il a rendu la
# main (pg_sleep) en tenant toujours son verrou consultatif.
held=0
for _ in $(seq 1 50); do
  held=$(q "SELECT count(*) FROM pg_stat_activity a WHERE a.wait_event = 'PgSleep' AND EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND l.locktype = 'advisory' AND l.granted)")
  [[ "$held" == 1 ]] && break; sleep 0.1
done
[[ "$held" == 1 ]] || { echo "FATAL: le run concurrent n'a pas pris ses verrous"; wait "$holder"; exit 2; }
out=$(q "SET lock_timeout = '1s'; UPDATE public.__diag_symptom_cause_link SET active = false WHERE id = 113;" 2>&1); rc=$?
assert_err "désactivation concurrente d'un lien projeté bloquée" "lock timeout" "$out" "$rc"
wait "$holder"
assert "lien 113 toujours actif" t "$(q "SELECT active FROM public.__diag_symptom_cause_link WHERE id = 113")"

echo
echo "10. Index valide à 0 entrée : tout ce qui vit est retiré"
live_before=$(live)
out=$(sr "$(apply_sql "$(payload 0 '' '')")"); rc=$?
assert "run appliqué" 0 "$rc"
assert "retired_count = lignes vivantes avant" "$live_before" "$(q "SELECT retired_count FROM public.__diag_projection_runs WHERE id = (SELECT max(id) FROM public.__diag_projection_runs)")"
assert "0 ligne vivante" 0 "$(live)"

echo
echo "11. Idempotence : rejouer la migration"
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" >/dev/null 2>&1; rc=$?
assert "rejeu sans erreur" 0 "$rc"
assert "3 politiques service_role" 3 "$(q "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE '\_\_diag\_%\_service\_role\_all' AND tablename IN ('__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance')")"
assert "anon EXECUTE toujours refusé après rejeu" REFUSE_FONCTION "$(probe anon "$EMPTY")"
assert "historique conservé après rejeu" "$(total)" "$(q "SELECT count(*) FROM public.__diag_link_provenance")"

echo
echo "12. Rollback : le .down.sql retire les 4 objets, la migration se rejoue ensuite"
links_before=$(q "SELECT count(*) FROM public.__diag_symptom_cause_link")
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$DOWN" >/dev/null 2>&1; rc=$?
assert "rollback sans erreur" 0 "$rc"
assert "0 table de provenance restante" 0 "$(q "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance')")"
assert "fonction retirée" 0 "$(q "SELECT count(*) FROM pg_proc WHERE proname = '__diag_projection_apply'")"
assert "liens du moteur intacts" "$links_before" "$(q "SELECT count(*) FROM public.__diag_symptom_cause_link")"
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" >/dev/null 2>&1; rc=$?
assert "migration rejouée après rollback" 0 "$rc"
assert "anon EXECUTE refusé après rejeu" REFUSE_FONCTION "$(probe anon "$EMPTY")"

echo
echo "Résultat : $pass PASS, $fail FAIL"
[[ $fail -eq 0 ]] || exit 1
```

- [ ] **Étape 3 : vérifier l'échec**

Run : `bash scripts/db/test-diag-link-provenance.sh; echo "exit=$?"`
Attendu : `FATAL: 0 migration(s) *_diag_link_provenance.sql (1 attendue)` puis `exit=2`.

- [ ] **Étape 4 : écrire la migration**

Créer `backend/supabase/migrations/20261001_diag_link_provenance.sql` avec exactement ce contenu :

```sql
-- =============================================================================
-- Migration : provenance WIKI des liens symptôme → cause du moteur de diagnostic
-- Date      : 2026-10-01
-- Severity  : LOW (additif : 3 tables neuves, 1 fonction neuve ; aucune table
--             existante n'est modifiée, aucune ligne existante n'est écrite)
-- Scope     : public.__diag_projection_runs, public.__diag_projection_conflicts,
--             public.__diag_link_provenance, public.__diag_projection_apply(jsonb)
-- Spec      : docs/superpowers/specs/2026-09-30-diagnostic-wiki-provenance-design.md §4.4
-- =============================================================================
--
-- Tables couvertes
--
--   - public.__diag_projection_runs       un run de projection WIKI → DB (appliqué ou en échec)
--   - public.__diag_projection_conflicts  une relation exportée non projetée, avec sa raison
--   - public.__diag_link_provenance       une ligne par couple (lien symptôme → cause, fiche WIKI)
--
-- Risk before this migration
-- --------------------------
-- Les 162 liens de __diag_symptom_cause_link n'ont aucune origine traçable : rien
-- ne distingue un lien documenté par une fiche WIKI sourcée d'un lien saisi à la
-- main. Le moteur ne peut donc ni exposer ni pondérer une preuve.
--
-- Backend impact
-- --------------
-- Aucun lecteur existant. Seul écrivain : DiagnosticProjectionWriterService
-- (client service_role), via __diag_projection_apply pour un run appliqué et par
-- insertion directe dans __diag_projection_runs pour un run en échec. Drapeau
-- DIAGNOSTIC_PROJECTION_ENABLED, OFF par défaut : sans lui, aucune écriture.
-- __diag_symptom_cause_link n'est lu que pour la re-vérification `active` et
-- verrouillé en FOR SHARE le temps de la transaction d'un run.
--
-- Strategy
-- --------
-- Additive et idempotente (IF NOT EXISTS, CREATE OR REPLACE, politiques en bloc
-- DO). RLS activée + politique service_role, REVOKE anon/authenticated (patron de
-- 20260422_enable_rls_diag_tables.sql). EXECUTE de la fonction réservé à
-- service_role : les privilèges par défaut Supabase l'accordent à anon, d'où le
-- REVOKE explicite.
--
-- Timeouts explicites, jamais hérités du rôle (60 s pour `postgres`) : les clés
-- étrangères vers __diag_symptom_cause_link prennent un verrou SHARE ROW
-- EXCLUSIVE sur cette table (écritures bloquées, lectures du moteur libres), bref
-- puisque les tables créées sont vides.
--
-- Aucune exemption squawk. Vérifié avec squawk 2.52.1 (version de la CI) :
--   require-concurrent-index-creation ne se lève pas, les deux index portant sur
--   des tables créées dans ce même fichier ;
--   prefer-bigint-over-int se levait sur link_id (integer, le type de
--   __diag_symptom_cause_link.id) : la colonne est en bigint, la clé étrangère
--   int8 → int4 est admise (même famille d'opérateurs btree).
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ── 1. Runs ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__diag_projection_runs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  triggered_by    text NOT NULL CHECK (triggered_by IN ('repeatable', 'admin')),
  runtime_env     text NOT NULL,
  index_sha256    text,
  builder_version text,
  exported_count  bigint NOT NULL DEFAULT 0 CHECK (exported_count >= 0),
  projected_count bigint NOT NULL DEFAULT 0 CHECK (projected_count >= 0),
  conflict_count  bigint NOT NULL DEFAULT 0 CHECK (conflict_count >= 0),
  retired_count   bigint NOT NULL DEFAULT 0 CHECK (retired_count >= 0),
  status          text NOT NULL CHECK (status IN ('applied', 'failed')),
  error           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  CONSTRAINT __diag_projection_runs_complete
    CHECK (status <> 'applied' OR exported_count = projected_count + conflict_count),
  CONSTRAINT __diag_projection_runs_failed_has_error
    CHECK (status <> 'failed' OR error IS NOT NULL)
);

-- ── 2. Conflits ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__diag_projection_conflicts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id         bigint NOT NULL
                   REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  wiki_path      text NOT NULL,
  gamme_slug     text NOT NULL,
  relation_index bigint NOT NULL CHECK (relation_index >= 0),
  symptom_slug   text,
  system_slug    text,
  reason         text NOT NULL CHECK (reason IN (
                   'schema_invalid', 'not_a_cause_relation', 'unknown_symptom',
                   'system_mismatch', 'no_matching_link', 'ambiguous_cause',
                   'duplicate_relation', 'source_not_raw_proven')),
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS __diag_projection_conflicts_run_id_idx
  ON public.__diag_projection_conflicts (run_id);

-- ── 3. Provenance ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__diag_link_provenance (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id                   bigint NOT NULL
                              REFERENCES public.__diag_symptom_cause_link (id) ON DELETE RESTRICT,
  wiki_path                 text NOT NULL,
  gamme_slug                text NOT NULL,
  wiki_commit               text NOT NULL,
  content_hash              text NOT NULL,
  relation_to_part          text NOT NULL,
  part_role                 text NOT NULL,
  confidence                text NOT NULL,
  source_policy             text NOT NULL,
  confidence_score_computed numeric NOT NULL,
  reviewed                  boolean NOT NULL,
  diagnostic_safe           boolean NOT NULL,
  sources                   jsonb NOT NULL
                              CHECK (jsonb_typeof(sources) = 'array' AND sources <> '[]'::jsonb),
  first_run_id              bigint NOT NULL
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  last_run_id               bigint NOT NULL
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  projected_at              timestamptz NOT NULL DEFAULT now(),
  retired_at                timestamptz,
  retired_run_id            bigint
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  CONSTRAINT __diag_link_provenance_retired_pair
    CHECK ((retired_at IS NULL) = (retired_run_id IS NULL))
);

-- Une seule ligne VIVANTE par couple (lien, fiche) ; l'historique retiré reste.
CREATE UNIQUE INDEX IF NOT EXISTS __diag_link_provenance_live_uniq
  ON public.__diag_link_provenance (link_id, wiki_path)
  WHERE retired_at IS NULL;

-- ── 4. RLS (patron 20260422_enable_rls_diag_tables.sql) ─────────────────────

REVOKE ALL ON TABLE public.__diag_link_provenance FROM anon, authenticated;
ALTER TABLE public.__diag_link_provenance ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = '__diag_link_provenance'
      AND policyname = '__diag_link_provenance_service_role_all'
  ) THEN
    CREATE POLICY __diag_link_provenance_service_role_all ON public.__diag_link_provenance
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_projection_conflicts FROM anon, authenticated;
ALTER TABLE public.__diag_projection_conflicts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = '__diag_projection_conflicts'
      AND policyname = '__diag_projection_conflicts_service_role_all'
  ) THEN
    CREATE POLICY __diag_projection_conflicts_service_role_all ON public.__diag_projection_conflicts
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_projection_runs FROM anon, authenticated;
ALTER TABLE public.__diag_projection_runs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = '__diag_projection_runs'
      AND policyname = '__diag_projection_runs_service_role_all'
  ) THEN
    CREATE POLICY __diag_projection_runs_service_role_all ON public.__diag_projection_runs
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 5. Application atomique d'un run ────────────────────────────────────────
--
-- Une seule transaction : verrou consultatif (DEV:3000 et PROD partagent la base,
-- pas la file BullMQ) → run → re-vérification `active` sous FOR SHARE → upsert
-- des lignes vivantes → retrait des lignes non reprises par ce run → conflits →
-- assertion de complétude. Toute erreur annule l'ensemble : un run partiel est
-- impossible. Le writer enregistre alors un run `failed` à part.
--
-- Payload :
--   { triggered_by, runtime_env, index_sha256, builder_version, exported_count,
--     started_at?, projections: [ {link_id, wiki_path, gamme_slug, wiki_commit,
--     content_hash, relation_to_part, part_role, confidence, source_policy,
--     confidence_score_computed, reviewed, diagnostic_safe, sources} ],
--     conflicts: [ {wiki_path, gamme_slug, relation_index, symptom_slug,
--     system_slug, reason, detail} ] }
-- Retour : { run_id, projected_count, conflict_count, retired_count }

CREATE OR REPLACE FUNCTION public.__diag_projection_apply(p_run jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_projected bigint := jsonb_array_length(p_run -> 'projections');
  v_conflicts bigint := jsonb_array_length(p_run -> 'conflicts');
  v_run_id    bigint;
  v_wanted    bigint;
  v_locked    bigint;
  v_upserted  bigint;
  v_retired   bigint;
  v_recorded  bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('__diag_projection_apply'));

  -- Le CHECK __diag_projection_runs_complete valide exported = projected + conflicts
  -- dès l'insertion, avec les comptes DÉCLARÉS par le payload.
  INSERT INTO __diag_projection_runs (
    triggered_by, runtime_env, index_sha256, builder_version,
    exported_count, projected_count, conflict_count, retired_count, status, started_at
  ) VALUES (
    p_run ->> 'triggered_by', p_run ->> 'runtime_env', p_run ->> 'index_sha256',
    p_run ->> 'builder_version', (p_run ->> 'exported_count')::bigint,
    v_projected, v_conflicts, 0, 'applied',
    coalesce((p_run ->> 'started_at')::timestamptz, now())
  )
  RETURNING id INTO v_run_id;

  -- Re-vérification : chaque lien à documenter est encore actif, et le reste
  -- jusqu'au COMMIT (FOR SHARE bloque sa désactivation concurrente).
  SELECT count(DISTINCT (p ->> 'link_id')::bigint) INTO v_wanted
  FROM jsonb_array_elements(p_run -> 'projections') AS p;

  PERFORM 1
  FROM __diag_symptom_cause_link AS l
  WHERE l.active IS TRUE
    AND l.id IN (
      SELECT (p ->> 'link_id')::bigint
      FROM jsonb_array_elements(p_run -> 'projections') AS p
    )
  FOR SHARE OF l;
  GET DIAGNOSTICS v_locked = ROW_COUNT;

  IF v_locked <> v_wanted THEN
    RAISE EXCEPTION '__diag_projection_apply: % lien(s) à projeter, % encore actif(s)',
      v_wanted, v_locked;
  END IF;

  -- Upsert des lignes vivantes. first_run_id et projected_at ne sont posés qu'à
  -- la création : ils datent la PREMIÈRE projection du couple (lien, fiche).
  INSERT INTO __diag_link_provenance AS lp (
    link_id, wiki_path, gamme_slug, wiki_commit, content_hash,
    relation_to_part, part_role, confidence, source_policy,
    confidence_score_computed, reviewed, diagnostic_safe, sources,
    first_run_id, last_run_id
  )
  SELECT
    (p ->> 'link_id')::bigint, p ->> 'wiki_path', p ->> 'gamme_slug',
    p ->> 'wiki_commit', p ->> 'content_hash',
    p ->> 'relation_to_part', p ->> 'part_role', p ->> 'confidence', p ->> 'source_policy',
    (p ->> 'confidence_score_computed')::numeric, (p ->> 'reviewed')::boolean,
    (p ->> 'diagnostic_safe')::boolean, p -> 'sources',
    v_run_id, v_run_id
  FROM jsonb_array_elements(p_run -> 'projections') AS p
  ON CONFLICT (link_id, wiki_path) WHERE retired_at IS NULL DO UPDATE SET
    gamme_slug                = EXCLUDED.gamme_slug,
    wiki_commit               = EXCLUDED.wiki_commit,
    content_hash              = EXCLUDED.content_hash,
    relation_to_part          = EXCLUDED.relation_to_part,
    part_role                 = EXCLUDED.part_role,
    confidence                = EXCLUDED.confidence,
    source_policy             = EXCLUDED.source_policy,
    confidence_score_computed = EXCLUDED.confidence_score_computed,
    reviewed                  = EXCLUDED.reviewed,
    diagnostic_safe           = EXCLUDED.diagnostic_safe,
    sources                   = EXCLUDED.sources,
    last_run_id               = EXCLUDED.last_run_id;
  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  -- Retrait doux : toute ligne vivante que CE run n'a pas reprise.
  UPDATE __diag_link_provenance
  SET retired_at = now(), retired_run_id = v_run_id
  WHERE retired_at IS NULL
    AND last_run_id <> v_run_id;
  GET DIAGNOSTICS v_retired = ROW_COUNT;

  INSERT INTO __diag_projection_conflicts (
    run_id, wiki_path, gamme_slug, relation_index, symptom_slug, system_slug, reason, detail
  )
  SELECT
    v_run_id, c ->> 'wiki_path', c ->> 'gamme_slug', (c ->> 'relation_index')::bigint,
    c ->> 'symptom_slug', c ->> 'system_slug', c ->> 'reason',
    coalesce(c -> 'detail', '{}'::jsonb)
  FROM jsonb_array_elements(p_run -> 'conflicts') AS c;
  GET DIAGNOSTICS v_recorded = ROW_COUNT;

  IF v_upserted <> v_projected OR v_recorded <> v_conflicts THEN
    RAISE EXCEPTION '__diag_projection_apply: écrit % projection(s) / % conflit(s), déclaré % / %',
      v_upserted, v_recorded, v_projected, v_conflicts;
  END IF;

  UPDATE __diag_projection_runs
  SET retired_count = v_retired, finished_at = now()
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'projected_count', v_projected,
    'conflict_count', v_conflicts,
    'retired_count', v_retired
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.__diag_projection_apply(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__diag_projection_apply(jsonb) TO service_role;
```

- [ ] **Étape 5 : écrire le rollback**

Créer `backend/supabase/migrations/20261001_diag_link_provenance.down.sql` avec exactement ce contenu :

```sql
-- Rollback: 20261001_diag_link_provenance
-- Retire la fonction puis les 3 tables, dans l'ordre inverse des clés étrangères
-- (provenance et conflits référencent les runs). DESTRUCTIF : l'historique des runs
-- et des provenances est perdu, d'où le GO owner avant de le lancer. L'engine est
-- forward-only : ce fichier se lance à la main.
-- Couper d'abord DIAGNOSTIC_PROJECTION_ENABLED : un run en cours tiendrait les
-- verrous que les DROP attendent (lock_timeout borné, jamais hérité du rôle).
SET lock_timeout = '5s';
SET statement_timeout = '30s';

DROP FUNCTION IF EXISTS public.__diag_projection_apply(jsonb);
DROP TABLE IF EXISTS public.__diag_link_provenance;
DROP TABLE IF EXISTS public.__diag_projection_conflicts;
DROP TABLE IF EXISTS public.__diag_projection_runs;
```

- [ ] **Étape 6 : vérifier que le harnais passe**

Run : `bash scripts/db/test-diag-link-provenance.sh 2>&1 | tail -3; echo "exit=${PIPESTATUS[0]}"`
Attendu : `Résultat : 69 PASS, 0 FAIL` puis `exit=0`. Le premier lancement tire l'image `postgres:17-alpine` ; le conteneur lui-même tourne sans réseau.

- [ ] **Étape 7 : gardes de migration de la CI, rejouées localement**

Les trois steps du job « Migration Safety » de `ci.yml`, avec les mêmes commandes :

```bash
squawk --config .squawk.toml backend/supabase/migrations/20261001_diag_link_provenance.sql
python3 scripts/ci/apply-supabase-migration.py --lint-markers backend/supabase/migrations/20261001_diag_link_provenance.sql
bash scripts/lint/check-definer-anon-surface.test.sh >/dev/null && echo DEFINER_TESTS_OK
bash scripts/lint/check-definer-anon-surface.sh
```

Attendu : `Found 0 issues in 1 file` ; `OK — @non_transactional reconciled on 1 file(s).` ; `DEFINER_TESTS_OK` ; `OK — surface DEFINER/anon inchangée (13 migration(s) jugée(s) depuis 20260917, 35 fonction(s) dans l'ensemble fermé, 12 exception(s) motivée(s)).` (compteurs au 2026-10-01 ; le nombre de migrations jugées croît avec `main`, les deux autres ne doivent pas bouger). La RPC est SECURITY INVOKER : elle n'entre pas dans l'ensemble DEFINER.

- [ ] **Étape 8 : mutations SQL — chaque garde de la migration doit avoir une assertion qui la tue**

Créer `$SCRATCH/mut_sql.py` avec exactement ce contenu :

```python
#!/usr/bin/env python3
"""Mutants SQL de la migration de provenance : chacun doit faire échouer le harnais.

Lancer depuis la racine du worktree : python3 "$SCRATCH/mut_sql.py"
m1-m4 mutent une COPIE de la migration (MIGRATION_UNDER_TEST) ; m5 mute le
rollback du dépôt en place (le harnais lit toujours celui du dépôt) et le restaure.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

MIG = Path("backend/supabase/migrations/20261001_diag_link_provenance.sql")
DOWN = Path("backend/supabase/migrations/20261001_diag_link_provenance.down.sql")
HARNESS = ["bash", "scripts/db/test-diag-link-provenance.sh"]
MUTANTS = [
    ("m1-no-revoke-exec", MIG,
     "REVOKE EXECUTE ON FUNCTION public.__diag_projection_apply(jsonb) FROM PUBLIC, anon, authenticated;\n", ""),
    ("m2-no-for-share", MIG, "    )\n  FOR SHARE OF l;", "    );"),
    ("m3-no-active-check", MIG, "  WHERE l.active IS TRUE", "  WHERE true"),
    ("m4-no-revoke-table", MIG,
     "REVOKE ALL ON TABLE public.__diag_link_provenance FROM anon, authenticated;\n", ""),
    ("m5-down-keeps-runs", DOWN, "DROP TABLE IF EXISTS public.__diag_projection_runs;\n", ""),
]


def run(env_extra: dict) -> subprocess.CompletedProcess:
    return subprocess.run(HARNESS, capture_output=True, text=True,
                          env={**os.environ, **env_extra}, timeout=900)


def main() -> int:
    survivors = []
    for name, target, old, new in MUTANTS:
        original = target.read_text(encoding="utf-8")
        if original.count(old) != 1:
            print(f"SETUP-ERROR {name}: ancre trouvée {original.count(old)} fois")
            return 2
        mutated = original.replace(old, new)
        if target == MIG:
            with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as tmp:
                tmp.write(mutated)
            try:
                r = run({"MIGRATION_UNDER_TEST": tmp.name})
            finally:
                os.unlink(tmp.name)
        else:
            try:
                target.write_text(mutated, encoding="utf-8")
                r = run({})
            finally:
                target.write_text(original, encoding="utf-8")
        fails = [l.strip() for l in r.stdout.splitlines() if l.strip().startswith("FAIL")]
        verdict = "KILLED" if r.returncode == 1 and fails else "SURVIVED"
        if verdict == "SURVIVED":
            survivors.append(name)
        print(f"{verdict:8} {name}  exit={r.returncode}  {len(fails)} FAIL  {fails[:1]}")
    print("survivors:", survivors)
    return 1 if survivors else 0


sys.exit(main())
```

Run : `python3 "$SCRATCH/mut_sql.py"` (depuis la racine du worktree ; environ 5 lancements du harnais)
Attendu : chaque mutant `KILLED` (`m1` 65 PASS / 4 FAIL, `m2` 67/2, `m3` 65/4, `m4` 67/2, `m5` 68/1 avec `0 table de provenance restante → obtenu '1', attendu '0'`), dernière ligne `survivors: []`, et `git status --porcelain` identique à avant (le rollback muté par `m5` est restauré).

- [ ] **Étape 9 : ratchet des surfaces servies — test d'abord**

`__diag_link_provenance` sera lue par le moteur (Plan 3) : c'est une table servie, et ses écrivains doivent être comptés.

Écrire ce diff dans `$SCRATCH/ratchet-test-sql.diff`, puis `git apply "$SCRATCH/ratchet-test-sql.diff"` :

```diff
--- a/scripts/audit/check-served-content-write-sinks-ratchet.test.ts
+++ b/scripts/audit/check-served-content-write-sinks-ratchet.test.ts
@@ -50,6 +50,16 @@
   );
 });
 
+test("sql_migration: the provenance RPC body (INSERT INTO … DO UPDATE SET + UPDATE) counts 2", () => {
+  assert.deepEqual(
+    detectSqlSinks(
+      "p.sql",
+      `INSERT INTO __diag_link_provenance AS lp (link_id) VALUES (1)\n  ON CONFLICT (link_id, wiki_path) WHERE retired_at IS NULL DO UPDATE SET part_role = 'x';\nUPDATE __diag_link_provenance SET retired_at = now();`,
+    ),
+    [F("sql_migration", "p.sql::__diag_link_provenance", 2)],
+  );
+});
+
 test("direct_literal: a READ (.select) is NOT a sink", () => {
   assert.deepEqual(detectTsSinks("x.ts", `.from('__seo_r7_pages').select('*')`), []);
 });
```

Run : `npm run -s audit:served-write-ratchet:test 2>&1 | grep -E '^ℹ (tests|pass|fail) '`
Attendu : `ℹ tests 18`, `ℹ pass 17`, `ℹ fail 1` ; le test en échec affiche `actual: []` face à l'attendu `sql_migration` / `p.sql::__diag_link_provenance` / `count 2`.

- [ ] **Étape 10 : déclarer la table servie**

Écrire ce diff dans `$SCRATCH/ratchet-tables.diff`, puis `git apply "$SCRATCH/ratchet-tables.diff"` :

```diff
--- a/scripts/audit/check-served-content-write-sinks-ratchet.ts
+++ b/scripts/audit/check-served-content-write-sinks-ratchet.ts
@@ -63,6 +63,7 @@
   "__diag_cause",
   "__diag_system",
   "__diag_safety_rule",
+  "__diag_link_provenance",
   "___meta_tags_ariane",
   "__seo_reference",
   "__seo_observable",
```

```bash
npm run -s audit:served-write-ratchet:test 2>&1 | grep -E '^ℹ (tests|pass|fail) '
npm run -s audit:served-write-ratchet; echo "check_exit=$?"
```

Attendu : `ℹ tests 18`, `ℹ pass 18`, `ℹ fail 0` ; puis le contrôle échoue (`check_exit=1`) avec `+ sql_migration::backend/supabase/migrations/20261001_diag_link_provenance.sql::__diag_link_provenance (was 0, now 2)` : la nouvelle surface est vue, pas encore déclarée.

- [ ] **Étape 11 : rafraîchir la baseline par le script**

```bash
npm run -s audit:served-write-ratchet:refresh
npm run -s audit:served-write-ratchet
git diff --stat audit/baselines/served-content-write-sinks-baseline.json
```

Attendu : `✅ served-content write sinks: count-exact match with baseline (61 keys, 266 occurrences).` (60 / 264 sur `main` au 2026-10-01) ; la baseline ne change que par l'entrée de la migration.

- [ ] **Étape 12 : commit**

```bash
git add scripts/db/diag-link-provenance-fixture.sql scripts/db/test-diag-link-provenance.sh \
  backend/supabase/migrations/20261001_diag_link_provenance.sql backend/supabase/migrations/20261001_diag_link_provenance.down.sql \
  scripts/audit/check-served-content-write-sinks-ratchet.ts scripts/audit/check-served-content-write-sinks-ratchet.test.ts \
  audit/baselines/served-content-write-sinks-baseline.json
git commit -F - <<'EOF'
feat(db): provenance WIKI des liens du moteur de diagnostic

Trois tables service_role seul (__diag_projection_runs, __diag_projection_conflicts,
__diag_link_provenance) et la RPC __diag_projection_apply : un run = une
transaction, verrou consultatif, liens projetés re-vérifiés actifs sous FOR SHARE,
retrait doux. Aucun lien n'est créé ni modifié. Harnais PostgreSQL 17 jetable
(69 assertions, 5 mutants tués) ; __diag_link_provenance déclarée table servie
dans le ratchet des écrivains.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git show --stat --format='%h %s' HEAD
```

Attendu : 7 fichiers. Le mode de `scripts/db/test-diag-link-provenance.sh` est `100755` (`git ls-files -s scripts/db/test-diag-link-provenance.sh`).

- [ ] **Étape 13 : gate de propriété des nouveaux fichiers**

Run : `node scripts/registry/check-new-files.js --base origin/main; echo "exit=$?"`
Attendu : `new files: 4 (2 ok, 2 failures)`, deux lignes `[MISSING_BOTH] backend/supabase/migrations/20261001_diag_link_provenance.sql` et `[MISSING_BOTH] backend/supabase/migrations/20261001_diag_link_provenance.down.sql` (les globs d'`ownership.yaml` ne couvrent pas les migrations une à une), puis `exit=1`. Les deux fichiers `scripts/db/*` passent (D13). Ce job (`registry-new-file-gate.yml`) n'est pas un check requis ; la correction est l'entrée ci-dessous, que seul l'owner commite dans `.spec/00-canon/repository-registry/ownership.yaml` (précédent : #1623). Le script compare les fichiers **committés** (`origin/main..HEAD`) mais lit `ownership.yaml` depuis le disque : on vérifie l'entrée dans un worktree jetable de la branche, sans rien y commiter.

```bash
cat > "$SCRATCH/ownership-snippet.yaml" <<'EOF'
  # Provenance WIKI des liens du moteur de diagnostic : tables __diag_projection_runs,
  # __diag_link_provenance, __diag_projection_conflicts + RPC __diag_projection_apply
  # (spec 2026-09-30-diagnostic-wiki-provenance-design §4.4). Couvre .sql + .down.sql.
  # Glob exact : les migrations ne sont pas auto-couvertes.
  - glob: backend/supabase/migrations/20261001_diag_link_provenance*.sql
    domain: D4
    owner: '@ak125/vehicle-team'
    sourceConfidence: high
    risk: medium
EOF
git -C /opt/automecanik/app worktree add --detach "$SCRATCH/ownchk" feat/diag-provenance-db
ln -s /opt/automecanik/app/node_modules "$SCRATCH/ownchk/node_modules"
cat "$SCRATCH/ownership-snippet.yaml" >> "$SCRATCH/ownchk/.spec/00-canon/repository-registry/ownership.yaml"
(cd "$SCRATCH/ownchk" && npm run -s registry:validate && node scripts/registry/check-new-files.js --base origin/main; echo "exit=$?")
git -C "$SCRATCH/ownchk" status --porcelain=v1 --ignored=matching
```

Attendu : `new files: 4 (4 ok, 0 failures)`, `✓ All new files pass owner+domain gate`, `exit=0` (avec `--json` : les deux migrations en D4 `@ak125/vehicle-team`). `status` ne montre que ` M .spec/00-canon/repository-registry/ownership.yaml` et `!! node_modules` ; rien d'autre n'est à conserver, on retire le worktree jetable :

```bash
rm "$SCRATCH/ownchk/node_modules"
git -C /opt/automecanik/app worktree remove --force "$SCRATCH/ownchk"
```

- [ ] **Étape 14 : PR-A (après confirmation explicite de l'utilisateur)**

```bash
git push -u origin feat/diag-provenance-db
gh pr create --repo ak125/nestjs-remix-monorepo --base main --head feat/diag-provenance-db \
  --title "feat(db): provenance WIKI des liens du moteur de diagnostic" \
  --body-file - <<'EOF'
## Quoi
Migration additive `20261001_diag_link_provenance` : trois tables réservées à `service_role`
et la RPC `__diag_projection_apply` (SECURITY INVOKER). Aucun code ne l'appelle encore
(writer à drapeau OFF dans la PR suivante). Aucun lien existant n'est créé, modifié ni supprimé.

## Preuve
- harnais PostgreSQL 17 jetable `scripts/db/test-diag-link-provenance.sh` : 69 PASS, 0 FAIL
  (surface anon/authenticated fermée, atomicité, FOR SHARE, retrait doux, index vide,
  idempotence, rollback puis rejeu) ; 5 mutants de la migration et du rollback tués ;
- squawk (version de la CI) : 0 issue ; marqueurs non transactionnels : OK ;
  surface DEFINER/anon : inchangée ;
- ratchet des écrivains de contenu servi : 18/18 tests, baseline rafraîchie par le script.

## Après fusion
- application par `apply-supabase-migrations.yml` (dry-run puis APPLY), sur GO de l'owner ;
- entrée d'`ownership.yaml` pour les deux fichiers de migration (commentaire ci-dessous, owner).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Puis, après une seconde confirmation, poster l'entrée d'ownership en commentaire (précédent #1623) :

```bash
gh pr comment feat/diag-provenance-db --repo ak125/nestjs-remix-monorepo --body-file - <<EOF
Entrée proposée pour \`.spec/00-canon/repository-registry/ownership.yaml\` (owner) — elle fait passer la gate de propriété des deux fichiers de migration (\`[MISSING_BOTH]\` → D4 \`@ak125/vehicle-team\`) :

\`\`\`yaml
$(cat "$SCRATCH/ownership-snippet.yaml")
\`\`\`
EOF
```

- [ ] **Étape 15 : CI de la PR**

```bash
gh pr checks feat/diag-provenance-db --repo ak125/nestjs-remix-monorepo --watch
```

Si le job « Registry freshness » échoue (projections régénérées depuis la nouvelle migration), appliquer tel quel le patch de son artefact, sans l'éditer (précédents #1622, #1639, #1641) :

```bash
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --branch feat/diag-provenance-db --workflow registry-fresh.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run download "$RUN" --repo ak125/nestjs-remix-monorepo -n "registry-recovery-$RUN" -D "$SCRATCH/recovery-$RUN"
git apply --numstat "$SCRATCH/recovery-$RUN/generated-projections.patch"
git apply --index "$SCRATCH/recovery-$RUN/generated-projections.patch"
git status --porcelain
```

`--index` indexe exactement les fichiers du patch ; commiter ceux-là seulement (`chore(registry): régénérer les projections après la migration de provenance`, même trailer), puis pousser après confirmation. Attendu final : tous les checks requis verts.

- [ ] **Étape 16 : preuve après fusion humaine**

```bash
SHA=$(gh pr view feat/diag-provenance-db --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow ci.yml --commit "$SHA" --event push --json databaseId -q '.[0].databaseId')
test -n "$RUN" && gh run watch "$RUN" --repo ak125/nestjs-remix-monorepo --exit-status
```

Attendu : un run existe pour ce SHA et il est vert (un run absent n'est pas un succès). Cela prouve le tag `:preprod` et le container PREPROD, pas la présence des tables : la migration n'est appliquée qu'à la Tâche 8.

---

### Tâche 2 : lecture paginée du référentiel actif

Le résolveur a besoin de tout le référentiel actif. PostgREST plafonne une réponse à 1000 lignes : une lecture tronquée ferait classer une relation `no_matching_link` et retirer sa provenance. La lecture est donc paginée, ordonnée par `id`, et comparée à un compte exact.

**Files:**
- Modify: `backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts` (`DiagProjectionLinksSchema`)
- Modify: `backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts` (`DiagnosticProjectionReference`, `getProjectionReference()`, `readActiveTable()`)
- Create: `backend/src/modules/diagnostic-engine/diagnostic-projection-reference.test.ts`

**Interfaces:**
- Consumes : schémas existants `DiagSystemsSchema`, `DiagSymptomsSchema`, `DiagCausesSchema` et types `DiagSystem`, `DiagSymptom`, `DiagCause`.
- Produces : `export interface DiagnosticProjectionReference { systems: DiagSystem[]; symptoms: DiagSymptom[]; causes: DiagCause[]; links: { id: number; symptom_id: number; cause_id: number }[] }` et `DiagnosticEngineDataService.getProjectionReference(): Promise<DiagnosticProjectionReference>` (lève si une page échoue, si le nombre de lignes diffère du compte exact, si deux liens actifs portent le même couple symptôme → cause, ou si une ligne n'est pas active).

- [ ] **Étape 1 : créer le worktree de PR-B, empilé sur PR-A**

```bash
git -C /opt/automecanik/app worktree add -b feat/diag-provenance-writer /opt/automecanik/app/.claude/worktrees/diag-provenance-writer feat/diag-provenance-db
cd /opt/automecanik/app/.claude/worktrees/diag-provenance-writer
ln -s /opt/automecanik/app/node_modules node_modules
ln -s /opt/automecanik/app/backend/node_modules backend/node_modules
git log --oneline -1 && git status --porcelain
```

Attendu : HEAD = le commit de la Tâche 1 (ou son dernier commit de recovery), `status` vide. Toutes les Tâches 2 à 7 travaillent dans ce worktree.

- [ ] **Étape 2 : écrire le test qui échoue**

Créer `backend/src/modules/diagnostic-engine/diagnostic-projection-reference.test.ts` avec exactement ce contenu :

```typescript
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';

type Reply = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
  count?: number | null;
  /** Lignes servies par page au plus (max-rows serveur plus bas que la page). */
  cap?: number;
  /** Erreur renvoyée à partir de cet offset. */
  failFrom?: number;
  /** `count` renvoyé à partir de cet offset (écriture concurrente). */
  countFrom?: { offset: number; count: number };
};

const system = {
  id: 1,
  slug: 'filtration',
  label: 'Filtration',
  description: null,
  display_order: 1,
  active: true,
};
const symptom = {
  id: 10,
  system_id: 1,
  slug: 'perte_puissance_filtration',
  label: 'Perte de puissance',
  description: null,
  signal_mode: 'symptom_slugs',
  urgency: 'moyenne',
  active: true,
};
const cause = (id: number, slug: string) => ({
  id,
  system_id: 1,
  slug,
  label: slug,
  cause_type: 'maintenance_related',
  description: null,
  verification_method: null,
  urgency: 'moyenne',
  active: true,
});
const link = (id: number, symptomId: number, causeId: number) => ({
  id,
  symptom_id: symptomId,
  cause_id: causeId,
  relative_score: 50,
  evidence_for: [],
  evidence_against: [],
  requires_verification: true,
  active: true,
});

function makeService(overrides: Partial<Record<string, Reply>> = {}) {
  const tables: Record<string, Reply> = {
    __diag_system: { data: [system], error: null },
    __diag_symptom: { data: [symptom], error: null },
    __diag_cause: {
      data: [
        cause(20, 'filtre_air_colmate'),
        cause(21, 'filtre_carburant_colmate'),
      ],
      error: null,
    },
    // Un symptôme → deux causes : l'unicité porte sur la paire, pas sur cause_id.
    __diag_symptom_cause_link: {
      data: [link(113, 10, 20), link(114, 10, 21)],
      error: null,
    },
    ...overrides,
  };
  const calls: Array<{
    table: string;
    select: unknown[];
    filters: unknown[][];
    from: number;
    to: number;
  }> = [];
  const service = Object.create(
    DiagnosticEngineDataService.prototype,
  ) as DiagnosticEngineDataService;
  Object.assign(service, {
    logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
    supabase: {
      from: (table: string) => {
        const reply = tables[table];
        if (!reply) throw new Error(`Unexpected table: ${table}`);
        const trace = {
          table,
          select: [] as unknown[],
          filters: [] as unknown[][],
          from: 0,
          to: 0,
        };
        calls.push(trace);
        const query = {
          select: (...args: unknown[]) => {
            trace.select = args;
            return query;
          },
          eq: (...args: unknown[]) => {
            trace.filters.push(['eq', ...args]);
            return query;
          },
          order: (...args: unknown[]) => {
            trace.filters.push(['order', ...args]);
            return query;
          },
          range: (from: number, to: number) => {
            trace.filters.push(['range', from, to]);
            trace.from = from;
            trace.to = to;
            return query;
          },
          then: (resolve: (value: Reply) => unknown) => {
            const all = reply.data;
            const total =
              reply.count !== undefined
                ? reply.count
                : Array.isArray(all)
                  ? all.length
                  : null;
            const failed =
              reply.failFrom !== undefined && trace.from >= reply.failFrom;
            const end = Math.min(
              trace.to + 1,
              trace.from + (reply.cap ?? Number.POSITIVE_INFINITY),
            );
            return Promise.resolve({
              data: failed || !all ? null : all.slice(trace.from, end),
              error: failed ? { message: 'boom' } : reply.error,
              count:
                reply.countFrom && trace.from >= reply.countFrom.offset
                  ? reply.countFrom.count
                  : total,
            }).then(resolve);
          },
        };
        return query;
      },
    },
  });
  return { service, calls };
}

/** 1001 liens actifs distincts : une page pleine puis une page d'une ligne. */
const manyLinks = Array.from({ length: 1001 }, (_, i) =>
  link(1000 + i, 10, 5000 + i),
);

describe('DiagnosticEngineDataService.getProjectionReference', () => {
  it('reads the four active tables with an exact count, ordered by id, one page each', async () => {
    const { service, calls } = makeService();
    const reference = await service.getProjectionReference();

    expect(reference.links.map((row) => row.id)).toEqual([113, 114]);
    expect(reference.causes).toHaveLength(2);
    expect(calls.map((call) => call.table).sort()).toEqual([
      '__diag_cause',
      '__diag_symptom',
      '__diag_symptom_cause_link',
      '__diag_system',
    ]);
    for (const call of calls) {
      expect(call.select).toEqual(['*', { count: 'exact' }]);
      expect(call.filters).toEqual([
        ['eq', 'active', true],
        ['order', 'id', { ascending: true }],
        ['range', 0, 999],
      ]);
    }
  });

  it('reads past the 1000-row PostgREST cap, page by page', async () => {
    const { service, calls } = makeService({
      __diag_symptom_cause_link: { data: manyLinks, error: null },
    });
    const reference = await service.getProjectionReference();

    expect(reference.links).toHaveLength(1001);
    expect(reference.links[1000].id).toBe(2000);
    expect(
      calls
        .filter((call) => call.table === '__diag_symptom_cause_link')
        .map((call) => [call.from, call.to]),
    ).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('throws when the server serves fewer rows than the exact count', async () => {
    const { service } = makeService({
      __diag_symptom_cause_link: {
        data: [link(113, 10, 20), link(114, 10, 21), link(115, 10, 22)],
        error: null,
        cap: 2,
      },
    });
    await expect(service.getProjectionReference()).rejects.toThrow(
      '__diag_symptom_cause_link incomplete: 2 row(s) read, 3 active',
    );
  });

  it('throws when the active count changes between pages', async () => {
    const { service } = makeService({
      __diag_symptom_cause_link: {
        data: manyLinks,
        error: null,
        countFrom: { offset: 1000, count: 1002 },
      },
    });
    await expect(service.getProjectionReference()).rejects.toThrow(
      '__diag_symptom_cause_link changed during read: 1002 active, 1001 at offset 0',
    );
  });

  it('throws when a table read fails', async () => {
    const { service } = makeService({
      __diag_cause: { data: null, error: { message: 'boom' } },
    });
    await expect(service.getProjectionReference()).rejects.toThrow(
      '__diag_cause unavailable at offset 0: boom',
    );
  });

  it('throws when a later page fails', async () => {
    const { service } = makeService({
      __diag_symptom_cause_link: {
        data: manyLinks,
        error: null,
        failFrom: 1000,
      },
    });
    await expect(service.getProjectionReference()).rejects.toThrow(
      '__diag_symptom_cause_link unavailable at offset 1000: boom',
    );
  });

  it('rejects two active links for the same symptom → cause pair', async () => {
    const { service } = makeService({
      __diag_symptom_cause_link: {
        data: [link(113, 10, 20), link(999, 10, 20)],
        error: null,
      },
    });
    await expect(service.getProjectionReference()).rejects.toThrow();
  });

  it('rejects a row that is not active', async () => {
    const { service } = makeService({
      __diag_symptom: { data: [{ ...symptom, active: null }], error: null },
    });
    await expect(service.getProjectionReference()).rejects.toThrow();
  });
});
```

- [ ] **Étape 3 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/diagnostic-projection-reference.test.ts`
Attendu : la suite échoue à la compilation, `TS2339: Property 'getProjectionReference' does not exist on type 'DiagnosticEngineDataService'.`

- [ ] **Étape 4 : implémenter**

Écrire ce diff dans `$SCRATCH/schema.diff`, puis `git apply "$SCRATCH/schema.diff"` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts b/backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts
index c8170611e..878f45eb0 100644
--- a/backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts
+++ b/backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts
@@ -75,6 +75,16 @@ export const DiagCausesSchema = z
 export const DiagCauseLinksSchema = z
   .array(DiagCauseLinkRowSchema)
   .refine((rows) => unique(rows, 'id') && unique(rows, 'cause_id'));
+// Toute la table des liens actifs (projection WIKI → DB) : un symptôme a
+// plusieurs causes, donc l'unicité porte sur la paire, pas sur `cause_id`.
+export const DiagProjectionLinksSchema = z
+  .array(DiagCauseLinkRowSchema)
+  .refine(
+    (rows) =>
+      unique(rows, 'id') &&
+      new Set(rows.map((row) => `${row.symptom_id}:${row.cause_id}`)).size ===
+        rows.length,
+  );
 export const DiagSafetyRulesSchema = z
   .array(DiagSafetyRuleRowSchema)
   .refine((rows) => unique(rows, 'id') && unique(rows, 'rule_slug'));
```

Écrire ce diff dans `$SCRATCH/data-service.diff`, puis `git apply "$SCRATCH/data-service.diff"` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts b/backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts
index 7b70dfd9e..8af0a1f64 100644
--- a/backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts
+++ b/backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts
@@ -18,6 +18,7 @@ import {
   DiagSymptomsSchema,
   DiagCauseLinksSchema,
   DiagCausesSchema,
+  DiagProjectionLinksSchema,
   DiagSafetyRulesSchema,
 } from './types/diagnostic-reference.schema';
 
@@ -95,6 +96,14 @@ export interface MaintenanceOperation {
   related_pg_id: number | null;
 }
 
+/** Référentiel actif complet lu par la projection WIKI → DB (ordre : id croissant). */
+export interface DiagnosticProjectionReference {
+  systems: DiagSystem[];
+  symptoms: DiagSymptom[];
+  causes: DiagCause[];
+  links: DiagSymptomCauseLink[];
+}
+
 @Injectable()
 export class DiagnosticEngineDataService extends SupabaseBaseService {
   protected readonly logger = new Logger(DiagnosticEngineDataService.name);
@@ -442,6 +451,68 @@ export class DiagnosticEngineDataService extends SupabaseBaseService {
     return data || [];
   }
 
+  /**
+   * Référentiel actif complet (systèmes, symptômes, causes, liens) pour la
+   * projection WIKI → DB. Une table lue partiellement donnerait des conflits
+   * `no_matching_link` erronés : lecture paginée + `count` exact contrôlé.
+   */
+  async getProjectionReference(): Promise<DiagnosticProjectionReference> {
+    const [systems, symptoms, causes, links] = await Promise.all([
+      this.readActiveTable('__diag_system'),
+      this.readActiveTable('__diag_symptom'),
+      this.readActiveTable('__diag_cause'),
+      this.readActiveTable('__diag_symptom_cause_link'),
+    ]);
+    DiagSystemsSchema.parse(systems);
+    DiagSymptomsSchema.parse(symptoms);
+    DiagCausesSchema.parse(causes);
+    DiagProjectionLinksSchema.parse(links);
+    return {
+      systems: systems as DiagSystem[],
+      symptoms: symptoms as DiagSymptom[],
+      causes: causes as DiagCause[],
+      links: links as DiagSymptomCauseLink[],
+    };
+  }
+
+  /**
+   * Toutes les lignes actives d'une table, par pages de 1000 (plafond PostgREST).
+   * Le `count` exact de chaque page doit rester celui de la première et égaler
+   * le total lu : un plafond serveur plus bas ou une écriture concurrente lève.
+   */
+  private async readActiveTable(table: string): Promise<unknown[]> {
+    const pageSize = 1000;
+    const rows: unknown[] = [];
+    let expected: number | null = null;
+    for (let from = 0; ; from += pageSize) {
+      const { data, error, count } = await this.supabase
+        .from(table)
+        .select('*', { count: 'exact' })
+        .eq('active', true)
+        .order('id', { ascending: true })
+        .range(from, from + pageSize - 1);
+      if (error || !Array.isArray(data)) {
+        throw new Error(
+          `${table} unavailable at offset ${from}: ${error?.message ?? 'no rows'}`,
+        );
+      }
+      expected ??= count;
+      if (count !== expected) {
+        throw new Error(
+          `${table} changed during read: ${count} active, ${expected} at offset 0`,
+        );
+      }
+      rows.push(...data);
+      if (data.length < pageSize) break;
+    }
+    if (rows.length !== expected) {
+      throw new Error(
+        `${table} incomplete: ${rows.length} row(s) read, ${expected} active`,
+      );
+    }
+    return rows;
+  }
+
   /**
    * Get diagnostic engine stats for admin dashboard
    */
```

- [ ] **Étape 5 : vérifier que tout passe**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/diagnostic-projection-reference.test.ts src/modules/diagnostic-engine/diagnostic-engine.data-service`
Attendu : `diagnostic-projection-reference.test.ts` 8 tests verts ; les suites existantes du data service restent vertes.

- [ ] **Étape 6 : commit**

```bash
git add backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts \
  backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts \
  backend/src/modules/diagnostic-engine/diagnostic-projection-reference.test.ts
git commit -F - <<'EOF'
feat(diagnostic): lecture paginée à compte exact du référentiel actif

getProjectionReference() lit systèmes, symptômes, causes et liens actifs page
par page (1000), ordonnés par id, et compare au compte exact : une lecture
tronquée par le plafond PostgREST lève au lieu de produire de faux conflits.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 3 : contrat d'export et chargeur (pré-validation complète)

Le chargeur valide tout l'export avant la moindre lecture DB : index lisible et de version majeure 1, chaque fichier listé présent, régulier (pas de lien symbolique), d'empreinte exacte, aucun fichier non listé, enveloppe conforme. Un export incohérent fait échouer le run sans rien retirer. Un index valide à 0 entrée est accepté : c'est le retrait gouverné par PR WIKI.

**Files:**
- Create: `backend/src/modules/diagnostic-engine/projection/diagnostic-projection.types.ts`
- Create: `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-exports-loader.ts`
- Create: `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-exports-loader.test.ts`

**Interfaces:**
- Consumes : rien du code (lecture disque seule).
- Produces (types) : `DIAGNOSTIC_PROJECTION_QUEUE = 'diagnostic-projection-queue'`, `DIAGNOSTIC_PROJECTION_JOB`, `DIAGNOSTIC_PROJECTION_RUNS_TABLE = '__diag_projection_runs'`, `CONFLICT_REASONS` (8 raisons, dans l'ordre des contrôles), `ExportRelationSchema`, `ApplyResultSchema` (`{run_id, projected_count, conflict_count, retired_count}` entiers ≥ 0), types `ConflictReason`, `ConflictRow`, `ProjectionRow`, `ExportRelation`, `LoadedGammeExport`, `LoadedDiagnosticExports` (`files`, `indexSha256`, `builderVersion`), `DiagnosticProjectionResolution`, `DiagnosticProjectionRunPayload`, `DiagnosticProjectionTrigger = 'repeatable' | 'admin'`, `DiagnosticProjectionRunResult`.
- Produces (chargeur) : `loadDiagnosticExports(root: string): Promise<LoadedDiagnosticExports>` ; `DiagnosticExportsInvalidError` (champ `code` : `exports_root_missing`, `index_invalid`, `duplicate_index_path`, `listed_file_missing`, `unlisted_file_present`, `non_regular_file`, `sha256_mismatch`, `envelope_invalid`, `envelope_mismatch`).

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-exports-loader.test.ts` avec exactement ce contenu :

```typescript
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DiagnosticExportsInvalidError,
  loadDiagnosticExports,
} from './diagnostic-projection-exports-loader';

const WIKI_COMMIT = 'a'.repeat(40);
const CATALOG_COMMIT = 'c'.repeat(40);

// Même sérialisation que le builder WIKI : indent 2, newline final.
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (text: string | Buffer) =>
  `sha256:${createHash('sha256').update(text).digest('hex')}`;

function envelope(slug: string, relationCount = 1) {
  return {
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_gamme',
    gamme_slug: slug,
    wiki_path: `wiki/gamme/${slug}.md`,
    source_wiki_commit: WIKI_COMMIT,
    source_catalog_commit: CATALOG_COMMIT,
    content_hash: `sha256:${'d'.repeat(64)}`,
    relations: Array.from({ length: relationCount }, (_, i) => ({
      relation_index: i,
    })),
  };
}

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'diag-exports-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** Écrit un export cohérent : l'index hache les octets réellement écrits. */
async function writeExports(
  gammes: Array<{ slug: string; body?: unknown; relationCount?: number }>,
  indexOverrides: Record<string, unknown> = {},
) {
  await fs.mkdir(path.join(root, 'gamme'), { recursive: true });
  const files = [];
  for (const gamme of gammes) {
    const text = serialize(gamme.body ?? envelope(gamme.slug));
    await fs.writeFile(path.join(root, 'gamme', `${gamme.slug}.json`), text);
    files.push({
      path: `gamme/${gamme.slug}.json`,
      sha256: sha256(text),
      source_wiki_commit: WIKI_COMMIT,
      relation_count: gamme.relationCount ?? 1,
    });
  }
  const index = {
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_index',
    source_catalog_commit: CATALOG_COMMIT,
    files,
    ...indexOverrides,
  };
  const text = serialize(index);
  await fs.writeFile(path.join(root, '_index.json'), text);
  return { index, indexText: text };
}

async function expectCode(code: string) {
  const error = await loadDiagnosticExports(root).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DiagnosticExportsInvalidError);
  expect((error as DiagnosticExportsInvalidError).code).toBe(code);
}

describe('loadDiagnosticExports', () => {
  it('loads a consistent export and hashes the raw index bytes', async () => {
    const { indexText } = await writeExports([
      { slug: 'filtre-a-air' },
      { slug: 'filtre-d-habitacle' },
    ]);
    const loaded = await loadDiagnosticExports(root);
    expect(loaded.indexSha256).toBe(sha256(indexText));
    expect(loaded.builderVersion).toBe('1.0.0');
    expect(loaded.files.map((file) => file.path)).toEqual([
      'gamme/filtre-a-air.json',
      'gamme/filtre-d-habitacle.json',
    ]);
    expect(loaded.files[0].envelope.wiki_path).toBe(
      'wiki/gamme/filtre-a-air.md',
    );
  });

  it('accepts an index with zero files and no gamme directory', async () => {
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({
        schema_version: '1.0.0',
        builder_version: '1.0.0',
        export_kind: 'diagnostic_index',
        source_catalog_commit: CATALOG_COMMIT,
        files: [],
      }),
    );
    const loaded = await loadDiagnosticExports(root);
    expect(loaded.files).toEqual([]);
  });

  it('exports_root_missing', async () => {
    await fs.rm(root, { recursive: true, force: true });
    await expectCode('exports_root_missing');
  });

  it('index_invalid: missing, unreadable JSON, other major version', async () => {
    await expectCode('index_invalid');
    await fs.writeFile(path.join(root, '_index.json'), '{');
    await expectCode('index_invalid');
    await writeExports([{ slug: 'filtre-a-air' }], { schema_version: '2.0.0' });
    await expectCode('index_invalid');
  });

  it('duplicate_index_path', async () => {
    const { index } = await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({ ...index, files: [index.files[0], index.files[0]] }),
    );
    await expectCode('duplicate_index_path');
  });

  it('listed_file_missing', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.rm(path.join(root, 'gamme', 'filtre-a-air.json'));
    await expectCode('listed_file_missing');
  });

  it('listed_file_missing when the gamme directory is absent but the index lists files', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.rm(path.join(root, 'gamme'), { recursive: true });
    await expectCode('listed_file_missing');
  });

  it('unlisted_file_present', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.writeFile(path.join(root, 'gamme', 'orpheline.json'), '{}\n');
    await expectCode('unlisted_file_present');
  });

  it('non_regular_file: a symlink in gamme/ or as the index', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    const target = path.join(root, 'gamme', 'filtre-a-air.json');
    const moved = path.join(root, 'ailleurs.json');
    await fs.rename(target, moved);
    await fs.symlink(moved, target);
    await expectCode('non_regular_file');

    await fs.rm(target);
    await fs.rename(moved, target);
    const index = path.join(root, '_index.json');
    await fs.rename(index, path.join(root, 'index-reel.json'));
    await fs.symlink(path.join(root, 'index-reel.json'), index);
    await expectCode('non_regular_file');
  });

  it('sha256_mismatch when a file changed after the index was written', async () => {
    await writeExports([{ slug: 'filtre-a-air' }]);
    await fs.appendFile(path.join(root, 'gamme', 'filtre-a-air.json'), ' ');
    await expectCode('sha256_mismatch');
  });

  it('envelope_invalid', async () => {
    await writeExports([
      {
        slug: 'filtre-a-air',
        body: { ...envelope('filtre-a-air'), relations: [] },
      },
    ]);
    await expectCode('envelope_invalid');
  });

  it.each([
    [
      'gamme_slug',
      {
        gamme_slug: 'filtre-a-huile',
        wiki_path: 'wiki/gamme/filtre-a-huile.md',
      },
    ],
    ['wiki_path', { wiki_path: 'wiki/gamme/autre.md' }],
    ['source_wiki_commit', { source_wiki_commit: 'e'.repeat(40) }],
    ['source_catalog_commit', { source_catalog_commit: 'e'.repeat(40) }],
    ['builder_version', { builder_version: '1.0.1' }],
  ])('envelope_mismatch: %s', async (_field, overrides) => {
    await writeExports([
      {
        slug: 'filtre-a-air',
        body: { ...envelope('filtre-a-air'), ...overrides },
      },
    ]);
    await expectCode('envelope_mismatch');
  });

  it('envelope_mismatch: relation_count', async () => {
    await writeExports([{ slug: 'filtre-a-air', relationCount: 2 }]);
    await expectCode('envelope_mismatch');
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection-exports-loader.test.ts`
Attendu : échec de compilation `TS2307: Cannot find module './diagnostic-projection-exports-loader'` (et `./diagnostic-projection.types`).

- [ ] **Étape 3 : écrire les types**

Créer `backend/src/modules/diagnostic-engine/projection/diagnostic-projection.types.ts` avec exactement ce contenu :

```typescript
/**
 * Types et constantes de la projection WIKI → DB des liens du moteur de
 * diagnostic (spec 2026-09-30-diagnostic-wiki-provenance-design §4.5).
 *
 * Les schémas Zod ci-dessous sont des LECTEURS TOLÉRANTS : `z.object` retire les
 * clés inconnues et ne contrôle que ce que le writer consomme. Le contrat complet
 * de l'export (`_meta/schema/exports-diagnostic.schema.json`) est validé côté WIKI
 * par `wiki-quality-gates` ; il n'est pas dupliqué ici.
 */
import { z } from 'zod';

export const DIAGNOSTIC_PROJECTION_QUEUE = 'diagnostic-projection-queue';
export const DIAGNOSTIC_PROJECTION_JOB = 'diagnostic-projection-run';
/** jobId stable du repeatable → pas de doublon au redéploiement. */
export const DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID =
  'diagnostic-projection-nightly';
export const DIAGNOSTIC_PROJECTION_RUNS_TABLE = '__diag_projection_runs';

export const DiagnosticProjectionJobDataSchema = z.object({
  triggeredBy: z.enum(['repeatable', 'admin']),
});
export type DiagnosticProjectionJobData = z.infer<
  typeof DiagnosticProjectionJobDataSchema
>;
export type DiagnosticProjectionTrigger =
  DiagnosticProjectionJobData['triggeredBy'];

/** Ordre = ordre d'évaluation (le premier contrôle en échec donne la raison). */
export const CONFLICT_REASONS = [
  'schema_invalid',
  'not_a_cause_relation',
  'unknown_symptom',
  'system_mismatch',
  'no_matching_link',
  'ambiguous_cause',
  'duplicate_relation',
  'source_not_raw_proven',
] as const;
export type ConflictReason = (typeof CONFLICT_REASONS)[number];

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const DIAG_SLUG_RE = /^[a-z0-9][a-z0-9_]*[a-z0-9]$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** `_index.json` — seul le major 1 est lu ; un autre major échoue la pré-validation. */
export const ExportIndexSchema = z.object({
  schema_version: z.string().regex(/^1\.\d+\.\d+$/),
  builder_version: z.string().regex(SEMVER_RE),
  export_kind: z.literal('diagnostic_index'),
  source_catalog_commit: z.string().regex(COMMIT_RE),
  files: z.array(
    z.object({
      path: z.string().regex(/^gamme\/[a-z0-9][a-z0-9-]*[a-z0-9]\.json$/),
      sha256: z.string().regex(SHA256_RE),
      source_wiki_commit: z.string().regex(COMMIT_RE),
      relation_count: z.number().int().min(1),
    }),
  ),
});
export type ExportIndex = z.infer<typeof ExportIndexSchema>;

/** Enveloppe d'un export de gamme ; les relations sont validées une à une. */
export const GammeExportEnvelopeSchema = z.object({
  schema_version: z.string().regex(/^1\.\d+\.\d+$/),
  builder_version: z.string().regex(SEMVER_RE),
  export_kind: z.literal('diagnostic_gamme'),
  gamme_slug: z.string().regex(SLUG_RE),
  wiki_path: z.string().regex(/^wiki\/gamme\/[a-z0-9][a-z0-9-]*[a-z0-9]\.md$/),
  source_wiki_commit: z.string().regex(COMMIT_RE),
  source_catalog_commit: z.string().regex(COMMIT_RE),
  content_hash: z.string().regex(SHA256_RE),
  relations: z.array(z.unknown()).min(1),
});
export type GammeExportEnvelope = z.infer<typeof GammeExportEnvelopeSchema>;

const nonEmpty = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);

/** Une relation — ne lit que les champs projetés ; `sources[]` est conservé tel quel. */
export const ExportRelationSchema = z.object({
  symptom_slug: z.string().max(80).regex(DIAG_SLUG_RE),
  system_slug: z.string().max(60).regex(DIAG_SLUG_RE),
  relation_to_part: z.enum([
    'possible_cause',
    'symptom_amplifier',
    'secondary_effect',
  ]),
  part_role: z.string().min(10).max(280),
  evidence: z.object({
    confidence: nonEmpty,
    source_policy: nonEmpty,
    reviewed: z.boolean(),
    diagnostic_safe: z.boolean(),
  }),
  confidence_score_computed: z.number().min(0).max(1),
  sources: z
    .array(z.object({ slug: nonEmpty, raw_proven: z.boolean() }).passthrough())
    .min(1),
});
export type ExportRelation = z.infer<typeof ExportRelationSchema>;

export interface LoadedGammeExport {
  /** Chemin relatif à la racine des exports (`gamme/<slug>.json`). */
  path: string;
  envelope: GammeExportEnvelope;
}

export interface LoadedDiagnosticExports {
  indexSha256: string;
  builderVersion: string;
  files: LoadedGammeExport[];
}

/** Une ligne de provenance — clés = celles lues par `__diag_projection_apply`. */
export interface ProjectionRow {
  link_id: number;
  wiki_path: string;
  gamme_slug: string;
  wiki_commit: string;
  content_hash: string;
  relation_to_part: 'possible_cause';
  part_role: string;
  confidence: string;
  source_policy: string;
  confidence_score_computed: number;
  reviewed: boolean;
  diagnostic_safe: boolean;
  sources: Array<Record<string, unknown>>;
}

export interface ConflictRow {
  wiki_path: string;
  gamme_slug: string;
  relation_index: number;
  symptom_slug: string | null;
  system_slug: string | null;
  reason: ConflictReason;
  detail: Record<string, unknown>;
}

export interface DiagnosticProjectionResolution {
  exportedCount: number;
  projections: ProjectionRow[];
  conflicts: ConflictRow[];
}

/** Payload `p_run` de `__diag_projection_apply`. */
export interface DiagnosticProjectionRunPayload {
  triggered_by: DiagnosticProjectionTrigger;
  runtime_env: string;
  index_sha256: string;
  builder_version: string;
  exported_count: number;
  started_at: string;
  projections: ProjectionRow[];
  conflicts: ConflictRow[];
}

export const ApplyResultSchema = z.object({
  run_id: z.number().int().positive(),
  projected_count: z.number().int().min(0),
  conflict_count: z.number().int().min(0),
  retired_count: z.number().int().min(0),
});
export type ApplyResult = z.infer<typeof ApplyResultSchema>;

export type DiagnosticProjectionRunResult =
  | { status: 'skipped'; reason: 'READ_ONLY' | 'FLAG_OFF' }
  | ({ status: 'applied'; exportedCount: number } & ApplyResult)
  | { status: 'failed'; error: string };
```

- [ ] **Étape 4 : écrire le chargeur**

Créer `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-exports-loader.ts` avec exactement ce contenu :

```typescript
/**
 * Chargement pré-validé de `exports/diagnostic/` (spec §4.5, étape 1).
 *
 * Tout ou rien : le moindre écart entre `_index.json` et les fichiers présents
 * lève `DiagnosticExportsInvalidError` AVANT toute écriture — un run partiel
 * retirerait à tort la provenance des fiches absentes.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  ExportIndexSchema,
  GammeExportEnvelopeSchema,
  type LoadedDiagnosticExports,
  type LoadedGammeExport,
} from './diagnostic-projection.types';

export const DIAGNOSTIC_EXPORTS_INDEX_FILE = '_index.json';
export const DIAGNOSTIC_EXPORTS_GAMME_DIR = 'gamme';

export type DiagnosticExportsErrorCode =
  | 'exports_root_missing'
  | 'index_invalid'
  | 'duplicate_index_path'
  | 'listed_file_missing'
  | 'unlisted_file_present'
  | 'non_regular_file'
  | 'sha256_mismatch'
  | 'envelope_invalid'
  | 'envelope_mismatch';

export class DiagnosticExportsInvalidError extends Error {
  constructor(
    readonly code: DiagnosticExportsErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'DiagnosticExportsInvalidError';
  }
}

const sha256 = (bytes: Buffer) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

async function lstatOrNull(target: string) {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Lit un fichier régulier (jamais un lien symbolique). */
async function readRegularFile(
  target: string,
  label: string,
  missingCode: DiagnosticExportsErrorCode,
): Promise<Buffer> {
  const stat = await lstatOrNull(target);
  if (!stat) throw new DiagnosticExportsInvalidError(missingCode, label);
  if (!stat.isFile()) {
    throw new DiagnosticExportsInvalidError('non_regular_file', label);
  }
  return fs.readFile(target);
}

function parseJson(bytes: Buffer): unknown {
  return JSON.parse(bytes.toString('utf8'));
}

export async function loadDiagnosticExports(
  root: string,
): Promise<LoadedDiagnosticExports> {
  const rootStat = await fs.stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new DiagnosticExportsInvalidError('exports_root_missing', root);
  }

  const indexBytes = await readRegularFile(
    path.join(root, DIAGNOSTIC_EXPORTS_INDEX_FILE),
    DIAGNOSTIC_EXPORTS_INDEX_FILE,
    'index_invalid',
  );
  let indexJson: unknown;
  try {
    indexJson = parseJson(indexBytes);
  } catch {
    throw new DiagnosticExportsInvalidError(
      'index_invalid',
      `${DIAGNOSTIC_EXPORTS_INDEX_FILE}: JSON illisible`,
    );
  }
  const index = ExportIndexSchema.safeParse(indexJson);
  if (!index.success) {
    throw new DiagnosticExportsInvalidError(
      'index_invalid',
      index.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    );
  }

  const listed = new Set<string>();
  for (const entry of index.data.files) {
    if (listed.has(entry.path)) {
      throw new DiagnosticExportsInvalidError(
        'duplicate_index_path',
        entry.path,
      );
    }
    listed.add(entry.path);
  }

  // Le répertoire ne contient QUE ce que l'index liste, et que des fichiers réguliers.
  const gammeDir = path.join(root, DIAGNOSTIC_EXPORTS_GAMME_DIR);
  const gammeStat = await lstatOrNull(gammeDir);
  if (gammeStat && !gammeStat.isDirectory()) {
    throw new DiagnosticExportsInvalidError(
      'non_regular_file',
      DIAGNOSTIC_EXPORTS_GAMME_DIR,
    );
  }
  const present = gammeStat
    ? await fs.readdir(gammeDir, { withFileTypes: true })
    : [];
  for (const entry of present.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = `${DIAGNOSTIC_EXPORTS_GAMME_DIR}/${entry.name}`;
    if (!entry.isFile()) {
      throw new DiagnosticExportsInvalidError('non_regular_file', relative);
    }
    if (!listed.has(relative)) {
      throw new DiagnosticExportsInvalidError(
        'unlisted_file_present',
        relative,
      );
    }
  }

  const files: LoadedGammeExport[] = [];
  for (const entry of index.data.files) {
    const bytes = await readRegularFile(
      path.join(root, entry.path),
      entry.path,
      'listed_file_missing',
    );
    const digest = sha256(bytes);
    if (digest !== entry.sha256) {
      throw new DiagnosticExportsInvalidError(
        'sha256_mismatch',
        `${entry.path}: index ${entry.sha256}, fichier ${digest}`,
      );
    }
    let envelopeJson: unknown;
    try {
      envelopeJson = parseJson(bytes);
    } catch {
      throw new DiagnosticExportsInvalidError(
        'envelope_invalid',
        `${entry.path}: JSON illisible`,
      );
    }
    const envelope = GammeExportEnvelopeSchema.safeParse(envelopeJson);
    if (!envelope.success) {
      throw new DiagnosticExportsInvalidError(
        'envelope_invalid',
        `${entry.path}: ${envelope.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      );
    }
    const data = envelope.data;
    const mismatches = [
      entry.path !==
        `${DIAGNOSTIC_EXPORTS_GAMME_DIR}/${data.gamme_slug}.json` &&
        'gamme_slug',
      data.wiki_path !== `wiki/gamme/${data.gamme_slug}.md` && 'wiki_path',
      data.source_wiki_commit !== entry.source_wiki_commit &&
        'source_wiki_commit',
      data.source_catalog_commit !== index.data.source_catalog_commit &&
        'source_catalog_commit',
      data.builder_version !== index.data.builder_version && 'builder_version',
      data.relations.length !== entry.relation_count && 'relation_count',
    ].filter((field): field is string => typeof field === 'string');
    if (mismatches.length > 0) {
      throw new DiagnosticExportsInvalidError(
        'envelope_mismatch',
        `${entry.path}: ${mismatches.join(', ')}`,
      );
    }
    files.push({ path: entry.path, envelope: data });
  }

  return {
    indexSha256: sha256(indexBytes),
    builderVersion: index.data.builder_version,
    files,
  };
}
```

- [ ] **Étape 5 : vérifier que tout passe**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection-exports-loader.test.ts`
Attendu : 17 tests verts.

- [ ] **Étape 6 : commit**

```bash
git add backend/src/modules/diagnostic-engine/projection/diagnostic-projection.types.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection-exports-loader.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection-exports-loader.test.ts
git commit -F - <<'EOF'
feat(diagnostic): contrat d'export et pré-validation de exports/diagnostic/

Index haché sur ses octets bruts, fichiers listés présents, réguliers et
d'empreinte exacte, aucun fichier non listé, enveloppes conformes. Tout écart
lève DiagnosticExportsInvalidError avant la moindre lecture DB.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 4 : résolveur relation WIKI → lien existant

Fonction pure. Chaque relation exportée aboutit à exactement une projection ou un conflit ; le premier contrôle en échec, dans l'ordre de `CONFLICT_REASONS`, donne la raison. Le candidat est la cause du système du symptôme dont la gamme correspond (`CAUSE_GAMME_MAP`) et qui a un lien actif avec ce symptôme ; aucun ou plusieurs candidats = conflit. Le lien est réservé avant le contrôle de preuve, pour qu'un doublon reste un doublon même non prouvé.

**Files:**
- Create: `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-resolver.ts`
- Create: `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-resolver.test.ts`

**Interfaces:**
- Consumes : `DiagnosticProjectionReference` (Tâche 2) ; `ExportRelationSchema`, `ProjectionRow`, `ConflictRow`, `LoadedGammeExport`, `DiagnosticProjectionResolution` (Tâche 3) ; `CAUSE_GAMME_MAP` et `GammeMapping` existants (`../constants/gamme-map.constants`).
- Produces : `resolveDiagnosticProjection(files: LoadedGammeExport[], reference: DiagnosticProjectionReference, gammeMap = CAUSE_GAMME_MAP): DiagnosticProjectionResolution` (`{exportedCount, projections, conflicts}`) ; lève si `(link_id, wiki_path)` n'est pas unique ou si `projections + conflicts ≠ exportedCount`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-resolver.test.ts` avec exactement ce contenu :

```typescript
import type { DiagnosticProjectionReference } from '../diagnostic-engine.data-service';
import { resolveDiagnosticProjection } from './diagnostic-projection-resolver';
import {
  CONFLICT_REASONS,
  type GammeExportEnvelope,
  type LoadedGammeExport,
} from './diagnostic-projection.types';

// Référentiel calqué sur la DB réelle (ids et slugs des liens 113 / 114 / 117),
// avec les leurres 152 (→ filtre_huile_colmate) et 153 (perte_puissance →
// filtre_habitacle_sature), et les causes homonymes d'autres systèmes.
const system = (id: number, slug: string) => ({
  id,
  slug,
  label: slug,
  description: null,
  display_order: id,
  active: true,
});
const symptom = (id: number, slug: string, systemId: number) => ({
  id,
  slug,
  system_id: systemId,
  label: slug,
  description: null,
  signal_mode: 'symptom_slugs',
  urgency: 'moyenne',
  active: true,
});
const cause = (id: number, slug: string, systemId: number) => ({
  id,
  slug,
  system_id: systemId,
  label: slug,
  cause_type: 'maintenance_related',
  description: null,
  verification_method: null,
  urgency: 'moyenne',
  active: true,
});
const link = (id: number, symptomId: number, causeId: number) => ({
  id,
  symptom_id: symptomId,
  cause_id: causeId,
  relative_score: 50,
  evidence_for: [],
  evidence_against: [],
  requires_verification: true,
  active: true,
});

const reference: DiagnosticProjectionReference = {
  systems: [system(1, 'filtration'), system(2, 'injection'), system(3, 'clim')],
  symptoms: [
    symptom(10, 'perte_puissance_filtration', 1),
    symptom(11, 'odeur_habitacle', 1),
  ],
  causes: [
    cause(20, 'filtre_air_colmate', 1),
    cause(21, 'filtre_carburant_colmate', 1),
    cause(22, 'filtre_habitacle_sature', 1),
    cause(23, 'filtre_carburant_injection', 2),
    cause(24, 'filtre_habitacle_clim', 3),
    cause(25, 'filtre_huile_colmate', 1),
  ],
  links: [
    link(113, 10, 20),
    link(114, 10, 21),
    link(117, 11, 22),
    link(152, 10, 25),
    link(153, 10, 22),
  ],
};

const COMMIT = 'a'.repeat(40);
const HASH = `sha256:${'b'.repeat(64)}`;

function relation(overrides: Record<string, unknown> = {}) {
  return {
    relation_index: 0,
    relation_sha256: HASH,
    symptom_slug: 'perte_puissance_filtration',
    system_slug: 'filtration',
    relation_to_part: 'possible_cause',
    part_role: 'Un filtre colmaté réduit le débit disponible.',
    evidence: {
      confidence: 'medium',
      source_policy: 'oem_or_two_independent',
      reviewed: true,
      diagnostic_safe: false,
    },
    confidence_score_computed: 0.6,
    sources: [
      {
        slug: 'oem_doc',
        catalog_slug: 'oem_doc',
        type: 'oem',
        status: 'active',
        raw_ref: null,
        raw_proven: true,
      },
    ],
    ...overrides,
  };
}

function gammeFile(slug: string, relations: unknown[]): LoadedGammeExport {
  const envelope: GammeExportEnvelope = {
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_gamme',
    gamme_slug: slug,
    wiki_path: `wiki/gamme/${slug}.md`,
    source_wiki_commit: COMMIT,
    source_catalog_commit: COMMIT,
    content_hash: HASH,
    relations,
  };
  return { path: `gamme/${slug}.json`, envelope };
}

const unproven = { ...relation().sources[0], raw_proven: false };

describe('resolveDiagnosticProjection', () => {
  it('resolves the three real relations to links 113 / 114 / 117, never to a decoy', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [relation()]),
        gammeFile('filtre-a-carburant', [relation()]),
        gammeFile('filtre-d-habitacle', [
          relation({ symptom_slug: 'odeur_habitacle' }),
        ]),
      ],
      reference,
    );

    expect(result.conflicts).toEqual([]);
    expect(result.exportedCount).toBe(3);
    expect(
      result.projections.map((row) => [row.gamme_slug, row.link_id]),
    ).toEqual([
      ['filtre-a-air', 113],
      ['filtre-a-carburant', 114],
      ['filtre-d-habitacle', 117],
    ]);
    // filtre_carburant_injection et filtre_habitacle_clim mappent les mêmes
    // gammes mais vivent dans un autre système : jamais candidats.
    expect(result.projections[0]).toEqual({
      link_id: 113,
      wiki_path: 'wiki/gamme/filtre-a-air.md',
      gamme_slug: 'filtre-a-air',
      wiki_commit: COMMIT,
      content_hash: HASH,
      relation_to_part: 'possible_cause',
      part_role: 'Un filtre colmaté réduit le débit disponible.',
      confidence: 'medium',
      source_policy: 'oem_or_two_independent',
      confidence_score_computed: 0.6,
      reviewed: true,
      diagnostic_safe: false,
      sources: relation().sources,
    });
  });

  it('launch state: every source unproven → 0 projection, 3 source_not_raw_proven conflicts', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [relation({ sources: [unproven] })]),
        gammeFile('filtre-a-carburant', [relation({ sources: [unproven] })]),
        gammeFile('filtre-d-habitacle', [
          relation({ symptom_slug: 'odeur_habitacle', sources: [unproven] }),
        ]),
      ],
      reference,
    );

    expect(result.projections).toEqual([]);
    expect(result.conflicts.map((row) => [row.reason, row.detail])).toEqual([
      [
        'source_not_raw_proven',
        { link_id: 113, unproven_sources: ['oem_doc'] },
      ],
      [
        'source_not_raw_proven',
        { link_id: 114, unproven_sources: ['oem_doc'] },
      ],
      [
        'source_not_raw_proven',
        { link_id: 117, unproven_sources: ['oem_doc'] },
      ],
    ]);
  });

  it('one proven and one unproven source → still a conflict naming only the unproven one', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation({
            sources: [
              relation().sources[0],
              { ...unproven, slug: 'forum_thread' },
            ],
          }),
        ]),
      ],
      reference,
    );
    expect(result.conflicts[0].detail).toEqual({
      link_id: 113,
      unproven_sources: ['forum_thread'],
    });
  });

  it('schema_invalid keeps the slugs null and lists the failing paths', () => {
    const invalid = relation({ part_role: undefined, sources: [] });
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-air', [invalid])],
      reference,
    );
    expect(result.conflicts).toEqual([
      {
        wiki_path: 'wiki/gamme/filtre-a-air.md',
        gamme_slug: 'filtre-a-air',
        relation_index: 0,
        symptom_slug: null,
        system_slug: null,
        reason: 'schema_invalid',
        detail: {
          issues: [
            { path: 'part_role', code: 'invalid_type' },
            { path: 'sources', code: 'too_small' },
          ],
        },
      },
    ]);
  });

  it.each([
    [
      'not_a_cause_relation',
      relation({ relation_to_part: 'symptom_amplifier' }),
      { relation_to_part: 'symptom_amplifier' },
    ],
    ['unknown_symptom', relation({ symptom_slug: 'bruit_inconnu' }), {}],
    [
      'system_mismatch',
      relation({ system_slug: 'injection' }),
      { symptom_system_slug: 'filtration' },
    ],
    // odeur_habitacle n'a aucun lien vers la seule cause « filtre-a-air » du système.
    ['no_matching_link', relation({ symptom_slug: 'odeur_habitacle' }), {}],
  ])('%s', (reason, input, detail) => {
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-air', [input])],
      reference,
    );
    expect(result.projections).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      reason,
      detail,
      relation_index: 0,
      symptom_slug: (input as { symptom_slug: string }).symptom_slug,
      system_slug: (input as { system_slug: string }).system_slug,
    });
  });

  it('ambiguous_cause when two causes of the system map to the gamme with a live link', () => {
    const gammeMap = {
      filtre_air_colmate: [
        { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
      ],
      filtre_huile_colmate: [
        { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
      ],
    };
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-air', [relation()])],
      reference,
      gammeMap,
    );
    expect(result.conflicts[0]).toMatchObject({
      reason: 'ambiguous_cause',
      detail: {
        cause_slugs: ['filtre_air_colmate', 'filtre_huile_colmate'],
        link_ids: [113, 152],
      },
    });
  });

  it('a cause of another system is never a candidate, even with a live link to the symptom', () => {
    // filtre_carburant_injection (système injection) mappe aussi filtre-a-carburant.
    // En DB elle n'a aucun lien avec ce symptôme : on lui en donne un (999) pour
    // que seul le filtre par système l'écarte.
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-carburant', [relation()])],
      { ...reference, links: [...reference.links, link(999, 10, 23)] },
    );
    expect(result.conflicts).toEqual([]);
    expect(result.projections.map((row) => row.link_id)).toEqual([114]);
  });

  it('duplicate_relation is reserved before the proof check', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation({ sources: [unproven] }),
          relation(),
        ]),
      ],
      reference,
    );
    expect(result.projections).toEqual([]);
    expect(result.conflicts.map((row) => [row.reason, row.detail])).toEqual([
      [
        'source_not_raw_proven',
        { link_id: 113, unproven_sources: ['oem_doc'] },
      ],
      ['duplicate_relation', { link_id: 113, first_relation_index: 0 }],
    ]);
  });

  it('the same link documented by two fiches gives two projections', () => {
    const gammeMap = {
      filtre_air_colmate: [
        { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
        { slug: 'filtre-a-air-sport', label: 'Filtre à air sport', pg_id: 8 },
      ],
    };
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [relation()]),
        gammeFile('filtre-a-air-sport', [relation()]),
      ],
      reference,
      gammeMap,
    );
    expect(
      result.projections.map((row) => [row.link_id, row.wiki_path]),
    ).toEqual([
      [113, 'wiki/gamme/filtre-a-air.md'],
      [113, 'wiki/gamme/filtre-a-air-sport.md'],
    ]);
  });

  it('the first failing check wins, in CONFLICT_REASONS order', () => {
    // Non-cause ET symptôme inconnu : la raison est la première dans l'ordre.
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation({
            relation_to_part: 'secondary_effect',
            symptom_slug: 'bruit_inconnu',
          }),
        ]),
      ],
      reference,
    );
    expect(result.conflicts[0].reason).toBe('not_a_cause_relation');
    expect(CONFLICT_REASONS.indexOf('not_a_cause_relation')).toBeLessThan(
      CONFLICT_REASONS.indexOf('unknown_symptom'),
    );
  });

  it('every exported relation ends as exactly one projection or conflict', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation(),
          relation({ symptom_slug: 'bruit_inconnu' }),
          { not: 'a relation' },
        ]),
        gammeFile('filtre-d-habitacle', [
          relation({ symptom_slug: 'odeur_habitacle' }),
        ]),
      ],
      reference,
    );
    expect(result.exportedCount).toBe(4);
    expect(result.projections).toHaveLength(2);
    expect(result.conflicts.map((row) => row.reason)).toEqual([
      'unknown_symptom',
      'schema_invalid',
    ]);
    expect(result.conflicts.map((row) => row.relation_index)).toEqual([1, 2]);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection-resolver.test.ts`
Attendu : échec de compilation `TS2307: Cannot find module './diagnostic-projection-resolver'`.

- [ ] **Étape 3 : écrire le résolveur**

Créer `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-resolver.ts` avec exactement ce contenu :

```typescript
/**
 * Résolution relation WIKI → lien `__diag_symptom_cause_link` (spec §4.5, étape 3).
 *
 * Fonction pure : aucune lecture, aucune écriture. Chaque relation exportée
 * aboutit à EXACTEMENT une ligne — une projection ou un conflit — et le premier
 * contrôle en échec (ordre de `CONFLICT_REASONS`) en donne la raison. Aucune
 * relation n'est inventée ni devinée : zéro ou plusieurs candidats = conflit.
 */
import {
  CAUSE_GAMME_MAP,
  type GammeMapping,
} from '../constants/gamme-map.constants';
import type {
  DiagCause,
  DiagnosticProjectionReference,
} from '../diagnostic-engine.data-service';
import {
  ExportRelationSchema,
  type ConflictReason,
  type ConflictRow,
  type DiagnosticProjectionResolution,
  type ExportRelation,
  type LoadedGammeExport,
  type ProjectionRow,
} from './diagnostic-projection.types';

export function resolveDiagnosticProjection(
  files: LoadedGammeExport[],
  reference: DiagnosticProjectionReference,
  gammeMap: Record<string, GammeMapping[]> = CAUSE_GAMME_MAP,
): DiagnosticProjectionResolution {
  const systemsById = new Map(reference.systems.map((row) => [row.id, row]));
  const symptomsBySlug = new Map(
    reference.symptoms.map((row) => [row.slug, row]),
  );
  const linksByPair = new Map(
    reference.links.map((row) => [`${row.symptom_id}:${row.cause_id}`, row]),
  );
  const causesBySystem = new Map<number, DiagCause[]>();
  for (const cause of [...reference.causes].sort((a, b) => a.id - b.id)) {
    const list = causesBySystem.get(cause.system_id) ?? [];
    list.push(cause);
    causesBySystem.set(cause.system_id, list);
  }

  const projections: ProjectionRow[] = [];
  const conflicts: ConflictRow[] = [];
  let exportedCount = 0;

  for (const file of files) {
    const { envelope } = file;
    // Un lien n'est documenté qu'une fois par fiche ; une autre fiche peut le
    // documenter aussi (clé de provenance = couple lien × fiche).
    const reserved = new Map<number, number>();

    envelope.relations.forEach((raw, relationIndex) => {
      exportedCount += 1;
      const conflict = (
        reason: ConflictReason,
        detail: Record<string, unknown>,
        relation?: ExportRelation,
      ) =>
        conflicts.push({
          wiki_path: envelope.wiki_path,
          gamme_slug: envelope.gamme_slug,
          relation_index: relationIndex,
          symptom_slug: relation?.symptom_slug ?? null,
          system_slug: relation?.system_slug ?? null,
          reason,
          detail,
        });

      const parsed = ExportRelationSchema.safeParse(raw);
      if (!parsed.success) {
        conflict('schema_invalid', {
          issues: parsed.error.issues
            .slice(0, 10)
            .map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
        });
        return;
      }
      const relation = parsed.data;

      if (relation.relation_to_part !== 'possible_cause') {
        conflict(
          'not_a_cause_relation',
          { relation_to_part: relation.relation_to_part },
          relation,
        );
        return;
      }

      const symptom = symptomsBySlug.get(relation.symptom_slug);
      if (!symptom) {
        conflict('unknown_symptom', {}, relation);
        return;
      }

      const system = systemsById.get(symptom.system_id);
      if (!system || system.slug !== relation.system_slug) {
        conflict(
          'system_mismatch',
          { symptom_system_slug: system?.slug ?? null },
          relation,
        );
        return;
      }

      const candidates = (causesBySystem.get(system.id) ?? []).flatMap(
        (cause) => {
          const mapsToGamme = (gammeMap[cause.slug] ?? []).some(
            (gamme) => gamme.slug === envelope.gamme_slug,
          );
          const link = linksByPair.get(`${symptom.id}:${cause.id}`);
          return mapsToGamme && link ? [{ cause, link }] : [];
        },
      );
      if (candidates.length === 0) {
        conflict('no_matching_link', {}, relation);
        return;
      }
      if (candidates.length > 1) {
        conflict(
          'ambiguous_cause',
          {
            cause_slugs: candidates.map((candidate) => candidate.cause.slug),
            link_ids: candidates.map((candidate) => candidate.link.id),
          },
          relation,
        );
        return;
      }
      const { link } = candidates[0];

      const firstRelationIndex = reserved.get(link.id);
      if (firstRelationIndex !== undefined) {
        conflict(
          'duplicate_relation',
          { link_id: link.id, first_relation_index: firstRelationIndex },
          relation,
        );
        return;
      }
      // Réservé AVANT le contrôle de preuve : un doublon reste un doublon même
      // quand la première relation n'est pas prouvée.
      reserved.set(link.id, relationIndex);

      const unproven = relation.sources
        .filter((source) => source.raw_proven !== true)
        .map((source) => source.slug);
      if (unproven.length > 0) {
        conflict(
          'source_not_raw_proven',
          { link_id: link.id, unproven_sources: unproven },
          relation,
        );
        return;
      }

      projections.push({
        link_id: link.id,
        wiki_path: envelope.wiki_path,
        gamme_slug: envelope.gamme_slug,
        wiki_commit: envelope.source_wiki_commit,
        content_hash: envelope.content_hash,
        relation_to_part: 'possible_cause',
        part_role: relation.part_role,
        confidence: relation.evidence.confidence,
        source_policy: relation.evidence.source_policy,
        confidence_score_computed: relation.confidence_score_computed,
        reviewed: relation.evidence.reviewed,
        diagnostic_safe: relation.evidence.diagnostic_safe,
        sources: relation.sources,
      });
    });
  }

  const keys = new Set(
    projections.map((row) => `${row.link_id}\u0000${row.wiki_path}`),
  );
  if (keys.size !== projections.length) {
    throw new Error('diagnostic projection: (link_id, wiki_path) non unique');
  }
  if (projections.length + conflicts.length !== exportedCount) {
    throw new Error(
      `diagnostic projection: ${projections.length} projection(s) + ${conflicts.length} conflit(s) ≠ ${exportedCount} relation(s) exportée(s)`,
    );
  }
  return { exportedCount, projections, conflicts };
}
```

- [ ] **Étape 4 : vérifier que tout passe**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection-resolver.test.ts`
Attendu : 14 tests verts, dont `resolves the three real relations to links 113 / 114 / 117, never to a decoy` et `launch state: every source unproven → 0 projection, 3 source_not_raw_proven conflicts`.

- [ ] **Étape 5 : commit**

```bash
git add backend/src/modules/diagnostic-engine/projection/diagnostic-projection-resolver.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection-resolver.test.ts
git commit -F - <<'EOF'
feat(diagnostic): résolution déterministe relation WIKI → lien existant

Fonction pure : une relation = une projection ou un conflit, premier contrôle
en échec dans l'ordre de CONFLICT_REASONS ; zéro ou plusieurs candidats =
conflit ; raw_proven recopié, jamais recalculé ; aucun lien inventé.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 5 : writer et déclaration de la RPC publiée

Le writer enchaîne chargement, lecture du référentiel, résolution et un seul appel RPC. Il saute avant toute lecture si `READ_ONLY` (PREPROD). Le nom de la RPC est écrit en littéral : le ratchet des écrivains ne reconnaît un publisher que par littéral, jamais par constante. L'appel passe par `callRpc` de `SupabaseBaseService` avec le contexte `{source: 'internal', isServiceRole: true}`, donc par la gate RPC.

**Files:**
- Create: `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.ts`
- Create: `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.test.ts`
- Modify: `scripts/audit/check-served-content-write-sinks-ratchet.ts` (`SERVED_PUBLISH_RPCS`)
- Modify: `scripts/audit/check-served-content-write-sinks-ratchet.test.ts` (1 test)
- Modify: `audit/baselines/served-content-write-sinks-baseline.json` (par `:refresh`)

**Interfaces:**
- Consumes : `loadDiagnosticExports` (Tâche 3), `resolveDiagnosticProjection` (Tâche 4), `DiagnosticEngineDataService.getProjectionReference()` (Tâche 2), `ApplyResultSchema` et `DIAGNOSTIC_PROJECTION_RUNS_TABLE` (Tâche 3) ; `SupabaseBaseService` (`guardReadOnly`, `callRpc`, `supabase`), `RpcGateService`, `getAppConfig()` existants ; RPC `__diag_projection_apply` (Tâche 1).
- Produces : `DIAGNOSTIC_PROJECTION_EXPORTS_ROOT_ENV = 'DIAGNOSTIC_PROJECTION_EXPORTS_ROOT'`, `DEFAULT_DIAGNOSTIC_EXPORTS_ROOT = 'content/automecanik-wiki/exports/diagnostic'` (résolu depuis le cwd `backend/`, comme `exports/seo`) ; `DiagnosticProjectionWriterService.run(triggeredBy: DiagnosticProjectionTrigger): Promise<DiagnosticProjectionRunResult>` → `{status: 'skipped', reason: 'READ_ONLY'}` | `{status: 'failed', error}` | `{status: 'applied', exportedCount, run_id, projected_count, conflict_count, retired_count}`. `runtime_env` = `getAppConfig().app.environment`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.test.ts` avec exactement ce contenu :

```typescript
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DiagnosticProjectionReference } from '../diagnostic-engine.data-service';
import { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';

const COMMIT = 'a'.repeat(40);
const HASH = `sha256:${'b'.repeat(64)}`;
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (text: string) =>
  `sha256:${createHash('sha256').update(text).digest('hex')}`;

const reference: DiagnosticProjectionReference = {
  systems: [
    {
      id: 1,
      slug: 'filtration',
      label: 'Filtration',
      description: null,
      display_order: 1,
      active: true,
    },
  ],
  symptoms: [
    {
      id: 10,
      slug: 'perte_puissance_filtration',
      system_id: 1,
      label: 'Perte de puissance',
      description: null,
      signal_mode: 'symptom_slugs',
      urgency: 'moyenne',
      active: true,
    },
  ],
  causes: [
    {
      id: 20,
      slug: 'filtre_air_colmate',
      system_id: 1,
      label: 'Filtre à air colmaté',
      cause_type: 'maintenance_related',
      description: null,
      verification_method: null,
      urgency: 'moyenne',
      active: true,
    },
  ],
  links: [
    {
      id: 113,
      symptom_id: 10,
      cause_id: 20,
      relative_score: 60,
      evidence_for: [],
      evidence_against: [],
      requires_verification: true,
      active: true,
    },
  ],
};

function relation(rawProven: boolean) {
  return {
    relation_index: 0,
    relation_sha256: HASH,
    symptom_slug: 'perte_puissance_filtration',
    system_slug: 'filtration',
    relation_to_part: 'possible_cause',
    part_role: 'Un filtre colmaté réduit le débit disponible.',
    evidence: {
      confidence: 'medium',
      source_policy: 'oem_or_two_independent',
      reviewed: true,
      diagnostic_safe: false,
    },
    confidence_score_computed: 0.6,
    sources: [
      {
        slug: 'oem_doc',
        catalog_slug: 'oem_doc',
        type: 'oem',
        status: 'active',
        raw_ref: null,
        raw_proven: rawProven,
      },
    ],
  };
}

let root: string;
let indexText: string;

async function writeExports(rawProven: boolean) {
  await fs.mkdir(path.join(root, 'gamme'), { recursive: true });
  const text = serialize({
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_gamme',
    gamme_slug: 'filtre-a-air',
    wiki_path: 'wiki/gamme/filtre-a-air.md',
    source_wiki_commit: COMMIT,
    source_catalog_commit: COMMIT,
    content_hash: HASH,
    relations: [relation(rawProven)],
  });
  await fs.writeFile(path.join(root, 'gamme', 'filtre-a-air.json'), text);
  indexText = serialize({
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_index',
    source_catalog_commit: COMMIT,
    files: [
      {
        path: 'gamme/filtre-a-air.json',
        sha256: sha256(text),
        source_wiki_commit: COMMIT,
        relation_count: 1,
      },
    ],
  });
  await fs.writeFile(path.join(root, '_index.json'), indexText);
}

function makeWriter(
  options: {
    readOnly?: boolean;
    rpc?: jest.Mock;
    insertError?: { message: string } | null;
    reference?: jest.Mock;
  } = {},
) {
  const rpc =
    options.rpc ??
    jest.fn().mockResolvedValue({
      data: {
        run_id: 7,
        projected_count: 1,
        conflict_count: 0,
        retired_count: 0,
      },
      error: null,
    });
  const insert = jest
    .fn()
    .mockResolvedValue({ error: options.insertError ?? null });
  const from = jest.fn().mockReturnValue({ insert });
  const evaluate = jest
    .fn()
    .mockReturnValue({ decision: 'ALLOW', reason: 'INTERNAL_SERVICE_ROLE' });
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const writer = Object.create(
    DiagnosticProjectionWriterService.prototype,
  ) as DiagnosticProjectionWriterService;
  Object.assign(writer, {
    logger,
    supabase: { rpc, from },
    rpcGate: { evaluate, log: jest.fn() },
    isReadOnlyMode: options.readOnly ?? false,
    configService: { get: jest.fn().mockReturnValue(root) },
    referenceData: {
      getProjectionReference:
        options.reference ?? jest.fn().mockResolvedValue(reference),
    },
  });
  return { writer, rpc, insert, from, evaluate, logger };
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'diag-writer-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('DiagnosticProjectionWriterService.run', () => {
  it('READ_ONLY: skips before reading anything', async () => {
    const { writer, rpc, from, logger } = makeWriter({ readOnly: true });
    await expect(writer.run('admin')).resolves.toEqual({
      status: 'skipped',
      reason: 'READ_ONLY',
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'readonly.skipped', operation: 'run' }),
      expect.any(String),
    );
  });

  it('calls the apply RPC once, as an internal service_role caller, with the full payload', async () => {
    await writeExports(true);
    const { writer, rpc, evaluate, from } = makeWriter();

    const result = await writer.run('repeatable');

    expect(result).toEqual({
      status: 'applied',
      exportedCount: 1,
      run_id: 7,
      projected_count: 1,
      conflict_count: 0,
      retired_count: 0,
    });
    expect(evaluate).toHaveBeenCalledWith('__diag_projection_apply', {
      source: 'internal',
      isServiceRole: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    // Portée du rôle : un run appliqué n'écrit QUE par la RPC, jamais par .from().
    expect(from).not.toHaveBeenCalled();
    const payload = rpc.mock.calls[0][1].p_run;
    expect(payload).toMatchObject({
      triggered_by: 'repeatable',
      runtime_env: expect.any(String),
      index_sha256: sha256(indexText),
      builder_version: '1.0.0',
      exported_count: 1,
      conflicts: [],
    });
    expect(payload.projections).toEqual([
      expect.objectContaining({
        link_id: 113,
        wiki_path: 'wiki/gamme/filtre-a-air.md',
      }),
    ]);
    expect(Date.parse(payload.started_at)).not.toBeNaN();
  });

  it('launch state: sends the unproven relation as a conflict, never as a projection', async () => {
    await writeExports(false);
    const { writer, rpc } = makeWriter();
    await writer.run('admin');
    const payload = rpc.mock.calls[0][1].p_run;
    expect(payload.projections).toEqual([]);
    expect(payload.conflicts).toEqual([
      expect.objectContaining({
        reason: 'source_not_raw_proven',
        detail: { link_id: 113, unproven_sources: ['oem_doc'] },
      }),
    ]);
  });

  it('pre-validation failure: records a failed run, never calls the RPC', async () => {
    const { writer, rpc, from, insert } = makeWriter();
    const result = await writer.run('admin');
    expect(result).toEqual({
      status: 'failed',
      error: expect.stringContaining('index_invalid'),
    });
    expect(rpc).not.toHaveBeenCalled();
    // Portée du rôle : la seule écriture directe est la ligne de run en échec.
    expect(from.mock.calls).toEqual([['__diag_projection_runs']]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        triggered_by: 'admin',
        status: 'failed',
        exported_count: 0,
        index_sha256: null,
        error: expect.stringContaining('index_invalid'),
      }),
    );
  });

  it('reference read failure: failed run keeps the index hash that was loaded', async () => {
    await writeExports(true);
    const { writer, rpc, insert } = makeWriter({
      reference: jest
        .fn()
        .mockRejectedValue(new Error('__diag_cause truncated')),
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'failed',
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        index_sha256: sha256(indexText),
        builder_version: '1.0.0',
        error: '__diag_cause truncated',
      }),
    );
  });

  it('RPC failure: records a failed run with the exported count', async () => {
    await writeExports(true);
    const { writer, insert } = makeWriter({
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: '1 lien(s) à projeter, 0 encore actif(s)' },
      }),
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'failed',
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        exported_count: 1,
        error: expect.stringContaining('encore actif'),
      }),
    );
  });

  it('throws when the failed run itself cannot be recorded', async () => {
    const { writer } = makeWriter({
      insertError: {
        message: 'permission denied for table __diag_projection_runs',
      },
    });
    await expect(writer.run('admin')).rejects.toThrow(
      'could not be recorded: permission denied',
    );
  });

  it('throws when the RPC answers outside its contract', async () => {
    await writeExports(true);
    const { writer } = makeWriter({
      rpc: jest.fn().mockResolvedValue({ data: { run_id: 'x' }, error: null }),
    });
    await expect(writer.run('admin')).rejects.toThrow();
  });

  it('empty index: warns with the retired count', async () => {
    await fs.writeFile(
      path.join(root, '_index.json'),
      serialize({
        schema_version: '1.0.0',
        builder_version: '1.0.0',
        export_kind: 'diagnostic_index',
        source_catalog_commit: COMMIT,
        files: [],
      }),
    );
    const { writer, logger } = makeWriter({
      rpc: jest.fn().mockResolvedValue({
        data: {
          run_id: 8,
          projected_count: 0,
          conflict_count: 0,
          retired_count: 3,
        },
        error: null,
      }),
    });
    await expect(writer.run('admin')).resolves.toMatchObject({
      status: 'applied',
      retired_count: 3,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ retired_count: 3 }),
      expect.stringContaining('3 provenance(s) retirée(s)'),
    );
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.test.ts`
Attendu : échec de compilation `TS2307: Cannot find module './diagnostic-projection-writer.service'`.

- [ ] **Étape 3 : écrire le writer**

Créer `backend/src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.ts` avec exactement ce contenu :

```typescript
/**
 * DiagnosticProjectionWriterService — projette `exports/diagnostic/` du WIKI
 * dans `__diag_link_provenance` (spec §4.5).
 *
 * Étapes : pré-validation complète des fichiers → lecture du référentiel actif →
 * résolution pure → UN appel `__diag_projection_apply` (une transaction). Tout
 * échec AVANT l'appel ou de l'appel lui-même est tracé par un run `failed` dans
 * `__diag_projection_runs` ; si même cette trace échoue, l'exception remonte au
 * job BullMQ. Jamais de repli silencieux.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'node:path';
import { getErrorMessage } from '@common/utils/error.utils';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { getAppConfig } from '../../../config/app.config';
import { DiagnosticEngineDataService } from '../diagnostic-engine.data-service';
import { loadDiagnosticExports } from './diagnostic-projection-exports-loader';
import { resolveDiagnosticProjection } from './diagnostic-projection-resolver';
import {
  ApplyResultSchema,
  DIAGNOSTIC_PROJECTION_RUNS_TABLE,
  type DiagnosticProjectionRunPayload,
  type DiagnosticProjectionRunResult,
  type DiagnosticProjectionTrigger,
  type LoadedDiagnosticExports,
} from './diagnostic-projection.types';

export const DIAGNOSTIC_PROJECTION_EXPORTS_ROOT_ENV =
  'DIAGNOSTIC_PROJECTION_EXPORTS_ROOT';
/** Même base que `exports/seo` : pin du sous-module, résolu depuis cwd=backend. */
export const DEFAULT_DIAGNOSTIC_EXPORTS_ROOT =
  'content/automecanik-wiki/exports/diagnostic';
const MAX_ERROR_LENGTH = 2000;

@Injectable()
export class DiagnosticProjectionWriterService extends SupabaseBaseService {
  protected readonly logger = new Logger(
    DiagnosticProjectionWriterService.name,
  );

  constructor(
    configService: ConfigService,
    rpcGate: RpcGateService,
    private readonly referenceData: DiagnosticEngineDataService,
  ) {
    super(configService);
    this.rpcGate = rpcGate;
  }

  getExportsRoot(): string {
    const configured =
      this.configService?.get<string>(DIAGNOSTIC_PROJECTION_EXPORTS_ROOT_ENV) ||
      DEFAULT_DIAGNOSTIC_EXPORTS_ROOT;
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  async run(
    triggeredBy: DiagnosticProjectionTrigger,
  ): Promise<DiagnosticProjectionRunResult> {
    if (this.guardReadOnly('run', triggeredBy)) {
      return { status: 'skipped', reason: 'READ_ONLY' };
    }
    const startedAt = new Date().toISOString();
    const runtimeEnv = getAppConfig().app.environment;
    let loaded: LoadedDiagnosticExports | undefined;
    let payload: DiagnosticProjectionRunPayload;

    try {
      loaded = await loadDiagnosticExports(this.getExportsRoot());
      const reference = await this.referenceData.getProjectionReference();
      const resolution = resolveDiagnosticProjection(loaded.files, reference);
      payload = {
        triggered_by: triggeredBy,
        runtime_env: runtimeEnv,
        index_sha256: loaded.indexSha256,
        builder_version: loaded.builderVersion,
        exported_count: resolution.exportedCount,
        started_at: startedAt,
        projections: resolution.projections,
        conflicts: resolution.conflicts,
      };
    } catch (error) {
      return this.recordFailedRun(
        triggeredBy,
        runtimeEnv,
        startedAt,
        loaded,
        getErrorMessage(error),
      );
    }

    // Nom littéral : le ratchet served-content-write-sinks ne détecte un
    // publisher (`SERVED_PUBLISH_RPCS`) que par littéral, jamais par constante.
    const { data, error } = await this.callRpc<unknown>(
      '__diag_projection_apply',
      { p_run: payload },
      { source: 'internal', isServiceRole: true },
    );
    if (error) {
      return this.recordFailedRun(
        triggeredBy,
        runtimeEnv,
        startedAt,
        loaded,
        `__diag_projection_apply: ${error.message}`,
        payload.exported_count,
      );
    }

    // La transaction est validée : un retour inattendu est une dérive du
    // contrat SQL, pas un échec du run → exception (job en échec, visible).
    const applied = ApplyResultSchema.parse(data);
    const summary = {
      metric: 'diagnostic_projection.applied',
      triggered_by: triggeredBy,
      exported_count: payload.exported_count,
      ...applied,
    };
    if (payload.exported_count === 0) {
      this.logger.warn(
        summary,
        `Index exports/diagnostic vide : ${applied.retired_count} provenance(s) retirée(s)`,
      );
    } else {
      this.logger.log(summary, 'Projection diagnostic appliquée');
    }
    return {
      status: 'applied',
      exportedCount: payload.exported_count,
      ...applied,
    };
  }

  private async recordFailedRun(
    triggeredBy: DiagnosticProjectionTrigger,
    runtimeEnv: string,
    startedAt: string,
    loaded: LoadedDiagnosticExports | undefined,
    message: string,
    exportedCount = 0,
  ): Promise<DiagnosticProjectionRunResult> {
    const error = message.slice(0, MAX_ERROR_LENGTH) || 'unknown error';
    this.logger.error(
      {
        metric: 'diagnostic_projection.failed',
        triggered_by: triggeredBy,
        error,
      },
      'Projection diagnostic en échec',
    );
    const { error: insertError } = await this.supabase
      .from(DIAGNOSTIC_PROJECTION_RUNS_TABLE)
      .insert({
        triggered_by: triggeredBy,
        runtime_env: runtimeEnv,
        index_sha256: loaded?.indexSha256 ?? null,
        builder_version: loaded?.builderVersion ?? null,
        exported_count: exportedCount,
        status: 'failed',
        error,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
    if (insertError) {
      throw new Error(
        `diagnostic projection failed (${error}) and its run could not be recorded: ${insertError.message}`,
      );
    }
    return { status: 'failed', error };
  }
}
```

- [ ] **Étape 4 : vérifier que tout passe**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.test.ts`
Attendu : 9 tests verts, dont `READ_ONLY: skips before reading anything` et `calls the apply RPC once, as an internal service_role caller, with the full payload`.

- [ ] **Étape 5 : ratchet — test de la RPC publiée d'abord**

Ce diff s'applique après celui de la Tâche 1 (son contexte contient le test SQL). Écrire ce diff dans `$SCRATCH/ratchet-test-rpc.diff`, puis `git apply "$SCRATCH/ratchet-test-rpc.diff"` :

```diff
--- a/scripts/audit/check-served-content-write-sinks-ratchet.test.ts
+++ b/scripts/audit/check-served-content-write-sinks-ratchet.test.ts
@@ -50,6 +50,13 @@
   );
 });
 
+test("rpc_publisher: the diagnostic WIKI projection callRpc<unknown>('__diag_projection_apply') is a sink", () => {
+  assert.deepEqual(
+    detectTsSinks("w.ts", `await this.callRpc<unknown>(\n      '__diag_projection_apply',\n      { p_run: payload },`),
+    [F("rpc_publisher", "w.ts::__diag_projection_apply", 1)],
+  );
+});
+
 test("sql_migration: the provenance RPC body (INSERT INTO … DO UPDATE SET + UPDATE) counts 2", () => {
   assert.deepEqual(
     detectSqlSinks(
```

Run : `npm run -s audit:served-write-ratchet:test 2>&1 | grep -E '^ℹ (tests|pass|fail) '`
Attendu : `ℹ tests 19`, `ℹ pass 18`, `ℹ fail 1`.

- [ ] **Étape 6 : déclarer la RPC publiée et rafraîchir la baseline**

Écrire ce diff dans `$SCRATCH/ratchet-rpcs.diff`, puis `git apply "$SCRATCH/ratchet-rpcs.diff"` :

```diff
--- a/scripts/audit/check-served-content-write-sinks-ratchet.ts
+++ b/scripts/audit/check-served-content-write-sinks-ratchet.ts
@@ -81,7 +81,10 @@
   "TABLES.blog_guide", // __blog_guide (served blog)
 ];
 // DEFINER/publish RPCs that mutate a served row (B0 §1 R8, B1a Owner ③).
-export const SERVED_PUBLISH_RPCS: readonly string[] = ["__seo_r8_publish_snapshot"];
+export const SERVED_PUBLISH_RPCS: readonly string[] = [
+  "__seo_r8_publish_snapshot",
+  "__diag_projection_apply", // writer WIKI → __diag_link_provenance (INVOKER, EXECUTE service_role seul)
+];
 
 const WRITE_VERBS = "insert|update|upsert|delete";
 const CHAIN = "[\\s\\S]{0,300}?"; // bounded window across a fluent .from(...).verb(...) chain
```

```bash
npm run -s audit:served-write-ratchet:test 2>&1 | grep -E '^ℹ (tests|pass|fail) '
npm run -s audit:served-write-ratchet; echo "check_exit=$?"
npm run -s audit:served-write-ratchet:refresh
npm run -s audit:served-write-ratchet
```

Attendu : `ℹ tests 19`, `ℹ pass 19`, `ℹ fail 0` ; puis `check_exit=1` avec `+ rpc_publisher::backend/src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.ts::__diag_projection_apply (was 0, now 1)` ; après refresh, `✅ … count-exact match with baseline (62 keys, 267 occurrences).`

- [ ] **Étape 7 : commit**

```bash
git add backend/src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.test.ts \
  scripts/audit/check-served-content-write-sinks-ratchet.ts scripts/audit/check-served-content-write-sinks-ratchet.test.ts \
  audit/baselines/served-content-write-sinks-baseline.json
git commit -F - <<'EOF'
feat(diagnostic): writer de la projection de provenance

Pré-validation de l'export, référentiel paginé, résolution pure, puis UN appel
__diag_projection_apply via la gate RPC (internal, service_role). READ_ONLY
saute avant toute lecture ; tout échec est tracé par un run failed, et si cette
trace échoue l'exception remonte. __diag_projection_apply déclarée publisher
dans le ratchet des écrivains.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 6 : drapeau, planification, processor, endpoint admin et module

Le drapeau est lu par le service existant `FeatureFlagsService` (surchargeable à chaud par l'admin, clé ajoutée à `ALLOWED_KEYS`). Le scheduler n'enregistre le repeatable que si le drapeau est ON, et retire tout repeatable résiduel sinon ; son `onModuleInit` reste synchrone (règle backend : aucune I/O distante awaitée dans `onModuleInit`). Le processor re-vérifie le drapeau au moment du job. Le module est prouvé par un test de composition DI, parce qu'aucune CI de PR ne démarre le backend.

**Files:**
- Modify: `backend/src/config/feature-flags.service.ts` (getter + `ALLOWED_KEYS`)
- Create: `…/projection/diagnostic-projection-scheduler.service.ts` (+ `.test.ts`)
- Create: `…/projection/diagnostic-projection.processor.ts` (+ `.test.ts`)
- Create: `…/projection/diagnostic-projection-admin.controller.ts`
- Create: `…/projection/diagnostic-projection.module.ts` (+ `.test.ts`)
- Modify: `backend/src/app.module.ts` (import + entrée `imports`)

**Interfaces:**
- Consumes : `DiagnosticProjectionWriterService.run()` (Tâche 5) ; `DIAGNOSTIC_PROJECTION_QUEUE`, `DIAGNOSTIC_PROJECTION_JOB` (Tâche 3) ; `FeatureFlagsService`, `AuthenticatedGuard`, `IsAdminGuard`, `DatabaseModule`, `DiagnosticEngineModule`, `RpcGateModule` (global) existants.
- Produces : `FeatureFlagsService.diagnosticProjectionEnabled: boolean` (`DIAGNOSTIC_PROJECTION_ENABLED`, défaut `false`) ; `DIAGNOSTIC_PROJECTION_CRON_ENV`, `DEFAULT_DIAGNOSTIC_PROJECTION_CRON = '0 2 * * *'` (UTC), `DiagnosticProjectionSchedulerService.triggerNow(): Promise<string>` (id du job, une seule tentative) ; `POST api/admin/diagnostic-projection/trigger` → `{ok: true, jobId, message}` (admin) ; `DiagnosticProjectionModule`.

- [ ] **Étape 1 : le drapeau**

Écrire ce diff dans `$SCRATCH/feature-flags.diff`, puis `git apply "$SCRATCH/feature-flags.diff"` :

```diff
diff --git a/backend/src/config/feature-flags.service.ts b/backend/src/config/feature-flags.service.ts
index a47973e4c..40af75f1d 100644
--- a/backend/src/config/feature-flags.service.ts
+++ b/backend/src/config/feature-flags.service.ts
@@ -372,6 +372,15 @@ export class FeatureFlagsService {
     return this.bool('DIAGNOSTIC_KG_PRIMARY_ENABLED', false);
   }
 
+  /**
+   * Projection WIKI `exports/diagnostic/` → `__diag_link_provenance`.
+   * Default `false` : l'activation d'un environnement est une décision owner.
+   * Revérifié à chaque job (un override OFF arrête aussi un repeatable vivant).
+   */
+  get diagnosticProjectionEnabled(): boolean {
+    return this.bool('DIAGNOSTIC_PROJECTION_ENABLED', false);
+  }
+
   // ── Write Guard flags (P1.5) ──
 
   get writeGuardEnabled(): boolean {
@@ -449,6 +458,7 @@ export class FeatureFlagsService {
     'VEHICLE_CTX_ENABLED',
     'DIAGNOSTIC_KG_SHADOW_ENABLED',
     'DIAGNOSTIC_KG_PRIMARY_ENABLED',
+    'DIAGNOSTIC_PROJECTION_ENABLED',
     'SHOW_ACCESSORY_BLOCKS_ON_R2',
   ]);
 
```

Run : `npm --prefix backend test -- src/config/feature-flags`
Attendu : suites existantes vertes.

- [ ] **Étape 2 : scheduler — test d'abord**

Créer `…/projection/diagnostic-projection-scheduler.service.test.ts` avec exactement ce contenu :

```typescript
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bull';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';
import {
  DIAGNOSTIC_PROJECTION_JOB,
  DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID,
} from './diagnostic-projection.types';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const RESIDUAL = {
  name: DIAGNOSTIC_PROJECTION_JOB,
  key: `repeat:${DIAGNOSTIC_PROJECTION_JOB}:x`,
};

function makeScheduler(options: {
  enabled: boolean;
  repeatables?: Array<{ name: string; key: string }>;
  cron?: string;
}) {
  const queue = {
    add: jest.fn().mockResolvedValue({ id: 42 }),
    getRepeatableJobs: jest.fn().mockResolvedValue(options.repeatables ?? []),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'DIAGNOSTIC_PROJECTION_CRON' && options.cron
        ? options.cron
        : fallback,
    ),
  };
  const featureFlags = { diagnosticProjectionEnabled: options.enabled };
  const scheduler = new DiagnosticProjectionSchedulerService(
    queue as unknown as Queue,
    config as unknown as ConfigService,
    featureFlags as unknown as FeatureFlagsService,
  );
  return { scheduler, queue };
}

describe('DiagnosticProjectionSchedulerService', () => {
  it('OFF: returns synchronously, removes a residual repeatable, never registers one', async () => {
    const { scheduler, queue } = makeScheduler({
      enabled: false,
      repeatables: [RESIDUAL, { name: 'un-autre-job', key: 'repeat:autre' }],
    });
    expect(scheduler.onModuleInit()).toBeUndefined();
    await flush();
    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(RESIDUAL.key);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('ON: purges stale repeatables, then registers one with a stable jobId', async () => {
    const { scheduler, queue } = makeScheduler({
      enabled: true,
      repeatables: [RESIDUAL],
    });
    scheduler.onModuleInit();
    await flush();
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(RESIDUAL.key);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      DIAGNOSTIC_PROJECTION_JOB,
      { triggeredBy: 'repeatable' },
      {
        repeat: { cron: '0 2 * * *', tz: 'UTC' },
        jobId: DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID,
        removeOnComplete: 14,
        removeOnFail: 30,
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
    expect(
      queue.removeRepeatableByKey.mock.invocationCallOrder[0],
    ).toBeLessThan(queue.add.mock.invocationCallOrder[0]);
  });

  it('ON: honours DIAGNOSTIC_PROJECTION_CRON', async () => {
    const { scheduler, queue } = makeScheduler({
      enabled: true,
      cron: '30 4 * * *',
    });
    scheduler.onModuleInit();
    await flush();
    expect(queue.add.mock.calls[0][2].repeat).toEqual({
      cron: '30 4 * * *',
      tz: 'UTC',
    });
  });

  it('triggerNow enqueues a single-attempt admin job and returns its id', async () => {
    const { scheduler, queue } = makeScheduler({ enabled: false });
    await expect(scheduler.triggerNow()).resolves.toBe('42');
    expect(queue.add).toHaveBeenCalledWith(
      DIAGNOSTIC_PROJECTION_JOB,
      { triggeredBy: 'admin' },
      { removeOnComplete: 14, removeOnFail: 30, attempts: 1 },
    );
  });
});
```

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection-scheduler.service.test.ts`
Attendu : échec de compilation `TS2307: Cannot find module './diagnostic-projection-scheduler.service'`.

- [ ] **Étape 3 : scheduler — implémentation**

Créer `…/projection/diagnostic-projection-scheduler.service.ts` avec exactement ce contenu :

```typescript
/**
 * DiagnosticProjectionSchedulerService — planification de la projection WIKI →
 * `__diag_link_provenance` (spec §4.5).
 *
 * Repeatable BullMQ (pas `@Cron` : `@nestjs/schedule` est inerte dans ce monorepo,
 * cf. SeoProjectionFeederService). `DIAGNOSTIC_PROJECTION_ENABLED` défaut OFF :
 * OFF au boot dérégistre tout repeatable résiduel, de façon observable. Le
 * processor revérifie le drapeau à chaque job (un override admin OFF arrête
 * aussi un repeatable déjà enregistré).
 *
 * `onModuleInit` reste synchrone : Bull = Redis local, travail en `void`.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { getErrorMessage } from '@common/utils/error.utils';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import {
  DIAGNOSTIC_PROJECTION_JOB,
  DIAGNOSTIC_PROJECTION_QUEUE,
  DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID,
  type DiagnosticProjectionJobData,
} from './diagnostic-projection.types';

export const DIAGNOSTIC_PROJECTION_CRON_ENV = 'DIAGNOSTIC_PROJECTION_CRON';
/** 02:00 UTC, même créneau que le feeder SEO : exports du pin courant. */
export const DEFAULT_DIAGNOSTIC_PROJECTION_CRON = '0 2 * * *';

@Injectable()
export class DiagnosticProjectionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(
    DiagnosticProjectionSchedulerService.name,
  );

  constructor(
    @InjectQueue(DIAGNOSTIC_PROJECTION_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  onModuleInit(): void {
    if (!this.featureFlags.diagnosticProjectionEnabled) {
      this.logger.log(
        'DIAGNOSTIC_PROJECTION_ENABLED!=true — projection diagnostic non planifiée.',
      );
      void this.deregisterResidualRepeatable();
      return;
    }
    void this.configureRepeatableJob();
  }

  /** Enqueue one-off (endpoint admin). Le processor applique le drapeau. */
  async triggerNow(): Promise<string> {
    const job = await this.queue.add(
      DIAGNOSTIC_PROJECTION_JOB,
      { triggeredBy: 'admin' } satisfies DiagnosticProjectionJobData,
      { removeOnComplete: 14, removeOnFail: 30, attempts: 1 },
    );
    this.logger.log(
      `Projection diagnostic déclenchée manuellement (jobId=${String(job.id)}).`,
    );
    return String(job.id);
  }

  private async configureRepeatableJob(): Promise<void> {
    try {
      await this.removeStaleRepeatableJobs();
      await this.queue.add(
        DIAGNOSTIC_PROJECTION_JOB,
        { triggeredBy: 'repeatable' } satisfies DiagnosticProjectionJobData,
        {
          repeat: { cron: this.getCron(), tz: 'UTC' },
          jobId: DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID,
          removeOnComplete: 14,
          removeOnFail: 30,
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
      this.logger.log(
        `✅ Projection diagnostic planifiée (cron="${this.getCron()}" UTC).`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Échec d'enregistrement du repeatable de projection diagnostic: ${getErrorMessage(err)}`,
      );
    }
  }

  private async deregisterResidualRepeatable(): Promise<void> {
    const removed = await this.removeStaleRepeatableJobs();
    if (removed > 0) {
      this.logger.warn(
        `🧹 Projection diagnostic OFF — ${removed} repeatable résiduel supprimé.`,
      );
    } else {
      this.logger.log(
        '✅ Projection diagnostic OFF — aucun repeatable résiduel.',
      );
    }
  }

  /** Supprime les repeatables de ce job ; retourne le nombre supprimé. */
  private async removeStaleRepeatableJobs(): Promise<number> {
    let removed = 0;
    try {
      const jobs = await this.queue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === DIAGNOSTIC_PROJECTION_JOB) {
          await this.queue.removeRepeatableByKey(job.key);
          removed += 1;
          this.logger.log(
            `🗑️ Repeatable de projection diagnostic supprimé: ${job.key}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Énumération des repeatables de projection diagnostic impossible: ${getErrorMessage(err)}`,
      );
    }
    return removed;
  }

  private getCron(): string {
    return this.configService.get<string>(
      DIAGNOSTIC_PROJECTION_CRON_ENV,
      DEFAULT_DIAGNOSTIC_PROJECTION_CRON,
    );
  }
}
```

Run : même commande. Attendu : 4 tests verts.

- [ ] **Étape 4 : processor — test d'abord**

Créer `…/projection/diagnostic-projection.processor.test.ts` avec exactement ce contenu :

```typescript
import type { Job } from 'bull';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import type { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';
import { DiagnosticProjectionProcessor } from './diagnostic-projection.processor';

function makeProcessor(enabled: boolean) {
  const writer = {
    run: jest.fn().mockResolvedValue({
      status: 'applied',
      exportedCount: 3,
      run_id: 1,
      projected_count: 0,
      conflict_count: 3,
      retired_count: 0,
    }),
  };
  const processor = new DiagnosticProjectionProcessor(
    writer as unknown as DiagnosticProjectionWriterService,
    { diagnosticProjectionEnabled: enabled } as unknown as FeatureFlagsService,
  );
  return { processor, writer };
}

const job = (data: unknown) => ({ id: 1, data }) as unknown as Job<unknown>;

describe('DiagnosticProjectionProcessor', () => {
  it('flag ON: delegates to the writer with the job trigger', async () => {
    const { processor, writer } = makeProcessor(true);
    await expect(
      processor.handle(job({ triggeredBy: 'repeatable' })),
    ).resolves.toMatchObject({ status: 'applied', conflict_count: 3 });
    expect(writer.run).toHaveBeenCalledWith('repeatable');
  });

  it('flag OFF at job time: skips, even for an admin trigger', async () => {
    const { processor, writer } = makeProcessor(false);
    await expect(
      processor.handle(job({ triggeredBy: 'admin' })),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'FLAG_OFF',
    });
    expect(writer.run).not.toHaveBeenCalled();
  });

  it.each([[undefined], [{}], [{ triggeredBy: 'scheduler' }]])(
    'rejects job data outside the contract: %p',
    async (data) => {
      const { processor, writer } = makeProcessor(true);
      await expect(processor.handle(job(data))).rejects.toThrow();
      expect(writer.run).not.toHaveBeenCalled();
    },
  );
});
```

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection.processor.test.ts`
Attendu : échec de compilation `TS2307: Cannot find module './diagnostic-projection.processor'`.

- [ ] **Étape 5 : processor — implémentation**

Créer `…/projection/diagnostic-projection.processor.ts` avec exactement ce contenu :

```typescript
/**
 * DiagnosticProjectionProcessor — consumer BullMQ de la projection diagnostic.
 *
 * Adaptateur fin : valide les données du job, revérifie le drapeau (un override
 * admin OFF arrête aussi un repeatable déjà enregistré), puis délègue au writer.
 * READ_ONLY est appliqué par le writer (`guardReadOnly`). Une exception du
 * writer fait échouer le job, visiblement (`@OnQueueFailed`).
 */
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';
import {
  DIAGNOSTIC_PROJECTION_JOB,
  DIAGNOSTIC_PROJECTION_QUEUE,
  DiagnosticProjectionJobDataSchema,
  type DiagnosticProjectionRunResult,
} from './diagnostic-projection.types';

@Processor(DIAGNOSTIC_PROJECTION_QUEUE)
export class DiagnosticProjectionProcessor {
  private readonly logger = new Logger(DiagnosticProjectionProcessor.name);

  constructor(
    private readonly writer: DiagnosticProjectionWriterService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Process(DIAGNOSTIC_PROJECTION_JOB)
  async handle(job: Job<unknown>): Promise<DiagnosticProjectionRunResult> {
    const { triggeredBy } = DiagnosticProjectionJobDataSchema.parse(job.data);
    if (!this.featureFlags.diagnosticProjectionEnabled) {
      this.logger.warn(
        { metric: 'diagnostic_projection.skipped', triggered_by: triggeredBy },
        'DIAGNOSTIC_PROJECTION_ENABLED!=true — job de projection ignoré.',
      );
      return { status: 'skipped', reason: 'FLAG_OFF' };
    }
    return this.writer.run(triggeredBy);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `diagnostic-projection job ${String(job?.id)} failed: ${err?.message}`,
      err?.stack,
    );
  }
}
```

Run : même commande. Attendu : 5 tests verts.

- [ ] **Étape 6 : endpoint admin**

Créer `…/projection/diagnostic-projection-admin.controller.ts` avec exactement ce contenu (le drapeau et `READ_ONLY` s'appliquent en aval ; l'endpoint n'en contourne aucun) :

```typescript
/**
 * DiagnosticProjectionAdminController — déclenchement one-off de la projection
 * diagnostic (admin uniquement). Le drapeau et READ_ONLY s'appliquent en aval
 * (processor puis writer) : ce endpoint ne contourne aucun des deux.
 */
import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';

@Controller('api/admin/diagnostic-projection')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class DiagnosticProjectionAdminController {
  constructor(
    private readonly scheduler: DiagnosticProjectionSchedulerService,
  ) {}

  @Post('trigger')
  async trigger(): Promise<{ ok: true; jobId: string; message: string }> {
    const jobId = await this.scheduler.triggerNow();
    return {
      ok: true,
      jobId,
      message:
        'Projection diagnostic enqueue (one-off) — résultat dans __diag_projection_runs et les logs DiagnosticProjectionProcessor.',
    };
  }
}
```

- [ ] **Étape 7 : module — test de composition DI d'abord**

Créer `…/projection/diagnostic-projection.module.test.ts` avec exactement ce contenu :

```typescript
// Lu par les constructeurs à la compilation du module (aucune connexion) :
// `getAppConfig()` (services de DatabaseModule) et `getOrThrow('JWT_SECRET')`
// (VehicleContextService, importé par DiagnosticEngineModule).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-not-a-real-secret-0000000000';

import { getQueueToken } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { CacheModule } from '@cache/cache.module';
import { RpcGateModule } from '@security/rpc-gate/rpc-gate.module';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { FeatureFlagsModule } from '../../../config/feature-flags.module';
import { DiagnosticProjectionAdminController } from './diagnostic-projection-admin.controller';
import { DiagnosticProjectionModule } from './diagnostic-projection.module';
import { DiagnosticProjectionProcessor } from './diagnostic-projection.processor';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';
import { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';
import { DIAGNOSTIC_PROJECTION_QUEUE } from './diagnostic-projection.types';

/**
 * DiagnosticProjectionModule — preuve de composition DI AVANT fusion.
 *
 * Aucune CI de PR ne démarre le backend : une dépendance non résolue ne
 * casserait qu'au démarrage du container PREPROD. Ce test compile le VRAI
 * module avec les modules globaux de l'AppModule dont il dépend (Config,
 * EventEmitter, Cache, FeatureFlags, RpcGate) ; seule la file Bull est
 * remplacée (sa connexion Redis vient de la config racine du WorkerModule).
 * `compile()` n'appelle pas `onModuleInit` : aucune connexion Redis ni Supabase.
 *
 * Fail-closed : sans `RpcGateModule`, le boot est REFUSÉ — jamais un writer
 * dont `callRpc` passerait sans gate (précédent : SeoProjectionReadModule).
 */
const compileWith = (globals: unknown[]) =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      EventEmitterModule.forRoot(),
      CacheModule,
      FeatureFlagsModule,
      ...(globals as []),
      DiagnosticProjectionModule,
    ],
  })
    .overrideProvider(getQueueToken(DIAGNOSTIC_PROJECTION_QUEUE))
    .useValue({})
    .compile();

describe('DiagnosticProjectionModule — composition DI', () => {
  it('avec les modules globaux de l’AppModule → boot VERT, writer résolu avec LA gate RPC', async () => {
    const moduleRef = await compileWith([RpcGateModule]);
    const writer = moduleRef.get(DiagnosticProjectionWriterService);
    expect(writer).toBeInstanceOf(DiagnosticProjectionWriterService);
    expect((writer as unknown as { rpcGate?: unknown }).rpcGate).toBe(
      moduleRef.get(RpcGateService),
    );
    expect(moduleRef.get(DiagnosticProjectionSchedulerService)).toBeDefined();
    expect(moduleRef.get(DiagnosticProjectionProcessor)).toBeDefined();
    expect(moduleRef.get(DiagnosticProjectionAdminController)).toBeDefined();
    await moduleRef.close();
  });

  it('SANS RpcGateModule → boot REFUSÉ (RpcGateService non résolu)', async () => {
    await expect(compileWith([])).rejects.toThrow(/RpcGateService/);
  });
});
```

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection.module.test.ts`
Attendu : échec de compilation `TS2307: Cannot find module './diagnostic-projection.module'` (`Tests: 0 total`).

- [ ] **Étape 8 : module — implémentation et branchement**

Créer `…/projection/diagnostic-projection.module.ts` avec exactement ce contenu :

```typescript
/**
 * DiagnosticProjectionModule — projection `exports/diagnostic/` du WIKI vers
 * `__diag_link_provenance` (spec §4.5). Réutilise DatabaseModule, le référentiel
 * de DiagnosticEngineModule et la config Bull racine (WorkerModule).
 */
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../../database/database.module';
import { DiagnosticEngineModule } from '../diagnostic-engine.module';
import { DiagnosticProjectionAdminController } from './diagnostic-projection-admin.controller';
import { DiagnosticProjectionProcessor } from './diagnostic-projection.processor';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';
import { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';
import { DIAGNOSTIC_PROJECTION_QUEUE } from './diagnostic-projection.types';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    DiagnosticEngineModule,
    BullModule.registerQueue({ name: DIAGNOSTIC_PROJECTION_QUEUE }),
  ],
  controllers: [DiagnosticProjectionAdminController],
  providers: [
    DiagnosticProjectionWriterService,
    DiagnosticProjectionSchedulerService,
    DiagnosticProjectionProcessor,
  ],
})
export class DiagnosticProjectionModule {}
```

Écrire ce diff dans `$SCRATCH/app-module.diff`, puis `git apply "$SCRATCH/app-module.diff"` :

```diff
diff --git a/backend/src/app.module.ts b/backend/src/app.module.ts
index 591e403b2..1c4597b0a 100644
--- a/backend/src/app.module.ts
+++ b/backend/src/app.module.ts
@@ -77,6 +77,7 @@ import { MarketingModule } from './modules/marketing/marketing.module'; // 📊
 import { MediaFactoryModule } from './modules/media-factory/media-factory.module'; // 🎬 REVIVE 2026-06-20 — fetch-only TTS (Azure REST), dé-RAG, flag-gated
 import { isMediaFactoryEnabled } from './modules/media-factory/media-factory.flag';
 import { DiagnosticEngineModule } from './modules/diagnostic-engine/diagnostic-engine.module'; // 🔧 NOUVEAU - Moteur diagnostic mecanique MVP !
+import { DiagnosticProjectionModule } from './modules/diagnostic-engine/projection/diagnostic-projection.module';
 import { TrendSignalsModule } from './modules/trend-signals/trend-signals.module'; // 📈 NOUVEAU - Middle-ground trend signals ingestion (Tasks 1.9-1.11 ai-additive-layer)
 
 /**
@@ -188,6 +189,7 @@ import { TrendSignalsModule } from './modules/trend-signals/trend-signals.module
     MarketingModule, // 📊 ACTIVÉ - Module marketing avec backlinks, content roadmap et KPIs !
     ...(isMediaFactoryEnabled() ? [MediaFactoryModule] : []), // 🎬 REVIVE flag-gated (MEDIA_FACTORY_ENABLED, off par défaut → 0 prod)
     DiagnosticEngineModule, // 🔧 ACTIVÉ - Moteur diagnostic mecanique MVP (Slice 1) !
+    DiagnosticProjectionModule, // Provenance WIKI des liens diagnostic (drapeau DIAGNOSTIC_PROJECTION_ENABLED, défaut OFF)
     TrendSignalsModule, // 📈 ACTIVÉ - Middle-ground trend signals ingestion (Tasks 1.9-1.11)
     // AgenticEngineModule — ARCHIVÉ 2026-04-02 (tables → _archive schema, remplacé par Paperclip)
 
```

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/projection/diagnostic-projection.module.test.ts`
Attendu : 2 tests verts : `avec les modules globaux de l’AppModule → boot VERT, writer résolu avec LA gate RPC` et `SANS RpcGateModule → boot REFUSÉ (RpcGateService non résolu)`.

- [ ] **Étape 9 : contrôle complet**

```bash
npm --prefix backend test -- src/modules/diagnostic-engine src/config/feature-flags 2>&1 | grep -E '^(Test Suites|Tests):'
(cd backend && NODE_OPTIONS='--max-old-space-size=4096' ../node_modules/.bin/tsc --noEmit -p tsconfig.json && echo TSC_OK)
CHANGED=$(git diff --name-only feat/diag-provenance-db -- 'backend/src/**/*.ts'; git diff --name-only -- 'backend/src/**/*.ts'; git ls-files --others --exclude-standard -- 'backend/src/**/*.ts')
(cd backend && ../node_modules/.bin/eslint $(echo "$CHANGED" | sort -u | sed 's#^backend/##') && echo ESLINT_OK)
npx ast-grep scan --config sgconfig.yml backend/src/modules/diagnostic-engine backend/src/config && echo ASTGREP_OK
node_modules/.bin/prettier --check $(echo "$CHANGED" | sort -u) && echo PRETTIER_OK
```

Attendu : `Test Suites: 20 passed, 20 total`, `Tests: 405 passed, 405 total` (13 suites / 346 tests sur `main` au 2026-10-01, plus les 7 nouvelles suites / 59 tests) ; `TSC_OK`, `ESLINT_OK`, `ASTGREP_OK`, `PRETTIER_OK`.

- [ ] **Étape 10 : commit**

```bash
git add backend/src/config/feature-flags.service.ts backend/src/app.module.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection-scheduler.service.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection-scheduler.service.test.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection.processor.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection.processor.test.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection-admin.controller.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection.module.ts \
  backend/src/modules/diagnostic-engine/projection/diagnostic-projection.module.test.ts
git commit -F - <<'EOF'
feat(diagnostic): planification de la projection derrière DIAGNOSTIC_PROJECTION_ENABLED

Drapeau OFF par défaut. Repeatable nocturne (02:00 UTC) enregistré seulement
si ON, retiré sinon ; processor qui re-vérifie le drapeau au moment du job ;
déclenchement admin one-off soumis au même drapeau et à READ_ONLY. Test de
composition DI : sans RpcGateModule, le boot est refusé.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 7 : mutations TS, puis PR-B

**Files:** aucun fichier du dépôt (script dans `$SCRATCH`).

**Interfaces:**
- Consumes : tout le code des Tâches 2 à 6.
- Produces : PR-B `feat/diag-provenance-writer`.

- [ ] **Étape 1 : mutations — chaque garde du code doit avoir un test qui la tue**

Créer `$SCRATCH/mut_ts.py` avec exactement ce contenu :

```python
#!/usr/bin/env python3
"""Mutants TS de la projection : chacun doit faire échouer le test qui le garde.

Lancer depuis la racine du worktree : python3 "$SCRATCH/mut_ts.py"
Chaque mutant remplace des ancres UNIQUES, lance le seul test concerné, puis restaure.
"""
import subprocess
import sys
from pathlib import Path

B = Path("backend")
P = "src/modules/diagnostic-engine/projection/"
DS = "src/modules/diagnostic-engine/diagnostic-engine.data-service.ts"
REF_T = "src/modules/diagnostic-engine/diagnostic-projection-reference.test.ts"
RES, RES_T = P + "diagnostic-projection-resolver.ts", P + "diagnostic-projection-resolver.test.ts"
WR, WR_T = P + "diagnostic-projection-writer.service.ts", P + "diagnostic-projection-writer.service.test.ts"
MOD, MOD_T = P + "diagnostic-projection.module.ts", P + "diagnostic-projection.module.test.ts"
MUTANTS = [
    ("dup-reservation-removed", RES,
     [("      reserved.set(link.id, relationIndex);\n", "")], RES_T),
    ("system-filter-dropped", RES,
     [("(causesBySystem.get(system.id) ?? []).flatMap(", "[...reference.causes].flatMap(")], RES_T),
    ("raw-proven-ignored", RES,
     [(".filter((source) => source.raw_proven !== true)", ".filter(() => false)")], RES_T),
    ("readonly-guard-removed", WR,
     [("    if (this.guardReadOnly('run', triggeredBy)) {", "    if (false) {")], WR_T),
    ("rpcgate-context-removed", WR,
     [("      { source: 'internal', isServiceRole: true },", "      {},")], WR_T),
    ("processor-flag-recheck-removed", P + "diagnostic-projection.processor.ts",
     [("if (!this.featureFlags.diagnosticProjectionEnabled) {", "if (false) {")],
     P + "diagnostic-projection.processor.test.ts"),
    ("scheduler-off-purge-removed", P + "diagnostic-projection-scheduler.service.ts",
     [("      void this.deregisterResidualRepeatable();\n", "")],
     P + "diagnostic-projection-scheduler.service.test.ts"),
    ("pagination-single-page", DS,
     [("      if (data.length < pageSize) break;", "      break;")], REF_T),
    ("count-check-removed", DS,
     [("    if (rows.length !== expected) {", "    if (false) {")], REF_T),
    ("module-engine-import-removed", MOD,
     [("    DiagnosticEngineModule,\n", "")], MOD_T),
    ("module-processor-unregistered", MOD,
     [("    DiagnosticProjectionProcessor,\n  ],", "  ],")], MOD_T),
    ("writer-gate-unassigned", WR,
     [("    this.rpcGate = rpcGate;\n", "")], MOD_T),
    ("writer-gate-optional", WR,
     [("import { Injectable, Logger } from '@nestjs/common';",
       "import { Injectable, Logger, Optional } from '@nestjs/common';"),
      ("    rpcGate: RpcGateService,\n", "    @Optional() rpcGate: RpcGateService,\n")], MOD_T),
]


def main() -> int:
    survivors = []
    for name, rel, edits, test in MUTANTS:
        path = B / rel
        original = path.read_text(encoding="utf-8")
        mutated = original
        for old, new in edits:
            if mutated.count(old) != 1:
                print(f"SETUP-ERROR {name}: ancre trouvée {mutated.count(old)} fois")
                return 2
            mutated = mutated.replace(old, new)
        try:
            path.write_text(mutated, encoding="utf-8")
            r = subprocess.run(["npm", "--prefix", "backend", "test", "--", test],
                               capture_output=True, text=True, timeout=600)
        finally:
            path.write_text(original, encoding="utf-8")
        failing = [l.strip() for l in (r.stdout + r.stderr).splitlines() if l.strip().startswith("✕")]
        verdict = "KILLED" if r.returncode != 0 and failing else "SURVIVED"
        if verdict == "SURVIVED":
            survivors.append(name)
        print(f"{verdict:8} {name}  ({len(failing)} test(s) rouges) {failing[:1]}")
    print("survivors:", survivors)
    return 1 if survivors else 0


sys.exit(main())
```

Run : `python3 "$SCRATCH/mut_ts.py"` (depuis la racine du worktree)
Attendu : 13 mutants `KILLED`, dernière ligne `survivors: []`, puis `git status --porcelain` vide (chaque mutant est restauré).

- [ ] **Étape 2 : gate de propriété**

Run : `node scripts/registry/check-new-files.js --base feat/diag-provenance-db; echo "exit=$?"`
Attendu : `✓ All new files pass owner+domain gate` puis `exit=0` : les fichiers de `projection/` relèvent du glob `backend/src/modules/diagnostic-engine/**` (D4 `@ak125/vehicle-team`), les `*.test.ts` sont des exceptions de la gate.

- [ ] **Étape 3 : rebase sur `main` après fusion de PR-A**

PR-A est fusionnée en squash : son commit n'est pas un ancêtre de `main`. Rejouer uniquement les commits de PR-B :

```bash
git -C /opt/automecanik/app fetch origin
git rebase --onto origin/main feat/diag-provenance-db feat/diag-provenance-writer
```

Si la baseline entre en conflit (`audit/baselines/served-content-write-sinks-baseline.json`), la reprendre de `main` puis la régénérer par le script, jamais à la main :

```bash
B=audit/baselines/served-content-write-sinks-baseline.json
git show origin/main:$B > $B
npm run -s audit:served-write-ratchet:refresh
git add $B && GIT_EDITOR=true git rebase --continue
npm run -s audit:served-write-ratchet
```

Attendu : `git log --oneline origin/main..HEAD` liste exactement les commits des Tâches 2 à 6 ; le contrôle final affiche `62 keys, 267 occurrences` (ou `main` + 1 clé / + 1 occurrence si `main` a bougé). Relancer ensuite l'Étape 9 de la Tâche 6 : mêmes compteurs attendus.

- [ ] **Étape 4 : PR-B (après confirmation explicite de l'utilisateur)**

```bash
git push -u origin feat/diag-provenance-writer
gh pr create --repo ak125/nestjs-remix-monorepo --base main --head feat/diag-provenance-writer \
  --title "feat(diagnostic): writer de la projection de provenance WIKI (drapeau OFF)" \
  --body-file - <<'EOF'
## Quoi
`DiagnosticProjectionModule` : projette `exports/diagnostic/` du WIKI dans
`__diag_link_provenance` par un seul appel `__diag_projection_apply`. Drapeau
`DIAGNOSTIC_PROJECTION_ENABLED` OFF par défaut : aucun changement runtime à la fusion.
Aucun lien n'est créé, modifié ni supprimé ; `reviewed` / `diagnostic_safe` sont recopiés.

## Preuve
- 7 nouvelles suites (59 tests) : pré-validation de l'export, lecture paginée à compte
  exact au-delà de 1000 lignes, résolution (état de lancement : 0 projection, 3 conflits
  `source_not_raw_proven`), writer (READ_ONLY, run `failed` tracé, retour RPC hors contrat),
  scheduler et processor (drapeau re-vérifié au job), composition DI réelle du module ;
- 13 mutants tués ; tsc, ESLint, ast-grep, Prettier verts ;
- ratchet des écrivains : `__diag_projection_apply` déclarée publisher, baseline par le script.

## Après fusion
Le container PREPROD démarre le module (READ_ONLY : aucun run). Preuve sur DEV:3000 après
application de la migration et GO de l'owner ; activation PROD hors de cette PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr checks feat/diag-provenance-writer --repo ak125/nestjs-remix-monorepo --watch
```

Si « Registry freshness » échoue, appliquer le patch `registry-recovery-<run_id>` exactement comme à l'Étape 15 de la Tâche 1 (branche `feat/diag-provenance-writer`).

- [ ] **Étape 5 : preuve après fusion humaine**

```bash
SHA=$(gh pr view feat/diag-provenance-writer --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow ci.yml --commit "$SHA" --event push --json databaseId -q '.[0].databaseId')
test -n "$RUN" && gh run watch "$RUN" --repo ak125/nestjs-remix-monorepo --exit-status
```

Attendu : run présent et vert, jobs `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests` et `🔦 Lighthouse Performance Audit` en `success` : le container PREPROD démarre avec le module (premier démarrage réel de la composition DI hors test).

---

### Tâche 8 : application de la migration (GO owner nominatif)

**Files:** aucun.

**Interfaces:**
- Consumes : migration fusionnée sur `main` (Tâche 1).
- Produces : ligne `applied` dans `infra.schema_migrations` ; les trois tables et la RPC présentes dans la base partagée.

- [ ] **Étape 1 : dry-run (après confirmation explicite de l'utilisateur)**

Le run est identifié par un id strictement supérieur au dernier dispatch connu avant le déclenchement : un `--limit 1` lu juste après `gh workflow run` peut renvoyer le run précédent, et regarder un ancien `APPLY` vert à la place du dry-run passerait à tort.

```bash
W=apply-supabase-migrations.yml R=ak125/nestjs-remix-monorepo
PREV=$(gh run list --repo "$R" --workflow "$W" --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId // 0')
gh workflow run "$W" --repo "$R" --ref main \
  -f confirm=DRY_RUN -f dry_run=true -f only_ids=20261001_diag_link_provenance
RUN=; for _ in $(seq 1 30); do
  RUN=$(gh run list --repo "$R" --workflow "$W" --event workflow_dispatch --limit 1 --json databaseId -q ".[0].databaseId // empty | select(. > $PREV)")
  test -n "$RUN" && break; sleep 10
done
test -n "$RUN" || { echo "aucun nouveau run en 5 min : s'arrêter"; false; }
gh run watch "$RUN" --repo "$R" --exit-status
gh run view "$RUN" --repo ak125/nestjs-remix-monorepo --log | grep -n '20261001_diag_link_provenance'
```

Attendu : run `success` ; la migration apparaît comme en attente et aucune autre n'est sélectionnée. Toute autre migration listée en attente : s'arrêter et le signaler.

- [ ] **Étape 2 : application (GO nominatif de l'owner, puis confirmation explicite de l'utilisateur)**

```bash
W=apply-supabase-migrations.yml R=ak125/nestjs-remix-monorepo
PREV=$(gh run list --repo "$R" --workflow "$W" --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId // 0')
gh workflow run "$W" --repo "$R" --ref main \
  -f confirm=APPLY -f dry_run=false -f only_ids=20261001_diag_link_provenance
RUN=; for _ in $(seq 1 30); do
  RUN=$(gh run list --repo "$R" --workflow "$W" --event workflow_dispatch --limit 1 --json databaseId -q ".[0].databaseId // empty | select(. > $PREV)")
  test -n "$RUN" && break; sleep 10
done
test -n "$RUN" || { echo "aucun nouveau run en 5 min : s'arrêter (ne pas relancer l'APPLY à l'aveugle)"; false; }
gh run watch "$RUN" --repo "$R" --exit-status
```

Attendu : run `success`.

- [ ] **Étape 3 : preuve en lecture seule**

```bash
test -x "$SWEEP" || { echo "SWEEP absent : s'arrêter"; false; }
git -C /opt/automecanik/app show origin/main:backend/supabase/migrations/20261001_diag_link_provenance.sql | sha256sum
"$SWEEP" -c "SELECT id, status, checksum FROM infra.schema_migrations WHERE id = '20261001_diag_link_provenance';"
"$SWEEP" -c "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance') ORDER BY 1;"
"$SWEEP" -c "SELECT r AS role, has_function_privilege(r, 'public.__diag_projection_apply(jsonb)', 'EXECUTE') AS can_execute, has_table_privilege(r, 'public.__diag_link_provenance', 'SELECT') AS can_select FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r;"
"$SWEEP" -c "SELECT (SELECT count(*) FROM public.__diag_projection_runs) AS runs, (SELECT count(*) FROM public.__diag_link_provenance) AS provenance, (SELECT count(*) FROM public.__diag_projection_conflicts) AS conflicts;"
```

Attendu : `status = applied` et `checksum` égal au hash `sha256sum` du fichier de `main` ; 3 tables, `relrowsecurity = t` ; `anon` et `authenticated` à `f | f`, `service_role` à `t | t` ; `0 | 0 | 0`.

---

### Tâche 9 : preuve sur DEV:3000 (GO owner nominatif : écrit un run dans la base partagée)

Le run de preuve écrit une ligne `__diag_projection_runs` et trois conflits dans la base partagée par DEV, PREPROD et PROD : GO owner avant l'Étape 2. La surcharge du drapeau est volatile (en mémoire du processus DEV:3000) et retirée à la fin ; le processor tourne dans le même processus (le module est importé par `AppModule`).

**Files:** aucun.

**Interfaces:**
- Consumes : Tâche 8 appliquée ; PR-B fusionnée ; DEV:3000 resynchronisé sur un `main` qui la contient ; pin du sous-module contenant `exports/diagnostic/` (Plan 1, Tâche 5).
- Produces : premier run réel, preuve de l'état de lancement.

- [ ] **Étape 1 : préconditions**

```bash
git -C /opt/automecanik/app fetch -q origin
SHA_B=$(gh pr view feat/diag-provenance-writer --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
git -C /opt/automecanik/app merge-base --is-ancestor "$SHA_B" HEAD && echo DEV_HAS_PR_B
test -f /opt/automecanik/app/backend/content/automecanik-wiki/exports/diagnostic/_index.json && echo PIN_HAS_EXPORTS
curl -fsS http://localhost:3000/health >/dev/null && echo DEV_UP
"$SWEEP" -c "SELECT status FROM infra.schema_migrations WHERE id = '20261001_diag_link_provenance';"
```

Attendu : `DEV_HAS_PR_B`, `PIN_HAS_EXPORTS`, `DEV_UP`, `applied`. Sinon attendre la resynchronisation (`scripts/ops/sync-dev-runtime.sh`, cron ~10 min) ou la Tâche 5 du Plan 1 ; ne jamais resynchroniser DEV:3000 à la main.

- [ ] **Étape 2 : un run admin (GO owner, puis confirmation explicite de l'utilisateur)**

L'opérateur exporte dans son shell `ADMIN_COOKIE='connect.sid=<valeur>'`, cookie d'une session admin ouverte dans son navigateur sur DEV:3000. Le cookie n'est écrit dans aucun fichier, commit ni message.

Le processor relit le drapeau au moment du job : la surcharge doit rester active jusqu'à ce que le job ait écrit sa ligne. La ligne `__diag_projection_runs` n'est écrite qu'en fin de run (`applied` ou `failed`, jamais d'état intermédiaire) ; l'attente porte donc sur un id strictement supérieur au maximum lu avant le déclenchement, bornée à 5 min. Le bloc ne contient ni `set -e` ni `exit` : le `DELETE` s'exécute toujours, même si une commande précédente a échoué ou si l'attente a expiré.

```bash
PREV=$("$SWEEP" -qtAc "SELECT coalesce(max(id), 0) FROM public.__diag_projection_runs;")
curl -fsS -X PATCH -H "Cookie: $ADMIN_COOKIE" -H 'Content-Type: application/json' \
  -d '{"value":"true"}' http://localhost:3000/api/admin/feature-flags/DIAGNOSTIC_PROJECTION_ENABLED; echo
curl -fsS -X POST -H "Cookie: $ADMIN_COOKIE" http://localhost:3000/api/admin/diagnostic-projection/trigger; echo
NEW=; for _ in $(seq 1 30); do
  NEW=$("$SWEEP" -qtAc "SELECT id FROM public.__diag_projection_runs WHERE id > ${PREV:-0} ORDER BY id LIMIT 1;")
  test -n "$NEW" && break; sleep 10
done
echo "run=${NEW:-AUCUN}"
curl -fsS -X DELETE -H "Cookie: $ADMIN_COOKIE" http://localhost:3000/api/admin/feature-flags/DIAGNOSTIC_PROJECTION_ENABLED; echo
```

Attendu, dans l'ordre (le contrôleur feature-flags porte `AdminResponseInterceptor`, qui enveloppe la réponse ; le contrôleur de projection ne le porte pas) :
- `{"success":true,"data":{"key":"DIAGNOSTIC_PROJECTION_ENABLED","value":"true","volatile":true},"meta":{"timestamp":"…"}}` ;
- `{"ok":true,"jobId":"…","message":"Projection diagnostic enqueue (one-off) — …"}` ;
- `run=<id>` ;
- `{"success":true,"data":{"key":"DIAGNOSTIC_PROJECTION_ENABLED","cleared":true},"meta":{"timestamp":"…"}}`.

`run=AUCUN` : ne pas relancer ; passer à l'Étape 3, qui lit les logs.

- [ ] **Étape 3 : lecture du run**

La base est partagée avec PREPROD et PROD : on lit le run `$NEW` identifié à l'Étape 2, jamais « le dernier ».

```bash
test -n "$NEW" || { echo "aucun run identifié à l'Étape 2 : voir le cas « aucun run » ci-dessous"; false; }
"$SWEEP" -c "SELECT id, triggered_by, runtime_env, status, exported_count, projected_count, conflict_count, retired_count, error FROM public.__diag_projection_runs WHERE id = $NEW;"
"$SWEEP" -c "SELECT gamme_slug, symptom_slug, reason, detail->'unproven_sources' AS unproven FROM public.__diag_projection_conflicts WHERE run_id = $NEW ORDER BY gamme_slug;"
"$SWEEP" -c "SELECT count(*) AS provenance FROM public.__diag_link_provenance;"
```

Attendu : `admin | development | applied | 3 | 0 | 3 | 0 |` (erreur vide) ; 3 conflits `source_not_raw_proven` pour `filtre-a-air`, `filtre-a-carburant`, `filtre-d-habitacle`, chacun listant ses sources non prouvées ; `0` provenance. Un run `failed` : lire `error`, corriger la cause dans une PR, jamais dans la base. Aucun run (`run=AUCUN`) : le writer écrit une ligne `failed` pour toute erreur qu'il attrape, donc le job a été ignoré, n'a pas été traité, ou n'a pas pu enregistrer son échec. Chercher dans la sortie du processus DEV:3000 (le terminal qui l'a lancé) : `diagnostic_projection.skipped` (surcharge inactive au moment du job : relire la réponse du `PATCH`), `readonly.skipped` (`READ_ONLY` actif sur DEV), ou `diagnostic-projection job … failed` (dont `could not be recorded`). Rien de tout cela : le job n'a pas été consommé (worker BullMQ). Ne pas relancer avant d'avoir trouvé la cause.

---

### Tâche 10 : diffs du registre L2 pour l'owner (`.spec/00-canon/**`, non commités par l'agent)

Même procédure que la Tâche 6 du Plan 1 (précédent #1622) : l'agent vérifie les diffs dans un worktree jetable, l'owner les commite, puis applique sans l'éditer le patch `generated-projections.patch` de l'artefact `registry-recovery-<run_id>` du job « Registry freshness ».

**Files (owner):**
- Modify: `.spec/00-canon/repository-registry/projections.registry.json` (entrée `diagnostic_provenance_v1`, PLANNED)
- Modify: `.spec/00-canon/repository-registry/pipelines.registry.json` (entrée `exports_diagnostic_to_db_projection`, PARTIAL, après `exports_seo_to_db_projection`)
- Modify: `.spec/00-canon/repository-registry/automation-reality.yaml` (entrée `diagnostic-projection-nightly`, DRAFTED)

**Interfaces:**
- Consumes : `…/projection/diagnostic-projection-scheduler.service.ts` sur `main` (Tâche 6 ; le validateur exige que `evidence.path` soit suivi par git et que `excerpt` soit à la ligne 73) ; entrées `wiki_to_exports_diagnostic` et `wiki-exports-diagnostic-generate` du Plan 1 (les contextes des diffs pipelines et automation les supposent déjà appliquées).
- Produces : la projection `diagnostic_provenance_v1` et le pipeline qui l'alimente, liés dans les deux sens.

- [ ] **Étape 1 : les trois diffs**

Écrire ces diffs dans `$SCRATCH/l2-p2-projections.diff`, `$SCRATCH/l2-p2-pipelines.diff` et `$SCRATCH/l2-p2-automation.diff` :

```diff
diff --git a/.spec/00-canon/repository-registry/projections.registry.json b/.spec/00-canon/repository-registry/projections.registry.json
index 78e8ff1..4c95097 100644
--- a/.spec/00-canon/repository-registry/projections.registry.json
+++ b/.spec/00-canon/repository-registry/projections.registry.json
@@ -36,6 +36,24 @@
       "rollout_flag": "growthbook:seo_projection_read_v1",
       "owner_pr": "PR-6",
       "adr": "ADR-058"
+    },
+    {
+      "projection_id": "diagnostic_provenance_v1",
+      "status": "PLANNED",
+      "source": "wiki/exports/diagnostic/",
+      "fed_by_pipeline": "exports_diagnostic_to_db_projection",
+      "tables": [
+        "__diag_projection_runs",
+        "__diag_link_provenance",
+        "__diag_projection_conflicts"
+      ],
+      "runner": "backend/src/modules/diagnostic-engine/projection/diagnostic-projection.processor.ts",
+      "rpc": "__diag_projection_apply",
+      "consumers": [],
+      "consumers_non_seo": ["diagnostic_tool"],
+      "projection_contract_version": "1.0.0",
+      "rollout_flag": "env:DIAGNOSTIC_PROJECTION_ENABLED",
+      "adr": "ADR-035"
     }
   ]
 }
```

```diff
diff --git a/.spec/00-canon/repository-registry/pipelines.registry.json b/.spec/00-canon/repository-registry/pipelines.registry.json
index a5a8a9b..f759cc0 100644
--- a/.spec/00-canon/repository-registry/pipelines.registry.json
+++ b/.spec/00-canon/repository-registry/pipelines.registry.json
@@ -76,6 +76,21 @@
       "owner_pr": "PR-6",
       "adr": "ADR-058"
     },
+    {
+      "id": "exports_diagnostic_to_db_projection",
+      "from": "automecanik-wiki/exports/diagnostic/",
+      "to": "__diag_link_provenance, __diag_projection_runs, __diag_projection_conflicts",
+      "kind": "runtime_projection",
+      "status": "PARTIAL",
+      "scripts": [
+        "app/backend/src/modules/diagnostic-engine/projection/diagnostic-projection-writer.service.ts",
+        "app/backend/supabase/migrations/20261001_diag_link_provenance.sql"
+      ],
+      "gaps": ["drapeau DIAGNOSTIC_PROJECTION_ENABLED OFF ; activation PROD après acceptation d'ADR-035 et tag v*"],
+      "rule": "résolution déterministe sur les liens existants, sans en créer ; un run = une transaction __diag_projection_apply ; exported = projected + conflicts",
+      "feeds_projection": "diagnostic_provenance_v1",
+      "adr": "ADR-035"
+    },
     {
       "id": "db_projection_to_pages",
       "from": "__seo_entity_facts(active_version_id)",
```

```diff
diff --git a/.spec/00-canon/repository-registry/automation-reality.yaml b/.spec/00-canon/repository-registry/automation-reality.yaml
index a74bf72..46f1dab 100644
--- a/.spec/00-canon/repository-registry/automation-reality.yaml
+++ b/.spec/00-canon/repository-registry/automation-reality.yaml
@@ -423,3 +423,24 @@ entries:
     last_verified_method: "manual-inspection"
     missing_step: "fusion de la PR du workflow, puis un run workflow_dispatch prouvé : commit bot exports/diagnostic + wiki-quality-gates vert sur ce push"
     risk: "low"
+
+  # ──────────────────────────────────────────────────────────────────────────
+  # DRAFTED — projection WIKI exports/diagnostic → __diag_link_provenance
+  # (ADR-035). Repeatable BullMQ enregistré seulement drapeau ON. Passe ACTIVE
+  # quand un run PROD est prouvé : ligne __diag_projection_runs, runtime_env PROD.
+  # ──────────────────────────────────────────────────────────────────────────
+  - automation_id: "diagnostic-projection-nightly"
+    domain: "D4"
+    intended_mode: "ACTIVE"
+    actual_mode: "DRAFTED"
+    executor: "bullmq"
+    evidence:
+      - path: "backend/src/modules/diagnostic-engine/projection/diagnostic-projection-scheduler.service.ts"
+        line: 73
+        excerpt: "repeat: { cron: this.getCron(), tz: 'UTC' },"
+        note: "repeatable à jobId stable, désenregistré drapeau OFF ; un run = une transaction __diag_projection_apply"
+    last_verified_at: "2026-09-30"
+    last_verified_by: "@ak125"
+    last_verified_method: "manual-inspection"
+    missing_step: "drapeau DIAGNOSTIC_PROJECTION_ENABLED ON en PROD (après acceptation d'ADR-035 et tag v*), puis une ligne __diag_projection_runs status applied, runtime_env PROD"
+    risk: "low"
```

- [ ] **Étape 2 : vérification dans un worktree jetable (après fusion de PR-B)**

Les contextes des diffs supposent les entrées L2 du Plan 1 présentes : si elles ne sont pas encore sur `main`, la première commande les applique dans le worktree jetable (`$SCRATCH/l2-pipeline.diff` et `$SCRATCH/l2-automation.diff` du Plan 1, Tâche 6).

```bash
git -C /opt/automecanik/app worktree add --detach "$SCRATCH/l2chk2" origin/main
ln -s /opt/automecanik/app/node_modules "$SCRATCH/l2chk2/node_modules"
cd "$SCRATCH/l2chk2"
grep -q '"wiki_to_exports_diagnostic"' .spec/00-canon/repository-registry/pipelines.registry.json \
  || git apply "$SCRATCH/l2-pipeline.diff" "$SCRATCH/l2-automation.diff"
(git apply "$SCRATCH/l2-p2-projections.diff" "$SCRATCH/l2-p2-pipelines.diff" "$SCRATCH/l2-p2-automation.diff" \
  && for r in projections pipelines; do "$SCRATCH/ajv/node_modules/.bin/ajv" validate -s .spec/00-canon/repository-registry/_schema/$r.registry.schema.json -d .spec/00-canon/repository-registry/$r.registry.json; done \
  && python3 scripts/canon/validate-cross-references.py \
  && npm run -s registry:validate:automation)
```

Attendu : `… projections.registry.json valid`, `… pipelines.registry.json valid`, `OK: 8 pipelines + 2 projections, cross-references bidirectionnels coherents.`, puis `[validate-automation-overlay] ✓ all N entries valid …` avec N = entrées de `main` + 1 (19 si l'entrée du Plan 1 est déjà là). Remplacer `last_verified_at` par la date d'application.

- [ ] **Étape 3 : remise à l'owner et nettoyage**

```bash
git -C "$SCRATCH/l2chk2" status --porcelain=v1 --ignored=matching
cd "$SCRATCH"
rm "$SCRATCH/l2chk2/node_modules"
git -C /opt/automecanik/app worktree remove --force "$SCRATCH/l2chk2"
```

Attendu avant suppression : uniquement les fichiers L2 modifiés (trois, plus ceux du Plan 1 si la première commande les a appliqués) et le lien `node_modules` ignoré. Remettre à l'owner les trois diffs, les sorties des validateurs et la procédure #1622. Passage de `diagnostic_provenance_v1` à un statut actif et de `diagnostic-projection-nightly` à `ACTIVE` : owner, après le premier run nocturne réel (Plan 3, activation du drapeau).

---

## Couverture spec → tâches

| Spec | Exigence | Tâche |
|---|---|---|
| §4.4 | 3 tables, contraintes CHECK (complétude, `failed` ⇒ erreur, 8 raisons), `bigint`, index unique partiel des provenances vivantes | 1 |
| §4.4 | RPC `__diag_projection_apply` : SECURITY INVOKER, verrou consultatif, `FOR SHARE`, `active` re-vérifié, retrait doux, une transaction | 1 |
| §4.4 | RLS `service_role`, droits fermés à `anon` / `authenticated`, `SET LOCAL` des timeouts, rollback manuel | 1, 8 |
| §4.4 | squawk sans exemption, marqueurs, surface DEFINER/anon, gate de propriété | 1 |
| §4.4 | Table servie et RPC publiée déclarées dans le ratchet des écrivains | 1, 5 |
| §4.5 | Pré-validation complète de l'export (index haché, fichiers listés, enveloppes) | 3 |
| §4.5 | Référentiel actif paginé à compte exact | 2 |
| §4.5 | Résolution pure, ordre des contrôles, `raw_proven` recopié, doublons, aucun lien inventé | 4 |
| §4.5 | `guardReadOnly`, gate RPC avec nom littéral, run `failed` tracé, retour RPC validé par Zod, `runtime_env` | 5 |
| §4.5 | Drapeau OFF par défaut, re-vérifié au job, repeatable purgé si OFF, déclenchement admin, test de composition DI | 6 |
| §4.5, §10 | Premier run réel : 3 / 0 / 3 | 9 |
| §4.8 | Registre L2 : projection, pipeline aval, automation | 10 (+ ownership : 1) |
| §4.8 | Script d'environnement PROD (`prod-diagnostic-provenance-env.sh`) | Plan 3 |
| §4.9 | Révision d'ADR-035 (brouillon vault) | 0 |
| §7 | Harnais SQL + 5 mutants ; 59 tests TS + 13 mutants ; ratchet 19 tests | 1-7 |
| §9 étapes 1, 2 (partie projection), 5, 6 | Découpage PR-A / PR-B, application, preuve | 0-10 |
| §4.6, §4.7, §9 étapes 7, 8 | Moteur, drapeaux EXPOSE / PRIMARY, frontend, activation PROD | Plan 3 |
