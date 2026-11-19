# KLAXCAR (pm_id 2590) : sortie de vente de toutes ses pièces

Mandat DB, suite du mandat CO (#2187). Ce dossier prépare la sortie ; rien n'est appliqué.

Le 19/11/2026, Marwane a décidé, à 00:37 (heure de Paris) : « kalxca deja on peut supprimer
klaxcar de r2 plus vendu ». À 00:39, à la question d'une migration qui passe ses pièces
« non disponibles », il a répondu « supprime ».

Règles applicables :

- Décision 20 : seul le lot vendable est servi, et la base reste le référentiel complet.
- Décision 51 : un lot qui dépasse 5 % des pièces vendables d'un fournisseur attend Marwane.
- Décision 118 : une pièce est vendable si `pri_dispo` vaut 1, 2 ou 3, si elle n'est pas
  FROZEN et si elle n'est pas masquée. La même règle vaut pour les pages et le panier.

Le mandat exclut toute suppression de ligne et tout archivage.

Toutes les lectures ont été faites sur la base unique DEV/PREPROD/PROD, par `sweep-psql.sh`
(`transaction_read_only = on`), le 2026-11-18 entre 23:42 et 23:59 UTC. Les requêtes sont
dans `requetes/`.

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

| Surface | Lecteur | Filtre | Après la sortie (`pri_dispo` '0' + FROZEN) |
|---|---|---|---|
| Grille R2 (véhicule × gamme) | `get_pieces_for_type_gamme_v3`, appelée par `unified-page-data.service.ts:268` | pièce : `piece_display`, nom non vide ; prix : `pri_dispo = '1'`, en LEFT JOIN | La pièce **reste dans la grille**, au prix 0 et marquée « Indisponible », sans achat possible. La retirer exigerait `piece_display = false`, une décision distincte. |
| Listing R2 étendu | `get_listing_products_extended_filtered` | `piece_display`, `pri_dispo` 1/2/3 | Retirée. |
| Grille v4 | `get_pieces_for_type_gamme_v4` | `pri_dispo = '1'` | Retirée. |
| Recherche `/api/search` | `search-simple.service.ts` | prix lus avec `pri_dispo = '1'` et `piece_display` | Selon le chemin, la pièce est rendue sans prix (`_hasPrice` false, classée en dernier) ou écartée. |
| Panier, prix | `cart-data.service.ts`, `piece-price-data.service.ts` via `estVendable` (`vendable.ts`) | décision 118 | Refusée. |
| Fiche pièce | `get_piece_detail` | `piece_display` ; `dispo = pri_dispo = '1'` | Affichée comme non disponible. |
| Flux marchand | `get_merchant_center_feed_v1` | `pri_dispo` 1/3, `COALESCE(pm_display,'1') = '1'`, `piece_display` | Déjà exclue aujourd'hui par `pm_display` '2'. |
| Pages et listes de marques de pièces (équipementiers, accueil) | `equipementiers.service.ts:83`, `homepage-rpc.service.ts:271`, `products-catalog.service.ts:158` | `pm_display = '1'` | Déjà exclue aujourd'hui. Les routes `brands.*` sont des marques de véhicule. |
| Aperçu de prix gamme, builder R | `get_gamme_price_preview`, `get_listing_products_for_build_v2` | `pri_dispo` 1, ou 1/2/3 | Retirée. |
| Sitemap | `__sitemap_p_link` (`system.controller.ts`) | hors périmètre | Non touché, non mesuré. |

Points liés :

- Aucun pg_cron ne masque de pièces. `refresh_gamme_aggregates` et `refresh_stale_gamme_cache`
  ne lisent pas `pri_dispo`. `catalog_display_quarantine` est manuel.
- `r2-indexability.ts` met en `noindex,follow` une page R2 sans produit vendable, mais
  seulement si `SEO_R2_SELLABLE_NOINDEX_ENABLED=true`. Le drapeau est absent en DEV ; sa valeur
  en PROD est **inconnue**.

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

Ces pages restent servies. La sortie de vente ne supprime aucune page, ne change aucune URL
et ne touche ni aux meta ni aux H1. Leur sort SEO (noindex, retrait) relève de Marwane.

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

Sur les 8 487 lignes, la migration pose **`pri_dispo` '0' et `pricing_state` 'FROZEN'**.
Les 15 lignes déjà à '0' passent seulement FROZEN.

Pourquoi ces deux leviers :

- `pri_dispo` '0' est lu par tous les lecteurs servis du §3.
- FROZEN est le verrou import-safe de la quarantaine
  (`.claude/knowledge/ops/supplier-brand-price-load-procedure.md`). Sans lui, un import CAL
  avec `activate` (`pricing_commit_chunk` force '1') ou un lot `pricing_activate_chunk`
  remettrait KLAXCAR en vente. Ces deux fonctions ignorent les lignes FROZEN.
- C'est aussi l'état de toutes les lignes FROZEN depuis #2096
  (`20261116_pricing_frozen_masked_dispo_zero.sql`), dont la migration suit la structure.

Options écartées :

- `pricing_deactivate_chunk` : il ne pose pas FROZEN, et son rollback ne restaure pas
  l'auteur ni la source d'origine.
- `catalog_display_quarantine` et `piece_display = false` : ils retirent la pièce de la
  grille et des pages. C'est une décision SEO distincte, hors du mandat.
- `pm_display` : la colonne n'est pas lue par la grille, la recherche ni le panier, et
  `pieces_marque` est hors périmètre.

Traçabilité :

- `pricing_state_reason` commence par `SORTIE_VENTE_MARQUE:2590:dispo_origine=<d> | …`.
- `pricing_updated_by` vaut `owner-decision-2026-11-19-klaxcar`.
- `pricing_updated_source` vaut le chemin du fichier.

Le `.down.sql` relit `dispo_origine`, remet `pricing_state` à ACTIVE et vide motif, auteur et
source, soit exactement l'état relevé. Il ne touche que les lignes qui portent encore la sortie
de ce fichier.

Préconditions bloquantes :

- la marque 2590 s'appelle KLAXCAR ;
- 8 487 lignes pour 8 487 pièces, avec la clé relevée ;
- chaque ligne est soit à l'état relevé, soit déjà sortie par ce fichier ;
- les dispos d'origine 1/3/0 valent 8 189/283/15 ;
- 8 128 lignes vendables avant la migration, 0 au rejeu ;
- aucune ligne hors KLAXCAR ne porte la source de ce fichier.

Les post-conditions sont vérifiées dans la même transaction. Au rejeu, la migration écrit 0
ligne et passe.

**Lignes touchées : 8 487, dont 8 128 vendables.** C'est le décompte du §1.

## 8. Preuve sur PostgreSQL 17 jetable

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

## 9. Ownership

Les deux fichiers de migration relèvent déjà du glob existant
`backend/supabase/migrations/2026*_pricing_*.sql` (D11, `@ak125`, risque high) de
`.spec/00-canon/repository-registry/ownership.yaml`. Voir `ownership-extrait.md`.
`ownership.yaml` n'est pas modifié.

## 10. Restent à Marwane

1. Relire le décompte (8 487 lignes, 8 128 vendables, 20,2 % de CAL) et dire oui ou non.
2. Fusionner la PR.
3. Lancer « 🗄️ Apply Supabase migrations (manual) » avec `only_ids` égal à cette migration,
   d'abord en dry_run, puis en réel.
4. Décider à part des 4 615 pages sans pièce vendable et du retrait de la grille
   (`piece_display`). Toute suppression ou tout archivage reste aussi à part.
