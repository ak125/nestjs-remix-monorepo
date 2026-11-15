# Actions automatiques : inventaire et recommandations (mandat AM, 2026-11-16)

Département 21, Plateforme et exploitation. Ce document est un relevé : il ne change aucun réglage,
aucun workflow et aucune tâche. Les recommandations sont des propositions pour Marwane.

**Relevé fait le 2026-11-15 entre 23:47 et 23:50 UTC**, depuis la machine DEV, en lecture seule :
`gh` (jeton d'application sans droit d'écriture sur Actions), base en transaction `read only`
(`transaction_read_only=on`, lu dans la même session), Redis `redis-dev` (`SCAN`/`ZRANGE`).
La base est unique pour DEV, PREPROD et PROD : ses relevés valent pour PROD. Ce n'est pas le cas
des réglages et des files Redis de PROD, qui sont à constater en PROD (dernière section).

Départements : le socle relève du **21** ; l'outillage d'agents (Claude, canon des agents) relève du **23**.
Les recommandations prennent l'une de quatre valeurs : **garder**, **couper**, **réveiller** ou **fusionner**.

## 1. Tâches planifiées du backend

### Fait structurant : `ScheduleModule` est désactivé, donc aucun `@Cron` ne tourne

`ScheduleModule.forRoot()` est commenté dans `backend/src/app.module.ts` (lignes 13 et 114).
Un décorateur `@Cron` ne s'exécute donc nulle part. Le dépôt en compte trois, chacun marqué
`INERT-OK-NO-SCHEDULER`. La garde `cron-schedulemodule-guard.yml` empêche d'en ajouter un sans
cette marque. Les tâches réellement planifiées passent par des jobs répétables Bull ou BullMQ
(Redis) et par `pg_cron` (base).

### 1.1 Commandes, en premier : `order-cleanup`

| | |
|---|---|
| **Ce que ça fait** | `OrderCleanupService` (`backend/src/modules/orders/services/order-cleanup.service.ts`). **:24**, `@Cron('0 */15 * * * *')` : passe à `failed` les lignes `order_idempotency` restées `processing` (création de commande interrompue). **:58**, `@Cron(EVERY_HOUR)` : supprime les lignes `order_idempotency` et `order_resume_tokens` expirées. |
| **Déclencheur** | `@Cron`, **inerte** (pas de `ScheduleModule`). |
| **Réglage d'activation** | aucun ; il faudrait réactiver le planificateur ou migrer vers un job répétable (TODO du code, PR #487). |
| **Dernière exécution visible** | **jamais** (base partagée, lue à 23:49:08Z). `order_idempotency` contient 58 lignes **toutes expirées**, la plus ancienne depuis le 2026-04-09, sans purge. `order_resume_tokens` contient 56 jetons expirés, le plus ancien depuis le 2026-03-27, sans purge. 0 ligne `processing` de plus de 15 min : le premier traitement n'a aujourd'hui rien à rattraper. |
| **Utilité** | moyenne. Sans purge, la table reste petite (58 lignes). Le passage `processing` → `failed` débloque une clé d'idempotence si une création de commande est interrompue ; ce cas n'est pas observé aujourd'hui. |
| **Risque** | faible aujourd'hui. Il augmente avec le volume : une clé bloquée en `processing` empêcherait le client de rejouer sa commande. **Zone STOP** (panier et commande) : toute réactivation demande un accord nominatif. |
| **Département** | 21 |
| **Recommandation** | **réveiller**, sous mandat nominatif « commande » : migrer les deux traitements vers un job répétable BullMQ, comme pour le plan sitemap de la PR #487. Ne rien faire dans ce mandat. |

### 1.2 Fournisseurs : `supplier-sync`

| | |
|---|---|
| **Ce que ça fait** | Synchronise les offres des fournisseurs : connexion aux portails CAL et Inoshop, puis `INSERT` dans `supplier_offer_snapshot`. Plafond par passage : `SUPPLIER_SYNC_MAX_REFS_PER_RUN` (50 par défaut). Le passage unique (`backend/src/workers/run-supplier-sync-once.ts`) exige `SUPPLIER_SYNC_ONESHOT_CONFIRM`. |
| **Déclencheur** | job répétable Bull, `0 */4 * * *`. |
| **Réglage d'activation** | `SUPPLIER_TRUTH_SYNC_ENABLED`, strictement `=== 'true'` (`supplier-sync.flag.ts:16`). |
| **Dernière exécution visible** | **jamais**. `supplier_offer_snapshot` contient 0 ligne, toutes dates confondues (base partagée, 23:49:08Z). DEV ne contient aucune clé `bull:*:repeat` de cette file. En PROD : à constater (réglage). |
| **Utilité** | élevée en principe : c'est la boucle tarif et disponibilité, liée aux ventes annulées « pas dispo ». Elle est nulle tant que la tâche est éteinte. |
| **Risque** | élevé si elle est allumée sans cadre : connexions authentifiées à des portails tiers, écritures de prix d'achat (**zone STOP** prix et stock). Éteinte, elle ne présente aucun risque. |
| **Département** | 21 |
| **Recommandation** | **garder éteinte**. La réveiller relève du chantier fournisseurs et d'un mandat nominatif. |

### 1.3 Autres tâches du backend

« Inerte » signifie que la tâche ne peut pas tourner. La colonne « Visible » donne ce que montre la
base partagée ou `redis-dev` ; « PROD ? » signifie que le relevé reste à faire en PROD.

| Tâche (fichier) | Ce qu'elle fait | Déclencheur | Réglage d'activation | Visible | Utilité / risque | Dép. | Reco. |
|---|---|---|---|---|---|---|---|
| Panier abandonné (`cart/services/abandoned-cart.service.ts`) | scan, e-mails 1 h / 24 h / 72 h, écrit `__abandoned_cart_emails` | Bull, toutes les 15 min, enregistré **sans condition** | `ABANDONED_CART_EMAIL_ENABLED` (défaut `false`), vérifié au traitement (l. 100) | DEV : clé `bull:email:repeat` présente. Base : 0 ligne, jamais d'e-mail. PROD ? | utile pour la conversion ; risque d'e-mails clients (données personnelles, RGPD) | 21 | **garder** éteinte ; allumage = décision commerce |
| `vehicle-filtered-catalog-v4-hybrid.service.ts:643` | pré-calcul des véhicules populaires | `@Cron('0 */6 * * *')`, **inerte** | aucun | jamais | faible (cache) | 21 | **couper** (retirer le décorateur mort) ou migrer s'il manque |
| `seo-monitor-scheduler` | vérification de pages critiques et d'un échantillon ; récupération quotidienne Google | Bull, `*/30`, `0 */6`, `0 4` UTC | aucun gate ; `READ_ONLY` vérifié par les processeurs | DEV : 3 jobs répétables | utile (SEO) ; appels aux API Google | 21 | **garder** |
| `synthetic-crawler` | parcours synthétique | Bull `*/15` | `SEO_CP_SYNTHETIC_ENABLED` (défaut actif) | DEV : présent | utile | 21 | **garder** |
| `cf-analytics` | récupération des analytiques Cloudflare | Bull `*/5` | `SEO_CP_CF_ANALYTICS_ENABLED` (défaut actif) ; **la désactivation ne retire pas le job répétable** | DEV : présent | utile ; job fantôme après coupure | 21 | **garder** ; noter que la coupure est incomplète |
| `cf-rum` | RUM Cloudflare | Bull `0 1` | `SEO_CP_CF_RUM_ENABLED` (défaut inactif) ; non retiré à la coupure | DEV : absent | — | 21 | **garder** éteinte |
| `runtime-logs` | collecte des journaux d'exécution | Bull `*/5` | `SEO_CP_RUNTIME_LOGS_ENABLED` (défaut actif) ; non retiré à la coupure | DEV : présent | utile | 21 | **garder** |
| `seo-control-refresher` | 10 blocs de rafraîchissement (alertes, conversion…) | Bull, 10 jobs répétables | — | DEV : 10 jobs | utile (cockpit SEO) | 21 | **garder** |
| `seo-outbox-relay` | publie `__seo_outbox_event` | Bull, toutes les 5 s, sans gate | aucun | DEV : présent. Base : **0 événement depuis l'origine** | aucune utilité observée (rien à relayer) ; 17 280 réveils par jour | 21 | **couper** tant qu'aucun producteur n'écrit dans l'outbox |
| `seo-audit-scheduler` | lance un script d'audit, puis Meilisearch et Loki (`LOKI_URL`) | BullMQ, `0 3 * * 1` et `0 4 * * *` (Paris) | — ; `onModuleInit` **bloquant** | DEV : 2 jobs répétables | utile ; un démarrage peut bloquer si Redis tarde | 21 | **garder** ; rendre `onModuleInit` non bloquant (`.claude/rules/backend.md`) |
| `diagnostic-projection` | projection du moteur de diagnostic | cron `DIAGNOSTIC_PROJECTION_CRON` (`0 2`) | `DIAGNOSTIC_PROJECTION_ENABLED` (défaut inactif) | PROD ? | — | 21 | **garder** éteinte |
| `seo-projection-feeder` | alimente la projection R1 | cron `SEO_PROJECTION_R1_FEED_CRON` (`0 2`) | `SEO_PROJECTION_R1_FEED_ENABLED` (défaut inactif) ; **le processeur ne revérifie pas le réglage** | PROD ? | — | 21 | **garder** éteinte ; revérifier le réglage au traitement |
| `sitemap-v10-scheduler` | ne planifie plus rien ; retire les anciens jobs ; battement Redis de 30 s | intervalle | — | — | faible | 21 | **garder** |
| `ErrorLogService` (vidage) | `INSERT __error_logs` | intervalle de 5 s | — | Base : dernier relevé PROD à 23:45:18Z, 172 lignes sur 1 h | indispensable (source du signal 5xx) | 21 | **garder** |
| `CwvBeacon` (vidage) | ingestion Web Vitals | intervalle de 60 s | — | — | utile | 21 | **garder** |
| `RagRedisJobService` | jobs RAG | importé sans condition par `WorkerModule` | — | PROD ? | consommateur chatbot seulement (ADR-031/046) | 23 | **garder** ; vérifier qu'il ne produit pas de contenu |
| Conteneur `automecanik-worker` (`docker-compose.worker.yml`, Supercronic `config/cron/crontab`) | 9 lignes cron : agrégation et nettoyage SEO, cache Redis, `test-payment-tunnel.sh`, santé des files, sauvegarde RDB, rotation des journaux | Supercronic | — | **aucun workflow ne le déploie**, aucun conteneur sur DEV. PROD ? | doublons possibles avec les jobs ci-dessus | 21 | **couper** (fichiers morts) si l'absence est confirmée en PROD ; sinon **fusionner** avec les jobs Bull |

Code mort ou jamais branché, sans exécution possible : `SystemService` et `DatabaseMonitor` ;
modules jamais importés `McpValidation` et `Upload`. Recommandation : **couper**, dans un mandat de
nettoyage dédié.

Risques transverses :
- **Double exécution** : si `backend/src/workers/main.ts` tourne à côté de l'API, chaque job
  répétable a deux consommateurs. En PROD, à constater.
- **DEV écrit dans la base partagée** si `READ_ONLY` n'est pas posé : les jobs de DEV (relevé
  `redis-dev` ci-dessus) écrivent alors dans la base de PROD.

### 1.4 Tâches de la base (`pg_cron`)

Relevé `cron.job` et `cron.job_run_details` à 23:48:55Z : **20 tâches, toutes actives, dernier
passage `succeeded`**. Aucune ne touche les commandes ni le paiement.

| Tâche | Planification | Effet | Dernier passage (UTC) | Reco. |
|---|---|---|---|---|
| `error-logs-retention` | `0 3 * * *` | DELETE `__error_logs` > 30 j | 2026-11-15 03:00 | garder |
| `soft-404-events-retention` | `20 3 * * *` | DELETE des événements soft-404 anciens | 2026-11-15 03:20 | garder |
| `cron-job-run-details-retention` | `30 3 * * *` | DELETE de l'historique de `pg_cron` | 2026-11-15 03:30 | garder |
| `rls-reconcile-internal-tables` | `15 * * * *` | réconcilie la RLS des tables internes | 2026-11-15 23:15 | garder (zone STOP RLS : aucune modification) |
| `refresh-gamme-aggregates` | `*/15 * * * *` | agrégats des gammes | 2026-11-15 23:45 | garder |
| `refresh-stale-gamme-cache` | `*/10 * * * *` | cache des gammes (50 par passage) | 2026-11-15 23:40 | garder |
| `cwv-hourly-aggregation`, `cwv-daily-rum-aggregation`, `cwv-aggregation-coverage-check`, `cwv-trend-divergence-detection` | `5 * * * *`, `15 0 * * *`, `35 * * * *`, `0 4 * * *` | agrégats et détections Web Vitals | 23:05, 00:15, 23:35, 04:00 le 11-15 | garder |
| `cwv-raw-rotation`, `cwv-hourly-rotation`, `cwv-daily-rum-rotation`, `observability-partition-rotation`, `snapshot-partition-rotation`, `pieces-price-history-partition-rotation`, `pricing-decision-snapshot-partition-rotation`, `supplier-offer-snapshot-partition-rotation`, `quality-history-partition-rotation`, `seo-ensure-monthly-partitions` | entre 02:20 et 03:10 chaque nuit ; mensuelle le 1er | création et rotation de partitions (certaines par DROP de partitions anciennes) | 2026-11-15 nuit ; le 2026-11-01 pour la mensuelle | garder (incident actif `snapshot-partition-rotation-sensitive` : ne pas y toucher) |

## 2. Workflows GitHub qui fusionnent, ferment, créent ou poussent

Les 76 fichiers de `.github/workflows/` ont été recherchés pour les motifs `gh pr merge`, `--auto`,
`gh pr close|create|comment|edit|review`, `git push`, `git commit`, `gh issue create|close|comment|edit`,
`actions/stale`, `create-pull-request`, `github.rest.*.create|update|merge|delete`, et les appels
`-X POST|PATCH|PUT|DELETE`. **26 fichiers** répondent, plus deux qui écrivent hors de GitHub
(`deploy-monitoring-scripts.yml`, `deploy-docs.yml`). Dernier run lu par
`gh run list --limit 1` à 23:47:26Z.

### 2.1 Fusion

| Workflow | Ce qu'il fait | Déclencheur | Réglage | Dernier run | Utilité / risque | Dép. | Reco. |
|---|---|---|---|---|---|---|---|
| `dependabot-auto-merge.yml` | active l'**auto-fusion** des PR Dependabot : patch, minor de dev, actions, groupes `tiptap`/`storybook`/`vite` | `pull_request_target` | liste blanche dans le fichier | 2026-11-15 23:46, `skipped` | dette de dépendances résorbée ; risque de chaîne d'approvisionnement : la fusion relance PREPROD. 1 PR Dependabot fusionnée par `github-actions` depuis le 2026-10-16 | 21 | **garder** ; confronter son périmètre à ADR-123 |
| `dependabot-claude-review.yml` | un **agent** (modèle `claude-haiku-4-5`) lit le changelog, **approuve et active l'auto-fusion** si GO, sauf version majeure en production | `pull_request_target` | variable de dépôt `CLAUDE_REVIEW_DRY_RUN` (valeur non lisible depuis DEV, HTTP 403) | 2026-11-15 23:46, `skipped` ; les 30 derniers sont `skipped` | avis utile ; une **fusion par un agent** est contraire à ADR-121 D4 hors périmètre adopté | 23 | **couper la fusion** : `CLAUDE_REVIEW_DRY_RUN=true`, garder l'avis en commentaire |
| `registry-deps-self-heal.yml` | régénère `deps.json` et l'inventaire, ouvre une PR, **auto-fusion** avec un jeton d'App | push `main` (manifests) et cron | — | 2026-11-15 02:32, `success` | supprime une dérive de registre (diff JSON seul) ; fusion sans humain | 21 | **garder** ; confronter son périmètre à ADR-123 |
| `scripts/ci/merge-perimeter-gate.mjs` (script, pas un workflow) | porte ADR-123/124 : évalue puis **fusionne** une PR de documentation Markdown | appel explicite | politique `ledger/policies/merge-perimeter.v1.json` du vault ; fichiers de pause et de verrou sous `/home/deploy/resync/` | aucun planificateur trouvé dans la crontab de l'utilisateur ni dans les timers utilisateur de DEV | seul périmètre de fusion automatique adopté | 21 | **garder** |

### 2.2 Fermeture

| Workflow | Ce qu'il fait | Déclencheur | Dernier run | Utilité / risque | Dép. | Reco. |
|---|---|---|---|---|---|---|
| `stale.yml` (`actions/stale@v11`) | PR inactive 14 j : label `stale` et avertissement ; 7 j plus tard : **fermeture**, branche conservée. Exemptions : brouillons et labels `pinned`, `security`, `epic`, `wip`, `blocked-upstream`, `dependencies`. Les issues ne sont jamais touchées. | cron `0 2 * * *` | 2026-11-15 02:05, `success` | file de PR tenue ; réversible. 1 fermeture `stale` parmi les 300 dernières PR fermées depuis le 2026-10-16 | 21 | **garder** |
| `dependency-family-bump.yml` | ouvre une PR de montée de version et ferme ou supprime la précédente | manuel | 2026-05-24, `success` | dormant depuis 6 mois | 21 | **garder** (manuel, sans effet tant qu'on ne le lance pas) |

### 2.3 Création : issues et PR

| Workflow | Ce qu'il crée | Déclencheur | Dernier run | Constat | Dép. | Reco. |
|---|---|---|---|---|---|---|
| `morning-health-digest.yml` | **une issue par jour ouvré** | cron `0 5 * * 1-5` | 2026-11-13 05:04, `success` | **132 issues ouvertes** « Morning health digest » au relevé | 21 | **fusionner** en une issue unique : correctif préparé, voir `2026-11-16-mandat-am-patches/` |
| `weekly-pr-hygiene.yml` | **une issue par semaine** | cron `0 7 * * 1` | 2026-11-09 07:13, `success` | **26 issues ouvertes** « Weekly PR hygiene » | 21 | **fusionner**, même correctif |
| `closure-t48h-slo-digest.yml` | une issue de suivi SLO | cron `30 17 * * *` | 2026-11-15 17:30, `success` | 1 issue ouverte | 21 | **garder** ; pourra reprendre `report-issue-publish.sh` |
| `sitemap-daily-regen.yml` | régénère le sitemap (POST OIDC) ; **issue en cas d'échec** | cron `0 3 * * *` | 2026-11-15 03:07, `success` | 1 issue ouverte | 21 | **garder** |
| `canon-sync.yml` | PR de resynchronisation des miroirs du canon depuis le vault (`canon-sync/auto`) | cron `0 3 * * *`, `repository_dispatch` | 2026-11-15 03:04, `success` | — | 23 | **garder** |
| Commentaires de PR : `contract-drift-observatory`, `contract-drift-ratchet`, `dependency-graph-validate`, `pr-2e-readiness-gate`, `pr-dod-gate`, `spec-canon-phase2-canon-enum-drift`, `spec-canon-prompt-registry-drift`, `spec-canon-repo-map-drift`, `spec-canon-sql-rule-r2-check`, `spec-validation` | créent ou mettent à jour un commentaire sur la PR | `pull_request` (chemins ciblés) | 2026-11-09 au 2026-11-15 | aucune écriture hors de la PR | 21 (23 pour `prompt-registry-drift`) | **garder** |

### 2.4 Push et écriture hors de GitHub

| Workflow | Ce qu'il écrit | Déclencheur | Réglage | Dernier run | Risque | Dép. | Reco. |
|---|---|---|---|---|---|---|---|
| `diag-canon-slugs-export.yml` | `git push origin main` sur **ak125/automecanik-wiki** (exports) | cron `0 2 * * *` | secret `WIKI_REPO_TOKEN` ; lit `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 2026-11-15 02:13, `success` | push direct sur `main` du wiki, sans PR ; projection générée, pas de fiche validée | 21 | **garder** ; les trois exports sont à regrouper si leur builder devient commun |
| `wiki-exports-seo-generate.yml` | idem, `exports/seo/` | cron `15 2 * * *` | `WIKI_REPO_TOKEN` | 2026-11-15 02:20, `success` | idem | 21 | **garder** |
| `wiki-exports-diagnostic-generate.yml` | idem, `exports/diagnostic/` | cron `30 3 * * *` | `WIKI_REPO_TOKEN` | 2026-11-15 03:35, `success` | idem | 21 | **garder** |
| `deploy-monitoring-scripts.yml` | installe `scripts/monitoring/*.sh` dans `/usr/local/bin` de l'**hôte PROD** | push `main` sur `scripts/monitoring/*.sh`, ou manuel | — | 2026-09-09, manuel, `success` | une fusion modifie l'hôte PROD ; le correctif `check-payment-tunnel.sh` de ce mandat le déclenche | 21 | **garder** |
| `release-prod.yml` | déploiement PROD (et Slack) | tag `v*`, manuel sur tag | `PROD_BREAK_GLASS_NO_ROLLBACK_POINT` | 2026-11-14 09:46, `success` | PROD ; geste réservé à l'owner | 21 | **garder** |
| `ci.yml`, `prod-smoke-tests.yml` | message Slack (`-X POST`) | push et PR ; cron `0 */6 * * *` | `SLACK_WEBHOOK_URL` | 2026-11-15 | aucun | 21 | **garder** |
| `deploy-docs.yml` | GitHub Pages | push sur la branche `docs` | — | **aucun run** ; la branche `docs` n'existe pas sur `origin` | aucun | 21 | **couper** (mort) ou réveiller si une doc publique est voulue |

## 3. Lectures à faire en PROD (Marwane, console de l'hébergeur)

Aucune de ces commandes n'écrit. Elles n'affichent que des noms de réglages et leurs valeurs
booléennes ou cron, jamais de secret. L'agent ne les lance pas.

```bash
# 3.1 Réglages d'activation des tâches (noms filtrés, aucun secret)
docker exec nestjs-remix-monorepo-prod printenv | grep -E '^(SUPPLIER_TRUTH_SYNC_ENABLED|SUPPLIER_SYNC_MAX_REFS_PER_RUN|ABANDONED_CART_EMAIL_ENABLED|SEO_CP_SYNTHETIC_ENABLED|SEO_CP_CF_ANALYTICS_ENABLED|SEO_CP_CF_RUM_ENABLED|SEO_CP_RUNTIME_LOGS_ENABLED|DIAGNOSTIC_PROJECTION_ENABLED|DIAGNOSTIC_PROJECTION_CRON|SEO_PROJECTION_R1_FEED_ENABLED|SEO_PROJECTION_R1_FEED_CRON|READ_ONLY|NODE_ENV)='

# 3.2 Un processus worker tourne-t-il à côté de l'API ? (risque de double exécution)
docker exec nestjs-remix-monorepo-prod ps -eo pid,args | grep -E 'node .*(dist/main|workers/main)' | grep -v grep
docker ps -a --format '{{.Names}} {{.Status}}' | grep -iE 'worker|supercronic'

# 3.3 Jobs répétables réellement enregistrés dans le Redis de PROD
R=$(docker ps --format '{{.Names}}' | grep -iE 'redis' | grep -iE 'prod' | grep -viE 'rag|preprod' | head -1); echo "redis=$R"
for k in $(docker exec "$R" redis-cli --scan --pattern 'bull:*:repeat'); do echo "$k $(docker exec "$R" redis-cli zcard "$k")"; done

# 3.4 Crons de l'hôte PROD (scripts installés par deploy-monitoring-scripts.yml)
crontab -l | grep -vE '^\s*(#|$)'

# 3.5 Mode de la revue Dependabot par agent (depuis le compte GitHub de l'owner)
gh variable get CLAUDE_REVIEW_DRY_RUN --repo ak125/nestjs-remix-monorepo
```

La lecture de la base n'a pas besoin de PROD : elle est partagée et les relevés ci-dessus valent
pour PROD. Pour la refaire en lecture seule :

```sql
select jobname, schedule, active from cron.job order by jobname;
select count(*), min(expires_at) from order_idempotency where expires_at < now();
select count(*), min(expires_at) from order_resume_tokens where expires_at < now();
select count(*), max(observed_at) from supplier_offer_snapshot;
```

## 4. Limites

- Les réglages de PROD, ses files Redis et ses crons d'hôte ne sont pas lus : section 3.
- `redis-dev` montre ce que DEV a enregistré, pas ce que PROD exécute.
- La recherche par motifs ne voit pas une écriture faite par un script appelé indirectement
  (sauf `.github/scripts/*`, lus pour les deux rapports). Un workflow qui écrit par une action
  tierce non listée parmi les motifs peut manquer.
- Les crons de la machine DEV (`sync-dev-runtime`, missions Hermes) sont hors de ce périmètre, qui
  couvre le backend et les workflows.
