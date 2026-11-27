# Projet de versement — mandat BR (décision 70)

**Statut : proposé, non appliqué.** Les trois correctifs ci-dessous sont des
fichiers `.patch` posés dans ce dossier. Aucun n'est appliqué au code de la
branche ni de DEV.

Ce projet ne couvre que deux choses :

1. ce qui est **utilisé** et **absent** du dépôt ;
2. l'inscription au registre du 23 des outils du 04 qui sont déjà au dépôt.

Le runtime du robot Telegram n'est pas versé, puisque la décision 70 ne le reprend
pas (voir `../README.md` §4).

| Correctif | SHA-256 | Fichiers touchés | Qui applique | Quand |
|---|---|---|---|---|
| `patch-1-registre.patch` | `16a5137468e8ebc5e915942f7884fd0d65f54f9348290b76df6d17c82924f04c` | `scripts/governance/build-skills-registry.js` | PR ordinaire, décision du 23 | avant le correctif 3 |
| `patch-3-carte-departement-04.patch` | `1655853e588ceee1b552647b51f91fc0f26aa924560051a626c35461f35431a4` | `.spec/00-canon/ai-registry/agent-operating-map.yaml` | **owner seul** (`.spec/00-canon/**`) | après le correctif 1 |
| `patch-2-cache-npm-hermes.patch` | `9f1a0a621b201ea4331468f558348a11ca9cfaa7d7c446a7ec5e51dd99ead964` | `scripts/ops/sync-dev-runtime.sh`, `scripts/test-claude-hooks.sh`, `.claude/rules/deployment.md` | PR ordinaire | **après** l'arrêt de Hermes |

L'ordre d'application est 1, puis 3, puis 2.

## 1. Registre : lire aussi les skills des workspaces

Le générateur existant `scripts/governance/build-skills-registry.js` lit aussi
`workspaces/*/.claude/skills/*/SKILL.md`. Le registre reste unique (décision 13) :
pas de second registre ni de second générateur.

- Chaque entrée de workspace reçoit un champ `workspace`.
- La racine `.claude/skills` passe d'abord, dans le même ordre.
- Un nom de skill en double entre racine et workspace lève une erreur. Rien n'est
  écrasé en silence.

**Preuves** (sur la base `bd1da7ebc9`) :

- `git apply --check` passe.
- Simulation en mémoire du générateur corrigé : 47 skills, dont 22 conformes
  selon les contrôles du générateur. Les 19 entrées racine sont
  identiques au registre commité (comparaison canonique `fast-json-stable-stringify`).
  28 skills de workspaces sont ajoutées, et les 4 `amk-*` du 04 sont conformes.
- Non fait : régénérer le registre commité. Ce sera l'étape suivante de la PR qui
  appliquera le correctif, avec `node scripts/governance/build-skills-registry.js`
  puis `--check`.

## 3. Carte du département 04 (owner seul)

Ce correctif touche le département marketing de `agent-operating-map.yaml`
(`business_number: 4`) :

- il ajoute à `capabilities` les skills `amk-marketing-operations`,
  `amk-marketing-preparation`, `amk-marketing-validation` et `amk-reactivation`,
  ainsi que `marketing-workbench`, avec un commentaire « décision 70, mandat BR » ;
- il ajoute à `declared_capabilities` :
  `{ id: marketing-workbench, type: pipeline, owner: marketing, status: partial, evidence: { scripts: [scripts/marketing/workbench-cli.ts, backend/src/modules/marketing/services/marketing-preparation.ts] } }`.

Un commentaire précise que `scripts/marketing/hermes/` contient les adaptateurs du
profil Hermes, distincts de l'outil.

**Preuves** :

- `git apply --check` passe.
- Simulation des correctifs 1 et 3 avec `buildSnapshot`
  (`scripts/governance/build-command-center-snapshot.js`) : département 04 =
  4 `amk-*` CERTIFIED ; `marketing`, `marketing-backlinks` et `marketing-workbench`
  PARTIAL ; aucune alerte `DROPPED_CAPABILITY`.
- Le registre actuel ne contient pas les 4 `amk-*`. Sans le correctif 1, elles
  ne seraient pas résolues. D'où l'ordre 1 puis 3.

## 2. Cache npm des missions Hermes (après l'arrêt)

Ce correctif retire :

- la fonction `refresh_hermes_npm_cache`, ses variables (`HERMES_NPM_WARM`, …) et
  ses deux appels dans `scripts/ops/sync-dev-runtime.sh` ;
- les cas 16 à 22 de `scripts/test-claude-hooks.sh` (lignes 607-681), le
  commentaire de la ligne 362 et la variable d'environnement de la ligne 366 ;
- le paragraphe correspondant de `.claude/rules/deployment.md` (lignes 101-105).

**Ne pas appliquer avant l'arrêt.** Tant que Hermes envoie des missions, ce cache
leur sert pour `npm` hors ligne : sans lui, les missions d'écriture échouent en
`ENOTCACHED`.

Après l'arrêt, le script et le cache s'archivent ensemble. La fonction actuelle ne
fait rien si les deux sont absents. Elle alerte à chaque passage du cron si un seul
des deux manque.

**Preuves** :

- `git apply --check` passe.
- `bash -n` passe sur les deux scripts corrigés.
- **Non exécuté** : `bash scripts/test-claude-hooks.sh`. Ce test lance des cas
  qui écrivent un dépôt git temporaire et poussent un commit amont, ce qui sort du
  périmètre de lecture de ce mandat. Il est à lancer dans la PR qui appliquera le
  correctif.

## Hors correctif

- **Règles métier du collecteur de supervision**
  (`/opt/automecanik-supervisor/collector.py`, SHA-256
  `6a46bbf81538abfa199b6678d607ac57eefb994afe9ca3c89f4076e7e752ee31`). Ces
  règles n'ont pas d'équivalent dans `backend/` ni dans `scripts/` d'`origin/main` :
  - `orders_open`, `orders_stale`, `orders_payment_review` ;
  - `claims_open`, `claims_urgent`, `claims_stale` ;
  - `refunds_pending`, `refunds_stale`, `refunds_failed` ;
  - `messages_new`, `messages_overdue` ;
  - `blog_total`, `blog_missing_title` ;
  - `seo_interpolation`, `database_target_mismatch`.

  Seule la fraîcheur GA4 a un équivalent (`collection-freshness-action.rules.ts`).
  Verser le collecteur tel quel créerait une source concurrente au Command Center.
  **Proposé** : décision de l'owner, puis mandat séparé pour transcrire ces règles
  en règles d'action du Command Center. Plusieurs touchent les commandes et les
  remboursements, donc une zone STOP.
- **Travaux des worktrees de mission.** Il s'agit des commits hors `origin` de
  `391789eb` et `be911d64` et des fichiers non commités de `8b62c17a`, `44dbbf71`
  et `d44d15d8`. Ils sont à préserver par un bundle hors dépôt (`../README.md` §5).
  Leur versement éventuel relève d'un mandat par sujet. `d44d15d8` touche le SEO
  indexé.
- **Digest du Command Center.** Le garder ou le retirer est une décision de
  l'owner, prise après l'arrêt (`../README.md` §6, ligne 4). Aucun correctif n'est
  préparé, car c'est du code en service.

## Vérifier un correctif

```
sha256sum patch-*.patch           # comparer au tableau ci-dessus
git apply --check <correctif>     # sur une base à jour
```
