# Mandat EH — noms de motorisation vérifiés sur sources extérieures (complète #2214)

Mandat « 07 Pages et SEO » du 2026-11-20. Les 205 erreurs de nom de motorisation
relevées par le mandat EE (`../mandat-ee-noms-motorisation-20261120/erreurs.tsv`)
sont reprises une à une contre des sources publiques. Il en sort :
- la migration EE (`type_name_meta`), restreinte aux cas confirmés ;
- une migration distincte (`type_name`) pour les noms d'origine faux.

Rien n'est appliqué en base, rien n'est déployé.

## États

| État | Contenu |
|---|---|
| Vérifié à la source | 199 cas : 193 « nom d'affichage faux, nom d'origine juste », 2 « nom d'origine faux aussi », 2 « nom d'origine faux (nom d'affichage juste) », 6 « les deux justes » — URL par ligne dans `verdicts-sources.tsv` |
| Incertain | 2 cas (29807 Ford Mondeo V, 55786 Hyundai i30 II) : aucune correction |
| Écrit | migration EE restreinte à 164 lignes ; migration EH de 4 lignes, avec leur `.down.sql` et leurs contrôles 07 et 13 |
| Testé | Migration Safety (étapes de `ci.yml` rejouées en local) et essai de bout en bout sur PostgreSQL 17 jetable : application, rejeu, retour et trois refus de garde |
| Non appliqué | aucune migration n'est appliquée ; l'extrait `ownership.yaml` reste un patch non appliqué |
| Non déployé | PROD sert toujours les valeurs relevées le 2026-11-20 (10 GET, `prod-get-r8.tsv`) |

## Valeur retenue (règle)

1. La valeur juste se rapproche **par code moteur, puissance (ch/kW), cylindrée, carburant et années**, jamais par le nom seul.
2. Le nom retenu est celui du constructeur ou d'un catalogue de référence (TecDoc et ses reprises), écrit **dans la forme que la base emploie déjà pour les types voisins**. Par exemple « 2.2 D Multijet » (forme TecDoc FR de 8 types de la base), et non « 2.2 Multijet 16v » de la fiche technique.
3. Si le nom d'origine (`type_name`) est juste, le nom d'affichage reçoit sa valeur : c'est la règle EE, inchangée.
4. Si le nom d'origine est faux, la cible est fixée par ligne dans `cibles-origine.tsv`, avec la justification de forme.
5. Les cas « incertain » et « les deux justes » ne sont pas corrigés.
6. Les 32 cas écartés par le contrôle 6.6 de EE reçoivent un verdict et restent hors migration.

## 6.1 Sources

- Recherche web et pages publiques seulement. Aucune page derrière connexion ou payante, aucun contournement.
- Ordre suivi : Fiat/Lancia/Jeep/Alfa (44), puis Ford (107), puis BMW/Mercedes/Mini (27), puis les autres marques (27).
- Exigence : au moins une URL par ligne qui donne le code moteur ou la puissance avec le nom. Quand deux sources divergent, les deux sont citées.
- Sources principales :
  - fiches techniques : auto-data.net, ADAC Autokatalog, L'argus, caradisiac, autoscout24, Wikipédia ;
  - catalogues qui reprennent TecDoc : der-ersatzteile-profi.de, motonet, Mecatechnic, b-parts.
- Sites refusés (403, 405, 429, 503 ou 522), sans tentative de contournement : mister-auto, autodoc (deux domaines), oscaro, hiamag, accès direct à b-parts, boutique Ford UK, PDF Ford Mondeo. rolling.hu renvoie vers une connexion : non consulté.
- Contre-vérifications de la session principale par recherche web indépendante, avec le même résultat que les relevés :

  | Type | Véhicule | Point vérifié |
  |---|---|---|
  | 33593 | Lancia Phedra 2.2 170 ch | cylindrée 2179 cm³ |
  | 73442 | C 220 d coupé | nom C 220 d |
  | 33063 | GL 350 BlueTEC | nom 350 BlueTEC |
  | 60342 | A3 45 TFSI | badge apparu en 2017 |
  | 66951 | Fiesta 1.0 EcoBoost 125 ch | nom 1.0 EcoBoost |
  | — | Kuga 1.6 EcoBoost 182 ch | les sources divergent sur le code (JTMA ou JQMA), pas sur le nom EcoBoost |
  | — | Mondeo III 2.0 16V TDDi / TDCi 115 ch | nom 16V TDDi / TDCi (b-parts) |

- Fichiers :
  - relevés bruts : `recherche/*.tsv` (8 colonnes) ;
  - fusion contrôlée : `11-decider.py`. Il vérifie la couverture exacte des 205 cas, l'absence de doublon, la présence d'une URL et la cohérence avec `erreurs.tsv` et `cibles-origine.tsv`.

**Verdict revu par la session — 66951 Ford Fiesta VI Berline.** L'agent proposait « nom d'origine faux aussi » au motif que « Titanium Plus » est une finition.

Le nom d'origine « 1.0 Titanium Plus EcoBoost » désigne pourtant le bon moteur, sans confusion possible. La base suit déjà cette convention TecDoc : « 2.0 Titanium Flex » (66401), « 1.0 EcoBoost Active ».

Ce cas est donc classé « nom d'affichage faux, nom d'origine juste » et soumis à Marwane (voir les points en fin de document).

## 6.2 Forme des noms : google.fr et GSC

**google.fr : mesure non obtenue.** Les quatre requêtes ont toutes reçu un 302 vers `consent.google.fr` vers 09:09 UTC, sans résultat. La page de consentement n'a pas été franchie. Requêtes envoyées :
- `fiat ducato 2.3 multijet`
- `ford focus 1.0 ecoboost`
- `bmw 320d e90`
- `toyota yaris 1.3 vvti`

**GSC, 90 jours** (`__seo_gsc_daily`, du 2026-08-20 au 2026-11-17)
- Requêtes relevées le 2026-11-20 entre 09:08:26 et 09:08:50 UTC ; part anonymisée relevée à 09:29:32 UTC.
- Impressions avec requête : 185 180 sur 454 821 impressions de la propriété. **59,3 % des impressions sont anonymisées** et absentes des comptages ci-dessous.

| Famille | Forme | Requêtes | Impressions | Clics | Exemples réels |
|---|---|---:|---:|---:|---|
| Fiat | « multijet » | 44 | 143 | 2 | « filtre à huile fiat doblo 1.3 multijet » (21), « pompe a eau fiat doblo 1.3 multijet » (11), « thermostat fiat ducato 2.3 multijet » (5) |
| Fiat | « jtd » | 16 | 48 | 0 | « capteur de vitesse fiat ducato 2.8 jtd » (13), « courroie accessoire 1.9 jtd » (8), « alternateur fiat doblo 1.9 jtd » (6) |
| Fiat | « d multijet » | 0 | 0 | 0 | — |
| Ford | « ecoboost » | 2 | 12 | 0 | « thermostat ford focus 1.0 ecoboost » (11), « courroie de distribution ford focus 1.0 ecoboost » (1) |
| Ford | « econetic » | 1 | 1 | 0 | « ford b max econetic » (1) |
| BMW | collée (« 320d ») | 23 | 31 | 0 | « alternateur bmw 320d » (4), « pieces detachees bmw 530d » (3), « schema courroie accessoire bmw 320d e90 » (2) |
| BMW | espacée (« 320 d ») | 0 | 0 | 0 | — |
| Toyota | « vvti » | 9 | 77 | 3 | « courroie accessoire toyota yaris 1.3 vvti » (51), « courroie accessoire toyota yaris 13 vvti » (9), « toyota corolla e12 1.6 vvti » (4) |
| Toyota | « vti » | 0 | 0 | 0 | — |

Détail : `gsc-familles.tsv`.

**Lecture :**
- La forme fautive de l'affichage n'est tapée pour aucune famille : « Econetic » 1 impression, « VTi » chez Toyota 0.
- La forme d'origine domine (EcoBoost, VVTi, JTD et Multijet).
- La forme TecDoc « D Multijet » et la forme BMW espacée « 320 d » ne sont jamais tapées : les internautes tapent « multijet » et « 320d ».
- Le mandat ne change pas cette forme d'écriture, qui est celle des voisins en base (point pour Marwane).

## 6.3 Les 205 cas

`verdicts-sources.tsv` donne, pour chaque cas :
- la valeur juste, le code moteur, la puissance et les années selon la source ;
- les URL des sources ;
- le verdict, avec sa justification ;
- l'appartenance aux exclusions 6.6 de EE.

`decisions.tsv` donne l'effet de chaque cas sur les migrations.

| Verdict | Cas | Migration |
|---|---:|---|
| nom d'affichage faux, nom d'origine juste | 193 | 164 en migration EE ; 29 écartés par 6.6 (verdict seul) |
| nom d'origine faux aussi | 2 | migration EH (33063, 33593) |
| nom d'origine faux (nom d'affichage juste) | 2 | migration EH (60342, 73442) |
| les deux justes | 6 | aucune (5260, 11364, 11365, 13620, 28249, 62033) |
| incertain | 2 | aucune (29807, 55786) |

Les 32 exclusions EE se répartissent ainsi : 29 « affichage faux », 2 « les deux justes » (11364, 11365) et 1 « incertain » (55786).

**Les quatre noms d'origine faux**

| Type | Véhicule | type_name → | type_name_meta → | Sources |
|---|---|---|---|---|
| 33063 | Mercedes GL X164, 211 ch, OM 642.820 | « 320 CDI 4-Matic » → « 350 BlueTEC 4-Matic » | « 320 CDI 350 BlueTEC 4Matic » → « 350 BlueTEC 4Matic » | GL 350 CDI BlueTEC 211 ch 2009-2012 ; le GL 320 CDI européen fait 224 ch |
| 33593 | Lancia Phedra, 170 ch, 2179 cm³ | « 2.0 D Multijet » → « 2.2 D Multijet » | « 2.0 JTD » → « 2.2 D Multijet » | auto-data « 2.2 Multijet (170 ch) », ADAC « 2.2 jtd Multijet 16v » 125 kW, L'argus « 2.2 JTD 170 » |
| 60342 | Audi A3 8V Sportback, 220 ch, 2015-2016 | « 2.0 45 TFSI » → « 2.0 TFSI » | inchangé (« 2.0 TFSI ») | badges à deux chiffres annoncés par Audi le 23/08/2017 ; catalogues « 2.0 TFSI » (codes CHHB et CNTC selon la source) |
| 73442 | Mercedes C 220 d coupé C205, 163 ch, OM 651 | « 200 D » → « 220 D » | inchangé (« 220 d ») | autoscout24 : C 220 d coupé 120 kW / 163 ch ; le C 200 d coupé n'arrive qu'en 2018 (160 ch) |

Sans le mandat EH, la migration EE aurait propagé les quatre noms d'origine faux dans le `<title>` : « 320 CDI 4-Matic », « 2.0 D Multijet », « 2.0 45 TFSI » et « 200 D ». Elle aurait aussi réécrit les 6 cas « les deux justes » et 29807 (incertain).

**Tableau par marque**

Colonnes : AF = affichage faux ; OF = origine faux aussi ; OFa = origine faux, affichage juste ; DJ = les deux justes ; IN = incertain.

| Marque | Cas | AF | OF | OFa | DJ | IN | Migr. EE | Migr. EH | Aucune |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FORD | 107 | 106 | 0 | 0 | 0 | 1 | 92 | 0 | 15 |
| FIAT | 38 | 36 | 0 | 0 | 2 | 0 | 35 | 0 | 3 |
| BMW | 15 | 14 | 0 | 0 | 1 | 0 | 5 | 0 | 10 |
| MERCEDES | 10 | 8 | 1 | 1 | 0 | 0 | 6 | 2 | 2 |
| TOYOTA | 6 | 6 | 0 | 0 | 0 | 0 | 6 | 0 | 0 |
| AUDI | 6 | 3 | 0 | 1 | 2 | 0 | 3 | 1 | 2 |
| CITROËN | 5 | 5 | 0 | 0 | 0 | 0 | 5 | 0 | 0 |
| PEUGEOT | 3 | 3 | 0 | 0 | 0 | 0 | 3 | 0 | 0 |
| LANCIA | 2 | 1 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| ALFA ROMEO | 2 | 1 | 0 | 0 | 1 | 0 | 1 | 0 | 1 |
| HYUNDAI | 2 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 2 |
| JEEP | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| MINI | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| SKODA | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| MAZDA, DAEWOO, RENAULT | 3 | 3 | 0 | 0 | 0 | 0 | 3 | 0 | 0 |

**Tableau par famille** (familles de EE)

| Famille | Cas | AF | OF | OFa | DJ | IN | Migr. EE | Migr. EH | Aucune |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| abréviation ou désignation qui change le sens | 162 | 158 | 0 | 0 | 3 | 1 | 140 | 0 | 22 |
| nom d'une autre motorisation | 40 | 32 | 2 | 2 | 3 | 1 | 21 | 4 | 15 |
| cylindrée contredite | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| valeur vide ou parasite | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |

## 6.4 Migrations

| Fichier | Lignes | Colonnes écrites |
|---|---:|---|
| `backend/supabase/migrations/20261120_auto_type_name_meta_corrections_mandat_ee.sql` (+ `.down.sql`) | 164 (173 avant EH) | `type_name_meta` |
| `backend/supabase/migrations/20261120_auto_type_name_origine_corrections_mandat_eh.sql` (+ `.down.sql`) | 4 | `type_name`, et `type_name_meta` pour 33063 et 33593 |

**Génération** (ne pas éditer les migrations à la main) :

```
python3 -I 11-decider.py ../mandat-ee-noms-motorisation-20261120/erreurs.tsv recherche cibles-origine.tsv verdicts-sources.tsv decisions.tsv
node 14-collisions.mjs decisions.tsv <voisins.tsv> <vehicle-aware-label.ts> exclusions-eh.tsv
python3 -I ../mandat-ee-noms-motorisation-20261120/06-generer-migration.py ../mandat-ee-noms-motorisation-20261120/classement.tsv backend/supabase/migrations ../mandat-ee-noms-motorisation-20261120/07-controle-apres.sql ../mandat-ee-noms-motorisation-20261120/exclusions-6-6.tsv decisions.tsv
python3 -I 12-generer-migration-origine.py decisions.tsv backend/supabase/migrations 13-controle-apres.sql
```

`14-collisions.mjs` n'écarte aucun cas : `exclusions-eh.tsv` est vide. Le second passage de `11-decider.py` avec exclusions est donc sans objet.

**Garde EH**
- Chaque type doit exister et porter exactement le couple (`type_name`, `type_name_meta`) relevé le 2026-11-20, ou déjà le couple cible (rejeu).
- Toute autre valeur lève une exception avant toute écriture.
- Le nombre de lignes écrites est contrôlé.
- Les pages R8 sont invalidées et reconstruites par `mark_stale_with_followup_rebuild` (INC-2026-007), puisque `__vehicle_page_cache` n'a de déclencheur que sur `type_display`.
- Les deux listes sont disjointes. EH s'applique après EE (ordre alphabétique du runner).

**URL** : aucune ne dépend de `type_name` pour ces cas.
- Les URL R8 et R2 lisent `type_alias`, renseigné pour les 205 cas (0 vide, export `cas205.tsv`). Les migrations ne l'écrivent pas.
- Le repli sur `type_name` (`packages/seo-url-contract/src/url-rules.ts:34-52`) ne s'applique donc à aucun.
- Aucun cas n'est exclu pour ce motif.

**Migration Safety** (`migration-safety.txt`, 2026-11-20 09:28:17 UTC) : étapes de `ci.yml` rejouées en local, toutes en exit 0.
- squawk 2.52.1 : 0 problème sur les 2 migrations hors `.down` ;
- marqueurs `@non_transactional` réconciliés ;
- compilation PL/pgSQL des 4 blocs DO sur PostgreSQL 17, témoin négatif détecté ;
- surface DEFINER/anon inchangée.

**PostgreSQL 17 jetable** (`e2e-pg17.txt`, 2026-11-20 09:28:30 UTC, `15-e2e-pg17.sh`)
- Fixtures : 900 types de `classement.tsv` et la vraie fonction `mark_stale_with_followup_rebuild` de 20260425.
- Application EE : 164 lignes, contrôle 07 à 0 écart.
- Application EH : 4 lignes, contrôle 13 à 0 écart.
- Rejeu : 0 ligne écrite.
- Retour EH puis EE : empreinte initiale `b303d6f7…` retrouvée.
- Rejeu des retours : 0 ligne.
- Garde EH : refus, sans écriture, pour un `type_name` modifié, un `type_name_meta` modifié et un type absent.

`scripts/ci/check-no-direct-vehicle-cache-stale.sh` :
- aucune écriture directe de `stale` dans les migrations des mandats EE et EH ;
- le script sort en échec sur une violation antérieure (hors périmètre, voir plus bas). Il n'est branché ni en CI ni dans husky.

## 6.5 Effets

Sources : colonnes de `../mandat-ee-noms-motorisation-20261120/erreurs.tsv`. GSC sur 90 jours, fenêtre EE.

| Migration | Types | Ce qui change | Pages R8 indexables (dans le sitemap) | Pages R2 servables (indexables) | Impressions GSC R8 / R2 |
|---|---:|---|---:|---:|---:|
| EE (`type_name_meta`) | 164 | `<title>`, description et mots-clés R8 ; titre R2 (nom d'affichage, règle #2212) | 63 (60) | 2 468 (567) | 477 / 216 |
| EH (`type_name`) | 4 | H1 et contenu R8 ; et pour 33063 et 33593 aussi le `<title>` R8 et le titre R2 | 2 (1) | 41 (7), tous pour 33063 | 0 / 1 |
| Aucune | 37 | rien | 24 (23) | 923 (184) | 1 / 12 |

**Doublons** (`14-collisions.mjs`, règle de #2212, module `vehicle-aware-label.ts` sha256 `fb778f72…`) :
- Trois clés sont contrôlées :
  - le `<title>` R8 : nom d'affichage dans le modèle ;
  - le H1 R8 : `type_name` et puissance dans le modèle, comme le H1 servi (`r8-transform.ts:150`) ;
  - le titre R2 : modèles voisins et `buildR2TitleTypeLabel`.
- 1 264 pages examinées :

  | Doublons | Avant | Après les 168 corrections |
  |---|---:|---:|
  | `<title>` R8 | 818 | 788 |
  | H1 R8 | 26 | 26 |
  | Titres R2 | 20 | 20 |

  Aucune page unique ne devient doublon, aucune correction n'est écartée.

**PROD, état avant** (`prod-get-r8.tsv`) : 10 GET R8, un par seconde, de 09:20:08 à 09:20:19 UTC, tous en HTTP 200.

| Type | `<title>` servi | H1 servi | robots |
|---|---|---|---|
| 33593 | « … 2.0 JTD … » | « LANCIA PHEDRA 2.0 D Multijet 170 ch de 2008 à 2010 » | index |
| 73442 | « … 220 d … » | « … 200 D 163 ch » | noindex |
| 33063 | « … 320 CDI 350 BlueTEC 4Matic … » | « … 320 CDI 4-Matic 211 ch » | index |
| 60342 | « … 2.0 TFSI … » | « … 2.0 45 TFSI 220 ch » | noindex |

Les six autres pages (7761, 9129, 28249, 61907, 65090, 66324) montrent le nom d'affichage faux dans le `<title>` et le nom d'origine dans le H1.

## 6.6 Check-list Google

| Point | Constat et preuve |
|---|---|
| URL, alias, canonical | inchangés : seules `type_name` (4 types) et `type_name_meta` (166 types) changent ; URL et canonical lisent `type_alias` (205/205 renseignés) |
| Titre exact et descriptif | chaque nom retenu est confirmé par au moins une source extérieure (code moteur ou puissance, et nom), URL par ligne |
| Mots-clés inventés | aucun : valeurs prises dans le nom d'origine ou la forme TecDoc des voisins ; « 45 », « Econetic », « TDi » et « VTi » trompeurs retirés |
| Demande réelle | la forme corrigée domine la GSC (6.2) ; la forme fautive n'est pas tapée |
| Titres et H1 en double | aucune page unique ne devient doublon (6.5) |
| Indexation, robots, sitemap | inchangés ; aucune suppression de page |
| Cohérence title / H1 / contenu | les quatre cas EH alignent H1 et contenu sur la vraie motorisation ; les 164 cas EE alignent le `<title>` sur le H1 |
| Ampleur | 168 types, 65 pages R8 indexables ; correction factuelle sans réécriture de gabarit |
| Caches | R8 reconstruit dans chaque migration (test PG17) ; Redis TTL 1 h ; `seo:processed:*` expire seul (24 h) |
| meta_title / description / H1 optimisés | non touchés : `__seo_*`, `seo_custom` et gabarits restent tels quels |
| Réversibilité | `.down.sql` testés : empreinte initiale retrouvée |

## Réimport TecDoc

Un réimport n'écrase pas ces corrections, et ne les rejoue pas non plus.
- `scripts/tecdoc-pipeline/create-vehicles-p4a.py` insère avec `ON CONFLICT (type_id) DO NOTHING` : un type existant n'est pas réécrit.
- `fix-vehicles-massdoc.py` n'écrit que `type_name_url` et `type_alias`.

Un nouveau type importé reçoit le nom TecDoc brut. Si TecDoc porte la même erreur sur une autre motorisation (« 200 D », « 2.0 45 TFSI »…), elle réapparaîtra pour ce nouveau type : ce constat est à reporter côté source.

## Points pour Marwane

1. **Valider la liste** (`verdicts-sources.tsv`), avant toute application :
   - les 164 lignes EE ;
   - les 4 lignes EH.

   Toute ligne refusée se retire du bloc VALUES de la migration et de son `.down.sql`.
2. **Sur 66951** (Fiesta VI Berline), au choix :
   - garder « 1.0 Titanium Plus EcoBoost » comme nom affiché, c'est-à-dire le nom TecDoc avec finition (choix retenu) ;
   - ou corriger aussi l'origine en « 1.0 EcoBoost » : il faut alors ajouter une ligne à `cibles-origine.tsv` et régénérer.
3. **Réserves de source maintenues dans la migration EE :**
   - 61907, BMW X3 sDrive20i 1,6 l du marché turc : écart de puissance entre TecDoc (143 ch) et la fiche (170 HP) ;
   - 78195, Skoda Octavia III Combi « 2.0 TDI RS 4x4 » : l'entrée peut englober le Scout.
4. **Forme d'écriture « D Multijet » et « 320 d »** : 0 requête en 90 jours. Les internautes tapent « multijet » et « 320d ». La changer touche des centaines de types justes et sort de ce mandat.
5. **Les 32 exclusions 6.6 de EE** restent à arbitrer (puissance dans le titre R8 ou autre départage).
6. **Gestes réservés :**
   - appliquer l'extrait `ownership.yaml` (`../mandat-ee-noms-motorisation-20261120/ownership-extrait.patch`, mis à jour pour EH, `git apply --check` vert, non appliqué) ;
   - fusionner ;
   - appliquer les migrations ;
   - poser le tag.

## Constats hors périmètre (non corrigés)

- **Alias bâtis sur un nom d'affichage faux** (URL : interdit d'y toucher) :

  | Type | Alias |
  |---|---|
  | 12470 | `2-0-320-i` |
  | 60342 | `2-0-tfsi` |
  | 61907 | `sdrive-18-i` |
  | 11832 et 11857 | `2-0-520-i` |
  | 33593 | `2-0-jtd` (moteur de 2,2 l) |

- **Modèle 22035** : alias `a3-ii-sportback` pour un modèle nommé « A3 III Sportback ».
- **Codes moteur en base contredits par les sources :**
  - Jeep : code ENS ;
  - Ducato 2.2 de 2021 : codes listés à 120 ch ;
  - Ford : SFDA, YUDA, M8ME, Y7JA et SFCB introuvables ; Ranger ENQJ et GBVAJQJ introuvables.
- **Puissances en base contredites :** 5530 (150 ch en base contre 180 ch), 68897 (116 ch contre 141 ch).
- **29807 Mondeo V Berline** : « 4x4 » et le début 2013 du nom d'origine ne sont confirmés par aucune source.
- **Violation INC-2026-007 antérieure** : `backend/supabase/migrations/20260917_definer_rpc_anon_lockdown.sql` écrit `__vehicle_page_cache.stale` directement. `check-no-direct-vehicle-cache-stale.sh` n'est pas branché en CI.
- **Code mort** : `generateVehicleUrl` dans `enhanced-vehicle.api.ts`.
- **Collation de la base** : avertissement de version (153.120 contre 153.121) à chaque connexion en lecture.
- **#2214 n'est pas rebasée sur #2212 fusionnée** : la resynchronisation reste réservée (décision 122).

## Fichiers

| Fichier | Rôle |
|---|---|
| `recherche/*.tsv` | relevés par famille de marques |
| `cibles-origine.tsv` | valeurs cibles des noms d'origine faux |
| `11-decider.py` → `verdicts-sources.tsv`, `decisions.tsv` | verdicts et effet sur les migrations |
| `12-generer-migration-origine.py` → migration EH, `13-controle-apres.sql` | migration du nom d'origine |
| `14-collisions.mjs` → `exclusions-eh.tsv` | contrôle de doublons |
| `15-e2e-pg17.sh` → `e2e-pg17.txt` | essai PostgreSQL 17 |
| `16-migration-safety.sh` → `migration-safety.txt` | étapes Migration Safety |
| `gsc-familles.tsv` | requêtes GSC par famille |
| `prod-get-r8.tsv` | 10 GET PROD |
