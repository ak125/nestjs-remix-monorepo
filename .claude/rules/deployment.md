---
# Chargée à la demande : quand l'agent lit un fichier qui correspond à ces chemins.
# Hors de ces chemins, CLAUDE.md (invariant 8) et AGENTS.md pointent ici avant toute
# action infra. Le lint check-preprod-vocabulary.sh reste la garde mécanique.
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

# Deployment — vocabulaire strict et procédure

> **Charger ce fichier AVANT toute action sur l'infra de déploiement.**
> Le vocabulaire DEV / PREPROD / PROD est strict. Il est décidé au vault : ADR-075 (accepté le
> 2026-11-10) et règle `rules-deployment-workflow` 2.0.0. Ce fichier le transmet aux agents du
> monorepo ; il ne fonde pas la décision. Un écart avec la règle ou avec le code est un constat à
> signaler (ADR-101 D3), jamais à arbitrer en silence.
> Le lint CI `scripts/lint/check-preprod-vocabulary.sh` en est la garde : il bloque les
> formulations interdites (voir plus bas).

## Glossary — 3 environnements distincts, 2 machines physiques

| Terme | Rôle réel | Machine physique | Ports | Image Docker | Trafic |
|-------|-----------|------------------|-------|--------------|--------|
| **DEV** | Machine de dev opérateur | hôte DEV | `3000` (via `npm run dev`) | **aucune image deploy ici** | Opérateur SSH, code-side |
| **PREPROD** | Pile de CI : l'application et ses quatre services d'appui | hôte PROD | `3200` (boucle locale, publié par le proxy de la pile) | `massdoc/nestjs-remix-monorepo:preprod` | **CI uniquement** : E2E Smoke + Lighthouse ; application en `READ_ONLY=true`, sans accès direct à la base |
| **PROD** | Container live trafic | hôte PROD (même machine, derrière Caddy) | `80`/`443` (public) | `massdoc/nestjs-remix-monorepo:production` | Utilisateurs finaux via `www.automecanik.com` |

Les machines sont nommées par leur rôle, jamais par adresse IP ni nom d'hôte : le dépôt est public
(ADR-075 D4).

La pile PREPROD compte cinq conteneurs ([`docker-compose.preprod.yml`](../../docker-compose.preprod.yml)) :
l'application (`monorepo_preprod`), son proxy (`caddy_preprod`, seul à publier un port),
`imgproxy_preprod`, `redis_preprod` et la passerelle `readonly_preprod`. L'application ne reçoit ni
clé de la base ni `DATABASE_URL` et n'est reliée qu'à un réseau interne : elle lit la base par la
passerelle, seule à détenir une clé, qui ne transmet que des lectures (#1963, #1964). Le job
`🧪 Deploy PREPROD` contrôle ces points à chaque déploiement.

**Sources de cette table** : [`.sops.yaml`](../../.sops.yaml) (rôle des machines), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) (job `🧪 Deploy PREPROD`), [`docker-compose.preprod.yml`](../../docker-compose.preprod.yml), [`.github/workflows/release-prod.yml`](../../.github/workflows/release-prod.yml).

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
- Le push d'un tag git `v*` sélectionne **`:sha-<SHA complet du commit>`**, publié par le même build. Après contrôle du label de provenance, `release-prod.yml` publie le tag de version sur son **identifiant local immuable**. `:production` n'est déplacé vers cet identifiant qu'après le point de non-retour (`DEPLOY_STARTED=1`), où tout échec déclenche le rollback : un refus de `.env` ou de flag avant ce point laisse `:production` sur la version en service. Un déplacement de `:preprod` ne change plus cette sélection.
- Ce n'est **pas une référence stable** — pour debug historique ou rollback, utiliser un SHA git ou un tag semver explicite.
- Le label SHA de l'image sélectionnée prouve la **provenance**, pas la **validation** : `release-prod.yml` refuse aussi, avant toute mutation, un commit dont le run `ci.yml` (push `main`) n'a pas `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests` et `🔦 Lighthouse Performance Audit` en `success` (`scripts/ci/prod-preprod-evidence.mjs`). Un commit dont le run a été annulé par un merge suivant n'est pas validé : taguer le dernier commit vert.
- Le déploiement PREPROD exécute lui aussi `:sha-<commit du run>`, vérifié par son label puis réétiqueté `:preprod` en local : relancer un ancien job ne sert plus l'image d'un commit plus récent. La **version servie** est contrôlée après le démarrage : le conteneur doit tourner sur l'identifiant vérifié et `/health` doit renvoyer `revision` égal à ce commit (`GIT_SHA`, posé par `build.yml` et le `Dockerfile` ; `null` hors image). `release-prod.yml` fait les mêmes contrôles (identifiant promu, `revision` égal au commit du tag) dans `🚀 Deploy to PROD` et `✅ Validate PROD` ; un écart échoue et déclenche le rollback.

## Pièges de nommage INTERDITS (CI lint enforcé)

Toute occurrence des patterns ci-dessous dans un fichier `.md` du repo (hors errata explicites et fichiers de l'allowlist du lint, dont celui-ci) fait échouer le job `no-confusing-preprod-formulations` (workflow [`preprod-vocabulary-guard.yml`](../../.github/workflows/preprod-vocabulary-guard.yml)) :

- ❌ `DEV pré-prod` ou `DEV preprod` → confond 2 machines distinctes (hôte DEV vs hôte PROD)
- ❌ `preprod.automecanik.com` → hostname inexistant. Aucune URL publique n'expose PREPROD.
- ❌ `preprod miroir` ou `miroir de PROD` → faux. PREPROD est `READ_ONLY=true` (ADR-028 Option D), pas une réplique de PROD.
- ❌ `déployé en pré-prod, à valider avant prod` → personne n'interagit avec PREPROD ; c'est CI-only, validé par E2E Smoke + Lighthouse, pas par un humain.
- ❌ `staging` → terme jamais utilisé dans ce repo. Source d'amalgame externe.

**À utiliser à la place** :

- ✅ "Machine DEV" pour parler du poste opérateur
- ✅ "PREPROD (pile de CI de l'hôte PROD, port 3200)" pour parler de l'environnement ; "container PREPROD" désigne l'application de cette pile
- ✅ "Container PROD (hôte PROD, 80/443)" pour parler du runtime utilisateur
- ✅ "Tag `:preprod`" pour parler de l'artefact Docker spécifiquement (pas d'environnement)

## Triggers Git → environnement

| Trigger git | Workflow | Image produite | Cible runtime | Latence | Validation humaine ? |
|-------------|----------|----------------|---------------|---------|----------------------|
| Fusion d'une PR sur `main` (push `main`) | `.github/workflows/ci.yml` job `deploy` | `:sha-<commit>` et alias `:preprod` sur DockerHub (`build.yml`) | pile PREPROD (hôte PROD, port 3200) redémarrée sur l'image du commit | ~10 min | NON (E2E Smoke + Lighthouse CI automatiques) |
| `push origin v*` (tag) | `.github/workflows/release-prod.yml` | promote l'image du commit → `:production` | container PROD (hôte PROD, 80/443) redémarré | ~5 min | OUI (tag manuel = décision de l'owner) |
| `workflow_dispatch` manuel sur `release-prod.yml`, lancé sur un tag `v*` qui contient ce fichier (toute autre ref est refusée à la première étape ; voir « Ou via UI GitHub ») | idem `release-prod.yml` | idem | idem PROD | idem | OUI |

**Règles mnémoniques** :

- Fusion sur `main` = **build + push tag `:preprod` + redéploiement de la pile PREPROD**. **Pas de redéploiement PROD.** `main` est protégée : jamais de push direct.
- `ci.yml` ne filtre pas les chemins : **toute** fusion sur `main` lance le cycle PREPROD, y compris celle d'une PR de documentation et celle qu'exécute une porte de fusion automatique (ADR-124 D7). Un run encore en attente est remplacé par celui de la fusion suivante.
- Fusion sur `main` qui modifie `scripts/monitoring/*.sh` = `deploy-monitoring-scripts.yml` installe aussi ces scripts dans `/usr/local/bin` de l'hôte PROD, hors des conteneurs : la fusion modifie alors l'hôte PROD. Ce workflow se lance aussi à la main (`workflow_dispatch`).
- `git tag v… && git push --tags` = **promotion de l'image du commit → `:production` + redéploiement container PROD**.
- Jamais annoncer "déployé en PROD" après un simple merge sur `main`.
- Jamais écrire « déployé » sans la version servie de l'environnement (tableau ci-dessous).
- Jamais de tag `latest`. Un alias (`:preprod`, `:production`) ne sert pas de référence de version : citer le commit, le tag `v*` ou `:sha-<commit>`.

## Six objets, six preuves

Chaque objet a sa preuve ; aucun ne prouve le suivant (ADR-075 D3).

| Objet | Preuve | Ne prouve pas |
|---|---|---|
| Commit sur `main` | SHA de 40 caractères, commit de fusion de la PR | qu'une image existe ou qu'elle soit déployée |
| Tag `v*` | `git tag --points-at <sha>` | que le déploiement PROD ait réussi |
| Image | identifiant d'image et label `org.opencontainers.image.revision` de `:sha-<commit>` | qu'elle tourne ; un alias ne désigne pas une version |
| Environnement | son rôle (glossaire) | la version qu'il sert |
| Preuve CI | jobs en `success` sur le run `ci.yml` du commit, run `release-prod.yml` en `success` | que la version soit encore servie |
| Version servie | `/health` de l'environnement, `revision` égal au SHA attendu, lu et daté | quoi que ce soit sur un autre environnement |

Une fusion, un tag ou une CI verte se nomment comme tels.

## Contrat env CI (preflight)

Le `.env.preprod` heredoc-généré par le step `🧪 Deploy to PREPROD` (ci.yml) est validé **avant**
`docker compose up` par `scripts/ci/preflight-env-contract.ts` contre le SoT Zod
`backend/src/contract/env-contract/preprod.schema.ts` → CI fail immédiat lisible plutôt qu'un
crash boot NestJS opaque. Vars couvertes (boot-crash si absentes/mal-formées) : `NODE_ENV`
(literal `preprod`), `SUPABASE_URL` (une URL) et `SUPABASE_ANON_KEY` (≥20c), `JWT_SECRET`
(≥32c, PR #606), `SESSION_SECRET` (≥32c, fail-fast), `READ_ONLY=true` (ADR-028),
`REDIS_URL` (`^rediss?://`). `.passthrough()` Phase 1 : les vars hors-contrat passent
(Phase 2 = convergence runtime/CI/schemas + ratchet, ADR follow-up).

Depuis #1963 et #1964, le fichier généré donne à l'application l'URL de la passerelle
`readonly_preprod` et une valeur fixe, non secrète, à la place d'une clé de la base (ADR-028
Option D). Après le démarrage, le même step échoue si le conteneur de l'application est relié à
autre chose qu'un seul réseau interne, s'il porte `DATABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY`,
ou si la passerelle accepte une écriture.

## Workflow nominal — Promote DEV (code) → PROD

1. **La PR est fusionnée** sur `main`, sous sa protection, selon T6 de `rules-technical` (vault) :
   par l'owner, sur une tête épinglée, ou automatiquement dans un périmètre adopté puis activé selon
   ADR-123 (au 2026-11-10, le seul périmètre actif est celui d'ADR-124 : documentation Markdown du
   monorepo). Hors d'un tel périmètre, un agent ne lance jamais de fusion et n'active jamais
   d'auto-fusion (ADR-121 D4) : il remet le numéro de PR, le SHA de tête (40 caractères) et la
   commande de fusion épinglée. Dans les deux cas la fusion est un push `main` : `ci.yml` déploie
   la pile PREPROD.
2. Vérifier sur le run `ci.yml` du commit que `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests` et
   `🔦 Lighthouse Performance Audit` sont en `success` :
   `gh run list --repo ak125/nestjs-remix-monorepo --workflow ci.yml --branch main --limit 5`.
   Le job `🧪 Deploy PREPROD` contrôle lui-même la version servie (`/health`, champ `revision`) ;
   PREPROD n'écoute que sur la boucle locale de l'hôte PROD. Un run annulé par une fusion suivante
   ne valide pas son commit : prendre le dernier commit vert.
3. **L'owner pose le tag semver** sur ce commit et le pousse, après avoir noté le tag `v*` de la
   version en service, qui sert de point de retour (voir Rollback) ; le hook
   `pretool-bash-guard.sh` bloque ce geste pour un agent :
   `git tag v2.1.0 <sha40> && git push origin v2.1.0`.
4. `release-prod.yml` refuse d'abord, sans rien modifier, un commit sans ces trois jobs verts. Il
   capture ensuite l'image en service comme point de rollback : son identifiant, épinglé pour le
   run, et l'alias `:production-previous`, poussé au registre (un échec de ce push n'arrête pas le
   run). Il vérifie le label `revision` de `:sha-<commit>` et la publie sous le nom du tag (section
   « Mécanique du tag Docker »). Avant le point de non-retour, il copie aussi les fichiers compose
   et met à jour le `.env` de l'hôte. Passé ce point, il déplace `:production`, charge le Caddyfile
   du commit (`scripts/ci/prod-caddy-config.sh` : fichier validé dans le Caddy en service, s'il
   tourne, avant d'être écrit ; Caddy recréé si le fichier a changé, n'a pas encore été chargé, ou
   si sa définition compose a changé), remplace le conteneur PROD et contrôle `/health` (`revision`
   égal au commit du tag).
5. Si le conteneur PROD est absent de l'hôte, il n'y a pas d'image à capturer : le workflow refuse
   avant toute mutation. Le mode `break_glass_no_rollback_point` (entrée du `workflow_dispatch`, ou
   variable de dépôt `PROD_BREAK_GLASS_NO_ROLLBACK_POINT`) lève ce refus : le run déploie alors
   **sans point de rollback**. C'est une décision de l'owner, prévue pour un premier déploiement ou
   un hôte reconstruit. La variable de dépôt vaut pour tout run : tant qu'elle reste à `true`,
   l'absence du conteneur PROD ne fait refuser aucun run. Si le conteneur PROD existe, le mode ne
   change rien : l'image est capturée.

Ou via UI GitHub : `Actions → "🚀 Release PROD (tag v*)" → Run workflow`, en choisissant le
**tag** `v*` dans « Use workflow from ». Le run exécute le `release-prod.yml` de la ref choisie, et
le formulaire propose `main` par défaut. La première étape, `🔖 Release ref gate`, refuse toute ref
autre qu'un tag `v*` (`refs/tags/v…`, sans `/` après le `v`, comme le déclencheur `push`), avant le
checkout et avant toute action sur l'hôte : lancé sur `main` ou sur une branche, le run échoue sans
rien modifier. Elle lit `GITHUB_REF`, posé par le runner ; aucune entrée du formulaire ne le change.
Une ref dont le commit ne contient pas `release-prod.yml` ne peut pas lancer ce workflow.

### Ancien workflow `deploy-prod.yml`, retiré

Jusqu'au renommage, le workflow s'appelait `deploy-prod.yml` (« Deploy PROD (via tag) »). GitHub
identifie un workflow par son chemin et un run exécute la copie de sa ref : les tags `v*` et les
branches antérieurs au renommage portent encore ce fichier. Au 2026-11-13, les 305 tags `v*` le
portent ; un seul contient la garde de ref (#2010), et 194 n'ont aucune garde de provenance (leur
run promeut l'alias `:preprod` courant vers PROD).
Après la fusion du renommage (#2046), l'API renvoie `deleted` pour ce workflow, parce que son
fichier n'est plus sur `main` :
`gh api repos/ak125/nestjs-remix-monorepo/actions/workflows/deploy-prod.yml --jq .state`. Cet état
n'est pas une désactivation : un push de tag déclenche les workflows du commit tagué, y compris ceux
absents de la branche par défaut (documentation GitHub, événement `push`). Un tag `v*` posé sur un
commit antérieur à #2046 lance donc l'ancien fichier.

L'owner désactive ce workflow depuis son propre compte GitHub (onglet Actions, workflow, « … »,
« Disable workflow ») ; l'état attendu est alors `disabled_manually`. L'identité `gh` de la machine
DEV est un jeton d'application sans droit d'écriture sur Actions : `gh workflow disable` y répond
`HTTP 403: Resource not accessible by integration`. Un ruleset de tags `v*` qui réserve leur
création à l'owner ferme la même voie côté serveur, désactivation possible ou non.

Désactivé ou non : **ne lancer aucun run de `deploy-prod.yml`, ne pas le réactiver, ne pas pousser
de tag `v*` sur un commit qui ne contient pas `release-prod.yml`.** Remettre une version antérieure
au renommage relève de l'intervention manuelle (Rollback, dernière ligne).

## Rollback

| Environnement | Procédure |
|---|---|
| **PREPROD** | PR de revert du commit fautif (`git revert <sha>` sur une branche, puis `gh pr create`), fusionnée comme toute PR (étape 1 du workflow nominal). Le push `main` qui en résulte relance le cycle. Jamais de push direct ni de force-push sur `main`. |
| **PROD, pendant un déploiement** | Automatique : après le point de non-retour, tout échec de `release-prod.yml` déclenche `⏪ Rollback PROD` (`scripts/ci/prod-rollback.sh`), qui remet `:production` sur l'image capturée avant la mutation et la redémarre. Il ne restaure que l'image : le Caddyfile, les fichiers compose et le `.env` posés par ce déploiement restent en place, et ses vérifications (`/health`, SSR) se font dans le conteneur, sans passer par Caddy. Un run annulé ou interrompu après le point de non-retour (annulation manuelle, perte du runner) ne déclenche pas ce rollback : dernière ligne. **Ne jamais annuler un run en cours de déploiement.** En mode break-glass (étape 5), si le conteneur PROD était absent, aucune image n'a été capturée : l'étape échoue et renvoie à l'intervention manuelle (dernière ligne). |
| **PROD, après un déploiement réussi** | L'owner relance `Release PROD (tag v*)` (`workflow_dispatch`) sur le tag `v*` de la version à restaurer, si ce tag contient `release-prod.yml`. |
| **PROD, workflow indisponible, run annulé ou interrompu après le point de non-retour, ou version à restaurer antérieure au renommage** | Intervention manuelle de l'owner sur l'hôte PROD, par la console de l'hébergeur. Aucun agent ne modifie PROD ni ne se connecte à son hôte ; lire `/health` par l'URL publique n'est pas une modification. |

Le run relancé exécute le `release-prod.yml` **du tag choisi**, pas celui de `main`. Un tag qui le
contient contient aussi la garde de ref (#2010), le contrôle de la version servie (#1881, #1884,
#1887) et le traitement du Caddyfile (#1961) : ce sont les contrôles de l'étape 4. Un contrôle
ajouté plus tard ne vaut que pour les tags qui le contiennent.

Pour une version antérieure au renommage, l'intervention manuelle ne s'appuie pas sur
`:production-previous`, qu'un ancien run a pu remplacer ; elle désigne l'image à restaurer par
`:sha-<commit>` si cette image est encore dans le registre, sinon par le tag Docker poussé à son
déploiement (nom du tag `v*`). Un ancien workflow a pu réécrire ce tag Docker avec une autre image :
vérifier son label `org.opencontainers.image.revision` avant de l'utiliser.

Un revert sur `main` ne change pas PROD : il redéploie PREPROD. PROD ne change que par un tag `v*`
(workflow nominal) ou par une ligne de ce tableau.

Voir `feedback_rollback_via_revert_pr_branch_protected.md` : main est branch-protected, jamais de force-push.

## Monitoring & inspection

- **GitHub Actions** : `https://github.com/ak125/nestjs-remix-monorepo/actions`
- **PREPROD + PROD (hôte PROD)** : aucun accès agent. Les logs des jobs `ci.yml` et
  `release-prod.yml` montrent les contrôles de déploiement ; la pile PREPROD (application
  `nestjs-remix-monorepo-preprod` en `READ_ONLY=true`, derrière son proxy `caddy-preprod` sur le
  port 3200 de la boucle locale) et le conteneur `nestjs-remix-monorepo-prod` (80/443) ne
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

La liste fait foi dans les workflows, pas ici :
`grep -o 'secrets\.[A-Z0-9_]*' .github/workflows/<fichier>.yml | sort -u`. Au 2026-11-10 :

- `ci.yml` (chaîne PREPROD) ne lit ni clé de la base ni `DATABASE_URL`. Il lit
  `PREPROD_JWT_SECRET`, `PREPROD_SESSION_SECRET`, `SUPABASE_URL`, `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN`,
  `CRUX_API_KEY`, `SLACK_WEBHOOK_URL` et `TURBO_TOKEN`/`TURBO_TEAM`. La clé de la passerelle
  PREPROD n'est pas un secret GitHub : elle est posée à part sur l'hôte, jamais copiée de PROD par
  la CI, et le job `🧪 Deploy PREPROD` refuse avant d'arrêter un conteneur si elle manque ;
- `release-prod.yml` lit les secrets de PROD : clés de la base (`SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`), secrets `PROD_*`, `DOCKERHUB_*`, `SLACK_WEBHOOK_URL` ;
- `build.yml` lit `DOCKERHUB_*` et `VITE_GOOGLE_CLIENT_ID` ; `deploy-monitoring-scripts.yml` n'en
  lit aucun.

Secrets SOPS : `secrets/sentry.dev.sops.env`, `secrets/sentry.prod.sops.env` (clés age dans `.sops.yaml`).

## Règles strictes (récapitulatif)

- `main` → déploiement de la **pile PREPROD de CI uniquement** (jamais PROD direct).
- Tag `v*` → déploiement **PROD container live**.
- Branche `dev` → `ci.yml` se déclenche aussi sur un push `dev`, mais `build.yml` et `🧪 Deploy PREPROD` ne publient et ne déploient que depuis `main`. Au 2026-11-10, la branche `dev` n'existe pas sur le dépôt distant.
- **Ne jamais annuler un run `release-prod.yml` en cours** : passé le point de non-retour, l'annulation ne déclenche pas le rollback.
- **No Paid Render** — Docker + Caddy self-hosted exclusivement.
- **Port 3000** = port canonique du backend NestJS (local `npm run dev` ou interne container). Pas de repro sur port alternatif (cf. `feedback_no_bricolage_no_alt_port_repro.md`).
- **Port 3200** = port host de la pile PREPROD sur l'hôte PROD, publié par son proxy `caddy_preprod` (mapping `3200:3000`, boucle locale).
- **DEV n'héberge aucun container `:preprod` ni `:production`** — c'est un poste de travail SSH, pas un host runtime.

## Mémoires Claude liées

- [[feedback_no_preprod_env_only_dev_to_prod]] — interdit la confusion 3-étages
- [[feedback_no_bricolage_no_alt_port_repro]] — port 3000 canon
- [[feedback_no_overclaim_security_words]] — ne pas dire "déployé en prod" sur merge main
