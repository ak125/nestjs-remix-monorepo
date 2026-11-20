# Complément n° 13 au mandat DS — page R8 de la Clio III 1.5 dCi : rôle, contrat, existant

Date : 2026-11-20. Relevé seul : aucune page, aucun code et aucune donnée de la base n'est modifié
(requêtes SELECT seulement). #2210 n'est pas touchée. Pas de maquette dans ce complément.

Page étudiée : fiche véhicule R8, `/constructeurs/<marque>/<modele>/<type>.html`
(Marwane, 20 nov. 21:43 : « page véhicule Clio III 1.5 dCi est une page r8 »).

**Actes réservés à Marwane : choix de la version prototype, fusion, tag, toute décision de design commune au site.**

## En bref

- **Version proposée : type 19052, 1.5 dCi 86 ch (« dCi 85 », K9K 766, 2005-2012).**
  - C'est la page R8 Clio III 1.5 dCi la plus vue dans Search Console : 143 impressions sur 2026-06-01 → 2026-11-17.
  - Ses données concordent avec deux sources publiques et avec les CNIT de la base.
  - Seconde page de comparaison : 19051 (68 ch), qui a le plus de clics (4).
  - Les ventes ne départagent rien : une seule commande payée sur 12 mois, pour un filtre à huile commun à six types.
- **Le contrat R8 est éclaté entre six sources qui se contredisent** (§2).
  - Le contrat exécutable `packages/seo-role-contracts/src/contracts/r8.ts` est vide.
  - Les 10 sections du backend n'y figurent pas.
  - Il existe deux listes de termes interdits différentes.
  - Les cibles de sortie diffèrent d'un document à l'autre.
- **La page servie** (DEV = www sur le fond) est indexable et propre sur les termes interdits. Mais :
  - Elle n'a **aucun lien contextualisé vers R1, R3, R4 ou R5**.
  - **43 gammes sur 116 n'ont aucun lien dans le HTML** : elles n'apparaissent qu'après le clic sur « +N pièces ».
  - Le bloc « **les plus vendues** » ne repose sur aucune donnée de vente.
  - **7 blocs sur 11 sont identiques** d'un type à l'autre (texte égal, ou égal une fois la puissance et les années retirées).
- **La branche `wip/ds-complement1-vehicule-clio-iii-19052` n'est pas une page R8.** Elle réordonne la page
  R2 `/pieces/filtre-a-huile-7/…/1-5-dci-19052.html` (composants `PiecesHeader`, `PiecesVehicleContent`).
  Elle ne peut pas servir de base à la page R8 (§4).
- Vitesse :
  - **DEV, laboratoire** : bonne (LCP < 0,7 s, CLS ≈ 0, INP ≤ 192 ms à 390 px avec CPU ×4).
  - **www** : Cloudflare présente un défi au navigateur automatisé, d'où **aucune mesure de laboratoire**. Les mesures de terrain du groupe `r8_vehicle` sont données à la place (§3.6).

## 1. Version de référence

### 1.1 Types Clio III 1.5 dCi en base

Modèle 140004 « CLIO III » (2005-2014), carrosserie 3/5 portes (`auto_type`) :

| type_id | Puissance | Période | Codes moteur | Affiché / suivi |
|---|---|---|---|---|
| 26627 | 64 ch / 47 kW | 6/2005-12/2012 | K9K 752 | oui / oui |
| 30141 | 65 ch / 48 kW | 5/2005-7/2010 | K9K 752 | non / non |
| 19051 | 68 ch / 50 kW | 6/2005-12/2012 | K9K 714, K9K 768 | oui / oui |
| 34744 | 75 ch / 55 kW | 8/2010-12/2014 | K9K 770 | oui / oui |
| 28839 | 82 ch / 60 kW | 11/2007-12/2012 | K9K 750 | non / non |
| **19052** | **86 ch / 63 kW** | **6/2005-12/2012** | **K9K 766** | **oui / oui** |
| 34746 | 88 ch / 65 kW | 8/2010-12/2014 | K9K 766, K9K 770 | oui / oui |
| 20078 | 103 ch / 76 kW | 6/2005-12/2012 | K9K 772 | non / non |
| 19053 | 106 ch / 78 kW | 6/2005-12/2014 | K9K 764, K9K 774 | oui / oui |

Autres modèles Clio III ayant des types 1.5 dCi :
- Break (140005) : 34749, 23455, 34745, 23456, 34747, 23457, 23458 ;
- Camionnette (11387) : 77069, 77070.

Sportour (6446) n'en a aucun.

### 1.2 Ventes, Search Console, demande

**Ventes payées sur 12 mois** ([`requetes/ventes-12-mois.sql`](requetes/ventes-12-mois.sql)) :
- La commande ne porte pas le véhicule (`ord_info` sans véhicule). Seules 2 lignes sur 27 ont une URL de page, et aucune ne porte sur ces types.
- Le rattachement passe donc par la compatibilité de la pièce vendue. `orl_pg_id` contient en fait le `piece_id` : 25 lignes sur 27 concordent par `piece_ref`. `orl_art_ref_clean` et `orl_pm_id` sont vides.
- Résultat : **une commande payée non annulée**, un filtre à huile compatible avec 19051, 19052, 19053, 20078, 26627 et 30141. Aucun type ne se distingue.

Le rappel du 19 nov. demandait la version « la plus vendue ». Les ventes du site ne permettent pas de la mesurer, et la base n'a pas de donnée de parc roulant.

**Search Console, page R8** (`__seo_gsc_daily_page_totals`, 2026-06-01 → 2026-11-17, [`requetes/gsc-pages-r8.sql`](requetes/gsc-pages-r8.sql)) :

| Page R8 | Impressions | Clics | Position moyenne |
|---|---|---|---|
| **19052** (86 ch) | **143** | 2 | 10,5 |
| 34749 (Break 65 ch) | 88 | 1 | 10,6 |
| 34745 (Break 75 ch) | 74 | 1 | 7,9 |
| 19051 (68 ch) | 59 | **4** | 15,0 |
| 23456 (Break 86 ch) | 36 | 1 | — |
| 34747, 23457, 23455 | 18, 14, 3 | 0 | — |
| autres types | 0 | 0 | — |

Les requêtes GSC de ces pages sont rares : « renault 150307 » (5 impressions sur 19052), des références OE, « poire d'amorçage clio 3 1.5 dci », « br1f0h » (type mine), « moteur clio 3 1.5 dci ».

**Demande (`__seo_keywords`)** :
- 40 mots-clés « clio 3 dci », pour un volume total de 3 950. Ce sont tous des requêtes de pièce (gamme), dont 3 à 500 : filtre à huile, filtre à gasoil, courroie de distribution.
- Aucune requête de type « fiche » ou « motorisation » ne cible R8 en propre.
- Mots-clés rattachés à un type : 19051 (6, volume 150), 19052 (2, volume 50).

### 1.3 Recoupement avec des sources publiques (décision 159)

| Type | Base | Sources publiques | Accord |
|---|---|---|---|
| 19052 | 86 ch / 63 kW, K9K 766, 2005-2012 | « 1.5 dCi 86 ch », commercialisé « dCi 85 », 63 kW, 200 Nm, K9K 766 : [auto-data 25045](https://auto-data.net/en/renault-clio-iii-phase-i-1.5-dci-8v-86hp-25045), [auto-data 56126](https://www.auto-data.net/en/renault-clio-iii-phase-i-5-door-1.5-dci-86hp-56126), [L'argus 899619](https://www.largus.fr/fiche-technique/Renault/Clio/III+B-C85/2006/Berline/15+dCi+85ch+Dynamique+Quickshift+5p-899619.html) | oui |
| 19051 | 68 ch / 50 kW, K9K 714 / K9K 768, 2005-2012 | « 1.5 dCi 68 ch », commercialisé « dCi 70 », 50 kW, 160 Nm : [auto-data 25071](https://www.auto-data.net/en/renault-clio-iii-phase-i-3-door-1.5-dci-68hp-25071), [Zeperfs 5763](https://zeperfs.com/fiche5763-renault-clio-iii-1-5-dci.htm), [L'argus 899629](https://www.largus.fr/fiche-technique/Renault/Clio/III+B-C85/2006/Berline/15+dCi+70ch+Authentique+3p-899629.html) | oui |

Le CNIT (`__cnit_raw`) de 19052 est cohérent : 14 fiches « 1.5dCi (85ch) », 86 cv / 63 kW (et 84 cv / 62 kW).

**Erreurs de base relevées, à corriger** (décision 159 : « il faut corriger la db aussi »). Aucune n'est corrigée ici : c'est hors du périmètre du complément, qui ne fait que des lectures.

| Donnée | Constat | Correction attendue |
|---|---|---|
| `__seo_keywords` « filtre à huile clio 3 1.5 dci 85 » | rattaché à 19051 (68 ch, « dCi 70 ») | le dCi 85 est le type 19052 (86 ch) |
| `__cnit_raw` → 34744 (75 ch) | fiches 70 ch / 68 cv et une fiche 85 ch / 86 cv | à revoir fiche par fiche |
| `__cnit_raw` → 34746 (88 ch) | 10 fiches « Nouvelle CLIO dCi (85ch) » 86 cv | probablement des fiches 86 ch |
| `__cnit_raw` → 19051 (68 ch) | une fiche « (75ch) Roues 16 » | à revoir |
| Fiche technique servie de 19052 | mélange types mines et CNIT, dont MRE5221ET768 (CNIT 84 cv / 62 kW) | à vérifier contre la source constructeur |

### 1.4 Proposition (choix réservé à Marwane)

**Prototype : 19052.** Raisons :
1. C'est la page R8 Clio III 1.5 dCi la plus vue (143 impressions).
2. Elle est affichée et suivie.
3. Le moteur est vendu sous le nom « dCi 85 », celui des requêtes « clio 3 1.5 dci 85 ».
4. Les deux sources publiques et les CNIT concordent avec la base.
5. Elle a 116 gammes au catalogue, un des plus larges de la série.

**Seconde page de comparaison : 19051** (68 ch). Elle a le plus de clics, le plus de mots-clés rattachés, et un catalogue proche (§3).

## 2. Contrat R8 (références sur `main` @ `1210455cd`)

### 2.1 Ce que disent les sources

| Source | Références | Contenu |
|---|---|---|
| Canon des rôles | `.spec/00-canon/role-matrix.md:67`, `:186-197`, `:211`, `:223`, `:284`, `:301`, `:320`, `:336-347` | Promesse « fiche véhicule ». Sorties R1/R3/R5/R6 (`:195`). Interdits : panier, prix, procédure, symptôme, hub marque. `forbidden_dominant_signals`. Handoff R1/R3/R5/R7. Tableau `:211` : handoff R1/R2/R5/outil, interdits « devenir R7, diagnostic personnalisé, R2, R3, R4 ». Page non cart-capable (`:336-347`, garde `scripts/governance/check-cart-conversion-r-role.sh`). |
| Contrat exécutable | `packages/seo-role-contracts/src/contracts/r8.ts:1-35` | Ébauche : `allowed_sections: []`, `forbidden_overlap: []`, `allowed_schemas: ["Vehicle","BreadcrumbList"]`, seuils d'unicité vides. Cite un skill `r8-diversity-check` absent. |
| Indexabilité | `packages/seo-role-contracts/src/noindex-thresholds.ts:6,41` (min 5 gammes), `compose-indexability.ts:111,146`, `robots-verdict.ts:57,102,121`, `r8-tecdoc-release-gate.ts` | Seuils et verdict robots. |
| Plan de page backend | `backend/src/config/r8-keyword-plan.constants.ts:37-48` (10 sections), `:61-122`, `:137-190` (termes interdits), `:195-200`, `:204-210` | S_IDENTITY, S_COMPAT_CHECK, S_FAST_ACCESS, S_SEO_INTRO, S_SAFE_TABLE, S_CATALOG, S_BESTSELLERS, S_ANTI_ERRORS, S_FAQ, S_TRUST. Listes : diagnostic, réparation, glossaire, comparatif, promesses. |
| Schéma du contrat de page | `backend/src/config/page-contract-r8.schema.ts:239` (`R8VehicleSchema`), `:266` (`R8InternalLinkSchema`) | Structure des données et des liens internes. |
| Rôles partagés | `packages/seo-roles/src/forbidden-overlap.ts:111-114`, `intents.ts:63-67`, `keyword-intent.ts:89`, `vlevel-invariants.ts:337,372`, `canonical.ts:21` | 8 termes interdits (démontage, remontage, étapes de remplacement, couple de serrage, définition, qu'est-ce que, composé de, glossaire). Intention navigationnelle, fuite admise « transactionnelle ». |
| CWV | `.spec/00-canon/seo-runtime/cwv-taxonomy.yaml:38-40,96-99,168` | R8_VEHICLE, `funnel_role: view_vehicle`, motif `/constructeurs/$marque/$modele/$type.html`. |
| Principes | `.claude/governance/journal-des-principes.md:156` (P15 « R2 se compose de R1 ⊕ R8 »), `:165` (enrichisseur R8, `SEO_CHAIN_DUPLICATE_GATE_MODE` à off) | |
| Carte des agents | `.spec/00-canon/ai-registry/agent-operating-map.yaml:22,1063` | |
| Relecture éditoriale | `.claude/prompts/_shared/editorial-review.md:20,192,262-271` | Ton neutre R8, exemple E5. |
| Pureté de rôle | `scripts/governance/check-role-purity.ts:16,48` | |
| Carte d'implémentation | `.spec/00-canon/db-governance/role-implementation-map.md:43,381-417,456,504` | **Obsolète** : `:408` dit « pas de route publique R8 ». |
| Skills et agents | `.claude/skills/frontend-design/exemplars/antipattern-editorial-sprawl.md:14,26-28`, `.claude/skills/frontend-design/references/canon-links.md:14`, `.claude/skills/vehicle-ops/SKILL.md:396`, `agents/seo-content/AGENTS.md:24,109,154` | |
| Code de la route | `frontend/app/routes/constructeurs.$brand.$model.$type.tsx` (meta `:405-455`, rendu `:524+`, catalogue `:744-815`, « plus vendues » `:858-896`), JSON-LD `r8-schema.ts` | Ce qui est réellement servi (§3). |

**Absents de `main`** :
- `.claude/agents/r8-keyword-planner.md` ;
- `.claude/skills/r8-diversity-check/SKILL.md` (il existe seulement `scripts/qa/r8-diversity-check.py`) ;
- `design-system/roles/R8*` : aucune règle de design propre à R8.

### 2.2 Contradictions

1. **Cibles de sortie.**
   - `role-matrix.md:195` donne R1/R3/R5/R6.
   - `:211` donne R1/R2/R5/outil, et l'autre liste R1/R2/R3/R4/R5.
2. **R7.** Le handoff vers R7 est prévu, alors que « devenir une page marque R7 » est interdit. Un lien de retour est compatible avec l'interdit, à condition que le contrat le dise.
3. **Transaction.**
   - Le canon interdit prix et panier.
   - Pourtant `intents.ts:63-67` admet une fuite « transactionnelle », le backend prévoit S_BESTSELLERS, et le title servi dit « à prix discount ».
4. **Outil.** « Outil de diagnostic personnalisé » est interdit, alors que S_COMPAT_CHECK (vérification VIN/CNIT) est prévu au plan. La frontière entre vérification de compatibilité et outil n'est écrite nulle part.
5. **Sections.**
   - Le contrat exécutable n'a aucune section, le backend en a 10.
   - Le rendu ajoute S_BREADCRUMB, S_HERO et S_HOWTO, absents du plan.
   - Il ne rend ni S_COMPAT_CHECK ni S_FAQ : la FAQ n'apparaît que si `r8Content` en fournit au moins 2.
6. **Termes interdits.** `forbidden-overlap.ts` (8 termes) et `r8-keyword-plan.constants.ts` (listes longues) ne se recouvrent pas. Aucune n'est la référence.
7. **Schéma.** Le contrat dit `Vehicle`, la page sert `Car` (sous-type de `Vehicle` dans schema.org, donc compatible, mais le contrat ne le dit pas).

### 2.3 Ce qui manque

- Un contrat de sections exécutable : ordre, sections obligatoires, sections permises.
- Une liste unique de cibles de liens sortants, avec un nombre minimal par rôle.
- Un seuil d'unicité entre fiches R8 d'un même modèle. Le contrat le prévoit, mais il est vide.
- Des règles de design R8.
- Une règle sur le title :
  - le prix y est-il admis sur une page non cart-capable ?
  - la puissance doit-elle y figurer ?

## 3. Existant servi

Relevés par GET simple sur DEV (`127.0.0.1:3000`, lecture, rien redémarré) et sur www (lecture) : [`releves/`](releves/).
Outils : [`outils/ssr-r8.cjs`](outils/ssr-r8.cjs), [`outils/compare-r8.cjs`](outils/compare-r8.cjs),
[`outils/gammes-r8.cjs`](outils/gammes-r8.cjs), [`outils/vue-r8.cjs`](outils/vue-r8.cjs).

### 3.1 En-tête et données structurées

| | 19052 (86 ch) | 19051 (68 ch) |
|---|---|---|
| HTTP / robots | 200, `index, follow`, pas de X-Robots-Tag | idem |
| Title | « Pièces RENAULT CLIO III 1.5 dCi à prix discount » | « Pièces RENAULT CLIO III 1.5 dCi en promotion » |
| H1 | « RENAULT CLIO III 1.5 dCi 86 ch de 2005 à 2012 » | « … 68 ch de 2005 à 2012 » |
| Description | « Catalogue pièces détachées pour RENAULT CLIO III 1.5 dCi 86 ch de 2005 à 2012 neuves et équipements » | même modèle, 68 ch |
| Canonical | l'URL elle-même | idem |
| JSON-LD | `Car` (puissance 86, Diesel, 2005-2012) + `BreadcrumbList` | idem |
| Fil d'Ariane (visible et JSON-LD) | Accueil → RENAULT → 1.5 dCi 86 ch | idem, **sans le niveau CLIO III** |
| HTML (www) | 199 995 o, gzip 28 651 | 198 759 o, gzip 28 425 |

DEV et www servent le même title, le même H1, la même description, le même JSON-LD et le même ordre de blocs.
Les deux titles ne diffèrent que par le suffixe commercial. La puissance, seule différence entre les deux types, n'y figure pas.

### 3.2 Blocs dans l'ordre

S_BREADCRUMB > S_HERO > S_IDENTITY > S_FAST_ACCESS > S_SEO_INTRO > S_CATALOG > S_BESTSELLERS >
S_SAFE_TABLE > S_ANTI_ERRORS > S_HOWTO > S_TRUST, puis le pied de page commun.
Ni FAQ, ni S_COMPAT_CHECK, ni bloc enrichi R8 pour ces deux types.

Les titres de la page (H2/H3) sont :
- « Acces rapide » et « Catalogue de pieces auto », sans accents ;
- 19 H3 de familles ;
- « Pièces auto RENAULT les plus vendues » avec 8 H3 ;
- « Fiche technique » ;
- « Erreurs fréquentes à éviter » ;
- « Comment choisir sans se tromper » ;
- les H3 de réassurance et du pied de page.

### 3.3 Liens sortants (www, 19052)

| Cible | Nombre | Détail |
|---|---|---|
| R2 (pièce × véhicule) | 81 | toutes vers `…-19052.html`, catalogue et « plus vendues » |
| R7 (marque) | 3 | fil d'Ariane, CTA de retour |
| R1, R3, R4, R5, R6 | **0** | aucun lien contextualisé |
| Outil | 0 dédié | `/diagnostic-auto` ×5 et `/blog-pieces-auto` ×4 viennent de l'en-tête et du pied de page communs |
| Autres internes | 48 | navigation, `/contact`, `/legal`, `/login`, etc. |
| Externes / ancres | 10 / 7 | |

**Gammes du catalogue sans lien dans le HTML** ([`outils/gammes-r8.cjs`](outils/gammes-r8.cjs)) :
- Le catalogue annonce « 19 familles · 116 gammes ». La fonction `build_vehicle_page_payload(19052)` renvoie aussi 116 gammes et 19 familles.
- Le rendu serveur n'affiche que les 5 premières gammes de chaque famille (`displayedGammes`, `constructeurs.$brand.$model.$type.tsx:744-815`).
- Les autres n'existent qu'après le clic sur « +N pièces ».
- Résultat : **43 gammes sur 116 (19052) et 42 (19051) n'ont aucun `<a href>` dans le HTML**, sur DEV comme sur www.
- C'est le même défaut que celui des cartes véhicule R1, corrigé au complément n° 12 sur #2210.

Les 81 liens R2 comptent aussi les 8 liens des « plus vendues », qui reprennent en partie des gammes du catalogue.

### 3.4 Contenus répétés entre les deux pages R8

[`releves/www-comparaison-19052-19051.json`](releves/www-comparaison-19052-19051.json). Méthode « identique hors faits du type » : nombres, « ch » et codes K9K neutralisés.

| Bloc | 19052 / 19051 | Phrases communes |
|---|---|---|
| S_IDENTITY, S_FAST_ACCESS, S_ANTI_ERRORS | identiques | toutes |
| S_HERO, S_SEO_INTRO, S_HOWTO, S_TRUST, S_BREADCRUMB | identiques hors faits du type | 4/5 pour S_SEO_INTRO, 5/6 pour S_TRUST |
| S_CATALOG, S_BESTSELLERS, S_SAFE_TABLE | différents | 1/2, 1/9, 0/1 |

Ce qui distingue les deux pages, ce sont la puissance et trois blocs de données (catalogue, « plus vendues », fiche technique). Tout le texte rédigé est un gabarit commun.

### 3.5 Mots interdits et promesses

- **Termes interdits du rôle** (les deux listes, lues dans le dépôt par `ssr-r8.cjs`) : aucun, sur les deux pages.
- **Affirmations non étayées :**
  - Le bloc « Pièces auto RENAULT les plus vendues » / « Top N pièces certifiées pour… » vient de `build_vehicle_page_payload`. La fonction prend `DISTINCT ON (cgc_pg_id)` dans `__cross_gamme_car_new` (niveaux 1-2), triés par `cgc_pg_id`, `LIMIT 8`. **Aucune donnée de vente** : le titre est faux.
  - « 100% compatible », « Vérif VIN / CNIT » (S_IDENTITY) et « utilisez votre VIN / CNIT » (S_SEO_INTRO) sont affichés, mais la page n'a **aucun champ VIN ni CNIT** : 0 `<input>`.
  - « Garantie 1 an », « Satisfait ou remboursé » et « Livraison 24-48h » sont des promesses commerciales sur une page non cart-capable. Elles ne sont pas vérifiées dans ce relevé.
- **Libellés** : « 1 pièces » (pluriel fautif), « Acces rapide », « Catalogue de pieces auto », « Trouvez les pieces auto compatibles avec votre vehicule » (sans accents).

### 3.6 Captures et vitesse

**Captures** : DEV, pleine page, bandeaux fixes masqués, état servi sans clic, JPEG qualité 70.

| Page | 390 px | 1440 px |
|---|---|---|
| 19052 | [`dev-1-5-dci-19052-390.jpg`](releves/dev-1-5-dci-19052-390.jpg) (hauteur 17 073 px) | [`dev-1-5-dci-19052-1440.jpg`](releves/dev-1-5-dci-19052-1440.jpg) (6 828 px) |
| 19051 | [`dev-1-5-dci-19051-390.jpg`](releves/dev-1-5-dci-19051-390.jpg) (17 001 px) | [`dev-1-5-dci-19051-1440.jpg`](releves/dev-1-5-dci-19051-1440.jpg) (6 808 px) |

Aucun débordement horizontal. À 390 px, la page fait **17 000 px de haut** (environ 20 écrans), contre 6 800 px à 1440.

**www : pas de capture ni de mesure de laboratoire.**
- Le navigateur automatisé reçoit le défi Cloudflare « Performing security verification » ([`www-defi-cloudflare-navigateur-1440.png`](releves/www-defi-cloudflare-navigateur-1440.png)).
- Les valeurs mesurées sur cette page de défi ont été écartées.
- Le GET simple passe, d'où les relevés SSR www.
- Je ne contourne pas la protection. Une mesure www demanderait une exemption décidée par l'owner, ou PageSpeed Insights.

**Laboratoire DEV** ([`outils/vue-r8.cjs`](outils/vue-r8.cjs), web-vitals 5.3.0, médiane de 5 passages, cache froid). Parcours propre à R8 :
- chargement, puis 3 s ;
- clic sur le premier « +N pièces » ;
- clic sur « Voir moins » ;
- saisie de « filtre » dans « Rechercher une gamme ».

| Page | Vue | LCP | CLS | INP | Élément LCP / cible INP |
|---|---|---|---|---|---|
| 19052 | 390, CPU ×4 | 604 ms | 0 | 168 ms | image du véhicule / bouton « +N pièces » |
| 19052 | 1440 | 344 ms | 0,0002 | 80 ms | texte d'introduction / bouton « +N pièces » |
| 19051 | 390, CPU ×4 | 496 ms | 0 | 176 ms | image du véhicule / bouton « +N pièces » |
| 19051 | 1440 | 356 ms | 0,0002 | 80 ms | texte d'introduction / bouton « +N pièces » |

À 390 px, l'interaction la plus lente est le dépliage d'une famille : 152-192 ms selon les passages, sous le seuil de 200 ms, mais proche.

**Terrain, RUM du site** ([`requetes/cwv-terrain-r8.sql`](requetes/cwv-terrain-r8.sql), [`releves/cwv-terrain-r8.txt`](releves/cwv-terrain-r8.txt)) :
- Les deux pages n'ont qu'**un échantillon** (mobile, 20 nov. : LCP 2 060 ms, CLS 0). Ce n'est pas exploitable par page.
- Groupe `r8_vehicle`, échantillons bruts conservés (18-20 nov.), p75 :

| | LCP | CLS | INP |
|---|---|---|---|
| Mobile | 1 466 ms (n = 23) | 0 (n = 18) | 184 ms (n = 15) |
| Desktop | 1 700 ms (n = 51) | 0 (n = 90) | 72 ms (n = 37) |

- Agrégat quotidien `r8_vehicle` sur 28 jours (23 oct.-19 nov.) : le p75 quotidien du LCP mobile a une médiane de 1 325 ms, mais il monte jusqu'à 4 534 ms certains jours. L'INP mobile a une médiane de 115 ms et un maximum de 342 ms.
- Les volumes sont faibles. Ces valeurs donnent un ordre de grandeur pour le groupe, pas pour la Clio III.

## 4. Branche locale `wip/ds-complement1-vehicule-clio-iii-19052`

Lue sans checkout, ni push, ni fusion :
`git -C /opt/automecanik/app log/diff origin/main...wip/ds-complement1-vehicule-clio-iii-19052`.

- **Commits** :
  - tête `0d3e629f91221e8b33f6e6a7a25c9cbbd1465811`, « wip(ds): complément n° 1, page véhicule Clio III 19052 — mis de côté, non poussé (arrêt Marwane 19 nov. 19:03) » ;
  - parent `8507eb5b8`, maquette R1 de #2210.
  - La branche part donc de l'ancienne branche de #2210, pas de `main` (base commune avec `main` : `2462efde5`).
- **Contenu propre** (26 fichiers, +1 730 / −56) :
  - `docs/audit/maquette-r1-filtre-a-huile-20261119/vehicule-clio-iii-19052/` : README, 13 captures, 2 mesures, 3 relevés de blocs ;
  - le README R1 et `outils/capture.cjs` de #2210 sont retouchés ;
  - deux composants : `frontend/app/components/pieces/PiecesHeader.tsx` (photo masquée sous 1 024 px) et `PiecesVehicleContent.tsx` (réassurance et lien VIN placés après la liste, sections du bas réordonnées).
- **Page visée** : `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html`. C'est la page **R2** (pièce × véhicule, liste de prix, bouton Ajouter, cart-capable). Sur `main`, `PiecesVehicleContent` n'est importé que par `pieces.$gamme.$marque.$modele.$type[.]html.tsx:26,79`. La route R8 `constructeurs.$brand.$model.$type.tsx` n'utilise aucun des deux composants.

**Conformité au contrat R8 : sans objet, et non réutilisable pour R8.**
- Le travail optimise l'achat sur R2. Le transposer à R8 ferait exactement la confusion R8/R2 que le canon classe en erreur P1 (`role-matrix.md:211`).
- Son README l'intitule « page véhicule ». C'est ce libellé qui a produit l'erreur de rôle corrigée par Marwane le 20 nov. à 21:43.
- La branche reste valable comme travail R2 mis de côté. Le jugement de ce travail en tant que R2 est hors du périmètre de ce complément.
- Elle reste locale. Je n'y ai fait aucune écriture.

## 5. Écarts, classés par effet

Ce sont des constats, sans maquette. Ils sont classés par gravité dans chaque groupe.

### SEO

1. **43 gammes sur 116 sans lien dans le HTML** (§3.3). Les robots qui n'exécutent pas le clic ne découvrent pas ces pages R2 depuis la fiche véhicule.
2. **Aucun lien contextualisé vers R1, R3, R4 ou R5** (§3.3). C'est contraire aux sorties prévues par le canon (`role-matrix.md:195`, `:211`). La fiche ne mène qu'à R2 et R7.
3. **Contenu en gabarit** : 7 blocs sur 11 identiques d'un type à l'autre (§3.4). Pour neuf types d'un même modèle, c'est un risque de pages trop semblables. Le seuil d'unicité du contrat est vide (§2.3).
4. **Title** :
   - il est commercial (« à prix discount », « en promotion ») sur une page non cart-capable ;
   - il est identique d'un type à l'autre hormis ce suffixe, sans puissance ni « dCi 85 ».
   - La demande mesurée porte sur des requêtes de pièce, pas sur des requêtes de fiche (§1.2).
   - Le title est un contrat SEO optimisé : toute modification demande l'accord de Marwane (règle « meta/H1 optimisés »).
5. **Fil d'Ariane sans le niveau du modèle** (CLIO III), à l'écran comme dans le `BreadcrumbList`.
6. **Données erronées en base** : mot-clé « dCi 85 » rattaché au 68 ch, fiches CNIT mal rattachées, fiche technique mêlant 84 et 86 cv (§1.3).
7. FAQ et S_COMPAT_CHECK prévus au plan, absents du rendu.

### Conversion vers les bonnes pièces

1. **« Pièces auto RENAULT les plus vendues »** affiche 8 gammes triées par identifiant, sans aucune donnée de vente. L'affirmation est trompeuse et ne guide pas vers les pièces utiles.
2. **« 100% compatible » et « Vérif VIN / CNIT » sans outil** : la page promet une vérification qu'elle ne propose pas.
3. Les requêtes réelles visent des gammes : filtre à huile, filtre à gasoil, courroie de distribution (§1.2). La page n'oriente pas spécialement vers elles. À 390 px, le catalogue commence loin dans une page de 17 000 px de haut.
4. Aucun lien vers les contenus R3 (conseils) ou R5 (diagnostic) du véhicule, qui aideraient à choisir la bonne pièce.

### Accessibilité

1. Titres et libellés sans accents (« Acces rapide », « pieces », « vehicule ») : la lecture vocale est faussée et la qualité perçue baisse.
2. Hiérarchie : les H3 du pied de page commun suivent le H2 « Comment choisir sans se tromper », sans H2 propre. 19 H3 de familles dans un seul H2.
3. Les gammes repliées n'existent pas dans le DOM avant le clic. Elles sont donc absentes de la navigation au clavier tant qu'on n'a pas ouvert le bouton. La lisibilité du bouton « +N pièces » n'est pas mesurée ici.
4. « 1 pièces » (accord fautif).

### Vitesse

1. HTML lourd : environ 200 Ko (28 Ko gzip) sur www.
2. Page très longue à 390 px (17 000 px).
3. Dépliage d'une famille à 152-192 ms à 390 px avec CPU ×4 : sous 200 ms, mais c'est l'interaction la plus lente.
4. Terrain `r8_vehicle` :
   - LCP mobile au p75 correct en médiane, mais pics quotidiens à plus de 4,5 s ;
   - INP mobile p75 à 184 ms sur les trois derniers jours.
   - Les volumes sont trop faibles pour conclure page par page.
5. **Aucune mesure de laboratoire www possible** à cause du défi Cloudflare (§3.6).

## 6. Couverture, exclusions, inconnues

- **Couvert** :
  - types Clio III 1.5 dCi des modèles 140004, 140005, 11387 et 6446 ;
  - pages 19052 et 19051 sur DEV et www (SSR) ;
  - captures et laboratoire sur DEV seulement ;
  - RUM de terrain du groupe `r8_vehicle`.
- **Non couvert** :
  - les autres types et modèles en rendu ;
  - les autres marques R8 ;
  - le rendu après dépliage des familles (sauf la mesure INP).
- **Exclu** : maquette, V-Level, #2210, toute écriture en base ou dans le code.
- **Inconnues** :
  - le parc roulant réel par version (aucune donnée en base) ;
  - la vérification des promesses « Garantie 1 an », « Livraison 24-48h » et « Retour 30 jours » ;
  - les mesures www de laboratoire ;
  - l'existence d'une page modèle publique pour compléter le fil d'Ariane (non vérifiée).

## Fichiers

- `outils/ssr-r8.cjs` : relevé SSR (meta, H1, titres, blocs `data-section`, JSON-LD, liens par rôle, termes interdits lus dans le dépôt).
- `outils/compare-r8.cjs` : comparaison bloc par bloc de deux relevés.
- `outils/gammes-r8.cjs` : gammes avec ou sans lien dans le HTML serveur.
- `outils/vue-r8.cjs` : captures et CWV de laboratoire (Playwright et web-vitals pris dans le worktree de #2210, en lecture ; aucune installation ici).
- `requetes/*.sql` : ventes, Search Console, CWV de terrain (SELECT seulement).
- `releves/` : relevés JSON, captures, sortie RUM, preuve du défi Cloudflare.

**Actes réservés à Marwane : choix de la version prototype, fusion, tag, toute décision de design commune au site.**
