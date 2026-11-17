# Mandat BB — attente des contrôles : relevé, réductions, options

Décisions 107, 113 et 114 de l'owner. Dépôt `ak125/nestjs-remix-monorepo`. Mesures du 2026-11-16,
heures en UTC : collecte Actions à 22:34:29Z, PR à 22:41:15Z, compléments de 22:52Z à 23:53Z, sur
l'arbre `0e2d0e7ed4db86a71111cb3f2abaa533328b2693`. Branche remise à jour à 23:50Z sur `origin/main`
`3832abfc2b3b0cf0259b9a05ba9da6aef18ab082` : les six correctifs s'y appliquent aussi.

Aucune protection n'est modifiée par cette PR. Elle n'ajoute que ce dossier : le rapport, six
correctifs `.github/` non appliqués, deux scripts proposés et non installés, les scripts de mesure.
Les gestes de l'owner sont dans [`commandes-owner.md`](commandes-owner.md).

## 1. Réponse courte

Les contrôles ne sont pas le poste principal. Un passage dure 6,3 min en médiane (p90 8,2). Entre le
dernier contenu poussé et la fusion, il s'écoule 39 à 345 min en médiane selon le jour. L'écart vient
de trois choses : la règle « branche à jour » rejouée à chaque fusion, l'approbation de l'owner sur
la tête exacte, et les gestes d'ownership.

39 des 49 PR fusionnées depuis le 13 novembre relèvent du circuit élevé (§6). Le train automatique
des circuits faible et moyen ne concerne donc qu'une PR sur cinq. Le rapport court BB-3 le plaçait
en tête sans cette mesure : le classement ci-dessous la prend en compte.

### Gains, par ordre décroissant

| # | Levier | Gain sur l'attente | Gain en minutes-job | État |
|---|---|---|---|---|
| 1 | Aucun resync d'entretien : seul le train met une PR à jour, au moment de fusionner | supprime les relances sans suite qui remplissent la file | ≈ 590 par jour (55 passes sans suite en 4 jours, ≈ 43 par tête) | consigne de pilotage, décision de l'owner |
| 2 | Train ordonné des circuits faible et moyen | 7,8 à 9,2 min par PR en retard, 2 min si elle est à jour, sans geste ; aujourd'hui 14 à 28 min entre deux fusions | — | scripts proposés dans cette PR, non installés ; 10 PR sur 49 concernées |
| 3 | Cache npm de 3,9 Go des jobs du runner self-hosted de l'hôte PROD | ≈ 9,3 min sur un cycle `main` de 42,3 min ; ≈ 3 min par run `release-prod.yml` | ≈ 90 par jour | correctifs 02 et 02b |
| 4 | Jest à deux workers dans `🧪 Backend Tests` (chemin critique) | 0,6 à 1 min par passage, estimé | ≈ 60 par jour | correctif 03, à juger sur son propre run |
| 5 | Rapports de mandat sous `docs/audit/` ; journal lisible de la porte des fichiers nouveaux | 7 des 14 fichiers refusés n'auraient demandé aucun geste ; PR débloquées après 0,2 à 3,3 h, 7 encore en brouillon | — | convention ; correctif 05 |
| 6 | Classer trois inventaires générés aujourd'hui sans glob | 3 PR sur 49 passent du circuit élevé au circuit moyen ; `audit/db-usage-map.json` est modifié par 17 PR sur 49 | — | décision de l'owner (`ownership.yaml`), extrait proposé |
| 7 | Cache npm vide des jobs hébergés | ≈ 10 s par installation, 13 installations par tête | ≈ 100 par jour | correctif 01, puis suppression de deux caches |
| 8 | Capacité payante | file : médiane 0,03 min, p90 1,1, max 4,4 | 632 min-job d'attente cumulée le 16 | ne rien payer (§5) |
| 9 | Annulation des runs dépassés | aucun | ≈ 9 par jour | correctif 04 |
| 10 | Relances de la porte DoD | aucun | ≈ 8 par jour | rien à changer (§8) |

Les lignes 3, 4, 7 et 9 allègent la charge. Elles raccourcissent peu l'attente d'une PR : le chemin
critique passe de 5,3 min à 4,7 min au mieux (`audit.yml` devient le plus long).

## 2. Relevé

### 2.1 Les 14 contrôles requis

Lus à 23:37:13Z par
`gh api repos/ak125/nestjs-remix-monorepo/branches/main --jq '.protection.required_status_checks'`
(`enforcement_level: everyone`). La lecture complète de la protection répond 403 au jeton de la
machine DEV ; « strict » est déduit de l'état `BEHIND` des PR en retard.

Durées sur 60 runs de PR par workflow (2026-11-15T15:48Z → 2026-11-16T22:25Z), en minutes.

| Contrôle requis | Workflow | Médiane | p90 | Max |
|---|---|---|---|---|
| `🧪 Backend Tests` | `ci.yml` | 5,3 | 6,4 | 7,1 |
| `🔬 CodeQL Scan (javascript-typescript)` | `codeql.yml` | 3,8 | 4,6 | 4,8 |
| `🧪 Frontend Tests` | `ci.yml` | 3,6 | 4,6 | 4,9 |
| `⬣ ESLint` | `ci.yml` | 3,4 | 4,1 | 4,2 |
| `ʦ TypeScript` | `ci.yml` | 3,1 | 3,8 | 4,2 |
| `🔒 Core Build Only` | `ci.yml` | 2,5 | 3,0 | 3,2 |
| `🔐 Secrets Detection` | `ci.yml` | 2,1 | 2,6 | 2,8 |
| `🔒 Security Audit` | `ci.yml` | 1,7 | 2,0 | 2,1 |
| `🗄️ Migration Safety` | `ci.yml` | 0,3 | — | — |
| `🧾 DoD self-evaluation present` | `pr-dod-gate.yml` | 0,2 | 0,3 | 0,5 |
| `🛡️ ADR-010 Governance`, `🛡️ Import Firewall`, `🛡️ RPC Safety Gate` | `ci.yml` | 0,1 | — | — |
| `🔒 DEV Safety (Blocking)` | `validator-dev-safety-observe.yml` | 0,1 | 0,2 | 0,2 |

Run `ci.yml` de PR : 52 succès, 4 annulés, 4 échecs ; durée mur 6,3 min en médiane, p90 8,2, max
9,1 ; 23,5 min-job par run. Le job le plus long est `🧪 Backend Tests` dans 50 runs sur 56. Ses
étapes, en médiane : tests 144 s, installation 93 s, build 46 s. Le contrôle non requis le plus long
est `audit.yml` (4,7 min, p90 5,3).

Temps en file par job : médiane 0,25 à 0,39 min, p90 1,8 à 2,5, max 4,4.

### 2.2 `main`

60 runs `ci.yml` sur push `main` (2026-11-12T14:21Z → 2026-11-16T22:32Z) : 42 succès, 16 annulés.
Durée mur 42,3 min en médiane, p90 60,1, max 72,9 ; 56,2 min-job par run. Jobs longs : E2E Smoke
15,6 min, Lighthouse 8,1, Backend Tests 6,1, Deploy PREPROD 5,5, Build 3,5. Ce run porte la chaîne
PREPROD (pile de CI de l'hôte PROD, port 3200). Pushes `main` par jour du 13 au 16 : 13, 16, 13, 10,
dont 4, 3, 4, 2 annulés par la fusion suivante.

### 2.3 De « PR prête » à « fusionnée »

48 PR fusionnées depuis 2026-11-13T12:00Z (11, 14, 13 et 10 par jour). Médianes par jour, en minutes.

| Intervalle | 13-11 | 14-11 | 15-11 | 16-11 |
|---|---|---|---|---|
| Dernier push → tous les checks finis | 10,6 | 7,2 | 6,5 | 6,5 |
| Checks finis → fusion | 0,2 | 1,2 | 1,8 | 2,8 |
| Checks finis → fusion, p90 | 0,4 | 450 | 43 | 31 |
| Dernier contenu → fusion | 345 | 59 | 102 | 39 |
| Création → fusion | 364 | 617 | 283 | 74 |
| Intervalle entre deux fusions | 14 | 28 | 17 | 28 |
| PR avec au moins un resync | 11/11 | 8/14 | 9/13 | 7/10 |

### 2.4 Relances dues à « branche en retard »

Sur 4 jours, 255 passes `ci.yml` de PR, dont 90 sur une tête de resync : 35 % (29/75, 31/61, 20/71,
10/48). 35 de ces 90 passes sont la tête qui a été fusionnée. Les 55 autres n'ont servi à rien : la
branche est repassée en retard avant la fusion. Une tête coûte ≈ 43 min-job tous workflows
confondus, soit ≈ 590 min-job par jour.

Une tête de resync est reconnue par le titre de son commit (`Merge origin/main`,
`Merge branch 'main'`, régénération de l'inventaire, couverture d'ownership) : expression dans
[`scripts/mesure/timeline.py`](scripts/mesure/timeline.py).

Le train du 15 novembre donne le coût d'un passage ordonné : #2085 9,2 min (1,9 de régénération,
7,0 de contrôles, 0,4 de fusion), #2083 7,8 min, #2084 et #2086 déjà à jour 2,0 et 2,2 min. Deux
arrêts le même jour : 78 min perdues sur #2085, 44 min sur #2086 (contrôle DoD requis rouge).

### 2.5 Annulations, volume, minutes

- Runs annulés le 16 : 24, pour 91 min-job dépensées avant l'annulation. Runs poursuivis sur une
  tête dépassée : 27 têtes, 9 min-job.
- Runs par jour du 13 au 16 : 1939, 1667, 1512, 1190.
- Minutes-job du 16 (jusqu'à 22:34Z) : 2725, dont 2491 sur runners hébergés et 234 sur le runner
  self-hosted de l'hôte PROD. `ci.yml` PR 1095, `ci.yml` push 395, `codeql.yml` PR 186,
  `audit.yml` 168. Estimation des 13, 14 et 15 aux moyennes du 16 : ≈ 4456, 3978, 3714.
- Ces minutes ne sont pas facturées (dépôt public). La contrainte est le plafond de jobs simultanés.

### 2.6 Écarts avec le constat du pilotage

| Constat transmis | Mesure |
|---|---|
| ≈ 20 min de contrôles par passage | 6,3 min en médiane ; 14 à 28 min est l'intervalle entre deux fusions |
| 172 runs en file | 184 à 23:12:19Z, dont 169 créés le 2026-11-11 entre 20:26Z et 20:50Z, sans job, sur 4 branches de PR fusionnées (#2004, #2014, #2015, #2016). File réelle : 15 runs. Recompté à 23:40:18Z : mêmes 169 |
| ≈ 35 workflows par événement | 17 à 24 runs par tête en médiane, 30 à 32 au maximum |
| 4 PR ventes bloquées 15 h | 7 PR en brouillon bloquées par la porte des fichiers nouveaux ; #2088 et #2096 sont les deux que j'ai pu rattacher aux ventes |
| 38 processus claude, 183 worktrees | 48 et 182 à 23:09Z ; mémoire 10 Go sur 15, disque 85 % |
| Circuits pas encore actifs | actifs : #2109 (circuit faible) a été armée à 22:17:04Z et fusionnée à 22:21:34Z par l'App `automecanik-actions`, sans geste de l'owner |

## 3. Causes, réductions, risques

| Cause d'attente | Réduction | Gain estimé | Risque | Suite |
|---|---|---|---|---|
| « Branche à jour » : chaque fusion met les autres PR en retard, et un resync fait à l'avance est perdu | Resync par le train seul, au moment de fusionner (§6) | ≈ 590 min-job par jour ; file moins pleine | aucun pour la protection ; une PR ouverte reste en retard jusqu'à son tour | décision de l'owner |
| Circuit élevé : l'approbation porte sur la tête exacte, un resync la rend caduque | Classer les inventaires générés sans glob (§7) ; approuver juste après le resync (§6) | 3 PR sur 49 passent au circuit moyen | un classement trop bas enverrait un fichier sensible en circuit faible : valeurs à valider une par une | décision de l'owner |
| Fusion des PR prêtes une par une, à la main | Train ordonné des circuits faible et moyen (§6) | 7,8 à 9,2 min par PR, sans geste | pousse sur des branches de PR ; réservé à l'owner, jamais lancé par un agent | décision de l'owner |
| Chaque job self-hosted retélécharge 3,9 Go de cache npm (≈ 185 s) puis installe en 26 à 28 s depuis le cache local | Désactiver le cache de `setup-node` sur ces jobs | 9,3 min par cycle `main` | nul sur le résultat : le cache local du runner sert déjà l'installation | correctif 02 ; 02b pour `release-prod.yml` |
| Jest tourne sur un seul worker depuis le 2026-02-26 (runners de 7 Go à l'époque ; 16 Go aujourd'hui) | `--maxWorkers=2` | 0,6 à 1 min sur le chemin critique | mémoire : 2 × 4 Go sur 16 Go ; tests sensibles à l'ordre | correctif 03, PR séparée |
| Un fichier nouveau hors glob bloque la PR jusqu'au geste de l'owner ; le journal du job ne nomme pas le fichier | Convention `docs/audit/mandat-xx/` ; fichiers refusés écrits dans le journal | 7 fichiers sur 14 sans geste ; diagnostic immédiat | aucun : le verdict de la porte est inchangé | convention ; correctif 05 |
| Les jobs hébergés restaurent un cache npm vide de 882 octets | Les jobs sans installation ne sauvegardent plus de cache ; suppression de l'entrée vide | ≈ 10 s par installation | fenêtre sans cache entre la suppression et le premier run `main` | correctif 01, puis suppression |
| 38 workflows de PR sans annulation des runs dépassés | `concurrency` sur 8 workflows non requis | 9 min-job par jour | aucun contrôle requis touché | correctif 04 |
| Installation passée de ≈ 58 s à ≈ 95-104 s le 2026-10-31 | Les journaux des runs 41145669476 et 41252525258 montrent l'image `ubuntu-24.04` puis `ubuntu-26.04` ; les runs portent l'annotation « The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026 » | ≈ 40 s par installation | figer une image demande une preuve que je n'ai pas | écarté pour l'instant (§9) |

## 4. Charge par PR

- 53 workflows réagissent à une PR : 14 sans filtre de chemin, 39 avec. 38 n'ont pas de bloc
  `concurrency`.
- Runs par tête du 13 au 16 : médiane 23,5, 24, 17, 20 ; p90 27, 27, 25, 27 ; max 30, 30, 32, 30.
- Minutes-job du 16 par workflow, avec la part des têtes où il tourne : `ci.yml` 1095 (98 %),
  `codeql.yml` 186 (98 %), `audit.yml` 168 (73 %), `registry-new-file-gate.yml` 89 (98 %),
  `governance-checks.yml` 76 (80 %), `contract-gate` 74 (98 %), `registry-fresh.yml` 50 (39 %),
  `spec-validation.yml` 44 (45 %), `dependency-graph-validate.yml` 43 (98 %), `merge-circuits.yml`
  32 (41 %), `registry-build.yml` 32 (29 %), puis 16 workflows sous 30 min-job chacun.
- Une tête installe les dépendances 13 fois en médiane (21 au maximum) : 18,1 min sur 42,5 min-job,
  soit 44 %. C'est le premier poste de charge.
- Jobs de moins d'une minute hors `ci.yml` : 704 jobs, 254 min-job le 16.

Ce que je propose : les correctifs 01 (cache) et 04 (annulation). Ce que je n'ai pas transformé en
correctif : regrouper les contrôles non requis en un seul run à installation unique. Le gain serait
de l'ordre de 10 min-job par tête, sans effet sur le chemin critique. Le coût est une réécriture de
workflows que je ne peux ni pousser ni exécuter depuis la machine DEV : à faire par étapes, chacune
vérifiée sur un run réel.

Filtrer par chemin un workflow requis n'est pas une option : GitHub laisse alors le contrôle en
« Pending » et la PR ne peut plus fusionner. Sauter le job par `if` le fait passer vert sans rien
vérifier : c'est un contournement.

## 5. Capacité

- Le 16, les runners hébergés ont porté jusqu'à 21 jobs simultanés et sont restés 27 min à 20 ou
  plus. Sur 1844 jobs : file médiane 0,03 min, p90 1,12, p99 2,93, max 4,4 ; 202 jobs ont attendu
  plus d'une minute ; 632 min-job d'attente cumulée.
- Documentation GitHub relue le 2026-11-17 : jobs simultanés des runners hébergés standard, Free 20,
  Pro 40, Team 60, Enterprise 500, comptés « across all repositories in your user or organization
  account ». Le plan du compte `ak125` n'est pas lisible avec le jeton de la machine DEV. Le plafond
  observé correspond à Free.
- Pro : la page lue ne donne pas le prix ; il est dans les réglages de facturation du compte. Le
  gain est borné par la file : au plus ≈ 1 min au p90, pendant les 27 min de saturation du jour.
- Team (« $4USD per user / month ») et les larger runners (« only available for organizations and
  enterprises », « not free for public repositories » : 0,012 $ par minute pour 4 cœurs Linux)
  demandent une organisation : exclus par la décision 114.
- Runner auto-hébergé pour les jobs de PR : GitHub écrit « self-hosted runners should almost never
  be used for public repositories », parce que « any user can open pull requests against the
  repository and compromise the environment ». Les runner groups, qui limiteraient son usage,
  n'existent que pour une organisation. La machine DEV n'a pas de marge (mémoire, disque). L'hôte
  PROD porte déjà un runner, réservé aux jobs de `main` : y exécuter du code de PR l'exposerait.
  Les runners hébergés d'un dépôt public ont 4 cœurs et 16 Go : un runner dédié ne serait pas plus
  rapide.

Recommandation : ne rien payer et n'ajouter aucun runner. Réduire d'abord la charge (lignes 1, 3,
7, 9 du tableau). Revoir si le p90 de file dépasse 3 min sur une journée.

## 6. Coût de « branche à jour » sans la retirer

### Ce qui existe

- `merge-pr.sh` et `merge-train.sh` (hôte DEV, lancés par l'owner) : resync, attente de tous les
  checks, fusion épinglée sur la tête, arrêt à la première PR en échec.
- `merge-circuits.yml` : pose le label `circuit:faible|moyen|eleve`. Son job `🔐 Armement` arme la
  fusion automatique par l'App `automecanik-actions` quand le verdict est acquis : toujours en
  circuit faible, sur GO de la revue Claude en circuit moyen. En circuit élevé il désarme et exige
  l'approbation de l'owner sur la tête exacte.
- Le check `🚦 Circuit de fusion` est rouge tant que ce verdict manque. Sur les 12 derniers runs
  (23:03Z à 23:34Z) : 8 échecs, 2 annulés, 1 succès, 1 en attente d'approbation. Ce n'est pas une
  panne.

### Ce qui manque

Avec « strict », une PR armée mais en retard ne fusionne pas : il faut un push de resync, qui relance
les contrôles et l'armement. Personne ne le fait dans l'ordre.

### Répartition des circuits

Classement par `scripts/ci/merge-circuit.mjs --pr <n>`, arbre `3832abfc2`, à 23:52:28Z
([`scripts/mesure/circuits.sh`](scripts/mesure/circuits.sh)). Une PR de plus qu'au §2.3 : #2095,
fusionnée à 23:46:05Z.

| Ensemble | Faible | Moyen | Élevé |
|---|---|---|---|
| 49 PR fusionnées depuis le 13-11 | 3 | 7 | 39 |
| 19 PR ouvertes hors brouillon | 2 (#2062, #1943) | 1 (#1926, en conflit) | 16 |

Motifs du circuit élevé sur les 39 : zone CODEOWNERS dans 22, risque élevé dans 20, fichier non
classé dans 25. 6 PR ne sont en circuit élevé que pour un fichier non classé : #2044, #2052, #2065
(inventaires générés, §7), #2045, #2064, #2108.

Le circuit élevé est donc le cas courant, et il est voulu : 22 PR touchent une zone réservée, 20 un
fichier à risque élevé. Pour elles, l'attente est celle de l'owner.

Limite : le classement lit l'ownership d'aujourd'hui, pas celui du jour de chaque PR.

### Proposition

1. Consigne : aucun resync d'entretien. Une PR prête attend son tour ; seul le train la met à jour.
   Exception : un conflit. Les consignes de pilotage vivent dans le Space, pas dans ce dépôt.
2. [`scripts/train-preflight.sh`](scripts/train-preflight.sh), lecture seule : dit avant le départ
   quelles PR partiront et lesquelles arrêteront le train, et pourquoi (brouillon, conflit, contrôle
   requis rouge, circuit). Les deux arrêts du 15 novembre (122 min) étaient lisibles avant le départ.
3. [`scripts/train-circuits.sh`](scripts/train-circuits.sh), proposition non installée : pour chaque
   PR de circuit faible ou moyen, dans l'ordre, `resync-pr.sh` puis attente de la fusion armée par
   le workflow. Il n'appelle jamais `gh pr merge`, n'arme rien, et s'arrête à la première PR qui ne
   fusionne pas. Le mode `--run` est refusé dans une session d'agent.
4. Circuit élevé : rien ne remplace l'owner après le resync. Deux gestes existent déjà. Soit
   `merge-pr.sh`, qui resynchronise, attend les contrôles et fusionne en un lancement : #2108, #2110
   et #2111 ont été fusionnées par l'owner, sans avis enregistré. Soit une approbation sur la tête à
   jour : #2095, approuvée à 23:45:02Z, fusionnée à 23:46:05Z.

Regrouper plusieurs PR de documentation en une seule évite N−1 passes de ≈ 9 min. Le lot prend le
circuit le plus élevé de ses fichiers et perd un commit par PR : à réserver à la documentation.

### Essais

`train-preflight.sh --prs 2109 2063 2076 2117` à 23:39:08Z : #2109 fusionnée, #2063 écartée (contrôle
requis DoD rouge), #2076 prête et en retard, #2117 écartée (DoD, circuit). `train-circuits.sh` en
mode plan sur #2109 et #2076 : s'arrête sur #2076, sans label de circuit. Le mode `--run` répond
« refus : --run est réservé à l'owner ». Aucun push, aucune fusion. Le mode `--run` n'a jamais été
exécuté. `bash -n` passe ; `shellcheck` n'est pas installé sur la machine DEV.

## 7. Goulot ownership

- Porte `registry-new-file-gate.yml` sur 4 jours : 253 runs, 17 échecs, 11 branches touchées sur 75.
  3 débloquées après 1,2 h (#2100), 3,3 h (#2106) et 0,2 h. 8 encore rouges.
- 7 PR en brouillon, 14 fichiers refusés : 6 rapports ou audits Markdown et 1 patch d'audit, 3
  définitions d'agents (`.claude/agents/`), 2 migrations, 1 fichier de code, `skills-lock.json` (2 PR).
- `ownership.yaml` : 15 commits sur 228 sur `main` depuis le 2026-10-17, 4 sur 107 depuis le 11-09.
- Couverture de l'arbre : 5880 fichiers suivis, 673 en exception, 4138 couverts, 1069 sans glob.
  Zones les moins couvertes : migrations 220 sur 444, `backend/src/modules` 89 sur 1273,
  `.spec/features` 34 sur 34, `frontend/app/services` 33 sur 33.

Un fichier non classé coûte deux fois : il bloque la PR qui le crée, puis il envoie en circuit élevé
toute PR qui le modifie. Le second coût se mesure : `audit/db-usage-map.json`, inventaire généré, est
modifié par 17 des 49 PR fusionnées et n'a pas de glob, comme `audit/registry/db.json` (3 PR) et
`audit/registry/runtime.json` (2 PR). Leurs voisins `audit/registry/files.json`,
`audit/module-boundaries.json` et `audit/runtime-entrypoints.json` sont classés D15, risque faible.
Simulation sur les 49 PR avec ces inventaires classés de la même façon : 39 en circuit élevé
deviennent 36, 7 en circuit moyen deviennent 10 (#2044, #2052, #2065).

Sans toucher à la règle :

1. Rapports et audits de mandat sous `docs/audit/mandat-xx/`, déjà couvert (`docs/audit/**`, D15,
   risque faible). 7 des 14 fichiers refusés étaient dans ce cas.
2. Correctif 05 : la porte écrit les fichiers refusés dans le journal du job. Verdict et code de
   sortie inchangés.

Option pour l'owner : [`options/ownership-globs.yaml`](options/ownership-globs.yaml), extrait non
appliqué, en deux parties : les inventaires générés ci-dessus, puis des globs de dossier pour les
fichiers nouveaux. La résolution prend le glob le plus long : un glob de dossier sert de valeur par
défaut et les entrées précises gardent la main. Les migrations restent en circuit élevé dans tous
les cas (zone CODEOWNERS).

## 8. Porte DoD

Le 16 : 90 runs pour 49 têtes, 41 en surplus, 0,2 min chacun, soit ≈ 8 min-job. Dernier run par
tête : 27 succès, 20 échecs, 1 annulé (dependabot), 1 en attente d'approbation.

Les relances viennent des gestes que la porte doit lire : corps de PR, assigné, label, approbation.
Réduire ses déclencheurs lui ferait rendre un verdict périmé. Rien à changer.

## 9. Écarté

| Piste | Motif |
|---|---|
| Organisation GitHub, file de fusion | décision 114 |
| Retirer « strict », retirer un contrôle requis | règle du mandat |
| Filtre de chemin ou `if` sur un contrôle requis | « Pending » bloquant, ou vert sans vérification |
| Approbation du circuit élevé conservée après un resync | l'approbation ne porterait plus sur la tête que GitHub connaît |
| `cancel-in-progress` sur `codeql.yml` et DEV Safety | contrôles requis ; `merge-pr.sh` s'arrête sur une annulation |
| Ne plus retester sur `main` ce qui a été testé sur la PR | ≈ 260 min-job par jour, aucun gain sur l'attente d'une PR ; change le signal « `main` verte » qui précède la chaîne PREPROD |
| Cache turbo pour lint et typecheck | risque de rejouer un vert périmé |
| Raccourcir `session-store.test.ts` (22,9 s) | ses délais sont ceux de la production |
| Figer l'image `ubuntu-24.04` | cause de la hausse du 31-10 non prouvée |
| Réduire les déclencheurs de la porte DoD | §8 |
| Runner auto-hébergé pour les PR, larger runners, plan payant | §5 |
| Modifier `scripts/registry/check-new-files.js` | fichier réservé (CODEOWNERS) |

## 10. Livré, et ce qui attend l'owner

Dans cette PR, sous `docs/audit/mandat-bb-20261116/` :

- ce rapport et [`commandes-owner.md`](commandes-owner.md) ;
- [`patches/`](patches/) : six correctifs `.github/`, non appliqués ;
- [`scripts/train-preflight.sh`](scripts/train-preflight.sh),
  [`scripts/train-circuits.sh`](scripts/train-circuits.sh) : proposés, non installés ;
- [`scripts/fabrique-patches.py`](scripts/fabrique-patches.py) et [`scripts/mesure/`](scripts/mesure/) :
  fabrication des correctifs et requêtes de mesure ;
- [`options/ownership-globs.yaml`](options/ownership-globs.yaml) et [`pr/`](pr/) : extrait proposé,
  corps des PR de correctifs (deux, et une troisième pour le 02b).

Rien d'autre n'est modifié : aucun workflow, aucun fichier réservé, aucune protection.

| Attend l'owner | Nature |
|---|---|
| Correctifs 01, 02, 04, 05 puis 03 : deux PR depuis son poste | geste, bloc unique |
| Correctif 02b (`release-prod.yml`) : troisième PR, par un interrupteur du même bloc, livré éteint | accord nominatif : chaîne PROD |
| Suppression des deux caches npm, après fusion de la première PR | geste, même bloc |
| Annulation des 169 runs fantômes du 11 novembre | geste, même bloc |
| Consigne « aucun resync d'entretien » | décision |
| Installation et usage de `train-circuits.sh` | décision |
| Entrées d'ownership : trois inventaires générés, puis des globs de dossier | décision, fichier réservé |
| Plan Pro | paiement, non recommandé |

## 11. Preuves

### Empreintes des correctifs (sha256)

```
43dfda38dfb387396aa1f5f47caf6c6a5a30741155732623e3049fef9a840618  01-cache-npm-jobs-heberges-sans-installation.patch
66c1a67e2bcccb1d2374c57c6dff2f9326533e5a86d557ea3f85c6accae99c99  02-cache-npm-jobs-self-hosted.patch
1b0fee7586c400daf1ed8b3e03ca72c0508792626612baa3da37f7b185297b6a  02b-cache-npm-release-prod.patch
94c04a42fd18e46d7e9ca6b0bba7b0af139f99742a69a79ff1a50d4adf38a2e3  03-backend-tests-deux-workers.patch
198a58073fd3cf15d3ed867746af2692627c3ab89d19478b82fe109d5da09028  04-annulation-runs-depasses.patch
a11d3486d249fa4fca3fbd1d5afe7381059308aba283d94f93617cb0245ab639  05-porte-fichiers-nouveaux-journal.patch
```

| Correctif | Fichiers | Lignes | Contenu |
|---|---|---|---|
| 01 | 4 | +4 | `package-manager-cache: false` sur les jobs hébergés qui n'installent rien (`dependency-registry-freshness.yml`, `pr-dod-gate.yml`, `pilote-file.yml`, `rag-proposals-validate.yml`) |
| 02 | 3 | +6 −3 | même réglage sur les jobs self-hosted de `ci.yml` (deploy, e2e-smoke, lighthouse), `prod-smoke-tests.yml`, `visual-gate.yml` |
| 02b | 1 | +1 | même réglage dans `release-prod.yml` |
| 03 | 1 | +1 −1 | `--maxWorkers=1` → `--maxWorkers=2` dans `🧪 Backend Tests` |
| 04 | 8 | +32 | bloc `concurrency` avec `cancel-in-progress` sur 8 workflows non requis |
| 05 | 1 | +8 −1 | la porte des fichiers nouveaux écrit les fichiers refusés dans son journal |

### Vérifications faites

- `git apply --check` passe pour chaque correctif et pour les six ensemble sur `0e2d0e7ed`, et pour
  chacun sur `3832abfc2`. Les trois lots du bloc de l'owner (01+02+04+05, 03, 02b) s'appliquent sur
  `3832abfc2` dans un index temporaire à 23:58:37Z : 15 fichiers, 1 fichier, 1 fichier, tous sous
  `.github/workflows/`.
- Les 16 workflows modifiés restent du YAML valide. Noms, `if`, `needs`, `runs-on`, nombre d'étapes
  et déclencheurs sont identiques. Seule clé ajoutée : `concurrency`, sur les 8 fichiers du
  correctif 04. Les 11 contrôles requis de `ci.yml` gardent leur nom.
- Correctif 05, sur un script factice : cas accepté, sortie 0 ; cas refusé, une ligne `::error` par
  fichier et sortie 1 ; erreur du script, sortie 2.
- 9 tests `node --test` de câblage, sur une copie de la base et une copie corrigée : 216 tests, 215
  réussis et 1 échec dans les deux cas. L'échec est le même (`preprod-image-proxy.test.mjs`, fichier
  `config/caddy/Caddyfile` absent de la copie partielle) et ne dépend pas des correctifs.
- Aucune garde (`scripts/`, `.husky/`, `.ast-grep/`) ne lit `maxWorkers=1`, `package-manager-cache`
  ou `cache: "npm"`.

### Non vérifié

- Aucun correctif n'a tourné dans GitHub Actions : le jeton de la machine DEV ne pousse pas de
  workflow. Les gains des lignes 3, 4, 7 et 9 sont des estimations. La mesure se fait sur le premier
  run de chaque PR de correctifs (commandes dans `commandes-owner.md`).
- Jest à deux workers n'a pas été mesuré en local : la machine DEV était chargée.
- `actionlint` et `shellcheck` ne sont pas installés sur la machine DEV.
- Le bloc PowerShell n'a pas été exécuté : la machine DEV n'a pas de PowerShell.
- Le plan du compte et le prix de Pro ne sont pas lus.

### Requêtes de mesure

`scripts/mesure/fetch.py` collecte par `gh api` (lecture seule) : 60 runs par workflow et par
événement, tous les runs du 13 au 16 par fenêtres de 6 h, les jobs des échantillons et ceux du 16.
`analyze.py` produit les durées, files, annulations et minutes ; `timeline.py` la chronologie par PR
et la porte DoD ; `bb2.py` la charge par tête et la porte des fichiers nouveaux ;
`ownership-coverage.cjs`, `refused.cjs` et `zones.cjs` la couverture d'ownership ; `image.py` et
`before.py` l'historique de l'installation ; `circuits.sh` la répartition des circuits.
