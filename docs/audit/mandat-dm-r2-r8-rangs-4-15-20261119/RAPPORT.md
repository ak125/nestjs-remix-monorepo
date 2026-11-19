# Mandat DM — pages R2 et R8 classées entre les rangs 4 et 15 sur des requêtes longues

Relevé et propositions, **lecture seule**. Rien n'a été changé sur le site, en base, dans le code ou dans le contenu.
Chaque section sépare le **relevé** (ce qui a été mesuré) du **proposé** (ce qui est soumis à Marwane).

| Élément | Valeur |
|---|---|
| Session | Claude Code `296ef69c-8a45-4e9d-917c-f2bc7f9d2c56` (session dédiée), 19 nov. 2026 |
| Worktree | `/home/deploy/worktrees/claude-dm-r2-r8-rangs-4-15-20261119` (neuf, sans `node_modules`, aucune installation lancée) |
| Branche | `docs/mandat-dm-r2-r8-rangs-4-15-20261119` |
| Base | `origin/main` `8d93b7ec5eefe050686743414fd3543436606f7c` (= SHA du point 3 du mandat) |
| Base de données | massdoc, `SELECT` seulement, transaction en lecture seule, `statement_timeout` 60 s ; aucune donnée client |
| PROD | 118 GET simples (plafond 120), 1 par seconde, sans redirection suivie, 12:34:15Z → 12:39:59Z |
| Dernière donnée GSC en base | **2026-11-16** (`__seo_gsc_daily` et `__seo_gsc_daily_page_totals`) ; fraîcheur 3 jours au moment du relevé |
| Fenêtres | 90 j = 2026-08-19 → 2026-11-16 ; 28 j = 2026-10-20 → 2026-11-16 ; plus une fenêtre avr.–nov. (2026-04-01 → 2026-11-16) pour le recoupement du point 3 |

## Contenu du dossier

- `RAPPORT.md` — ce document (le top 50 seulement ; les listes complètes sont dans `data/`).
- `sql/` — toutes les requêtes (rejouables, `SELECT` seulement). Heure UTC de chaque extraction : `data/heure_extraction_NN.txt`.
- `scripts/` — toutes les règles de classement et de comparaison, écrites avant lecture des résultats (`python3 -I scripts/<x>.py <ce dossier>`).
- `data/` — les listes complètes en TSV (voir l'index en fin de rapport).

Non versionnés, et pourquoi : le HTML brut des 114 pages et les XML des sitemaps (volume, et ce sont des copies du site) ;
les extractions brutes `couples_r2_r8_brut.tsv` (34 468 lignes, 4,5 Mo), `grain_page_r2_r8.tsv` (77 502 lignes, 7,1 Mo)
et `sitemap_pieces_servi_paths.txt` (101 097 chemins, 7,5 Mo). Elles se reproduisent avec `sql/01`, `sql/03` et
`scripts/get_prod.sh` ; les listes qui en sont tirées (6.1 à 6.5) sont toutes versionnées. Choix aligné sur AK (#2087),
qui ne versionnait pas non plus les données GSC brutes.

---

## 0. Recoupement des chiffres du point 3 (relevé)

Requête : `sql/02_recoupe_point3.sql` (12:45:20Z), `sql/02b_…` (12:45:33Z), `sql/02c_…`. Source : `__seo_gsc_daily`, 2026-04-01 → 2026-11-16, couples page × requête, sans filtre.

| Chiffre du point 3 | Relevé DM | Écart et explication |
|---|---|---|
| R2 : 450 clics sur 355 couples | 450 clics, 355 couples à clic | aucun |
| R2 : 331 clics en position ≤ 10 | 331 | aucun |
| R2 : 36 861 impressions en position ≤ 10 | 36 726 (position pondérée ≤ 10) | −135. Avec la position arrondie à 1 décimale (`round(pos,1) ≤ 10`) : 36 844, soit 118 des 135 expliquées par la règle d'arrondi ; 17 impressions (0,05 %) non expliquées. |
| R8 : 149 clics sur 97 couples | 125 clics sur 73 couples (`/constructeurs/<m>/<mo>/<t>.html`) | Le point 3 compte tout `/constructeurs/…` : + 23 clics / 23 couples sur les pages marque (1 segment) et + 1 sur une page modèle (2 segments) = 149 / 97. |
| R8 : 97 clics en position ≤ 10 | 97 | aucun |
| « courroie climatiseur clio 4 1.2 16v » 12 clics, 189 impr., pos. 5,8 | 12 / 189 / 5,8 | aucun |
| « poulie vilebrequin 1.5 dci » 5 / 143 / 1,5 | 5 / 143 / 1,5 | aucun |
| « thermostat 207 1.6 hdi » 4 / 83 / 10,1 | 4 / 83 / 10,1 | aucun |
| « courroie alternateur symbol 1.2 16v » 3 / 230 / 7,9 | 3 / 230 / 7,9 | aucun |
| « moteur express 1.6 diesel » 17 / 274 / 7,5 | 17 / 274 / 7,5 | aucun |
| « pièce mercedes classe c 220 cdi » 4 / 204 / 8,4 | 4 / 204 / 8,4 | aucun |
| 401 752 pages « Explorée, actuellement non indexée » | non vérifiable | L'état d'indexation par URL n'est pas en base (`__seo_index_history` : 0 ligne) ; aucune API Google appelée. |

Les chiffres R3 conseil, R1 et « hors rôles » du point 3 relèvent du rapport DG et n'ont pas été recalculés ici.

---

## 6.1 Liste des couples R2 et R8 en rang 4 à 15 sur requêtes longues (relevé)

### Règles (écrites dans `scripts/analyse_rangs.py`, rejouables)

- Couples page × requête de `__seo_gsc_daily` (`sql/01_couples_r2_r8.sql`, 12:30:57Z) ; R2 = `/pieces/<gamme>/<marque>/<modèle>/<type>.html`, R8 = `/constructeurs/<marque>/<modèle>/<type>.html`.
- Exclues : requêtes `^ai[0-9]+$` (identifiants internes) et requêtes de marque (`automecani|auto mecanik|site:`).
- Requête longue = **3 mots ou plus**. Rang = position moyenne **pondérée par les impressions**, 4 ≤ rang ≤ 15.
- **Divergents** (écartés, listés à part) : ordinateur et mobile présents et |pos. ordi − pos. mobile| > 10.
- **Un seul appareil et 0 clic** : « vrai classement » non vérifiable au sens du point 3 → écartés, listés à part.
- Retenus = appareils concordants, ou un seul appareil avec au moins un clic.
- **Clics gagnables** = impressions × max(0, CTR attendu au rang 3 − CTR réel).

### Courbe de taux de clic du site (`sql/00_courbe_ctr.sql`, `data/courbe_ctr.tsv`)

Calculée sur les données du site seulement : lignes jour × page × requête × appareil, pages R2 + R8, requêtes de 3 mots ou plus, 2026-04-01 → 2026-11-16, rang arrondi, puis régression isotonique non croissante pondérée par les impressions (pool-adjacent-violators).

- **CTR de référence au rang 3 = 1,829 %** (grain requête). Les rangs 1 à 4 sont fusionnés par l'isotonie, car le rang 1 brut (1,205 %) est plus bas que les rangs 2 à 4 (2,2–2,6 %). Ce rang 1 bas est cohérent avec le piège du point 3 (positions hautes sans clic dues à un bloc spécial).
- Sensibilité : 1,486 % ordinateur, 1,861 % mobile, 0,985 % toutes pages sur 3 mots ou plus.
- Grain page (`sql/04_courbe_ctr_page.sql`, `__seo_gsc_daily_page_totals`, depuis 2026-06-01) : **3,896 % au rang 3**, utilisé pour les colonnes « grain page ».
- Pour comparaison, DG (#2201, `ctr_site_par_position_90j.csv`) trouve 0,79 % au rang 3 tous rôles et 4,77 % hors conseil. Le périmètre diffère (tous rôles, toutes longueurs) ; ce n'est pas une contradiction.

### Part anonymisée (requêtes non nommées par Google)

Le grain requête ne voit qu'une petite partie du trafic de ces pages. Le grain page (`__seo_gsc_daily_page_totals`) est la référence fidèle.

| Fenêtre | Rôle | Impr. grain requête | Impr. grain page | Part nommée (impr.) | Clics requête | Clics page | Part nommée (clics) |
|---|---|---:|---:|---:|---:|---:|---:|
| 90 j | R2 | 36 065 | 205 172 | 17,6 % | 167 | 3 391 | 4,9 % |
| 90 j | R8 | 9 932 | 52 823 | 18,8 % | 42 | 1 070 | 3,9 % |
| 28 j | R2 | 12 922 | 67 102 | 19,3 % | 53 | 1 015 | 5,2 % |
| 28 j | R8 | 3 202 | 15 891 | 20,1 % | 19 | 310 | 6,1 % |

Donc **environ 95 % des clics et 81 % des impressions de ces pages ne sont pas rattachés à une requête**. La liste 6.1 est un échantillon des requêtes nommées ; les ordres de grandeur réels se lisent au grain page (dernières colonnes ci-dessous).

### Effectifs

| Fenêtre | Rôle | Couples (toutes req.) | 3 mots ou plus | … en rang 4–15 | **Retenus** (pages) | Impr. | Clics | **Clics gagnables** | Divergents | Un appareil, 0 clic |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 90 j | R2 | 8 133 | 6 407 | 1 723 | **398** (311) | 5 614 | 87 | **76,4** | 80 (11,9 gagnables) | 1 245 |
| 90 j | R8 | 1 838 | 1 393 | 617 | **242** (114) | 4 192 | 34 | **59,2** | 8 (1,0) | 367 |
| 28 j | R2 | 3 871 | 3 043 | 906 | **194** (162) | 1 573 | 26 | **25,2** | 23 (1,9) | 689 |
| 28 j | R8 | 800 | 640 | 341 | **118** (65) | 1 203 | 16 | **17,6** | 3 (0,3) | 220 |

Au grain page (`sql/03_grain_page.sql`, 12:32:56Z, `scripts/grain_page.py`) :

| Fenêtre | Rôle | Pages vues | Pages en rang page 4–15 | Impr. 4–15 | Clics 4–15 | **Clics gagnables page** (réf. 3,896 %) | Pages de la liste 6.1 : impr. / clics / gagnables |
|---|---|---:|---:|---:|---:|---:|---|
| 90 j | R2 | 51 181 | 39 005 | 154 818 | 2 692 | **4 799,7** | 27 420 / 501 / 586,9 |
| 90 j | R8 | 3 090 | 2 506 | 46 106 | 974 | **1 071,8** | 24 633 / 436 / 469,5 |
| 28 j | R2 | 21 651 | 15 927 | 48 918 | 787 | **1 618,1** | 6 330 / 91 / 152,1 |
| 28 j | R8 | 1 580 | 1 266 | 13 766 | 281 | **342,8** | 7 298 / 125 / 138,6 |

Ce sont des **plafonds** (tout le monde au rang 3), pas des prévisions.

### Top 50, fenêtre 90 jours, classé par clics gagnables

Liste complète : `data/rangs_4_15_90j.tsv` (640 couples). Divergents : `data/divergents_90j.tsv`. Non vérifiables : `data/un_appareil_90j.tsv`. Fenêtre 28 j : `data/rangs_4_15_28j.tsv`, `data/divergents_28j.tsv`, `data/un_appareil_28j.tsv`. La dernière colonne vient du 6.3.

| # | Rôle | Page | Requête | Impr. | Clics | CTR % | Pos. | Ordi / mobile | Motif | Gagnables | Absents titre et H1 |
|---:|---|---|---|---:|---:|---:|---:|---|---|---:|---|
| 1 | R8 | `/constructeurs/lancia-92/ypsilon-i-92048/1-3-d-multijet-20034.html` | pièces détachées lancia ypsilon | 373 | 0 | 0.00 | 10.28 | 10.74 / 9.88 | pièces + modèle | 6.82 | detachees |
| 2 | R2 | `/pieces/courroie-d-accessoire-10/renault-140/clio-iii-140004/1-5-dci-19052.html` | courroie accessoire clio 3 1.5 dci | 136 | 0 | 0.00 | 5.27 | 8.72 / 4.01 | pièce + modèle + motorisation | 2.49 | 3 |
| 3 | R8 | `/constructeurs/peugeot-128/207-128018/2-0-hdi-57721.html` | 207 2.0 hdi | 116 | 0 | 0.00 | 8.21 | 8.15 / 8.24 | pièce + modèle + motorisation | 2.12 | — |
| 4 | R2 | `/pieces/thermostat-316/peugeot-128/207-128018/1-4-16v-26630.html` | thermostat 207 1.4 essence | 105 | 0 | 0.00 | 8.06 | 9.00 / 8.00 | pièce + modèle + motorisation | 1.92 | — |
| 5 | R8 | `/constructeurs/renault-140/clio-i-140002/1-2-chipie-14908.html` | clio chipie phase 2 | 102 | 0 | 0.00 | 8.26 | 3.71 / 9.18 | autre | 1.87 | — |
| 6 | R2 | `/pieces/courroie-d-accessoire-10/renault-140/symbol-ii-140093/1-2-16v-9292.html` | courroie alternateur symbol 1.2 16v | 96 | 0 | 0.00 | 7.21 | 8.00 / 7.14 | pièce + modèle + motorisation | 1.76 | alternateur |
| 7 | R8 | `/constructeurs/suzuki-158/vitara-ii-cabriolet-158056/2-0-hdi-54957.html` | pièces suzuki vitara 2.0 hdi | 91 | 0 | 0.00 | 10.57 | 10.14 / 10.69 | pièces + modèle | 1.66 | — |
| 8 | R8 | `/constructeurs/mercedes-benz-108/classe-b-w246-108036/b-180-cdi-1-5-59438.html` | pièces détachées mercedes classe b 180 cdi | 142 | 1 | 0.70 | 8.92 | 9.13 / 8.78 | pièces + modèle | 1.60 | detachees |
| 9 | R2 | `/pieces/courroie-d-accessoire-10/renault-140/symbol-i-140092/1-4-16553.html` | schema courroie alternateur symbol 1.4 essence | 82 | 0 | 0.00 | 5.05 | 1.00 / 5.15 | pièce + modèle + motorisation | 1.50 | schema alternateur |
| 10 | R8 | `/constructeurs/citroen-46/c3-i-46020/1-4-hdi-23829.html` | pièce citroën c3 1.4 hdi | 81 | 0 | 0.00 | 10.06 | 9.00 / 10.23 | pièces + modèle | 1.48 | piece |
| 11 | R2 | `/pieces/thermostat-316/peugeot-128/206-128014/1-1-i-9465.html` | thermostat 206 1.1 essence | 79 | 0 | 0.00 | 5.76 | 8.67 / 5.52 | pièce + modèle + motorisation | 1.45 | — |
| 12 | R8 | `/constructeurs/renault-140/symbol-i-140092/1-4-16v-16554.html` | prix moteur 1.4 essence renault symbol | 74 | 0 | 0.00 | 8.62 | 11.00 / 8.56 | pièce + modèle + motorisation | 1.35 | moteur essence |
| 13 | R2 | `/pieces/courroie-d-accessoire-10/peugeot-128/partner-i-128093/1-9-d-7979.html` | référence courroie alternateur partner 1.9 d | 67 | 0 | 0.00 | 7.72 | 8.33 / 7.66 | référence … | 1.23 | reference alternateur |
| 14 | R2 | `/pieces/alternateur-4/peugeot-128/206-128014/1-1-i-9465.html` | alternateur 206 1.1 essence | 63 | 0 | 0.00 | 7.06 | 4.00 / 7.11 | pièce + modèle + motorisation | 1.15 | — |
| 15 | R8 | `/constructeurs/opel-123/astra-g-123017/2-0-opc-16v-13365.html` | astra g opc | 52 | 0 | 0.00 | 9.44 | 9.06 / 9.63 | autre | 0.95 | — |
| 16 | R2 | `/pieces/joint-de-cache-culbuteurs-321/renault-140/duster-140008/1-5-dci-59639.html` | joint cache culbuteur 1.5 dci | 51 | 0 | 0.00 | 8.65 | 8.17 / 8.71 | pièce + modèle + motorisation | 0.93 | culbuteur |
| 17 | R8 | `/constructeurs/mercedes-benz-108/classe-e-w210-108048/e-290-t-td-2-9-5371.html` | mercedes 290 td | 49 | 0 | 0.00 | 9.61 | 9.50 / 9.62 | autre | 0.90 | — |
| 18 | R8 | `/constructeurs/renault-140/clio-i-140002/1-2-chipie-14908.html` | clio chipie phase 1 | 49 | 0 | 0.00 | 7.14 | 2.60 / 8.31 | autre | 0.90 | 1 |
| 19 | R2 | `/pieces/support-moteur-247/renault-140/laguna-i-140026/1-9-dti-8991.html` | support moteur laguna 1.9 dti | 48 | 0 | 0.00 | 5.56 | 6.11 / 5.44 | pièce + modèle + motorisation | 0.88 | — |
| 20 | R8 | `/constructeurs/renault-140/express-140014/1-6-d-2113.html` | moteur renault express 1.6 diesel | 48 | 0 | 0.00 | 8.69 | 9.33 / 8.64 | pièce + modèle + motorisation | 0.88 | moteur diesel |
| 21 | R2 | `/pieces/pompe-a-eau-1260/seat-147/ibiza-ii-147024/1-6-5677.html` | pompe a eau ibiza 1.6 mpi | 47 | 0 | 0.00 | 7.91 | 7.60 / 7.95 | pièce + modèle + motorisation | 0.86 | mpi |
| 22 | R2 | `/pieces/pompe-a-eau-1260/renault-140/clio-ii-140003/1-2-16v-16104.html` | pompe a eau 1.2 16v | 46 | 0 | 0.00 | 8.87 | 8.38 / 8.97 | pièce + modèle + motorisation | 0.84 | — |
| 23 | R2 | `/pieces/courroie-d-accessoire-10/peugeot-128/206-128014/1-4-i-9466.html` | référence courroie accessoire 206 1.4 essence | 45 | 0 | 0.00 | 9.02 | 8.00 / 9.15 | référence … | 0.82 | reference |
| 24 | R2 | `/pieces/joint-de-cache-culbuteurs-321/volkswagen-173/golf-vi-173046/1-6-tdi-31340.html` | joint cache culbuteur golf 6 1.6 tdi | 45 | 0 | 0.00 | 4.16 | 4.40 / 4.13 | pièce + modèle + motorisation | 0.82 | culbuteur 6 |
| 25 | R2 | `/pieces/kit-de-distribution-307/volkswagen-173/touran-i-173141/1-9-tdi-17768.html` | distribution touran 1.9 tdi 105 | 44 | 0 | 0.00 | 10.43 | 12.60 / 10.15 | pièce + modèle + motorisation | 0.80 | — |
| 26 | R2 | `/pieces/thermostat-316/citroen-46/saxo-46070/1-1-x-sx-11172.html` | thermostat saxo 1.1 essence | 44 | 0 | 0.00 | 6.20 | 8.00 / 6.16 | pièce + modèle + motorisation | 0.80 | — |
| 27 | R2 | `/pieces/filtre-a-huile-7/peugeot-128/107-128005/1-0-18586.html` | filtre a huile 107 essence | 42 | 0 | 0.00 | 8.69 | 12.00 / 8.40 | pièce + modèle + motorisation | 0.77 | — |
| 28 | R2 | `/pieces/courroie-d-accessoire-10/peugeot-128/206-128014/1-4-i-9466.html` | courroie 206 1.4 essence | 41 | 0 | 0.00 | 8.49 | 7.33 / 8.69 | pièce + modèle + motorisation | 0.75 | — |
| 29 | R2 | `/pieces/pompe-de-direction-assistee-12/peugeot-128/206-128014/1-4-i-9466.html` | pompe direction assistée 206 1.4 essence | 41 | 0 | 0.00 | 7.37 | 4.50 / 7.51 | pièce + modèle + motorisation | 0.75 | — |
| 30 | R8 | `/constructeurs/peugeot-128/208-128021/1-6-gti-58650.html` | piece 208 gti | 95 | 1 | 1.05 | 10.24 | 10.27 / 10.22 | pièces + modèle | 0.74 | piece |
| 31 | R2 | `/pieces/filtre-a-huile-7/renault-140/clio-v-140174/1-0-tce-90-77699.html` | filtre a huile clio 5 1.0 tce | 39 | 0 | 0.00 | 9.56 | 11.00 / 9.53 | pièce + modèle + motorisation | 0.71 | 5 |
| 32 | R2 | `/pieces/pompe-de-direction-assistee-12/peugeot-128/partner-i-128093/1-9-d-7979.html` | pompe direction assistée partner 1.9 d | 39 | 0 | 0.00 | 7.03 | 4.25 / 7.74 | pièce + modèle + motorisation | 0.71 | — |
| 33 | R2 | `/pieces/bougie-d-allumage-686/renault-140/clio-v-140174/1-0-tce-90-77699.html` | bougie clio 5 1.0 tce | 38 | 0 | 0.00 | 10.26 | 9.50 / 10.34 | pièce + modèle + motorisation | 0.70 | 5 |
| 34 | R2 | `/pieces/courroie-d-accessoire-10/renault-140/clio-v-140174/1-0-tce-100-77698.html` | courroie accessoire clio 5 1.0 tce | 38 | 0 | 0.00 | 9.18 | 11.33 / 8.97 | pièce + modèle + motorisation | 0.70 | 5 |
| 35 | R8 | `/constructeurs/peugeot-128/207-128018/2-0-hdi-57721.html` | 207 2l hdi | 92 | 1 | 1.09 | 8.65 | 9.33 / 8.60 | pièce + modèle + motorisation | 0.68 | 2l |
| 36 | R2 | `/pieces/pompe-a-eau-1260/opel-123/corsa-c-123046/1-2-twinport-18229.html` | pompe a eau opel corsa c 1.2 essence | 37 | 0 | 0.00 | 4.76 | 5.00 / 4.73 | pièce + modèle + motorisation | 0.68 | essence |
| 37 | R2 | `/pieces/volant-moteur-577/ford-60/fiesta-v-60073/1-4-tdci-16102.html` | volant moteur ford fiesta 1.4 tdci | 37 | 0 | 0.00 | 4.19 | 2.33 / 4.36 | pièce + modèle + motorisation | 0.68 | — |
| 38 | R2 | `/pieces/pompe-de-direction-assistee-12/mercedes-benz-108/classe-a-w168-108032/a-170-cdi-1-7-15835.html` | pompe de direction assistée mercedes classe a 170 cdi | 36 | 0 | 0.00 | 4.47 | 5.14 / 4.31 | pièce + modèle + motorisation | 0.66 | — |
| 39 | R2 | `/pieces/support-moteur-247/peugeot-128/206-128014/1-4-i-9466.html` | support moteur 206 1.4 essence | 36 | 0 | 0.00 | 9.19 | 14.67 / 8.70 | pièce + modèle + motorisation | 0.66 | — |
| 40 | R2 | `/pieces/support-moteur-247/peugeot-128/207-128018/1-4-16v-26630.html` | support moteur 207 1.4 essence | 36 | 0 | 0.00 | 6.39 | 1.00 / 7.06 | pièce + modèle + motorisation | 0.66 | — |
| 41 | R2 | `/pieces/corps-papillon-158/peugeot-128/206-128014/1-4-i-9466.html` | papillon 206 1.4 essence | 34 | 0 | 0.00 | 7.26 | 7.00 / 7.30 | pièce + modèle + motorisation | 0.62 | — |
| 42 | R2 | `/pieces/pompe-a-eau-1260/renault-140/kangoo-i-140021/1-9-d-8990.html` | pompe a eau kangoo 1.9 d | 33 | 0 | 0.00 | 8.55 | 7.50 / 8.61 | pièce + modèle + motorisation | 0.60 | — |
| 43 | R2 | `/pieces/support-moteur-247/peugeot-128/206-128014/1-1-i-9465.html` | support moteur 206 1.1 essence | 33 | 0 | 0.00 | 8.70 | 8.00 / 8.77 | pièce + modèle + motorisation | 0.60 | — |
| 44 | R8 | `/constructeurs/mercedes-benz-108/classe-c-w203-108038/c-200-cdi-2-2-14818.html` | pieces mercedes w203 | 33 | 0 | 0.00 | 10.48 | 10.00 / 10.94 | pièces + modèle | 0.60 | — |
| 45 | R8 | `/constructeurs/renault-140/express-140014/1-9-d-2114.html` | catalogue pièces renault express | 33 | 0 | 0.00 | 9.30 | 12.88 / 8.16 | pièces + modèle | 0.60 | catalogue |
| 46 | R2 | `/pieces/pompe-a-eau-1260/opel-123/corsa-c-123046/1-2-twinport-18229.html` | pompe à eau opel corsa 1.2 essence | 32 | 0 | 0.00 | 4.50 | 5.50 / 4.36 | pièce + modèle + motorisation | 0.59 | essence |
| 47 | R8 | `/constructeurs/iveco-84/daily-iii-chassis-cabine-84014/2-8-d-35c15-34241.html` | pièce iveco daily 35c15 | 31 | 0 | 0.00 | 9.90 | 8.00 / 10.11 | pièces + modèle | 0.57 | piece |
| 48 | R8 | `/constructeurs/peugeot-128/208-128021/1-6-gti-58650.html` | accessoires 208 gti | 31 | 0 | 0.00 | 10.55 | 12.00 / 9.63 | pièce + modèle + motorisation | 0.57 | accessoires |
| 49 | R2 | `/pieces/capteur-temperature-d-air-admission-3939/renault-140/modus-140053/1-5-dci-18314.html` | capteur température air admission 1.5 dci | 30 | 0 | 0.00 | 7.63 | 6.44 / 8.14 | pièce + modèle + motorisation | 0.55 | — |
| 50 | R2 | `/pieces/galet-tendeur-de-courroie-d-accessoire-310/peugeot-128/206-128014/1-1-i-9465.html` | galet tendeur 206 1.1 essence | 30 | 0 | 0.00 | 5.23 | 7.80 / 4.72 | pièce + modèle + motorisation | 0.55 | — |

### Fenêtre 28 jours — 15 premiers

| # | Rôle | Page | Requête | Impr. | Clics | CTR % | Pos. | Ordi / mobile | Motif | Gagnables |
|---:|---|---|---|---:|---:|---:|---:|---|---|---:|
| 1 | R8 | `/constructeurs/lancia-92/ypsilon-i-92048/1-3-d-multijet-20034.html` | pièces détachées lancia ypsilon | 127 | 0 | 0.00 | 8.35 | 8.45 / 8.25 | pièces + modèle | 2.32 |
| 2 | R2 | `/pieces/thermostat-316/peugeot-128/207-128018/1-4-16v-26630.html` | thermostat 207 1.4 essence | 57 | 0 | 0.00 | 7.84 | 9.67 / 7.74 | pièce + modèle + motorisation | 1.04 |
| 3 | R8 | `/constructeurs/mercedes-benz-108/classe-b-w246-108036/b-180-cdi-1-5-59438.html` | pièces détachées mercedes classe b 180 cdi | 48 | 0 | 0.00 | 7.87 | 7.00 / 8.05 | pièces + modèle | 0.88 |
| 4 | R8 | `/constructeurs/citroen-46/saxo-46070/1-6-vts-5552.html` | piece saxo vts | 42 | 0 | 0.00 | 9.76 | 6.89 / 10.55 | pièces + modèle | 0.77 |
| 5 | R2 | `/pieces/thermostat-316/peugeot-128/206-128014/1-1-i-9465.html` | thermostat 206 1.1 essence | 40 | 0 | 0.00 | 5.75 | 5.00 / 5.77 | pièce + modèle + motorisation | 0.73 |
| 6 | R8 | `/constructeurs/peugeot-128/207-128018/2-0-hdi-57721.html` | 207 2.0 hdi | 35 | 0 | 0.00 | 8.29 | 8.00 / 8.40 | pièce + modèle + motorisation | 0.64 |
| 7 | R2 | `/pieces/courroie-d-accessoire-10/renault-140/symbol-ii-140093/1-2-16v-9292.html` | courroie alternateur symbol 1.2 16v | 34 | 0 | 0.00 | 6.74 | 8.50 / 6.50 | pièce + modèle + motorisation | 0.62 |
| 8 | R2 | `/pieces/support-moteur-247/renault-140/laguna-i-140026/1-9-dti-8991.html` | support moteur laguna 1.9 dti | 30 | 0 | 0.00 | 5.53 | 6.33 / 5.33 | pièce + modèle + motorisation | 0.55 |
| 9 | R8 | `/constructeurs/fiat-58/500-c-58122/1-2-32825.html` | catalogue pièces fiat 500 | 26 | 0 | 0.00 | 14.38 | 13.88 / 15.33 | pièces + modèle | 0.48 |
| 10 | R8 | `/constructeurs/renault-140/clio-i-140002/1-2-chipie-14908.html` | clio chipie phase 2 | 26 | 0 | 0.00 | 5.81 | 1.00 / 9.33 | autre | 0.48 |
| 11 | R2 | `/pieces/pompe-a-carburant-458/citroen-46/berlingo-i-46006/1-9-d-10227.html` | pompe à gasoil berlingo 1.9 d prix | 25 | 0 | 0.00 | 8.84 | 12.00 / 8.50 | pièce + modèle + motorisation | 0.46 |
| 12 | R8 | `/constructeurs/peugeot-128/208-128021/1-6-gti-58650.html` | piece 208 gti | 25 | 0 | 0.00 | 7.32 | 5.82 / 8.50 | pièces + modèle | 0.46 |
| 13 | R2 | `/pieces/bougie-d-allumage-686/renault-140/clio-v-140174/1-0-tce-90-77699.html` | bougie clio 5 1.0 tce | 22 | 0 | 0.00 | 10.09 | 9.50 / 10.21 | pièce + modèle + motorisation | 0.40 |
| 14 | R2 | `/pieces/support-moteur-247/peugeot-128/207-128018/1-4-16v-26630.html` | support moteur 207 1.4 essence | 22 | 0 | 0.00 | 4.86 | 1.00 / 5.72 | pièce + modèle + motorisation | 0.40 |
| 15 | R2 | `/pieces/courroie-d-accessoire-10/peugeot-128/206-128014/1-4-i-9466.html` | référence courroie accessoire 206 1.4 essence | 21 | 0 | 0.00 | 7.62 | 6.50 / 7.78 | référence … | 0.38 |

### Totaux par motif de requête

Règle du motif (`analyse_rangs.py`, `motif()`) : commence par « référence/ref » → « référence … » ; contient « pièce(s) » → « pièces + modèle » ; contient une cylindrée, une puissance, un code de motorisation (hdi, dci, tdi, 16v…) ou un carburant → « pièce + modèle + motorisation » ; sinon « autre ».

90 jours :

| motif | role | couples | impr | clics | clics_gagnables |
|---|---|---|---|---|---|
| pièce + modèle + motorisation | R2 | 316 | 4818 | 70 | 65.9 |
| pièces + modèle | R8 | 139 | 2720 | 24 | 36.3 |
| pièce + modèle + motorisation | R8 | 58 | 905 | 8 | 12.9 |
| autre | R8 | 45 | 567 | 2 | 10.0 |
| autre | R2 | 73 | 541 | 15 | 6.9 |
| référence … | R2 | 8 | 236 | 2 | 3.3 |
| pièces + modèle | R2 | 1 | 19 | 0 | 0.3 |

28 jours :

| motif | role | couples | impr | clics | clics_gagnables |
|---|---|---|---|---|---|
| pièce + modèle + motorisation | R2 | 163 | 1382 | 20 | 22.1 |
| pièces + modèle | R8 | 79 | 849 | 13 | 12.1 |
| pièce + modèle + motorisation | R8 | 22 | 218 | 3 | 3.0 |
| autre | R8 | 17 | 136 | 0 | 2.5 |
| autre | R2 | 27 | 140 | 5 | 2.2 |
| référence … | R2 | 4 | 51 | 1 | 0.9 |

### Totaux par gamme (90 j, 12 premières ; complets dans `data/totaux_90j_gamme.tsv` et `data/totaux_28j_gamme.tsv`)

| gamme | role | couples | impr | clics | clics_gagnables |
|---|---|---|---|---|---|
| (R8 sans gamme) | R8 | 242 | 4192 | 34 | 59.2 |
| courroie-d-accessoire | R2 | 72 | 1416 | 30 | 16.7 |
| support-moteur | R2 | 39 | 651 | 9 | 8.2 |
| thermostat | R2 | 29 | 671 | 9 | 8.0 |
| pompe-a-eau | R2 | 26 | 417 | 1 | 7.0 |
| filtre-a-huile | R2 | 38 | 413 | 4 | 6.5 |
| pompe-de-direction-assistee | R2 | 8 | 175 | 3 | 3.1 |
| alternateur | R2 | 14 | 202 | 3 | 2.4 |
| joint-de-cache-culbuteurs | R2 | 5 | 108 | 0 | 2.0 |
| bougie-d-allumage | R2 | 7 | 88 | 0 | 1.6 |
| compresseur-de-climatisation | R2 | 10 | 86 | 0 | 1.6 |
| galet-tendeur-de-courroie-d-accessoire | R2 | 6 | 91 | 1 | 1.2 |

### Totaux par marque (90 j, 10 premières ; complets dans `data/totaux_90j_marque.tsv` et `data/totaux_28j_marque.tsv`)

| marque | role | couples | impr | clics | clics_gagnables |
|---|---|---|---|---|---|
| peugeot | R2 | 166 | 2538 | 40 | 33.3 |
| renault | R2 | 91 | 1578 | 18 | 22.5 |
| renault | R8 | 65 | 1032 | 7 | 15.8 |
| peugeot | R8 | 32 | 759 | 8 | 8.6 |
| lancia | R8 | 1 | 373 | 0 | 6.8 |
| citroen | R8 | 28 | 482 | 6 | 6.6 |
| mercedes-benz | R8 | 36 | 582 | 9 | 6.3 |
| volkswagen | R2 | 26 | 318 | 5 | 4.3 |
| citroen | R2 | 24 | 208 | 5 | 3.6 |
| opel | R8 | 17 | 237 | 1 | 3.6 |

---

## 6.2 Ce qui distingue les gagnantes (relevé)

### Échantillon (`scripts/echantillon.py`, `data/echantillon_6_2.tsv`)

- **R2 G** (gagnantes) : 20 pages avec clics sur un couple de position ≤ 5, fenêtre 90 j.
- **R2 S** (stagnantes) : 20 pages en position 8–15 sans clic, 90 j.
- **R8 G** : seules **5** pages remplissent la condition (2 sur 90 j, 3 complétées sur avr.–nov.). Elles sont comparées à **10 R8 S**. Le « 10 + 10 » R8 n'est donc pas atteignable avec la règle du mandat.
- En plus : 22 pages R1 de gamme, relevées pour les liens entrants, plus les pages du top 50. Total des pages relevées : 91 R2/R8.

### Relevé PROD

- `scripts/get_prod.sh` : 118 GET en tout.
  - 1 à 114 : de 12:34:15Z à 12:37:02Z, toutes en 200.
  - 115 à 118 : de 12:39:55Z à 12:39:59Z ; journal ajouté à la main au même fichier.
  - Détail : `data/get_journal.tsv`.
- Extraction par `scripts/extraire_html.py` vers `data/releve_prod_pages.tsv`.
- Ajout des données en base par `scripts/comparer_6_2.py` vers `data/releve_prod_pages_complet.tsv`, avec :
  - le sitemap servi ;
  - `map_has_item` ;
  - la présence de la gamme dans le cache R8 (`sql/07`, 12:39:25Z) ;
  - les impressions et la position de la page.

### Règle de décision, fixée avant lecture des résultats (`scripts/comparer_6_2.py`)

- **Indicateur numérique** : il y a écart si les médianes G et S diffèrent d'au moins 25 % de la plus grande, et si les moyennes vont dans le même sens.
- **Indicateur oui/non** : il y a écart si les deux parts diffèrent d'au moins 20 points.
- Sinon : « pas d'écart mesuré ».

### Résultats R2 (20 G contre 20 S)

| Élément | G (médiane ou part) | S | Verdict | Code ou donnée qui le produit |
|---|---:|---:|---|---|
| Statut HTTP | 200 ×20 | 200 ×20 | pas d'écart mesuré | `pieces.$gamme.$marque.$modele.$type[.]html.tsx`, chargeur `utils/pieces-vehicle.loader.server.ts` |
| Robots `index, follow` | 100 % | 95 % (1 noindex) | pas d'écart mesuré | `frontend/app/utils/seo/r2-indexability.ts:81` `resolveR2Robots`, appelé `pieces-vehicle.loader.server.ts:646` (compte de produits vendables) ; NoProducts → `NoProductsAlternatives` (route l. 75) |
| Canonique vers soi | 100 % | 95 % | pas d'écart mesuré | même chargeur ; la page NoProducts n'en a pas (hors périmètre, voir fin) |
| Title | 58 gabarit RM, 7 secours, 1 NoProducts sur 66 relevées | — | pas d'écart mesuré (même gabarit) | `__seo_gamme_car.sgc_title` (identique sur les 118 gammes : `#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.`), assemblé par `backend/src/modules/rm/services/rm-builder.service.ts:660-707` et `catalog/services/seo-template.service.ts` (~l. 395-415) ; secours `pieces-vehicle.loader.server.ts:689-699` |
| H1 | contient le carburant | idem | pas d'écart mesuré | `__seo_gamme_car.sgc_h1` + `frontend/app/components/pieces/PiecesHeader.tsx:99-109` (`typeFuel`, `compSwitch2`) |
| Meta description | gabarit | gabarit | pas d'écart mesuré | `__seo_gamme_car.sgc_descrip`, `pieces-vehicle.loader.server.ts:701-704` |
| **Pièces listées** | **15** | **10** | **écart** | RPC `rm_page_v2` (catalogue `pieces` × `__sitemap_p_link`) |
| **JSON-LD Product** | **15,5** | **10** | **écart** (suit le nombre de pièces) | `frontend/app/utils/seo/pieces-schema.utils.ts` |
| Prix affichés (occurrences) | 26 | 25 | pas d'écart mesuré | tarifs fournisseurs (pas à jour, décision du 18 nov.) |
| Mentions de disponibilité | 2 | 3,5 | écart **inverse** (S en montre plus) | même source |
| Images (total) | 25 | 20,5 | pas d'écart mesuré | — |
| **Images de pièces** (`rack-images`) | **13,5** | **9** | **écart** (suit le nombre de pièces) | images produits (chantier DB/DC) |
| Mots visibles | 1 430 | 1 243 | pas d'écart mesuré | — |
| **Texte propre** (8-grammes absents des autres pages relevées) | **529** | **311** | **écart** | blocs dépendants du catalogue (liste, références) |
| Part commune avec les pages sœurs | 58 % | 64 % | pas d'écart mesuré | gabarit commun |
| Liens SSR vers d'autres R2 | 0 | 0 | pas d'écart mesuré | une R2 ne lie aucune R2 ; seulement des R1 |
| Lien depuis la R1 de la gamme | 15 % (3/20) | 0 % | pas d'écart mesuré (sous 20 points) | R1 de gamme (voir CU) |
| **Dans le sitemap servi** | **40 %** | **15 %** | **écart** | `backend/src/modules/seo/services/sitemap-v10-pieces.service.ts` (règle ci-dessous) |
| **Dans `__sitemap_p_link`** | **70 %** | **40 %** | **écart** | table `__sitemap_p_link` |
| Gamme présente dans le catalogue R8 du véhicule | 75 % | 95 % | écart **inverse** | `__vehicle_page_cache.payload.catalog` |
| Impressions de la page sur 90 j | 230 | 38 | écart (conséquence) | — |
| Position de la page sur 90 j | 5,97 | 9,5 | écart (critère de sélection) | — |

#### Lecture

- Les seuls écarts nets **avant** le classement sont la **profondeur du catalogue** (pièces listées, JSON-LD Product, images de pièces, texte propre) et la **présence dans le sitemap ou dans `__sitemap_p_link`**.
- Ces deux écarts ne sont pas indépendants : la règle du sitemap dépend de `map_has_item`, c'est-à-dire du nombre de pièces.
- **Le sitemap n'explique pas le taux de clic** (`scripts/couverture_sitemap_r2.py`). Hors échantillon, en rang page 4–15 sur 90 j, les R2 dans et hors du sitemap ont le **même CTR : 1,74 % et 1,74 %**.
- Sur 28 j : 1,80 % dans le sitemap contre 1,56 % hors du sitemap.
- Le titre, le H1, la description, les robots et le canonique sont **identiques en structure** entre G et S. Ils n'expliquent pas l'écart entre les deux groupes, mais 6.3 montre qu'ils ratent des mots des requêtes.
- **Cause retenue** : aucune cause unique prouvée. Le seul facteur mesuré est « plus de pièces ». Avec n = 20 et un simple écart de médiane, c'est une **corrélation**, pas une preuve.

#### Règle du sitemap R2, rejouée en base (`sql/10`, 12:40:43Z)

Une page R2 entre dans le sitemap si les quatre conditions sont réunies :

- `pieces_gamme.pg_display='1'` et `pg_relfollow='1'` ;
- `__sitemap_p_link.map_has_item > 20` (seuil lu dans `crawl_budget_experiments`, ligne running/reduce, `baseline.min_items_threshold`) ;
- `auto_type.type_display='1'` ;
- le type appartient au modèle du lien.

Contrôle : la règle rejouée **coïncide 66 fois sur 66** avec le sitemap servi (24 dans le sitemap, 23 hors du sitemap, 19 pages absentes de `__sitemap_p_link`).

### Résultats R8 (5 G contre 10 S)

**Pas d'écart mesuré**, sauf sur les mentions de disponibilité, où l'écart est faible et sans portée. Pour tous les indicateurs (title, H1, robots, canonique, JSON-LD, prix, images, texte propre, part commune de 71 à 75 %, liens vers R2, sitemap), les valeurs sont identiques ou proches.

Trois points communs à toutes les R8 relevées :

- aucune n'a de JSON-LD Product ni de prix ;
- **aucune n'est dans un sitemap servi** (voir hors périmètre) ;
- elles lient de 66 à 73 R2. Le HTML servi montre environ 70 % des gammes de leur cache (par exemple 72 sur 108), car `family.gammes.slice(0,5)` limite l'affichage tant que la liste n'est pas dépliée (`constructeurs.$brand.$model.$type.tsx`, liens R2 aux l. 750, 842 et 977).

Code R8 :

- Title : `r8Content.metaTitle` (`__seo_r8_pages.meta_title`, 155 lignes seulement), sinon `seo_custom.mta_title`, sinon un gabarit. Voir `frontend/app/components/vehicle/r8/r8-transform.ts:131-149` et la route l. 416.
- Suffixes de titre : `r8-transform.ts:97` (« à prix discount / pas cher / à mini prix / en promotion », tournant sur `type_id`).
- Robots : `rpcData.seo_validation.is_indexable`, et `type_id` 60000–83456 en noindex (`r8-transform.ts:202-212`).
- Données : `get_vehicle_page_data_cached` et `__vehicle_page_cache` (28 505 lignes).

---

## 6.3 Le titre face à la requête (relevé — aucun titre écrit)

Règle (`scripts/mots_absents_6_3.py`) :

- Les mots de la requête sont comparés au title et au H1 **servis** (GET 12:34–12:37Z).
- Normalisation : minuscules, accents retirés, apostrophes et tirets transformés en espaces, « 1,5 » lu comme « 1.5 ».
- Mots vides ignorés : de, à, pour, la, le, les, du, des, d, l, en, et, sur, au, aux, un, une.
- Pas de lemmatisation : « pièce » et « pièces » sont des mots différents, et « culbuteur » diffère de « culbuteurs ».

Sorties : `data/mots_absents_top50.tsv` (couple par couple), `data/mots_absents_frequence.tsv` et `data/mots_absents_par_gamme.tsv`.

- **24 couples sur 50** ont au moins un mot de la requête absent **à la fois** du title et du H1 : 13 R2 sur 33 et 11 R8 sur 17.
- **37 couples sur 50** ont au moins un mot absent du **title**.

| Mot absent | du title | du title et du H1 | Lecture |
|---|---:|---:|---|
| essence | **17** | 3 | Le H1 R2 porte le carburant, le title R2 jamais : le gabarit n'a pas de `#VFuel#`. |
| alternateur | 3 | 3 | « courroie alternateur » ; la gamme s'appelle « Courroie d'accessoire ». |
| piece / pieces | 3 | 3 (+5 « pieces » absent du H1) | requêtes R8 « pièce(s) + modèle » |
| 5, 3, 6 (numéros de génération) | 5 | 5 | « clio 5 », « clio 3 », « golf 6 » contre « CLIO V », « CLIO III », « GOLF VI » |
| detachees | 2 | 2 | « pièces détachées » (R8) |
| moteur | 2 | 2 | R8 « moteur express 1.6 diesel » |
| reference | 2 | 2 | « référence courroie … » |
| culbuteur | 2 | 2 | pluriel dans la gamme (« culbuteurs ») |
| phase | 2 | 0 | présent dans le H1 |
| schema, mpi, diesel, catalogue, accessoires, 2l | 1 chacun | 1 | — |

Par gamme (`data/mots_absents_par_gamme.tsv`) :

| gamme | mot | couples |
|---|---|---|
| (R8 sans gamme) | piece | 3 |
| (R8 sans gamme) | detachees | 2 |
| (R8 sans gamme) | moteur | 2 |
| (R8 sans gamme) | essence | 1 |
| (R8 sans gamme) | 1 | 1 |
| (R8 sans gamme) | diesel | 1 |
| (R8 sans gamme) | 2l | 1 |
| (R8 sans gamme) | catalogue | 1 |
| (R8 sans gamme) | accessoires | 1 |
| courroie-d-accessoire | alternateur | 3 |
| courroie-d-accessoire | reference | 2 |
| courroie-d-accessoire | 3 | 1 |
| courroie-d-accessoire | schema | 1 |
| courroie-d-accessoire | 5 | 1 |
| joint-de-cache-culbuteurs | culbuteur | 2 |
| joint-de-cache-culbuteurs | 6 | 1 |
| pompe-a-eau | essence | 2 |
| pompe-a-eau | mpi | 1 |
| filtre-a-huile | 5 | 1 |
| bougie-d-allumage | 5 | 1 |

Autres constats sur le title servi :

- **R2** :
  - 80 caractères en moyenne ; **64 titles sur 66 dépassent 60 caractères** ;
  - 58 suivent le gabarit RM « … à partir de X€ + accroche », 7 le secours « … | Pièces Auto », 1 « … non référencé … — Alternatives | AutoMecanik ».
- **R8** :
  - 42 caractères en moyenne ;
  - le suffixe est commercial (« pas cher », « à mini prix », …) ; ni « pièces détachées », ni le carburant, ni la puissance n'y figurent.

---

## 6.4 Pages R2 sœurs des 20 gagnantes (relevé)

Extraction : `sql/10_soeurs_r2_6_4.sql` (12:40:43Z) puis `scripts/soeurs_6_4.py` vers `data/soeurs_r2_6_4.tsv`.

**L'état d'indexation par URL n'est pas en base** : `__seo_index_history` a 0 ligne et aucune API Google n'a été appelée. « Absente de GSC » signifie « aucune impression au grain page sur 90 j ». Cela ne veut pas dire « Explorée, actuellement non indexée ».

| Type de sœur | Pages | Dans le sitemap servi | Absentes de GSC page 90 j | … et hors sitemap | … et dans le sitemap | `map_has_item` ≤ 20 | Noindex estimé* |
|---|---:|---:|---:|---:|---:|---:|---:|
| même gamme, même modèle, autre motorisation | 192 | 94 | 136 | 74 | 62 | 98 | 1 |
| même motorisation, autre gamme | 881 | 381 | 683 | 403 | 280 | 486 | 21 |

\* Estimation, pas le robots servi. Elle applique la règle de `r2-indexability.ts` (index à partir de 2 produits) avec `map_has_item` à la place du compte de produits vendables. Le robots servi n'est connu que pour les 66 pages relevées en GET.

Part des sœurs qui ont des impressions :

- même gamme, même modèle : **34 %** si elles sont dans le sitemap, **24 %** sinon ;
- même motorisation, autre gamme : **27 %** et **19 %**.

Le nombre de pièces par sœur est dans la colonne `map_has_item` du TSV.

---

## 6.5 Pages perdues — recoupement avec AK (#2087) (relevé)

`sql/11_pages_perdues_ak.sql` (12:42:28Z) reconstitue la règle AK : pages `/pieces/` avec au moins un clic en juillet et 0 clic en octobre, au grain page.

**Concordance exacte avec AK** sur : 1 269 pages, dont 1 258 R2 ; 1 473 clics et 15 560 impressions en juillet ; 5 373 impressions en octobre ; 691 pages sans impression en octobre ; 1 131 pages à un seul clic. Le rapport AK a été lu à la tête `c32bec31ed1b8ddfd587c64bb19e001e5b63abd3`.

Classement : `scripts/croisement_ak_6_5.py` vers `data/croisement_ak_6_1.tsv`. Classes exclusives, appliquées dans l'ordre :

| Classe | Pages | Clics 90 j | Dans le sitemap servi |
|---|---:|---:|---:|
| A — dans la liste 6.1 (au moins un couple retenu) | 50 | 68 | 23 |
| B — rang page 4–15, sans couple nommé retenu | 694 | 164 | 135 |
| C — rang page 1–3 | 34 | 14 | 8 |
| D — au-delà du rang 15 | 143 | 14 | 35 |
| E — sorties : aucune impression sur 90 j | 348 | 0 | 38 |
| **Total** | **1 269** | 260 | **239** |

Lecture :

- **744 des 1 269 pages perdues (A + B) sont encore classées entre 4 et 15**. Elles sont donc dans le périmètre de ce mandat, même si la plupart n'ont plus de requête nommée.
- **348 sont sorties** des résultats.
- Seules **239 sur 1 269** sont dans le sitemap servi.

Recoupement CQ (#2182, `r2-cliquees-non-vendables.tsv`, tête `bc2ce1e32e97`) : sur ses 47 R2 cliquées non vendables, **1 seule** figure dans la liste 6.1 (90 j), et aucune dans le top 50 ni dans l'échantillon 6.2.

---

## 6.6 Propositions (PROPOSÉ — rien n'est appliqué)

Classement : clics gagnables du périmètre concerné (grain page, 90 j), puis solidité de la mesure.

- **Les effets annoncés sont des plafonds**, pas des prévisions. Aucune des mesures ci-dessus ne prouve qu'un changement donné ferait monter une page.
- Tout changement de title ou de H1 est soumis à Marwane avant écriture.

### P1 — Title R2 : carburant manquant, longueur, accroche (R2, plafond 4 799,7 clics gagnables page / 90 j ; 76,4 au grain requête)

**Mesure d'appui** :

- « essence » manque du title dans 17 couples du top 50, alors que le H1 le porte ;
- 64 titles R2 sur 66 dépassent 60 caractères (Google les tronque) ;
- le gabarit est identique sur les 118 gammes : `#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.` (`data/gabarits_r2_en_vigueur.tsv`) ;
- les numéros de génération (« clio 3 » contre « CLIO III ») et les synonymes (« courroie alternateur ») manquent aussi.

**Effet attendu** : meilleure concordance requête/title, donc un CTR meilleur à rang égal. Non chiffrable avant essai ; à suivre avec la ligne 6.7.

**Code concerné** :

- **donnée** : `__seo_gamme_car.sgc_title` (une écriture en base) ;
- **assemblage** : `rm-builder.service.ts:660-707`. Le contexte n'y passe **pas** le carburant ; le commentaire l. 679-681 dit « Pas de `fuel`/`motor_codes` : ils changeraient aussi h1/title ».
  - `seo-template.service.ts` sait déjà remplacer `VFuel` (`legacyValues`).
  - Utiliser `#VFuel#` exige donc une modification de code **et** de donnée.
- **secours** : `pieces-vehicle.loader.server.ts:689-699`.

**Dépendances** :

- tarifs : seulement pour les gabarits avec prix. Le title servi aujourd'hui affiche **déjà** « à partir de X€ » calculé sur des tarifs pas à jour ;
- #2191 : seulement pour R2-C ;
- ni images, ni WIKI.

**Décision de Marwane** : le gabarit, le maintien ou non du prix et de l'accroche, et l'ordre de déploiement.

Gabarits candidats, montrés sur les 10 premières pages R2 distinctes du top 50 (`scripts/demo_gabarits_6_6.py` vers `data/gabarits_candidats_demo.tsv`) :

- Données véhicule : `auto_type`, `auto_modele`, `auto_marque` (`sql/13`, 12:44:09Z).
- Prix mini et nombre de pièces : données du chargeur servies (GET).
- Carburant ajouté seulement s'il n'est pas déjà implicite dans le nom du type (dCi, HDi, TDI, D, PureTech…).

**R2-A carburant + prix court (après tarifs)** — longueur médiane 61 car., 5/10 au-delà de 60

| Page | Title servi (car.) | Candidat (car.) |
|---|---|---|
| `1-5-dci-19052.html` | Courroie d'accessoire RENAULT CLIO III 1.5 dCi 86 ch à partir de 12.00€ pas cher. (81) | Courroie d'accessoire RENAULT CLIO III 1.5 dCi 86 ch dès 12 € (61) |
| `1-4-16v-26630.html` | Thermostat PEUGEOT 207 1.4 16V 95 ch à partir de 59.00€ économique. (67) | Thermostat PEUGEOT 207 1.4 16V Essence 95 ch dès 59 € (53) |
| `1-2-16v-9292.html` | Courroie d'accessoire RENAULT SYMBOL II 1.2 16V 75 ch à partir de 9.00€ au meilleur prix. (89) | Courroie d'accessoire RENAULT SYMBOL II 1.2 16V Essence 75 ch dès 9 € (69) |
| `1-4-16553.html` | Courroie d'accessoire RENAULT SYMBOL I 1.4 75 ch à partir de 11.00€ pas cher. (77) | Courroie d'accessoire RENAULT SYMBOL I 1.4 Essence 75 ch dès 11 € (65) |
| `1-1-i-9465.html` | Thermostat PEUGEOT 206 1.1 60 ch à partir de 7.00€ à petit prix. (64) | Thermostat PEUGEOT 206 1.1 Essence 60 ch dès 7 € (48) |
| `1-9-d-7979.html` | Courroie d'accessoire PEUGEOT PARTNER I 1.9 D (Phase 1) à partir de 10.00€ à petit prix. (88) | Courroie d'accessoire PEUGEOT PARTNER I 1.9 D (Phase 1) 69 ch dès 10 € (70) |
| `1-1-i-9465.html` | Alternateur PEUGEOT 206 1.1 60 ch à partir de 63.00€ à tarif avantageux. (72) | Alternateur PEUGEOT 206 1.1 Essence 60 ch dès 63 € (50) |
| `1-5-dci-59639.html` | Joint de cache culbuteurs RENAULT DUSTER I 1.5 dCi 85 ch à partir de 12.00€ à tarif avantageux. (95) | Joint de cache culbuteurs RENAULT DUSTER I 1.5 dCi 85 ch dès 12 € (65) |
| `1-9-dti-8991.html` | Support moteur RENAULT LAGUNA I 1.9 dTi 98 ch à partir de 23.00€ à tarif avantageux. (84) | Support moteur RENAULT LAGUNA I 1.9 dTi 98 ch dès 23 € (54) |
| `1-6-5677.html` | Pompe à eau SEAT IBIZA II 1.6 101 ch à partir de 31.00€ à prix imbattables. (75) | Pompe à eau SEAT IBIZA II 1.6 Essence 101 ch dès 31 € (53) |

**R2-B carburant + années, sans prix (avant tarifs)** — longueur médiane 64 car., 5/10 au-delà de 60

| Page | Title servi (car.) | Candidat (car.) |
|---|---|---|
| `1-5-dci-19052.html` | Courroie d'accessoire RENAULT CLIO III 1.5 dCi 86 ch à partir de 12.00€ pas cher. (81) | Courroie d'accessoire RENAULT CLIO III 1.5 dCi 86 ch (2005–2012) (64) |
| `1-4-16v-26630.html` | Thermostat PEUGEOT 207 1.4 16V 95 ch à partir de 59.00€ économique. (67) | Thermostat PEUGEOT 207 1.4 16V Essence 95 ch (2007–2013) (56) |
| `1-2-16v-9292.html` | Courroie d'accessoire RENAULT SYMBOL II 1.2 16V 75 ch à partir de 9.00€ au meilleur prix. (89) | Courroie d'accessoire RENAULT SYMBOL II 1.2 16V Essence 75 ch (2008–2014) (73) |
| `1-4-16553.html` | Courroie d'accessoire RENAULT SYMBOL I 1.4 75 ch à partir de 11.00€ pas cher. (77) | Courroie d'accessoire RENAULT SYMBOL I 1.4 Essence 75 ch (depuis 2000) (70) |
| `1-1-i-9465.html` | Thermostat PEUGEOT 206 1.1 60 ch à partir de 7.00€ à petit prix. (64) | Thermostat PEUGEOT 206 1.1 Essence 60 ch (1998–2007) (52) |
| `1-9-d-7979.html` | Courroie d'accessoire PEUGEOT PARTNER I 1.9 D (Phase 1) à partir de 10.00€ à petit prix. (88) | Courroie d'accessoire PEUGEOT PARTNER I 1.9 D (Phase 1) 69 ch (1996–2002) (73) |
| `1-1-i-9465.html` | Alternateur PEUGEOT 206 1.1 60 ch à partir de 63.00€ à tarif avantageux. (72) | Alternateur PEUGEOT 206 1.1 Essence 60 ch (1998–2007) (53) |
| `1-5-dci-59639.html` | Joint de cache culbuteurs RENAULT DUSTER I 1.5 dCi 85 ch à partir de 12.00€ à tarif avantageux. (95) | Joint de cache culbuteurs RENAULT DUSTER I 1.5 dCi 85 ch (depuis 2012) (70) |
| `1-9-dti-8991.html` | Support moteur RENAULT LAGUNA I 1.9 dTi 98 ch à partir de 23.00€ à tarif avantageux. (84) | Support moteur RENAULT LAGUNA I 1.9 dTi 98 ch (1997–2001) (57) |
| `1-6-5677.html` | Pompe à eau SEAT IBIZA II 1.6 101 ch à partir de 31.00€ à prix imbattables. (75) | Pompe à eau SEAT IBIZA II 1.6 Essence 101 ch (1996–2002) (56) |

**R2-C carburant + nombre de références + prix (après tarifs et #2191)** — longueur médiane 71 car., 8/10 au-delà de 60

| Page | Title servi (car.) | Candidat (car.) |
|---|---|---|
| `1-5-dci-19052.html` | Courroie d'accessoire RENAULT CLIO III 1.5 dCi 86 ch à partir de 12.00€ pas cher. (81) | Courroie d'accessoire RENAULT CLIO III 1.5 dCi : 42 références dès 12 € (71) |
| `1-4-16v-26630.html` | Thermostat PEUGEOT 207 1.4 16V 95 ch à partir de 59.00€ économique. (67) | Thermostat PEUGEOT 207 1.4 16V Essence : 10 références dès 59 € (63) |
| `1-2-16v-9292.html` | Courroie d'accessoire RENAULT SYMBOL II 1.2 16V 75 ch à partir de 9.00€ au meilleur prix. (89) | Courroie d'accessoire RENAULT SYMBOL II 1.2 16V Essence : 44 références dès 9 € (79) |
| `1-4-16553.html` | Courroie d'accessoire RENAULT SYMBOL I 1.4 75 ch à partir de 11.00€ pas cher. (77) | Courroie d'accessoire RENAULT SYMBOL I 1.4 Essence : 37 références dès 11 € (75) |
| `1-1-i-9465.html` | Thermostat PEUGEOT 206 1.1 60 ch à partir de 7.00€ à petit prix. (64) | Thermostat PEUGEOT 206 1.1 Essence : 10 références dès 7 € (58) |
| `1-9-d-7979.html` | Courroie d'accessoire PEUGEOT PARTNER I 1.9 D (Phase 1) à partir de 10.00€ à petit prix. (88) | Courroie d'accessoire PEUGEOT PARTNER I 1.9 D (Phase 1) : 55 références dès 10 € (80) |
| `1-1-i-9465.html` | Alternateur PEUGEOT 206 1.1 60 ch à partir de 63.00€ à tarif avantageux. (72) | Alternateur PEUGEOT 206 1.1 Essence : 30 références dès 63 € (60) |
| `1-5-dci-59639.html` | Joint de cache culbuteurs RENAULT DUSTER I 1.5 dCi 85 ch à partir de 12.00€ à tarif avantageux. (95) | Joint de cache culbuteurs RENAULT DUSTER I 1.5 dCi : 8 références dès 12 € (74) |
| `1-9-dti-8991.html` | Support moteur RENAULT LAGUNA I 1.9 dTi 98 ch à partir de 23.00€ à tarif avantageux. (84) | Support moteur RENAULT LAGUNA I 1.9 dTi : 19 références dès 23 € (64) |
| `1-6-5677.html` | Pompe à eau SEAT IBIZA II 1.6 101 ch à partir de 31.00€ à prix imbattables. (75) | Pompe à eau SEAT IBIZA II 1.6 Essence : 24 références dès 31 € (62) |

**Risques des gabarits R2** :

- **R2-A et R2-C** :
  - affichent un prix tiré de tarifs pas à jour (le risque existe déjà aujourd'hui) ;
  - R2-C affiche aussi un nombre de références qui inclut des pièces non vendables tant que #2191 n'est pas tranché ;
  - 5 R2-A sur 10 et 9 R2-C sur 10 dépassent 60 caractères.
- **R2-B** :
  - affiche les années de `auto_type`. Une `type_year_to` vide donne « (depuis 2000) », trompeur pour un véhicule qui n'est plus produit ;
  - des données fausses sortiraient telles quelles : une R8 relevée montre « (Phase 2) … 1996 à 1996 » ;
  - à valider sur un échantillon avant toute généralisation, ou à retirer.
- **Tous** :
  - suppriment l'accroche commerciale (« pas cher », « économique »…) dont l'effet n'a pas été mesuré ;
  - le carburant « implicite » repose sur une liste de motorisations à maintenir ;
  - les titles servis changent en masse (environ 101 000 URL du sitemap, et davantage hors sitemap). Une modification des meta optimisés exige l'autorisation de Marwane (CLAUDE.md, invariant 6).
- **Faisable avant la fin des tarifs** : R2-B seulement, ou R2-B sans années.
- **Après les tarifs** : R2-A ; **après #2191** : R2-C.

### P2 — Profondeur du catalogue des R2 (même périmètre R2, 4 799,7 ; mesure : seul écart net du 6.2)

**Mesure d'appui** : les gagnantes listent 15 pièces contre 10, ont 15,5 JSON-LD Product contre 10, 13,5 images de pièces contre 9 et 529 contre 311 8-grammes propres. Corrélation sur n = 20, pas une preuve.

**Effet attendu** : inconnu. Il n'est pas démontré que plus de pièces fasse monter une page ; c'est peut-être l'inverse (une page vue est mieux alimentée).

**Code ou donnée** : RPC `rm_page_v2`, `__sitemap_p_link.map_has_item`, catalogue `pieces`, images (`rack-images`).

**Dépendances** : **tarifs** (vendabilité), **#2191**, **images (DB, DC)**.

**Décision de Marwane** : aucune action SEO isolée possible ; c'est un sujet catalogue et fournisseurs. **Doit attendre les tarifs.**

### P3 — Title R8 (R8, plafond 1 071,8 clics gagnables page / 90 j ; 59,2 au grain requête)

**Mesure d'appui** :

- 11 couples R8 sur 17 du top 50 ont un mot absent du title et du H1 : « pièce(s) », « détachées », « moteur », carburant ;
- le title R8 fait 42 caractères en moyenne, avec un suffixe commercial ;
- le couple n° 1 de la liste est « pièces détachées lancia ypsilon » (373 impr., 0 clic, pos. 10,3).

**Effet attendu** : meilleure concordance sur le motif « pièces + modèle » (36,3 gagnables R8 / 90 j au grain requête).

**Code concerné** :

- `r8-transform.ts:131-149` (gabarit et `seo_custom.mta_title`) ;
- `r8-transform.ts:97` (suffixes) ;
- `__seo_r8_pages.meta_title` (155 lignes, prioritaire, route l. 416).

**Dépendances** : aucune avec les tarifs (pas de prix dans le title R8) ; à coordonner avec le rôle R7 (page modèle).

**Décision de Marwane** : choix du gabarit et sort des suffixes commerciaux.

Gabarits candidats, montrés sur les 10 premières pages R8 distinctes du top 50 :

**R8-A « Pièces détachées » + carburant + puissance** — longueur médiane 55 car., 0/10 au-delà de 60

| Page | Title servi (car.) | Candidat (car.) |
|---|---|---|
| `1-3-d-multijet-20034.html` | Pièces LANCIA YPSILON I 1.3 D à mini prix (41) | Pièces détachées LANCIA YPSILON I 1.3 D Multijet 90 ch (54) |
| `2-0-hdi-57721.html` | Pièces PEUGEOT 207 2.0 HDI pas cher (35) | Pièces détachées PEUGEOT 207 2.0 HDI 90 ch (42) |
| `1-2-chipie-14908.html` | Pièces RENAULT CLIO I 1.2 Chipie à prix discount (48) | Pièces détachées RENAULT CLIO I 1.2 (Phase 2) Essence 54 ch (59) |
| `2-0-hdi-54957.html` | Pièces SUZUKI VITARA II Cabriolet 2.0 HDI pas cher (50) | Pièces détachées SUZUKI VITARA II Cabriolet 2.0 HDI 87 ch (57) |
| `b-180-cdi-1-5-59438.html` | Pièces MERCEDES CLASSE B (W246) 180 CDI à mini prix (51) | Pièces détachées MERCEDES CLASSE B (W246) 180 CDI 109 ch (56) |
| `1-4-hdi-23829.html` | Pièces CITROËN C3 I 1.4 HDi pas cher (36) | Pièces détachées CITROËN C3 I 1.4 HDi 75 ch (43) |
| `1-4-16v-16554.html` | Pièces RENAULT SYMBOL I 1.4 16V à mini prix (43) | Pièces détachées RENAULT SYMBOL I 1.4 16V Essence 98 ch (55) |
| `2-0-opc-16v-13365.html` | Pièces OPEL ASTRA G 2.0 OPC 16V pas cher (40) | Pièces détachées OPEL ASTRA G 2.0 OPC 16V Essence 160 ch (56) |
| `e-290-t-td-2-9-5371.html` | Pièces MERCEDES CLASSE E (W210) 290 TD en promotion (51) | Pièces détachées MERCEDES CLASSE E (W210) 290 TD 129 ch (55) |
| `1-6-d-2113.html` | Pièces RENAULT EXPRESS 1.6 D pas cher (37) | Pièces détachées RENAULT EXPRESS (F40-G40) 1.6 D 55 ch (54) |

**R8-B « Pièces » + carburant + puissance + années** — longueur médiane 58 car., 1/10 au-delà de 60

| Page | Title servi (car.) | Candidat (car.) |
|---|---|---|
| `1-3-d-multijet-20034.html` | Pièces LANCIA YPSILON I 1.3 D à mini prix (41) | Pièces LANCIA YPSILON I 1.3 D Multijet 90 ch (2006–2011) (56) |
| `2-0-hdi-57721.html` | Pièces PEUGEOT 207 2.0 HDI pas cher (35) | Pièces PEUGEOT 207 2.0 HDI 90 ch (2008–2012) (44) |
| `1-2-chipie-14908.html` | Pièces RENAULT CLIO I 1.2 Chipie à prix discount (48) | Pièces RENAULT CLIO I 1.2 (Phase 2) Essence 54 ch (1996–1996) (61) |
| `2-0-hdi-54957.html` | Pièces SUZUKI VITARA II Cabriolet 2.0 HDI pas cher (50) | Pièces SUZUKI VITARA II Cabriolet 2.0 HDI 87 ch (2002–2005) (59) |
| `b-180-cdi-1-5-59438.html` | Pièces MERCEDES CLASSE B (W246) 180 CDI à mini prix (51) | Pièces MERCEDES CLASSE B (W246) 180 CDI 109 ch (2013–2018) (58) |
| `1-4-hdi-23829.html` | Pièces CITROËN C3 I 1.4 HDi pas cher (36) | Pièces CITROËN C3 I 1.4 HDi 75 ch (depuis 2005) (47) |
| `1-4-16v-16554.html` | Pièces RENAULT SYMBOL I 1.4 16V à mini prix (43) | Pièces RENAULT SYMBOL I 1.4 16V Essence 98 ch (depuis 2000) (59) |
| `2-0-opc-16v-13365.html` | Pièces OPEL ASTRA G 2.0 OPC 16V pas cher (40) | Pièces OPEL ASTRA G 2.0 OPC 16V Essence 160 ch (1999–2002) (58) |
| `e-290-t-td-2-9-5371.html` | Pièces MERCEDES CLASSE E (W210) 290 TD en promotion (51) | Pièces MERCEDES CLASSE E (W210) 290 TD 129 ch (1996–1999) (57) |
| `1-6-d-2113.html` | Pièces RENAULT EXPRESS 1.6 D pas cher (37) | Pièces RENAULT EXPRESS (F40-G40) 1.6 D 55 ch (1986–1998) (56) |

**Risques des gabarits R8** :

- **Cannibalisation** : « Pièces détachées {marque} {modèle} » est aussi la cible naturelle de la R7 (page modèle) et de la R2. Il faut contrôler la matrice des rôles (`.spec/00-canon/role-matrix.md`) avant de choisir.
- R8-B reprend les années, avec le même risque que R2-B (« (1996–1996) » sur CLIO I).
- `__seo_r8_pages` prime pour 155 pages : un changement de gabarit ne les touche pas.
- **Faisable avant la fin des tarifs** : oui, pour les deux gabarits.

### Constats à trancher hors de ce mandat (aucun effet mesuré sur le classement ici)

- **P4 — sitemap R8** : `/sitemap-vehicules.xml` répond **302 → /404** en PROD (GET n° 115, 12:39:55Z). Le code de `main` le génère (`sitemap-v10.service.ts:126-150`), mais l'index servi ne le liste pas.
  - Conséquence : aucune R8 n'est dans un sitemap servi.
  - En 6.2, G et S sont à 0 % : aucun effet mesurable dans l'échantillon.
  - Le sitemap est hors périmètre de ce mandat ; à décider.
- **P5 — couverture du sitemap R2** :
  - 89 % des R2 vues sur 90 j sont hors du sitemap servi (45 533 contre 5 648) et portent 2 702 des 3 391 clics ;
  - à l'inverse, seules 5 648 des 101 097 URL du sitemap ont eu des impressions ;
  - CTR identique dans et hors du sitemap.
  - Gelé tant que les tarifs ne sont pas à jour (pas de bascule « vendable », #2191 en brouillon).
- **P6 — liens internes vers les R2** :
  - aucune R2 ne lie une autre R2 ;
  - le lien depuis la R1 est rare (3 sur 20 contre 0 sur 20, sous le seuil) ;
  - `__seo_internal_link` est vide.
  - La décision 82 (liens générés par règles, vers des pages vendables et indexables seulement) fait **attendre les tarifs**.

### Avant ou après la fin de la mise à jour des tarifs

| Faisable avant les tarifs (sur décision de Marwane) | Doit attendre les tarifs |
|---|---|
| P1 avec le gabarit R2-B (sans prix), ou R2-B sans années | P1 avec R2-A (prix) ; R2-C (prix + nombre de références, après #2191) |
| P3, gabarits R8-A ou R8-B | P2 profondeur du catalogue (avec images DB/DC) |
| Ligne hebdomadaire 6.7 (mesure seule) | P5 sitemap « vendable » ; P6 liens par règles (décision 82) |
| Diagnostic de P4 (sitemap R8 en 404) : constat à confier, hors mandat | — |

---

## 6.7 Mesure hebdomadaire (PROPOSÉ — non planifiée, non branchée)

Requête : `sql/14_ligne_hebdo.sql`. Testée une fois à 12:46:12Z ; résultat dans `data/ligne_hebdo_test.tsv`.

- Une ligne par rôle et par semaine ISO **complète**, sur les 4 dernières semaines présentes en base.
- Règles identiques au 6.1 : 3 mots ou plus, rang 4–15 pondéré, divergents et « un appareil sans clic » écartés mais comptés.
- Clics gagnables au taux de 1,829 % au rang 3.
- Colonne de contrôle au grain page (taux de 3,896 %), plus fidèle.
- La date de la dernière donnée est reportée sur chaque ligne (alerte au-delà de 3 jours, décision 68).

Format de la ligne : `semaine | rôle | couples retenus | pages | impr. | clics | CTR | clics gagnables | divergents | un appareil sans clic | pages page 4–15 | impr. | clics | clics gagnables page`.

Résultat du test :

| semaine | lundi | dimanche | derniere_donnee | role | couples | pages | impr | clics | ctr_pct | clics_gagnables | couples_divergents | couples_un_appareil | pages_page_4_15 | impr_page_4_15 | clics_page_4_15 | clics_gagnables_page_4_15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-S43 | 2026-10-19 | 2026-10-25 | 2026-11-16 | R2 | 38 | 37 | 141 | 5 | 3.55 | 2.4 | 1 | 262 | 4642 | 10027 | 185 | 351.6 |
| 2026-S43 | 2026-10-19 | 2026-10-25 | 2026-11-16 | R8 | 44 | 37 | 216 | 4 | 1.85 | 3.7 | 0 | 127 | 631 | 3174 | 73 | 84.8 |
| 2026-S44 | 2026-10-26 | 2026-11-01 | 2026-11-16 | R2 | 34 | 33 | 160 | 6 | 3.75 | 2.5 | 2 | 272 | 4944 | 10431 | 168 | 374.1 |
| 2026-S44 | 2026-10-26 | 2026-11-01 | 2026-11-16 | R8 | 48 | 34 | 215 | 7 | 3.26 | 3.4 | 2 | 120 | 610 | 3270 | 74 | 92.2 |
| 2026-S45 | 2026-11-02 | 2026-11-08 | 2026-11-16 | R2 | 42 | 41 | 187 | 7 | 3.74 | 2.8 | 2 | 320 | 5533 | 11683 | 165 | 418.7 |
| 2026-S45 | 2026-11-02 | 2026-11-08 | 2026-11-16 | R8 | 31 | 25 | 204 | 1 | 0.49 | 3.6 | 0 | 120 | 573 | 3169 | 68 | 93.2 |
| 2026-S46 | 2026-11-09 | 2026-11-15 | 2026-11-16 | R2 | 62 | 58 | 248 | 8 | 3.23 | 4.3 | 5 | 407 | 6782 | 14345 | 203 | 509.9 |
| 2026-S46 | 2026-11-09 | 2026-11-15 | 2026-11-16 | R8 | 33 | 26 | 190 | 0 | 0.00 | 3.5 | 2 | 116 | 598 | 3760 | 64 | 108.1 |

Limites :

- À la semaine, le grain requête ne retient que 30 à 60 couples par rôle : il est trop maigre pour juger seul. **La colonne grain page est l'indicateur à suivre** ; le grain requête sert à voir quelles requêtes bougent.
- Le taux au rang 3 est une constante mesurée le 19 nov. ; il faut le recalculer chaque trimestre avec `sql/00` et `analyse_rangs.py`.

---

## Constats hors périmètre (signalés, non corrigés)

1. `/sitemap-vehicules.xml` répond 302 → /404 en PROD. L'index `sitemap.xml` servi ne liste que racine, categories, blog, pages, diagnostic, reference, brands et pieces-1..3. Aucune R8 n'est dans un sitemap.
2. Le cron `seo-audit` échoue depuis le 2026-11-16 03:00 avec « sitemap indisponible » (alerte de session).
3. `__seo_internal_link` et `__seo_index_history` sont vides (0 ligne). Il n'y a en base ni graphe de liens ni état d'indexation par URL.
4. Le grain requête `__seo_gsc_daily` ne nomme qu'environ 5 % des clics et 18 à 20 % des impressions des pages R2 et R8.
5. 19 R2 relevées sont servies en 200 `index, follow` alors qu'elles sont absentes de `__sitemap_p_link`.
6. La page NoProducts `/pieces/pompe-a-carburant-458/peugeot-128/2008-128006/1-2-puretech-76346.html` est en `noindex` **sans canonique**.
7. 64 titles R2 relevés sur 66 dépassent 60 caractères. Le title R2 affiche « à partir de X€ » calculé sur des tarifs pas à jour.
8. Le H1 R8 de CLIO I 1.2 indique « (Phase 2) … de 1996 à 1996 » alors que la requête cherche la phase 1 : la donnée de `auto_type` est à vérifier.
9. `crawl_budget_experiments` contient une ligne `exclude` en statut running, avec des données de référence d'apparence factice datées du 2025-10-27.
10. Le rang 1 brut du grain requête (1,2 % de CTR) est plus bas que les rangs 2 à 4. Cela confirme que des positions hautes sans clic (blocs spéciaux) existent aussi sur R2 et R8.

## Limites

- n = 20 + 20 (R2) et 5 + 10 (R8) : un écart de médiane est une corrélation.
- Le grain requête n'est qu'un échantillon (environ 5 % des clics).
- Le robots des pages sœurs est estimé, pas servi.
- Les liens entrants ne sont observés que dans les pages relevées ; ce n'est pas un graphe complet.
- Les années et le carburant des gabarits viennent de `auto_type` tels quels.

## Index des fichiers `data/`

| Fichier | Contenu |
|---|---|
| `rangs_4_15_90j.tsv`, `rangs_4_15_28j.tsv`, `rangs_4_15_avr-nov.tsv` | listes complètes retenues (6.1) |
| `divergents_*.tsv`, `un_appareil_*.tsv` | couples écartés (6.1) |
| `totaux_<fenêtre>_<gamme\|marque\|motif>.tsv` | totaux (6.1) |
| `courbe_ctr.tsv`, `courbe_ctr_page.tsv`, `courbe_ctr_brut.tsv`, `courbe_ctr_page_brut.tsv`, `resume.json`, `resume_grain_page.json` | courbes et effectifs |
| `pages_liste_grain_page_<fenêtre>.tsv` | pages de la liste au grain page |
| `echantillon_6_2.tsv`, `get_journal.tsv`, `urls_get*.txt`, `releve_prod_pages*.tsv`, `releve_prod_groupes.tsv`, `comparaison_6_2.tsv`, `lien_r8_vers_r2.tsv` | 6.2 |
| `mots_absents_*.tsv` | 6.3 |
| `soeurs_r2_brut.tsv`, `soeurs_r2_6_4.tsv`, `couverture_sitemap_r2.tsv` | 6.4 et hors périmètre |
| `pages_perdues_ak_reconstituees.tsv`, `croisement_ak_6_1.tsv` | 6.5 |
| `gabarits_r2_en_vigueur.tsv`, `vehicules_releves.tsv`, `gabarits_candidats_demo.tsv` | 6.6 |
| `ligne_hebdo_test.tsv` | 6.7 |
| `recoupe_point3*.tsv` | recoupement du point 3 |
| `heure_extraction_NN.txt` | heure UTC de chaque extraction SQL |
