# Mandat CO — images des pages R2 : relevé et correction des BMP

Mandat écrit par le pilotage le 18 nov. 2026, base relue à 17:07 UTC. Accord de
Marwane le 18 nov. 2026 à 18:07 (heure de Paris). Branche
`fix/mandat-co-r2-images-bmp-20261118`, base `origin/main`
`47fc7e4c9d75ce038799ce746568eca9d3687862`.

Le relevé A est fait entièrement en lecture. La base massdoc a été lue par
SELECT seulement, en transaction en lecture seule, avec `statement_timeout`
≤ 60 s et des lots de 8 000 pièces. Le stockage a été lu dans `storage.objects`.
Aucune donnée client n'a été lue. En PROD, seules des requêtes GET et HEAD ont
été faites et seuls les codes de statut ont été gardés. Le classement et les
totaux ont été calculés sur un PostgreSQL 17 jetable (`requetes/classification_pg_jetable.sql`).

## Périmètre : le lot vendable servi en R2

| Étape | Définition | Pièces |
|---|---|---|
| Vendable (décisions 20 et 118) | `pri_dispo` ∈ {1,2,3}, `pricing_state` ≠ FROZEN, `pri_vente_ttc_n` > 0, `piece_display` | 417 470 |
| … servi en R2 | une relation `pieces_relation_type` vers un `auto_type` affiché et une `pieces_gamme` affichée | 321 841 |
| … et lisible par v3 | `piece_name` et `piece_fil_name` non vides | **321 831** |
| dont sans aucune image affichable | aucune ligne `pmi_display='1'` | 15 587 |

## Heures des mesures (UTC, 18 nov. 2026)

| Id | Mesure | Heure | Requête |
|---|---|---|---|
| T01 | objets du bucket `rack-images` (721 520) et du bucket `tecdoc-drop-backup-2026-09-11` (448) | 17:20:59 | `requetes/T01_objets_storage.sql` |
| T02 | lot vendable (417 470 pièces) | 17:22:08 | `requetes/T02_lot_vendable.sql` |
| T03 | service R2 par pièce, 53 lots | 17:23:42 → 17:25:52 | `requetes/T03_servi_r2.sql` |
| T04 | images affichables des pièces vendables (644 763 lignes) | 17:24:08 → 17:24:31 | `requetes/T04_images_affichables.sql` |
| T05 | recoupement des chiffres du pilotage | 17:25:31 | `requetes/T05_recoupement_pilotage.sql` |
| T06 | `tecdoc_doc.graphics_registry` des dossiers manquants (778 308 lignes) | 17:26:08 | `requetes/T06_graphics_registry.sql` |
| T07 | échantillon PROD : 24 pages et 492 images | 17:27:04 → 17:36:08 | `prod-echantillon/` |
| T08 | PROD : 32 BMP sans le suffixe `.webp` | 17:36:53 → 17:37:33 | `prod-echantillon/bmp-sans-suffixe-webp.csv` |
| T09 | revérification des définitions live (md5 inchangés) | 17:38:20 | — |
| T10 | extraction de la fixture des 18 couples | 17:39:54 | `test-pg17/T10_extraction_fixture.sql` |

## A1 — classes des images

L'URL servie est celle que construisent les deux fonctions servies :
`<base>/rack-images/<pmi_folder>/<nom>`. `<nom>` vaut `pmi_name` si le nom finit
par `.webp|.jpg|.jpeg|.png|.gif`, sinon `pmi_name || '.webp'`. La colonne
`chemin_servi` du fichier détaillé donne `<pmi_folder>/<nom>`.

Les cinq classes sont exclusives et appliquées dans cet ordre :

1. `dossier_vide` : `pmi_folder` vide.
2. `presente` : l'objet servi existe.
3. `absente_extension` : l'objet servi n'existe pas, mais le fichier sous son
   nom brut existe (ce sont toutes des BMP auxquelles la fonction ajoute `.webp`).
4. `dossier_absent` : le bucket ne contient aucun objet dans ce dossier.
5. `fichier_absent` : le dossier existe, le fichier n'y est pas. Contrôle fait :
   aucun de ces cas ne s'explique par une différence de casse (0).

### Lot vendable servi en R2 (321 831 pièces)

| Classe | Images | dont image de couverture (rang 1) | Présentes après migration |
|---|---:|---:|---:|
| presente | 422 769 | 262 531 | 422 769 |
| fichier_absent | 51 795 | 28 428 | 0 |
| absente_extension | 14 162 | 11 084 | **14 162** |
| dossier_absent | 6 269 | 4 191 | 0 |
| dossier_vide | 277 | 10 | 0 |
| **Total** | **495 272** | 306 244 | 436 931 |

Par extension, hors `presente` : jpg fichier_absent 50 514 ; bmp
absente_extension 14 162 ; jpg dossier_absent 6 269 ; bmp fichier_absent 1 253 ;
sans extension (dossier vide) 277 ; gif fichier_absent 27 ; png fichier_absent 1.

Les 14 162 images de la classe `absente_extension` concernent 12 111 pièces.
Parmi les pièces qui ont des images, 38 513 n'en ont aucune qui s'affiche
aujourd'hui ; après la migration, il en resterait 27 853.

### Tout le lot vendable, servi ou non (pour mémoire)

| Classe | Images | Rang 1 |
|---|---:|---:|
| presente | 551 209 | 339 033 |
| fichier_absent | 67 370 | 35 857 |
| absente_extension | 18 368 | 14 633 |
| dossier_absent | 7 527 | 5 090 |
| dossier_vide | 289 | 11 |

Fichiers :
- `images-r2-classees.csv.gz` : une ligne par image affichable du lot servi
  (495 272 lignes). Colonnes : `piece_id, pmi_pm_id, pmi_folder, pmi_name,
  pmi_sort, rang, chemin_servi, classe, chemin_apres_migration, recuperable`.
- `images-bmp-absentes-extension.csv.gz` : les 14 162 lignes corrigées par la
  migration, avec le chemin avant et après.

## A2 — par marque

`classes-par-marque.csv` donne une ligne par marque du lot servi (57 marques).
Le dossier et le nom viennent de
`.spec/00-canon/repository-registry/brand-folder-registry.yaml`. Les 57 marques
y figurent toutes. Pour chaque marque, le fichier donne : pièces vendables
servies, pièces sans image affichable, images par classe, et images manquantes
qui ont une référence TecDoc. La somme des colonnes redonne les totaux d'A1.

Marques touchées par la classe `absente_extension` (pm_id, dossier, images) :
CORTECO (1190, 140) 5 795 ; CONTITECH (1170, 31) 2 469 ; MISFAT (3160, 4470)
2 131 ; PURFLUX (3820, 38) 1 516 ; COOPERS FIAAM (1180, 437) 1 513 ; RECORD
(3910, 273) 244 ; KYB (2700, 85) 93 ; NGK (3370, 15) 4.

Dossiers absents du bucket : KLAXCAR (2590, dossier 387) 5 638 images ;
VENEPORTE (4900, 357) 316 ; LPR (2820, 197) 180 ; QUICK STEER (7190, 4368) 135.

Fichiers absents, principales marques : BOSCH (730) 15 653 ; TRW (4670) 4 974 ;
NISSENS (3400) 4 228 ; FEBI (1780) 3 889 ; FERODO (1810) 3 144 ; DELPHI (1270)
2 891 ; CORTECO (1190) 2 523 ; WALKER (4980) 2 469.

## A3 — les fichiers manquants sont-ils récupérables ?

| Source | Réponse | Preuve |
|---|---|---|
| bucket `tecdoc-drop-backup-2026-09-11` | **non** | T01 : 448 objets, uniquement des `criteres/` et `source_linkages/` en `.csv.gz`, aucune image |
| runbook `docs/audit/recovered-tecdoc-2026-09-07/runbook-reimport-tecdoc-images.md` | **inconnu** pour 36 938 images du lot servi (36 307 fichier_absent + 631 dossier_absent) | T06 : `graphics_registry` contient une référence (`source_dlnr` = dossier, `bildname` = nom sans extension). Le paquet média TecDoc dont dépend le runbook n'est pas sur le serveur DEV ; on ne peut donc pas prouver que le fichier y est |
| runbook | **non** pour 21 126 images (15 488 fichier_absent + 5 638 dossier_absent) | aucune référence dans `graphics_registry` ; tout le dossier 387 KLAXCAR est dans ce cas |

La colonne `recuperable` du fichier détaillé porte cette réponse image par image.

## A4 — code qui ajoute `.webp` ou reconstruit une URL rack-images

### Fonctions SQL

| Fonction | Ajoute `.webp` | Servie ? | Appelant |
|---|---|---|---|
| `get_pieces_for_type_gamme_v3` | oui (2 endroits) | **oui** | `backend/src/modules/catalog/services/unified-page-data.service.ts` (cache Redis `unified:page:{type}:{pg}`, 24 h) |
| `get_listing_products_extended_filtered` | oui (1 endroit) | **oui** | `rm_get_page_complete_v2` ← `rm-builder.service.ts` `getPageCompleteV2` ← `GET /api/rm/page-v2` ← frontend `pieces-vehicle.loader.server.ts` (`fetchRmPageV2`, `mapRmV2ToLoaderData`) ; cache `rm:page-v2:…`, 1 h (15 min si vide), génération `cache:gen:catalog` |
| `get_pieces_for_type_gamme`, `_v2`, `_v4`, `get_listing_products_extended` | oui | non | listées, non modifiées |
| `get_piece_detail`, `get_merchant_center_feed_v1` | non | — | — |

La CTE `first_images` de `get_listing_products_extended_filtered` filtrait déjà
sur `\.(jpg|jpeg|png|gif|webp|bmp)$` ; seul le `CASE` qui construit le nom
oubliait `bmp`.

### Backend et frontend

Aucun code servi n'ajoute `.webp` à un nom de fichier rack-images. Ces endroits
reconstruisent une URL à partir du nom brut, sans rien y ajouter :

- `backend/src/modules/catalog/utils/image-urls.utils.ts` `buildRackImageUrl`
  (proxy `/img`), appelé par `search-simple.service.ts` et `cart-data.service.ts`.
- `frontend/app/utils/rm-mapper.ts:65` : `rack-images/${pmi_folder}/${pmi_name}`.
- `frontend/app/services/pieces/pieces-route.service.ts:43` et
  `frontend/app/utils/seo/pieces-schema.utils.ts:26` (`normalizeImageUrl`, `/img/rack-images/…`).
- `frontend/app/utils/image-optimizer.ts` `getOptimizedRackImageUrl` (appelé
  par `PieceDetailModal.tsx`) et `getResponsiveRackImageSet`.

Chaîne servie : URL de v3 → le frontend garde le chemin après `/public/`
(`PiecesGrid`, `extractStoragePath`) → imgproxy
`/imgproxy/rs:fit:N/plain/<supabase>/storage/v1/object/public/rack-images/<chemin>@webp`.
Le `@webp` final est le format de sortie d'imgproxy, pas une extension de
fichier. Aucun changement backend ou frontend n'est donc nécessaire.

### B1 (`https://https://`) — constat, non corrigé

La constante `v_cdn_base` de v3 vaut
`'https://https://www.automecanik.com/img/v1/object/public'`. Le défaut ne
s'observe pas dans ce qui est servi : 0 occurrence de `https://https://` dans le
HTML des 18 pages R2 de l'échantillon T07. Le frontend ne garde que le chemin
après `/public/` avant de l'envoyer à imgproxy, et l'image du JSON-LD porte
l'hôte Supabase. Corriger B1 ne changerait donc rien à l'affichage observé.
Je ne peux pas affirmer que ce soit sans risque : tous les consommateurs de la
réponse v3 n'ont pas été passés en revue, et un consommateur qui lirait l'URL
complète la verrait changer. Ce point reste à décider ; il est hors de ce mandat.

## A5 — codes HTTP en PROD avant correction

Échantillon T07, GET et HEAD seulement : 6 gammes (402, 82, 7, 307, 854, 8),
chacune avec 1 page R1 et 3 pages R2.

- Pages : 24/24 en 200 (`prod-echantillon/pages.csv`).
- Images (492 chemins distincts) : 411 en 200 et 81 en 404, dont 49 jpg et
  32 `.BMP.webp` (`prod-echantillon/images.csv`). Les mêmes chiffres que le
  pilotage.
- Rapprochement avec les classes : 408 `presente`, 30 `absente_extension`,
  19 `dossier_absent`, 32 `fichier_absent`, et 3 chemins hors du lot classé
  (ils répondent 200).
- T08 : les 32 BMP demandées sans le `.webp` ajouté répondent 200 pour 30 d'entre
  elles. Les 2 autres sont des `fichier_absent` (stockage 400, imgproxy 404).

## B — migration

Fichiers : `backend/supabase/migrations/20261118_r2_images_bmp_extension.sql`
et `20261118_r2_images_bmp_extension.down.sql`.

- La migration recrée les deux fonctions servies à partir de leur définition
  live (`pg_get_functiondef`, md5 v3 `cc5a39a896e5d4ca8ac222e78e0afbc3`,
  filtered `87fe3a4b1d433f0bc466025e44afd8b1`, revérifiés à T09).
- Seul changement : `(webp|jpg|jpeg|png|gif)` devient
  `(webp|jpg|jpeg|png|gif|bmp)` dans les 3 `CASE`.
- Le down remet les définitions live à l'identique.
- `CREATE OR REPLACE` garde le propriétaire, les droits, `SECURITY DEFINER`,
  la volatilité, `PARALLEL` et `search_path`. Le test le vérifie.

### Preuve sur PostgreSQL 17 jetable (17.11)

Schéma construit à partir des colonnes live. Fixture des 18 couples (gamme,
véhicule) extraite en lecture à T10. `process_seo_template` est remplacée par une
fonction identité de même signature ; elle ne touche pas aux images. Les rôles
`anon`, `authenticated` et `service_role` ont été créés avec les droits live.

- UP à 17:40:59 : `exit=0` (`test-pg17/up.txt`). Droits, `SECURITY DEFINER`,
  volatilité, `PARALLEL` et configuration inchangés.
- DOWN à 17:41:00 : `exit=0` (`test-pg17/down.txt`). md5 revenus à
  `cc5a39a8…` et `87fe3a4b…`.
- Comparaison avant/après sur 36 sorties (18 couples × 2 fonctions ; la clé
  `duration` de v3 est retirée) : `test-pg17/comparaison-avant-apres.txt`.
  - Pour chaque sortie, la sortie après est égale à la sortie avant où
    `.bmp.webp` est remplacé par `.bmp`. Rien d'autre ne change.
  - La sortie après le down est égale à la sortie avant.
  - Occurrences de `.bmp.webp` avant : 246 (v3) et 32 (filtered). Après : 0.
  - Les couples sans BMP donnent une sortie identique.

### Garde « block-new » : patch d'ownership réservé à l'owner

`node scripts/registry/check-new-files.js --base origin/main` refuse les deux
fichiers de migration (`MISSING_BOTH`) : aucun glob de
`.spec/00-canon/repository-registry/ownership.yaml` ne les couvre. Ce fichier est
réservé à l'owner. Le patch est préparé dans `ownership-patch-mandat-co.diff`
(domaine D1, `@ak125/catalog-team`, comme
`20261003_drop_indexes_shadowed_by_unique_catalog*.sql`). Il n'est pas appliqué
dans la PR. Pour vérifier qu'il suffit, il a été posé une seule commande dans le
worktree jetable, puis retiré : la garde passe alors (25/25). Une fois le patch
appliqué, il faudra relancer `npm run registry` pour mettre à jour
`audit/registry/canonical.json`.

Projections régénérées par leurs générateurs (`npm run audit:inventory`,
`npm run registry`) : `audit/db-usage-map.json`, `audit/registry/rpc.json`,
`audit/registry/canonical.json`, `audit/runtime-entrypoints.json`,
`.claude/knowledge/REPO_MAP.md`. Leur diff ne porte que sur les deux nouvelles
migrations. `audit/registry/files.json` est inchangé. Une première régénération
y ajoutait `@tiptap/react` aux imports de `RichTextEditor.tsx`. La cause était
locale : le worktree n'avait pas de `frontend/node_modules`. Avec des liens vers
les `node_modules` du checkout principal, sans installation, la dérive disparaît.

### Gain attendu

- Lot servi : 14 162 images redeviennent affichables, dont 11 084 images de
  couverture, sur 12 111 pièces.
- Pièces qui ont des images mais aucune affichable : de 38 513 à 27 853.
- Échantillon PROD : de 411 à 441 images en 200 sur 492.
- Délai : les pages déjà en cache gardent l'ancienne URL jusqu'à expiration
  (24 h pour v3, 1 h pour la liste RM, ou au changement de génération
  `cache:gen:catalog`).

## Recoupement avec le pilotage (T05, table complète)

Tous les chiffres du pilotage sont retrouvés :

| Constat du pilotage | Mesure | Écart |
|---|---|---|
| BMP dossier 38 / PURFLUX (3820) | 2 519 | aucun |
| BMP dossier 4470 / pm 3160 | 5 507 | le pilotage écrit PHMI ; `pieces_marque` et le registre des dossiers disent **MISFAT** |
| BMP dossier 437 / pm 1180 | 2 058 | aucun |
| BMP dossier 85 / KYB (2700) | 234 | aucun |
| lignes BMP en tout | 106 400 | aucun |
| dossier 387 (KLAXCAR, 2590) | 7 751 lignes, 0 objet | aucun |
| dossier 30 | 208 773 lignes pour 44 164 objets | aucun |
| lignes affichables à dossier vide | 3 842 891 | aucun |
| dossiers distincts dans le bucket | 61 | aucun |
| échantillon R2 : 81 images en 404 (49 jpg, 32 BMP) | identique | aucun |

Les chiffres du pilotage portent sur toute la table `pieces_media_img`. Ceux
d'A1 portent sur le seul lot vendable servi ; c'est pourquoi ils sont plus petits.

## Ce qui est corrigé, testé, proposé ou à décider

- **Corrigé dans la PR (non appliqué)** : migration bmp et son down.
- **Testé** : up et down sur PostgreSQL 17 jetable ; comparaison avant/après sur
  18 couples ; BMP rendues par imgproxy PROD (30/30 fichiers présents).
- **Seulement proposé ou listé** : les 4 fonctions SQL non servies qui ont le même
  `CASE` ; B1.
- **À décider par Marwane** :
  - appliquer le patch `ownership-patch-mandat-co.diff` (sinon la garde block-new reste rouge) ;
  - appliquer la migration avec le workflow « Apply Supabase migrations
    (manual) », d'abord en simulation `only_ids` ;
  - récupérer les 36 938 images « inconnu » avec le paquet média TecDoc, qui
    n'est pas sur le DEV ;
  - le dossier 387 KLAXCAR (5 638 images servies, aucune référence TecDoc) ;
  - corriger B1 ou non ;
  - les 277 lignes à dossier vide du lot servi.
