# RAPPORT — MANDAT AK : pages pièces perdues (07) et revue des 9 skills SEO (23)

- Mandat : décision 18 de Marwane, transmis le 2026-11-15, session tmux `mandat-ak`.
- Worktree : `/home/deploy/worktrees/claude-mandat-ak-20261115`, branche
  `docs/mandat-ak-pieces-perdues-skills-seo-20261115`, base `origin/main`
  `9908188b380d6cf5f5d8c0b64db8544977818a13`. Vault lu en `501982d3be2c`, sans `cd`.
- Collecte : 2026-11-15, de 22:58Z à 23:19Z. Lecture seule partout. Base : pooler
  6543, `--single-transaction` et `set transaction read only`. PROD : GET simples,
  au plus un par seconde.
- Ce document est **proposé seulement**. Il ne corrige rien en base, en PROD ou sur
  le service DEV partagé. Il n'applique aucune fusion ni aucun retrait de skill.

---

## 0. Résumé

1. **Ce qui est établi.** Les 1 269 pages /pieces/ cliquées en juillet et sans clic
   en octobre sont presque toutes des pages R2 (gamme × véhicule) : 1 258 sur 1 269.
   1 131 n'avaient qu'**un seul clic** en juillet. Il s'agit d'un renouvellement de
   longue traîne, pas de la chute de quelques pages fortes. Ce qui change entre
   juillet et octobre, c'est la **visibilité** du gabarit R2 :
   - impressions hebdomadaires : de 25 295 à 12 688 (−50 %) ;
   - pages R2 vues en SERP : de 10 761 à 6 387 (−41 %) ;
   - sur les 7 102 pages R2 présentes les deux mois, la position pondérée passe de
     11,5 à 13,3 ;
   - moins de pages nouvelles gagnent un clic : 719 de juillet à octobre, contre
     1 200 de juin à juillet.
2. **Ce qui est écarté côté serveur.** Les 30 pages de l'échantillon et les 2 témoins
   répondent 200, en `index, follow`, avec une canonique auto-référente et un H1
   unique. Aucun changement d'URL ou de route R2 dans la fenêtre. L'invariant massdoc
   `type_id` est intact. Aucun commit ne touche la canonique ou le robots de R2 avant
   le 09-29 (#1587/#1595), alors que le déclin commence fin juillet ou mi-août.
3. **Ce qui reste non vérifiable sans la GSC.** La désindexation des 691 pages
   perdues qui n'ont plus aucune impression en octobre. La part de « Google a choisi
   une autre canonique » parmi des pages R2 sœurs très proches (Jaccard médian 0,50).
   L'effet des spam updates d'août (18–21) et de septembre (à partir du 24). La
   saisonnalité (compresseur de climatisation : −90 % d'impressions). Les éventuels
   503 servis à Googlebot après #1587 (09-29). Les gestes GSC précis sont en §3.
4. **Skills.** Sur les 9 : garder et améliorer 3, améliorer 1, améliorer ou
   fusionner 1, retirer 4. Les retraits et la fusion sont seulement proposés.
   seo-content-architect et content-quality-gate restent cités par des références
   vivantes (§2.3) : leur retrait n'est pas applicable aujourd'hui. Le patch du registre
   des skills touche un producteur réservé à l'owner : il est préparé et testé à
   part, **non appliqué** (§2.4).

---

## 1. Diagnostic sourcé

### 1.a Pages perdues : liste, répartition, échantillon

Source : `__seo_gsc_daily_page_totals`, chemin normalisé (hôte retiré). Critère :
au moins un clic du 2026-07-01 au 2026-07-31 et 0 clic du 2026-10-01 au 2026-10-31.

| Mesure | Valeur |
|---|---|
| Pages perdues | **1 269** : 1 258 R2 `/pieces/{gamme}/{marque}/{modele}/{type}.html`, 5 R1 `/pieces/{alias}-{id}.html`, 6 autres |
| Gammes touchées | 126 (hors ligne de total) |
| Clics de juillet perdus avec elles | 1 473 ; impressions de juillet : 15 560 ; impressions d'octobre : 5 373 |
| Pages à 1 seul clic en juillet | 1 131 sur 1 269 (89 %) |
| Pages sans aucune impression en octobre | 691 (54 %) |
| Point de départ du mandat (pages cliquées / clics) | juillet 1 413 / 1 793 ; octobre 863 / 1 034 |

Renouvellement mensuel des pages /pieces/ cliquées (Q3) :

| Mois A → B | Cliquées A | Cliquées B | Perdues | Perdues sans impression en B | Gagnées |
|---|---|---|---|---|---|
| 06 → 07 | 1 269 | 1 413 | 1 056 | 316 | 1 200 |
| 07 → 08 | 1 413 | 1 321 | 1 192 | 423 | 1 100 |
| 08 → 09 | 1 321 | 1 035 | 1 154 | 609 | 868 |
| 09 → 10 | 1 035 | 863 | 921 | 469 | 749 |
| 07 → 10 | 1 413 | 863 | 1 269 | 691 | 719 |

Lecture : le site perd chaque mois autant de pages cliquées qu'il en gagne (≈ 1 000
à 1 200). Le déclin vient surtout de la baisse des pages gagnées (1 200 → 749) et de
la hausse des pages perdues sans impression (316 → 609). Des pages cessent d'être
montrées.

Gammes les plus touchées en nombre de pages perdues : courroie-d-accessoire-10
(117), compresseur-de-climatisation-447 (70), cardan-13 (49), thermostat-316 (47),
filtre-a-huile-7 (39), amortisseur-854 (35), bougie-d-allumage-686 (28),
alternateur-4 (28), ventilateur-de-refroidissement-508 (25),
sonde-de-refroidissement-830 (25). La liste complète des 1 269 lignes reste dans le
scratchpad de session (`out/q1_lost_pages.tsv`). Elle n'est pas versionnée parce
qu'elle reproduit des données GSC brutes.

R2 par gamme, juillet contre octobre, top 15 des pertes d'impressions (Q6a) :

| Gamme | Impr. juil. | Impr. oct. | Δ impr. | Clics juil. | Clics oct. | Pages vues juil. | Pages vues oct. | Pos. juil. | Pos. oct. |
|---|---|---|---|---|---|---|---|---|---|
| courroie-d-accessoire-10 | 12286 | 5483 | -55 % | 282 | 127 | 1518 | 909 | 8.4 | 8.7 |
| compresseur-de-climatisation-447 | 4837 | 497 | -90 % | 139 | 6 | 601 | 182 | 8.8 | 14.9 |
| filtre-a-huile-7 | 4802 | 2202 | -54 % | 61 | 28 | 920 | 637 | 8.7 | 9.1 |
| filtre-d-habitacle-424 | 1977 | 414 | -79 % | 20 | 4 | 412 | 179 | 11.7 | 23.5 |
| sonde-de-refroidissement-830 | 1635 | 304 | -81 % | 36 | 5 | 322 | 110 | 8.3 | 10.0 |
| galet-tendeur-de-courroie-d-accessoire-310 | 2702 | 1382 | -49 % | 26 | 18 | 585 | 399 | 10.7 | 12.4 |
| plaquette-de-frein-402 | 1870 | 792 | -58 % | 16 | 14 | 549 | 334 | 18.0 | 19.1 |
| demarreur-2 | 1586 | 515 | -68 % | 14 | 9 | 438 | 235 | 11.4 | 16.9 |
| amortisseur-854 | 1822 | 782 | -57 % | 39 | 12 | 660 | 370 | 11.0 | 10.7 |
| alternateur-4 | 2367 | 1396 | -41 % | 31 | 23 | 608 | 463 | 11.9 | 14.8 |
| cardan-13 | 2409 | 1546 | -36 % | 64 | 34 | 704 | 593 | 12.9 | 12.5 |
| disque-de-frein-82 | 1342 | 522 | -61 % | 14 | 10 | 383 | 255 | 19.6 | 16.3 |
| kit-de-distribution-307 | 1730 | 931 | -46 % | 11 | 4 | 372 | 283 | 18.9 | 26.6 |
| emetteur-d-embrayage-234 | 2040 | 1281 | -37 % | 39 | 35 | 392 | 318 | 9.2 | 8.3 |
| soufflet-de-cardan-193 | 1317 | 565 | -57 % | 12 | 9 | 480 | 305 | 9.9 | 11.0 |

**Échantillon de 30.** Tirage `random.Random(20261115).sample(rows, 30)` sur les
1 269 lignes triées par chemin, graine écrite **20261115**. Résultat : 30 R2,
16 pages encore vues en octobre, 14 sans impression, 37 clics en juillet.
**Témoins** : K1 (#31) et K2 (#32), deux pages R2 cliquées en juillet **et** en
octobre (Q4), de mêmes gammes que des pages de l'échantillon (#01 et #12).

### 1.b Contrôle HTTP, canonique, robots, sitemap et contenu servi

GET simples sur `https://www.automecanik.com` + chemin, de 2026-11-15T23:02:07Z à
23:03:05Z, une requête toutes les 1,8 s environ. User-Agent
`Mozilla/5.0 (compatible; audit-lecture-seule)`. Sitemap : index
`https://www.automecanik.com/sitemap.xml` et fichiers `pieces-1..3` récupérés le
même soir, soit 101 097 URL R2 (après le v10 #1966 du 11-14 ; 102 395 entre le
06-08 et le 11-09). Robots : `https://www.automecanik.com/robots.txt`.

| # | Rôle | Chemin (https://www.automecanik.com + chemin) | Clics juil. | Impr. juil. | Pos. juil. | Impr. oct. | HTTP | robots | Canonique = soi | H1 | Octets | Sitemap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | échantillon | `/pieces/emetteur-d-embrayage-234/peugeot-128/207-128018/1-6-16v-vti-22681.html` | 1 | 12 | 8.1 | 21 | 200 | index, follow | oui | 1 | 237123 | non |
| 02 | échantillon | `/pieces/amortisseur-854/peugeot-128/406-128054/2-0-turbo-5627.html` | 1 | 2 | 2.0 | 0 | 200 | index, follow | oui | 1 | 381601 | oui |
| 03 | échantillon | `/pieces/pompe-de-direction-assistee-12/volkswagen-173/lt-28-35-ii-173067/2-8-tdi-23856.html` | 1 | 8 | 11.7 | 1 | 200 | index, follow | oui | 1 | 199593 | non |
| 04 | échantillon | `/pieces/ventilateur-de-refroidissement-508/chevrolet-44/captiva-44046/2-2-d-4wd-8513.html` | 1 | 9 | 10.7 | 1 | 200 | index, follow | oui | 1 | 186305 | non |
| 05 | échantillon | `/pieces/compresseur-de-climatisation-447/peugeot-128/307-128035/1-6-13002.html` | 2 | 42 | 10.7 | 1 | 200 | index, follow | oui | 1 | 257481 | non |
| 06 | échantillon | `/pieces/filtre-a-huile-7/renault-140/symbol-i-140092/1-6-21562.html` | 1 | 21 | 6.8 | 11 | 200 | index, follow | oui | 1 | 246873 | non |
| 07 | échantillon | `/pieces/condenseur-de-climatisation-448/ford-60/fiesta-v-60073/1-25-16v-17703.html` | 1 | 3 | 9.0 | 0 | 200 | index, follow | oui | 1 | 210606 | non |
| 08 | échantillon | `/pieces/pompe-a-carburant-458/kia-88/cerato-iii-88093/1-6-57670.html` | 1 | 7 | 8.3 | 0 | 200 | index, follow | oui | 1 | 204422 | non |
| 09 | échantillon | `/pieces/corps-papillon-158/mercedes-benz-108/classe-b-w246-108036/b-200-cdi-73063.html` | 1 | 5 | 23.4 | 0 | 200 | index, follow | oui | 1 | 205958 | non |
| 10 | échantillon | `/pieces/cable-de-frein-a-main-124/volkswagen-173/touran-i-173141/1-9-tdi-18700.html` | 1 | 2 | 19.0 | 5 | 200 | index, follow | oui | 1 | 294233 | non |
| 11 | échantillon | `/pieces/bobine-d-allumage-689/mitsubishi-114/l-200-iv-114065/2-4-12189.html` | 1 | 1 | 27.0 | 0 | 200 | index, follow | oui | 1 | 157079 | non |
| 12 | échantillon | `/pieces/courroie-d-accessoire-10/renault-140/megane-ii-140046/1-4-16v-17719.html` | 3 | 12 | 5.9 | 11 | 200 | index, follow | oui | 1 | 448154 | oui |
| 13 | échantillon | `/pieces/roulement-de-roue-655/mercedes-benz-108/classe-e-w212-108050/e-200-2-0-29269.html` | 1 | 9 | 6.6 | 0 | 200 | index, follow | oui | 1 | 263372 | non |
| 14 | échantillon | `/pieces/contacteur-de-feu-de-recul-807/renault-140/symbol-i-140092/1-5-dci-19677.html` | 1 | 3 | 15.7 | 21 | 200 | index, follow | oui | 1 | 289373 | non |
| 15 | échantillon | `/pieces/compresseur-de-climatisation-447/ds-441/ds-3-441000/1-6-bluehdi-83334.html` | 1 | 1 | 45.0 | 0 | 200 | index, follow | oui | 1 | 286066 | non |
| 16 | échantillon | `/pieces/butee-d-embrayage-48/ford-60/fiesta-v-60073/1-4-tdci-16102.html` | 2 | 19 | 9.0 | 9 | 200 | index, follow | oui | 1 | 290626 | oui |
| 17 | échantillon | `/pieces/sonde-lambda-3922/renault-140/megane-ii-140046/1-6-16v-16917.html` | 2 | 12 | 6.0 | 14 | 200 | index, follow | oui | 1 | 326001 | non |
| 18 | échantillon | `/pieces/pressostat-d-huile-805/peugeot-128/5008-128061/2-0-hdi-31739.html` | 1 | 2 | 8.0 | 1 | 200 | index, follow | oui | 1 | 231376 | non |
| 19 | échantillon | `/pieces/compresseur-de-climatisation-447/peugeot-128/207-128018/1-6-hdi-33260.html` | 2 | 244 | 9.3 | 4 | 200 | index, follow | oui | 1 | 297288 | non |
| 20 | échantillon | `/pieces/rotule-de-suspension-2462/peugeot-128/208-128021/1-4-hdi-8684.html` | 1 | 1 | 30.0 | 0 | 200 | index, follow | oui | 1 | 369142 | oui |
| 21 | échantillon | `/pieces/filtre-a-huile-7/bmw-33/m3-g80-103137/3-0-i-competition-62909.html` | 2 | 2 | 7.5 | 0 | 200 | index, follow | oui | 1 | 183990 | non |
| 22 | échantillon | `/pieces/filtre-a-huile-7/hyundai-76/i40-76049/1-7-crdi-55575.html` | 1 | 17 | 9.1 | 0 | 200 | index, follow | oui | 1 | 244968 | non |
| 23 | échantillon | `/pieces/catalyseur-429/renault-140/clio-iii-140004/1-5-dci-19052.html` | 1 | 8 | 23.9 | 11 | 200 | index, follow | oui | 1 | 190478 | non |
| 24 | échantillon | `/pieces/flexible-de-frein-83/mercedes-benz-108/classe-c-w204-108039/350-cgi-30371.html` | 1 | 2 | 7.5 | 0 | 200 | index, follow | oui | 1 | 310196 | non |
| 25 | échantillon | `/pieces/pompe-a-eau-1260/mini-113/mini-r50-r53-113001/1-6-cooper-s-16600.html` | 1 | 4 | 19.5 | 1 | 200 | index, follow | oui | 1 | 218774 | non |
| 26 | échantillon | `/pieces/galet-enrouleur-de-courroie-d-accessoire-312/renault-140/kangoo-i-express-140022/1-5-dci-19218.html` | 1 | 1 | 9.0 | 0 | 200 | index, follow | oui | 1 | 230415 | non |
| 27 | échantillon | `/pieces/condenseur-de-climatisation-448/citroen-46/c5-ii-46036/2-0-16v-18454.html` | 1 | 5 | 11.4 | 0 | 200 | index, follow | oui | 1 | 207608 | non |
| 28 | échantillon | `/pieces/sonde-lambda-3922/renault-140/symbol-i-140092/1-2-16v-19676.html` | 1 | 33 | 5.9 | 7 | 200 | index, follow | oui | 1 | 320456 | non |
| 29 | échantillon | `/pieces/bobine-d-allumage-689/fiat-58/palio-i-58053/1-6-16v-20572.html` | 1 | 7 | 5.1 | 1 | 200 | index, follow | oui | 1 | 180176 | non |
| 30 | échantillon | `/pieces/ventilateur-de-refroidissement-508/mercedes-benz-108/classe-e-w211-108049/e-220-cdi-2-3-0-11236.html` | 1 | 4 | 7.8 | 0 | 200 | index, follow | oui | 1 | 183875 | non |
| 31 | témoin | `/pieces/emetteur-d-embrayage-234/peugeot-128/406-128054/2-1-td-12v-5354.html` | 11 | — | — | 277 (25 clics) | 200 | index, follow | oui | 1 | 155391 | non |
| 32 | témoin | `/pieces/courroie-d-accessoire-10/renault-140/symbol-i-140092/1-4-16553.html` | 5 | — | — | 160 (5 clics) | 200 | index, follow | oui | 1 | 418581 | oui |

Contenu servi : aucun `X-Robots-Tag` et pas de `noindex` sur les 32 pages.
30 pages servent un JSON-LD avec Product, Offer, AggregateOffer, ItemList,
CollectionPage et BreadcrumbList. **2 pages servent l'état sans liste de produits** :
ni Product, ni ItemList, ni Offer, aucun prix dans le `<title>`, 155 à 157 Ko.
Ce sont #11 (`bobine-d-allumage-689/…/l-200-iv-114065/2-4-12189`, perdue) et le
témoin K1 (#31, 25 clics en octobre). Ce critère touche donc une page perdue et une
page gardée : il ne les départage pas. L'échantillon et les témoins ne se
distinguent sur aucun des critères mesurés.

Similarité du contenu servi, par shingles de 5 mots (Jaccard) entre les 32 pages :

| Paire | Nombre | Min | Médiane | Max |
|---|---|---|---|---|
| Même gamme, véhicule différent | 12 | 0,39 | 0,50 | 0,61 |
| Même modèle, gamme différente | 10 | 0,23 | 0,26 | 0,29 |
| Ni gamme ni modèle commun | 474 | 0,13 | 0,22 | 0,38 |

Présence dans le sitemap actuel, toutes pages R2 confondues (croisement
de Q5 avec `r2_paths.txt`, 2026-11-15T23:19:38Z) :

| Ensemble R2 | Pages | Dans le sitemap |
|---|---|---|
| Perdues (clic en juillet, 0 en octobre) | 1 258 | 239 (19,0 %) |
| Gardées (clic en juillet et en octobre) | 134 | 48 (35,8 %) |
| Nouvelles (0 en juillet, clic en octobre) | 705 | 101 (14,3 %) |
| Vues en juillet | 27 574 | 4 402 (16,0 %) |
| Vues en octobre | 20 043 | 2 585 (12,9 %) |

Lecture : le sitemap ne couvre qu'une minorité des pages R2 que Google montre.
Google découvre la plupart d'entre elles par les liens. Les pages gardées y sont un
peu plus souvent (36 % contre 19 %), mais K1, gardée, n'y est pas. Le volume du
sitemap n'a pas changé de juin au 11-09 : le sitemap ne date pas le déclin.

### 1.c Datation semaine par semaine, croisée avec Git

Q2 : semaines ISO commençant le lundi. Données GSC jusqu'au 2026-11-12 (semaine du
11-09 incomplète : 4 jours).

| Semaine (lundi) | Jours | Clics R2 | Impressions R2 | Pages R2 avec impression | Pages R2 cliquées | Position pondérée R2 | Clics R1 | Position R1 |
|---|---|---|---|---|---|---|---|---|
| 2026-06-01 | 7 | 296 | 15370 | 5699 | 262 | 10.6 | 6 | 20.4 |
| 2026-06-08 | 7 | 337 | 17072 | 6789 | 300 | 11.0 | 7 | 19.5 |
| 2026-06-15 | 7 | 399 | 21076 | 8588 | 359 | 10.3 | 7 | 20.6 |
| 2026-06-22 | 7 | 427 | 23469 | 9863 | 382 | 10.7 | 6 | 20.7 |
| 2026-06-29 | 7 | 392 | 24166 | 10222 | 355 | 10.9 | 6 | 22.4 |
| 2026-07-06 | 7 | 435 | 25295 | 10761 | 382 | 11.7 | 10 | 22.0 |
| 2026-07-13 | 7 | 388 | 22161 | 9899 | 345 | 11.1 | 5 | 22.2 |
| 2026-07-20 | 7 | 394 | 22603 | 10162 | 353 | 11.2 | 6 | 26.8 |
| 2026-07-27 | 7 | 370 | 22991 | 9940 | 323 | 13.6 | 5 | 45.2 |
| 2026-08-03 | 7 | 394 | 24043 | 10456 | 351 | 13.6 | 3 | 44.8 |
| 2026-08-10 | 7 | 373 | 21895 | 10302 | 334 | 12.9 | 11 | 41.8 |
| 2026-08-17 | 7 | 362 | 20889 | 10132 | 331 | 13.1 | 4 | 42.8 |
| 2026-08-24 | 7 | 325 | 18941 | 9277 | 296 | 14.7 | 6 | 48.8 |
| 2026-08-31 | 7 | 302 | 17247 | 8485 | 282 | 13.8 | 6 | 48.4 |
| 2026-09-07 | 7 | 302 | 16654 | 8265 | 272 | 12.1 | 6 | 42.9 |
| 2026-09-14 | 7 | 269 | 14739 | 7572 | 248 | 11.6 | 6 | 37.2 |
| 2026-09-21 | 7 | 266 | 14387 | 7501 | 248 | 12.0 | 7 | 37.8 |
| 2026-09-28 | 7 | 227 | 13838 | 7222 | 210 | 13.7 | 6 | 41.5 |
| 2026-10-05 | 7 | 222 | 12688 | 6387 | 211 | 12.9 | 16 | 41.1 |
| 2026-10-12 | 7 | 179 | 13112 | 6287 | 171 | 12.7 | 7 | 41.2 |
| 2026-10-19 | 7 | 264 | 13729 | 6541 | 235 | 13.0 | 11 | 40.8 |
| 2026-10-26 | 7 | 224 | 14384 | 6941 | 200 | 13.0 | 14 | 40.4 |
| 2026-11-02 | 7 | 227 | 16225 | 7702 | 208 | 13.5 | 13 | 42.8 |
| 2026-11-09 | 4 | 151 | 10615 | 5844 | 142 | 14.4 | 9 | 39.8 |

Repères :
- **Semaine du 07-27** : première dégradation de position (11,2 → 13,6), sans
  baisse d'impressions.
- **Du 08-17 au 08-24** : les impressions passent de 20 889 à 18 941, puis la baisse
  continue. Google a publié une spam update d'août du 18 au 21 (§1.e).
- **Du 09-14 au 10-12** : palier bas (12 688 à 14 739). Spam update de septembre à
  partir du 24.
- **Semaine du 10-12** : point bas des clics (179).
- **À partir du 10-19** : reprise partielle (16 225 impressions le 11-02).

Historique Git (`git log --since=2026-07-01 --until=2026-11-12` sur
`frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`,
`pieces.$slug.tsx`, `pieces.$.tsx` et les utilitaires `pieces-*`) :

| Commit | Date | Objet | Lien avec le déclin |
|---|---|---|---|
| #1200 | 07-01 | route pièces | antérieur ; aucune URL ni canonique modifiée |
| #1261 | 07-14 | route pièces | idem |
| #1332 | 08-06 | INP | performance seulement |
| #1467 | 09-12 | marqueurs | contenu ; postérieur au début du déclin |
| #1587 `f54aa333f9` | 09-29 | « fiabiliser R2/R8 », nettoyage des 301 R2 ; une erreur catalogue renvoie **503** | postérieur ; peut avoir servi des 503 à Googlebot jusqu'à #1595 |
| #1595 `8af057ca15` | 09-29 | un 404 catalogue ne devient plus 503 (200 + `noindex, follow`, politique « 0 produit ») | correction de #1587 |
| #1728 | 10-04 | route pièces | postérieur |
| #1750 `c2dfa0699c` | 10-10 | 410 des anciens `/pieces-{marque}.html` (catch-all `$.tsx`) | ne touche pas R2 |

`git log -G 'canonical'` et `git log -G 'noindex|robots'` sur ces fichiers, du
07-01 au 10-31 : seuls #1587 et #1595 apparaissent, tous deux le 09-29. **Aucun
commit ne précède le déclin et ne touche la canonique, le robots ou l'URL de R2.**
Hook : `git tag -l 'v*'` est refusé par `pretool-bash-guard` (« tag v* = déclencheur
deploy PROD »). Ce rapport ne date donc pas les mises en PROD par tag, seulement les
fusions.

### 1.d web-vitals-audit : 2 pages de l'échantillon et 1 témoin

Le skill `.claude/skills/web-vitals-audit` compte 7 checks. Ont été exécutés ceux
qui ne demandent ni navigateur ni écriture :

| Check | Exécution | Résultat |
|---|---|---|
| `cwv-beacon-ingestion-gap` (RUM brut par URL) | Q8, 2026-11-15T23:18:55Z | `__seo_cwv_raw` couvre 2026-11-13 → 11-15 (TTL ≈ 48 h ; 15 390 balises dont **9** R2). #05 et #12 : 0 balise. K2 (#32) : 1 balise mobile du 11-14 : LCP 2 588 ms, FCP 2 588, TTFB 386, CLS 0 |
| `cwv-aggregation-coverage-gap` (agrégat par route) | 23:08:22Z | `__seo_cwv_daily_rum`, `route_group='pieces_gamme_vehicle'` : LCP desktop p75 juil. 1 997 ms (n = 1 137), août 2 056 (n = 98), sept. 486 (n = 13), oct. 2 458 (n = 7). Mobile : n ≤ 2 par mois |
| Labo PageSpeed `__seo_cwv_daily` | Q8 | **0 ligne** dans toute la table |
| `content-visibility-gap` (statique) | 23:19:02Z | R2 rendu par `PiecesVehicleContent.tsx` : 5 occurrences de `content-visibility`/`cv-auto` ; conforme |
| `inp-*`, `lcp-route-hydration`, `cls-shifted-blocks` | non exécutés | demandent une sonde labo (`references/lab-probe-protocol.md`), absente de ce mandat en lecture seule |

Verdict CWV : **aucune dégradation mesurée au niveau de la route R2** entre juillet
et octobre. Le LCP desktop de juillet reste sous 2,5 s. **Non vérifiable page par
page** : le RUM brut expire au bout de 48 h, la table labo est vide et les
échantillons R2 sont minuscules après juillet.

### 1.e Hypothèses classées

| Hypothèse | Classement | Preuve |
|---|---|---|
| Changement de route ou d'URL | **écartée** | 32/32 répondent 200 sur l'URL historique ; aucun commit de route ou d'URL R2 avant le 09-29 ; invariant massdoc OK (runtime-truth-audit, §2) |
| Canonique | **écartée côté serveur** | 32/32 canoniques auto-référentes ; aucun commit canonique avant le 09-29. La canonique *choisie par Google* relève de la GSC (§3) |
| Robots / noindex | **écartée côté serveur** | 32/32 en `index, follow`, sans `X-Robots-Tag` ; robots.txt ne bloque pas /pieces/ |
| Sitemap | **écartée comme déclencheur** | volume constant (102 395 URL) du 06-08 au 11-09 ; 81 % des pages perdues et 64 % des gardées étaient déjà hors sitemap. Facteur aggravant possible, non prouvé |
| Désindexation | **non vérifiable ici** | 691 des 1 269 pages n'ont aucune impression en octobre et le nombre de pages R2 vues baisse de 41 %, ce qui concorde avec une sortie d'index. Seule la GSC peut le dire |
| Contenu dupliqué (pages R2 sœurs) | **non vérifiable ici** ; aggravant structurel plausible | Jaccard médian de 0,50 entre R2 d'une même gamme, contre 0,22 entre pages sans rapport. Le gabarit n'a pas changé dans la fenêtre : il ne date pas le déclin. À confirmer par « Google a choisi une autre canonique » ou « Détectée/Explorée, non indexée » |
| Vitesse (CWV) | **écartée au niveau route**, non vérifiable par page | §1.d |
| Concurrence ou algorithme (spam updates d'août et septembre 2026) | **non vérifiable** | position pondérée des pages stables de 11,5 à 13,3 ; la chronologie coïncide avec les spam updates d'août (18–21) et de septembre (à partir du 24). Aucune core update confirmée en août ou septembre |
| Saisonnalité de la demande (ajoutée) | **non vérifiable ici** | compresseur-de-climatisation-447 : −90 % d'impressions, position de 8,8 à 14,9 ; filtre-d-habitacle-424 : −79 %. À contrôler dans la GSC par requêtes (§3) |
| Erreurs 503 servies à Googlebot après #1587 | **non vérifiable ici** | fenêtre du 09-29 jusqu'au déploiement de #1595. Le palier bas des impressions commence avant (09-14) : cause possible du creux du 10-12, pas du déclin |

Sources des mises à jour Google, relevées le 2026-11-15 :
- searchenginejournal.com/google-september-2026-spam-update/ ;
- seroundtable.com/google-september-2026-spam-update-42163.html ;
- seroundtable.com/recap-08-27-2026-41901.html ;
- seo-kreativ.de/blog/google-spam-update-august-2026/ (spam update d'août : 2 j 16 h) ;
- relevantaudience.com/seo/google-august-2026-spam-update/.

Une source parle d'une « August 2026 Core Algorithm Update » sans donner de date ;
les autres décrivent une spam update. La référence primaire reste le Search Status
Dashboard, à consulter par Marwane (§3).

---

## 2. Verdicts sur les 9 skills SEO (et 2 skills d'appui)

Les 9 skills sont dans `workspaces/seo-batch/.claude/skills/`. Références vivantes :
`git grep -l -F '<nom>' HEAD`, hors du dossier du skill, à la base `9908188b`.

### 2.1 Tableau

| Skill | Ce qu'il fait (SKILL.md) | Utilité pour ce cas | Essai réel (lecture seule) | Réf. vivantes | Recouvrements | Défauts | Verdict | Changement proposé |
|---|---|---|---|---|---|---|---|---|
| **seo-content-loop** | Méthode canonique scraping → RAW → WIKI → consommateur → mesure → itération ; NO-RAG ; renvoie au canon du vault | Moyenne : ses axes ③ (rendu) et ④ (GSC/GA4) ont structuré le §1 | Méthode appliquée au §1 ; aucun mode exécutable : l'argument `status` est annoncé mais pas implémenté dans le corps | 42 | Point d'entrée ; les audits sont ses outils | Argument `status` fictif ; axe ④ sans outillage ; l.155 : « aucune invocation Skill tracée depuis 2026-10-03 » | **Garder, améliorer** | Implémenter `status` ou retirer l'argument ; pointer vers une requête GSC type (Q1/Q2) |
| **seo-gamme-audit** | Audit gamme ou véhicule en lecture seule : WIKI → export → projection → rendu, catalogue, liens, anti-duplicate | Moyenne | Lancé sur pg 10 (`courroie-d-accessoire`, 23:08Z) : agrégats OK (51 893 produits, 5 809 véhicules, INDEX), R2 v2 = 0 page, QPS figés au 2026-06-11, 11 502 liens sitemap | 17 | content-audit (rendu), r8-diversity-check (duplicate) | `--history` lit `__seo_audit_history` (v3), pas la GSC ; aucun regard par type de page | **Garder, améliorer** | Ajouter un mode historique GSC par type de page (Q2) ; absorber la partie rendu de content-audit |
| **content-audit** | Audit R2D2 Intent/Evidence/Decision par rôle R1–R6, score sur 6 | Faible | Lancé (méthode par grep statique sur la route R2) : mappe R2 sur « Product (fiche produit) », alors que la page sert Product + CollectionPage + ItemList | 16 (dont `backend/scripts/seo-content-audit.js`, module seo-monitoring) | seo-gamme-audit | Ne connaît ni R7 ni R8 ; méthode par grep statique ; cite `/seo-content-architect` (l.29, 389, 391) ; pas de « Use when » | **Améliorer ou fusionner** dans seo-gamme-audit | Fusion proposée (AI6) ; à défaut : retirer les renvois à seo-content-architect et lire la page servie |
| **r8-diversity-check** | Mesure la diversité des empreintes entre pages R8 sœurs | Indirecte (le duplicate R2 a été mesuré par shingles) | Lancé sur le modèle 140092 (aucune page R8) puis sur 140004 : sortie obtenue | 7 | seo-gamme-audit (anti-duplicate) | Lit `.env` et ouvre un DSN direct, sans garde lecture seule | **Garder, améliorer** | Passer par le pooler en lecture seule, sans lire `.env` ; étendre à R2 |
| **keyword-planner** (`name: kp`) | Plan de mots-clés par gamme ou véhicule pour tous les rôles R | Nulle | **Non lancé.** Lit le RAG `/opt/automecanik/rag/knowledge/gammes/{alias}.md` comme source de contenu (mode `RAG_ONLY` par défaut) et fait un `POST /api/admin/agentic/runs` (écriture) | 55 (dont `agents/cmo/AGENTS.md`, `ci.yml`, `.spec/00-canon`) | kw-classify | Contredit l'invariant 4 et ADR-031/046 ; SQL cassé (`rkp_pg_id`/`rkp_status` au lieu de `skp_pg_id`/`skp_status`) ; derniers produits : R3 le 2026-04-11, R6 le 2026-04-08 ; `name` différent du dossier | **Retirer**, ou re-sourcer WIKI dans un mandat dédié | Décision AI6 ; références à traiter d'abord |
| **kw-classify** | Classe les mots-clés Google Ads KP par rôle et écrit `__seo_keyword_results` | Nulle | **Non lancé** (écrit en base) ; jugé sur pièces | 5 (`tables-seo.md`, `keyword-research-batches.md`, `import-gads-kp.py`…) | keyword-planner | UPSERT `ON CONFLICT … source = EXCLUDED.source` qui écrase la provenance ; SQL par interpolation `'{pg_alias}'` ; lecture obligatoire du RAG ; `redis-cli DEL kw-results:{pg_id}:*` mort (DEL n'accepte pas de motif, aucune clé `kw-results:` dans le backend) ; outil `mcp__supabase__execute_sql` en 401 ; dernière écriture google-ads-kp : 2026-05-21 | **Améliorer** (ou retirer, décision AI6) | Dry-run par défaut ; préserver la provenance ; requêtes paramétrées ; retirer RAG et DEL |
| **seo-vault-verify** | Audit reproductible d'un vault Obsidian SEO (ZIP) : regénération, SHA-256, renvois ADR | Nulle (hors sujet site) | `python3 -I scripts/selftest.py` (23:13:43Z), exit 0 : 2 cas OK, 4 en SKIP, donc 2 sur 6 réellement exécutés ; worktree propre ensuite | specs et rapports d'avril seulement | aucun | Hors périmètre du SEO du site ; selftest à 4/6 en SKIP | **Retirer** (ou sortir du pack SEO) | Décision AI6 |
| **seo-content-architect** | Neutralisé le 2026-07-02 (PR-C) : corps retiré, renvoie à `/seo-content-loop` | Nulle | Rien à lancer | 18 fichiers (§2.3) | seo-content-loop | Le backend lit `.claude/skills/seo-content-architect/data/forbidden.csv`, inexistant | **Retirer** quand les références seront traitées | §2.3 |
| **content-quality-gate** | Marqué `[DEPRECATED → /v5-guardian]` ; gate de `__seo_gamme_conseil` | Nulle | Rien à lancer | 5 fichiers (§2.3) | v5-guardian | Cite seo-content-architect ; outil MCP en 401 | **Retirer** quand les références seront traitées | §2.3 |
| *web-vitals-audit* (appui) | Cause racine INP/LCP/CLS, 7 checks | Directe (point 1.d) | 4 checks sur 7 (§1.d) | `.claude/skills` | aucun | Ne signale pas que la table labo `__seo_cwv_daily` est vide ; pas de vue par URL au-delà de 48 h | **Garder, améliorer** | Faire signaler une table labo vide par le check d'agrégation |
| *runtime-truth-audit* (appui) | 9 checks de dérive runtime | Directe pour 1 check | `massdoc-typeid-invariant` (23:12:27Z) : A = 0, B = 0, C = 0, `seq_last` 83 457, `max_id` 83 456, 53 959 types : **OK** | `.claude/skills` | aucun | Les 8 autres checks sont hors SEO | **Garder** | — |

Décompte des 9 :
- garder et améliorer 3 : seo-content-loop, seo-gamme-audit, r8-diversity-check ;
- améliorer 1 : kw-classify ;
- améliorer ou fusionner 1 : content-audit ;
- retirer 4 : keyword-planner, seo-vault-verify, seo-content-architect,
  content-quality-gate. **Chaque fusion ou retrait attend une
décision AI6 écrite et datée de Marwane** (`rules-ai-cos.md`, AI6).

### 2.2 Usage réel en base

Q `skill_usage`, 2026-11-15T23:14:00Z et 23:14:06Z : `__seo_keyword_results` par
source.

| Source | Lignes | Gammes | Dates |
|---|---|---|---|
| google-ads-kp | 6 947 | 17 | 2026-05-21 seulement |
| keyword-engine | 2 830 | 2 | 2026-04-21 |
| kp-r3-batch-phase5 | 1 022 | 59 | 2026-03-29 |
| claude_chrome | 119 | 3 | 2026-03-22 → 03-26 |

Derniers plans issus de `/kp` : R3 le 2026-04-11 (260), R6 le 2026-04-08 (241). Ni
kw-classify ni kp n'ont rien produit depuis plus de 5 mois.

### 2.3 Retraits bloqués : références vivantes (git grep)

Commandes lancées à 2026-11-15T23:19:13Z sur HEAD `9908188b380d6cf5f5d8c0b64db8544977818a13` :

```text
== git grep -l -F 'seo-content-architect' HEAD -- . ':!workspaces/seo-batch/.claude/skills/seo-content-architect'
.claude/skills/db-migration/SKILL.md
.claude/skills/vehicle-ops/SKILL.md
.spec/00-canon/db-governance/role-implementation-map.md
.spec/00-canon/gamme-md-schema.md
.spec/AUDIT-SEO-GLOBAL-2026-02.md
.spec/workflows/ai-cos-business-squad.md
audit/seo-content-circuit-2026-11-15.md
backend/src/config/phase2a-shadow-audit.constants.ts
backend/src/modules/rag-proxy/services/rag-phase2a-shadow-audit.service.ts
backend/src/modules/seo/constants/seo-templates.constants.ts
backend/src/modules/seo/validation/quality-validator.service.ts
docs/specs/2026-04-24-seo-vault-verify-design.md
workspaces/seo-batch/.claude/agents/brief-enricher.md
workspaces/seo-batch/.claude/agents/research-agent.md
workspaces/seo-batch/.claude/skills/content-audit/SKILL.md
workspaces/seo-batch/.claude/skills/content-gen/SKILL.md
workspaces/seo-batch/.claude/skills/content-quality-gate/SKILL.md
workspaces/seo-batch/.claude/skills/rag-ops/SKILL.md
== git grep -l -F 'content-quality-gate' HEAD -- . ':!workspaces/seo-batch/.claude/skills/content-quality-gate'
.ast-grep/rules/seo-no-bare-role-literal.yml
agents/cmo/AGENTS.md
audit/seo-content-circuit-2026-11-15.md
packages/seo-role-contracts/src/schema.ts
workspaces/seo-batch/.claude/skills/v5-guardian/SKILL.md
```

Détail des références qui **lisent** encore le skill (à traiter avant tout retrait) :
- `backend/src/config/phase2a-shadow-audit.constants.ts:106` ;
- `backend/src/modules/rag-proxy/services/rag-phase2a-shadow-audit.service.ts:430,443` ;
- `backend/src/modules/seo/validation/quality-validator.service.ts:91` lit
  `.claude/skills/seo-content-architect/data/forbidden.csv`, **déjà inexistant**
  (constat aussi dans `audit/seo-content-circuit-2026-11-15.md:416`) ;
- `workspaces/seo-batch/.claude/agents/brief-enricher.md:148-151,326-329` et
  `research-agent.md:225` ;
- `agents/cmo/AGENTS.md:39` (« Skills configurées : … content-quality-gate »).

Le reste se compose de commentaires, de mentions historiques ou de documents de
canon sous `.spec/00-canon/**`, réservés à @ak125.
`.ast-grep/rules/seo-no-bare-role-literal.yml:82` vise le service backend
`content-quality-gate.service.ts`, pas le skill.

**Conclusion : aucun retrait n'est appliqué dans cette PR.**

### 2.4 Registre unique des outils : patch préparé, non appliqué

- Cible : `.spec/00-canon/ai-registry/skills.registry.json`. C'est une projection
  générée par `scripts/governance/build-skills-registry.js` (`--check` dans
  `.github/workflows/skills-canon-gate.yml`, warn-only).
- Réservation : `.spec/00-canon/repository-registry/ownership.yaml` l.249 attribue
  ce producteur à `@ak125` (risque élevé, D15). `.spec/00-canon/ai-registry/**` est
  aussi à `@ak125`. Je ne modifie donc ni le producteur ni le registre.
- Cause : le producteur ne parcourt que `.claude/skills`. Le registre (17 entrées,
  `generatedAt` 2026-11-14T23:02:51Z) ne contient **aucun** des 9 skills.
- Patch : `docs/audit/mandat-ak-2026-11-15/skills-registry-producer.patch`, SHA-256
  `c31fcf83de4a6d25ca11d2043db74713f04b40321b27f6862b4919db474dc01a`, 11 fichiers, +100/−19.
  1. `build-skills-registry.js` : `SKILL_ROOTS = [.claude/skills,
     workspaces/seo-batch/.claude/skills]`, listées explicitement (pas de glob) ;
     erreur si deux racines portent le même nom ; tri inchangé.
  2. `skills-canon-gate.yml` : ajout du chemin `workspaces/seo-batch/.claude/skills/**`.
  3. Les 9 SKILL.md : `type`, `status`, `owners: ['@ak125']`, `domain: D3`,
     `runtime_class`, `llm_safe` ; `last_verified: '2026-11-15'` pour les 4 skills
     essayés ; `version` déplacé dans `metadata.version` (`additionalProperties:false`
     dans `skill.schema.json`) ; clause « Use when » ajoutée à content-audit,
     keyword-planner, kw-classify et seo-content-architect. **Attention** :
     `name: kp` → `name: keyword-planner` change l'invocation `/kp`.

| Skill | type | status | runtime_class | llm_safe | last_verified |
|---|---|---|---|---|---|
| content-audit | technique | experimental | read-only | false | 2026-11-15 |
| content-quality-gate | technique | deprecated | read-only | true | — |
| keyword-planner | technique | experimental | mutating | false | — |
| kw-classify | technique | experimental | mutating | false | — |
| r8-diversity-check | technique | experimental | read-only | true | 2026-11-15 |
| seo-content-architect | reference | deprecated | read-only | false | — |
| seo-content-loop | reference | stable | mutating | false | — |
| seo-gamme-audit | technique | experimental | read-only | true | 2026-11-15 |
| seo-vault-verify | technique | experimental | mutating | false | 2026-11-15 |

`owners` vaut `@ak125` et non `@ak125/seo-team` : le motif du schéma
`^@[a-z0-9][a-z0-9_-]*$` refuse le slash. L'ownership de fichiers de
`workspaces/seo-batch/**`, qui appartient à `@ak125/seo-team`, n'est pas touché.

Test dans une copie isolée (`git archive` de scripts/governance, ai-registry, les
deux racines de skills et le workflow, dans un dépôt git jetable du scratchpad) :
- ajv avec `skill.schema.json` sur les 9 frontmatters (2026-11-15T23:15:51Z) :
  **9/9 OK**, `name` égal au dossier ;
- producteur (23:15:56Z) : `--check` avant régénération signale la dérive (exit 1) ;
  la régénération produit 33 skills, dont 26 conformes. Les 7 non conformes sont
  des skills seo-batch **hors des 9** : content-gen, legacy-recycler,
  pipeline-orchestrator, rag-check, rag-ops, surgical-cleaner, v5-guardian. Le
  `--check` suivant renvoie exit 0 ;
- les 17 entrées racine sont identiques octet pour octet à l'original ;
- `git apply --check` du patch sur le worktree : OK.

Effets à vérifier par l'owner avant application :
- `build-command-center-snapshot.js` (`SKILLS_REGISTRY_REL`) et la fixture
  `tests/registry/fixtures/command-center-l1-baseline.json` peuvent dériver : non
  vérifié ici ;
- `scripts/governance/validate-skills-frontmatter.js` ne parcourt toujours que
  `.claude/skills`. Un patch de suivi est à prévoir ;
- `workspaces/marketing` (11 skills) et `workspaces/wiki` (1) restent hors registre :
  ils font partie des 36 autres skills, hors mandat.

---

## 3. Gestes de Marwane (GSC et décisions)

Propriété GSC : `https://www.automecanik.com/`. Les URL complètes sont
`https://www.automecanik.com` suivi du chemin du tableau §1.b.

1. **Inspection d'URL** : les 30 pages #01–#30 et les témoins #31 (K1) et #32 (K2).
   Relever pour chacune : « URL sur Google » (indexée ou non), la canonique choisie
   par Google contre celle déclarée, la date et l'agent de dernière exploration, et
   le mode de découverte (sitemap ou page référente). Capture ou export. Les pages à
   0 impression en octobre sont prioritaires : #02, #07, #08, #09, #11, #13, #15, #20,
   #21, #22, #24, #26, #27 et #30.
2. **Pages (couverture d'index)**, filtre « URL contient `/pieces/` », sur
   août–novembre : export des courbes et des exemples pour « Explorée, actuellement
   non indexée », « Détectée, actuellement non indexée », « Autre page avec balise
   canonique correcte », « Google a choisi une autre canonique » et « Erreur de
   serveur (5xx) ». Cela tranche les hypothèses désindexation et duplicate (§1.e).
3. **Statistiques d'exploration** (Paramètres) : réponses 5xx du 2026-09-29 au
   2026-10-10, autour de #1587 et #1595.
4. **Performances**, juillet contre octobre, filtre
   `/pieces/compresseur-de-climatisation-447/`, onglet Requêtes : si les impressions
   par requête baissent à position égale, c'est la saisonnalité ; si la position
   baisse, c'est le classement.
5. **Search Status Dashboard** (`https://status.search.google.com/`, historique
   des classements) :
   noter les dates exactes des spam updates d'août et de septembre 2026 et
   l'éventuelle core update.
6. **Décisions AI6**, écrites et datées, une par skill :
   - retrait : keyword-planner, seo-vault-verify, seo-content-architect,
     content-quality-gate ;
   - fusion : content-audit dans seo-gamme-audit ;
   - amélioration : kw-classify.
7. **Application du patch du registre** (§2.4) : producteur et registre réservés à
   `@ak125`, changement de `/kp` à valider.
8. **Fusion de cette PR** :
   `gh pr merge <N> --repo ak125/nestjs-remix-monorepo --squash --match-head-commit <sha40>`.

---

## 4. Constats hors périmètre (signalés, non corrigés)

1. Balises RUM R2 rares : 9 balises `pieces_gamme_vehicle` en 3 jours dans
   `__seo_cwv_raw` ; n ≤ 13 par mois après juillet dans `__seo_cwv_daily_rum`.
2. Table labo `__seo_cwv_daily` vide (0 ligne).
3. Scores QPS figés au 2026-06-11 (`v2.2`).
4. R2 v2 et `__seo_r2_signatures` vides (0 page, 0 signature pour pg 10).
5. Marqueurs non résolus encore émis, environ 4 000 par mois.
6. `__seo_crawl_log` et `__seo_index_history` vides : aucune trace d'exploration
   ou d'indexation interne.
7. Le backend lit des chemins seo-content-architect inexistants
   (`quality-validator.service.ts:91`).
8. Requête SQL de `/kp` cassée (`rkp_*` contre `skp_*`).
9. `redis-cli DEL` à motif de kw-classify mort.
10. Script r8-diversity-check : lecture de `.env` et DSN direct.
11. `validate-skills-frontmatter.js` ne parcourt pas les workspaces.
12. 7 skills seo-batch hors mandat non conformes au schéma (§2.4).
13. Le cron `sync-dev-runtime` échoue depuis le 2026-11-15 19:50, car
    `.spec/00-canon/repository-registry/pipelines.registry.json` est modifié dans
    `/opt/automecanik/app`. Rien n'a été touché.
14. Le sitemap ne couvre que 13 à 16 % des pages R2 que Google montre (§1.b).
15. #11 et K1 servent l'état sans liste de produits en 200 et `index, follow`. Selon
    #1595, la politique « 0 produit » est 200 + `noindex, follow`. Le rapport ne
    tranche pas : il s'agit soit d'une incohérence, soit d'un catalogue dégradé au
    moment du GET. Non vérifié.

---

## 5. Règles lues

- `CLAUDE.md` et `AGENTS.md` (racine du monorepo).
- `.claude/rules/agent-doc-search.md`, `.claude/rules/security-hooks.md`,
  `.claude/rules/context7.md`, `.claude/rules/payments.md` (rien touché dans cette
  zone).
- `.claude/canon-mirrors/agent-exit-contract.md` (AEC).
- Vault, en lecture seule et sans `cd`, à `501982d3be2c` : ADR-128,
  `rules-ai-cos.md` (AI6), `rules-ai-antipatterns.md` (AP-12).
- `MEMORY.md` (index de la mémoire de session).
- `.spec/00-canon/repository-registry/ownership.yaml` (l.249 producteur ;
  `docs/audit/**` : D15, @ak125, risque faible).
- `.spec/00-canon/ai-registry/skill.schema.json`.
- `.github/workflows/skills-canon-gate.yml` et
  `.github/workflows/registry-new-file-gate.yml` (Block-new).
- `SKILL.md` des 9 skills, de `web-vitals-audit` et de `runtime-truth-audit`.

Emplacement du rapport : `docs/audit/mandat-ak-2026-11-15/`. Le glob `docs/audit/**`
a un owner et un domaine dans `ownership.yaml` (D15, @ak125, risque faible), ce qui
permet de passer le gate Block-new sans modifier ce fichier réservé. Les autres
emplacements ont été écartés :
- `audit/mandat-ak/` n'a aucun glob dans `ownership.yaml` (#2081 échoue sur ce point) ;
- `audit-reports/` est ignoré par `.gitignore` l.306, car c'est un dossier de sorties CI.

## 6. Limites

- La GSC d'AutoMecanik n'est accessible que par la table `__seo_gsc_daily_page_totals`,
  agrégée par page et par jour, sans requêtes ni états d'index. Les hypothèses
  d'index restent donc ouvertes.
- Les contrôles HTTP montrent l'état servi le 2026-11-15, pas celui de juillet à
  octobre.
- Le sitemap comparé est celui du 11-15 (101 097 URL R2), postérieur au v10 du
  11-14. Le volume antérieur est connu, pas son contenu URL par URL.
- La datation des mises en PROD reste inconnue : le hook bloque la lecture des tags,
  et seules les dates de fusion sont connues.
- La similarité de contenu porte sur 32 pages, pas sur tout le gabarit.
- CWV par page non mesurable sur la fenêtre (§1.d).
- Les essais de skills n'incluent ni keyword-planner ni kw-classify (écriture et
  RAG), ni les checks labo de web-vitals-audit.
- L'impact du patch sur le snapshot Command Center n'a pas été testé.

## 7. Distinctions d'état

| Élément | Proposé | Corrigé dans le candidat | Testé | Intégré (main) | Activé |
|---|---|---|---|---|---|
| Diagnostic §1 | oui | — | requêtes et GET réels, horodatés | à la fusion de la PR | — |
| Verdicts §2 | oui | non | essais réels pour 6 skills | non | non |
| Retraits ou fusions de skills | oui | **non** | — | non | non |
| Patch du registre (§2.4) | oui | **non appliqué** (fichier `.patch` seulement) | oui, en copie isolée | non | non |
| Gestes GSC §3 | oui | — | — | — | — |

## Annexe A : requêtes SQL

Toutes lancées par `sweep-psql.sh -f <fichier>` en lecture seule le 2026-11-15
(Q1 à Q6 de 23:00Z à 23:07Z ; Q8 à 23:18:55Z).

```sql
-- ===== q1_lost_pages.sql
-- Q1 : pages /pieces/ avec >=1 clic en juillet 2026 et 0 clic (ou absentes) en octobre 2026.
-- Chemin normalisé (hôte retiré, www/non-www/http confondus).
with n as (
  select regexp_replace(page, '^https?://[^/]+', '') as path, date, clicks, impressions, position
  from __seo_gsc_daily_page_totals
  where date between '2026-07-01' and '2026-10-31'
    and page ~ '^https?://[^/]+/pieces/'
), jul as (
  select path, sum(clicks) c, sum(impressions) i,
         sum(position*impressions)/nullif(sum(impressions),0) pos
  from n where date between '2026-07-01' and '2026-07-31' group by path having sum(clicks) > 0
), oct as (
  select path, sum(clicks) c, sum(impressions) i,
         sum(position*impressions)/nullif(sum(impressions),0) pos
  from n where date between '2026-10-01' and '2026-10-31' group by path
)
select j.path,
  case when j.path ~ '^/pieces/[a-z0-9-]+-[0-9]+\.html$' then 'R1_gamme'
       when j.path ~ '^/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' then 'R2_gamme_vehicule'
       else 'autre' end as type,
  substring(j.path from '^/pieces/([a-z0-9-]+-[0-9]+)(?:/|\.html)') as gamme,
  j.c as clics_jul, j.i as impr_jul, round(j.pos::numeric,1) as pos_jul,
  coalesce(o.c,0) as clics_oct, coalesce(o.i,0) as impr_oct, round(o.pos::numeric,1) as pos_oct
from jul j left join oct o using (path)
where coalesce(o.c,0) = 0
order by j.path;

-- ===== q2_weekly.sql
-- Q2 : semaine par semaine (ISO, lundi), pages /pieces/ R2 et R1 : clics, impressions, pages vues en SERP, position pondérée.
with n as (
  select regexp_replace(page, '^https?://[^/]+', '') as path, date, clicks, impressions, position
  from __seo_gsc_daily_page_totals where page ~ '^https?://[^/]+/pieces/'
)
select date_trunc('week', date)::date as semaine, count(distinct date) as jours,
  case when path ~ '^/pieces/[a-z0-9-]+-[0-9]+\.html$' then 'R1'
       when path ~ '^/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' then 'R2' else 'autre' end as type,
  sum(clicks) clics, sum(impressions) impr,
  count(distinct path) filter (where impressions > 0) pages_impr,
  count(distinct path) filter (where clicks > 0) pages_clic,
  round((sum(position*impressions)/nullif(sum(impressions),0))::numeric,1) pos
from n group by 1,3 order by 3,1;

-- ===== q3_churn.sql
-- Q3 : renouvellement (churn) des pages /pieces/ cliquées, mois A -> mois B, et pages gagnées.
with n as (
  select regexp_replace(page, '^https?://[^/]+', '') as path, date_trunc('month',date)::date m, clicks, impressions
  from __seo_gsc_daily_page_totals where page ~ '^https?://[^/]+/pieces/' and date < '2026-11-01'
), pm as (select path, m, sum(clicks) c, sum(impressions) i from n group by 1,2),
pairs(ma, mb) as (values ('2026-06-01'::date,'2026-07-01'::date),('2026-06-01','2026-09-01'),('2026-07-01','2026-08-01'),('2026-07-01','2026-10-01'),('2026-08-01','2026-09-01'),('2026-09-01','2026-10-01'))
select p.ma, p.mb,
  (select count(*) from pm a where a.m=p.ma and a.c>0) cliquees_a,
  (select count(*) from pm b where b.m=p.mb and b.c>0) cliquees_b,
  (select count(*) from pm a where a.m=p.ma and a.c>0 and not exists (select 1 from pm b where b.path=a.path and b.m=p.mb and b.c>0)) perdues,
  (select count(*) from pm a where a.m=p.ma and a.c>0 and not exists (select 1 from pm b where b.path=a.path and b.m=p.mb and b.i>0)) perdues_sans_impr,
  (select count(*) from pm b where b.m=p.mb and b.c>0 and not exists (select 1 from pm a where a.path=b.path and a.m=p.ma and a.c>0)) gagnees
from pairs p order by 1,2;

-- ===== q4_kept.sql
-- Q4 : pages /pieces/ R2 cliquées en juillet ET en octobre (témoins), top par clics d'octobre.
with n as (select regexp_replace(page,'^https?://[^/]+','') path, date, clicks, impressions from __seo_gsc_daily_page_totals
  where page ~ '^https?://[^/]+/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' and date between '2026-07-01' and '2026-10-31')
select path, sum(clicks) filter (where date<'2026-08-01') c_jul, sum(clicks) filter (where date>='2026-10-01') c_oct,
 sum(impressions) filter (where date>='2026-10-01') i_oct
from n group by path having sum(clicks) filter (where date<'2026-08-01')>0 and sum(clicks) filter (where date>='2026-10-01')>0
order by c_oct desc, path limit 10;

-- ===== q5_r2_sets.sql
-- Q5 : par page R2, clics/impressions par mois (juil, août, sept, oct) — pour croiser avec le sitemap actuel.
select regexp_replace(page,'^https?://[^/]+','') path,
 sum(clicks) filter (where date between '2026-07-01' and '2026-07-31') c7,
 sum(impressions) filter (where date between '2026-07-01' and '2026-07-31') i7,
 sum(clicks) filter (where date between '2026-10-01' and '2026-10-31') c10,
 sum(impressions) filter (where date between '2026-10-01' and '2026-10-31') i10
from __seo_gsc_daily_page_totals
where page ~ '^https?://[^/]+/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' and date between '2026-07-01' and '2026-10-31'
group by 1;

-- ===== q6_r2_gamme_pos.sql
-- Q6a : R2 par gamme, juillet vs octobre (impressions, clics, pages vues) ; top pertes d'impressions.
with b as (select split_part(regexp_replace(page,'^https?://[^/]+/pieces/',''),'/',1) g, regexp_replace(page,'^https?://[^/]+','') p, date, clicks, impressions, position
 from __seo_gsc_daily_page_totals where page ~ '/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' and (date between '2026-07-01' and '2026-07-31' or date between '2026-10-01' and '2026-10-31'))
select g, sum(impressions) filter (where date<'2026-08-01') i7, sum(impressions) filter (where date>='2026-10-01') i10,
 sum(clicks) filter (where date<'2026-08-01') c7, sum(clicks) filter (where date>='2026-10-01') c10,
 count(distinct p) filter (where date<'2026-08-01') p7, count(distinct p) filter (where date>='2026-10-01') p10,
 round((sum(position*impressions) filter (where date<'2026-08-01') / nullif(sum(impressions) filter (where date<'2026-08-01'),0))::numeric,1) pos7,
 round((sum(position*impressions) filter (where date>='2026-10-01') / nullif(sum(impressions) filter (where date>='2026-10-01'),0))::numeric,1) pos10
from b group by 1 order by coalesce(sum(impressions) filter (where date<'2026-08-01'),0)-coalesce(sum(impressions) filter (where date>='2026-10-01'),0) desc limit 15;

-- ===== q6b_stable_pos.sql
-- Q6b : pages R2 présentes (impressions>0) en juillet ET octobre : position pondérée et impressions par page.
with m as (select regexp_replace(page,'^https?://[^/]+','') p,
  sum(impressions) filter (where date between '2026-07-01' and '2026-07-31') i7, sum(impressions) filter (where date between '2026-10-01' and '2026-10-31') i10,
  sum(position*impressions) filter (where date between '2026-07-01' and '2026-07-31') w7, sum(position*impressions) filter (where date between '2026-10-01' and '2026-10-31') w10,
  sum(clicks) filter (where date between '2026-07-01' and '2026-07-31') c7, sum(clicks) filter (where date between '2026-10-01' and '2026-10-31') c10
 from __seo_gsc_daily_page_totals where page ~ '/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' and date between '2026-07-01' and '2026-10-31' group by 1)
select count(*) pages_both, sum(i7) i7, sum(i10) i10, sum(c7) c7, sum(c10) c10, round((sum(w7)/sum(i7))::numeric,1) pos7, round((sum(w10)/sum(i10))::numeric,1) pos10
from m where i7>0 and i10>0;

-- ===== q8_cwv_pages.sql
-- Q8 : web-vitals-audit (check RUM) sur 2 pages de l'échantillon (#05, #12) et le témoin K2 (#32) : RUM brut par URL + labo par page.
select 'raw' src, regexp_replace(url,'^https?://[^/]+','') p, metric, device, count(*) n,
  round(percentile_cont(0.75) within group (order by value)::numeric,0) p75, min(received_at)::date d0, max(received_at)::date d1
from __seo_cwv_raw
where regexp_replace(split_part(url,'?',1),'^https?://[^/]+','') in (
 '/pieces/compresseur-de-climatisation-447/peugeot-128/307-128035/1-6-13002.html',
 '/pieces/courroie-d-accessoire-10/renault-140/megane-ii-140046/1-4-16v-17719.html',
 '/pieces/courroie-d-accessoire-10/renault-140/symbol-i-140092/1-4-16553.html')
group by 1,2,3,4 order by 2,3,4;
select 'raw_window' src, min(received_at) d0, max(received_at) d1, count(*) n, count(*) filter (where route_group='pieces_gamme_vehicle') n_r2 from __seo_cwv_raw;
select 'lab' src, count(*) n, count(*) filter (where page ~ '/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html') n_r2, min(date), max(date) from __seo_cwv_daily;

-- ===== skill_rta_massdoc.sql
select now() at time zone 'utc' as ts_utc;
SELECT 'A' inv, count(*) FROM auto_type WHERE type_id_i IN (SELECT old_id FROM tecdoc_map.type_id_remap);
SELECT 'B' inv, count(*) FROM auto_type WHERE type_id_i >= 60000 AND type_id_i NOT IN (SELECT new_id FROM tecdoc_map.type_id_remap);
SELECT 'C' inv, count(*) FROM tecdoc_map.type_id_remap r WHERE NOT EXISTS (SELECT 1 FROM auto_type a WHERE a.type_id_i = r.new_id);
SELECT 'D' inv, (SELECT last_value FROM tecdoc_map.type_id_seq) AS seq_last, (SELECT is_called FROM tecdoc_map.type_id_seq) is_called, (SELECT max(type_id_i) FROM auto_type) AS max_id, (select count(*) from auto_type) n_types;

-- ===== skill_seo_gamme_audit_pg10.sql
-- Essai seo-gamme-audit v5.0, mode gamme, pg_id=10 (courroie-d-accessoire), requêtes G0/G3/G6/G7 du SKILL.md, lecture seule (sweep-psql : transaction read only).
\echo == G0 resolution
select g.id as pg_id, g.pg_alias, g.label, pg.pg_level, pg.pg_display, pg.pg_name from __pg_gammes g join pieces_gamme pg on pg.pg_id = g.id where g.id = 10;
\echo == G0 gamme_aggregates
select products_total, vehicles_total, catalog_status, vehicle_coverage, index_policy, computed_at from gamme_aggregates where ga_pg_id = 10;
\echo == G3 R2 v2
select count(*) as r2_pages, count(*) filter (where status = 'published') as published, count(distinct decision) as decisions,
  count(*) filter (where exists (select 1 from __seo_r2_signatures s where s.page_id = p.id)) as with_signature
from __seo_r2_pages p where p.pg_id = 10;
\echo == G3 cross_gamme_car levels
select cgc_level, count(*) from __cross_gamme_car_new where cgc_pg_id = '10' group by cgc_level order by cgc_level;
\echo == G7 QPS
select page_type, quality_score, hard_gate_status, status, score_version, computed_at from __quality_page_scores where pg_id = 10 order by page_type;
\echo == sitemap links pg 10
select count(*) links, count(*) filter (where map_has_item>0) with_item from __sitemap_p_link where map_pg_id = 10;

-- ===== skill_usage.sql
select now() at time zone 'utc' as ts_utc;
select table_name, string_agg(column_name, ',' order by ordinal_position) cols from information_schema.columns
 where table_schema='public' and table_name in ('__seo_keyword_results','__seo_r3_keyword_plan','__seo_r6_keyword_plan') group by 1;
select source, count(*) n, count(distinct pg_id) gammes from __seo_keyword_results group by 1 order by 2 desc;

-- ===== skill_usage2.sql
select now() at time zone 'utc' as ts_utc;
select source, min(created_at)::date premier, max(created_at)::date dernier from __seo_keyword_results group by 1;
select max(skp_built_at)::date r3_dernier, count(*) r3_n from __seo_r3_keyword_plan;
select max(r6kp_built_at)::date r6_dernier, count(*) r6_n from __seo_r6_keyword_plan;
```

LIVRABLE MANDAT AK
