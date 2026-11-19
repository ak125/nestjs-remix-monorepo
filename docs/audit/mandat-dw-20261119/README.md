# Mandat DW et complément 1 : titre R2 sans prix, toutes gammes

Relevés du 2026-11-19, base `4c61f7600e877667d8e35f7fffe4e58b22cce63c`.

État : **écrit et testé dans la PR #2212, migration non appliquée, rien de
déployé.** La validation des titres, la fusion, le tag PROD et l'application de
la migration restent à Marwane.

## Ce qui change

- **Nouveau titre R2 :** « `<Gamme> <MARQUE> <MODÈLE> <type> [carburant] <puissance> ch` ».
  - Ni prix, ni accroche, ni années.
  - Toutes les gammes qui ont une ligne `__seo_gamme_car` (118 lignes, 118 gammes), une fois la migration appliquée.
- **Carburant :** il est écrit sauf dans trois cas :
  - il est absent de `auto_type.type_fuel` ;
  - le nom du type le contient déjà ;
  - un jeton du nom l'implique pour ce même carburant (liste `FUEL_IMPLYING_TYPE_TOKENS`, mesure dans `jetons-carburant.tsv`, seuil 98 %).
- **Graphie du carburant (point 2b) :** `Electrique` est affiché `Électrique` (`normalizeFuelForDisplay`), à l'affichage seulement. Aucune écriture en base.
- **Puissance :** elle vient de `type_power_ps`. Elle n'est pas répétée si le nom porte déjà « N ch ».
- **Code moteur, pages en collision seulement (point 2a) :** voir §Doublons.
- **Mécanisme :**
  - La migration `backend/supabase/migrations/20261119_seo_r2_title_all_gammes.sql` (retour : `.down.sql`) passe `sgc_title` de `#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.` à `#Gamme# #VMarque# #VModele# #VTypeCarburantPuissance#`.
  - Garde : la migration lève une exception, sans rien écrire, si une ligne porte une autre valeur que l'ancien ou le nouveau gabarit. Rejouable : une ligne déjà sur le nouveau gabarit n'est pas réécrite.
  - Relevé du 2026-11-19 19:38:50 UTC : 118 lignes sur l'ancien gabarit, 0 sur le nouveau, 0 NULL, **0 ligne écartée**.
  - Aucun fichier de `rm/` n'est modifié.
- **Inchangé :** H1, meta description, contenu, canonical, données structurées, URL et prix.

## Gammes sans ligne `__seo_gamme_car`

- **Gammes concernées :** 8 gammes du sitemap n'ont pas de ligne : 1750, 2066, 2462, 2669, 3213, 3859, 3908 et 3927. Cela fait 44 958 pages servables, dont 10 383 indexables.
- **Titre servi :** le RPC n'y renvoie pas de gabarit (`rm-builder.service.ts:663`, `seo_raw` nul). Le front sert donc son titre de repli (`frontend/app/utils/pieces-vehicle.loader.server.ts:689`) : « `<Gamme> <MARQUE> <MODÈLE> <type enrichi> | Pièces Auto` ». Ce titre ne porte déjà ni prix ni accroche.
- **Pourquoi elles ne sont pas couvertes :**
  - La migration ne les touche pas.
  - Leur créer une ligne apporterait aussi le H1, la description et le contenu de cette ligne, ce qui sort du mandat.
  - Leurs titres en double existaient déjà avant ce changement (§Doublons) ; ce changement ne les crée ni ne les résout.
- **Décision réservée :** choisir entre une ligne avec H1, description et contenu validés, ou un repli frontend aligné sur la nouvelle règle.

## Ordre de déploiement (point 5)

1. **Fusion** de la PR sur `main`, par Marwane.
2. **Tag PROD** `v*`, par Marwane.
3. **Preuve `/health`** du code servi :
   ```bash
   curl -s https://www.automecanik.com/health
   ```
   La preuve est valable si le champ `revision` est le commit du tag, et si ce commit contient le commit de fusion de cette PR (`git merge-base --is-ancestor <fusion> <revision>`).
4. **Migration à blanc :** workflow `🗄️ Apply Supabase migrations (manual)` avec `only_ids=20261119_seo_r2_title_all_gammes`, `dry_run=true`.
5. **Migration :** même workflow avec `confirm=APPLY`, `dry_run=false`.
6. **Contrôle d'une page**, après 24 h au plus (cache `seo:processed:*`) :
   ```bash
   curl -s https://www.automecanik.com/pieces/plaquette-de-frein-402/mini-113/mini-paceman-r61-113009/2-0-cooper-d-all4-53236.html \
     | grep -o '<title>[^<]*</title>'
   ```
   - Attendu : « Plaquette de frein MINI PACEMAN (R61) Cooper D ALL4 112 ch N47 C20 A ». Le code moteur figure ici parce que cette page est en collision.
   - Avant la migration : « … à partir de 11.00€ à prix réduit. ».

- **Ordre inverse :** si la migration passe avant le code, l'ancien code purge le marqueur inconnu. Les titres deviennent alors « `<Gamme> <MARQUE> <MODÈLE>` », pendant 24 h au plus après le déploiement du code.
- **Protection dans la migration :** aucune protection simple n'existe sans contournement. Le déploiement du code ne laisse aucune trace lisible en base : pas de table de version ni de drapeau. Créer une telle trace serait une nouvelle source de vérité. L'ordre reste donc une consigne de procédure, rappelée en tête du fichier de migration.
- **Retour :** `20261119_seo_r2_title_all_gammes.down.sql` remet l'ancien gabarit sur les lignes qui portent le nouveau, et seulement celles-là.

## Doublons (point 2)

**Définition.** Deux pages servables de la même gamme sont en collision si elles portent le même titre. Le titre actuel est comparé sans sa partie prix et accroche, qui varie.

**Ensembles de pages.**
- *servable* : ligne de `__sitemap_p_link` dont le type est affiché.
- *indexable* : servable, modèle de l'URL égal au modèle du type, et `map_has_item > 20` (seuil d'entrée au sitemap R2).

| ensemble | pages | titres actuels en double (groupes / pages) | nouvelle règle sans code (groupes / pages) | nouvelle règle avec code (groupes / pages) |
|---|---|---|---|---|
| servable, gammes migrées | 328 047 | 18 369 / 44 036 | 1 370 / 2 740 | **0 / 0** |
| indexable, gammes migrées | 90 714 | 4 250 / 10 129 | 305 / 610 | **0 / 0** |
| servable, 8 gammes en repli (inchangé) | 44 958 | 2 539 / 6 139 | — | 2 539 / 6 139 |
| indexable, 8 gammes en repli (inchangé) | 10 383 | 518 / 1 238 | — | 518 / 1 238 |

**Règle de distinction (2a).**
- **Collision au service :** deux types affichés du même modèle, de même libellé `buildR2TitleTypeLabel`, ont tous deux des pièces dans la gamme (`pieces_relation_type`, critère du RPC de page).
- **Résolution :** le titre reçoit alors le premier code moteur du type, en ordre stable par point de code, s'il diffère du premier code de chaque type en collision. Sinon il ne reçoit aucun code, et un avertissement est journalisé.
- **Années :** jamais utilisées.
- **Implémentation :** `R2TitleCollisionService` lit et trie les codes lui-même. L'agrégation non ordonnée du RPC (`STRING_AGG` sans `ORDER BY`) n'empêche donc pas de départager. La condition du mandat (« si c'est la seule chose qui empêche de départager ») n'est pas remplie, et aucune migration du RPC n'est faite.
- **Pages qui reçoivent un code :** 3 565 servables, dont 865 indexables.
- **Coût :** 2 lectures par page hors cache quand aucun type jumeau n'a le même libellé, 3 + n sinon (n = jumeaux de même libellé). Seulement si le gabarit contient le nouveau marqueur. Une erreur de lecture renvoie l'échec habituel (503, rien en cache), jamais un titre dégradé.

**Pages restantes non départagées, gammes migrées.**
- **Volume :** 68 pages servables, dont 21 indexables (`collisions-restantes.tsv`).
- **Aucun doublon dans le sitemap :** aucune de ces pages n'a le même titre qu'une autre page du sitemap.
- **Le doublon :** leur titre est celui d'un type jumeau servi hors sitemap (pièces dans la gamme). Le jumeau a les mêmes codes moteur ; seule l'année de début diffère :
  - FIAT DUCATO V Fourgon (250-290) « 2.3 D Multijet » 110 ch : types 15958 et 65978, code F1AE3481G, années 2011 et 2014 ;
  - TOYOTA RAV 4 IV « 2.0 4WD » Essence 151 ch : types 58618 et 80361, code 3ZR-FAE, années 2012 et 2015.
- **Pourquoi elles restent :** la fiabilité des années n'est pas établie pour ces paires, donc aucune année n'est ajoutée.

**Autres rôles.** 898 titres R1, R3, R4, R6 et R8 ont été comparés, toutes gammes : aucun n'est identique à un nouveau titre R2.
- R8 : « Pièces <MARQUE> <MODÈLE> <type> | AutoMecanik », sans nom de gamme.
- R1, R3, R4, R6 : un seul nomme une marque automobile, « Turbo : Garrett, BorgWarner, Mitsubishi ».

## Cannibalisation (point 3)

- **Source :** `__seo_gsc_daily`, du 2026-08-19 au 2026-11-16 (90 jours ; dernière date de données : 2026-11-16).
- **Part anonymisée, pages R2 de toutes les gammes :** **81,6 %** des impressions et **95,1 %** des clics (totaux : `__seo_gsc_daily_page_totals`, 205 169 impressions, 3 391 clics). Le constat ci-dessous ne porte donc que sur 18,4 % des impressions.
- **Requêtes concernées :** 1 322 requêtes touchent une page R2 et au moins deux pages du site (`cannibalisation-90j-toutes-gammes.tsv`).

| requêtes | nombre | impressions |
|---|---|---|
| R2 seules (sœurs) | 1 122 | 18 432 |
| avec R1, R3 ou R8 | 179 | 10 240 |
| avec R4, R6 ou autre seulement | 21 | 417 |

- **Rapprochements :** on cherche une requête tenue par R1, R3 ou R8 dont un mot ajouté par le nouveau titre figure dans la requête. Un seul cas (`cannibalisation-rapprochements.tsv`) :
  - la requête « essence » (R3, 3 impressions ; R2 Joint de culasse CITROËN EVASION 2.0 16V, 1 impression) ;
  - le mot ajouté est le carburant ; c'est une requête générique, sans risque mesurable.
- **Éloignements :** retirer « prix » et « pas cher » éloigne la R2 des requêtes de prix tenues par le R1 (« prix alternateur » 131 impressions, « prix courroie accessoire » 86, « prix cardans » 69, etc.).
- **Contrôle PROD :** 18 GET simples, à une requête par seconde, sur 18 gammes autres que 10 et 316 (`echantillon-prod-toutes-gammes.tsv`).
  - Résultat : 18/18 en `200`, `index, follow`, canonical auto-référent.
  - 14 titres servis valent le titre actuel simulé suivi de « à partir de X€ <accroche> ».
  - 4 relèvent de gammes en repli (« … | Pièces Auto »).

## Validation (point 6)

- **Par gamme :** `par-gamme.tsv` donne, pour chaque gamme, la source du titre, les pages servables et indexables, les collisions (actuelles, sans code, avec code) et le nombre de titres de plus de 60 caractères.
- **Plus de 60 caractères, gammes migrées :** 121 858 pages servables sur 328 047, dont 23 466 indexables sur 90 714. Aucune troncature n'est appliquée ; les titres actuels servis sont plus longs, puisqu'ils portent en plus « à partir de X€ … ».
- **Exemples :** `exemples-60.tsv` contient 60 exemples :
  - un par gamme migrée (48), en alternant essence et diesel ;
  - les 3 titres les plus longs ;
  - 3 pages qui reçoivent un code moteur ;
  - 6 carburants hybrides, électriques et GPL, simulés à partir de types réels d'`auto_type`. Aucune page du sitemap n'a l'un de ces carburants.
- **Complet :** `titres-r2-toutes-gammes.tsv.gz` contient les 373 005 pages servables : source du titre, URL, indexable, titre actuel sans prix, nouveau titre, longueur, code moteur et statut de collision.
- **Source des titres :** `buildR2TitleTypeLabel`, `enrichTypeNameForHeadings` et `pickR2TitleMotorCode` (TypeScript de la PR), exécutés sur les relevés de base du 2026-11-19.

## Lecteurs de `__seo_gamme_car.sgc_title` (point 4)

| lecteur | rendu du nouveau marqueur |
|---|---|
| `rm-builder` → `SeoTemplateService` (HTML servi) | libellé, et code moteur en cas de collision |
| `SeoTemplateRenderer` (chaîne et API v4) | libellé, sans code moteur |
| `cross-selling-seo.service.ts` | libellé, sans carburant (absent de son contexte). Corrigé dans cette PR : le titre était vide. Test : `cross-selling-seo-r2-title.test.ts` |
| `seo-v4-monitoring.service.ts` | lecture seule, aucun rendu |
| SQL `process_seo_template`, via `get_pieces_for_type_gamme_v3` | marqueur purgé : « Thermostat PEUGEOT 207 » au lieu de « Thermostat PEUGEOT 207 1.4. » |

- **Consommateurs de `process_seo_template` :** `unified-page-data` (POST `/api/catalog/gammes/:id/seo`, repli R1 de `/api/gamme-rest-optimized/:pgId/page-data`, qui n'utilise pas `seo.title`) et deux variantes v2/v4 sans appelant. La fonction SQL n'est pas modifiée ; la corriger exige une migration, soumise à décision.

## Mesure après déploiement (point 7)

- **Script :** `avant-apres-ctr-titre-r2.sql`, en lecture seule.
- **Lancement :**
  ```bash
  psql -v d0=AAAA-MM-JJ -f avant-apres-ctr-titre-r2.sql
  ```
  `d0` est la date d'application de la migration.
- **Fenêtres :** 14 jours avant, puis 7 et 14 jours après. J0 est exclu à cause du cache.
- **Mesures :**
  - CTR par tranche de position (1-3, 4-10, 11-20, 21+) sur `__seo_gsc_daily` ;
  - ligne de total des clics R2 ;
  - ligne de contrôle depuis `__seo_gsc_daily_page_totals`, sans la perte d'anonymisation ;
  - dernière date de données, et jours couverts par fenêtre.
- **Lancement à blanc :** sur `d0=2026-11-01`, le total R2 donne 25 clics pour 4 542 impressions avant (`__seo_gsc_daily`), et 430 clics pour 24 679 impressions avant (`page_totals`).

## Fichiers

| fichier | contenu |
|---|---|
| `par-gamme.tsv` | tableau par gamme (point 6) |
| `collisions-resume.tsv` | doublons : actuels, sans code, avec code ; servable et indexable |
| `collisions-restantes.tsv` | collisions restantes, avec type_id, codes, années et raison |
| `exemples-60.tsv` | 60 exemples variés |
| `titres-r2-toutes-gammes.tsv.gz` | toutes les pages servables |
| `cannibalisation-90j-toutes-gammes.tsv` | requêtes multi-pages, impressions par rôle |
| `cannibalisation-rapprochements.tsv` | rapprochements R2 vers R1, R3 ou R8 |
| `echantillon-prod-toutes-gammes.tsv` | contrôle PROD du complément (18 pages) |
| `avant-apres-ctr-titre-r2.sql` | mesure avant/après |
| `jetons-carburant.tsv` | mesure de la liste des carburants impliqués |
| `titres-r2-pg10-pg316.tsv.gz`, `titres-r2-indexables.tsv`, `cannibalisation-90j.tsv`, `echantillon-prod-20.tsv` | relevés du mandat DW initial (gammes 10 et 316) |
| `ownership-extrait.md` | patch d'ownership proposé, non appliqué |
