# Complément n° 6 DZ — cause du décalage de mise en page (CLS) après défilement

Décision de Marwane, 20 nov. 2026 à 22:18 (Paris) : seuil à 0,1, au chargement et après défilement, sur chaque type de
page, en 390 et en 1440. Avant d'activer le contrôle, ce mandat de lecture cherche la cause sur la page produit et la
gamme. Option A3 retenue comme base. Rien n'est modifié dans le code de l'application ; tout ce qui suit est mesuré sur
le DEV, en laboratoire. Les correctifs sont proposés, non appliqués.

Point de départ (rapport DZ, section « h. Images et stabilité ») : CLS après défilement r2-produit **0,9179** (390) et
**0,5814** (1440), r1-gamme **0,0581** (390) et **0,4103** (1440).

## En bref

1. **Les chiffres du rapport viennent de la méthode de mesure, pas d'un défilement.** `scripts/mesure-dz.cjs:256` force
   `*{content-visibility:visible !important}` sur toute la page pour mesurer les textes, puis `:269` retire cette
   feuille. Au retrait, Chromium compte d'un coup un décalage de **0,8364** (r2, 390), **0,082** (r2, 1440), **1**
   (r1, 390) et **0,8757** (r1, 1440). Le compteur du rapport (`scripts/lib-dz.cjs:116-119`, lu par
   `mesure-dz.cjs:335`) additionne tous les décalages depuis le chargement : il inclut celui-là. Aucun utilisateur ne
   déclenche ce retrait.
2. **En défilement progressif à la molette, le CLS après défilement est au plus de 0,0177** (somme) sur les cinq types de
   page, dans les deux tailles, sans feuille d'option et sous A3. En sauts programmés de 700 px, il est au plus de
   0,009. Les cinq types de page passent 0,1 avec ces deux méthodes.
3. **Il reste deux vrais décalages, tous deux pendant le chargement, avant tout défilement, et sous 0,1 :**
   - r1-gamme : l'image du haut (`GammeHero.tsx:107-112`) déclare 360 × 360 alors que l'image servie est en 3:2 ; à son
     arrivée elle rapetisse de 35 px (390) ou 73 px (1440). Décalage de **0,0175** (390) et **0,0226** (1440), à chaque
     passage. Classe : **image**.
   - r2-produit : le groupe de cartes glisse depuis le haut (`PiecesGroupedDisplay.tsx:197`, `animate-in
     slide-in-from-top`) pendant que les cartes, en `content-visibility:auto` avec une réserve de 360 px
     (`global.css:411-414`), prennent leur vraie hauteur (342 px en 390, 445 px en 1440). Décalage de **0,0199 à 0,0602**
     en 390 (6 passages sur 6), **0 à 0,0247** en 1440 (1 passage sur 6). Classe : **contenu dont la place réservée
     diffère de la taille réelle, rendu visible par une animation**.
4. **A3 ne change rien au CLS.** L'injection de la feuille A3 ne produit aucun décalage (0 sur 30 passages). Hors
   chargement, les écarts AVANT / A3 restent sous 0,01. La seule différence plus grande (r2 1440 molette, 0,0096 contre
   0,0247) vient du décalage de chargement, qui a lieu avant l'injection et tombe ici dans le passage A3.
5. **Les deux correctifs proposés ramènent ces décalages de chargement à 0** dans 12 passages sur 12, démontrés par une
   feuille écrite dans le HTML (§ 4).

## Méthode

Script `options/scripts/cls-causes-dz.cjs` (nouveau, lecture seule, mêmes protections que `lib-dz.cjs` : requêtes non
GET et traceurs coupés). Un script d'initialisation enregistre, depuis le premier octet de la page :

- chaque entrée `layout-shift` (PerformanceObserver, `buffered`) : valeur, instant, `hadRecentInput`, défilement,
  état du document, nombre de feuilles de style, puis, pour chaque source, le nœud et ses rectangles avant et après ;
- tout élément dont la taille change d'au moins 2 px (ResizeObserver sur tous les éléments) ;
- les ajouts, retraits et changements de `class`, `style`, `hidden` et `open` (MutationObserver) ;
- l'arrivée des polices et des images.

Pour chaque décalage d'au moins 0,01, les « poussoirs » sont les changements de taille relevés entre 150 ms avant et
30 ms après, situés au-dessus d'une source ou la contenant, et les mutations entre 300 ms avant et 30 ms après. Un ancêtre
qui répercute seulement la variation d'un descendant est marqué comme tel et classé après.

Deux CLS sont donnés : la **somme** (ce que comptait le rapport) et la **plus grande fenêtre de session** (définition
officielle : écart de moins de 1 s, au plus 5 s). Les décalages marqués `hadRecentInput` sont exclus des deux, comme
dans le rapport. Ils sont listés à part.

Trois méthodes, sur chaque page, en 390 × 844 et 1440 × 900, sans feuille d'option (AVANT) puis sous A3 (feuille
injectée après chargement par `injection-dz.cjs`, comme aux n° 2 à 5 ; la phase d'injection est isolée et exclue) :

| méthode | ce qu'elle fait |
|---|---|
| parcours | reproduit l'ordre de `mesure-dz.cjs` : chargement, 40 Tab (`:65`), sauts de 700 px (`:133`), centrage de 90 textes (`:183`), `content-visibility` forcée 300 ms (`:256`) puis retirée (`:269`) |
| sauts | chargement puis `scrollThrough` de `lib-dz.cjs` seul : sauts instantanés de 700 px toutes les 110 ms, retour en haut |
| molette | chargement puis molette, 100 px toutes les 50 ms jusqu'en bas, pause de 1,5 s, remontée |

60 passages, aucun échec. Ils sont précédés d'un passage de chauffe par page, non compté. Le chargement est le même
sous AVANT et sous A3, puisque A3 est injectée ensuite : chaque page et taille a donc 6 échantillons de chargement.

Une chronologie du chargement (`options/scripts/chronologie-chargement-dz.cjs`) relève toutes les 25 ms la position et
la hauteur de l'image du haut et des premières cartes, ainsi que l'état du document, des polices et des feuilles. Elle
relève aussi la taille naturelle des images.

## 1. Les décalages relevés

Tableaux complets, générés par `options/scripts/condense-cls-dz.cjs` depuis les données brutes :
[`cls-tableaux-dz.md`](cls-tableaux-dz.md). Ils comprennent le CLS de chaque passage, la somme par phase du parcours,
l'injection A3, le chargement seul et la liste des 31 décalages au-dessus de 0,01 avec leurs sources et poussoirs.
Données brutes : [`cls-brut/`](cls-brut/).

### r2-produit et r1-gamme (CLS hors saisie, plus grande fenêtre de session ; entre parenthèses la somme)

| page | largeur | variante | parcours | sauts | molette |
|---|---|---|---|---|---|
| r2-produit | 390 | AVANT | **0,8364** (0,8364) | 0 (0) | 0 (0) |
| r2-produit | 390 | A3 | **0,8437** (0,8437) | 0 (0) | 0 (0) |
| r2-produit | 1440 | AVANT | 0,0878 (0,1) | 0,0061 (0,0061) | 0,0096 (0,0176) |
| r2-produit | 1440 | A3 | 0,0893 (0,1051) | 0,0077 (0,0081) | 0,0247 (0,0424) |
| r1-gamme | 390 | AVANT | **1** (1) | 0 (0) | 0 (0) |
| r1-gamme | 390 | A3 | **1** (1) | 0 (0) | 0 (0) |
| r1-gamme | 1440 | AVANT | **0,8796** (0,9026) | 0,0226 (0,0273) | 0,0226 (0,023) |
| r1-gamme | 1440 | A3 | **0,8802** (0,907) | 0,0226 (0,0273) | 0,0226 (0,0232) |

Somme par phase, méthode parcours (AVANT) :

| page | largeur | chargement | tabulation | sauts | centrage | cv forcée | **cv retirée** | fin |
|---|---|---|---|---|---|---|---|---|
| r2-produit | 390 | 0 | 0 | 0 | 0 | 0 | **0,8364** | 0 |
| r2-produit | 1440 | 0 | 0 | 0,0041 | 0,0081 | 0 | **0,082** | 0,0058 |
| r1-gamme | 390 | 0 | 0 | 0 | 0 | 0 | **1** | 0 |
| r1-gamme | 1440 | 0,0226 | 0 | 0,0003 | 0,0001 | 0 | **0,8757** | 0,0039 |

### Décalages au-dessus de 0,01 (AVANT ; A3 identique à la ligne près, voir le tableau complet)

| page, largeur | phase | instant | défilement | valeur | saisie | sources (rectangle avant → après, [x, y, l, h]) | poussoir |
|---|---|---|---|---|---|---|---|
| r2, 390 | cv retirée | 26 752 ms | 2 324 px | 0,8364 | non | cadres des cartes `div.pieces-product-card > div.absolute.inset-0.rounded-xl.ring-1` (« COOPERS FIAAM », « MISFAT ») : [0,0,0,0] → [203,494,171,342] et [203,137,171,342] | retrait de la feuille `style[data-dz-cv]` de `head` ; `main` perd 112 px au même instant |
| r2, 390 | chargement | 516 à 723 ms | 0 | 0,0133 à 0,0398 (1 ou 2 par passage) | **oui** (aucune saisie envoyée) | cartes `div.grid.grid-cols-2 > div.pieces-product-card` remontées de 18 à 37 px, ex. [13,311,177,348] → [13,293,177,348] | hauteur de page −19 puis −36 px, cartes 360 → 342 px (chronologie, voir § 2) |
| r2, 1440 | cv retirée | 26 909 ms | 216 px | 0,082 | non | cadres des cartes « MECAFILTER », « BOSCH » : [0,0,0,0] → [1059,731,285,169] | retrait de la feuille `style[data-dz-cv]` ; `main` −112 px |
| r2, 1440 | chargement (1 passage sur 6) | 731 ms | 0 | 0,0247 | non | cartes descendues de 85 px : [1056,374,291,451] → [1056,459,291,441] | cartes `div.pieces-product-card` +85 px (360 → 445) |
| r1, 390 | cv retirée | 27 784 ms | 4 432 px | 1 | non | `section#qualite-prix > div.mx-auto` [0,0,0,0] → [0,0,390,844] | retrait de la feuille `style[data-dz-cv]` |
| r1, 390 | chargement | 386 à 528 ms | 0 | 0,0175 | **oui** (aucune saisie envoyée) | bloc du sélecteur de véhicule `div.relative.border` [0,527,390,317] → [0,492,390,352] ; `select.h-12` apparu [37,811,156,33] | `picture` et `img` de l'image du haut : −35 px (278 → 243) |
| r1, 1440 | cv retirée | 26 891 ms | 2 105 px | 0,8757 | non | `section#qualite-prix > div.mx-auto` [0,0,0,0] → [60,48,1320,852] ; `section#bien-choisir > div.mx-auto` [80,0,1280,8] → [0,0,0,0] | retrait de la feuille `style[data-dz-cv]` |
| r1, 1440 | chargement | 394 à 463 ms | 0 | 0,0226 | non | bandeau `section.relative.overflow-hidden` [0,684,1440,216] → [0,611,1440,250] ; `nav.bg-white.border-b` [0,622,1440,62] → [0,549,1440,62] | `picture` et `img` de l'image du haut : −73 px (278 → 205) |

Les rectangles sont ceux que Chromium donne dans l'entrée `layout-shift` (coordonnées de la fenêtre).

## 2. Ce qui pousse, décalage par décalage

**a. Retrait de la feuille `content-visibility` forcée (r2 et r1, 390 et 1440) : 0,082 à 1.** Le décalage tombe 40 à
50 ms après le retrait de `style[data-dz-cv]`, mutation relevée sur `head`. Au même instant, la page perd 112 px
(r2). Les sources sont des nœuds dont le rectangle précédent est vide :

- les cadres des cartes, `PiecesGridView.tsx:392` (`absolute inset-0 rounded-xl ring-1 …`) ;
- le contenu des sections `cv-auto` de la gamme, `routes/pieces.$slug.tsx:838` (#bien-choisir), `:896` (#qualite-prix),
  `:963`, `:1019`, `:1062`, `:1076`.

Ces éléments repassent en `content-visibility:auto` (`global.css:402-405` et `:411-414`). La valeur dépend de la
position où se trouve la page à cet instant, après le centrage des 90 textes. D'où 1 en r1 390 ici contre 0,0581 dans
le rapport. Pour l'après-défilement, le rapport n'a gardé que la somme (`lib-dz.cjs:119`, lue en `mesure-dz.cjs:335`) ;
sa liste `decalages` (`mesure-dz.cjs:57`) ne couvre que le chargement. Son passage ne peut donc pas être redécoupé.

**b. Image du haut de la gamme (r1, 390 et 1440) : 0,0175 et 0,0226.**

- *Poussoir* : `picture` et `img` de `GammeHero.tsx:96-112`, mesurés à −35 px (278 → 243) en 390 et à −73 px
  (278 → 205) en 1440, dans la même image de rendu que le décalage (t = 405 ms en 390, 439 ms en 1440). Le
  conteneur, la section et `main` suivent.
- *Chronologie* : l'image est déjà chargée au premier relevé où elle existe (538 ms en 390). Le document est encore
  « loading », avant l'hydratation.
- *Mesure de l'image* : attributs `width=360 height=360` (carré) ; taille naturelle 360 × 240 (1440) et 390 × 260
  (390), soit du 3:2.
- *Mécanisme* : avant l'arrivée de l'image, le navigateur réserve un carré (278 px, plafonné par `max-h-[280px]`) ; il
  le réduit ensuite au rapport réel. En 1440, la hauteur finale (205 px) est celle de la colonne du sélecteur, du fait
  de `lg:items-stretch`.

**c. Cartes de la page produit (r2, 390 dans 6 passages sur 6, 1440 dans 1 sur 6) : 0,0133 à 0,0602.** La chronologie
(25 ms) relève les positions suivantes :

| largeur | instant | carte 1 (haut dans le document, hauteur) | hauteur de page | état, polices |
|---|---|---|---|---|
| 390 | 478 ms | −2 401, 360 | 7 466 | loading, polices en cours |
| 390 | 522 ms | −1 807, 360 | 7 447 (**−19**) | loading, polices chargées |
| 390 | 583 ms | −686, **342** | 7 411 (**−36**) | loading |
| 390 | 629 → 960 ms | 14 → 1 386, 342 | 7 411 puis 8 111 | interactive puis complete, hydraté à 756 ms |
| 1440 | 551 ms | −2 364, 360 | 6 188 | loading |
| 1440 | 708 ms | −487, **445** | 6 273 (**+85**) | interactive |
| 1440 | 734 → 1 041 ms | −124 → 957, 445 | 6 973 | complete, hydraté à 855 ms |

- *Le glissement* : la carte 1 commence plus de 2 000 px *au-dessus* du haut du document et descend jusqu'à sa place en
  environ 500 ms. C'est l'animation `animate-in fade-in slide-in-from-top duration-500` du groupe de cartes
  (`PiecesGroupedDisplay.tsx:197`), qui part de `translateY(-100 %)` de sa propre hauteur (tailwindcss-animate).
- *La réserve* : chaque carte porte `content-visibility:auto; contain-intrinsic-block-size:auto 360px`
  (`global.css:411-414`, classe posée en `PiecesGridView.tsx:175`). Tant qu'elle est loin de l'écran, elle occupe la
  réserve de 360 px. Quand l'animation l'amène près de l'écran, elle prend sa vraie hauteur : 342 px en 390, 445 px
  en 1440.
- *Le décalage* : en 390, les rangées se resserrent de 18 px, puis de deux rangées (−19 puis −36 px de hauteur de
  page), et les cartes visibles remontent de 18 à 37 px. Ce sont les sources mesurées. En 1440, les cartes grandissent
  de 85 px. Le décalage n'est visible que si ce changement tombe pendant que des cartes sont dans l'écran, d'où 1
  passage sur 6.
- *Ce qui n'est pas relevé* : le ResizeObserver ne relève aucun poussoir en 390 pour ces décalages. Une carte qui passe
  de « sautée » à « rendue » n'a pas de taille précédente enregistrée. La chronologie le montre à la place. La
  démonstration du § 4 confirme le lien : sans le glissement, ces décalages disparaissent.

## 3. Causes classées

| décalage mesuré (nœud) | classe | défilement d'utilisateur ? |
|---|---|---|
| 0,082 à 1 au retrait de `style[data-dz-cv]` (cadres des cartes `PiecesGridView.tsx:392`, sections `cv-auto` de `pieces.$slug.tsx`) | **autre : artefact de la méthode de mesure** (feuille ajoutée puis retirée par la sonde, `mesure-dz.cjs:256` et `:269`) | non. Avec un défilement à la molette, ces mêmes éléments ne produisent aucun décalage au-dessus de 0,01 (r2 390 : 0 ; r1 390 : 0) |
| 0,0175 / 0,0226 au chargement (`picture > img` de `GammeHero.tsx:107-112`) | **image** (dimensions déclarées 1:1, image réelle 3:2) | non, chargement. Ce décalage est présent quelle que soit la méthode (6 passages sur 6) |
| 0,0133 à 0,0602 / 0 à 0,0247 au chargement (cartes `div.pieces-product-card`, `PiecesGridView.tsx:175`) | **contenu dont la place réservée diffère de la taille réelle** (`global.css:411-414`), rendu visible par une **animation** (`PiecesGroupedDisplay.tsx:197`) | non, chargement. Présent avec les trois méthodes |
| ≤ 0,0177 en défilement (molette), ≤ 0,009 (sauts) | aucun décalage au-dessus de 0,01 : non classé | oui, et sous le seuil |

Aucun décalage au-dessus de 0,01 n'est attribuable à une police ni à un élément collant ou fixe. Les polices arrivent
entre 404 et 568 ms. En 390, la première baisse de hauteur (−19 px) tombe dans le même intervalle de 25 ms que la fin
de leur chargement. La baisse suivante (−36 px) a lieu sans police en cours, et la démonstration du § 4 supprime les
deux. Le badge collant du véhicule (`PiecesVehicleContent.tsx:286`) n'apparaît comme poussoir dans aucun décalage.

**Saut programmé ou défilement d'utilisateur.** Le chiffre du rapport ne vient pas des sauts eux-mêmes : la phase
« sauts » du parcours vaut 0 à 0,0041 (r2, r1). Il vient du retrait de la feuille qui suit le parcours. Le défilement
progressif à la molette donne le même résultat que les sauts : au plus 0,0177 en somme sur r2 1440, 0 sur r2 390 et
r1 390.

## 4. Changements proposés (non appliqués) et CLS attendu

Démonstration : chaque correctif est écrit sous forme de feuille dans le HTML reçu, avant tout rendu (variable
`DZ_CORRECTIF_TOT=1` de `cls-causes-dz.cjs`, requête GET de la page seulement). Il n'est injecté ni après le
chargement, ce qui serait trop tard pour un décalage de chargement, ni dans le code. La méthode est la molette, avec
3 passages AVANT et 3 passages avec correctif, alternés, par page et taille. Sur les 24 passages : aucun échec,
statut 200, et les requêtes non GET (3 sur r1, 6 sur r2) coupées.

| page | largeur | correctif | chargement, avec saisie (3 passages) | chargement, hors saisie | défilement (somme) | CLS hors saisie (plus grande fenêtre) | décalages ≥ 0,01 |
|---|---|---|---|---|---|---|---|
| r1-gamme | 390 | aucun (AVANT) | 0,0175 / 0,0175 / 0,0175 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 3 (marqués saisie) |
| r1-gamme | 390 | **c1** | **0 / 0 / 0** | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | aucun |
| r1-gamme | 1440 | aucun (AVANT) | 0,0226 / 0,0226 / 0,0226 | 0,0226 / 0,0226 / 0,0226 | 0,0005 / 0,0004 / 0,0004 | 0,0226 / 0,0226 / 0,0226 | 3 |
| r1-gamme | 1440 | **c1** | **0 / 0 / 0** | 0 / 0 / 0 | 0,0004 / 0,0004 / 0,0005 | **0,0003 / 0,0002 / 0,0003** | aucun |
| r2-produit | 390 | aucun (AVANT) | 0,0398 / 0,0602 / 0,0398 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 4 (marqués saisie) |
| r2-produit | 390 | **c2** | **0 / 0 / 0** | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | aucun |
| r2-produit | 1440 | aucun (AVANT) | 0 / 0 / 0,0169 | 0 / 0 / 0,0169 | 0,0169 / 0,0196 / 0,0176 | 0,0088 / 0,0104 / 0,0169 | 1 |
| r2-produit | 1440 | **c2** | **0 / 0 / 0** | 0 / 0 / 0 | 0,018 / 0,0176 / 0,0168 | 0,0104 / 0,0096 / 0,0088 | aucun |

Le détail par passage est dans [`cls-tableaux-dz.md`](cls-tableaux-dz.md), dernier tableau. Les données sont dans
`cls-brut/correctifs/`.

### c1 — image du haut de la gamme (cause « image »)

- **Où** : `frontend/app/components/gamme/GammeHero.tsx:107-112`. L'`<img>` déclare `width={360} height={360}` avec
  `className="block w-full h-full object-cover"` dans `<picture className="block w-full h-full">` (`:96`), sous un
  conteneur `max-h-[280px] … overflow-hidden` (`:79`).
- **Changement proposé, au choix** :
  1. donner au cadre un rapport fixe, indépendant de l'image : `aspect-[3/2]` sur le conteneur (`:79`) ou sur
     `<picture>` (`:96`), en gardant `object-cover`. L'image remplit alors un cadre déjà dimensionné ;
  2. déclarer les vraies dimensions de l'image servie (`width`/`height` au rapport 3:2), si toutes les images de gamme
     ont ce rapport. Ce n'est vérifié que sur une gamme.

  La 1 ne dépend pas de l'image et reste juste si une gamme a une image d'un autre rapport. C'est la recommandation.
- **Démontré par** : `mesures/cls-correctifs/c1-gamme-image-cadre-fixe.css`, soit
  `picture.block.w-full.h-full > img.object-cover { aspect-ratio: 3 / 2; }`.
- **CLS attendu** : décalage de chargement de **0,0175 → 0** en 390 et de **0,0226 → 0** en 1440, sur 3 passages sur
  3. Le CLS de r1 en 1440 passe de 0,0226 à 0,0003 au plus.
- **Non vérifié** : la taille visuelle finale de l'image sous c1 (pas de capture). La feuille impose 3:2 dès le premier
  rendu ; en 1440, la colonne du sélecteur peut donner au bloc une autre hauteur que les 205 px mesurés. Une
  vérification visuelle sera nécessaire avant de l'écrire dans le code.

### c2 — glissement du groupe de cartes (cause « réserve différente de la taille réelle, rendue visible par une animation »)

- **Où** : `frontend/app/components/pieces/PiecesGroupedDisplay.tsx:197`, classe
  `animate-in fade-in slide-in-from-top duration-500` du conteneur d'un groupe. La réserve des cartes est fixée dans
  `frontend/app/global.css:411-414` (`contain-intrinsic-block-size: auto 360px`).
- **Changement proposé** : retirer `slide-in-from-top` à la ligne 197 et garder `animate-in fade-in duration-500`.
  L'apparition reste en fondu, mais le groupe ne traverse plus l'écran depuis le haut, et les cartes prennent leur
  hauteur réelle hors de la vue. Une autre voie, qui laisse le glissement en place, serait d'aligner la réserve de
  `global.css:413` sur la hauteur réelle. Mais cette hauteur varie selon la largeur (342 px en 390, 445 px en 1440) et
  le contenu de la carte, et le commentaire de `global.css:407-410` lie cette réserve à l'INP du dialogue natif. Elle
  n'est pas démontrée ici.
- **Démontré par** : `mesures/cls-correctifs/c2-produit-groupe-sans-glissement.css`, soit
  `.animate-in.slide-in-from-top:has(> .grid > .pieces-product-card) { --tw-enter-translate-y: 0; }`. Cela revient à
  neutraliser le glissement en gardant le fondu.
- **CLS attendu** : décalages de chargement de **0,0398 à 0,0602 → 0** en 390 (3 passages sur 3) et de **0,0169 (1
  passage sur 3) → 0** en 1440. Le défilement de r2 en 1440 garde une somme de 0,017 environ, faite de décalages
  tous sous 0,01, dont la plus grande fenêtre reste ≤ 0,0104. Ils ne sont pas touchés par c2 et ne sont pas analysés
  plus loin, car ils sont sous le seuil de 0,01 fixé pour ce mandat.

### c3 — la sonde, avant d'activer le contrôle (cause « artefact de la méthode »)

Pas de changement dans le code de l'application : les décalages de 0,082 à 1 n'existent pas en usage réel. Le
changement porte sur la mesure (voir la section suivante) : mesurer sans ajouter ni retirer de feuille
`content-visibility`. `mesure-dz.cjs:256` et `:269` restent utiles pour mesurer les textes, mais dans une autre
session que celle du CLS.

## 5. Les trois autres types de page après défilement

| page | largeur | parcours (AVANT / A3) | sauts (AVANT / A3) | molette (AVANT / A3) | chargement | passe 0,1 |
|---|---|---|---|---|---|---|
| r0-accueil | 390 | 0 / 0 | 0 / 0 | 0 / 0 | 0 | oui |
| r0-accueil | 1440 | 0,0039 / 0,0125 | 0,0042 / 0,009 | 0,0004 / 0,0004 | 0 | oui |
| panier-vide | 390 | 0 / 0 | 0 / 0 | 0 / 0 | 0 | oui |
| panier-vide | 1440 | 0,0001 / 0,0054 | 0 / 0,0022 | 0,0001 / 0,0001 | 0 | oui |
| connexion | 390 | 0 / 0 | 0 / 0 | 0 / 0 | 0 | oui |
| connexion | 1440 | 0 / 0 | 0 / 0 | 0 / 0 | 0 | oui |

Valeurs : CLS hors saisie, plus grande fenêtre de session. Aucun décalage n'atteint 0,01 sur ces trois pages. Ces
pages n'ont ni carte produit ni section `cv-auto` : le retrait de la feuille forcée n'y produit rien (phase « cv
retirée » à 0).

## Ce que cela implique pour le contrôle à 0,1 (proposition, non appliquée)

Avec la sonde actuelle (`mesure-dz.cjs`), le contrôle échouerait sur r2 et r1 à cause de la sonde elle-même. Avant de
l'activer :

1. mesurer le CLS dans une session séparée de celle qui manipule la page, sans feuille ajoutée ni retirée, sans
   centrage ni texte rendu transparent ;
2. défiler à la molette (ou en sauts) jusqu'en bas et retour ;
3. calculer la plus grande fenêtre de session, et non la somme ;
4. compter à part les décalages du chargement et ceux du défilement ;
5. décider si les décalages marqués `hadRecentInput` en 390 sont comptés. Ici aucune saisie n'est envoyée ; ils
   pèsent jusqu'à 0,0602 sur r2. La position prudente est de les compter, puisque rien ne les déclenche côté
   utilisateur.

`mesure-dz.cjs` fait partie des fichiers livrés et n'est pas modifié ici. `cls-causes-dz.cjs` (méthode molette) peut
servir de base.

## Limites

- **Serveur de développement Vite** (DEV, checkout `1210455cd`). Son code frontend est identique à `7f4dded` (base des
  mesures DZ), à quatre fichiers de test près (`frontend/tests/purchase-probe`, `tests/unit`). Les instants
  (chargement en 400 à 900 ms) et l'ordre d'arrivée des feuilles et du JavaScript ne sont pas ceux de la PROD.
- **Laboratoire** : Chromium de Playwright, sans réseau mobile simulé ni ralentissement du processeur, une seule
  machine. Les décalages de chargement de r2 dépendent de l'instant où l'animation croise le rendu des cartes. Ils
  varient d'un passage à l'autre (0,0199 à 0,0602 en 390, 1 passage sur 6 en 1440). D'autres conditions peuvent
  donner d'autres valeurs.
- **Saisie récente** : en 390 seulement (contexte `isMobile` et `hasTouch`, `lib-dz.cjs:19-21`), Chromium marque les
  décalages du chargement `hadRecentInput=true` alors que la sonde n'envoie aucune saisie à ce moment. Cela est
  observé à chaque passage, sur r1 et r2. La cause n'est pas établie.
- **A3** est injectée après le chargement, comme dans les n° 2 à 5 : le CLS de chargement sous A3 n'est pas mesuré en
  tant que tel. Il est identique à AVANT par construction.
- **Images** : les pages du DEV chargent leurs images par `www.automecanik.com/imgproxy` (requêtes GET). Le rapport
  3:2 de l'image de la gamme n'est mesuré que sur `filtre-a-huile-7` ; d'autres gammes peuvent avoir d'autres
  rapports.
- **Une seule page par type** (les routes de `scripts/pages-options-dz.tsv`).
- **Démonstration des correctifs** : feuilles CSS écrites dans le HTML, pas de changement de composant. Ce sont
  3 passages par cas, à la molette seulement. La taille visuelle finale de l'image sous c1 n'est pas vérifiée.
- **Retrait de la feuille forcée** : le mécanisme exact par lequel Chromium compte des nœuds au rectangle précédent vide
  n'est pas établi. Ce qui est mesuré : l'instant, la mutation, la variation de hauteur et les sources.

## Constats hors périmètre (signalés, non corrigés)

- `mesure-dz.cjs` mesure le CLS dans la même session que les manipulations de la page (Tab, centrage, texte
  transparent, feuille `content-visibility`). Les chiffres « CLS après défilement » du rapport DZ (section h, et
  `mesures/tables-readme.md:524` pour r2 390) ne sont donc pas des CLS d'utilisateur.
- Les décalages du chargement en 390 sont exclus du rapport, comme ici, car Chromium les marque `hadRecentInput`. Le
  rapport sous-estimait donc le CLS de chargement en 390 de 0,0175 (r1) et de 0,0199 à 0,0602 (r2).

## Refaire

Depuis `docs/audit/design-system-revue-20261119/options`, avec `NODE_PATH` pointant sur les `node_modules` du
monorepo et le DEV en marche :

```bash
node scripts/cls-causes-dz.cjs r2-produit /pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html 390 844 avant molette /tmp/r2.json
node scripts/chronologie-chargement-dz.cjs /pieces/filtre-a-huile-7.html 1440 900 /tmp/chrono-r1.json
DZ_CORRECTIF_TOT=1 node scripts/cls-causes-dz.cjs r1-gamme /pieces/filtre-a-huile-7.html 390 844 avant molette /tmp/c1.json mesures/cls-correctifs/c1-gamme-image-cadre-fixe.css
node scripts/condense-cls-dz.cjs mesures/cls-brut mesures/cls-tableaux-dz.md mesures/cls-brut/correctifs
```
