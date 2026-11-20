# Pages véhicule × gamme sans pièce vendable après la sortie — méthode

Lecture seule, 2026-11-18 de 23:48 à 23:59 UTC.

1. `kx/vendables.ids` : les 8 128 pièces KLAXCAR vendables, définies par la décision 118
   (`pri_dispo` 1/2/3, pas FROZEN, `piece_display`, prix TTC > 0).
2. `05_export_relations.sh` : leurs relations `pieces_relation_type`, en 21 lots de 400 pièces
   par l'index `idx_prt_piece_id`. La requête agrégée unique dépassait le délai de 240 s.
   Fin à 23:52:49 UTC, sans échec. Résultat : 1 549 022 relations sur 7 513 pièces (les autres
   n'ont aucune relation), toutes avec `rtp_pm_id` = 2590, et 431 296 paires (type, gamme) sur
   63 gammes.
3. Le filtre « servi » reprend la définition du mandat CO (`docs/audit/r2-images-20261118/requetes/T03_servi_r2.sql`) :
   `auto_type.type_display = '1'` (28 505 types) et `pieces_gamme.pg_display = '1'` (les 63 gammes le sont).
   Il reste 296 883 paires servies.
4. `06_paires_sans_alternative.sh` : pour chaque paire servie, existe-t-il une autre pièce, hors
   KLAXCAR, qui reste vendable ? Le script le vérifie selon deux définitions : celle de la
   décision 118, et celle de la grille R2 v3 (`pri_dispo` = '1'). Les paires passent en 182 lots
   de 2 000 types au plus, par l'index `idx_prt_pg_id_type_id`. Fin à 23:59:34 UTC, sans échec.

| Résultat | Paires |
|---|---|
| Une autre pièce vendable (déc. 118) et une autre pièce à `pri_dispo` '1' | 292 232 |
| Une autre pièce vendable (déc. 118), mais aucune autre à '1' : la grille v3 n'affiche plus que de l'« Indisponible » | 36 |
| **Aucune autre pièce vendable** | **4 615** |

Les 4 615 paires portent sur 4 144 types et 44 gammes : voir `pages-sans-piece-vendable.csv` et
`pages-par-gamme.csv`. Les 36 sont dans `pages-sans-dispo1-grille-v3-en-plus.csv`.
Aucune URL n'est construite ici : ce sont des identifiants et des libellés.
