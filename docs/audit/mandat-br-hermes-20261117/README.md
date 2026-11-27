# Mandat BR : passation de Hermes (décision 70), inventaire et dépendances

Mandat du département 23, 17 novembre 2026. Inventaire en lecture seule de tout ce
qui appartient à Hermes, sur le VPS DEV et dans le dépôt. Il prouve que rien ne se
perd et donne la liste exacte de ce qui dépend encore de Hermes, pour que Marwane
sache quand il peut l'arrêter.

| | |
|---|---|
| Session | tmux `mandat-br`, Claude CLI |
| Worktree | `~/worktrees/claude-br-passation-hermes-20261117` |
| Branche | `docs/mandat-br-passation-hermes` |
| Base | `origin/main` = `bd1da7ebc904be7971cd0e8e9b21c5f035077c44` |
| Relevés | inventaire 2026-11-17T22:12:52Z → 22:13:37Z ; worktrees de mission 22:13:34Z ; fichiers non commités des missions 22:21:59Z ; dépôt 22:17:14Z ; recherches 6.1 22:24:01Z |

Trois statuts sont séparés dans tout le document :

- **Observé** : relevé sur DEV ou dans le dépôt, avec sa source et son heure.
- **Proposé** : sort, changement ou correctif soumis à décision. Rien n'est appliqué.
- **Appliqué** : seulement l'ajout de ce dossier par une PR brouillon. Aucun fichier
  de DEV n'a été déplacé, supprimé, arrêté ou relancé. Aucun code en service n'est
  modifié. Voir §9 pour l'unique effet de bord observé.

## 1. Résultat en bref

| État | Constat |
|---|---|
| Implémenté | Inventaire de 50 lieux hors dépôt : 57 130 fichiers, 3 405 708 306 octets, empreintes recalculées. Relevé séparé des 25 worktrees de mission. 3 correctifs préparés, non appliqués. |
| Intégré | Rien. Les correctifs ne sont pas appliqués au code. |
| Vérifié | Les correctifs s'appliquent sur `bd1da7ebc9` (`git apply --check`). La simulation en mémoire des correctifs 1 et 3 résout les 4 skills du 04 dans le snapshot du Command Center, sans alerte `DROPPED_CAPABILITY`. Le correctif 2 n'est pas exécuté (§ projet de versement). |
| Opérationnel | Non applicable : ce mandat ne change rien en service. |
| Bloqué | Le profil Hermes et le robot Telegram sont hors de DEV (§2). Leur contenu n'est pas inventorié. |

Hermes ne peut pas être arrêté puis nettoyé sans perte aujourd'hui :

- 19 commits ne sont sur aucune branche d'`origin`. Ils sont répartis entre 3 worktrees de mission.
- 12 worktrees de mission ont des fichiers non commités (§5).

Il faut les préserver avant tout nettoyage. Les dépendances à lever sont listées
au §6.

## 2. Emplacement du profil Hermes et du robot Telegram (6.1)

**Observé : hors de DEV, contenu inconnu.** On s'arrête sur ce point, sans accès
à l'hôte Hermes.

Recherches faites sur DEV le 2026-11-17 à 22:24:01Z, toutes négatives :

- `/home/hermes` absent ;
- utilisateur `hermes` absent ;
- `~/.hermes` absent ;
- aucun répertoire `orchestration-automecanik-pilot` jusqu'à la profondeur 6 de `/` ;
- `/opt/codex-project-tools` absent ;
- aucun processus `hermes` ou `telegram` ;
- aucune unité système ;
- aucune ligne de crontab ;
- aucun conteneur.

Une seule unité utilisateur existe : une unité transitoire de labo, en échec depuis le 04/10.

Dernier état connu, lu depuis DEV dans
`~/hermes-review-closure-20261015/host-hermes-verification.json` (relevé de l'hôte
Hermes du 2026-10-14T23:11:20Z, 33 jours avant ce mandat) :

- profil : `/home/hermes/.hermes/profiles/orchestration-automecanik-pilot` ;
- runtime : `/home/hermes/.hermes/hermes-agent`, plugin `codex-automecanik-control` ;
- robot Telegram : `/opt/codex-project-tools/telegram-control-1.0.0/broker.py` ;
- orchestrateur : `/opt/codex-project-tools/hermes-orchestration-0.1.1/hermes_orchestrator.py` ;
- sauvegardes : `/var/backups/hermes-specialists/`.

Le README marketing du dépôt situe aussi sur cet hôte la release
`automecanik-marketing-dev-1.0.0`, le `bounded-terminal-20260930` et l'export
`…/orchestration-automecanik-pilot/workspace/marketing-dev`.

Hermes tourne encore. Le chemin observé est : Telegram → hôte Hermes → commande
forcée SSH → `~/.local/lib/hermes-codex/automecanik-transport-0.1.0/endpoint.py`
sur DEV. La dernière mission reçue est `7427b5c4-9192-4b86-9983-07f4f4599f3c`, le
2026-11-17 à 03:54Z (`~/.local/state/hermes-codex/tg-control/`).

**Reste à faire, sur l'hôte Hermes, par Marwane ou par un mandat qui y a accès** :
inventorier le profil, les skills et la mémoire du profil, le robot, l'orchestrateur
et `/var/backups/hermes-specialists/`, avec la même méthode (§10).

## 3. Inventaire par lieu (6.2, 6.3)

Chaque lieu porte :

- sa racine ;
- ses comptes ;
- le nombre de fichiers identiques à un blob de `origin/main` ;
- l'empreinte du lieu : SHA-256 des lignes triées « sha256  chemin » du lieu, agrégats compris (§10) ;
- un sort proposé.

Le détail fichier par fichier est dans `manifeste-fichiers.tsv` (4 896 fichiers)
et `manifeste-agregats.tsv` (193 agrégats). L'empreinte complète de chaque lieu
est dans `manifeste-emplacements.tsv`.

Familles de lieux :

- `D:` : dossiers de travail ;
- `R:` : runtime et état ;
- `C:` : fichiers de configuration isolés ;
- `K:` : cache de la CLI Claude, 19 entrées regroupées.

Totaux :

| Famille | Lieux | Fichiers | Octets |
|---|--:|--:|--:|
| D | 31 | 40 233 | 1 060 268 020 |
| R | 11 | 16 723 | 2 344 861 284 |
| C | 7 | 7 | 23 462 |
| K | 1 | 167 | 555 540 |
| **Total** | **50** | **57 130** | **3 405 708 306** |

Comptes associés :

- 149 secrets relevés par nom seul ;
- 81 fichiers identiques à un blob de `origin/main` ;
- 191 agrégats ;
- 7 refus de lecture : répertoires de sauvegarde root de `/opt/automecanik-supervisor/backups/`, et deux fichiers sous `~/.local/lib/hermes-codex`.

**Proposé : sort par lieu.**

- Aucun lieu hors dépôt n'est « outil du 04 au registre du 23 ». Les outils du 04
  sont déjà dans le dépôt (§7).
- Aucun lieu n'est « à verser au dépôt » en bloc. Ce qui est utilisé et absent du
  dépôt est traité au cas par cas dans `projet-versement/README.md`.

| Lieu | Racine | Fichiers | Octets | Secrets (nom seul) | Identiques au dépôt | Plus récent (UTC) | Empreinte (16 premiers) | Sort proposé | Note |
|---|---|--:|--:|--:|--:|---|---|---|---|
| `D:worktrees-hermes-codex-claude-20260930` | `~/audit/worktrees-hermes-codex-claude-20260930` | 35 | 2 863 980 | 0 | 0 | 2026-10-02T05:30:31Z | `d5d79658940bd33e` | à archiver | audit des worktrees Hermes/Codex/Claude du 30/09 |
| `D:automecanik-hermes-admin-key-20261024` | `~/automecanik-hermes-admin-key-20261024` | 1 | 2 846 | 0 | 0 | 2026-10-24T09:25:31Z | `8c304fdd0eeb8bc3` | à archiver | script de retrait de la clé admin Hermes, exécuté le 24/10 (sauvegarde `authorized_keys.before-retire-…` du même jour) |
| `D:hermes-astra-opus-lab-0e6gyv54` | `~/hermes-astra-opus-lab-0e6gyv54` | 223 | 4 810 630 | 4 | 6 | 2026-10-04T16:57:07Z | `f2d0af192d7a67ef` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-2f5khk8f` | `~/hermes-astra-opus-lab-2f5khk8f` | 68 | 590 046 | 4 | 0 | 2026-10-04T13:13:03Z | `37d086e5f36433d0` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-95t6hrqy` | `~/hermes-astra-opus-lab-95t6hrqy` | 115 | 628 153 | 4 | 1 | 2026-10-04T13:18:05Z | `0577639f1511af60` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-esep1y3s` | `~/hermes-astra-opus-lab-esep1y3s` | 62 | 551 536 | 2 | 0 | 2026-10-04T12:59:35Z | `6474f76755af35ce` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-g81f9b7m` | `~/hermes-astra-opus-lab-g81f9b7m` | 70 | 600 771 | 4 | 0 | 2026-10-04T13:18:30Z | `59e0351eda6e5568` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-pezuhvqe` | `~/hermes-astra-opus-lab-pezuhvqe` | 65 | 653 495 | 2 | 0 | 2026-10-04T13:06:13Z | `e0e88e6c3403d12c` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-pk94u635` | `~/hermes-astra-opus-lab-pk94u635` | 77 | 611 794 | 4 | 1 | 2026-10-04T13:25:19Z | `62be47bcab0000ad` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-tx4szpca` | `~/hermes-astra-opus-lab-tx4szpca` | 222 | 4 665 750 | 4 | 6 | 2026-10-04T13:36:13Z | `bf4d478c4f4fce80` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-xur7szbw` | `~/hermes-astra-opus-lab-xur7szbw` | 120 | 648 393 | 4 | 2 | 2026-10-04T13:19:39Z | `64510345d6af6f92` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-lab-ygx6e96j` | `~/hermes-astra-opus-lab-ygx6e96j` | 213 | 4 659 411 | 4 | 6 | 2026-10-04T13:16:09Z | `7d1ca7121071eab2` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-review-006604d` | `~/hermes-astra-opus-review-006604d` | 122 | 1 278 149 | 4 | 0 | 2026-10-04T20:54:38Z | `7433214d36d1297b` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-review-2d01bbf` | `~/hermes-astra-opus-review-2d01bbf` | 115 | 1 098 432 | 4 | 0 | 2026-10-04T20:54:38Z | `f073cb0e72595ea6` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-astra-opus-review-42e1084` | `~/hermes-astra-opus-review-42e1084` | 119 | 1 194 101 | 4 | 0 | 2026-10-04T20:54:01Z | `72919f525e35a833` | à archiver | labo / revue Astra-Opus du 04/10 |
| `D:hermes-autonomie-candidate-20260930` | `~/hermes-autonomie-candidate-20260930` | 397 | 8 555 061 | 0 | 6 | 2026-09-30T14:21:43Z | `e716642489971904` | à archiver | candidat d'autonomie du 30/09, non servi |
| `D:hermes-n235-20261005` | `~/hermes-n235-20261005` | 98 | 769 617 | 4 | 0 | 2026-10-05T19:54:58Z | `c1a2c9a32c195711` | robot Telegram, non repris | sources du contrôleur Telegram (lot n235) |
| `D:hermes-n235-20261005-delivery` | `~/hermes-n235-20261005-delivery` | 26 | 214 281 | 0 | 0 | 2026-10-05T19:53:51Z | `e3b82b0e0dadaffc` | à archiver | preuves de livraison n235 |
| `D:hermes-n235-20261005-evidence` | `~/hermes-n235-20261005-evidence` | 233 | 6 211 428 | 0 | 9 | 2026-10-05T20:05:07Z | `3e2f34a616ff500c` | à archiver | preuves n235 |
| `D:hermes-n6-n9-integration-20261013` | `~/hermes-n6-n9-integration-20261013` | 553 | 7 215 113 | 6 | 1 | 2026-10-17T00:31:01Z | `0cb5fefffd3d2072` | robot Telegram, non repris | intégration du contrôleur n6–n9 |
| `D:hermes-npm-cache-20261005` | `~/hermes-npm-cache-20261005` | 95 | 734 054 | 4 | 0 | 2026-10-05T05:20:39Z | `df93a15d88525370` | robot Telegram, non repris | **contient `controller/warm-hermes-npm-cache.sh`, appelé par le cron `sync-dev-runtime.sh` : ne pas archiver avant l'arrêt de Hermes et le correctif 2** |
| `D:hermes-npm-cache-20261005-evidence` | `~/hermes-npm-cache-20261005-evidence` | 7 | 17 777 | 0 | 0 | 2026-10-05T05:27:40Z | `8d4831111c519c0e` | à archiver | preuves du cache npm |
| `D:hermes-preservation-20261013` | `~/hermes-preservation-20261013` | 34 993 | 973 820 457 | 8 | 5 | 2026-10-17T04:34:54Z | `04494f6491fbe79a` | à archiver | bundles et dépôts de préservation du 13/10 |
| `D:hermes-review-closure-20261015` | `~/hermes-review-closure-20261015` | 48 | 21 360 776 | 0 | 0 | 2026-10-14T23:30:54Z | `bf605d73e0093add` | à archiver | clôture de revue ; contient le dernier relevé de l'hôte Hermes (14/10) |
| `D:hermes-review-transfer-aisf02wu` | `~/hermes-review-transfer-aisf02wu` | 11 | 391 078 | 0 | 0 | 2026-10-04T13:45:17Z | `2e8c20f1cbec0d8e` | à archiver | revue de transfert |
| `D:hermes-review-transport-ob8mgze8` | `~/hermes-review-transport-ob8mgze8` | 12 | 491 957 | 0 | 0 | 2026-10-04T17:01:47Z | `99d9e4eac1767f1b` | à archiver | revue du transport |
| `D:hermes-review-transport-t69aztnp` | `~/hermes-review-transport-t69aztnp` | 9 | 406 906 | 0 | 0 | 2026-10-04T14:00:35Z | `ad34aff8c624e47e` | à archiver | revue du transport |
| `D:hermes-v4-integration-20261004` | `~/hermes-v4-integration-20261004` | 1 893 | 13 386 906 | 62 | 2 | 2026-11-17T22:10:33Z | `812b2e5ac6000816` | robot Telegram, non repris | intégration v4 du contrôleur (dépôt git candidat) |
| `D:hermes-wiki-target-20261005` | `~/hermes-wiki-target-20261005` | 98 | 762 089 | 4 | 0 | 2026-10-05T18:27:36Z | `b89e41fbc02d01d6` | robot Telegram, non repris | sources du contrôleur, cible wiki |
| `D:hermes-wiki-target-20261005-evidence` | `~/hermes-wiki-target-20261005-evidence` | 4 | 1 414 | 0 | 0 | 2026-10-05T18:37:03Z | `d6d4bbf2c7981a14` | à archiver | preuves cible wiki |
| `D:hermes-workspace-restore-20261013` | `~/hermes-workspace-restore-20261013` | 129 | 1 071 619 | 4 | 1 | 2026-10-17T00:29:31Z | `71917a27cf6e98bc` | robot Telegram, non repris | restauration de la source du contrôleur (HEAD 277b14a4, propre) |
| `R:state-hermes-codex` | `~/.local/state/hermes-codex` | 11 811 | 1 515 233 033 | 3 | 9 | 2026-11-17T04:58:38Z | `9a877ab2eaa875c0` | à archiver | état des missions (tg-control/<mission>) et préparations ; écrit à chaque mission tant que Hermes tourne |
| `R:lib-hermes-codex` | `~/.local/lib/hermes-codex` | 197 | 337 665 970 | 2 | 2 | 2026-10-24T23:32:46Z | `00f55bee294c6aba` | robot Telegram, non repris | runtime en service : `telegram-control-1.0.0`, `automecanik-transport-0.1.0` (cible de la commande forcée SSH), rollouts |
| `R:npm-cache-hermes` | `~/.local/share/hermes-codex` | 3 864 | 234 722 912 | 0 | 0 | 2026-11-17T03:54:29Z | `5ed2fe3092741d88` | à archiver | cache npm hors ligne des missions (régénérable) ; rechargé par `sync-dev-runtime.sh` |
| `R:opt-hermes-specialists` | `/opt/hermes-specialists` | 1 | 246 107 320 | 0 | 0 | 2026-10-04T20:43:33Z | `e72eed626c8fc1e1` | à archiver | binaire Claude Code 2.1.289 des spécialistes (régénérable) |
| `R:etc-hermes-specialists` | `/etc/hermes-specialists` | 1 | 307 | 0 | 0 | 2026-10-04T17:43:29Z | `f66027b9ad4cff75` | à archiver | politique des spécialistes (copie aussi dans workspace-restore) |
| `R:opt-automecanik-supervisor` | `/opt/automecanik-supervisor` | 13 | 184 060 | 0 | 0 | 2026-10-14T09:20:35Z | `9e15a378e4fb48d7` | à archiver | collecteur de supervision appelé par Hermes ; règles métier absentes du dépôt → voir projet de versement §3 (décision owner) |
| `R:opt-automecanik-command-center` | `/opt/automecanik-command-center` | 2 | 11 212 | 0 | 1 | 2026-10-24T14:52:10Z | `eeb958ae82dfc39d` | à archiver | copie installée ; `command_center.py` identique au dépôt |
| `R:opt-automecanik-seo-readonly` | `/opt/automecanik-seo-readonly` | 8 | 76 504 | 0 | 0 | 2026-10-22T19:44:36Z | `62fd6bc5f6962b57` | à archiver | lecteur SEO de la commande forcée ; SKILL.md = copie dérivée du dépôt |
| `R:wiki-auto-validation` | `/opt/automecanik/wiki-auto-validation` | 333 | 3 479 509 | 0 | 23 | 2026-11-17T07:10:11Z | `318c3d6d2671fb9c` | à archiver | worktree propre du dépôt wiki (HEAD contenu dans origin/main) ; utilisé aujourd'hui à 07:10Z (pytest) : propriétaire à confirmer avant tout archivage |
| `R:state-hermes-mission-publish` | `~/.local/state/hermes-mission-publish` | 1 | 401 | 0 | 0 | 2026-10-26T19:57:28Z | `005f64218fae31ca` | à archiver | état de `scripts/ops/hermes-mission-publish` |
| `R:state-qualification-20261022` | `~/.local/state/automecanik-qualification-20261022` | 492 | 7 380 056 | 0 | 0 | 2026-10-22T16:20:56Z | `05858bff275e4c42` | à archiver | qualification du 22/10 |
| `C:codex-hermes-readonly-toml` | `~/.codex/automecanik-hermes-readonly.config.toml` | 1 | 935 | 0 | 0 | 2026-09-12T00:32:50Z | `34636bf78401878e` | à archiver | config Codex du lecteur Hermes |
| `C:codex-auth` | `~/.codex/auth.json` | 1 | 3 961 | 1 | 0 | 2026-11-11T19:21:50Z | `7c127830a6959bbe` | hors passation | authentification de la CLI Codex, pas propre à Hermes — secret, nom seul |
| `C:digest-key-dir` | `~/.config/automecanik-command-center` | 1 | 65 | 1 | 0 | 2026-10-24T14:51:13Z | `b2ce7864e2e891c4` | à archiver | clé du digest Command Center lue par le collecteur Hermes — secret, nom seul ; rotation ou retrait = owner |
| `C:ssh-authorized-keys` | `~/.ssh/authorized_keys` | 1 | 958 | 1 | 0 | 2026-10-25T08:37:31Z | `7b4ffb428d99af72` | à modifier par Marwane à l'arrêt | porte la clé de mission de l'hôte Hermes (commande forcée) — secret, nom seul |
| `C:ssh-authorized-keys-backup` | `~/.ssh/authorized_keys.before-retire-hermes-admin-20261024` | 1 | 1 142 | 1 | 0 | 2026-10-21T07:36:30Z | `fb5207ff55fcf36c` | à archiver | sauvegarde du 21/10 avant retrait de la clé admin — secret, nom seul |
| `C:space-passation-doc` | `~/space-automecanik-20261112/090 - Passation Hermes vers Space.md` | 1 | 15 768 | 0 | 0 | 2026-11-12T12:57:27Z | `d07ff06796184ae5` | à archiver | note Space « Passation Hermes vers Space » (recette en 6 étapes, #1947) ; archive Space privée, jamais le monorepo public |
| `C:systemd-transient-unit` | `/run/user/1000/systemd/transient/hermes-specialist-176271c1-231f-4427-9f59-70371146859e-c1469ad5-8334-46e4-b89e-fb9e6c8a4943.service` | 1 | 633 | 0 | 0 | 2026-10-04T13:25:18Z | `a3b3652cd1dec831` | à archiver | unité utilisateur transitoire d'un spécialiste de labo, en échec (SIGKILL) depuis le 04/10 ; pas une dépendance |
| `K:claude-cli-cache-hermes` | `~/.cache/claude-cli-nodejs/-home-deploy-hermes-astra-opus-lab-0e6gyv54-worktrees-2b7ea3ae-e54d-4014-98fe-467a6dd1d002` | 167 | 555 540 | 0 | 0 | 2026-10-23T22:30:23Z | `fb36eb6b87e67857` | à archiver | cache de la CLI Claude pour 19 répertoires Hermes |

Sort par famille de contenu :

- **Robot Telegram, non repris** :
  - le runtime de commande sur DEV, `~/.local/lib/hermes-codex` (transport, contrôleur, rollouts) ;
  - les sources du contrôleur : n235, n6–n9, v4, wiki-target, workspace-restore et npm-cache.
- **À archiver** :
  - les labos, revues, preuves, préservations et états ;
  - les copies installées sous `/opt`, dont celles identiques ou dérivées du dépôt ;
  - les caches régénérables.
- **Hors passation** : `~/.codex/auth.json`, l'authentification de la CLI Codex, qui n'est pas propre à Hermes.
- **À modifier par Marwane à l'arrêt** : `~/.ssh/authorized_keys`.

« À archiver » ne veut pas dire « à supprimer ». L'archivage et la suppression
restent des actes de Marwane. Il faut d'abord préserver ce qui est listé au §5.

## 4. Fichiers qui n'existent que hors dépôt et servent encore (6.3)

**Observé.** Ces fichiers sont exécutés par la chaîne Hermes → DEV. Aucun n'a de
blob identique dans `origin/main`, sauf `command_center.py`.

Relevés le 2026-11-17 entre 22:12:52Z et 22:13:37Z :

| Fichier | Octets | Modifié (UTC) | SHA-256 | Rôle |
|---|--:|---|---|---|
| `~/.local/lib/hermes-codex/automecanik-transport-0.1.0/endpoint.py` | 7 423 | 2026-10-22T19:44:36Z | `8d73d190dadd224a2f85417947ab9a54044753ada4a6079e720100967e6bf90a` | point d'entrée de la commande forcée SSH |
| `…/automecanik-transport-0.1.0/policy.py` | 1 131 | 2026-09-12T01:44:45Z | `31efba4f26d4d3839a7c33b8ff6fdc608d5e513da4193a113b196e64268f272b` | politique du transport |
| `…/automecanik-transport-0.1.0/transport.py` | 1 517 | 2026-09-12T00:32:38Z | `5c02781264e67593e330e69c23da17ddc3c56ca78779bb0ade3889edddd074df` | transport |
| `…/automecanik-transport-0.1.0/relay.py` | 4 201 | 2026-09-12T00:32:38Z | `3b1455df39db8939bdf8e9c5255a21b82b5496a69d2e0b519da9c4c2cf5cd9ee` | relais |
| `~/.local/lib/hermes-codex/telegram-control-1.0.0/backend.py` | 67 800 | 2026-10-17T08:02:30Z | `2fdc1bebde4be7bebaf5353aaae91fe2827442e589529796dca61055c1fd5c5b` | exécution des missions côté DEV |
| `…/telegram-control-1.0.0/claude_executor.py` | 11 483 | 2026-10-22T17:55:06Z | `f6ccd1b93c92cd96ad2b4f0281ae6ae48b06ea9825f03f6fff9bc36171c6034a` | lancement de Claude par mission |
| `…/telegram-control-1.0.0/specialist_runtime.py` | 25 251 | 2026-10-24T23:00:57Z | `975d093b24c78af54fc695d72c45d72826f2b2722877adacc6c3f714182e2e67` | spécialistes |
| `…/telegram-control-1.0.0/workspace_release.py` | 13 409 | 2026-10-14T23:02:46Z | `d2d64df2145ecac8e76e385bf46efdfb0dab30a8e386affa510a1eecc7926656` | libération des worktrees |
| `…/telegram-control-1.0.0/backend-config.json` | 2 132 | 2026-10-21T22:15:06Z | `0ad587d523356cb3aeaae710c4271296d946d25667216811832a6b7c273c5a4a` | configuration, lue aussi par `scripts/ops/hermes-mission-publish` |
| `/opt/automecanik-supervisor/collector.py` | 32 873 | 2026-10-14T09:20:35Z | `6a46bbf81538abfa199b6678d607ac57eefb994afe9ca3c89f4076e7e752ee31` | collecteur de supervision |
| `/opt/automecanik-supervisor/ga4_report.py` | 7 639 | 2026-10-01T20:14:14Z | `cf2c48c19152a6e247839b8c8a61540261ed6115ed8ed991f040c9e8d6b4fd75` | rapport GA4 |
| `/opt/automecanik-supervisor/gsc_report.py` | 4 149 | 2026-10-01T05:50:26Z | `084c10a3b3cb0f42840558c3f445c12e3a63c7f9df3609e14df0b634dea82d04` | rapport GSC |
| `/opt/automecanik-seo-readonly/1.0.1/reader.py` | 7 688 | 2026-10-22T19:44:36Z | `8d5fa548af58d0e2b8b14e27f56db227f8aeaaee88c226911d74586b027fb155` | lecteur SEO en lecture seule |
| `/opt/automecanik-seo-readonly/1.0.1/hermes_seo_reader.py` | 3 343 | 2026-10-22T19:44:36Z | `c612dbe8f2b8b36587a5d53527f49054374c489aa5a079d46a78772a4808d923` | adaptateur Hermes du lecteur |
| `/opt/automecanik-command-center/1.0.0/command_center.py` | 10 800 | 2026-10-24T14:52:10Z | `988714d5043a286ab467745096cedba1e5e4b884b15829bdccdc73bd179e4f51` | **identique** à `scripts/ops/hermes-command-center/command_center.py` |
| `/opt/automecanik-command-center/1.0.0/source.json` | 412 | 2026-10-24T14:52:10Z | `eefb0c026b8c2384e3ccfea0238dcdf979b506792d02770230d96ae34858eed2` | provenance de l'installation |
| `~/hermes-npm-cache-20261005/controller/warm-hermes-npm-cache.sh` | 3 202 | 2026-10-05T05:20:39Z | `8544b007b99772bce39572939dd6a52aa733bb7c4fe82e8c882c58ceffbea728` | appelé par le cron `sync-dev-runtime.sh` ; 4 copies identiques dans les sources du contrôleur |

Les 84 fichiers du transport et les fichiers du contrôleur n'ont aucune autre source
sur DEV. Leurs sources sont sur l'hôte Hermes, ou nulle part.

**Proposé.** Ne rien verser de ce runtime au dépôt. Il sert le robot Telegram, que
la décision 70 ne reprend pas. Seule exception, les règles métier du collecteur de
supervision. Leur contenu n'a pas d'équivalent au dépôt, à part la fraîcheur GA4.
Verser `collector.py` tel quel créerait une source concurrente au Command Center ;
voir `projet-versement/README.md` §3.

## 5. Worktrees de mission `~/worktrees/tg-codex` : à préserver avant tout nettoyage

**Observé** (relevé du 2026-11-17 à 22:13:34Z, détail dans `worktrees-mission.tsv`).

`~/worktrees/tg-codex` contient 25 worktrees du dépôt `app`, tous détachés sauf
un. Leur gitdir est dans le checkout partagé (`.git/worktrees/<uuid>`). Ils ne
font pas partie des 50 lieux du §3 et sont relevés à part.

- 22 ont un HEAD contenu dans une branche d'`origin`.
- 3 ont un HEAD absent de toute branche d'`origin`. Ces commits ne survivent que
  par le HEAD du worktree : un `git worktree remove`, ou une suppression du dossier
  suivie de `git worktree prune`, les rend inaccessibles, puis `git gc` les efface.

| Mission | HEAD | Commits hors `origin` | Contenu |
|---|---|--:|---|
| `391789eb` | `a5a6df1b2fa72fb7a13360afd35498128a60c9f0` | 11 | dont `fc35c3430ae7bedde15023dbbcf681f77136329f` *fix(diagnostic): distinguish incomplete repeatable cleanup* et `2f5ec4a841283abc7537272168ee0bf862b3a470` *fix(diagnostic): fail queue jobs for recorded projection errors*. Ces deux correctifs ne sont pas sur `main`, contrairement au reste de la série provenance (#1758, #1762, #1786, #1796–#1798). S'y ajoutent 3 fichiers non commités. |
| `be911d64` | `de9bd95d821984b5601e9c51ed1ea01cdb141c7e` | 1 | *Private audit snapshot preserving modified source instructions* : 27 fichiers d'instructions de workspaces. 3 documents non suivis `docs/audit/2026-10-21-seo-editorial-filtre-huile-{design.md,evidence.json,operational-synthesis.md}` sont absents de `main` (ni même contenu, ni même nom). |
| `d84bb26d` | `a91bd2189a9117326c5166f73c690d069384756b` | 7 | branche `codex/supplier-logo-data-20261004` ; contenu déjà repris sur `main` (#1712, #1717) ; 6 des 7 commits sont des resynchronisations de registre. |

12 worktrees ont des fichiers non commités. Le détail et les SHA-256 sont dans
`worktrees-mission-fichiers.tsv` (221 lignes, relevé du 2026-11-17 à 22:21:59Z).
Aucun n'est identique à un blob de `main`.

| Mission | Fichiers non commités | Sort proposé |
|---|---|---|
| `8b62c17a` | `marketing-preparation.ts` (+27), `marketing-workbench.test.ts` (+272), `workbench-cli.ts` | travail sur le moteur du 04 : décision du département 04 ou de l'owner ; à préserver |
| `391789eb` | 3 fichiers | à préserver avec les commits |
| `be911d64` | 3 documents d'audit éditorial | à préserver |
| `44dbbf71` | `seo-monitor-scheduler.service.ts` (M) et son test (??) | à préserver ; décision de l'owner |
| `d44d15d8` | `sitemap-v10.types.ts`, son test, `catch-all-404-noindex.test.ts`, `constructeurs-model-410.test.ts` | **zone STOP SEO indexé** : à préserver, jamais versé sans accord nominatif |
| `00b3cb56`, `b1cf5cac`, `f17e6d6b` | `tools/telegram-wiki-repair-diagnostic.md`, `tools/telegram-oem-correction-preflight.md`, `tools/telegram-gsc-ga4-audit.md` | notes de mission du robot : à archiver |
| `45e8739b` | `scripts/marketing/hermes/general-skills/` (7 fichiers, candidat inerte de skills de profil Hermes) | à archiver : lié au profil Hermes non repris |
| `75f591ae`, `c243c342`, `e1f1a9e0` | `backend/.cache` (196 fichiers) | caches régénérables : rien à préserver |

**Proposé, action de Marwane, avant tout nettoyage de `tg-codex`.** Faire un
bundle hors dépôt des trois HEAD, par exemple :

```
git -C /opt/automecanik/app bundle create <archive>/tg-codex-heads.bundle a5a6df1b2fa72fb7a13360afd35498128a60c9f0 de9bd95d821984b5601e9c51ed1ea01cdb141c7e a91bd2189a9117326c5166f73c690d069384756b
```

Puis faire une copie (tar) des fichiers non commités listés ci-dessus. Le sort des
deux correctifs diagnostic et du travail `8b62c17a` relève d'un mandat séparé.
Ce mandat ne les verse pas.

## 6. Ce qui dépend encore de Hermes (6.4)

**Observé.** 55 fichiers suivis dans `origin/main` (`bd1da7ebc9`) citent Hermes.
Recherche `git grep -il hermes`, recomptée le 2026-11-17 à 22:17:14Z.

6 de ces fichiers sont dans `backend/src`, et chaque mention y est un commentaire :

- 3 fichiers portent le code du digest : la garde, le contrôleur et la méthode du lecteur ;
- 3 n'ont qu'un commentaire : `admin.module.ts`:143, `live-kpi.ts`:47 et `command-center-kpi.service.ts`:166.

Le mandat annonçait 5 fichiers backend. L'écart vient du périmètre de comptage, non
précisé dans le mandat ; il n'est pas résolu ici.

Rien de ce qui suit n'est appliqué. La colonne « Changement » indique ce qu'il
faudra modifier, et quand.

| # | Dépendance | Où | Bloque l'arrêt ? | Changement proposé |
|--:|---|---|---|---|
| 1 | Clé de mission de l'hôte Hermes, avec commande forcée vers le transport | `~/.ssh/authorized_keys` (secret : nom seul, non lu) | c'est le canal d'entrée | Marwane retire la ligne **au moment de** l'arrêt. Ensuite, plus aucune mission n'arrive. |
| 2 | Cibles de la commande forcée | `~/.local/lib/hermes-codex/…`, `/opt/automecanik-seo-readonly`, `/opt/automecanik-command-center`, `/opt/automecanik-supervisor`, `/etc/hermes-specialists`, `/opt/hermes-specialists` | non, ce sont des consommateurs | Archivage par Marwane **après** le retrait de 1 (§3). |
| 3 | Réchauffage du cache npm des missions | `scripts/ops/sync-dev-runtime.sh` : fonction `refresh_hermes_npm_cache`, appels lignes 471 et 621 ; script `~/hermes-npm-cache-20261005/controller/warm-hermes-npm-cache.sh` ; cache `~/.local/share/hermes-codex/npm-cache` | oui, pour l'archivage. La fonction ne fait rien si le script **et** le cache sont tous deux absents. Si un seul est archivé, une alerte est émise à chaque passage du cron. | Après l'arrêt : correctif 2 (`projet-versement/`). Avant l'arrêt, ne rien retirer : les missions d'écriture échoueraient en `ENOTCACHED`. |
| 4 | Digest du Command Center pour le collecteur de Hermes | `backend/src/auth/command-center-digest-key.guard.ts`, `…/controllers/internal-command-center.controller.ts`, `…/services/command-center-reader.service.ts`:454-470, commentaires `live-kpi.ts`:47, `command-center-kpi.service.ts`:166, `admin.module.ts`:143 ; tests `backend/tests/unit/command-center-digest.test.ts`, `command-center-reader.service.test.ts` ; `backend/.env.example`:387-390 ; `packages/registry/src/command-center/snapshot.ts`:522 ; clé `~/.config/automecanik-command-center/digest.key` (secret : nom seul) | non. Après l'arrêt, il n'y a plus de consommateur connu sur DEV. | Décision de l'owner, hors de ce mandat : garder le digest pour un autre consommateur (la skill `project-state-report` le lit), ou le retirer puis faire tourner la clé. Code en service : pas de correctif préparé. |
| 5 | Publication des missions | `scripts/ops/hermes-mission-publish/{README.md,publish.py,test_publish.py}`, qui lisent `backend-config.json` | non | À retirer après l'arrêt par un mandat séparé, ou à garder en archive. |
| 6 | Paquet du Command Center installé pour Hermes | `scripts/ops/hermes-command-center/{README.md,command_center.py,install.py,test_marketing_native.py}` | non | Après l'arrêt : retrait ou conservation, au choix du 23. La copie `/opt` est identique. |
| 7 | Adaptateurs du profil Hermes pour le 04 | `scripts/marketing/hermes/*` (9 fichiers) | non | Ils n'ont plus d'exécutant après l'arrêt. Ils sont déclarés dans le correctif 3 comme distincts de l'outil `marketing-workbench`. Leur retrait relève d'un mandat du 04. |
| 8 | Exclusions de cron pour `tg-codex` et `hermes-*` | `scripts/cron/disk-alert.sh`:11,31 ; `dedup-worktree-node-modules.sh`:19 ; `prune-merged-worktrees.sh`:15 et son test W13:115 ; `scripts/agents/worktree-claim.test.sh`:244 | non, elles **protègent** les worktrees du §5 | À garder jusqu'à la préservation (§5) et l'archivage de `tg-codex`. Ensuite, retrait par mandat séparé. |
| 9 | Tests des hooks | `scripts/test-claude-hooks.sh`, cas 16–22 (cache npm) | lié à 3 | Inclus dans le correctif 2. |
| 10 | Documentation et instructions | `CLAUDE.md`:71,95 ; `.claude/knowledge/workspaces.md`:40-60 ; `.claude/rules/deployment.md`:101-105 (inclus dans le correctif 2) ; `.claude/prompts/_shared/editorial-review.md` ; skills `capability-acceptance`, `diagnostic-orientation`, `project-state-report` ; `workspaces/marketing/README.md` et 6 fichiers de skills `amk-*` ; `audit/automecanik-departments-map.md` ; `audit/command-center-l1-spec-2026-10-10.md` ; `docs/plans/2026-09-28-botguard-metrics.md`, `docs/plans/2026-10-10-command-center-l1.md` ; `docs/audit/mandat-ar-20261116/releve-ci.md` ; `docs/audits/editorial-filtre-huile-20261030/{AUDIT,CHECKPOINT,HANDOFF}.md` | non | Après l'arrêt : retrait des mentions actives (CLAUDE.md, workspaces, skills, prompt). Les audits et plans datés restent tels quels comme historique. |
| 11 | Recette avant arrêt | note Space « 090 - Passation Hermes vers Space » (6 étapes, issue #1947) | décision de Marwane | À dérouler par Marwane avant l'arrêt. La note relève de l'archive Space privée, pas de ce dépôt public. |
| 12 | Worktree `wiki-auto-validation` | référencé par `backend-config.json` et par `rollouts/wiki-preparation-receipt-20261009` ; `.pytest_cache` et `_meta/agent-exit-contract.md` modifiés le 2026-11-17 entre 07:00 et 07:10Z, auteur inconnu | à confirmer | Avant tout archivage, l'owner confirme qui l'utilise aujourd'hui. Le HEAD `13869631…` est contenu dans `origin/main` du dépôt wiki. |

**Observé, absences avec leur périmètre** :

| Où | Recherche | Résultat |
|---|---|---|
| systemd | unités système et unités utilisateur de `deploy`, motif `hermes\|telegram`, le 2026-11-17 à 22:24:01Z | aucune unité active. Seule une unité utilisateur transitoire de labo est en échec depuis le 04/10. |
| crontab | crontab de `deploy`, même motif | aucune ligne. Les seules dépendances cron sont le cron `sync-dev-runtime.sh` (3) et les exclusions (8). |
| processus | `pgrep -fa`, même motif | aucun. Les missions s'exécutent à la demande, par SSH. |
| conteneurs | `docker ps -a` | aucun. |
| workflows | `.github/` d'`origin/main` | aucun fichier ne cite `hermes`, `tg-codex` ou `telegram`. |

Les sessions sont des worktrees et des processus Claude lancés par mission. Aucun
n'était actif au relevé. La dernière mission date du 2026-11-17 à 03:54Z.

**Condition d'arrêt proposée.** Marwane peut arrêter Hermes quand trois conditions
sont réunies :

1. la recette (11) est passée ;
2. le §5 est préservé ;
3. l'usage de `wiki-auto-validation` (12) est confirmé.

Il retire alors la ligne de mission (1). Les dépendances 3 à 10 se traitent après
l'arrêt, dans l'ordre 3, puis 2, puis 8, puis 4 à 7 et 10.

## 7. Registre des outils d'agents : où inscrire les outils du 04 (6.5)

**Observé.** Le registre unique du 23 (décision 13) est
`.spec/00-canon/ai-registry/skills.registry.json`. Il n'est pas écrit à la main :

- il est généré par `scripts/governance/build-skills-registry.js` ;
- ce générateur ne lit que `.claude/skills` (19 skills) ;
- la CI `skills-canon-gate.yml` vérifie qu'il est à jour (`--check`), en mode avertissement.

Le Command Center (`scripts/governance/build-command-center-snapshot.js`,
`buildSnapshot`, lignes 171–240) résout `departments[].capabilities` de
`.spec/00-canon/ai-registry/agent-operating-map.yaml` contre ce registre. Une
capacité sans résolution lève une alerte `DROPPED_CAPABILITY`.

Pour le département 04 (marketing, ligne 376), la carte déclare
`capabilities: [marketing, marketing-backlinks]`.

Les outils du 04 venus de Hermes sont déjà au dépôt, mais hors du registre :

- les 4 skills `workspaces/marketing/.claude/skills/amk-*` ;
- le moteur de préparation `backend/src/modules/marketing/services/marketing-preparation.ts` ;
- `scripts/marketing/workbench-cli.ts`.

**Proposé, sans second registre** (`projet-versement/`) :

1. Correctif 1 : le générateur existant lit aussi
   `workspaces/*/.claude/skills/*/SKILL.md` et ajoute un champ `workspace`.
   - Un nom en double lève une erreur.
   - La racine passe d'abord et ses 19 entrées sont inchangées.
   - Résultat simulé : 47 skills, dont 28 de workspaces ; les 4 `amk-*` sont conformes.
2. Correctif 3, réservé à l'owner (`.spec/00-canon/**`) : ajoute aux capacités du
   département 04 les 4 `amk-*` et une capacité déclarée `marketing-workbench`
   (pipeline, `partial`), avec preuves `workbench-cli.ts` et `marketing-preparation.ts`.

## 8. Secrets, par nom seul

Aucune valeur n'a été lue, hachée ou recopiée. 149 fichiers ont été reconnus comme
secrets, par leur nom ou par un motif d'en-tête. Ils ne figurent dans les manifestes
qu'avec leur chemin, leur taille et leur date, sous la mention `SECRET-NON-HACHE`.

Ceux qui comptent pour l'arrêt :

| Fichier | Statut |
|---|---|
| `~/.ssh/authorized_keys` | porte la clé de mission de Hermes ; à modifier par Marwane à l'arrêt |
| `~/.ssh/authorized_keys.before-retire-hermes-admin-20261024` | sauvegarde du retrait de la clé admin du 24/10 ; à archiver |
| `~/.config/automecanik-command-center/digest.key` | clé du digest (§6, ligne 4) ; décision de l'owner |
| `~/.codex/auth.json` | CLI Codex, hors passation |

## 9. Effet de bord observé pendant ce mandat

Un `git status` en lecture, lancé à 22:10Z dans
`~/hermes-v4-integration-20261004/candidate`, a rafraîchi l'index du worktree
`candidate/.git/worktrees/hermes-n235-20261005/index` (horodatage 22:10:33Z).
Seules les métadonnées de cache de l'index changent, pas le contenu suivi. C'est
pourquoi ce lieu affiche un « plus récent » au 2026-11-17. Les commandes git
suivantes ont été lancées avec `--no-optional-locks`.

Aucune autre écriture hors de ce worktree de mandat et du répertoire temporaire de
la session.

## 10. Méthode et reproductibilité

- **Lieux.** Ce sont les chemins qui contiennent `hermes` ou qui en dépendent :
  - `~/` ;
  - `~/.local/{lib,share,state}` ;
  - `~/.config` ;
  - `~/.cache/claude-cli-nodejs` ;
  - `/opt` ;
  - `/etc` ;
  - les fichiers isolés du §8.
  La liste était fixée avant le calcul. `/home/hermes` et `/var/backups/hermes-specialists` sont absents de DEV.
- **Fichiers.** Pour chaque fichier régulier, on relève :
  - la taille ;
  - la date de modification (UTC) ;
  - le SHA-256 ;
  - le blob git, comparé à tous les blobs de `origin/main` (`dans_depot_meme_contenu`) ;
  - les homonymes au dépôt (`depot_meme_nom`).
  Les liens symboliques sont notés et non suivis.
- **Agrégats.** Les répertoires `node_modules`, `.git`, `_cacache`, `jest-cache`,
  `__pycache__` et les enfants volumineux désignés sont résumés en une ligne :
  nombre, octets, plus récent, et empreinte d'arbre. L'empreinte d'arbre est le
  SHA-256 de la liste triée « sha256  chemin relatif ».
- **Empreinte d'un lieu.** C'est le SHA-256 de la liste triée des lignes
  « sha256  chemin » des fichiers du lieu et « ARBRE:<empreinte>  chemin » de ses
  agrégats. Elle est calculée à partir des deux manifestes publiés ici, chemins
  en `~`, et peut donc être recalculée à partir d'eux.
- **Secrets.** Ils sont reconnus par leur nom (`.env*`, `*.key`, `*.pem`, `auth.json`,
  `authorized_keys*`, `*token*`, `*secret*`, `*credential*`, `.npmrc`, `.netrc`,
  `known_hosts*`) ou par un motif dans les 64 premiers kio. Ils ne sont ni hachés
  ni recopiés.
- **Refus.** 7 refus de lecture, sans élévation de droits :
  - 5 sous `/opt/automecanik-supervisor`, dans les sauvegardes appartenant à root ;
  - 2 fichiers `endpoint.before-*.py` du transport.
- **Publication.** Les chemins de `/home/deploy` sont réécrits en `~`. Le dossier
  ne contient ni adresse IP, ni courriel, ni identifiant de conversation.

## Fichiers de ce dossier

| Fichier | Contenu |
|---|---|
| `README.md` | ce document |
| `manifeste-emplacements.tsv` | 50 lieux : comptes et empreinte complète |
| `manifeste-fichiers.tsv` | 4 896 fichiers : taille, date, SHA-256, comparaison au dépôt |
| `manifeste-agregats.tsv` | 191 agrégats et 2 liens symboliques |
| `worktrees-mission.tsv` | 25 worktrees `tg-codex` : HEAD, présence sur `origin`, modifications |
| `worktrees-mission-fichiers.tsv` | 221 fichiers non commités des worktrees de mission, avec SHA-256 |
| `projet-versement/` | 3 correctifs préparés, **non appliqués**, et leur README |
