# KLAXCAR (pm_id 2590) : sortie de vente de toutes ses pièces

Mandat DB, suite du mandat CO (#2187). Ce dossier prépare la sortie ; rien n'est appliqué.

Le 19/11/2026, Marwane a décidé, à 00:37 (heure de Paris) : « kalxca deja on peut supprimer
klaxcar de r2 plus vendu ». À 00:39, à la question d'une migration qui passe ses pièces
« non disponibles », il a répondu « supprime ».

**Complément n° 1** : à 07:27, à la question de faire disparaître entièrement les pièces
KLAXCAR des pages R2 plutôt que de les y laisser « Indisponible », Marwane a répondu « oui ».
La même migration masque donc aussi les 8 128 pièces affichées (`piece_display = false`), par
le levier gouverné `catalog_display_quarantine`, avec un retour exact.

Règles applicables :

- Décision 20 : seul le lot vendable est servi, et la base reste le référentiel complet.
- Décision 51 : un lot qui dépasse 5 % des pièces vendables d'un fournisseur attend Marwane.
- Décision 118 : une pièce est vendable si `pri_dispo` vaut 1, 2 ou 3, si elle n'est pas
  FROZEN et si elle n'est pas masquée. La même règle vaut pour les pages et le panier.

Le mandat exclut toute suppression de ligne et tout archivage.

Toutes les lectures ont été faites sur la base unique DEV/PREPROD/PROD, par `sweep-psql.sh`
(`transaction_read_only = on`), le 2026-11-18 entre 23:42 et 23:59 UTC, puis pour le
complément le 2026-11-19 entre 06:32 et 06:48 UTC. Les requêtes sont dans `requetes/`.

## 1. Décomptes exacts

| Mesure | Valeur |
|---|---|
| `pieces_marque` 2590 | KLAXCAR, `pm_display` '2', `pm_sitemap` 0, `pm_relfollow` 0, `pm_top` 0 |
| Pièces `piece_pm_id = 2590` | 9 610, dont 8 128 affichées (`piece_display`) |
| Lignes `pieces_price` | **8 487**, une par pièce, toutes `pri_frs` CAL, `pri_type` '0', `pricing_state` ACTIVE, motif, auteur et source NULL |
| `pri_dispo` '1' | 8 189 lignes : 8 128 vendables, 61 de pièces masquées |
| `pri_dispo` '3' | 283 lignes, toutes de pièces masquées |
| `pri_dispo` '0' | 15 lignes, déjà hors vente |
| **Vendables aujourd'hui (décision 118)** | **8 128 lignes = 8 128 pièces**, toutes `pri_dispo` '1', toutes CAL |
| `pieces_price_history` KLAXCAR | 0 ligne |
| Trigger sur `pieces_price` | aucun |

Garde de la décision 51 : CAL compte 40 176 lignes vendables. Les 8 128 de KLAXCAR en font
**20,2 %**, au-delà de 5 %. La migration ne s'applique donc que sur le oui explicite de
Marwane, donné après lecture de ce décompte.

Autres marques, comptées seulement (hors périmètre) :

| Marque | pm_id | pm_display | Lignes de prix | Lignes vendables | Fournisseur |
|---|---|---|---|---|---|
| LPR | 2820 | '2' | 246 | 246 | ACR |
| VENEPORTE | 4900 | '1' | 1 411 | 332 | (vide) |
| QUICK STEER | 7190 | '1' | 725 | 137 | ACR |

## 2. Colonne qui porte la marque d'une pièce

`pieces.piece_pm_id` (smallint), avec une clé étrangère vers `pieces_marque.pm_id`.

Côté tarif, `pieces_price.pri_pm_id` (texte) vaut '2590' sur exactement les mêmes 8 487 lignes.
Aucune ligne n'est sans pièce, aucune n'est d'une autre marque, et `pri_piece_id` est égal à
`pri_piece_id_i` sur toutes.

La grille R2 lit la marque comme `COALESCE(rtp_pm_id, piece_pm_id)`. Les 1 549 022 relations
des pièces vendables KLAXCAR ont toutes `rtp_pm_id` égal à 2590.

## 3. Lieux servis où une pièce KLAXCAR apparaît, et ce qui l'y filtre

Colonne de droite : effet de la migration complétée (prix à `pri_dispo` '0' + FROZEN, puis
`piece_display = false` sur les 8 128 pièces affichées).

| Surface | Lecteur | Filtre | Après la migration |
|---|---|---|---|
| Page R2 servie (véhicule × gamme) : grille, compte, filtres | `pieces-vehicle.loader.server.ts` → `fetchRmPageV2` → `rm-builder.service.ts` → `rm_get_page_complete_v2` → `get_listing_products_extended_filtered` | `piece_display = true` sur la pièce ; prix 1/2/3 en LEFT JOIN | **Retirée** : la pièce n'est plus dans `products`, `count`, les filtres de marque ni le prix minimum. Prouvé sur PostgreSQL 17 (§8). |
| Grille v3 (données unifiées, accessoires) | `get_pieces_for_type_gamme_v3` (`unified-page-data.service.ts:268`) | `piece_display`, nom non vide ; prix `pri_dispo = '1'` en LEFT JOIN | Retirée. Sans le masquage, elle y restait « Indisponible ». |
| Grille v4 | `get_pieces_for_type_gamme_v4` | `piece_display`, `pri_dispo = '1'` | Retirée. |
| Recherche `/api/search` | `search-simple.service.ts:388, 491, 896` ; indexation `supabase-indexation.service.ts` | `.eq('piece_display', true)` | Écartée. |
| Panier, prix | `cart-data.service.ts`, `piece-price-data.service.ts` via `estVendable` (`vendable.ts`) | décision 118 | Refusée. |
| Fiche pièce | `get_piece_detail` → `catalog.service` | `piece_display` | « Pièce non trouvée » (`success: false`). Le cache Redis de la fiche (3 600 s) peut la montrer jusqu'à 1 h. |
| Références | `reference.service.ts` | `piece_display` | Écartée. |
| Flux marchand | `get_merchant_center_feed_v1` | `pri_dispo` 1/3, `COALESCE(pm_display,'1') = '1'`, `piece_display` | Déjà exclue par `pm_display` '2'. |
| Pages et listes de marques de pièces | `equipementiers.service.ts:83`, `homepage-rpc.service.ts:271`, `products-catalog.service.ts:158` | `pm_display = '1'` | Déjà exclue. Les routes `brands.*` sont des marques de véhicule. |
| Aperçu de prix gamme, builder R | `get_gamme_price_preview`, `get_listing_products_for_build_v2` | `piece_display`, `pri_dispo` | Retirée. |
| Gammes voisines (« cross-selling ») | `rm_get_page_complete_v2` (`cross_selling`), `cross-selling-source.service.ts` | relations hors pollution, **sans** `piece_display` | Non filtré : une gamme voisine peut rester proposée alors que ses seules pièces sont KLAXCAR masquées ; le lien mène à une page « alternatives ». Écart signalé, non corrigé. |
| Sitemap | `sitemap-v10-pieces.service.ts` lit `__sitemap_p_link.map_has_item` | colonne statique : aucun écrivain dans le code, la base ni un cron | **Inchangé** : les pages devenues vides restent listées alors qu'elles servent `noindex` (§5). Zone STOP SEO indexé : signalé, rien n'est fait. |

Points liés :

- Aucun pg_cron ne masque ni ne réaffiche de pièces. `refresh_gamme_aggregates` et
  `refresh_stale_gamme_cache` ne lisent pas `pri_dispo`. `catalog_display_quarantine` n'est
  appelée que par une migration ou à la main.
- Une page R2 dont le compte tombe à 0 sert la page « alternatives » en 200 avec `noindex`,
  sans condition de drapeau (§5). `r2-indexability.ts` et son drapeau
  `SEO_R2_SELLABLE_NOINDEX_ENABLED` (absent en DEV, valeur PROD inconnue) ne concernent que
  les pages qui gardent des produits.
- Délai de prise d'effet : le cache Redis de la page R2 (`rm-builder.service.ts`) dure 1 h
  (15 min pour une page vide) et sa génération `catalog` n'est incrémentée que par
  l'activation pricing, pas par une migration SQL. Une page déjà en cache peut montrer
  KLAXCAR jusqu'à environ 1 h ; le cache des alternatives dure 1 jour.

## 4. Commandes portant une pièce KLAXCAR

Le décompte porte sur `orl_pm_id = '2590'` ou `orl_pm_name ilike 'klaxcar'`.

| Fenêtre | Commandes | Payées | Lignes |
|---|---|---|---|
| 12 derniers mois (depuis le 2025-11-19) | **0** | 0 | 0 |
| Historique complet | 95 | — | — |

La dernière commande KLAXCAR date du 2022-05-17. `ord_date` ne contient aucune date hors
format ISO. Aucune donnée client n'a été lue.

## 5. Pages véhicule × gamme qui n'auraient plus de pièce vendable

Il y a **4 615 pages servies** (type × gamme), sur 4 144 types et 44 gammes, dont la seule pièce
vendable est KLAXCAR. La liste est dans `pages-sans-piece-vendable.csv`, le décompte par gamme
dans `pages-par-gamme.csv`, et la méthode dans `requetes/07_pages_servies.md`.

Les cinq gammes les plus touchées :

| Gamme | Pages |
|---|---|
| Ampoule feu éclaireur de plaque (112) | 2 661 |
| Filtre à carburant (9) | 423 |
| Ampoule éclairage intérieur (117) | 396 |
| Ampoule feu stop (111) | 319 |
| Electrovanne (3890) | 106 |

36 autres pages gardent une pièce vendable au sens de la décision 118, mais aucune à
`pri_dispo` '1'. Leur grille v3 n'afficherait plus que des pièces « Indisponible » :
voir `pages-sans-dispo1-grille-v3-en-plus.csv`.

### 5.1 Pages qui n'ont plus aucune pièce affichée (complément n° 1)

Avec le masquage, une page R2 ne compte plus que les pièces affichées des autres marques
(`get_listing_products_extended_filtered` : `piece_display = true`, critère 100, hors
`_filter.rtp_pollution_ids`). Recalcul en lecture seule sur les 4 615 pages ci-dessus
(`requetes/08_pages_sans_piece_affichee.sh`, 2026-11-19 à 06:47 UTC) ; seules ces pages
peuvent tomber à 0, les autres gardent une pièce vendable d'une autre marque.

- **1 034 pages tombent à 0 produit** (999 types, 39 gammes) : `pages-sans-piece-affichee.csv`.
- **3 581 pages** gardent au moins une pièce affichée d'une autre marque, toutes
  « Indisponible » (aucune n'est vendable).
- Décompte par gamme, avec les deux colonnes : `pages-sans-piece-affichee-par-gamme.csv`.
- La paire 22443 × 1361 du banc (§8.2) est bien dans les 1 034, cohérent avec la sortie
  servie mesurée (0 produit).

| Gamme | Sans vendable | À 0 produit | Seulement « Indisponible » |
|---|---|---|---|
| Filtre à carburant (9) | 423 | 411 | 12 |
| Electrovanne (3890) | 106 | 106 | 0 |
| Ampoule éclairage intérieur (117) | 396 | 99 | 297 |
| Serrure de porte (1361) | 93 | 93 | 0 |
| Capteur pression et température d'huile (4175) | 56 | 56 | 0 |
| Ampoule feu éclaireur de plaque (112) | 2 661 | 43 | 2 618 |
| Débitmètre d'air (3927) | 42 | 42 | 0 |

### 5.2 Ce que sert une page à 0 produit, selon le code

`frontend/app/utils/pieces-vehicle.loader.server.ts` :

- condition `rmV2Response.count === 0` (l. 351) ; si le paramètre `r` est présent, 301 vers
  l'URL sans ce paramètre (l. 357) ;
- sinon **HTTP 200**, page « alternatives » (`NoProductsAlternatives` : gammes voisines,
  véhicules voisins, modèles liés), **`X-Robots-Tag: noindex, follow`** (l. 493) et meta
  robots `noindex, follow` (`buildSoft404Meta`, `pieces-vehicle.meta.ts:95`) ; `Cache-Control` 300 s navigateur / 3 600 s CDN si
  des alternatives existent, 30 s sinon, `no-store` si leur lecture échoue ;
- appel non bloquant de `/api/rm/alternatives/track-soft-404` (l. 446), qui journalise la
  page vide ;
- titre, description et JSON-LD `ItemList` sont ceux de `buildSoft404Meta`, construits à
  partir de la gamme et du véhicule, et non les meta de la page produits. Ces dernières ne
  sont pas modifiées en base : elles reviennent dès que la page a de nouveau un produit.

Ce que la migration ne change pas :

- aucune page supprimée, aucune URL changée, aucune meta ni H1 réécrite ;
- **le sitemap continue de lister ces 1 034 pages** (`map_has_item`, colonne statique non
  recalculée ici) alors qu'elles servent `noindex` : écart SEO signalé, hors mandat
  (zone STOP), à décider par Marwane ;
- les 3 581 autres pages restent en 200, indexables selon les règles actuelles
  (`r2-indexability.ts`, drapeau `SEO_R2_SELLABLE_NOINDEX_ENABLED` de valeur PROD inconnue),
  avec une grille de pièces « Indisponible ».

## 6. Ce que signifie `pm_display` '2' dans le code

Aucun code servi ne donne de sens propre à la valeur '2'. Seul '1' est testé :

- '1' : équipementiers, accueil, catalogue produits, flux marchand, recherche enrichie ;
- `.spec/guides/database-schema.md:234` et `.spec/features/equipementiers-module.md` ne
  documentent que '0' (masqué) et '1' (visible).

Le seul sens explicite de '2' est le palier « Secondaires » de l'écran d'administration des
fournisseurs. Cet écran nomme '1' « Principaux », '2' « Secondaires » et '5' « Tertiaires »
(`frontend/app/routes/admin.suppliers.tsx:153`). Le compteur de fournisseurs actifs les
regroupe (`dashboard.service.ts:345`).

La grille R2, la recherche simple et le panier ne lisent pas `pm_display`. C'est pourquoi
KLAXCAR, en '2', y était vendue.

Répartition en base : '0' 729, '1' 115, '2' 84, '5' 53, NULL 11.

## 7. Mécanisme retenu pour la migration

Fichier : `backend/supabase/migrations/20261119_pricing_klaxcar_sortie_vente.sql`, avec son `.down.sql`.

### 7.1 Prix

Sur les 8 487 lignes, la migration pose **`pri_dispo` '0' et `pricing_state` 'FROZEN'**.
Les 15 lignes déjà à '0' passent seulement FROZEN.

Pourquoi ces deux leviers :

- `pri_dispo` '0' est lu par les lecteurs de prix du §3 (panier, aperçu, flux).
- FROZEN est le verrou import-safe de la quarantaine
  (`.claude/knowledge/ops/supplier-brand-price-load-procedure.md`). Sans lui, un import CAL
  avec `activate` (`pricing_commit_chunk` force '1') ou un lot `pricing_activate_chunk`
  remettrait KLAXCAR en vente. Ces deux fonctions ignorent les lignes FROZEN.
- C'est aussi l'état de toutes les lignes FROZEN depuis #2096
  (`20261116_pricing_frozen_masked_dispo_zero.sql`), dont la migration suit la structure.

Traçabilité : `pricing_state_reason` commence par `SORTIE_VENTE_MARQUE:2590:dispo_origine=<d> | …`,
`pricing_updated_by` vaut `owner-decision-2026-11-19-klaxcar`, `pricing_updated_source` vaut
le chemin du fichier. Le `.down.sql` relit `dispo_origine`, remet `pricing_state` à ACTIVE et
vide motif, auteur et source ; il ne touche que les lignes qui portent encore la sortie de ce
fichier.

### 7.2 Affichage (complément n° 1)

Levier : **`catalog_display_quarantine(lot, '2590', 'owner-decision-2026-11-19-klaxcar', false)`**
(migration `20260607_pricing_catalog_display_quarantine.sql`, étape 8 « R2-bruit » de la
procédure de chargement). C'est le levier déjà en vigueur, plus juste qu'un `UPDATE` direct :

- `piece_display = true` est le filtre commun de tous les lecteurs servis du §3 ; c'est lui,
  pas `pri_dispo`, qui retire la pièce de la page R2 (le prix y est en LEFT JOIN).
- La fonction ne masque que les pièces affichées de la marque qui n'ont plus de prix
  vendable. Appelée **après** le passage des prix à '0', elle retient exactement les 8 128
  pièces affichées.
- Elle écrit d'abord une ligne par pièce dans `pieces_display_history` (`old_display` true,
  `new_display` false, `operator`, lot fixe `cb9bd8ac-1e4e-4e94-9c6e-a660608795a3`), puis
  masque. Aucun DELETE.
- Les 1 482 pièces KLAXCAR déjà masquées (359 avec prix, 1 123 sans) ne sont ni touchées ni
  journalisées. Le retour ne les réaffiche donc pas.

Retour : le `.down.sql` appelle **`catalog_display_rollback_batch(lot, '2590')`**, qui remet
`old_display` lu au journal sur les 8 128 pièces du lot. Le journal est conservé.

Effet de bord relevé : `pieces` porte le trigger `pieces_search_vector_update`. Les 8 128
pièces affichées ont toutes `search_vector` NULL aujourd'hui. Le masquage le remplit (à partir
du nom, de la description, de la référence et du libellé, inchangés) et le retour le laisse
rempli. C'est la seule différence avec l'état relevé après la down. Seules des fonctions plein
texte sans appelant applicatif lisent cette colonne (`search_pieces_fts`,
`search_pieces_hybrid`, `count_references_fts`).

Options écartées :

- `UPDATE pieces SET piece_display = false` direct : aucun journal par pièce, pas de retour
  gouverné.
- `pricing_deactivate_chunk` : il ne pose pas FROZEN, et son rollback ne restaure pas
  l'auteur ni la source d'origine.
- `pm_display` : la colonne n'est pas lue par la grille, la recherche ni le panier, et
  `pieces_marque` est hors périmètre.

### 7.3 Pré- et post-conditions (arrêt sur tout écart)

| Code | Moment | Condition |
|---|---|---|
| P1 | avant | la marque 2590 s'appelle KLAXCAR |
| P2 | avant | 8 487 lignes pour 8 487 pièces |
| P3 | avant | clé relevée (`pri_pm_id` 2590, `pri_type` '0', `pri_piece_id` = `pri_piece_id_i`) |
| P4 | avant | chaque ligne à l'état relevé ou déjà sortie par ce fichier |
| P5 | avant | dispos d'origine 1/3/0 = 8 189 / 283 / 15 |
| P6 | avant | 8 128 lignes vendables, 0 au rejeu |
| P7 | avant | aucune ligne hors KLAXCAR ne porte la source du fichier |
| P8 | avant | 9 610 pièces KLAXCAR |
| P9 | avant | affichage : soit l'état relevé (8 128 affichées, 1 482 masquées, lot vide), soit l'état traité (0 / 9 610, lot de 8 128 lignes conformes, aucune réaffichée) ; un lot dont le retour a été joué exige un nouveau relevé et un nouvel identifiant |
| P10 | avant | aucune ligne du lot d'une autre marque |
| Q1, Q2 | après | prix : 0 ou 8 487 lignes écrites ; 8 487 à '0'/FROZEN, 0 vendable |
| Q3 | après | masquées = éligibles, et 0 ou 8 128 |
| Q4 | après | KLAXCAR 9 610 / 0 affichée / 9 610 masquées |
| Q5 | après | lot : 8 128 lignes, 8 128 pièces, toutes conformes |
| Q6 | après | 1 482 pièces KLAXCAR hors du lot |
| D1 | down | lot de 8 128 lignes conformes |
| D2 | down | 8 128 pièces réaffichées |
| D3 | down | arrêt si le lot n'est ni tout masqué ni tout réaffiché (le retour des prix est annulé avec) |
| D4 | down | KLAXCAR 9 610 / 8 128 / 1 482, l'état relevé |

**Lignes touchées : 8 487 lignes de prix et 8 128 pièces (plus 8 128 lignes de journal).**

## 8. Preuve sur PostgreSQL 17 jetable

### 8.1 Prix (premier passage, 2026-11-19 vers 00:01 UTC)

Dossier `test-pg17/`. Le conteneur `mandat-db-pg17` (PostgreSQL 17.11, sans réseau) a été
supprimé après usage.

Jeu de lignes réelles exportées en lecture seule à 00:00:11 UTC :

- les 8 487 lignes `pieces_price` KLAXCAR et leurs 9 610 pièces ;
- 300 lignes témoin CAL hors KLAXCAR ;
- la clé primaire, la clé étrangère et la contrainte CHECK `pricing_state` de PROD.

Résultats (`preuve-pg17.txt`) :

- **Migration** : 8 487 lignes écrites. KLAXCAR passe à 8 487 lignes `0`/FROZEN, avec
  0 vendable.
- **Rejeu** : 0 ligne écrite, état identique au premier passage.
- **Colonnes modifiées** : exactement les 5 prévues. Les prix et les 300 témoins sont
  identiques.
- **Down** : 8 487 lignes remises. L'état `pieces_price` complet est **identique octet pour
  octet** à l'état d'avant (sha256 `eb9b86c9…` avant comme après).
- **Témoins négatifs** : une ligne passée à '2' entre-temps, ou une ligne portant déjà un
  motif, font échouer la migration par ABORT, et l'état reste intact.

Ce test a aussi trouvé un défaut, corrigé avant le commit : un `CASE … THEN` placé dans la
condition d'un `IF` PL/pgSQL. C'est le motif même du témoin négatif de la CI.

Migration Safety, en local (`migration-safety-local.txt`) :

- squawk 2.52.1 : 0 problème ;
- `--lint-markers` : OK ;
- compilation PL/pgSQL des 3 blocs DO, migration et down : OK, et le témoin négatif est bien
  refusé ;
- garde DEFINER/anon : 19/19, surface inchangée.

### 8.2 Affichage (complément n° 1, 2026-11-19 vers 06:45 UTC)

Dossier `test-pg17/affichage/`. Même conteneur `mandat-db-pg17` (PostgreSQL 17.11), recréé
pour ce passage et supprimé à la fin.

Données exportées en lecture seule (`extract.sh`, 2026-11-19 vers 06:38 UTC) :

- les 9 610 pièces KLAXCAR, leurs 8 487 prix, et le journal `pieces_display_history` complet
  (9 316 lignes) ;
- 20 paires véhicule × gamme (`paires.csv`) tirées des pages touchées, avec toutes leurs
  relations, pièces de toutes marques, prix, images, critères, `_filter.rtp_pollution_ids`,
  véhicule et tables SEO ;
- les définitions exactes, lues en base, de `catalog_display_quarantine`,
  `catalog_display_rollback_batch`, `get_listing_products_extended_filtered`,
  `rm_get_page_complete_v2` et du trigger `pieces_search_vector_update`.

Résultats (`preuve-affichage.txt`, `servi-resume.csv`, `negatifs.txt`) :

- **Migration** (enveloppée BEGIN/COMMIT comme le moteur) : 8 487 lignes de prix, puis
  8 128 pièces masquées ; KLAXCAR 9 610 / 0 affichée / 9 610 masquées ; lot de 8 128 lignes.
- **Rejeu** : 0 ligne de prix, 0 pièce masquée ; état, journal et sortie servie identiques
  octet pour octet au premier passage.
- **Sortie servie sur les 20 paires** : `get_listing_products_extended_filtered` passe de
  292 à 243 lignes, KLAXCAR de 49 à **0** ; les 243 lignes des autres marques sont identiques
  ligne pour ligne. `rm_get_page_complete_v2` : même compte, plus aucun `pm_id` 2590 dans
  `products`. La paire 22443 × 1361, où KLAXCAR était seule, tombe à **0 produit** (page
  « alternatives »).
- **Down** : 8 487 lignes de prix et 8 128 pièces remises ; KLAXCAR 9 610 / 8 128 / 1 482.
  Les 1 482 pièces déjà masquées le restent. État `pieces` et `pieces_price`, sortie
  d'`extended_filtered` et sortie de `rm_get_page_complete_v2` **identiques octet pour octet**
  à l'avant. Les 9 316 lignes antérieures du journal sont inchangées ; les 8 128 du lot sont
  conservées.
- **Rejeu de la down** : 0 ligne, 0 pièce ; état identique.
- **Seul écart avec l'état relevé** : `search_vector` des 8 128 pièces, NULL avant, rempli
  par le trigger (KLAXCAR : 9 549 NULL avant, 1 421 après la down). Voir §7.2.
- **Témoins négatifs**, chacun sur une copie neuve, tous refusés sans aucune écriture :
  N1 une pièce masquée réaffichée entre-temps (P9) ; N2 une pièce KLAXCAR de plus (P8) ;
  N3 réapplication du même lot après la down (P9) ; N4 une pièce du lot réaffichée à la main
  avant la down (D3, le retour des prix est annulé avec) ; N5 une ligne de prix ajoutée (P2).

Migration Safety, en local (`affichage/migration-safety-local.txt`) : squawk 2.52.1 0
problème ; `--lint-markers` OK ; compilation PL/pgSQL des 6 blocs DO (migration et down) OK ;
garde DEFINER/anon 19/19, surface inchangée.

## 9. Ownership

Les deux fichiers de migration relèvent déjà du glob existant
`backend/supabase/migrations/2026*_pricing_*.sql` (D11, `@ak125`, risque high) de
`.spec/00-canon/repository-registry/ownership.yaml`. Voir `ownership-extrait.md`.
`ownership.yaml` n'est pas modifié. Le complément n° 1 n'ajoute aucun fichier hors de ce
glob et de `docs/audit/` : pas de changement d'ownership à proposer.

## 10. Restent à Marwane

1. Relire le décompte (8 487 lignes de prix, 8 128 vendables, 20,2 % de CAL ; 8 128 pièces
   masquées) et dire oui ou non.
2. Fusionner la PR.
3. Lancer « 🗄️ Apply Supabase migrations (manual) » avec `only_ids` égal à cette migration,
   d'abord en dry_run, puis en réel.
4. Décider à part du sort SEO des pages devenues vides (§5) : elles servent la page
   « alternatives » en `noindex` mais restent dans le sitemap (`map_has_item` statique).
   Décider aussi des gammes voisines proposées sans filtre d'affichage. Toute suppression ou
   tout archivage reste à part.
