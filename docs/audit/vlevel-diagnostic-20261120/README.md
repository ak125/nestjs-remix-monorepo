# Diagnostic du V-Level — filtre à huile, Clio III 1.5 dCi, cardan, sphère de suspension

Mandat EJ, 20 novembre 2026. Lecture seule : aucune écriture en base, aucun changement de
code, de skill, de procédure ou de contenu. Les décisions (garder, corriger ou retirer)
reviennent à Marwane.

- **Base du constat** : `origin/main` à `74bf21b69f5aa990f145a4cfd5f626e11f8be0ad`
  (« fix(rag-proxy)… (mandat DE) (#2198) »). Les lignes de code citées sont celles de ce commit.
- **Base de données** : massdoc (projet `cxpojprgwgubzjyqzmoq`), lue par `sweep-psql.sh`
  (copie identique à `910b1e9f04`), en transaction lecture seule. Uniquement des `SELECT`.
- **Lectures en base** : 2026-11-20, entre 10:59 et 11:05 UTC. Chaque tableau donne sa requête
  (`sql/`) et son résultat brut (`resultats/`).
- **Pages servies** : `curl` GET sur le DEV (`localhost:3000`) et sur `www.automecanik.com`,
  entre 11:01 et 11:06 UTC.

## Réponse courte

1. **Le V-Level ne pilote aucune page servie.** Ni les cartes de motorisation de la page R1,
   ni les titres, ni le maillage, ni les pages R2. Le code public et la fonction qui construit
   la page R1 ne lisent jamais `v_level`, `__seo_keywords` ou `__seo_type_vlevel`. Les cartes
   viennent de `__cross_gamme_car_new` (`cgc_level = 1`), une autre échelle.
2. **Le V-Level ne sert qu'à l'admin et aux scripts.** Il est calculé dans
   `__seo_keywords.v_level`, puis recopié dans `__seo_type_vlevel`. Cette seconde table n'a
   **aucun lecteur**. Elle n'a pas été réécrite depuis le 24 avril 2026, et depuis le 1er février
   pour le filtre à huile.
3. **D'où la contradiction que Marwane a vue.** Pour le filtre à huile, `__seo_keywords` compte
   0 V2 et 117 V3, mais `__seo_type_vlevel` compte encore 73 V2 et 45 V3. Le script de recopie
   ajoute et met à jour, mais ne supprime jamais. Les anciens V2 sont donc restés.
4. **Le V-Level part des mots-clés Google Ads, mais ces mots-clés ne sont presque jamais reliés
   à une motorisation.** Sur 10 581 mots-clés Google Ads avec un volume, 460 ont un `type_id`,
   soit 4,3 %. Exemple : « filtre a huile clio 3 1.5 dci » (Google Ads, 500 recherches) est classé
   « générique », sans modèle ni `type_id`. C'est la chose « pas logique » que Marwane pointe.
5. **La phrase répétée des cartes ne dépend pas du V-Level.** Elle est écrite en dur dans le
   front : « Sélectionnez cette motorisation pour afficher les références compatibles. »
   Elle apparaît 12 fois sur la page R1 du filtre à huile et 12 fois sur celle du cardan, en DEV
   comme sur le site. Les phrases variées du backend (« contrôler s'il est usé »…) partent dans
   le HTML, mais seulement dans les données sérialisées, jamais dans le texte visible.

## Gammes étudiées et pourquoi

| Gamme | pg_id | Raison |
|---|---|---|
| Filtre à huile | 7 | Imposée par le mandat. C'est aussi la seule des 25 gammes ayant un V-Level qui a des ventes sur 12 mois (2 commandes). |
| Cardan | 13 | Décision 39, 1er critère : 2 commandes payées non annulées sur 12 mois. 2e critère : clics Search Console perdus entre juillet (67) et octobre (41). |
| Sphère de suspension | 1718 | Décision 39, 1er critère : 2 commandes, 4 pièces, le plus gros volume en pièces des gammes reconnues. |

Ventes (requête `sql/q10_ventes_nom.sql`, lue à 11:04 UTC) : 21 commandes payées et non
annulées sur les 12 derniers mois, 27 en comptant les annulées. La colonne
`___xtr_order_line.orl_pg_id` ne contient pas l'identifiant de gamme (0 correspondance sur 27
lignes). Le rattachement s'est donc fait par le nom, et 14 lignes sur 27 seulement ont trouvé
leur gamme (`resultats/q10.txt`).

La première vente par le nombre de commandes est « Jeu d'émetteurs et récepteurs embrayage »
(4 commandes), mais ce nom ne correspond à aucune gamme affichée. Les candidates proches sont
234 « Emetteur d'embrayage » et 620 « Récepteur d'embrayage » (`resultats/q11.txt`). Le
rattachement est **non vérifié**, alors je ne l'ai pas retenue.

**Constat clé :** le cardan et la sphère de suspension n'ont **aucun** mot-clé dans
`__seo_keywords` et aucune ligne dans `__seo_type_vlevel` (`resultats/q11.txt`). Pour ces deux
gammes vendues, le V-Level n'existe pas. Les pages R1 sont pourtant servies (200, 11:05 UTC).

**Clio III 1.5 dCi** (`sql/q05_clio3.sql`, `resultats/q05b.txt`) : la base compte 18
motorisations 1.5 dCi, réparties sur les modèles 140004 CLIO III, 140005 CLIO III Break et
11387 CLIO III Camionnette. Parmi elles, 13 sont affichées (`type_display = 1`). Le type
principal retenu ici est le **19051**, « 1.5 dCi 68 ch » (2005–2012, affiché). C'est celui que
cite le mot-clé V3.

Recoupement avec des sources publiques (décision 159). L'argus et auto-data.net confirment les
puissances 68, 75, 86, 88 et 103 à 106 ch :
- [zeperfs, 1.5 dCi 68 ch](https://zeperfs.com/fiche5763-renault-clio-iii-1-5-dci.htm) ;
- [auto-data, 86 ch](https://auto-data.net/en/renault-clio-iii-phase-ii-2009-1.5-dci-86hp-24851) ;
- [auto-data, 75 ch](https://auto-data.net/en/renault-clio-iii-phase-ii-2009-1.5-dci-75hp-10408) ;
- [L'argus, 105 ch](https://www.largus.fr/fiche-technique/Renault/Clio/III+B-C85/2010/Berline/15+dCi+105ch+FAP+Dynamique+5p-990793.html) ;
- [L'argus, 90 ch / 88 ch](https://www.largus.fr/fiche-technique/Renault/Clio/III+B-C85/2012/Berline/15+dCi+90ch+Expression+Clim+eco²+5p-1081449.html).

Les types à 64, 65 et 82 ch (26627, 30141, 28839) restent **non vérifiés** : aucune fiche
trouvée. Ce ne sont pas des sources constructeur. La fiche Renault elle-même est **non vérifiée**.

---

## 2.1 Ce qu'est le V-Level aujourd'hui

### La procédure

- **Doctrine.** `audit/levels-doctrine-cgc-vs-vlevel-2026-06-04.md:20` dit que `v_level` sert à
  « classer les véhicules les plus recherchés pour piloter le marketing ». Usage : « Admin +
  planification SEO ; **PAS le rendu public** ». Ce document distingue déjà trois échelles, qu'il
  ne faut pas confondre :
  - `v_level` (V1–V6) ;
  - `cgc_level` (placement public des véhicules, table `__cross_gamme_car_new`) ;
  - les niveaux L1–L5 du générateur SEO (budget de texte, `quality-validator.service.ts`).
- **Procédure opérationnelle.** `.claude/knowledge/ops/vlevel-v3-gamme-procedure.md` et la skill
  `vehicle-ops` (`.claude/skills/vehicle-ops/SKILL.md`, workflow V-Level).
- **Règles v5.0** (`packages/seo-roles/src/vlevel-invariants.ts`) :
  - les véhicules sont groupés par [modèle + énergie] ;
  - V3 est le champion du groupe, choisi par volume, puis par mot-clé le plus court, puis par
    ordre alphabétique ;
  - V4 regroupe le reste du groupe ;
  - V2 regroupe les 10 meilleurs champions (`VLEVEL_V2_CAP = 10`, ligne 29) ;
  - V5 regroupe la famille (frères et enfants) ;
  - V1 et V6 ne sont pas construits.

  Le garde-fou « le mot-clé parle bien de la pièce » (`GAMME_PART_TERMS`, ligne 113) ne couvre
  que les gammes 82, 402 et 124, **pas le filtre à huile**.

### Qui écrit

1. Le recalcul admin (`admin-gammes-seo.service.ts:1096-1108` → `gamme-vlevel.service.ts`) et les
   scripts `scripts/insert-missing-keywords.ts --recalc` écrivent `__seo_keywords.v_level`.
2. `scripts/seo/rebuild-type-vlevel.py:47-65` recopie ces niveaux dans `__seo_type_vlevel`, par
   `INSERT … ON CONFLICT DO UPDATE`. Le script **ne supprime jamais**.
3. Des scripts SQL de correction datés de juin 2026, par exemple
   `scripts/seo/vlevel-v3-apply-filtre-huile-blocked-clear-2026-06-07.sql`, ont réélu des
   champions directement dans `__seo_keywords`.

### Qui lit

Recherche `git grep` dans `backend/src`, `frontend/app`, `packages` et `scripts`, plus une
lecture des fonctions SQL (`sql/q04_dbobjects.sql`).

**Dans le code, uniquement de l'admin :**
- `gamme-vlevel.service.ts`, `gamme-detail-enricher.service.ts`, `gamme-seo-badges.service.ts` ;
- `keywords-dashboard.service.ts` et son contrôleur ;
- les écrans `admin.v-level-status.tsx` et `components/admin/gamme-seo/VLevel*.tsx`.

Aucune route publique de `frontend/app/routes` ne lit `v_level`.

**`__seo_type_vlevel`** : seul `scripts/seo/rebuild-type-vlevel.py` la cite, ainsi que les types
générés. Aucune fonction SQL et aucune vue ne la lit (`resultats/q04.txt`, Q4a). Le compteur
d'accès affiche 49 lectures séquentielles et 15 par index. Les dernières sont les miennes, et
la date de remise à zéro du compteur est vide : l'usage passé est donc **non vérifié**.

**En base** : des fonctions admin (`get_vlevel_*`), des déclencheurs et des fonctions de
maintenance (`propagate_vlevel_per_typeid`, `backfill_seo_keywords_type_ids`…). Le déclencheur
de contrôle `trg_vlevel_integrity` est **désactivé** (Q4c).

### Niveau atteint, usage par usage (échelle L0–L4 de `capability-acceptance`)

| Usage | Niveau | Preuve |
|---|---|---|
| Calcul V2–V5 dans `__seo_keywords` | L1 | Code branché (admin + scripts). Test `gamme-seo-badges.vlevel-stats.test.ts` présent mais non exécuté ici. L2 **non vérifié**. |
| Recopie dans `__seo_type_vlevel` | L1, sans consommateur | Écrit par un script, lu par personne. Dernière écriture le 24 avril 2026. |
| Tableaux de bord V-Level (admin) | L1 | Routes admin présentes. Le parcours n'a pas été observé (**non vérifié**). |
| Cartes de motorisation R1 | Sans objet | Le V-Level n'y est pas utilisé (§2.2). |
| Titres, méta et H1 R1/R2 | Sans objet | Idem (§2.2). |
| Maillage, hub « money » du sitemap | Sans objet | Le hub lit le volume, pas le V-Level, et sa fonction est cassée (§2.2). |

## 2.2 Sert-il une page réellement servie ?

**Non.** Le détail :

**Page R1 `/pieces/filtre-a-huile-7.html`**, servie en 200 en DEV (215 413 octets) et sur
`www` (220 983 octets) à 11:01:29 UTC.
- La fonction `get_gamme_page_data_optimized` (`resultats/rpc-get_gamme_page_data_optimized.sql`)
  construit les cartes depuis `__cross_gamme_car_new` avec `cgc_level = '1'`, à 3 par marque au
  plus et 20 au plus (lignes 99–123).
- Les fragments de phrase viennent de `__seo_item_switch` (lignes 141–157).
- Ni `v_level`, ni `__seo_keywords`, ni `__seo_type_vlevel` n'y figurent.
- `gamme-response-builder.service.ts` ne contient aucune référence au V-Level. Les cartes
  utilisent `cgc_level` et les fragments.

**Cartes** (`sql/q13_cartes_cgc.sql`, lue à 11:05 et 11:08 UTC) :
- la gamme 7 a 19 véhicules de niveau 1, et la page en affiche 12 ;
- la gamme 13 en a 20, et la page en affiche 12 ;
- la gamme 1718 n'en a aucun, ce qui explique pourquoi la sphère de suspension n'affiche aucune
  phrase de carte.

Pourquoi 12 cartes sur 19 ou 20 : sans doute une limite d'affichage, **non vérifié**.

**Page R2** `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19051.html` : servie
en 200 et `index, follow` sur le DEV comme sur `www` (11:05:36 UTC).
- Le titre ne dépend pas du V-Level.
- Seul le complément de la méta description lit `__seo_keywords`, mais il lit le mot-clé et le
  volume, pas `v_level` (`rm-builder.service.ts:868-889` ; `vehicle-aware-description.composer.ts:59`
  et `:88`). Il ne garde que trois modificateurs : « avant », « arrière », « gauche ».
- Le type 30141 (non affiché) sert une page de remplacement en `noindex, follow`.

**Les titres R2 ne concordent pas entre le DEV et `www`.**
- Pour la 19051, le DEV affiche « Filtre à huile Renault Clio III 1.5 dCi 68 ch », alors que
  `www` ajoute « à partir de 5.00€ ».
- Pour la 19052, le DEV garde encore le prix.

Cet écart correspond au changement de titre de #2212 (commit `7f4dded37` sur `main`).
L'explication par un cache est **non vérifiée**. Dans tous les cas, ces titres n'ont aucun
rapport avec le V-Level.

**Hub « money » du sitemap** (`sitemap-v10-hubs-priority.service.ts:69-82`).
- Il appelle `get_top_money_gammes`, qui additionne le **volume** de `__seo_keywords` par gamme,
  pas `v_level`.
- La fonction échoue en base avec `relation "__products_gammes" does not exist` (constat de cette
  session).
- Le service retombe donc toujours sur une liste écrite en dur : `['402','82','7','8','400','401']`.

## 2.3 Pourquoi `__seo_keywords` et `__seo_type_vlevel` se contredisent

Requêtes : `sql/q02_distrib.sql` et `sql/q03_pg7.sql`, lues à 10:59–11:00 UTC.

| | `__seo_keywords` | `__seo_type_vlevel` |
|---|---|---|
| Lignes | 13 978 | 6 476 |
| Gammes | 25 | 16 (toutes incluses dans les 25) |
| Dernière écriture | 2026-06-18 (import Google Ads) | 2026-04-24 |
| Filtre à huile V2 / V3 / V4 | 0 / 117 / 1 702 | 73 / 45 / 986 |
| Filtre à huile, dernière écriture | 2026-06-18 | 2026-02-01 |

Sources de `__seo_keywords` :
- `google-ads-kp` : 10 581 lignes, collectées du 12 avril au 18 juin 2026 ;
- `keyword-engine` : 3 363 lignes, collectées du 10 février au 24 avril 2026 ;
- `google-paa` : 34 lignes, du 30 mars 2026, sans niveau.

**Causes.**
1. Les champions ont été réélus en juin, directement dans `__seo_keywords` (scripts du 7 juin,
   import du 18 juin). La recopie `rebuild-type-vlevel.py` n'a pas été relancée depuis le 24 avril.
   Pour le filtre à huile, la projection date même du 1er février.
2. Quand on la relance, la recopie met à jour les lignes existantes mais ne retire jamais un
   ancien V2 (`rebuild-type-vlevel.py:47-65`). Une relance ne ferait donc pas disparaître les 73
   V2 du filtre à huile.
3. Les noms de niveaux ne veulent pas dire la même chose dans les deux tables : V2 =
   « champion », V3 = « variant », V4 = « catalog », V5 = « sibling ».

**Laquelle le code suit-il ?** L'admin lit `__seo_keywords`. Personne ne lit `__seo_type_vlevel`.

**Pourquoi le filtre à huile n'a aucun V2 dans `__seo_keywords` ?** Les règles prévoient 10 V2
par gamme. La cause est **non vérifiée**. Piste : la réélection de juin aurait remplacé les
champions sans remonter les 10 premiers en V2.

## 2.4 Les règles V1–V5 sont-elles respectées dans les données ?

Requête : `sql/q12_regles.sql`, lue à 11:04:50 UTC.

- **V2 limité à 10 par gamme.**
  - `__seo_keywords` dépasse pour la gamme 73 (11) et la gamme 3859 (26).
  - `__seo_type_vlevel` dépasse pour les gammes 7 (73), 8 (22), 9 (27), 424 (11) et 3859 (25).
- **Un seul V3 par groupe [modèle + énergie].**
  - Respecté pour le filtre à huile : 144 groupes, aucun doublon.
  - Violé pour la gamme 3859 (7 groupes avec plusieurs V3), la gamme 73 (2) et la gamme 70 (1).
  - Un groupe sans V3 n'est pas forcément une erreur : son champion peut être en V2.
- **V3 rendable** : le filtre à huile a 2 V3 sans `type_id` sur 117. Aucun V3 ne pointe vers un
  type non affiché.
- **V5** : seules les gammes 82, 402 et 124 en ont, toutes venues de `keyword-engine`. L'union
  « frères + enfants » n'existe dans aucun code (constat déjà fait par la doctrine §8).
- **V1 et V6** : jamais construits.

### Pourquoi les mots-clés véhicule n'ont pas de `type_id`

L'import Google Ads classe en « générique » des requêtes qui citent un modèle. Pour le filtre à
huile, 692 des 1 507 lignes génériques de `google-ads-kp` citent un modèle selon un motif simple.
C'est une **estimation** (motif en `sql/q12_regles.sql`, Q12d), qui peut contenir des faux positifs.

Exemple (`resultats/q06.txt`, Q6a) :
- « filtre a huile clio 3 1.5 dci » (Google Ads) : générique, V4, sans modèle ni `type_id` ;
- « filtre a huile clio 3 1.5 dci » (keyword-engine) : véhicule, V3, `type_id` 19051.

La même requête existe donc deux fois, avec deux classements. De même, « filtre a huile clio 3 »
(Google Ads, générique, V4, 500) et « filtre à huile clio 3 » (keyword-engine, véhicule, V3, 500)
diffèrent seulement par l'accent.

**Le choix du `type_id` est arbitraire quand la requête couvre plusieurs moteurs.**
- « filtre à huile clio 3 » pointe vers le 11056 (1.2 16V essence, 103 ch), alors que la
  requête ne dit ni moteur ni énergie.
- « filtre a huile clio 3 1.5 dci » pointe vers le 19051 (68 ch), alors que 13 motorisations
  1.5 dCi affichées existent.
- Google Ads donne des volumes par tranches (50, 500, 5 000). Beaucoup de champions sont donc
  départagés par la longueur du mot-clé, pas par la demande (Q6e : 18 des 20 premiers V3 du filtre
  à huile ont le volume 50).

### Mots-clés Google Ads véhicule qui tombent sur une vraie page

Requête Q12e. La décision 48 parle de « pages indexables, soumises, indexées »
(`.spec/00-canon/ai-registry/agent-operating-map.yaml:1053`). Je l'approche ici par la présence
du couple (gamme, type) dans `__sitemap_p_link` et par `type_display = 1`. L'indexation réelle
par Google est **non vérifiée**.

| Source | Mots-clés « véhicule » | Avec `type_id` | Page au sitemap | Page au sitemap et type affiché |
|---|---|---|---|---|
| google-ads-kp | 1 053 | 401 | 242 | 242 |
| keyword-engine | 2 529 | 2 426 | 2 138 | 1 901 |

Toutes catégories confondues, sur 10 581 mots-clés Google Ads avec volume, **460 ont un
`type_id`** (Q12f). Pour le filtre à huile × Clio III 1.5 dCi, 12 des 18 types ont une page au
sitemap (`resultats/q07.txt`, Q7a). Les 6 absents sont les 4 non affichés et les 2 de la
Camionnette (11387).

## 2.5 Ce que dit Search Console (sans confondre avec Google Ads)

Requêtes : `sql/q08_gsc.sql`, lues à 11:03:47 UTC. Les tables `__seo_gsc_daily` (requête × page)
couvrent du 1er avril au 17 novembre 2026. `__seo_gsc_daily_page_totals` (totaux par page)
couvre du 1er juin au 17 novembre, dernière collecte le 20 novembre à 04:00 UTC.

Google Ads mesure une **demande** (tranches mensuelles). Search Console mesure notre
**exposition** (impressions, clics, position). Les deux ne se comparent pas terme à terme.

**Page R1 du filtre à huile**, par mois :

| Mois | Clics | Impressions | Position moyenne |
|---|---|---|---|
| Juin 2026 | 7 | 473 | 22,9 |
| Juillet | 10 | 1 242 | 20,7 |
| Août | 3 | 1 226 | 32,9 |
| Septembre | 1 | 763 | 29,9 |
| Octobre | 2 | 1 103 | 34,8 |
| Novembre (1er au 17) | 5 | 757 | 39,8 |

**Requêtes qui affichent la page R1** (Q8g) : uniquement des requêtes génériques (« filtre a
huile » 683 impressions, position 58,6 ; « prix filtre à huile » 371, position 35,3). Aucune
requête véhicule. Au niveau requête, les clics valent 0 : Google masque une partie des requêtes,
et les clics par page ne s'y retrouvent pas.

**Pages R2 Clio III du filtre à huile** (Q8c) : 7 pages ont eu des impressions depuis juin, au
plus 31, et **0 clic**. La 19052 (86 ch) obtient 30 impressions en position 10,5, contre 2
impressions en position 32 pour la 19051 (68 ch), qui porte pourtant le V3. Le V-Level ne
désigne donc pas la page que Google montre.

**Toutes les pages R2 du filtre à huile** (Q8d) : 2 205 pages avec impressions, 265 clics,
19 789 impressions.

**Demande comparée à l'exposition**, pour la Clio 3 :
- « filtre a huile clio 3 » : tranche Google Ads de 500 par mois, contre 14 impressions Search
  Console en 7,5 mois, en position 43,6 ;
- « filtre a huile clio 3 1.5 dci » : tranche de 500, contre 6 impressions, en position 31,3.

**google.fr** : **non vérifié**. Je n'ai pas d'accès à une page de résultats google.fr depuis
ce poste. Le moteur de recherche disponible ici n'est pas google.fr.

## 2.6 Les phrases des cartes R1 : liées au V-Level ? utiles ?

**Ce que voit le visiteur.** Une seule phrase, écrite en dur dans le front :
`frontend/app/components/pieces/MotorisationsSection.tsx:253`, « Sélectionnez cette
motorisation pour afficher les références compatibles. »
- Elle ne s'applique qu'à la variante R1 (`isR1`, ligne 56), utilisée par
  `pieces.$slug.tsx:1043`.
- Elle apparaît 12 fois sur `/pieces/filtre-a-huile-7.html` et 12 fois sur
  `/pieces/cardan-13.html`, en DEV comme sur `www` (11:01 et 11:05 UTC).
- Elle n'apparaît pas sur la sphère de suspension, qui n'a aucune carte.
- **Elle ne dépend pas du V-Level.**

**Ce que produit le backend sans que le visiteur le voie.**
`gamme-response-builder.service.ts` (lignes 540–692) compose pour chaque carte :
- un titre de la forme « Filtre à huile RENAULT CLIO III 1.5 dCi, contrôler s'il est usé » ;
- une description tirée de `__seo_item_switch` par un hachage du `type_id`
  (`gamme-rpc.service.ts:470`).

Ces textes partent dans le HTML, mais seulement dans les données sérialisées (`<script>`), pas
dans le texte visible (capture du 11:01:29 UTC). Ils non plus ne dépendent pas du V-Level.

**Fragments du filtre à huile** (`resultats/q09.txt`, Q9c et Q9d) :
- alias 1 : 26 lignes, mais seulement 19 phrases distinctes (« changer lors de vidange » et 6
  autres en double) ;
- alias 2 : 10 bénéfices génériques (« protéger le moteur », « prolonger la durée de vie »…),
  dont « garantir filtrer les impuretés de », qui est incorrect en français ;
- alias 3 (commun à toutes les gammes) : 45 phrases.

`__seo_gamme_car_switch` compte 6 542 lignes sur 221 gammes, mais seulement 1 818 textes
distincts. `__seo_type_switch` compte 134 lignes (Q9e).

**Défaut annexe.** `gamme-response-builder.service.ts:605` écrit « les plaquettes de frein »
devant la finition pour **toutes** les gammes. Ce texte non visible est donc faux pour le
filtre à huile.

**Constat de DU (complément n° 5, PR #2211,
`docs/audit/maquette-r1-filtre-a-huile-20261119/REVUE-EXPERTE.md:135-142`, tête `7d4a4f6d4b`).**
Il porte sur la **maquette** #2210, où le builder sert des phrases distinctes sur les cartes :
- 7 bénéfices seulement pour 19 cartes, dont « protéger le moteur » 6 fois ;
- cinq bénéfices génériques qui reviennent sur 95 à 96 des 101 gammes qui ont des bénéfices ;
- la phrase répète le modèle, le moteur et les chevaux déjà affichés.

Je ne l'ai pas refait, je le cite. Il vaut pour la maquette, pas pour le site actuel, où le
visiteur voit une seule phrase fixe.

**Valeur pour le SEO et pour le visiteur.**
- **Phrase fixe** : elle n'apporte aucun mot propre à la carte. Elle répète 12 fois le même
  texte et n'aide le visiteur qu'à comprendre qu'il faut cliquer. Le titre de la carte
  (marque + modèle) et le lien suffisent pour ça.
- **Phrases à fragments** : uniques par carte, mais fabriquées à partir de 10 à 26 morceaux
  communs. Ce sont des variantes de surface, pas de l'information propre au véhicule. Les
  afficher augmenterait le risque de « contenu à grande échelle » sans apporter de fait nouveau
  (référence, cote, intervalle de vidange…).
- **Ce que le V-Level pourrait apporter et n'apporte pas aujourd'hui** : choisir quelles
  motorisations montrer en premier. Ce choix est fait aujourd'hui par `cgc_level`. Or les données
  montrent que le V3 ne désigne pas la page que Google expose (§2.5).

---

## Options, usage par usage (aucune décision prise)

| Usage | Garder | Corriger | Retirer |
|---|---|---|---|
| `__seo_type_vlevel` (table recopiée) | Rien à faire. Elle reste fausse et trompe quiconque la lit (73 V2 au lieu de 0). | Relancer la recopie **et** ajouter la suppression des lignes absentes. Coût : une modification de script et une écriture en base (accord de Marwane). Ça ne casse rien, car personne ne la lit. | Archiver la table. Ça casse uniquement `rebuild-type-vlevel.py` et les types générés. Relève de la décision 162 : hors de ce mandat. |
| `v_level` dans `__seo_keywords` (admin) | Les tableaux admin restent. Le classement continue de reposer sur des tranches Google Ads et des `type_id` arbitraires. | Rattacher les mots-clés Google Ads « génériques » qui citent un modèle (≈ 692 pour le filtre à huile, estimation), dédoublonner accent/sans accent, recalculer. Coût : plusieurs scripts, des écritures en base et une revue humaine (`type_id` à valider, décision 159). Ça ne casse aucune page publique. | Arrêter le calcul et garder les mots-clés (volume, demande). Ça casse les écrans admin V-Level et les fonctions `get_vlevel_*`. Aucune page servie touchée. |
| Phrase fixe des cartes R1 (front) | 12 répétitions identiques par page, sans valeur SEO. | La remplacer par un fait propre à la carte (années, puissance déjà affichée ou nombre de références). Coût : une PR front. Zone SEO indexée, donc accord de Marwane. Aucun lien avec le V-Level. | La supprimer et garder titre + lien. Coût : une ligne. Le visiteur perd l'indication « cliquez ici ». |
| Phrases à fragments (backend, non visibles) | Elles restent invisibles et alourdissent le HTML sérialisé. | Corriger la ligne 605 (« plaquettes de frein ») et les fragments fautifs. Coût : du code et des écritures en base. Inutile tant qu'elles ne sont pas affichées. | Ne plus les produire. Ça casse la maquette #2210 si elle les affiche (à voir avec DS et DU). |
| Hub « money » du sitemap | La liste écrite en dur reste en place sans le dire. | Réparer `get_top_money_gammes` (table `__products_gammes` absente). C'est une migration en base, avec accord. | Retirer l'appel et assumer la liste. Le choix reste écrit en dur. |

## Inconnues et limites

- Indexation réelle des pages R2 par Google : **non vérifiée** (pas d'accès à l'inspection d'URL).
- google.fr : **non vérifié**.
- Fiche constructeur Renault des Clio III 1.5 dCi : **non vérifiée**. Seules des fiches
  publiques ont été recoupées, et les types à 64, 65 et 82 ch restent non confirmés.
- Usage passé de `__seo_type_vlevel` : **non vérifié**, car la date de remise à zéro des
  compteurs est vide.
- Cause de l'absence de V2 pour le filtre à huile dans `__seo_keywords` : **non vérifiée**.
- La première requête de ventes (`sql/q09_ventes_switch.sql`, Q9a et Q9b) groupe par
  `orl_pg_id`, qui ne contient pas l'identifiant de gamme. Ses résultats sont faux et remplacés
  par `sql/q10_ventes_nom.sql`. Je les laisse pour la trace.
- Les décisions 16, 39, 46, 157, 158, 159 et 162 sont citées d'après le mandat. Elles ne sont
  pas dans le dépôt (pages de pilotage).
- Les tests admin V-Level n'ont pas été lancés.

## Contenu du dossier

- `sql/` : les requêtes, toutes en lecture seule (`SELECT`, catalogue système).
- `resultats/` : leurs sorties brutes, sans les avertissements de collation de la base, et le
  texte de la fonction `get_gamme_page_data_optimized` lu en base.
