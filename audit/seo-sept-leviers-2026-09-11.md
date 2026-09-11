# Audit SEO — 7 leviers, fiabilité de la mesure GSC, robots, marqueurs (2026-09-11)

> **Statut par défaut de tout ce qui suit : CODE CORRIGÉ + TESTÉ localement. NON POUSSÉ,
> NON APPLIQUÉ EN BASE, NON DÉPLOYÉ, EFFET SEO NON MESURÉ.**
> Branche `fix/seo-measure-robots-markers` (worktree `.claude/worktrees/seo-leviers-mesure`),
> base `bcf0c775a`. Vérification complète au SHA `25cfd1bc4`. Les contrôles touchés par le
> dernier changement de code (un test frontend, `771c7b934`) ont été rejoués à ce SHA (§12).
> Les commits suivants sont documentaires (`git diff --stat 771c7b934 HEAD`).
> Verdict de couverture : **PARTIAL_COVERAGE** (§14).

## 0. Trois plans à ne pas confondre

| Plan | Où on en est | Ce qui manque |
|---|---|---|
| **Remise en service technique** | Code d'ingestion rattrapable, lecteurs honnêtes, robots, marqueurs et garde admin : corrigés et testés localement. | Revue, GO ciblés : migrations, merge, tag `v*`, activation d'un collecteur unique, reprise. Aujourd'hui aucune donnée GSC nouvelle n'est garantie : le seul collecteur actif est le backend DEV lancé à la main. |
| **Qualité de la mesure** | Un jour n'est certifié que présent **et** confirmé (marqueur de commit). Les états dégradés (manquant, non confirmé, non finalisé, erreur, grain non récupéré) sont visibles au lieu d'être comptés comme complets. | Tant que les migrations ne sont pas appliquées puis la reprise faite, les écrans afficheront « non certifié » ou « indisponible ». C'est voulu : aucune donnée partielle n'est présentée comme complète. |
| **Résultat SEO** | Non mesuré. | Déploiement, recrawl, puis au moins une fenêtre GSC complète et confirmée avant toute comparaison. Aucun délai d'effet n'est promis. |

## 1. Verdict des 7 leviers

Classement de l'existant : RÉUTILISER / CORRIGER / ABSENT / NON PROUVÉ.

| # | Levier | Existant et classement | Statut dans ce lot |
|---|---|---|---|
| 1 | Réveiller les pages à fort potentiel | `rpc_seo_low_ctr_v1`/`v3` + command center : **CORRIGER** (grain faux, §2 D2). Candidats observés : requêtes en position 3 à 6 sans clic sur les conseils (§7). | v4 et certification : CODE + TESTÉ ; migration non appliquée. |
| 2 | Problèmes SEO silencieux | Robots, marqueurs R2, META conseils, contrôleur admin ouvert : **CORRIGER** (fait). Signal `seo_placeholder_unresolved` : **RÉUTILISER** (réutilisé). Santé du job `seo-daily-fetch` : **CORRIGER** (§4.3, non fait). | CODE + TESTÉ, sauf la santé du job (proposition). |
| 3 | Chemins de conversion | CTA des pages R3 non tracés : **ABSENT**. JSON-LD `relatedLink` vers `/pieces/<alias>` en 410 : **CORRIGER**, non traité (SEO indexé). Parcours `/panier` de récupération : cassé mais dormant (§4.6). | Observations. Aucun changement (zone STOP panier). |
| 4 | Intentions sous-couvertes | Requêtes GSC par page : **RÉUTILISER**. Couverture du contenu face à ces requêtes : **NON PROUVÉ** (pas de confrontation au WIKI). Cannibalisation « corps papillon » : rejetée (§3). | Propositions marquées hypothèses (§7). |
| 5 | Rafraîchissement automatique fiable | Scheduler Bull `seo-monitor` : **RÉUTILISER**. Ingestion : **CORRIGER** (fait). Collecteur PROD désactivé : **ABSENT** en pratique. | Code CODE + TESTÉ ; collecteur proposé, non activé (§4.3). |
| 6 | Ressource digne de backlinks | **NON PROUVÉ** : aucune donnée de liens entrants relue dans ce lot, aucune ressource candidate évaluée. | Recommandation P4 seulement (§9). |
| 7 | Meilleur crawl | robots.txt : **CORRIGER** (fait). Sitemap blog `lastmod` 2019–2021 et `dateModified` en lot au 2026-02-17 : **CORRIGER**, non traités. Crawl logger : **ABSENT** (non branché). | robots CODE + TESTÉ ; le reste en observations. |

## 2. Défauts confirmés et correctifs

| # | Défaut confirmé | Preuve (avant) | Correctif | Tests liés |
|---|---|---|---|---|
| D1 | Trous GSC définitifs : fenêtre fixe J-3..J-6, aucun rattrapage. | Multi-grain depuis 2026-06-11 ; **19 jours absents** (07-06, 07-18, 07-25→27, 08-05, 08-14→25, 09-02), identiques sur les 4 grains. Relevé Q1 du 2026-09-11 10:48 UTC : 100 attendus depuis le plancher, 71 présents, 29 manquants (dont 06-01→06-10). 10 runs GSC en 30 jours (dernier 2026-09-10 02:00 UTC) ; PROD `monitoring_enabled:false`. | `4007ff96d` : planificateur des jours non confirmés, CLI de reprise (plan seul par défaut). | planificateur 12/12 ; bornes CLI. |
| D2 | Le grain page+pays+appareil perd l'essentiel des clics, puis alimente low CTR v3. | API sur 3 dates (~93 % de clics perdus) ; capture du 09-08 : 3 clics sur 72 (§4.2). | `a2cf87e83` : table additive `__seo_gsc_daily_page_totals` + `rpc_seo_low_ctr_v4`. `af79afe5c` : le command center ne certifie que v4. | Banc SQL 80/80 ; command center. |
| D3 | Zéro inventé sur jour non finalisé ; dry-run qui écrit ; `fetched_at` jamais rafraîchi. | Lecture du code et des lignes PROD. | `4007ff96d` (sonde `firstIncompleteDate`, dry-run à 0 écriture). | fetcher. |
| D4 | Reprise interrompue certifiée par l'ancienne ligne `property_total`. | Contre-exemple rouge sur le code précédent. | `673e6ee98` (marqueur retiré avant réécriture) ; `6bdc8c9ae` (tous les grains lus avant la moindre écriture). | Contre-exemples rouges avant, verts après. |
| D5 | Ligne byPage hors contrat ignorée sans bruit ; écart d'agrégation confondu avec un trou d'import. | Contre-exemples rouges. | `6bdc8c9ae` (`schema_drift`, `gsc_detail_below_signal`) ; `8719db00a` (v4 sépare jours, récupération et écart GSC). | fetcher 21/21 ; banc. |
| D6 | Les lecteurs certifient une ligne `property_total` non commitée. | timeseries `complete=true`, seo-control `comparable=true` sur lignes héritées. | `a60d1b6a6`. | Contre-exemples (§4.2). |
| D7 | `p_now::DATE` décalait la fenêtre v4 d'un jour hors UTC. | Banc SQL, fuseau America/Los_Angeles. | `8719db00a` (bornes UTC explicites). | Banc (fuseaux). |
| D8 | `timeseries/gsc` additionnait au plus 200 lignes arbitraires. | Code. | `ce012960e` (total propriété + couverture). | Contrôleur. |
| D9 | seo-control calculait delta et perdants sur des fenêtres incomplètes. | Code + données. | `35704971e`, `a60d1b6a6` (`unknown` sinon). | seo-control. |
| D10 | `SeoMonitoringController` sans authentification. | GET 200 sans session en PROD. | `ce012960e` (`AuthenticatedGuard` + `IsAdminGuard`) ; preuve HTTP `67de7d4a3`. | 29/29 (§4.5). |
| D11 | robots.txt : le groupe Googlebot (seul lu par Google) n'avait pas `/search?*` ; `Crawl-delay: 0.5` ignoré ; le repli frontend suivait une autre politique (`Disallow: /account/`, 4 sitemaps, aucun blocage de bots). | Relevé live + code. | `6de46c5cb` (caractérisation), `039a44fc5` (source unique `@repo/seo-url-contract/robots-policy`). | Oracle 32 exemples ; vitest 3/3 ; snapshot −1/+4 lignes. |
| D12 | Marqueurs R2 non résolus servis : 7 en base (pg 3096 ×5, tous dans des `href` ; 1289 ×1 ; 1298 ×1). `#VMotorisation#` et `#VCodeMoteur#` non gérés (5 gammes). | Inventaire `__seo_gamme_car` en lecture. | `84e9e57ce` ; erratum `5cc403e5f` pour les liens (§4.4). | Tests sur données réelles pg 1289/1298/3096/1795. |
| D13 | Pages conseils : H2 « Meta SEO » et JSON brut affichés (4 des 5 pages relevées). En base, 213 META non conformes sur 219. | Live 2026-09-11 ; 219 META = 132 JSON, 49 `<meta>`, 32 texte brut, 6 listes de liens. | `f2a7ff9e9` (META servies seulement si c'est une liste de liens ; clé de cache R3 v2→v3). | r3-guide. |
| D14 | `seo-daily-fetch` invisible dans `__admin_job_health`, en succès comme en échec. | §4.3. | **Non corrigé** : proposition à valider. | — |

## 3. Hypothèses rejetées ou non prouvées

- **Cannibalisation « corps papillon » : rejetée.** Conseil en position 3,0, R1 en 7,5, guide d'achat en 34,9 : trois intentions distinctes.
- **Exécutant PROD historique de l'ingestion : NON PROUVÉ.**
- **Anomalie GA4 du 07-22 au 07-24 : cause NON PROUVÉE.**
- **« Faux vert » sur le dernier succès de `seo-daily-fetch` : rejeté.** Il n'existe aucune ligne. Le défaut réel est l'invisibilité (D14).
- **Égalité attendue entre byPage et le total propriété : non.** Ce sont deux agrégations GSC différentes. L'écart est publié comme information et ne décide d'aucun statut.
- **« Retirer le seul jeton laisse la destination du lien inchangée » (`84e9e57ce`) : faux.** Corrigé par `5cc403e5f`.

## 4. Preuves par point

### 4.1 Migrations et SQL (point 1)

- Deux migrations additives préparées, **non appliquées** (absentes de PROD, vérifié en lecture) : `20260911_seo_gsc_multilevel_page_totals.sql` et `20260911_seo_gsc_multilevel_page_totals_rpc_low_ctr_v4.sql`, chacune avec son `.down.sql`.
- **Banc exécuté** : `scripts/db/test-seo-gsc-page-totals-migrations.sh`, conteneur `postgres:17-alpine` jetable. La fixture reproduit l'état PROD avant migration, relevé en lecture seule. Résultat au SHA `25cfd1bc4` : **80 PASS / 0 FAIL**. Cas couverts :
  - **schéma absent** : fetcher en 42703 (`schema_drift`, 0 écriture) ; v4 en 42883 (repli v3) ; v4 refusée avant la création de la table ;
  - **idempotence et permissions** : deux applications idempotentes ; RLS sur le parent et les 7 partitions ; anon et authenticated refusés (SELECT, INSERT, UPDATE, EXECUTE v4), service_role autorisé ; aucune surcharge de fonction ;
  - **ancien code / nouveau schéma** : l'upsert sans la colonne ne remet pas le marqueur à NULL ; un jour neuf reste non certifié ; v3 identique avant et après ;
  - **couverture v4** : complète, partielle, vide, grain indisponible, écart d'agrégation, zéro confirmé, plancher, queue non finalisée, fuseaux, lignes héritées (état PROD actuel → `insufficient_data`), dernier jour non confirmé (S8b) ;
  - **reprise interrompue rejouée** : marqueur retiré → jour exclu ; sans retrait → reprise partielle certifiée (contre-exemple) ;
  - **downs** : le mauvais ordre casse v4 ; le bon ordre restaure fonction, ACL, commentaire, données et v3. Testés **uniquement sur la base jetable**.
- Squawk 2.52.1 (version CI, `.down.sql` exclus comme en CI) : 0 issue. `--lint-markers` : OK.
- **`backend/tests/unit/seo-control/rpcs.test.ts` est SAUTÉE et n'est PAS validée.** Elle exige une vraie base (`describeIfDb`). Aucune base persistante n'a été utilisée. Les tests unitaires ne la remplacent pas.

### 4.2 Reprise et certification GSC (point 2)

**Détail apporté par page_totals.** Capture réelle en lecture seule du 2026-09-11 09:49 UTC (googleapis 164.1.0, requêtes identiques au fetcher), jour 2026-09-08 :

| Agrégation | Lignes | Clics | Impressions |
|---|---|---|---|
| Total propriété | 1 | 72 | 5 581 |
| byPage (page seule) | 2 384 | 73 | 5 756 |
| Ancien grain page+pays+appareil | 1 053 | 3 | 2 248 |

C'est une preuve documentaire : aucune égalité n'est imposée. La fixture `gsc-searchanalytics-2026-09-11.fixture.ts` est typée `satisfies` sur les types du SDK installé. Renommer un champ casse la compilation (TS2820 / TS2561), ce qui prouve que la garde n'est pas vacante.

**Trois choses publiées séparément** (v4 et fetcher) :
- **(a) couverture des jours** : attendus, présents, confirmés, manquants, non confirmés ;
- **(b) récupération du grain** : `retrieval_status`, `retrieval_gap_dates` = jour confirmé avec des impressions mais sans ligne page ;
- **(c) limite GSC** : `gsc_aggregation` (ratios, `blocking=false`) et avertissement `gsc_detail_below_signal:<date>`.

**Vocabulaire unique des jours** (timeseries, seo-control, v4) :

| État | Définition | Affiché comme |
|---|---|---|
| Confirmé | ligne `property_total` avec marqueur | compté |
| Confirmé à zéro | marqueur posé, 0 clic / 0 impression | compté (vrai zéro) |
| Non confirmé | ligne sans marqueur (ancien writer ou réécriture interrompue) | listé à part, fenêtre non certifiée |
| Manquant | aucune ligne | listé, fenêtre non certifiée |
| Non finalisé | jour ≥ `firstIncompleteDate` | ignoré à l'ingestion (`skip_not_final`, 0 écriture) |
| Erreur | lecture en échec (dont 42703) | timeseries `{error}`, seo-control lève une exception |

**Replis v4 → v3 → v2 → v1 : aucun ne peut être certifié.** Les tests `command-center-actions.service.test.ts` le vérifient :
- un v3 qui annonce `page_totals` + `ok` reste PARTIAL ;
- un statut absent ou `insufficient_data` n'est jamais CERTIFIED ;
- 26 jours confirmés sur 28 → PARTIAL 55 ;
- v1 → PARTIAL 55 « total qualifiant inconnu (RPC v1) ».

**Panne au milieu d'une ingestion, puis reprise.**
- **Jour neuf.** La panne API sur un grain survient avant toute écriture, car les 5 grains sont lus d'abord. La base reste intacte, le jour est replanifié comme trou, puis confirmé au run suivant.
- **Jour qui a déjà un `property_total` et d'anciennes données.** Le marqueur est retiré avant la première écriture de grain. Une panne pendant l'écriture laisse donc le jour non certifié. Si le retrait lui-même échoue, aucun grain n'est écrit.
- **Jour hérité (marqueur NULL) interrompu** : il reste non certifié.

Tous ces contre-exemples étaient rouges avant `673e6ee98` et `6bdc8c9ae`.

**Comportement des consommateurs** (`a60d1b6a6`), pas seulement l'ordre des appels du producteur :
- **timeseries** : `daily[].confirmed` ; une seule ligne non confirmée empêche `complete` ;
- **seo-control** : une fenêtre de lignes héritées n'est pas comparable → delta et perdants `unknown` ;
- **UI admin** : « N/M jours confirmés », et la liste « Jours présents non confirmés (ingestion à reprendre) ».

**Borne de reprise.** Sonde réelle : `metadata.firstIncompleteDate` = J-2 UTC, dernier jour final = J-3. La même requête **sans** `dataState: 'all'` ne renvoie **aucune** clé `metadata`, donc la finalité ne peut pas être prouvée (`skip_finality_unknown`). La « veille UTC » n'est plus qu'une borne de planification. Formulations contradictoires corrigées dans `b3448f055`.

**Consommateurs restés en v1 : ce que l'utilisateur voit réellement.**

| Consommateur | Source | Ce qui est affiché aujourd'hui |
|---|---|---|
| seo-control `trafficWindow`, `topLosers` | `rpc_seo_traffic_v1`, `rpc_seo_top_losers_v1` (grain requêtes) | Des totaux sous-comptés (le grain requêtes n'expose qu'une fraction des clics). Les fenêtres `[J-N, J-1]` incluent J-1 et J-2, jamais finaux : la fenêtre courante est donc presque toujours incomplète → delta « inconnu », aucun perdant. |
| seo-control `lowCtrOpportunities` | v1, grain requêtes | Des opportunités biaisées. `surface_key` inconnu (URL absolue ; v4 utilise le chemin). |
| `rpc_seo_alerts_v1` | grain requêtes | Des pondérations sous-comptées. |
| Tableau seo-control | flag `SEO_CONTROL_DASHBOARD_ENABLED` (défaut false) | Activation en PROD **non vérifiée**. |
| Command center | repli v1 | PARTIAL 55 « total qualifiant inconnu (RPC v1) » (testé). |

Proposition à valider, non implémentée : ancrer `p_now` sur le lendemain du dernier jour confirmé et prendre les totaux dans `property_total`.

### 4.3 Collecteur permanent : proposition, non activé (point 3)

**Emplacement proposé** : conteneur PROD (service compose `monorepo_prod`, `restart: always`, `env_file: .env`). `WorkerModule` y est importé par `AppModule` (`backend/src/app.module.ts:246`). On réutilise l'existant, sans nouvelle plateforme :
- queue Bull `seo-monitor` ;
- `SeoMonitorSchedulerService` : repeatable `daily-fetch`, cron `0 4 * * *`, jobId `seo-daily-fetch`, 3 tentatives, backoff exponentiel 30 s ;
- `SeoDailyFetchProcessor`, avec son gate `READ_ONLY`.

**Configuration** (noms seulement, aucune valeur) :
- `SEO_MONITORING_ENABLED=true` ;
- `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL` ;
- `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY`, `GA4_PROPERTY_ID` ;
- bornes documentées dans `backend/.env.example` : `SEO_GSC_ROLLING_DAYS=4`, `SEO_GSC_BACKFILL_LOOKBACK_DAYS=120`, `SEO_GSC_BACKFILL_MAX_DAYS_PER_RUN=7`, `SEO_GSC_BACKFILL_FLOOR_DATE=2026-06-01` (GA4 : 1 / 120 / 7 / 2026-04-01).

**Contrôles.**

| Contrôle | Existant | Verdict |
|---|---|---|
| Redémarrage | `restart: always` ; `onModuleInit` nettoie les repeatables puis les réenregistre avec un jobId fixe. | Couvert (lecture du code). |
| Exécutions concurrentes | Dans une instance : jobId fixe et un seul processor. Entre instances : **aucun verrou**. | Règle d'exploitation : **une seule instance activée** (PROD active, collecteur DEV désactivé). Une réécriture concurrente d'un même jour est sûre **par raisonnement** (marqueur retiré puis posé en dernier), **pas testée en concurrence réelle**. |
| Reprise bornée | Planificateur (7 jours par run, fenêtre de 120 jours, plancher) ; CLI limitée à 31 jours et au plancher. | Testé. |
| Dernier succès | `__seo_event_log` : `ingestion_run_started` / `_completed` / `_failed` (GET `/runs`, admin). | Utilisable. |
| Alerte d'échec | `AdminHealthService` : dégradé à partir de 3 échecs consécutifs, down à 10, **aucune règle d'ancienneté**. `GET cron/health` : seuil 36 h, lecture à la demande, **aucun consommateur dans le repo**. | **D14 (défaut confirmé)** : voir ci-dessous. |

**D14 en détail.** `AdminJobHealthService.recordSuccess` appelle la RPC `__admin_job_health_success`, **absente en PROD** (vérifié en lecture). Le repli fait un `UPDATE … WHERE queue_name = ?`, et `recordFailure` fait le même UPDATE seul. `__admin_job_health` compte 3 lignes, **aucune pour `seo-daily-fetch`**. Résultat : succès et échecs mettent à jour 0 ligne, sans erreur, et le job est invisible. Le fichier est inchangé sur `origin/main`.

**Proposition à valider** (non implémentée) :
- créer la ligne manquante (upsert sur `queue_name`) ;
- ne pas enregistrer de succès quand toutes les sources ont été ignorées (sinon faux vert) ;
- ajouter une règle d'ancienneté consommée par l'alerte admin existante ;
- respecter la règle de #1448 (la machine DEV n'écrit pas dans `__admin_job_health`).

**Effet de la garde admin sur la supervision.** `GET cron/health` n'est plus public. Si une sonde externe l'appelle, elle recevra 403.
- **ADR-045** (statut *proposed*) décrit cette route comme « utilisable par monitoring externe ».
- **ADR-063** (statut *accepted*, amende ADR-045) prescrit `IsAdminGuard` sur les routes admin du contrôleur.
- **Côté dépôt et machine DEV** : aucun appelant. Le healthcheck Docker et le health check Caddy appellent `/health`.
- **Où chercher en PROD.**
  - **Dans les journaux du conteneur backend** : pino y écrit une ligne par requête (`LoggerModule.forRoot` dans `backend/src/app.module.ts:98` ; seuls `/health`, `/assets/`, `/build/` et `*.ico` sont ignorés). Couverture limitée à la vie du conteneur. Seule source pour un appelant interne au réseau Docker. Non lus pour la vérification ci-dessous (erratum, §13).
  - **Dans le journal d'accès Caddy du site www** (`logs/caddy/automecanik*.log*`). Sa rotation est de 50 Mo × 5, sans durée minimale : la couverture réelle est à mesurer.
- **Vérification du 2026-09-11**, faite par l'owner en lecture seule sur la machine PROD (l'accès SSH depuis DEV était refusé) :
  - **Contrôle positif retrouvé** : l'appel d'audit du 2026-09-10 22:34 UTC sur `credentials/health` apparaît, donc le journal enregistre ces appels.
  - **`cron/health` : 0 appel** dans le journal www (~19 h en septembre, ~22 h en juin) et dans `access.log` (HTTP, du 2026-07-14 au 2026-09-11).
  - **Aucune autre route du contrôleur** n'est appelée, hormis l'appel d'audit.
  - **Limite** : un appelant HTTPS moins fréquent qu'une fois par jour a pu passer entre les fenêtres.
  - Commandes et tableau : description de la PR #1460.

### 4.4 Marqueurs dans les liens (point 4)

- Les 4 `href` annoncés étaient en réalité **5**, tous sur pg 3096. Rejoués avec leurs gabarits réels : retirer le seul jeton donnait `https://www.automecanik.com/` (autre destination) et `…/pompe-a-eau-1260/` (destination tronquée).
- **Correctif `5cc403e5f`, sans mapping inventé** :
  - un lien dont un attribut porte un marqueur perd sa balise `<a>`, mais son texte utile est conservé (`<b>` interne compris) ;
  - une balise `<a>` sans fermeture exploitable perd seulement l'attribut fautif ;
  - les liens valides voisins sont conservés.
- **Tests sur données réelles** (pg 1289/1298/3096/1795) : aucun `href` vide, tronqué ou absent de la source ; balises équilibrées ; lien mixte valide/invalide. Le défaut n'est pas masqué par un simple test « zéro marqueur » : les assertions portent sur les destinations. 4 de ces tests étaient rouges sur `84e9e57ce`.
- **Aucune désindexation.** La garde ne touche ni au statut d'indexation ni aux URL.
- **Événement de diagnostic** : `seo_placeholder_unresolved`, source `r2_seo_template`, un par champ.
  - Émis au calcul (cache manqué), pas à chaque lecture du cache, en fire-and-forget.
  - Échantillon limité à 10 marqueurs ; aucune donnée personnelle (pg_id, type_id, champ, marqueurs).
  - Base avant correctif : 0 événement de ce type en 60 jours.
- **Exposition** : pg 3096 a `pg_display=0` et sa page R1 répond 404 en live. Le cas n'a pas été observé servi (R2 non vérifiée).

### 4.5 Protection admin (point 5)

`seo-monitoring.controller.http-guards.test.ts` (application Nest réelle, supertest, guards réels) : **29/29**.
- anonyme et client authentifié non administrateur → 403 sur les 12 routes, **aucun appel de service ni lecture base** (POST `run/gsc`, `run/ga4`, `audit/r-content/run` inclus) ;
- niveau 6 refusé, niveau 7 autorisé, `isAdmin` autorisé ; un admin qui appelle POST `run/gsc` atteint le fetcher (mock) ;
- **contre-exemple** : guards neutralisés → la même requête anonyme déclenche le fetcher. Le 403 n'est donc pas vacant ;
- **job interne** : le processor `daily-fetch` appelle le fetcher sans requête ni session.

**Livré séparément : PR #1460, mergée le 2026-09-11 à 15:38:42Z** (squash `1c2cb48b2`).
- Branche `fix/seo-monitoring-admin-guard`, deux mises à jour avec main, projections régénérées à chaque fois.
- Empreinte de contenu `abb4d6497c0a768e` (sha256 du diff hors projections) identique de la revue au squash ; 8 fichiers.
- CI de la tête `8c78cd8a2` : 37 checks passés, 9 sautés, 0 échec ; les 13 checks requis passent.
- **CI de main après merge** :
  - le run de `1c2cb48b2` a été annulé par la concurrence (#1465 poussé ensuite) ;
  - le run de `f64ef5197`, qui contient #1460 : déploiement PREPROD ✅, E2E smoke ✅, Lighthouse ❌.
  - Lighthouse : toutes les assertions de performance passent ; le contrôle de qualité des preuves rejette `/search?q=plaquette` (chargement trop lent pour la collecte). Lighthouse échouait déjà sur main avant le merge (`1df615789`, `f61db4678`) et n'audite aucune route admin.
- **PROD non déployée** : tag `v*` = GO séparé.
- **Au rebase de cette branche** : le lot C contient la même garde. Si #1460 est mergée d'abord, le conflit ou le doublon est à résoudre.

**Historique.** `.claude/handoffs/seo-monitoring-admin-guard-only.patch` (non suivi) contient seulement la garde et le test HTTP. Validé 29/29 sur `origin/main` `b580da6a6`. Depuis, `origin/main` (`5ccf04bf3`) ne touche que `.claude/rules/deployment.md`, `scripts/ops/sync-dev-runtime.sh` et `scripts/test-claude-hooks.sh`, hors du périmètre du patch. Écart assumé : sur main, l'assertion du job utilise `objectContaining({ date })`, car main transmet aussi `rollingDays`.

### 4.6 `/panier` sans toucher à la zone STOP (point 6)

- **Aucun lien ni bouton actif** du frontend ne mène à `/panier`. Le seul chemin est l'URL de récupération du panier abandonné, `${SITE_ORIGIN}/panier/recover/<token>` (`abandoned-cart.service.ts`).
- **Reproduction sans écriture** : `/panier/recover/x` (jeton ≠ 64 caractères, refusé avant tout UPDATE) → 302 vers `/panier?error=invalid_token` → **404**. `/panier?recovered=1` → **404**. `/cart` → 200. Un jeton valide déclencherait un UPDATE : non exécuté.
- **Parcours dormant** : `ABANDONED_CART_EMAIL_ENABLED` vaut false par défaut, et `__abandoned_cart_emails` compte **0 ligne depuis sa création**.
- **Classement** : route legacy cassée par construction, **sans parcours client actif aujourd'hui**. Elle deviendrait un blocage commercial si le flag était activé. Correctif cible (rediriger vers `/cart`) : GO requis, zone STOP. **Aucune modification faite.**

### 4.7 Procédure de livraison (point 7) : proposition à valider

**Aucune étape ci-dessous n'est autorisée par ce rapport.** Chaque GO est distinct et nominatif.

1. **GO push.** Rebase sur `origin/main`. Deux fichiers sont communs :
   - `backend/.env.example` : hunks distincts, pas de conflit attendu ;
   - `log.md` : conflit attendu. La branche porte une entrée ajoutée par le hook Stop (`f2ab4cbbb`) et main a ajouté 18 lignes depuis la base. Résolution : garder les deux entrées, celles de main d'abord.

   Ensuite, rejouer au SHA rebasé les contrôles du §12, puis régénérer le registre dans un environnement équivalent à la CI (`npm ci`, sans `dist` locaux ; F4). Push de la branche, ouverture de la PR.
2. **Revue + CI verte sur le SHA final `S`.** Les preuves de la PR doivent citer `S`. Tout rebase ultérieur oblige à rejouer les contrôles touchés avant de réutiliser le verdict.
3. **GO migration** (droits : écriture repo pour `workflow_dispatch` ; secret `DATABASE_URL` existant). Workflow `apply-supabase-migrations.yml` avec `only_ids` = les 2 ids, d'abord `dry_run=true`, puis `confirm=APPLY` et `dry_run=false`. Puis contrôles en lecture (§5, Q4 et Q6). Choix de la référence Git, à valider :
   - **Option A : tête de PR revue `S`, avant merge.** Schéma d'abord ; l'ancien code est compatible (prouvé au banc) ; aucune fenêtre d'erreur. Le workflow n'a pas de garde de ref. Tant que la PR n'est pas mergée, le statut du ledger sur main classe ces ids en `orphan`, ce qui ne produit qu'un avertissement (`scripts/ci/apply-supabase-migration.py`). Toute modification ultérieure du fichier → dérive de checksum → échec franc.
   - **Option B : `main` après merge.** Le fichier appliqué est exactement celui de main. En contrepartie, jusqu'à l'application : le container PREPROD (READ_ONLY) renvoie des erreurs 42703 explicites sur les lectures admin SEO, et le backend DEV synchronisé sur main passe en `schema_drift` (0 écriture), ce qui prolonge les trous (rattrapables).
4. **Merge → container PREPROD** (CI : E2E Smoke + Lighthouse).
5. **GO tag `v*` → container PROD** (droit owner). Vérifier la parité d'environnement PREPROD/PROD avant le tag.
6. **GO collecteur** (accès SSH à la machine PROD, owner). Clés du §4.3 dans l'`env_file` PROD, redémarrage, **désactivation du collecteur DEV** (un seul orchestrateur).
7. **GO reprise** mois par mois (§6), puis contrôles §5.
8. **GO purges** de caches après release : `seo:processed:*`, `rm:page-v2:*`, CDN des pages conseils et R2.

**Retour arrière.**
- **Applicatif** : revert de la PR (relance le cycle PREPROD) ; en PROD, réutilisation de l'image de production précédente.
- **Base** : **aucun down destructif sur des données persistantes.** Les migrations sont additives et restent en place (ancien code compatible, prouvé au banc). Les `.down.sql` ne sont exercés que sur la base jetable.
- **Collecteur** : `SEO_MONITORING_ENABLED=false` + redémarrage.
- **Reprise** : upserts idempotents ; un mois rejoué retire puis repose le marqueur.

## 5. Requêtes de contrôle (lecture seule)

Chaque requête s'exécute dans une transaction `READ ONLY` avec un `statement_timeout` court. Si le délai est dépassé, réduire la fenêtre à un mois.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
-- requête
ROLLBACK;
```

**Q1 — Jours GSC présents et manquants (avant migration).** J-3 est une borne indicative : le dernier jour final réel suit `firstIncompleteDate`.
```sql
WITH expected AS (
  SELECT d::date AS day
  FROM generate_series(DATE '2026-06-01', (now() AT TIME ZONE 'UTC')::date - 3, INTERVAL '1 day') d
)
SELECT count(*) AS attendus, count(pt.date) AS presents,
       array_agg(e.day ORDER BY e.day) FILTER (WHERE pt.date IS NULL) AS manquants
FROM expected e LEFT JOIN __seo_gsc_daily_property_total pt ON pt.date = e.day;
```

**Q2 — Mêmes jours, avec confirmation (après migration).**
```sql
WITH expected AS (
  SELECT d::date AS day
  FROM generate_series(DATE '2026-06-01', (now() AT TIME ZONE 'UTC')::date - 3, INTERVAL '1 day') d
)
SELECT count(*) AS attendus, count(pt.date) AS presents,
       count(*) FILTER (WHERE pt.commit_version IS NOT NULL) AS confirmes,
       array_agg(e.day ORDER BY e.day) FILTER (WHERE pt.date IS NULL) AS manquants,
       array_agg(e.day ORDER BY e.day) FILTER (WHERE pt.date IS NOT NULL AND pt.commit_version IS NULL) AS non_confirmes
FROM expected e LEFT JOIN __seo_gsc_daily_property_total pt ON pt.date = e.day;
```

**Q3 — Jours présents par grain.** Ajouter `__seo_gsc_daily_page_totals` après migration.
```sql
SELECT 'requetes' AS grain, count(DISTINCT date) FROM __seo_gsc_daily WHERE date >= DATE '2026-09-01'
UNION ALL SELECT 'totals', count(DISTINCT date) FROM __seo_gsc_daily_totals WHERE date >= DATE '2026-09-01'
UNION ALL SELECT 'pages_segmentees', count(DISTINCT date) FROM __seo_gsc_daily_pages WHERE date >= DATE '2026-09-01'
UNION ALL SELECT 'property_total', count(DISTINCT date) FROM __seo_gsc_daily_property_total WHERE date >= DATE '2026-09-01';
```

**Q4 — Présence des objets migrés.**
```sql
SELECT to_regclass('public.__seo_gsc_daily_page_totals') IS NOT NULL AS table_page_totals,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = '__seo_gsc_daily_property_total' AND column_name = 'commit_version') AS colonne_marqueur,
       to_regprocedure('public.rpc_seo_low_ctr_v4(integer,timestamptz,integer,numeric,integer,date)') IS NOT NULL AS rpc_v4;
```

**Q5 — Runs d'ingestion et santé du job.**
```sql
SELECT event_type, severity, created_at, payload
FROM __seo_event_log
WHERE event_type IN ('ingestion_run_started','ingestion_run_completed','ingestion_run_failed')
  AND created_at >= now() - INTERVAL '30 days'
ORDER BY created_at DESC LIMIT 50;

SELECT queue_name, last_success_at, last_failure_at, consecutive_failures, total_completed, total_failed
FROM __admin_job_health ORDER BY queue_name;
SELECT proname FROM pg_proc WHERE proname = '__admin_job_health_success';
```

**Q6 — Enveloppe v4 (après migration).** Fonction STABLE en lecture seule, EXECUTE réservé à service_role.
```sql
SELECT public.rpc_seo_low_ctr_v4(28, now(), 100, 0.01, 5, DATE '2026-06-01') - 'rows' AS enveloppe;
```

**Q7 — Détail page_totals face au total propriété** (information seulement, aucune égalité attendue ; un mois).
```sql
SELECT pt.date, pt.commit_version, pt.clicks AS clics_propriete, sum(p.clicks) AS clics_pages,
       pt.impressions AS impr_propriete, sum(p.impressions) AS impr_pages, count(p.page) AS pages
FROM __seo_gsc_daily_property_total pt
LEFT JOIN __seo_gsc_daily_page_totals p ON p.date = pt.date
WHERE pt.date BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
GROUP BY pt.date, pt.commit_version, pt.clicks, pt.impressions ORDER BY pt.date;
```

**Q8 — Marqueurs R2 retirés (après release).**
```sql
SELECT created_at, payload->>'field' AS champ, payload->'markers' AS marqueurs,
       payload->>'pg_id' AS pg_id, payload->>'type_id' AS type_id
FROM __seo_event_log
WHERE event_type = 'seo_placeholder_unresolved' AND payload->>'source' = 'r2_seo_template'
  AND created_at >= now() - INTERVAL '7 days'
ORDER BY created_at DESC LIMIT 100;
```

**Contrôles HTTP (GET, sans écriture), après release :**
- `robots.txt` : le groupe Googlebot contient la recherche interne et n'a plus de `Crawl-delay` ;
- les 4 pages conseils concernées n'ont plus de H2 « Meta SEO » ;
- la page R2 du relevé pg 1289 ne contient plus aucun `#…#`.

## 6. Procédure de reprise (sans secret) : GO requis

**Préalables** : migrations appliquées et Q4 vrai ; code corrigé sur l'instance qui exécute ; collecteur unique ; `SEO_MONITORING_ENABLED=true` ; `READ_ONLY` différent de `true` (sinon la CLI refuse).

1. **Base de départ** : Q2 et Q3. Juste après la migration, **toutes les lignes existantes sont non confirmées** (la colonne n'existait pas ; le banc en déduit `insufficient_data`). La reprise porte donc sur toute la fenêtre `[2026-06-01, dernier jour final]`, pas seulement sur les 29 jours absents (19 trous + 06-01→06-10).
2. **Plan seul** (0 écriture, journal compris) :
   `node dist/modules/seo-monitoring/cli/run-ingestion-backfill.js --source gsc --from 2026-06-01 --to 2026-06-30`
3. **Sur GO**, même commande avec `--apply`, mois par mois : 06, 07, 08, puis 09 jusqu'à la veille UTC. Les jours à partir de `firstIncompleteDate` sont ignorés (`skip_not_final`, 0 écriture). Une plage de plus de 31 jours ou antérieure au plancher est refusée.
4. **Après chaque mois** : Q2 (confirmés), Q5 (runs), Q7 (information).
5. **Arrêt immédiat** sur `schema_drift` (migration absente ou dérive). Les jours en `final_rows_missing` sont replanifiés.
6. **GA4 ensuite** : `--source ga4`, plancher 2026-04-01, `--to` au plus J-3. Aucune sonde de finalité GA4 : l'ancre est supposée.
7. **Échéance du rattrapage automatique** : la fenêtre du planificateur est `[max(ancre − 119 jours, plancher) .. ancre]`, avec l'ancre à J-3. Le 2026-06-01 en sort dès que l'ancre dépasse le 2026-09-28, soit à partir du run du 2026-10-02 UTC. Seule la CLI peut ensuite le reprendre. Cela suppose un collecteur actif, ce qui n'est pas le cas aujourd'hui.

## 7. Pages conseils : propositions avant/après (hypothèses, GO éditorial requis)

Demande par page : API GSC, grain page seul, du 2026-08-11 au 2026-09-07 (relevé du 2026-09-10 22:19 UTC).

| Page | Clics / impressions @pos | Requêtes observées |
|---|---|---|
| capteur-abs | 13 / 2 708 @23,1 | « voyant abs allume » 704 @44,7 ; « capteur esp » 396 @6,4 (4 clics) |
| arbre-a-came | 4 / 2 260 @9,1 | « arbre a came » 1 232 @5,1, 0 clic ; « arbre a came prix » 10 @39,6 |
| colonne-de-direction | 6 / 1 271 @6,9 | « colonne de direction » 559 @5,8 |
| corps-papillon | 9 / 1 238 @27,1 | « corps papillon » 283 @3,0, 0 clic |
| cylindre-de-roue | 4 / 1 125 @13,8 | « … arrière » 285 @11,9 ; « … grippé » 74 @26 ; « … qui fuit » 58 @5,6 |

Title, meta et H1 relevés en live le 2026-09-11. Toute proposition part d'une requête observée, aucun mot-clé n'est inventé. Les title, meta et H1 sont protégés : **proposition à valider**.

| Page | Avant | Proposition (hypothèse) |
|---|---|---|
| corps-papillon | Title « Symptômes du boîtier papillon défectueux : guide complet [2026] » ; H1 « Symptômes du boîtier papillon défectueux » | Faire apparaître « corps papillon », terme de la requête en position 3 sans clic, en gardant « boîtier papillon ». |
| arbre-a-came | Title « Arbre a came : symptomes, remplacement et prix \| Guide » ; H1 « Changer un arbre à cames » | Rétablir les accents. Garder « prix » seulement si la page contient réellement des prix (requête en position 39,6). |
| colonne-de-direction | Meta « Jeu au usure… » | Faute certaine : « Jeu ou usure… ». Title et H1 inchangés. |
| capteur-abs | Meta « via code défaut un capteur grippé » ; H1 en capitales « ABS, ASR, ESP : SYSTÈME DE FREINAGE… » | Corriger la syntaxe de la meta et la casse du H1. Pour « voyant abs allumé » (position 44,7), vérifier d'abord la couverture du contenu, avant tout changement de title. |
| cylindre-de-roue | Title « Cylindre de roue : symptômes de fuite, changement et purge » | Mentionner « arrière » ou « grippé » seulement si le contenu couvre ces cas. |

## 8. SQL proposé (non exécuté)

- **pg 1298** : `#CompSwich_3_1298#` → `#CompSwitch_3_1298#`. 10 variantes alias 3 existent : le fragment réel serait servi.
- **pg 1289** : `#CompSwicth_12_1289#`, correction d'hygiène seulement. Les alias 11 à 16 sont des family switches que le service TS ne lit pas : même bien orthographié, le marqueur ne rendrait rien.
- **pg 3096** : `#ContentLinkToGamCar#` ×3, `#ContentLinkToGam#`, `#ContentLinkToCar#`. **Décision owner** : aucun mapping connu, rien à inventer.
- **Nettoyage des 213 META conseils non conformes à la source** : décision owner.

## 9. Recommandations P4 et observations non corrigées

**Mesure**
- Migrer `trafficWindow`, `topLosers`, `lowCtr` et `alerts` vers `property_total` / page_totals, avec des fenêtres ancrées sur le dernier jour confirmé.
- `__seo_event_log` : environ 655 000 lignes et 481 Mo, sans rétention.

**Rafraîchissement**
- Règle d'ancienneté du job et consommateur de `cron/health` (D14).

**Intentions**
- Confronter les requêtes du §7 au contenu WIKI validé avant toute réécriture. Aucune génération de masse.

**Backlinks**
- Toute ressource candidate doit sortir du WIKI validé (ADR-031). Aucun achat ni scraping.

**Crawl et conversion**
- Sitemap blog : `lastmod` 2019–2021 ; `dateModified` en lot au 2026-02-17 ; crawl logger non branché.
- JSON-LD `relatedLink` en 410 ; pages R3 sans sélecteur de véhicule ni CTA tracé ; `/panier` (§4.6).
- `/cart` et `/cart/` dans le groupe `*` ; Bingbot sans `/search?*` (hors décision, qui ne portait que sur Googlebot).

## 10. Décisions owner

**Accords réels.** Source : transcript de session `255e5677-ce36-4729-8ea6-211d181003ca`, réponse AskUserQuestion du **2026-09-10T22:49:10.782Z**.

| # | Décision | Réponse | Portée appliquée |
|---|---|---|---|
| 1 | Correction de la mesure par page | « Table additive (Recommandé) » | Migrations préparées, non appliquées. La mention « avant merge » de l'option est **remplacée** par la consigne ultérieure : aucune application sans revue, tests et GO (§4.7). |
| 2 | Politique robots Googlebot | « Recherche bloquée (Recommandé) » | Recherche interne bloquée ; panier, commande et compte explorables + noindex ; tracking explorable ; `Crawl-delay` retiré ; repli généré depuis la même source. |
| 3 | Validation de contenu | « Garde marqueurs R2, Filtre META conseils, Résoudre 2 variables » | Pour les liens, précisé par la consigne du point 4 : on neutralise le lien et on garde le texte. |
| 4 | Guards du contrôleur admin | « Oui, guards admin (Recommandé) » | Code et test. Aucun déploiement. |

**Accords réels, suite.** Même transcript, réponse AskUserQuestion du **2026-09-11T12:42:54.294Z**. Libellé de la question : « Aucun merge, migration, tag ni déploiement dans aucune option. »

| # | Décision | Réponse | Portée appliquée |
|---|---|---|---|
| 5 | Étape autorisée | « PR guard-only (Recommandé) » | Branche dédiée depuis `origin/main`, rejeu des tests, push, PR #1460 en draft. Projections registry régénérées dans la même PR après signalement CI. Aucun merge. |
| 6 | Vérification des appelants de `cron/health` | « Je lis les logs PROD » | Lecture seule des journaux d'accès Caddy. Depuis DEV : accès SSH refusé. **Réalisée par l'owner** sur la machine PROD le 2026-09-11, avec les commandes fournies : 0 appel, contrôle positif retrouvé (§4.3). |
| 7 | Sortie du draft de #1460 (message du **2026-09-11T14:20:14.329Z**) | « oui » | PR passée en « ready for review ». Pas d'auto-merge, pas de merge, pas de déploiement. |
| 8 | Merge de #1460 (message du **2026-09-11T14:47:10.066Z**) | « go » | Mise à jour de branche, régénération, CI verte, squash épinglé sur le SHA vérifié. Merge = PREPROD. **Pas de tag PROD** : le « go » n'a pas été lu comme un GO de mise en production. |
| 9 | Tag PROD (message du **2026-09-11T21:09:50.040Z**) | « push tag » | Traité comme une **demande de confirmation**, pas comme un GO : un GO PROD doit nommer le lot et ses PR. **Aucun tag poussé.** Lot candidat au 2026-09-11 21:35Z : `v2026.09.09-throttler-caddy-perf-cache..38747ac6b`, 33 PR. |
| 10 | Tag PROD (message du **2026-09-11, 21:44Z**) | « GO PROD pour le lot `v2026.09.09-throttler-caddy-perf-cache..38747ac6b` » | Lot nommé sans ambiguïté, après publication de la liste des 33 PR et de l'échec Lighthouse connu. Contrôle préalable : l'échec Lighthouse a bien la cause préexistante (`/search?q=plaquette`, preuve invalide). Tag `v2026.09.11-cwv-sanitizer-admin-guard` posé sur `38747ac6b` à 21:49Z ; deploy PROD ✅ à 21:51:31Z ; **garde admin vérifiée en PROD : `cron/health` = 403**. |

**Propositions à valider** (aucun accord identifiable) :
- emplacement du collecteur (PROD) et désactivation du collecteur DEV ;
- correctif D14 ;
- option A ou B du §4.7 ;
- périmètre et calendrier de la reprise ;
- corrections des 5 pages ;
- SQL pg 1298 / 1289 / 3096 et nettoyage META ;
- `/panier` vers `/cart` (zone STOP) ;
- réancrage des consommateurs v1 ;
- vérification des appelants de `cron/health`.

## 11. Local ou GO

- **Local, commité sur la branche** : tous les commits depuis `fe658657d` jusqu'à la tête de branche (`git log bcf0c775a..HEAD`). Parmi eux : ce rapport (`cdbdb58a4`) et une entrée `log.md` créée automatiquement par le hook Stop (`f2ab4cbbb`).
- **Local, non suivi** : patch guard-only ; description de PR (`.claude/handoffs/`).
- **Mergé sur main** : la garde admin seule, PR #1460 (§4.5). Déployée sur PREPROD via le run de `f64ef5197`, puis via celui de `38747ac6b`. Rien d'autre n'a quitté la machine DEV.
- **Déployé en PROD** : la garde admin, par le tag `v2026.09.11-cwv-sanitizer-admin-guard` sur `38747ac6b`, le 2026-09-11 à 21:51Z. Vérification en PROD : `GET /api/admin/seo-monitoring/cron/health` = **403** (200 sans authentification avant), `credentials/health` = 403, `/` et `/health` = 200.
- **Nécessite un GO** : chaque étape du §4.7, les SQL du §8, les corrections du §7, les purges, le tag PROD.

**Fait le 2026-09-11** : le lot complet a été audité (33 PR), puis taggé sur GO owner. `/api/admin/seo-monitoring/*` n'est plus ouvert sans authentification en PROD. Lighthouse `/search` reste rouge sur main : cause préexistante, hors périmètre de ce rapport.

**Prochaine action unique proposée** : GO owner sur l'exécutant de l'ingestion GSC et sur les 2 migrations. Sans collecteur fiable, aucune correction de mesure ne produit de donnée.

## 12. Vérification liée au SHA `25cfd1bc4`, rejouée pour `771c7b934`

Tout a été exécuté localement, séquentiellement, le 2026-09-11. Les journaux sont conservés hors dépôt (scratchpad de session). Tous les codes de sortie valent 0.

Entre `25cfd1bc4` et `771c7b934`, le seul changement de code est `frontend/tests/unit/robots-txt-fallback.test.ts`. Les contrôles frontend touchés ont été rejoués à `771c7b934` (second tableau). Les contrôles backend, des paquets et SQL ne sont pas concernés.

| Contrôle | Résultat |
|---|---|
| `packages/seo-types` : build, `tsx --test src/*.test.ts`, tsc | build OK ; **81 passés / 0 échec / 0 sauté** (21 suites) ; tsc 0 |
| `packages/seo-url-contract` : tests, tsc | **5 / 0 / 0** ; tsc 0 |
| backend `jest --ci` (suite complète) | **271 suites passées, 1 sautée, 0 en échec ; 3 247 tests passés, 23 sautés, 0 en échec** ; 5 snapshots |
| — suite sautée | `seo-control/rpcs.test.ts` (`describeIfDb`, vraie base requise) : **non validée**. Exécutée seule, elle donne 1 suite sautée et 23 tests sautés, soit exactement les sauts de la suite complète. |
| backend `tsc --noEmit --incremental false` | 4 917 fichiers, 0 erreur |
| backend ESLint (33 fichiers `src` modifiés) | **0 erreur, 35 avertissements** `no-explicit-any` (26 lignes contenant `any` ajoutées par la branche, surtout dans des tests ; aucun plafond d'avertissements dans la config CI). `backend/tests/**` hors projet ESLint : **non applicable** |
| frontend vitest `robots-txt-fallback` | 3 / 3 |
| frontend `tsc --noEmit --incremental false` | 2 051 fichiers, 0 erreur |
| frontend ESLint `--max-warnings=0` (3 routes) | 0 erreur, 0 avertissement |
| Squawk 2.52.1 (2 migrations) / `--lint-markers` | 0 issue / OK |
| Banc SQL éphémère | 80 PASS / 0 FAIL |

**Rejoués à `771c7b934`, avec les gardes CI reproduites localement :**

| Contrôle | Résultat |
|---|---|
| frontend ESLint sur les 4 fichiers de la branche (3 routes + test robots), comme `turbo lint` en CI | 0 erreur, 0 avertissement. Avant correction : 1 **erreur** `import/first` dans le test. |
| frontend vitest, suite complète (commande CI, sans couverture) | 68 fichiers, **525 tests passés**, 0 échec |
| frontend `tsc --noEmit --incremental false` (tests inclus) | 2 051 fichiers, 0 erreur |
| Garde bloquante des nouveaux fichiers (`scripts/registry/check-new-files.js --base origin/main`) | 33 nouveaux fichiers, 33 OK (propriétaire et domaine) |
| Ratchet des fichiers orphelins (`audit:orphan-ratchet`) | aucun finding |
| Ratchet des écritures de contenu servi (`audit:served-write-ratchet`) | correspondance exacte avec la baseline (61 clés, 265 occurrences) |
| Ratchet de dérive des contrats (tableau de bord régénéré, ignoré par git, puis `check-contract-drift-ratchet.ts --json`) | pass : 0 ajout, 296 réductions |

**Non exécuté** :
- `rpcs.test.ts` sur une vraie base (interdit sans base jetable équivalente) ;
- workflows CI, E2E et Lighthouse (aucun push) ;
- régénération du registre (F4, reportée après rebase dans un environnement équivalent à la CI, car les `dist` locaux produisent du bruit d'environnement) ;
- concurrence réelle entre deux collecteurs.

## 13. Errata

- **`84e9e57ce`** annonçait 4 `href` et une destination inchangée. En réalité il y en a 5, et la destination changeait. Corrigé par `5cc403e5f`.
- **Vérifications backend filtrées.** Les messages de `8719db00a` (« 36 suites / 447 tests ») et le plan (« 41 suites / 529 tests à `f2a7ff9e9` ») décrivent des exécutions **filtrées**, pas la suite complète (272 suites). Elles n'ont pas vu que `tests/unit/seo-template-interpolation.test.ts` ne compilait plus depuis `84e9e57ce` (TS2554, 0 test exécuté dans ce fichier). Corrigé par `bb9aea9a8` : seul l'appel du constructeur change, aucune assertion, 46/46.
- **`v4` exposait `days_present`** égal aux jours commités et rangeait les jours non commités parmi les manquants. Vocabulaire unifié par `a60d1b6a6`.
- **« Veille UTC » et « J-2 » présentés comme bornes de finalité** : corrigé par `b3448f055`.
- **`backend/.env.example`** qualifiait le seuil page_totals d'« alerte ». Depuis `6bdc8c9ae`, c'est un seuil de signal hors certification. Commentaire corrigé dans `25cfd1bc4`.
- **Erreur ESLint bloquante non vue.** `frontend/tests/unit/robots-txt-fallback.test.ts` (`039a44fc5`) portait une erreur `import/first`. Le job CI « ESLint » (`turbo lint`, soit `eslint .` côté frontend) aurait échoué. Le lint local annoncé plus tôt ne couvrait que les 3 routes. Corrigé dans `771c7b934`, en déplaçant seulement l'import : 3/3.
- **Commentaire de `ingestion-date-planner.ts`** (`4007ff96d`) : il annonçait 18 dates perdues. Le relevé du 2026-09-11 en compte 19, identiques sur les 4 grains. Corrigé dans `25cfd1bc4`.
- **Journaux du backend PROD.** Le §4 et la description de #1460 affirmaient que le backend ne journalise pas les requêtes HTTP (« `LoggerModule` jamais importé »). C'est faux :
  - `LoggerModule.forRoot(loggerConfig)` est importé dans `backend/src/app.module.ts:98` ;
  - les journaux PROD lus par l'owner le 2026-09-11 montrent une ligne par requête (`req.url`, `statusCode`, `responseTime`).
  - **Cause** : recherche git avec le motif `backend/src/**/*.ts`, qui exige un sous-dossier et ne voit pas `app.module.ts`.
  - **Correction** : §4 et description de #1460 (erratum daté). Le résultat sur les journaux Caddy reste valable. Les journaux du backend n'ont pas été lus.

## 14. Coverage manifest

| Champ | Valeur |
|---|---|
| scope_requested | 7 leviers SEO ; P1 fiabilité GSC, P2 robots, P3 cinq pages conseils + `#CompSwicth_12_1289#`, P4 recommandations ; puis points 1 à 7 de la consigne de finalisation locale |
| scope_actually_scanned | Modules `seo-monitoring`, `admin` (seo-control, command center, santé des jobs), `catalog` (SeoTemplateService), `blog` (R3), `rm` ; robots (backend + frontend + `seo-url-contract`) ; migrations et RPC seo-control/low CTR ; workflows de migration et de fraîcheur du ledger ; compose PROD ; parcours abandoned-cart ; lectures PROD bornées (tables GSC, `__seo_event_log`, `__admin_job_health`, `__seo_gamme_car`, META blog) ; API GSC en lecture ; pages live |
| files_read_count | 46 fichiers distincts par l'outil Read (session principale), plus des lectures partielles par 486 commandes shell, non dédupliquées |
| excluded_paths | `payments/`, TecDoc, autres projets, vault, écriture des contenus |
| unscanned_zones | GA4 au-delà du planificateur ; données de liens entrants ; contenu WIKI des 5 pages ; journaux d'accès PROD ; configuration réelle de l'`env_file` PROD ; comportement E2E du container PREPROD sur les routes admin SEO |
| corrections_proposed | §2 (D1 à D13 codés), D14, §4.7, §6, §7, §8, §9 |
| validation_executed | §12 (au SHA `25cfd1bc4`, contrôles frontend et gardes CI rejoués à `771c7b934`) ; banc SQL éphémère ; capture API en lecture ; relevés live en GET ; Q1 et relevé par grain exécutés en lecture seule sur PROD le 2026-09-11 (`transaction_read_only = on`, `statement_timeout` 10 s) |
| remaining_unknowns | Exécutant PROD historique ; cause de l'anomalie GA4 07-22→24 ; activation réelle de `SEO_CONTROL_DASHBOARD_ENABLED` en PROD ; appelants externes de `cron/health` ; comportement réel du ledger et de PREPROD selon l'option A ou B ; concurrence entre collecteurs |
| final_status | **PARTIAL_COVERAGE** |
