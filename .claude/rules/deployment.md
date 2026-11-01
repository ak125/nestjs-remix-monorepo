---
# Chargée à la demande : quand l'agent lit un fichier qui correspond à ces chemins.
# Hors de ces chemins, CLAUDE.md (invariant 8, §Vocabulaire déploiement) pointe ici
# avant toute action infra. Le lint check-preprod-vocabulary.sh reste la garde mécanique.
paths:
  - ".github/workflows/**"
  - "docker/**"
  - "docker-compose*.yml"
  - "Dockerfile*"
  - ".sops.yaml"
  - "secrets/**"
  - "scripts/ops/**"
  - "scripts/ci/**"
  - "scripts/lint/check-preprod-vocabulary.sh"
  - "scripts/claude-hooks/pretool-bash-guard.sh"
  - ".husky/pre-push"
  - "backend/src/contract/env-contract/**"
  - ".spec/runbooks/**"
---

# Deployment — VOCABULAIRE STRICT (canon)

> **Charger ce fichier AVANT toute action sur l'infra de déploiement.**
> Le vocabulaire DEV / PREPROD / PROD est strict et non-négociable.
> Lint CI `scripts/lint/check-preprod-vocabulary.sh` bloque toute formulation interdite (voir plus bas).

## Glossary — 3 environnements distincts, 2 machines physiques

| Terme canon | Rôle réel | Machine physique | Ports | Image Docker | Trafic |
|-------------|-----------|------------------|-------|--------------|--------|
| **DEV** | Machine de dev opérateur | hôte DEV | `3000` (via `npm run dev`) | **aucune image deploy ici** | Opérateur SSH, code-side |
| **PREPROD** | Container CI éphémère | hôte PROD | `3200` (localhost only) | `massdoc/nestjs-remix-monorepo:preprod` | **CI uniquement** : E2E Smoke + Lighthouse, `READ_ONLY=true` |
| **PROD** | Container live trafic | hôte PROD (même machine, derrière Caddy) | `80`/`443` (public) | `massdoc/nestjs-remix-monorepo:production` | Utilisateurs finaux via `www.automecanik.com` |

Les machines sont nommées par leur rôle, jamais par adresse IP ni nom d'hôte : le dépôt est public.

**Sources de vérité de cette table** : [`.sops.yaml:24-40`](../../.sops.yaml), [`.github/workflows/ci.yml:588-712`](../../.github/workflows/ci.yml), [`docker-compose.preprod.yml`](../../docker-compose.preprod.yml), [`.github/workflows/deploy-prod.yml`](../../.github/workflows/deploy-prod.yml).

**Conséquence importante** : l'hôte DEV **n'héberge PAS** de container `:preprod` ni `:production` — c'est un poste de travail SSH. PREPROD et PROD vivent tous les deux sur l'hôte PROD, qui porte aussi le runner GitHub Actions self-hosted.

## Sync du runtime DEV:3000 (où on teste/mesure)

DEV:3000 = `npm run dev` (nodemon) servant **le working tree `/opt/automecanik/app/backend/dist`**.
Supervision : unit systemd utilisateur `automecanik-dev.service` (relance du stack, arbre tué
en bloc à l'arrêt) une fois la bascule `bash /opt/automecanik/app/scripts/ops/install-dev-service.sh switch`
faite par l'owner ; avant elle, le stack vit dans le terminal qui l'a lancé. Un crash de l'app est
relancé dans le stack par `backend/wait-and-start.js` (ligne `DEV_APP_CRASH`). Service actif, un
`npm run dev` lancé dans `backend/` depuis un terminal est refusé avant tout nettoyage : il tuait
le stack du service, qui sortait en code 0 sans être relancé. Journal : `journalctl --user -u
automecanik-dev -f` ; lancement manuel : `systemctl --user stop automecanik-dev` d'abord.
**Le merge `main` ne met PAS à jour DEV:3000** (il ne réécrit que le tag `:preprod`). Resync
automatisé par [`scripts/ops/sync-dev-runtime.sh`](../../scripts/ops/sync-dev-runtime.sh) (cron ~10 min).

**Convention** : le checkout principal `/opt/automecanik/app` **reste sur `main`** ; tout travail
feature/agent se fait en **worktree** (`.claude/worktrees/`). Ne jamais y laisser une branche
feature (sinon DEV:3000 sert du code périmé).

**6 axes de dérive** vs `main` (le script garde 1-2, alerte sur 3-6 — jamais d'action destructive auto) :

1. **Git** : checkout sur main + ff-pull `origin/main`, puis sous-modules alignés sur leur pin
   (`sync_submodules()` : le ff déplace le pin sans toucher le contenu). Contenu modifié
   localement, commit non publié ou dépôt injoignable → alerte, jamais d'écrasement. (auto)
2. **`.env`** : `backend/.env` doit avoir toutes les vars REQUIRED de `env-validation.ts`
   (ex. `JWT_SECRET` depuis #606) ; manquante → boot crash. (alerte via health-check KO)
3. **Node** : doit correspondre à `.nvmrc` et aux `engines` des manifests du checkout ;
   vérifier `node --version` avant build. Ne pas déduire une procédure d'upgrade
   d'un ancien incident ; tout changement de runtime relève d'un mandat distinct. (alerte)
4. **Migrations DB** : pas auto-appliquées à la DB partagée ; appliquer l'additif réviewé à la
   main (`ADD VALUE IF NOT EXISTS`…). (alerte)
5. **Workspaces npm** : un nouveau `packages/<name>/` mergé doit être (a) symlinké via
   `npm install`, (b) compilé si `main: ./dist/...` (`turbo build`) — sinon boot crash
   `MODULE_NOT_FOUND` (incident 2026-05-25 : `@repo/domain-commerce` + `@repo/cwv-taxonomy`).
   Détection `check_workspace_integrity()` ; install/build = action manuelle owner-gated
   (mutation `package-lock.json`, comme l'axe 4). (alerte)
6. **Topologie runtime** : le superviseur du stack dev peut mourir en laissant ses tâches
   persistantes vivantes, reparentées à PID 1 — `:3000` répond alors toujours `200` alors que plus
   rien ne supervise (incident 2026-09-09 : `turbo dev` SIGSEGV, bug amont turbo 2.10.0 corrigé en
   2.10.4). Détection `check_dev_runtime_topology()` : santé HTTP à chaque tick, racines orphelines
   (PPID 1), stacks dev concurrents, dumps de moins de 24 h dans `/var/crash` imputés au stack par
   leur champ `ProcCwd` (un dump d'un worktree ou d'un autre checkout est journalisé sans alerte ;
   supprimer un dump après analyse l'acquitte). Unit installée : service en échec ou en attente de
   redémarrage, stack lancé hors de son cgroup, crashs relancés (`DEV_APP_CRASH`,
   `Scheduled restart job`) lus dans son journal sur 24 h. Sonde **placée avant les gardes git** (un incident runtime est
   indépendant de l'état git) et **alert-only** — jamais `abort`, qui couperait les axes de resync ;
   ses alertes passent l'issue du tick en `warn`, que le hook SessionStart affiche. Détail : PR #1424.
   (alerte)

Hors de ces axes, le même tick recharge le **cache npm hors ligne des missions Hermes d'écriture**
quand le lockfile de `main` n'y est pas encore chargé (`refresh_hermes_npm_cache()`, empreinte
`hermes-npm-cache.lock-sha256` dans le répertoire d'état des crons) : sans lui, leur préparation
échoue en `ENOTCACHED` dès qu'une dépendance change (2026-10-28). Mission en cours → essai au tick
suivant ; échec → alerte à chaque tick, nouvel essai au plus une fois par heure. (auto)

## Mécanique du tag Docker `:preprod` (alias flottant)

- Le tag `:preprod` est **réécrit à chaque merge sur `main`** (workflow `ci.yml` → step `build`).
- Le push d'un tag git `v*` sélectionne **`:sha-<SHA complet du commit>`**, publié par le même build. Après contrôle du label de provenance, `deploy-prod.yml` publie le tag de version sur son **identifiant local immuable**. `:production` n'est déplacé vers cet identifiant qu'après le point de non-retour (`DEPLOY_STARTED=1`), où tout échec déclenche le rollback : un refus de `.env` ou de flag avant ce point laisse `:production` sur la version en service. Un déplacement de `:preprod` ne change plus cette sélection.
- Ce n'est **pas une référence stable** — pour debug historique ou rollback, utiliser un SHA git ou un tag semver explicite.
- Le label SHA de l'image sélectionnée prouve la **provenance**, pas la **validation** : `deploy-prod.yml` refuse aussi, avant toute mutation, un commit dont le run `ci.yml` (push `main`) n'a pas `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests` et `🔦 Lighthouse Performance Audit` en `success` (`scripts/ci/prod-preprod-evidence.mjs`). Un commit dont le run a été annulé par un merge suivant n'est pas validé : taguer le dernier commit vert.
- Le déploiement PREPROD exécute lui aussi `:sha-<commit du run>`, vérifié par son label puis réétiqueté `:preprod` en local : relancer un ancien job ne sert plus l'image d'un commit plus récent. La **version servie** est contrôlée après le démarrage : le conteneur doit tourner sur l'identifiant vérifié et `/health` doit renvoyer `revision` égal à ce commit (`GIT_SHA`, posé par `build.yml` et le `Dockerfile` ; `null` hors image). `deploy-prod.yml` fait les mêmes contrôles (identifiant promu, `revision` égal au commit du tag) dans `🚀 Deploy to PROD` et `✅ Validate PROD` ; un écart échoue et déclenche le rollback.

## Pièges de nommage INTERDITS (CI lint enforcé)

Toute occurrence des patterns ci-dessous dans un fichier `.md` du repo (hors errata explicites ou ce fichier canon) fait échouer le job `no-confusing-preprod-formulations` (workflow [`preprod-vocabulary-guard.yml`](../../.github/workflows/preprod-vocabulary-guard.yml)) :

- ❌ `DEV pré-prod` ou `DEV preprod` → confond 2 machines distinctes (hôte DEV vs hôte PROD)
- ❌ `preprod.automecanik.com` → hostname inexistant. Aucune URL publique n'expose PREPROD.
- ❌ `preprod miroir` ou `miroir de PROD` → faux. PREPROD est `READ_ONLY=true` (ADR-028 Option D), pas une réplique de PROD.
- ❌ `déployé en pré-prod, à valider avant prod` → personne n'interagit avec PREPROD ; c'est CI-only, validé par E2E Smoke + Lighthouse, pas par un humain.
- ❌ `staging` → terme jamais utilisé dans ce repo. Source d'amalgame externe.

**À utiliser à la place** :

- ✅ "Machine DEV" pour parler du poste opérateur
- ✅ "Container PREPROD (hôte PROD, port 3200)" pour parler du container CI éphémère
- ✅ "Container PROD (hôte PROD, 80/443)" pour parler du runtime utilisateur
- ✅ "Tag `:preprod`" pour parler de l'artefact Docker spécifiquement (pas d'environnement)

## Triggers Git → environnement

| Trigger git | Workflow | Image produite | Cible runtime | Latence | Validation humaine ? |
|-------------|----------|----------------|---------------|---------|----------------------|
| Fusion d'une PR sur `main` (push `main`) | `.github/workflows/ci.yml` job `deploy` | `:sha-<commit>` et alias `:preprod` sur DockerHub (`build.yml`) | container PREPROD (hôte PROD, port 3200) redémarré | ~10 min | NON (E2E Smoke + Lighthouse CI automatiques) |
| `push origin v*` (tag) | `.github/workflows/deploy-prod.yml` | promote l'image du commit → `:production` | container PROD (hôte PROD, 80/443) redémarré | ~5 min | OUI (tag manuel = décision de l'owner) |
| `workflow_dispatch` manuel sur `deploy-prod.yml`, lancé sur un tag `v*` | idem `deploy-prod.yml` | idem | idem PROD | idem | OUI |

**Règles mnémoniques** :

- Fusion sur `main` = **build + push tag `:preprod` + redéploiement container PREPROD CI**. **Pas de redéploiement PROD.** `main` est protégée : jamais de push direct.
- Fusion sur `main` qui modifie `scripts/monitoring/*.sh` = `deploy-monitoring-scripts.yml` installe aussi ces scripts dans `/usr/local/bin` de l'hôte PROD, hors des conteneurs : la fusion modifie alors l'hôte PROD.
- `git tag v… && git push --tags` = **promotion de l'image du commit → `:production` + redéploiement container PROD**.
- Jamais annoncer "déployé en PROD" après un simple merge sur `main`.

## Contrat env CI (preflight)

Le `.env.preprod` heredoc-généré par le step `🧪 Deploy to PREPROD` (ci.yml) est validé **avant**
`docker compose up` par `scripts/ci/preflight-env-contract.ts` contre le SoT Zod
`backend/src/contract/env-contract/preprod.schema.ts` → CI fail immédiat lisible plutôt qu'un
crash boot NestJS opaque. Vars couvertes (boot-crash si absentes/mal-formées) : `NODE_ENV`
(literal `preprod`), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon only, ADR-028 Option D),
`JWT_SECRET` (≥32c, PR #606), `SESSION_SECRET` (≥32c, fail-fast), `READ_ONLY=true` (ADR-028),
`REDIS_URL` (`^rediss?://`). `.passthrough()` Phase 1 : les vars hors-contrat passent
(Phase 2 = convergence runtime/CI/schemas + ratchet, ADR follow-up).

## Workflow nominal — Promote DEV (code) → PROD

1. **L'owner fusionne la PR** sur `main`, sous sa protection, après validation manuelle explicite
   (T6 de `rules-technical` du vault). Un agent ne fusionne jamais (ADR-102 D2 du vault) : il remet
   le numéro de PR, le SHA de tête (40 caractères) et la commande de fusion épinglée sur ce SHA.
   `ci.yml` déploie alors le container PREPROD.
2. Vérifier sur le run `ci.yml` du commit que `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests` et
   `🔦 Lighthouse Performance Audit` sont en `success` :
   `gh run list --repo ak125/nestjs-remix-monorepo --workflow ci.yml --branch main --limit 5`.
   Le job `🧪 Deploy PREPROD` contrôle lui-même la version servie (`/health`, champ `revision`) ;
   PREPROD n'écoute que sur la boucle locale de l'hôte PROD.
3. **L'owner pose le tag semver** sur ce commit et le pousse ; le hook `pretool-bash-guard.sh`
   bloque ce geste pour un agent :
   `git tag v2.1.0 <sha40> && git push origin v2.1.0`.

Ou via UI GitHub : `Actions → "Deploy PROD (via tag)" → Run workflow`, en choisissant le **tag** `v*`
dans « Use workflow from ». Le run exécute le `deploy-prod.yml` de la ref choisie, et le formulaire
propose `main` par défaut : lancé sur `main` dont PREPROD a validé la tête, le workflow déploierait
ce commit sans tag `v*` et publierait l'image sous le nom de la ref (`:main`). La preuve PREPROD de
ce commit lui suffit ; rien ne vérifie qu'un tag `v*` porte la décision de l'owner. Sur une branche
dont la tête est un commit de `main` qui contient #1696 et que PREPROD a validé, il ferait de même
sous le nom de la branche si ce nom est un tag Docker valide (sans `/`) ; sinon il refuse au
contrôle de ce nom, mais après avoir remplacé `:production-previous` (voir Rollback, #1288). Sur une
autre ref, le résultat suit le workflow de cette ref, comme pour un tag (voir Rollback) : au
2026-11-01, 25 branches distantes en portent un sans garde de label ni preuve PREPROD. Sur 24
d'entre elles (nom avec `/`), le run s'arrête avant tout push, mais après avoir fait pointer le tag
local `:production` de l'hôte du runner sur l'image `:preprod` ; sur la 25e, il promeut l'alias
`:preprod` courant vers PROD.

## Rollback

| Environnement | Procédure |
|---|---|
| **PREPROD** | PR de revert du commit fautif (`git revert <sha>` sur une branche, puis `gh pr create`), fusionnée par l'owner comme toute PR. Le push `main` qui en résulte relance le cycle. Jamais de push direct ni de force-push sur `main`. |
| **PROD, pendant un déploiement** | Automatique : après le point de non-retour, tout échec de `deploy-prod.yml` déclenche `⏪ Rollback PROD`, qui redémarre l'image capturée avant la mutation. |
| **PROD, après un déploiement réussi** | L'owner relance `Deploy PROD (via tag)` (`workflow_dispatch`) sur le tag `v*` de la version à restaurer, dans les limites ci-dessous. |
| **PROD, workflow indisponible, tag refusé ou tag sans garde** | Intervention manuelle de l'owner sur l'hôte PROD, par la console de l'hébergeur. Aucun agent ne modifie PROD ni ne s'y connecte. |

Le run relancé exécute le `deploy-prod.yml` **du tag choisi**, pas celui de `main`. Ses contrôles
dépendent des commits que contient le tag (302 tags `v*` au 2026-11-01 ; dates de fusion en UTC) :

- tag qui contient #1881, #1884 et #1887 (2026-10-24 et 2026-10-25 ; au 2026-11-01, seul le tag du
  2026-10-30) : contrôles complets, dont `/health` `revision` ;
- tag qui contient #1696 (2026-10-02) mais pas #1881 (13 tags) : preuve PREPROD et provenance de
  `:sha-<commit>` vérifiées, mais ni contrôle de la version servie, ni champ `revision` dans `/health` ;
- tag qui contient `ed10ec6e5` (2026-04-21) mais pas #1696 (94 tags) : son workflow s'arrête si le
  label `revision` de l'alias `:preprod` diffère du commit du tag, avant de toucher `:production` et
  le conteneur PROD. L'alias suit `main` : le refus est la règle dès qu'un commit plus récent a été
  construit ;
- tag qui ne contient pas `ed10ec6e5` (194 tags) : **aucune garde de provenance** ; seuls des
  contrôles HTTP de santé, dont `/health`, suivent le déploiement. Son workflow promeut l'alias
  `:preprod` courant vers `:production`, le pousse sous le nom du tag (ce qui écrase le tag Docker de
  la version d'origine) et redémarre PROD, quel que soit le commit de l'alias. Le rollback
  automatique de 39 d'entre eux revient à `:production-previous`, copié de `:production` après la
  promotion : il redémarre l'image promue. **Ne jamais le relancer.**

Un tag qui contient #1288 (2026-07-18 ; 40 tags : les 14 qui contiennent #1696 et 26 de la classe
`ed10ec6e5`) réétiquette `:production-previous` sur l'image en service et le pousse avant de
vérifier la provenance de l'image : un run refusé à ce stade remplace le point de retour précédent.
Les 14, et 5 des 26 qui contiennent aussi #1598 (2026-09-29), vérifient d'abord la preuve PREPROD
du commit (`scripts/ci/prod-preprod-evidence.mjs`) : si le run `ci.yml` manque ou n'est pas
lisible, ils refusent avant toute mutation. Les 26 refusent ensuite sur le label de `:preprod`,
selon leur classe. Les 14 supposent aussi que `:sha-<commit>` est encore dans le registre : sans
l'image, ils refusent avant de toucher `:production` et le conteneur PROD, mais après la capture. Après un tel refus, l'intervention manuelle ne s'appuie pas sur
`:production-previous` ; elle désigne l'image à restaurer par le tag Docker poussé à son déploiement
(nom du tag `v*`), ou par `:sha-<commit>` si cette image est encore dans le registre.

Un revert sur `main` ne change pas PROD : il redéploie PREPROD.

Voir `feedback_rollback_via_revert_pr_branch_protected.md` : main est branch-protected, jamais de force-push.

## Monitoring & inspection

- **GitHub Actions** : `https://github.com/ak125/nestjs-remix-monorepo/actions`
- **PREPROD + PROD (hôte PROD)** : aucun accès agent. Les logs des jobs `ci.yml` et
  `deploy-prod.yml` montrent les contrôles de déploiement ; les conteneurs
  `nestjs-remix-monorepo-preprod` (3200, READ_ONLY) et `nestjs-remix-monorepo-prod` (80/443) ne
  s'inspectent que par l'owner, depuis la console de l'hébergeur.
- **Machine DEV** : poste SSH — aucun container deploy attendu.
  Logs : la sortie du backend (`npm run dev` → nodemon → `node dist/main.js`, cwd `backend/`) va dans
  le journal de l'unit (`journalctl --user -u automecanik-dev`) une fois la bascule faite ; avant,
  dans le terminal qui l'a lancé, **non persistée** (aucun transport fichier) ; resync cron
  `/tmp/sync-dev-runtime-cron.log` ; `npm ci`/build du resync `${TMPDIR:-/tmp}/sync-dev-runtime-npm-{install,build}-<pid>.log` ;
  dumps `/var/crash` (axe 6).
- **Health** : local `curl http://localhost:3000/health` (machine DEV, si `npm run dev` tourne) ·
  PREPROD : lu par le job `🧪 Deploy PREPROD` sur l'hôte PROD (port 3200, non exposé) ·
  PROD `curl https://www.automecanik.com/health` (lecture seule ; `revision` = version servie)

## Secrets GitHub Actions

`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PREPROD_SESSION_SECRET`, `CRUX_API_KEY`, `TURBO_TOKEN`/`TURBO_TEAM` (optionnel).

Secrets SOPS : `secrets/sentry.dev.sops.env`, `secrets/sentry.prod.sops.env` (clés age dans `.sops.yaml`).

## Règles strictes (récapitulatif)

- `main` → déploiement **PREPROD container CI uniquement** (jamais PROD direct).
- Tag `v*` → déploiement **PROD container live**.
- Branche `dev` → `ci.yml` se déclenche aussi sur un push `dev`, mais `build.yml` et `🧪 Deploy PREPROD` ne publient et ne déploient que depuis `main`. Au 2026-11-01, la branche `dev` n'existe pas sur le dépôt distant.
- **No Paid Render** — Docker + Caddy self-hosted exclusivement.
- **Port 3000** = port canonique du backend NestJS (local `npm run dev` ou interne container). Pas de repro sur port alternatif (cf. `feedback_no_bricolage_no_alt_port_repro.md`).
- **Port 3200** = port host du container PREPROD sur l'hôte PROD (mapping `3200:3000`, boucle locale).
- **DEV n'héberge aucun container `:preprod` ni `:production`** — c'est un poste de travail SSH, pas un host runtime.

## Mémoires Claude liées

- [[deployment-topology-canonical]] — résumé mémoire chargé à chaque session
- [[feedback_no_preprod_env_only_dev_to_prod]] — interdit la confusion 3-étages
- [[feedback_no_bricolage_no_alt_port_repro]] — port 3000 canon
- [[feedback_no_overclaim_security_words]] — ne pas dire "déployé en prod" sur merge main
