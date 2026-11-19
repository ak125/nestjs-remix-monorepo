# Mandat DP — `sitemap-vehicules.xml` en 302 → /404 et aucune R8 dans un sitemap servi

Département 07 (Pages et SEO). Mandat du 19 novembre 2026. Diagnostic en
lecture seule : rien n'est appliqué, aucun fichier servi n'est touché.

## 0. Identification

| Élément | Valeur |
|---|---|
| Session Claude Code | `641cd2cd-d333-48d5-aeaf-614b5a2a3805` |
| Worktree | `/home/deploy/worktrees/claude-dp-sitemap-vehicules-20261119` (isolé, créé depuis `origin/main`) |
| Branche | `docs/mandat-dp-sitemap-vehicules-20261119` |
| SHA de base | `1c4bbf4b25fe8cba38ce3564fd211997afa1859f` (`main`) |
| Révision PROD comparée | `7b603c1a741e` : aucune différence avec la base sur `config/caddy/Caddyfile`, `backend/src/modules/seo/` et la migration de la vue |
| Fichiers de la PR | `RAPPORT.md`, `donnees/r8_echantillon_get.tsv` (ce dossier) |
| `node_modules` du worktree | absent ; aucune installation lancée |

Sources utilisées, et elles seules :

- le code du worktree à la base ;
- `git log` et `gh` en lecture ;
- la base massdoc en `SELECT`, par `sweep-psql.sh` : transaction en lecture seule
  (`transaction_read_only = on`, lu à 13:29:30Z), délai d'instruction de 15 à 30 s ;
- 29 GET publics sur la PROD, au plus un par seconde ;
- le système de fichiers du DEV, en lecture.

Rien n'a été lu sur la machine PROD. Aucun secret n'a été lu ni affiché.

Toutes les heures sont en UTC, le 2026-11-19 sauf mention contraire.

---

## 1. Ce qu'il faut retenir

| # | Fait | Cause | Classement |
|---|---|---|---|
| 1 | `/sitemap-vehicules.xml` répond 302 → `/404` | Le fichier n'existe pas dans le dossier servi. Caddy rend 404 et `handle_errors` le transforme en `redir /404 302`. Le fichier est retiré par la génération quotidienne depuis #1966 : sa source ne contient plus que les 35 URL marque, toutes déjà publiées dans `sitemap-brands.xml`. Il ne reste aucune URL, donc le fichier est supprimé. | **prouvée** pour la chaîne et la cause du retrait (code, données, GET). L'absence sur le disque PROD est déduite et non lue : la lecture est réservée à Marwane (§7). |
| 2 | Absent de l'index `/sitemap.xml` servi | L'orchestrateur n'ajoute le fichier à l'index que s'il a été écrit. Le nombre de fichiers par génération passe de 11 à 10 entre le run du 14/11 03:07Z et celui du 15/11 03:08Z, le premier après le déploiement PROD de #1966 (tag du 14/11, release réussie à 09:46Z). | **prouvée** (code, journal `__seo_event_log`, GET de l'index) |
| 3 | Aucune page R8 (`/constructeurs/{marque}/{modèle}/{type}.html`) dans un sitemap servi | Aucun générateur XML ne produit d'URL R8. La vue `__sitemap_vehicules` ne contient plus le niveau 3 depuis au plus tard le 26/01/2026. Le niveau 2 a été retiré le 14/06/2026 (#973). Les R8 n'existent que dans les hubs HTML de crawl. #1966 n'a fait que supprimer le fichier devenu vide de R8. | **prouvée** pour l'état actuel. La date exacte de la perte du niveau 3 est **non établie** : la vue a été modifiée hors du dépôt. |

En une phrase : le 302 est le comportement prévu par #1966 dans le « cas vide
sain », annoncé dans sa PR (« `/sitemap-vehicules.xml` : 404 seulement dans ce
cas vide sain »). Le vrai défaut est plus ancien : la source du sitemap véhicules
ne porte plus aucune R8, alors que les R8 sont servies en 200 `index, follow`.

---

## 2. Constaté — 6.1 Chaîne de service

### 2.1 GET publics PROD (constaté)

UA `Mozilla/5.0 (compatible; diag-readonly)` sauf n° 29. Commande type :
`curl -s -A "$UA" -D hdr.txt -o body.txt --max-time 30 "https://www.automecanik.com$p"`.

| n° | Heure | Chemin | Résultat |
|---|---|---|---|
| 1 | 13:30:36Z | `/sitemap-vehicules.xml` | **302**, `location: /404`, `cache-control: no-store`, `content-type: application/xml`, longueur 0, `cf-cache-status: DYNAMIC` |
| 2 | 13:30:37Z | `/sitemap.xml` | 200, `last-modified: Thu, 19 Nov 2026 03:07:42 GMT`. 10 enfants : racine, categories, blog, pages, diagnostic, reference, brands, pieces-1, pieces-2, pieces-3. **Pas de vehicules.** |
| 3 | 13:30:38Z | `/sitemap-brands.xml` | 200, `last-modified: 03:07:27 GMT`, 36 `<loc>` |
| 4 | 13:30:40Z | `/health` | 200 |
| 5 | 13:30:41Z | `/sitemap-dp-absent-20261119.xml` (nom inventé, inexistant) | **302**, `location: /404`, en-têtes identiques au n° 1 |
| 6 | 13:30:42Z | `/__crawl__/constructeurs/index.html` | 200, `x-robots-tag: index, follow`, 37 liens vers `{marque}/index.html` |
| 7 | 13:30:58Z | `/__crawl__/constructeurs/renault/index.html` | 200 ; liens : `part-001.html`, `../index.html` ; 0 lien R8 |
| 8 | 13:31:05Z | `/__crawl__/constructeurs/renault/part-001.html` | 200 ; 4 liens, dont la page marque `renault-140.html` ; **0 lien R8** |
| 9–28 | 13:31:26Z–13:31:54Z | 20 pages R8 tirées par `SELECT` (§5.2) | 20/20 en 200, `meta robots` « index, follow », canonique vers soi |
| 29 | 13:33:41Z | `/sitemap.xml`, UA curl par défaut, options du script d'audit (`--fail --connect-timeout 15 --max-time 120`) | 200, 1 345 octets, `rc=0` |

Écart de numérotation, signalé tel quel : la boucle des 20 GET R8 a lu un
fichier d'échantillon qui commençait par deux lignes `SET`, issues de la sortie
psql. Les numéros de boucle 9 et 10 ont donc visé l'URL invalide
`https://www.automecanik.comSET`. curl n'a pas pu résoudre ce nom d'hôte et
aucune requête n'est partie vers la PROD. Les numéros de boucle 11 à 30
correspondent aux GET réels 9 à 28 de ce tableau. Le fichier
`donnees/r8_echantillon_get.tsv` garde ces deux lignes vides. **Total réel :
29 requêtes vers la PROD (≤ 30).**

### 2.2 Code (constaté, à la base, identique à la révision PROD)

- `config/caddy/Caddyfile:194-199` : `@sitemaps path /sitemap*.xml /sitemaps/*`
  → `root * /var/www/sitemaps` + `file_server`. Les en-têtes `Content-Type`
  `application/xml` et `Cache-Control` sont posés avant `file_server`, ce qui
  explique le `content-type: application/xml` sur le 302.
- `config/caddy/Caddyfile:401-414` : `handle_errors` pose
  `Cache-Control "no-store"`, puis `@404 … == 404` → `redir @404 /404 302`.
- Les n° 1 et 5 ont des en-têtes identiques. Un fichier existant (n° 2 et 3)
  répond 200 avec `last-modified`. Le 302 du n° 1 est donc celui d'un fichier
  absent servi par `file_server`. Ce n'est ni une règle propre à ce chemin ni un
  effet de Cloudflare (`DYNAMIC`, aucune mise en cache).

### 2.3 Classement

**Prouvée** : le 302 → /404 vient de l'absence du fichier dans
`/var/www/sitemaps`.

Il manque, pour une preuve directe, la liste du dossier sur la machine PROD.
C'est un acte réservé à Marwane (§7).

---

## 3. Constaté — 6.2 Génération

### 3.1 Déclencheur

`.github/workflows/sitemap-daily-regen.yml` (cron `0 3 * * *`) appelle
`POST /api/sitemap/v10/generate-all`, en PROD seulement. C'est le seul
producteur, d'après l'en-tête de
`backend/src/modules/seo/services/sitemap-v10-scheduler.service.ts:1-36`
(décision owner du 12/11).

Runs du workflow (`gh run list --workflow sitemap-daily-regen.yml`, 13:34Z) :
succès chaque jour du 12/11 au 19/11, le dernier créé le 19/11 à 03:07:22Z.

### 3.2 Chemin dans le code

1. `sitemap-v10.service.ts:122-123` : `collectBrandUrls()` puis
   `generateBrandsSitemap(brandUrls)`.
2. `sitemap-v10.service.ts:132` : `generateVehiculesSitemap(...)` reçoit les URL
   marque publiées, à exclure.
3. `sitemap-v10-static.service.ts:172-296` (`generateVehiculesSitemap`) :
   - lit `__sitemap_vehicules` (l.191, l.210) ;
   - retire les URL déjà publiées par `sitemap-brands.xml` ;
   - l.262-267 : si la liste est vide sans brands publié, `return null` sans rien
     écrire ;
   - **l.283-292 : si la liste est vide, que la lecture est saine et que brands
     est publié, `fs.unlink(filePath)`, journal « ⚠️ sitemap-vehicules.xml
     retiré : aucune URL restante, marques publiées dans sitemap-brands.xml »,
     puis `return null`.**
4. `sitemap-v10.service.ts:151` : `if (vehicules) allFilePaths.push(vehicules)`.
5. `sitemap-v10.service.ts:251` : `generateSitemapIndexFromPaths(allFilePaths)`.

Résultat : le fichier est supprimé du disque et absent de l'index.

### 3.3 Données (constaté)

`SELECT` à 13:29:30Z :

```sql
select niveau, count(*) from public.__sitemap_vehicules group by niveau;
-- niveau 1 | 35   (aucun niveau 2 ni 3)
select pg_get_viewdef('public.__sitemap_vehicules'::regclass);
-- SELECT 1 AS niveau, concat('/constructeurs/', map_marque_alias, '-', map_marque_id, '.html') AS url,
--        0.8 AS priority, 'monthly'::text AS changefreq FROM __sitemap_marque;
select count(*) from public.__sitemap_marque;  -- 35
```

`SELECT` à 13:29:41Z. Il reproduit la logique de `collectBrandUrls` :
`__seo_r7_pages` PUBLISH ou REVIEW_REQUIRED, plus le repli `auto_marque`.

```sql
with brand as (
  select regexp_replace(canonical_url,'^https?://[^/]+','') u from __seo_r7_pages
   where seo_decision in ('PUBLISH','REVIEW_REQUIRED')
  union
  select '/constructeurs/'||marque_alias||'-'||marque_id||'.html' from auto_marque
   where marque_display=1 and marque_relfollow=1)
select (select count(*) from brand) brand_urls,
       (select count(*) from __sitemap_vehicules v where v.url not in (select u from brand)) vehicules_left_after_dedup;
-- brand_urls 36 | vehicules_left_after_dedup 0
```

Les 35 URL de la vue sont toutes parmi les 36 URL marque. **Il reste 0 URL**, ce
qui déclenche le retrait de l.283-292.

### 3.4 Journal de génération (constaté)

`SELECT` à 13:34:51Z sur `__seo_event_log` (`event_type::text ilike
'%sitemap%'`, depuis le 12/11) :

| Run | `totalFiles` | `totalUrls` |
|---|---|---|
| 12/11 03:07:54Z | 11 | 102 395 |
| 13/11 03:07:46Z | 11 | 102 395 |
| 14/11 03:07:29Z | 11 | 101 097 |
| **15/11 03:08:08Z** | **10** | 101 097 |
| 16/11 → 19/11 03:08Z | 10 | 101 097 |

- `totalFiles` vaut `allFilePaths.length` (`sitemap-v10.service.ts:255`).
- Le passage de 11 à 10 se produit au premier run après le déploiement PROD de
  #1966 (§4).
- `totalUrls` est inchangé entre le 14 et le 15 : le fichier retiré ne portait
  pas d'URL propre.
- La baisse de 102 395 à 101 097 a lieu le 14/11 à 03:07Z, donc avant le tag
  PROD de #1966. Elle relève d'une autre cause, non instruite ici.

### 3.5 Classement

**Prouvée** : la génération retire le fichier et l'omet de l'index, par
conception de #1966, parce que sa source ne contient que des marques.

Le journal applicatif PROD qui contiendrait la ligne « retiré » n'a pas été lu
(acte réservé, §7).

---

## 4. Constaté — 6.3 Historique

| Date (UTC) | Événement | Source |
|---|---|---|
| ≤ 2026-01-26 | La vue ne porte plus le niveau 3 (R8). Le commit `8d2f807026` (26/01, « filter HTML hubs vehicles to N1+N2 only ») aligne les hubs sur « 1 008 vehicle URLs matching XML sitemaps ». La définition de la vue à cette date n'est pas dans le dépôt. | `git log` ; message de commit |
| 2026-06-14 | #973 (`7b9fef65af`), ADR-084 : 410 sur les URL modèle à 2 segments. Migration `20260614_sitemap_vehicules_drop_model_level.sql` : la vue passe au seul niveau 1. Son commentaire dit : « Le niveau-3 (véhicule, R8) vient d'un autre canal (`__sitemap_p_link`) — intact. » Le `.down.sql` ne restaure que les niveaux 1 et 2. | migration, `git log` |
| 2026-11-14 08:06:03Z | Fusion de #1966 (`1cbf01a4d8`) : dédoublonnage marques, retrait du fichier vide. La PR annonce explicitement le 404 dans ce cas. | `gh pr view 1966` |
| 2026-11-14 09:46:16Z | Run « 🚀 Release PROD (tag v*) » réussi sur le tag `v2026.11.14-sitemap-v10-1cbf01a` (premier tag `v*` qui contient `1cbf01a4d8`) | `git tag --contains`, `gh run list --branch …` |
| 2026-11-15 03:08:08Z | Premier run à 10 fichiers : sitemap-vehicules retiré | `__seo_event_log` |
| 2026-11-19 03:07:42Z | `last-modified` de l'index servi (GET n° 2) | GET PROD |

**Search Console** : non lue.

- Aucune table de la base ne stocke l'état des sitemaps soumis. `SELECT` à
  13:36:43Z sur `information_schema.tables` : seulement `__seo_gsc_daily*`
  (performance) et `__seo_gsc_links_weekly`.
- Le seul code qui touche l'API Sitemaps
  (`crawl-budget-integrations.service.ts:57`) est un `POST` (écriture). Il est
  exclu.
- Le rapport Sitemaps de la Search Console n'est donc pas lisible sans appel à
  l'API Google. La lecture dans l'interface est réservée à Marwane (§7).

**Classement** :

- **prouvée** pour la chronologie de #1966 (fusion, tag, premier run à 10
  fichiers) ;
- **non établie** pour la date de perte du niveau 3 : la vue a été modifiée
  hors du dépôt avant le 26/01/2026. Il manque l'historique de la vue en base
  (`pg_stat` ne date pas un `CREATE OR REPLACE VIEW`) ou une archive Search
  Console.

---

## 5. Constaté — 6.5 Contenu possible du fichier

### 5.1 Volume R8 (constaté, `SELECT`)

| Mesure | Valeur | Heure |
|---|---|---|
| Types distincts de `__sitemap_p_link` avec `map_has_item > 5` (seuil des hubs) | 12 283 | 13:30:19Z |
| … dont le `type_id` existe dans `auto_type` avec le même modèle | **8 844** | 13:37:30Z |
| … dont le `type_id` existe dans `auto_type` (modèle non contrôlé) | 8 930 | 13:37:30Z |
| Lignes de `__sitemap_motorisation` (= types distincts) | 12 756 | 13:29:41Z |
| … dont le `type_id` est absent de `auto_type` | 3 767 | 13:30:19Z |
| R8 que le générateur de `main` mettrait dans `sitemap-vehicules.xml` | **0** (la vue ne porte que le niveau 1) | §3.3 |

Le hub HTML (`sitemap-v10-hubs-vehicle.service.ts:186-245`) applique les mêmes
critères : `map_has_item > 5`, retrait des `orphan_type` et `stale_model`, URL
`/constructeurs/{marque}-{id}/{modèle}-{id}/{type}-{id}.html`. Le chiffre de
8 844 est l'ordre de grandeur de ce que ce générateur listerait. Il n'a pas été
recompté par son code.

### 5.2 Échantillon de 20 R8 (constaté)

Tirage à 13:31:18Z : `SELECT` déterministe sur `__sitemap_p_link` ⋈ `auto_type`
(type et modèle cohérents, `map_has_item > 5`, alias déjà normalisés), ordre
`md5(type_id||'dp20261119')`, 20 lignes.

GET à 13:31:26Z–13:31:54Z :

- **20/20 en 200** ;
- 0 redirection ;
- pas d'en-tête `x-robots-tag` ;
- `meta robots` « index, follow » ;
- canonique égale à l'URL demandée.

Détail : `donnees/r8_echantillon_get.tsv`.

Ces pages sont indexables et servies, mais aucun sitemap ne les déclare.

### 5.3 Recouvrement avec `sitemap-brands.xml` (constaté)

- Les 35 URL de la vue sont toutes dans les 36 `<loc>` de `sitemap-brands.xml`
  (§3.3, GET n° 3), soit un recouvrement de **100 %**.
- Une R8 (3 segments) ne peut pas recouvrir une URL marque : un fichier R8 n'aurait
  aucun doublon avec brands.

---

## 6. Constaté — 6.4 Effets liés

| Effet | Constat | Classement |
|---|---|---|
| **Cron `seo-audit` en échec depuis le 16/11** (« sitemap indisponible ») | `scripts/seo-audit-weekly.sh:68-73` abandonne seulement si le téléchargement de `$SITEMAP_URL` (l'index, défaut l.31) échoue. Les sous-sitemaps en erreur sont seulement comptés (l.84-100). L'index répond 200 depuis ce DEV avec les options du script (GET n° 29, 13:33:41Z). Les dossiers `/tmp/seo-audit-20261019`, `…1026`, `…1102`, `…1109` et `…1116` sont **tous vides** : l'audit échoue depuis au moins le 19/10, avant #1966. #2047 (`ce3ab80aa6`, 13/11) a rendu l'échec visible au lieu de silencieux. `SITEMAP_URL` est défini dans `backend/.env` (présence vérifiée, valeur non lue). Le worker hérite de l'environnement du processus (`seo-audit-scheduler.service.ts:109-115`). | **non lié.** La cause probable est la valeur de `SITEMAP_URL` ou l'accès réseau du processus backend DEV. Elle est **non établie** : il manque la lecture de la valeur et du message curl du job (owner). |
| **`__seo_index_history` vide** | `SELECT` à 13:34:07Z : 0 ligne. Le collecteur (`gsc-index-history-collector.service.ts`) est inerte par défaut : il sort à l.126-132 si `SEO_INDEX_HISTORY_ENABLED !== 'true'`, avant `logStarted`. La variable est absente de `backend/.env` (DEV). Le `SELECT` à 13:34:15Z sur `__seo_event_log` (`payload->>'source' = 'indexation'`) donne **0 run démarré**, dans tous les environnements puisque la base est partagée. Aucun run n'a donc atteint la lecture des sitemaps. | **non lié** pour la table vide (**prouvée** : le collecteur n'a jamais tourné). **Lié, latent** pour la strate `r8_vehicle` (`:66`, `/sitemap-vehicules.xml`, plafond 300). Une fois activé, `fetchSitemapLocs` (`:264-267`) suit le 302 vers `/404`, puis lève `HTTP …` ou ne trouve aucun `<loc>`. Le `catch` de `:156-167` ajoute `sitemap_fetch_failed:r8_vehicle:…` et les autres strates continuent. La strate R8 resterait vide. |
| **Test `sitemap-v10-indexability`** | Il passe sur `main` (CI, job 135582223724, 13:11:39Z, 450 suites). Il ne détecte pas l'absence parce qu'il l'encode comme correcte : l.310-331 (marques seules ⇒ `null`) et l.710-815 (régression DS : le seul fichier servi avec des URL constructeur est `sitemap-brands.xml`). Les cas qui attendent un fichier vehicules (l.480-491) utilisent la fixture niveau 2 `/constructeurs/renault-140/clio-iii-140004.html`, retirée des données réelles depuis le 14/06. Aucun test ne vérifie la présence de R8 dans un sitemap. | **lié** : le test valide le comportement observé ; il ne protège pas contre la perte des R8. |

Autre consommateur relevé, non affecté : `synthetic-crawler.service.ts:240-262`
lit les enfants de l'index servi, donc pas `/sitemap-vehicules.xml` en dur. Son
commentaire l.250 (« cas réel : `sitemap-brands` et `sitemap-vehicules` ») est
périmé.

---

## 7. Actes réservés à Marwane (non faits)

Commandes exactes, à lancer sur la machine PROD par la console Hetzner. Elles
sont en lecture seule. Le chemin du dossier côté hôte est à confirmer, selon le
montage du conteneur Caddy.

```sh
# 1. Présence du fichier dans le dossier servi
docker exec $(docker ps -qf name=caddy) ls -la /var/www/sitemaps/
docker exec $(docker ps -qf name=caddy) ls -la /var/www/sitemaps/sitemap-vehicules.xml

# 2. Ligne de retrait dans les journaux du backend (run du 15/11 et suivants)
docker logs --since 2026-11-14T09:00:00Z $(docker ps -qf name=backend) 2>&1 \
  | grep -E "sitemap-vehicules.xml (retiré|: lecture|: écriture)"
```

Lectures également réservées :

- Search Console, rapport Sitemaps, dans l'interface : état et date de dernière
  lecture de `sitemap-vehicules.xml`, sans resoumission.
- Valeur de `SITEMAP_URL` dans l'environnement du backend DEV et message d'erreur
  curl du dernier job `seo-audit`. Cela concerne l'effet non lié du §6, à confier
  hors de ce mandat.

---

## 8. Proposé — 6.6 Options de correction (non écrites, non appliquées)

Les deux options restaurent un sitemap R8. **Le choix revient à Marwane.**
Aucune ne modifie d'URL, de robots ou de page.

### Option A — Nourrir `sitemap-vehicules.xml` avec les R8 de la source des hubs

- **Quoi** : `generateVehiculesSitemap` lit, en plus des marques à dédoublonner,
  les R8 issues de `__sitemap_p_link` avec les filtres déjà validés par le hub :
  `map_has_item > 5`, retrait de `orphan_type` et `stale_model`, même fabrique
  d'URL. Le nom `/sitemap-vehicules.xml`, déjà déclaré par le collecteur GSC, est
  conservé.
- **Fichiers** :
  - `backend/src/modules/seo/services/sitemap-v10-static.service.ts:172-296` ;
  - réutiliser la sélection de `sitemap-v10-hubs-vehicle.service.ts:186-245`.
    Extraire la fonction commune plutôt que la copier : il y a deux consommateurs,
    ce n'est pas une abstraction nouvelle.
  - Variante base : nouvelle migration additive qui étend `__sitemap_vehicules`
    avec un niveau 3. Elle est réversible, mais la vue est commentée
    « ADR-084 », ce qui demande l'accord du décideur.
  - Commentaires périmés à corriger dans la même PR :
    - `sitemap-v10.service.ts:16` ;
    - `backend/scripts/generate-sitemaps.ts:53,97,163` ;
    - `packages/seo-url-contract/src/robots-policy.ts:294` (et l'instantané
      robots associé).
- **Tests** :
  - remplacer la fixture niveau 2 de `sitemap-v10-indexability.test.ts:480-491`
    par une R8 ;
  - ajouter un cas « vue marques + R8 ⇒ fichier écrit, R8 seules, aucune URL
    marque » ;
  - garder les cas DS l.710-815.
- **Volume** : environ 8 800 URL (§5.1), un seul fichier sous la limite de
  50 000.
- **Risques** :
  1. **R8 noindex soumises** : 20/20 sont `index, follow` dans l'échantillon,
     mais la règle robots R8 n'a pas été lue ici. Il faut un filtre aligné sur
     cette règle, ou un contrôle de la sortie.
  2. **Décision 48** : elle porte sur l'indexation selon le caractère vendable,
     et le rapport CQ (#2182) la traite pour R1 et R2. Son extension à R8 n'est
     écrite nulle part (recherche dans `.spec/00-canon` et le journal des
     principes : aucune occurrence R8 ↔ sitemap). C'est à trancher avant de
     soumettre 8 800 URL.
  3. **#2191** (CT, définition vendable et sitemap R2) : ne touche ni le même
     générateur ni le même fichier. Pas de conflit d'écriture attendu, mais si la
     décision 48 s'étend à R8, le filtre devra lire la définition de #2191.
  4. `__sitemap_p_link` est une table figée, sans écrivain (rapport CQ §3.1). Un
     type ajouté à la base ne serait pas listé.
- **Dépendance à la fin de la mise à jour des tarifs** : aucune tant que le
  filtre reste `map_has_item > 5`. Si la décision 48 s'étend à R8, le filtre
  dépendra du vendable, donc des tarifs.

### Option B — Sitemap R8 dédié et retrait contractuel de `/sitemap-vehicules.xml`

- **Quoi** :
  - nouveau fichier, par exemple `sitemap-vehicules-r8.xml`, ajouté à l'index,
    même source qu'en A ;
  - `/sitemap-vehicules.xml` est déclaré retiré : il ne portait plus que des
    marques ;
  - les consommateurs sont repointés.
- **Fichiers** :
  - `sitemap-v10.service.ts:116-151` (une étape de plus) ;
  - nouveau générateur dans `sitemap-v10-static.service.ts` ;
  - `gsc-index-history-collector.service.ts:66` (chemin de la strate
    `r8_vehicle`) ;
  - commentaires listés en A ;
  - `Caddyfile:194` inchangé (`/sitemap*.xml` couvre déjà le nouveau nom).
- **Tests** : nouveau test de générateur ; test de contrat « chaque chemin de
  `STRATE_SITEMAPS` figure dans la liste des fichiers produits ».
- **Volume et risques** :
  - mêmes points 1 à 4 qu'en A ;
  - en plus, un nouveau nom de fichier à faire découvrir à la Search Console,
    sans écriture par agent, et un ancien chemin qui reste en 302 → /404.
- **Dépendance aux tarifs** : identique à A.

### Contrôles proposés quelle que soit l'option

- Invariant d'index : liste attendue des fichiers, avec une alerte dans
  `__seo_event_log` si un fichier attendu disparaît. Aujourd'hui, le passage de
  11 à 10 fichiers est resté un succès silencieux.
- Après génération : GET de chaque chemin déclaré par un consommateur
  (`STRATE_SITEMAPS`).

**Recommandation** : A. Elle garde le nom déjà attendu par le collecteur et la
Search Console, et ne crée aucun fichier de plus. Elle reste subordonnée à la
décision sur la décision 48 appliquée à R8.

---

## 9. Constats hors périmètre (signalés, non corrigés)

1. **Hubs HTML de crawl sans R8 en PROD.**
   - `sitemap-v10-hubs-vehicle.service.ts` écrit `constructeurs/index.html`
     deux fois : l.416 (`generateVehiclesHub`, liste R8) et l.696-697
     (`generateVehiclesByBrandHubs`).
   - La version servie est celle par marque (GET n° 6 : 37 liens marque).
     `renault/part-001.html` ne contient aucune R8 (GET n° 8).
   - Les fichiers `part-*.html` de `generateVehiclesHub` n'ont pas été lus (budget
     GET). Aucun hub ni sitemap atteignable ne les montre.
2. **3 767 `type_id` de `__sitemap_motorisation` absents de `auto_type`**
   (§5.1), table qui n'est plus lue par la vue.
3. **Audit `seo-audit` vide depuis au moins le 19/10** (§6) : cause propre,
   distincte de #1966.
4. **Commentaires périmés** qui décrivent un `sitemap-vehicules.xml` à
   « ~13,8 k URL, marques + modèles + types » :
   - `sitemap-v10.service.ts:16` ;
   - `generate-sitemaps.ts:53,97,163` ;
   - `robots-policy.ts:294` ;
   - `synthetic-crawler.service.ts:250`.
5. **Code mort** :
   - `generateAllByFamily` (`sitemap-v10.service.ts:545`) n'a aucun appelant ;
   - il appelle `generateVehiculesByBrand` (`sitemap-v10-static.service.ts:303`),
     qui relit aussi la vue.
6. **Écart d'annonce** : #1966 annonçait un « 404 » dans le cas vide ; la PROD
   sert un 302 → `/404` (`handle_errors`). Le statut final de `/404` n'a pas été
   mesuré.
7. **Baisse de 1 298 URL** (102 395 → 101 097) au run du 14/11 03:07Z, avant le
   tag de #1966 : non instruite.

---

## 10. Rapport en 5 états (AEC)

- **Scan** :
  - code sitemap V10 (orchestrateur, générateurs statiques, hubs véhicule) ;
  - Caddyfile ;
  - migration de la vue ;
  - script et planificateur `seo-audit` ;
  - collecteur d'historique d'index et son processeur ;
  - workflow `sitemap-daily-regen` ;
  - tests `sitemap-v10-indexability` ;
  - PR #1966, #2182 et #2205 (lecture).
- **Analyse** : §1 à §6.
- **Correction** :
  - proposée : §8 (2 options) ;
  - **appliquée : aucune**.
- **Validation** : 29 GET PROD, 10 appels psql en lecture seule (dont 1 en erreur de syntaxe, sans effet), CI `main` lue ;
  aucune exécution de test locale (aucune modification de code).
- **Verdict** : `PARTIAL_COVERAGE`.

```
scope_requested: faits 1-3 et points 6.1 à 6.6 du mandat DP
scope_actually_scanned: fichiers cités aux §2-§9 (environ 15 fichiers lus en partie), base en SELECT, 29 GET PROD
excluded_paths: sitemap R2 et définition vendable (CT, #2191), robots.txt, images, noindex, machine PROD
unscanned_zones: disque et journaux PROD ; Search Console ; part-*.html de generateVehiclesHub ; règle robots R8 ; valeur de SITEMAP_URL
corrections_proposed: options A et B (§8), contrôles d'index
corrections_applied: aucune
validation_executed: GET publics (29), appels psql SELECT (10, dont 1 en erreur), lecture CI
remaining_unknowns: présence réelle sur le disque PROD ; date de perte du niveau 3 ; cause du seo-audit ; extension de la décision 48 à R8
final_status: PARTIAL_COVERAGE
```
