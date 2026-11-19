# Mandat DW — essai de titre R2 sur courroie d'accessoire (pg 10) et thermostat (pg 316)

Relevé du 2026-11-19, base `4c61f7600e877667d8e35f7fffe4e58b22cce63c`.

État : **écrit et testé dans la PR, migration non appliquée, rien de déployé.**
La validation des titres, l'application de la migration, la fusion et le tag
PROD restent à Marwane.

## Ce qui change

- **Nouveau titre R2 :** « `<Gamme> <MARQUE> <MODÈLE> <type> [carburant] <puissance> ch` ».
  - Ni prix, ni accroche, ni années.
  - Seulement pour les gammes 10 et 316, et seulement après application de la migration.
- **Carburant :** il est écrit sauf dans trois cas :
  - il est absent de `auto_type.type_fuel` ;
  - le nom du type le contient déjà ;
  - un jeton du nom l'implique pour ce même carburant (liste `FUEL_IMPLYING_TYPE_TOKENS`).
- **Puissance :** elle vient de `type_power_ps`. Elle n'est pas répétée si le nom la porte déjà.
- **Mécanisme :**
  - Le gabarit `__seo_gamme_car.sgc_title` des deux gammes passe à `#Gamme# #VMarque# #VModele# #VTypeCarburantPuissance#`. C'est la migration `backend/supabase/migrations/20261119_seo_r2_title_trial_pg10_pg316.sql`, avec son retour `.down.sql`.
  - Le marqueur est résolu par `SeoTemplateService` (chemin servi) et par `SeoTemplateRenderer` (chemin chaîne et API v4, par cohérence), via `buildR2TitleTypeLabel` de `@repo/seo-types`.
  - Le carburant vient du contexte déjà transmis par le RPC (`legacy_marker_motorisation` = `auto_type.type_fuel`). Aucun fichier de `rm/` n'est touché.
- **Inchangé :**
  - les 116 autres gammes, qui forment le groupe témoin ;
  - le H1 (même gabarit et même `enrichTypeNameForHeadings`, test d'égalité sur l'ancien motif) ;
  - la meta description, le contenu, le canonical et les données structurées ;
  - le front (`pieces-vehicle.meta.ts` sert `seo.title` tel quel, sans suffixe).
- **Ordre imposé :** code servi d'abord, migration ensuite. Dans l'ordre inverse, la purge des marqueurs inconnus (`seo-template.service.ts`, `.replace(/#[^#]*#/g, '')`) produirait « Thermostat PEUGEOT 207 ».
- **Délai d'effet :** l'effet servi apparaît après expiration du cache Redis `seo:processed:{pg}:{type}:*`, soit 24 h au plus.

## Liste des carburants impliqués (6.2)

- **Mesure :** `jetons-carburant.tsv`, sur les 28 505 types affichés de `auto_type`. On compte la part des types qui contiennent le jeton (mot entier, casse ignorée) et dont le carburant appartient à la famille du jeton.
- **Seuil retenu :** 98 %.
- **Exceptions :**
  - `D` (96,7 %) est gardé parce qu'il est déjà dans l'ancien motif du H1 et dans le mandat ;
  - exclus faute d'atteindre le seuil : `GDi` 94,1 %, `T-GDi` 90,7 %, `Skyactiv-D` 81,2 %, `MPI` 97,5 % ;
  - `D-4D` reste couvert par `D`.
- **Sécurité :** si un jeton apparaît avec un autre carburant (hybride, GPL, erreur de base), le carburant reste écrit, car l'implication exige l'égalité exacte des carburants.

## Ensembles de pages et définition d'« indexé » (6.3)

| Ensemble | Définition |
|---|---|
| servable | ligne de `__sitemap_p_link` de la gamme dont le type est affiché (`type_display = 1`) |
| indexable (sitemap) | servable, modèle de l'URL = modèle du type, et `map_has_item > 20` : seuil `DEFAULT_MIN_ITEMS_THRESHOLD` de `sitemap-v10-pieces.service.ts`, seul filtre d'entrée au sitemap R2 |
| tous types avec pièces | types affichés présents dans `pieces_relation_type` pour la gamme. Une page peut y être servie sans figurer dans `__sitemap_p_link` |

- L'indexation réelle par Google n'est pas connue type par type. L'échantillon PROD (20 pages) renvoie `200`, `index, follow` et un canonical auto-référent.

## Collisions (6.3)

Une collision est comptée quand deux pages de la même gamme portent le même titre. Le « titre actuel » est comparé sans sa partie prix et accroche (« à partir de X€ … »), qui change d'un jour à l'autre.

| ensemble | pg | pages | titres actuels en double (groupes / pages) | nouveaux titres en double (groupes / pages) |
|---|---|---|---|---|
| servable | 10 | 8 619 | 495 / 1 188 | 36 / 72 |
| servable | 316 | 8 267 | 462 / 1 097 | 33 / 66 |
| indexable (sitemap) | 10 | 4 761 | 185 / 427 | 11 / 22 |
| indexable (sitemap) | 316 | 780 | 19 / 44 | 0 / 0 |
| tous types avec pièces | 10 | 20 959 | 1 503 / 3 681 | 117 / 236 |
| tous types avec pièces | 316 | 21 412 | 1 505 / 3 674 | 113 / 228 |

- **Statut par page (servable) :**
  - pg 10 : aucune 7 431, résolue 1 116, restante 72 ;
  - pg 316 : aucune 7 170, résolue 1 031, restante 66 ;
  - nouvelle collision créée par la règle : **0**.
- **Collisions restantes :** voir `collisions-restantes.tsv` (69 groupes servables). Elles portent sur des types de même nom, même carburant et même puissance, qui ne diffèrent que par :
  - les codes moteur et les années : 63 groupes ;
  - les codes moteur seuls : 6 groupes.
- **Pourquoi elles ne sont pas résolues ici :** il faudrait un discriminant ordonné.
  - Le RPC agrège les codes moteur sans ordre (`STRING_AGG` sans `ORDER BY`), et la correction se trouve dans `rm/`, protégé.
  - Les années sont exclues par le mandat.
  - Option soumise à décision : ajouter le code moteur principal aux seuls titres en collision, après correction de l'ordre dans le RPC (hors mandat).
- **Autres rôles :** 163 titres comparés, sans aucun titre identique.
  - R1, R3, R4 et R6 des deux gammes (8 titres) : aucun ne porte de véhicule.
  - R8 (`__seo_r8_pages`, 155 titres) : « Pièces <MARQUE> <MODÈLE> <type> | AutoMecanik », sans nom de gamme.

## Cannibalisation (6.4)

- **Source :** `__seo_gsc_daily`, du 2026-08-19 au 2026-11-16 (90 jours ; dernière date de données : 2026-11-16).
- **Part anonymisée :** les requêtes masquées par Google représentent **85,5 %** des impressions R2 de la gamme 10 et **82,8 %** pour la gamme 316. Totaux : `__seo_gsc_daily_page_totals`, 19 277 et 9 614 impressions. Le constat ci-dessous ne porte donc que sur environ 15 % du trafic.
- **Requêtes concernées :** 151 requêtes touchent au moins une page R2 de ces gammes et au moins deux pages du site (`cannibalisation-90j.tsv`).
  - 107 ne mettent en concurrence que des R2 sœurs (même gamme, autres types).
  - Les requêtes qui mêlent R1, R3, R4, R6 ou R8 sont génériques (« courroie accessoire », « site:… »). Le R2 y figure avec 1 impression.
- **Requêtes centrées véhicule :** toutes celles relevées vont déjà à la page R2 du type, par exemple « courroie accessoire clio 3 1.5 dci » et « thermostat 207 1.4 essence ». Le nouveau titre ajoute le carburant et la puissance que ces requêtes contiennent. Aucun cas où il rapprocherait une R2 d'une requête tenue par un autre rôle.
- **Effet du retrait du prix :** retirer « pas cher » et « à partir de X€ » éloigne la R2 de « prix courroie accessoire », tenue par le R1 (86 impressions, contre 1 pour une R2).
- **Contrôle PROD :** 20 pages, GET simples à une requête par seconde (`echantillon-prod-20.tsv`).
  - Résultat : 20/20 en `200`, `index, follow`, canonical auto-référent.
  - Les 19 titres comparables valent le titre simulé suivi de « à partir de X€ <accroche>. ».
  - L'URL Boxer servie (`boxer-iii-fourgon-128143`) diffère de celle de `__sitemap_p_link` (`boxer-iii-128083`).
  - Sail 59625 est absente de `__sitemap_p_link`.

## Longueurs (6.5)

- **Mesure :** nouveaux titres, en caractères. Aucune troncature n'est appliquée.

| ensemble | pg | ≤40 | 41–50 | 51–55 | 56–60 | 61–65 | 66–70 | >70 | **>60** | max | médiane |
|---|---|---|---|---|---|---|---|---|---|---|---|
| servable | 10 | 0 | 802 | 1 703 | 2 106 | 1 730 | 1 203 | 1 075 | **4 008** | 116 | 60 |
| servable | 316 | 1 085 | 3 918 | 1 411 | 1 082 | 456 | 215 | 100 | **771** | 105 | 49 |
| indexable | 10 | 0 | 564 | 1 062 | 1 249 | 872 | 590 | 424 | **1 886** | 101 | 59 |
| indexable | 316 | 112 | 423 | 119 | 79 | 33 | 11 | 3 | **47** | 72 | 48 |

- « Courroie d'accessoire » compte 21 caractères ; c'est la cause des titres longs de la gamme 10.
- Les titres actuels servis dépassent déjà ces longueurs, puisqu'ils portent en plus « à partir de X€ … ».

## Mesure après déploiement (6.7)

- **Script :** `did-ctr-titre-r2.sql`, en lecture seule.
  - Lancement : `psql -v start_date=AAAA-MM-JJ -v weeks=4 -f did-ctr-titre-r2.sql`.
  - Méthode : différence de différences du CTR, essai (pg 10 et 316) contre témoin (autres R2), par tranche de position quotidienne (1-3, 4-10, 11-20, 21+). Fenêtres de 4 semaines avant et après ; J0 et J+1 sont exclus à cause du cache.
  - Le script affiche aussi la dernière date GSC.
- **`start_date` :** le plus tardif de deux jours, celui où le tag PROD sert le code et celui où la migration est appliquée.
- **Lancement à blanc (placebo) :** sur `start_date=2026-10-17`, date sans changement, le DiD global vaut **−0,04 point** (de −2,11 à +0,60 selon la tranche, sur de faibles volumes). C'est l'ordre de grandeur du bruit.

## Fichiers

| Fichier | Contenu |
|---|---|
| `titres-r2-indexables.tsv` | pages indexables : URL, titre actuel sans prix, nouveau titre, longueur, statut de collision |
| `titres-r2-pg10-pg316.tsv.gz` | mêmes colonnes pour les 16 886 pages servables |
| `collisions-restantes.tsv` | groupes restants, avec type_id, codes moteur, années et raison |
| `cannibalisation-90j.tsv` | requêtes multi-pages par combinaison de rôles |
| `echantillon-prod-20.tsv` | contrôle PROD : titre servi et nouveau titre |
| `jetons-carburant.tsv` | mesure de la liste des carburants impliqués |
| `did-ctr-titre-r2.sql` | mesure à 4 semaines |

- **Source des titres :** les nouveaux titres viennent de `buildR2TitleTypeLabel`. Sur les 41 735 types concernés, la sortie TypeScript a été comparée à la simulation qui a produit ces fichiers : **0 écart**.
