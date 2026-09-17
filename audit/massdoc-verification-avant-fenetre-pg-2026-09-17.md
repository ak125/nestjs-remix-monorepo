# Vérification avant la fenêtre PostgreSQL 17.4 → 17.6

> **POST-MORTEM — ajouté le 2026-09-17 après la fenêtre (dernière écriture 13:06 CEST).**
> La fenêtre a eu lieu : **PostgreSQL 17.6**, instance **neuve** (`postmaster_start`
> = 2026-09-17 01:14:25+00). **Deux affirmations de ce document sont démenties**, et elles ont
> la même cause racine : il supposait un bump **en place**, or Supabase a **re-provisionné**.
>
> | Affirmation (§6) | Réalité mesurée à 13:04 |
> |---|---|
> | « `invalid_indexes` doit valoir **1** après, pas 0 » | **0** — l'instance neuve n'a pas recréé `idx_pieces_ref_search_piece_id_kind` (`index_total` 3465 → 3464 : exactement cet index). 0 est le résultat **normal**. |
> | « `pg_stat_statements.save = on` ⇒ compteurs conservés » | **Remis à zéro** — `stats_reset = 2026-09-17 00:53:39+00`. La baseline quantitative (596 748 appels @ 985,6 ms) est **définitivement incomparable**. |
>
> **Ce qui tient intégralement** : §3.1 — `auto_explain.log_nested_statements = off` et
> `pg_stat_statements.track = top` **revérifiés après l'upgrade**, inchangés. La régression de
> plan interne reste indétectable. Le container PROD **n'a pas été redémarré** (uptime continu
> à travers la coupure) : il s'est reconnecté seul, comme le §5 l'annonçait.
>
> **Prédiction confirmée** : `refresh-gamme-aggregates` tué **2 fois à exactement 60,0 s**
> (01:15 et 01:30, cache froid + `statement_timeout` du rôle `postgres`), **rétabli seul dès
> 01:45** puis 38 succès d'affilée. Transitoire, clos. *La vérification automatique de 06:44 a
> rapporté « jobs_cron_tues_au_plafond = 0 » : elle ne regarde que la dernière heure.*
>
> **Aucune perte de données** : les écarts de lignes de la baseline sont de la dérive
> d'estimation (`lignes_estimees` = `n_live_tup`, `ANALYZE` complet entre 01:25 et 01:39),
> prouvé par `n_tup_del = 0` sur les 7 tables et des écarts **dans les deux sens**.
>
> Détail : `/opt/automecanik/backups/upgrade-pg-2026-09-17/ERRATA-lire-avant-de-conclure.txt`.


**Date** : 2026-09-17, 00:00–00:20 CEST · **Nature** : contre-vérification en lecture seule du
rapport `audit/balayage-live-2026-09-16.md` (envoyé à 22:25, sha256 `dbed5e96…`).
**Aucune mutation** : ni fichier du dépôt, ni branche, ni ligne de base, ni processus.

**Méthode** : 7 sondes indépendantes (runtime DEV · planification · preuves du DROP · état DB ·
PR/CI · plan de référence · impact de la coupure), chacune soumise à **2 relecteurs adverses**
avec des lentilles distinctes — *la preuve prouve-t-elle ?* et *l'action aggraverait-elle ?*
23 agents, 0 erreur, 50 min. Un constat n'est retenu que si **aucun** des deux relecteurs ne le
réfute.

**Résultat** : 62 constats survivants · 34 contestés (1 réfutation sur 2) · 28 abandonnés (2 sur 2).
Parmi les survivants : 5 BLOQUANT, 12 RISQUE, 21 À SURVEILLER, 24 AUCUN ; 9 en zone STOP.

> Les mesures marquées **[vérifié directement]** ont été rejouées à la main après l'orchestration,
> à 00:12–00:15 CEST. Les autres proviennent des sondes et portent leur preuve dans la sortie brute
> (voir §9).

---

## 1. Verdict — GO sous réserve

Rien côté base ne bloque la bascule. **[vérifié directement]** à 00:12 :

```
version()                = PostgreSQL 17.4 on aarch64-unknown-linux-gnu
index_total              = 3465        index_invalides    = 1   (connu, 0 octet)
prepared_xacts           = 0           replication_slots  = 0
locks_non_accordes       = 0           idle_in_transaction = 0
schema tecdoc_rebuild    = ABSENT      postmaster_start   = 2026-09-14 15:59:08+00
```

La réserve ne porte pas sur la base. Elle porte sur **deux automatismes qui peuvent agir sans
décision humaine cette nuit** (§7) et sur un **runtime PROD âgé de 25 minutes** à l'entrée de la
fenêtre (§2).

---

## 2. Ce qui a changé depuis le rapport de 22:25

Quatre actions en zone gouvernée sont entrées entre 23:01 et 23:48, pendant la vérification.
Elles ne sont pas le fait de l'agent : aucune sonde n'avait le droit de muter.

| Heure CEST | Action | Preuve |
|---|---|---|
| 23:01:37 → 23:02:59 | 8 `DROP INDEX` sur massdoc | `index_total` 3481 → 3473 |
| 23:19:58 | `DROP SCHEMA tecdoc_rebuild` | schéma **ABSENT** **[vérifié directement]** ; 3473 → **3465** |
| 23:31:46 | PR #1498 mergée sur `main` | `d1b8f8ddaa93db383283a4d8c68e3bb494fbc5df` **[vérifié directement]** |
| 23:36:13 | migration `20260916_seo_cwv_trend_detector_vacancy_signal` **appliquée à la base** | dispatch manuel, run `35153254619`, *1 migration(s) applied, 389 ms* |
| 23:39:10 → 23:48:13 | **tag PROD `v2026.09.16-imgproxy-redis-caddy-pins`** déployé, succès | run `35153554301` **[vérifié directement]** |

Conséquences directes :

- Le **runtime PROD entre dans la fenêtre avec ~25 min d'existence** (process démarré 23:46:36),
  portant cinq PR qui touchent Caddy, imgproxy, Redis et la normalisation d'IP client.
- Le CI du merge **tournait encore** au moment de la rédaction : `🎭 E2E Smoke Tests` terminé en
  succès à 23:48:14, mais `🔦 Lighthouse Performance Audit` démarré à **00:01:49** et toujours
  `in_progress` **[vérifié directement]** à 00:14. Lighthouse charge de vraies pages PREPROD,
  donc **la même base**. → **Terminé : run `35152889515` = `completed / success`, revérifié à
  00:30 [vérifié directement]. Plus aucun job CI ne touche la base.**
- La consigne « ne rien merger cette nuit » du rapport est sans objet pour cette PR : c'est fait.
  Elle reste valable pour les suivantes (§5).

### Ce qui reste vrai, revérifié

- `baseline-avant-upgrade.txt` (mtime 23:20) correspond **exactement** au live (3465 / 824). La
  photo AVANT est utilisable telle quelle ; les deux versions antérieures portent le suffixe
  `-perimee`.
- `/health` ne touche pas PostgreSQL, ni sur DEV ni sur PROD — il restera vert pendant la coupure.
- Un seul stack `npm run dev` sur DEV (relancé 23:30:33). La topologie a changé **trois fois**
  aujourd'hui : ne pas la traiter comme acquise.
- cron système `masked` / `inactive` sur DEV — les 3 sondes (sync-dev-runtime, vault-sync,
  registry-self-heal) sont mortes ; les 14 minuteries systemd tournent.
- `idx_pieces_relation_type_type_id_composite` présent et `indisvalid = true`.
- Répétables BullMQ armés pendant la coupure : `abandoned-cart` (15 min) et `seo-outbox-relay`
  (5 s). `supplier-sync` et `seo-projection-feeder` sont **inertes** (flags absents de
  `backend/.env`) — ne pas chercher leurs échecs, il n'y en aura pas.

---

## 3. Corrections au rapport du 2026-09-16

### 3.1 — Le détecteur de régression annoncé n'existe pas `[le point qui compte]`

Le rapport, `plan-reference-avant-upgrade.txt` **et** `scripts/ops/verify-after-upgrade.sh`
affirment : « le détecteur d'une régression interne est `auto_explain`, armé à 10 s ».
**C'est faux. [vérifié directement]** à 00:12 :

```
auto_explain.log_min_duration      = 10s
auto_explain.log_nested_statements = off      <-- aveugle à l'intérieur des plpgsql
pg_stat_statements.track           = top      <-- ne compte pas non plus l'imbriqué
pg_stat_statements.save            = on       (compteurs conservés ; reset 2025-12-10)
```

Les deux instruments ne voient que l'instruction de plus haut niveau — pour un appel RPC, c'est
l'enveloppe PostgREST, pas le corps de la fonction. Mesure corroborante : sur **198 plans
journalisés en 24 h** mentionnant `get_soft_404_alternatives`, **un seul** montre
`pieces_relation_type`.

Gravité : le script `verify-after-upgrade.sh` **imprimera cette phrase dans son rapport par mail**
après la fenêtre. Une fausse assurance logée dans un artefact exécutable est pire qu'une absence
de mesure. **Ne pas corriger le script cette nuit** (mutation d'outillage juste avant usage) —
mais ne pas croire cette ligne demain matin. Errata déposé à côté du plan de référence :
`/opt/automecanik/backups/upgrade-pg-2026-09-17/ERRATA-lire-avant-de-conclure.txt`.

### 3.2 — Les compteurs de base du rapport sont périmés

Le rapport décrit 3481 index / 826 tables / 130 GB. Le live est à **3465 / 824 / 129 GB**.
Toute ligne du rapport parlant d'`index_total` est à ignorer.

### 3.3 — « Attendu : Index Only Scan » n'est pas une contradiction

L'en-tête du plan de référence annonce `Index Only Scan` alors que la requête archivée est un
`SELECT *` (width=43), qui ne *peut pas* en produire un. Ce sont **deux requêtes différentes** :
l'attendu décrit le nœud **interne** de la fonction, qui reste valide. **Ne pas supprimer le mot
« Only »** — cela reviendrait à écrire qu'une perte d'index-only sur la table de 49 Go ne doit
pas alerter.

### 3.4 — Le warn « DEV:3000 DOWN » du hook de session est périmé deux fois

DEV répond (HTTP 200, **[vérifié directement]**), et le stack a été relancé à 23:30:33. L'alerte
du hook date du 2026-09-14.

### 3.5 — Deux corrections de justification

- `verify-after-upgrade.sh` : `SWEEP=` et `BASELINE_SQL=` **ne sont pas** des affectations dures
  (`HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` puis `REPO="$HERE/../.."`) — elles
  suivent la copie si l'arborescence est préservée. Le geste recommandé reste bon, sa
  justification était fausse. Le risque réel, lui, n'avait pas été dit : **l'envoi du mail est le
  comportement par défaut**, `--check` l'inhibe.
- « Aucun `DATABASE_URL` côté PROD » : faux. `docker-compose.prod.yml` déclare `DATABASE_URL` et
  `SUPABASE_SERVICE_ROLE_KEY` dans `environment`. Ce qui tient est l'**absence de pilote** —
  aucune dépendance `pg` / `knex` / `typeorm` / `drizzle-orm` / `sequelize` dans
  `backend/package.json`. C'est cette preuve-là qu'il faut citer.

---

## 4. À faire avant la coupure

1. ~~**Attendre la fin du run `35152889515`**~~ — **FAIT.** `completed / success` à 00:30
   **[vérifié directement]**. C'était `🔦 Lighthouse`, pas l'E2E. Plus aucun job CI n'est en vol.
2. **Sonder la reprise sur les bonnes URL.** Ni `/health` (ne touche pas PostgreSQL), ni
   `/health/ready` (ne regarde que Redis), ni `/api/catalog/families` (servi du cache applicatif,
   4 ms même avec cache-buster) : **les trois resteront verts pendant la panne.**
   - DEV : `curl -s http://localhost:3000/api/rm/health` — **lire le corps, pas le code HTTP**
     (rend 200 même en erreur). Son `timestamp` est un `now()` PostgreSQL : s'il avance, la base
     répond.
   - PROD : `curl -s -o /dev/null -w '%{http_code} %{size_download}\n' "https://www.automecanik.com/pieces/plaquette-de-frein-402.html?_=$(date +%s)"`
     → attendu `200 233894` (±quelques %), `cf-cache-status: MISS`.
3. **Le cache-buster est obligatoire, pas cosmétique.** Le chemin R2 dégradé rend un **HTTP 200
   avec `X-Robots-Tag: noindex, follow`**, pas un 503. Sonder l'**URL nue** pendant
   l'indisponibilité peut faire mettre en cache edge une réponse noindex, servie ensuite à
   Googlebot. *Zone SEO indexé.*
4. **Premier rejeu de `verify-after-upgrade.sh` en `--check`**, diff relu avant tout envoi, et
   avec **`STATEMENT_TIMEOUT_MS=120000`** : la photo AVANT a été prise à 120 s, le rejeu est à
   60 s par défaut — sur base à cache froid, un dépassement sort en `exit 1` **sans produire le
   moindre diff**, et le mail part quand même.
5. **Sortir l'outillage du worktree en préservant l'arborescence.** `verify-after-upgrade.sh`,
   `sweep-psql.sh` et `baseline.sql` n'existent que dans `.claude/worktrees/skill-live-evidence`,
   absents de `main`.
6. **Mettre le pack de preuves du DROP à l'abri, hors machine.**
   `.claude/worktrees/codex-tecdoc-xl-large-20260914/scripts/db/tecdoc-drop-candidate/` — 175
   fichiers, 17 Mo, non suivis par git, jamais poussés. Copier l'**arbre entier** (les sous-dossiers
   `t232-` et `t400-` portent deux autres autorisations). Y joindre
   `/opt/automecanik/backups/hygiene-2026-09-16/index-ddl-sauvegarde.sql` et
   `audit/massdoc-db-hygiene-candidates-2026-09-15.md`. Une copie dans `/opt/automecanik/backups/`
   **ne suffit pas** : même `/dev/sda1`, occupé à 89 %.
   *Vecteur réel de perte : `prune-merged-worktrees.sh`, invoqué 5 fois le 16/09 — pas `git gc`,
   dont la stratégie est `incremental`, sans `prune`, et qui ne touche pas les fichiers non suivis.*
7. ~~**Relever une ligne de base de bruit**~~ — **FAIT.**
   `select count(*) from public.__seo_event_log where created_at > now() - interval '24 hours'`
   → **4488** à 00:30 **[vérifié directement]**. C'est le repère contre lequel lire l'émission de
   jobid 21 à 06:00. Voir §6.

Si seuls les points 1 et 2 sont faits, la fenêtre s'ouvre quand même sans danger. Le reste sert à
rendre le lendemain matin **interprétable**.

---

## 5. À ne pas faire cette nuit

| Interdit | Raison en une ligne |
|---|---|
| `dpkg --configure -a`, `apt -f install`, `update-initramfs`, `update-grub` | Le noyau 6.8.0-139 est dépaqueté sans initramfs et absent de `grub.cfg` — le configurer en ferait le noyau par défaut, jamais démarré ici. |
| `systemctl unmask cron` | Rallumerait `prune-merged-worktrees.sh --apply` à 03:30, en pleine fenêtre. |
| Supprimer l'index invalide `idx_pieces_ref_search_piece_id_i_kind` | Troisième DDL non gouvernée de la soirée, pour 0 octet. |
| Tout `REINDEX` / `CREATE INDEX` / `VACUUM` correctif | Le plafond de 60 s du rôle `postgres` a déjà tué un `CREATE INDEX CONCURRENTLY` sur ce projet. |
| Tout merge sur `main` | `ci.yml` n'a **aucun filtre de chemin** : merger un seul `.md` reconstruit l'image, réécrit `:preprod` et remplace le container, qui tapera une base absente. |
| Vider Redis, purger une file, mettre une queue en pause | Le cache `rm:page-v2` n'écrit jamais une erreur (`'error' → null`) : rien à purger, et il est l'amortisseur pendant que `shared_buffers` repart à froid. |
| Redémarrer le container PROD « pour reconnecter » | Rien à reconnecter : tout passe par supabase-js en HTTPS, aucun pilote PG dans les manifestes. |
| Réparer #1480 | La réparer la ferait partir toute seule : son auto-merge est armé. |
| `docker exec redis-prod …` | Ce nom n'existe pas — `redis_prod` n'a pas de `container_name`. Résoudre via `docker compose ps -q redis_prod`. |

---

## 6. Ce qu'on saura, et ne saura pas, détecter après

**On saura** : qu'une DDL humaine est passée (compteurs structurels) · que le corps de
`get_soft_404_alternatives` n'a pas changé (`md5(pg_get_functiondef)` = `99b359d0…`, identique à
l'octet près au `prosrc` de `backend/supabase/migrations/20260518180000_soft_404_rpcs.sql`) · que
la base est revenue (sondes §4.2) · qu'un seq scan littéral est apparu dans la requête proxy · que
les compteurs `pg_stat_statements` ont survécu (`save = on`).

**On ne saura pas** :

- **Une régression de plan à l'intérieur de `get_soft_404_alternatives`** — la seule qu'un bump
  mineur puisse réellement produire sur le chemin chaud (§3.1). Et le détecteur du script ne
  cherche qu'un `Seq Scan` : un basculement vers `idx_prt_pg_id_type_id` (miroir exact du
  composite) ou vers un Bitmap Heap Scan lira « non ».
- Un changement de propriétaire ou de GRANT sur une fonction SECURITY DEFINER —
  `pg_get_functiondef` ne rend ni `proacl` ni `proowner`.
- **Quel** index aurait disparu : la baseline compte, elle ne nomme pas.
- Une régression de latence : la moyenne `pg_stat_statements` court depuis 9 mois et 597 000
  appels — un doublement sur 10 000 appels la déplacerait de 986,6 à ~1003 ms, soit **+1,7 %**.

**Deux consignes de lecture, sinon le rapport de demain trompera son lecteur :**

- **`exit 2` n'est pas un verdict.** `NB_ECARTS` compte des *lignes de `diff -u`* : chaque valeur
  changée en coûte deux. La version change par construction, `taille_base` très probablement, et
  les 11 lignes de `n_live_tup` après `vacuumdb --analyze-in-stages`. Plusieurs dizaines d'écarts
  sont **normales** sur un upgrade propre. Lire le diff ligne à ligne.
- **`invalid_indexes` doit valoir 1 APRÈS, pas 0.** Un bump mineur ne reconstruit pas le
  catalogue : la persistance de l'entrée fantôme est le résultat normal. Un passage à 0 est un
  écart à instruire, pas une amélioration.

**Nouveau code qui tire juste après la fenêtre** : la migration appliquée à 23:36 remplace
`public.detect_cwv_trend_divergence()` (plpgsql, **SECURITY DEFINER**) et lui ajoute deux `INSERT`
et un `UPDATE` dans `__seo_event_log`. Son appelant est `cron.job` **jobid 21**
(`cwv-trend-divergence-detection`, `0 4 * * *` = **06:00 CEST**). Son tout premier run dans sa
nouvelle forme tombe donc **juste après la fenêtre, sur base à cache froid**, et son objet est
d'émettre. À écrire noir sur blanc dans le dossier : *jobid 21 à 04:00 UTC = nouveau code, pas un
symptôme d'upgrade.*

**Verdict net** : le plan de référence archivé détecte une DDL humaine et le retour du service. Il
ne détecte pas la régression qu'il prétend surveiller — et lancé tel quel, il écrira le contraire.

---

## 7. Demande un accord nominatif de l'owner

Listés, non recommandés.

1. **Les deux mutations DDL du 16/09 au soir.** Garde-fous techniques respectés (export CSV.GZ
   vérifié, DDL de recréation écrit à 22:56 soit 5 min avant le premier drop, `RESTRICT`, séquence
   `tecdoc_map.source_linkages_id_seq` préservée). Les écarts sont le **moment** — le lot C
   prescrivait « après l'upgrade et ses vérifications, une seule mutation DDL par fenêtre » — et
   l'**absence de trace d'un GO**. Réserve à connaître : sur `___xtr_msg`, `__cnit_raw` et
   `cars_engine`, le jumeau **conservé** affiche `idx_scan = 0` depuis 15 mois — c'est le doublon
   retiré qui était choisi. Couverture logique identique, mais ces chemins seront neufs pour le
   planificateur à cache froid. Un des 8 drops (`idx_pieces_list_sort`) **n'avait aucun jumeau**,
   le fichier de sauvegarde le dit lui-même.
2. **Les gâchettes autonomes.** #1464 et #1480 sont BEHIND et **dormantes** (20 avancées de `main`
   depuis leur armement, aucune n'est partie). La seule réellement capable de tirer cette nuit est
   `.github/workflows/registry-deps-self-heal.yml` — `cron: "30 2 * * *"` (l.93),
   `gh pr merge "$PR_NUMBER" --auto --squash` (l.235). Elle **crée sa propre PR**, donc elle naît
   à jour et `strict: true` ne la retient pas. Désarmer #1464 et #1480 sans la suspendre serait un
   désarmement **partiel**, donc pire qu'aucun. Nuance mesurée : les crons de ce dépôt tirent avec
   2 à 5 h de retard sur leur heure nominale depuis trois jours.
3. **Le cron sitemap.** `sitemap-daily-regen.yml`, `cron: "0 3 * * *"`, POST de régénération sur la
   PROD publique. Les trois derniers déclenchements observés sont à 08:15 / 08:21 / 08:31 UTC :
   l'exposition réelle n'est pas la coupure, c'est la **base froide en milieu de matinée**. Si
   neutralisation, alors jusqu'à validation post-upgrade explicite — pas « jusqu'à la fin de la
   nuit ». Relever le nombre d'URL du sitemap avant. *SEO indexé.*
4. **Le chemin R2 dégradé** : HTTP 200 + `X-Robots-Tag: noindex, follow` quand le RPC échoue. Le
   risque n'est pas une page vide indexée, c'est un **signal noindex de masse** sur des R2
   normalement indexées. Correctif = SEO indexé, pas cette nuit. Surveillance J+3 à J+10 :
   « Exclue par la balise noindex » et « Introuvable (404) » sur `/pieces/*.html`.
5. **`__rls_reconcile_internal_tables`** (jobid 23) : seul job planifié qui fait du DDL toutes les
   heures, sur des tables RLS et tarifaires. Protégé (`SET LOCAL lock_timeout = '3s'`,
   mono-transactionnel). **Ne pas y toucher.** Dossier séparé à froid : son
   `EXCEPTION WHEN OTHERS … retry next run` avale silencieusement un échec par table.
6. **Tout rejeu de job touchant `abandoned-cart` ou `supplier-sync`**, et **toute promotion PROD**
   (tag `v*`).

---

## 8. Couverture honnête

- **Rien n'a été muté.** `SELECT` sur catalogues et statistiques, `ls`, `curl`, `gh … list/view`,
  `git rev-parse` / `ls-remote`. Aucun `EXPLAIN ANALYZE`, aucune requête sur les tables chaudes,
  rien sur `pieces_media_img*` ni `rack-images`.
- **Non vérifiable d'ici — appartient à l'owner :**
  - **Sauvegardes et PITR.** Un bump mineur **ne se rollback pas** : le seul levier est un PITR
    vers un nouveau projet. Le jeton de management est révoqué, seul le tableau de bord fait foi.
    Il manque aussi le **critère d'abandon** : personne n'a écrit « si la sonde §4.2 est muette à
    H+N, alors X ».
  - **Le plafond de dépenses Supabase** (ACTIF + bandeau de dépassement depuis le 09-15). Un
    projet restreint par le fournisseur **pendant** un upgrade est un mode de panne composé que
    personne n'a écarté, et qui changerait la lecture de toutes les sondes de reprise.
  - **L'heure exacte de la bascule** n'est établie par aucune source lisible. Tout ce qui est écrit
    « pendant la fenêtre » est calé sur « cette nuit ». Repères pg_cron : rotations entre 02:20 et
    03:10 UTC ; cadence continue jobid 14 (:00/:10/:20/:30/:40/:50) et jobid 1 (:00/:15/:30/:45).
- **Pas d'accès SSH à 49.12.233.2.** `docker ps`, `RestartCount`, `redis-cli INFO` non mesurables
  d'ici ; les mesures PROD passent par HTTP public. Conséquence : **aucune ligne de base n'existe
  pour `RestartCount` ni pour les compteurs Redis**, et le déploiement de 23:46 les a remis à zéro.
- **Contradiction non tranchée** : le régime d'échec pendant la coupure. Une lecture postule un
  échec PostgREST rapide (< 3 s), une autre une saturation du sémaphore à 20 jetons avec 15 s par
  appel. Aucune mesure ne départage — et personne ne doit tenter de les départager ce soir.
- **Contradiction tranchée, parce que mesurable** : « la masse SEO est protégée par l'edge » est
  **faux**. Requête cache-bustée sur une R1 populaire → `cf-cache-status: MISS`, 3,2 s d'origine ;
  deux R2 de longue traîne → MISS et BYPASS, une troisième → HIT. L'edge ne protège qu'une URL
  **déjà chaude sur le PoP qui sert la requête**. La longue traîne R2 frappe l'origine — c'est donc
  elle qui émettra le 200+noindex du §7.4.
- **Zone STOP non lue** : la table source d'éligibilité des paniers abandonnés. La dormance du
  scanner est établie par `n_tup_ins = 0` sur `__abandoned_cart_emails` depuis le `stats_reset` du
  2025-06-06 (467 jours) — le chemin d'envoi n'a jamais été emprunté. **Ce n'est pas la même chose
  que « aucun panier n'est éligible ce soir ».**
- **Dérive constatée au passage, sans rapport avec la fenêtre** :
  `to_regclass('public.__seo_snapshot_runtime_logs')` et `to_regclass('public.__seo_snapshot_cf_analytics')`
  rendent **NULL**. Deux des trois collecteurs du control-plane SEO, qui tirent toutes les 5 min,
  écrivent dans des tables inexistantes (42P01 à chaque passage). Seul `synthetic-crawler` écrit
  réellement. À instruire **à froid** — surtout ne pas créer ces tables avant la fenêtre.
- **Exposition de `get_gamme_page_data_cached`** (fonction STABLE appelant un écrivain VOLATILE →
  25006 en transaction lecture seule) : défaut réel, mais `__gamme_page_cache` = **238 lignes,
  0 stale**. L'exposition grandira proportionnellement à la durée d'arrêt de jobid 14
  (`refresh-stale-gamme-cache`, toutes les 10 min) et se refermera au premier passage après reprise.

**Faux départ écarté, pour mémoire** : les deux dispatchs `Apply Supabase migrations` à 23:35:46 et
23:35:48 ne sont **pas** un double-apply. `gh run view 35153252122 --log` ne contient aucune étape
`🚦 Run engine` ; la ligne « 1 migration(s) pending for more than 30 days » qu'on y lit provient du
**self-test** du moteur, pas d'un état réel du ledger. Ne pas la remonter comme une alerte.

---

## 9. Traçabilité

- Rapport source : `audit/balayage-live-2026-09-16.md` (sha256 `dbed5e964a0004d44842b35acf769a1d009970c2d660eaab13e670316719fa51`).
- Sortie brute de l'orchestration (62 survivants, 34 contestés, 28 abandonnés, avec preuve et
  motif de réfutation par constat) :
  `/tmp/claude-1000/-opt-automecanik-app/54e21de2-dac7-4e67-a9ca-6bc916d4eabf/tasks/wyon0psjw.output`.
  **Répertoire de session — volatil.** À copier si le détail doit survivre.
- Journal par agent : `…/subagents/workflows/wf_05b573e6-4d8/journal.jsonl`.
- Errata opérateur : `/opt/automecanik/backups/upgrade-pg-2026-09-17/ERRATA-lire-avant-de-conclure.txt`.
- Mémoire ajoutée : `reference_nested_plpgsql_plans_are_invisible_to_autoexplain_and_pgss`.

**Statut de ce fichier** : rédigé non commité pendant la fenêtre — `ci.yml` n'a aucun filtre de
chemin, et un merge sur `main` cette nuit-là aurait redéployé le container PREPROD contre une base
absente (§5). Versé en PR le 2026-09-17 **après** la fenêtre et ses vérifications, avec le
post-mortem en tête. Le nom de fichier porte le préfixe `massdoc-` requis par le glob d'ownership
`audit/massdoc-*.md` (D13, `@ak125`).
