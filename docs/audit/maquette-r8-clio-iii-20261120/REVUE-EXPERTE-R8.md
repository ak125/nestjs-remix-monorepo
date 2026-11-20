# Revue experte de l'ordre des blocs de la page véhicule Clio III 1.5 dCi 86 ch (PR #2224) — complément n° 14 au mandat DU

**Tête mesurée de #2224** : `ddc54efa01bb8aaec6dfa30b2a5387a16d4d65ad` (branche `feat/maquette-r8-clio-iii-20261120`, brouillon).
- Relevée par `gh pr view` et `git ls-remote` le 2026-11-20 à 22:52:50 UTC, puis de nouveau à 23:20:00 UTC : inchangée.
- Base de comparaison : `980d371a2` (tête annoncée par DS avant la maquette).
- Page revue : `/constructeurs/renault-140/clio-iii-140004/1-5-dci-19052.html` (type 19052).

**Verdict : « ordre des blocs R8 : corrections d'abord ».**

Corrections demandées avant de présenter l'ordre à Marwane :
1. **Remettre l'accès aux pièces dans le premier écran**, à 390 px comme à 1 440 px. La fiche technique complète passe aujourd'hui devant la recherche, qui sort du premier écran aux deux largeurs (§3).
2. **Placer le bloc « pièces les plus recherchées » dans l'accès aux pièces**, et non après « Erreurs fréquentes ». Il doit être nourri par la demande de `__seo_keywords` et limité aux gammes vendables et indexables (décision 82). Ce bloc rendrait le lien « Câble de frein à main », perdu alors qu'il est demandé et vendable, et ajouterait deux gammes demandées qui n'ont jamais eu de lien (§2.2).
3. **Ne servir aucun emplacement de maquette.** Les 5 emplacements affichent un texte interne (« Emplacement maquette », « Source attendue : … ») aux visiteurs et à Google, y compris en mode production. Deux d'entre eux s'affichent sur toutes les pages véhicule, car ils n'ont pas de condition. Il faut les remplir ou les retirer, et ajouter un test qui échoue si `data-maquette` apparaît dans le HTML servi (§2.3).
4. **Rendre la CI de #2224 propre avant toute demande de fusion** (§4.5) :
   - 3 alertes CodeQL dans `outils/ssr-r8.cjs`, dont 2 de gravité haute ;
   - la garde `check-cart-conversion-r-role.sh` échoue sur trois lignes de prose du README ;
   - l'auto-évaluation DoD est absente du corps de la PR.

Les points 1 et 2 portent sur l'ordre lui-même. Les points 3 et 4 bloquent la fusion, pas la présentation de l'ordre.

## 1. Rôle et contrat de la page véhicule

### 1.1 L'ordre face au rôle

Références : `.spec/00-canon/role-matrix.md`
- `:186-197` : fiche de la page véhicule ;
- `:211` : contenu, sorties R1 / R2 / R5 / outil, interdits R7, R2, R3, R4 et diagnostic personnalisé ;
- `:336-347` : la page n'est pas une surface de commande.

| # | Bloc servi (ordre DS) | Conforme au rôle ? | Constat mesuré |
|---|---|---|---|
| 1 | Fil d'Ariane, sans niveau modèle | oui | Voulu par Marwane (20 nov., 22:57). Google recommande un fil qui suit le parcours réel plutôt que l'arborescence des URL. |
| 2 | Titre (H1 inchangé) | oui | « RENAULT CLIO III 1.5 dCi 86 ch de 2005 à 2012 » donne déjà le modèle, la motorisation, la puissance et la période. |
| 3 | Identité + fiche technique complète | oui sur le fond, **non sur la place** | La fiche (environ 435 px) repousse la recherche hors du premier écran. Voir §3. |
| 4 | Accès aux pièces (introduction, accès rapide, catalogue) | oui (sortie R2) | 19 familles en h3. Les 6 raccourcis d'accès rapide filtrent le catalogue (`#catalogue`) sans mener à une page pièce. C'était déjà le cas avant. |
| 5 | Erreurs fréquentes | oui | Le contenu porte sur l'identification : année, CNIT ou code moteur, VIN (case E), carrosserie. Ce n'est ni un diagnostic ni une procédure R3. |
| 6 | Pièces les plus recherchées (emplacement) | oui sur le fond, **mal placé** | Voir §2.2 : ce bloc sert la demande principale et doit rejoindre le bloc 4. |
| 7–8 | Points d'usure, spécificités (emplacements) | oui | Ces blocs sont prévus au contenu du rôle (`:211`). Ils sont vides pour 19052, car `r8_content` est nul. |
| 9 | Liens R1 / R5 / outil (emplacement) | oui sur le fond, **absent en fait** | Aujourd'hui, le corps de page ne sert aucune sortie R1, R5 ou outil. R5 n'apparaît que dans l'en-tête et le pied de page communs (`/diagnostic-auto`). |
| 10 | FAQ (emplacement si vide) | oui | Il n'y a pas de FAQ de secours, ce qui est conforme à la garde existante. |
| 11 | Réassurance (commune) | à arbitrer | « Livraison 24-48h » est un signal transactionnel. C'est un design commun au site, réservé à Marwane. |
| 12 | Retour marque R7 | oui | 3 liens R7 en tout : le fil d'Ariane, « Voir toutes les pièces RENAULT → » et « Modèles RENAULT ». Ils ne dominent pas la navigation. |

Blocs retirés :
- **« Pièces auto RENAULT les plus vendues »** : retrait justifié. Ce titre n'a aucune donnée de vente derrière lui (DS, §1.2 : une seule commande payée en 12 mois). Le bloc portait 8 fois la formule « à prix bas » et la promesse « 24-48h ». Son retrait coûte deux liens (§2.2).
- **« Comment choisir sans se tromper »** : retrait justifié. Il répétait « Erreurs fréquentes » et dérivait vers la procédure (R3).
- **Badges** « 100 % compatible / Vérif VIN / Livraison / Retour » : retrait justifié. La promesse « Vérif VIN » renvoyait à un outil absent de la page.

Interdits : la page reste sans prix, sans panier propre et sans stock.
- Le relevé SSR après maquette trouve encore « prix » ×2 : le title « à prix discount » et le tiroir panier commun, caché.
- Il trouve aussi « panier » ×9 (en-tête et tiroir communs) et « livraison » ×6 (commun et réassurance).
- Avant la maquette : « prix » ×10.
- L'affirmation de DS « aucun terme interdit » (§7.4, point 6) est donc vraie pour le texte propre à la page, fausse pour le HTML servi en entier.

### 1.2 Les 7 arbitrages de DS (§7.4)

| # | Arbitrage | Avis | Motif |
|---|---|---|---|
| 1 | `:211` prime sur `:194` | **d'accord** | `:211` est la seule ligne qui donne ensemble sorties et interdits. La contradiction reste dans le canon. Sa correction relève de l'owner (`.spec/00-canon/**`). |
| 2 | R7 = lien de retour seulement | **d'accord** | Mesuré : 3 liens R7, aucun bloc de navigation marque. |
| 3 | Pas de prix, panier ou stock ; liens R2 admis | **d'accord, incomplet** | Le title « Pièces RENAULT CLIO III 1.5 dCi à prix discount » reste un signal R2. Le title est réservé à Marwane ; à inscrire comme décision attendue, pas comme « étape suivante » implicite. |
| 4 | S_COMPAT_CHECK = outil lié | **d'accord en principe** | Aucun lien vers l'outil n'est servi : la sortie « outil » de `:211` manque tant que l'emplacement 9 est vide. |
| 5 | `r8.ts` mis à jour plus tard | **acceptable, avec une condition** | `packages/seo-role-contracts/src/contracts/r8.ts` a `allowed_sections: []`. Aucun contrat exécutable ne protège donc l'ordre. L'ordre validé doit être reporté dans `r8.ts`, avec un test, avant d'être appliqué aux autres types (décisions 55 et 57). |
| 6 | Pas de texte ajouté, liste de termes interdits plus tard | **d'accord, constat à corriger** | Voir le relevé ci-dessus : les occurrences restantes viennent du title et des composants communs. |
| 7 | `Car` est un sous-type de `Vehicle` | **d'accord** | C'est conforme à schema.org. Le JSON-LD est inchangé (Brand, BreadcrumbList, Car, EngineSpecification, Organization). |

## 2. Requêtes réelles (décision 157) et Google

### 2.1 Ce que les gens cherchent pour ce véhicule

Toutes les requêtes ci-dessous sont en lecture seule ([`revue-du/requetes/`](revue-du/requetes/), résultats dans [`revue-du/mesures/q2.txt` à `q6.txt`](revue-du/mesures/)).
- La table `__seo_keywords` compte 13 978 mots-clés.
- 33 sont rattachés au type 19052, pour un volume de 9 700, sur 6 gammes.
- En élargissant au texte « clio 3 / clio iii », toutes motorisations, la demande porte uniquement sur des pièces.

| Gamme | Volume « clio 3 » | Rattachés à 19052 | Lien servi après |
|---|---|---|---|
| Filtre d'habitacle (424) | 15 650 | 1 | oui |
| Filtre à carburant (9) | 12 600 | 1 | oui |
| Filtre à huile (7) | 3 950 | 0 | oui |
| Disque de frein (82) | 2 950 | 20 | oui |
| Plaquette de frein (402) | 2 700 | 9 | oui |
| Courroie de distribution (306) | 2 400 | 0 | oui |
| Filtre à air (8) | 2 000 | 1 | oui |
| **Tambour de frein (123)** | **1 300** | 0 | **non (ni avant)** |
| Kit de distribution (307) | 1 250 | 0 | oui |
| Courroie d'accessoire (10) | 1 200 | 0 | oui |
| **Interrupteur des feux de frein (806)** | **1 150** | 0 | **non (ni avant)** |
| Étrier de frein (78) | 400 | 0 | oui |
| **Câble de frein à main (124)** | **100** | **1** | **non (perdu par #2224)** |

Les requêtes propres à la motorisation (« … clio 3 1.5 dci ») vont au même endroit : filtre à huile, filtre à gasoil et courroie de distribution, à 500 chacune.
- Aucune requête « fiche technique » ou « motorisation » n'apparaît dans `__seo_keywords`.
- DS relève dans la Search Console quelques requêtes d'identification : « br1f0h », « moteur clio 3 1.5 dci », des références OE. Je n'ai pas revérifié ces chiffres. Elles restent rares : 143 impressions en tout pour la page 19052 sur 5,5 mois, et 5 impressions pour la première requête.

**Conclusion pour l'ordre** :
- La demande mesurée va aux pièces.
- L'identification sert à confirmer le véhicule ; une ligne compacte y suffit.
- Faire passer la fiche technique complète devant l'accès aux pièces inverse cette priorité.

### 2.2 Liens perdus et liens manquants

Liens R2 uniques servis : 74 avant, 72 après. Les deux liens perdus venaient seulement du bloc « plus vendues » :

| Gamme | Pièces liées / vendables (19052) | Sitemap pièces | Page R2 sur DEV | Demande |
|---|---|---|---|---|
| Câble de frein à main (124) | 166 / 37 | oui (`has_item` 30) | 200, `index, follow` | 100 (« cable frein a main clio 3 »), dont 50 rattachés à 19052 |
| Rotule de suspension (2462) | 142 / 11 | oui (`has_item` 13) | 200, `index, follow` | aucune requête « clio 3 » mesurée |

- La perte du câble de frein à main contredit la décision 157 : la page est demandée, vendable et indexable.
- La perte de la rotule est défendable du point de vue de la demande. Je n'ai pas vérifié si la page reste liée depuis d'autres pages du site (risque d'orpheline, rapport prévu par la décision 82).
- Tambour de frein (13 pièces vendables) et interrupteur des feux de frein (10) sont demandés, vendables et au sitemap. Ils n'ont jamais eu de lien sur cette page. Ce manque existait déjà ; un bloc « pièces les plus recherchées » branché sur la demande le comblerait.

Constat existant, inchangé par #2224, contraire à la décision 82 (« lien créé seulement vers une page vendable et indexable ») :
- Sur 72 gammes liées après la maquette, **7 n'ont aucune pièce vendable** pour 19052 : Attelage, Rétroviseur extérieur, Feu avant, Tringlerie d'essuie-glace, Capteur niveau d'huile moteur, Neiman, Commande de ventilation.
- Deux de ces pages R2 sont servies en `noindex, follow` (Attelage, Rétroviseur extérieur). Deux autres sont en `index, follow` sans produit vendable (Feu avant, Neiman).
- Au total, le type 19052 a 363 gammes liées, dont 130 avec au moins une pièce vendable. 67 de ces 130 avaient un lien avant, 65 en ont un après.

### 2.3 Emplacements vides : risque de contenu mince

- Les 5 emplacements ajoutent environ 100 mots de texte interne : « Emplacement maquette », « Source attendue : règles de liens par rôle (décision 82), non configurées », etc.
- Ils sont servis en SSR avec `NODE_ENV=production`, sans garde. Le commentaire du code de DS dit lui-même « À remplir ou retirer avant toute fusion ».
- `S_PLACEHOLDER_TOP_PARTS` et `S_PLACEHOLDER_LINKS` n'ont aucune condition. Après fusion, ils s'afficheraient sur toutes les pages véhicule servies par cette route. Le commentaire de `sitemap-v10.service.ts` parle d'environ 8 800 pages véhicule indexables ; je ne l'ai pas compté.
- Google qualifie de contenu produit à grande échelle les pages « generated for the primary purpose of manipulating search rankings and not helping users ». Il demande aussi si le contenu apporte une « substantial value when compared to other pages ». Un bloc de texte interne répété sur des milliers de pages ne répond à aucun de ces critères.
- Le retrait des blocs « plus vendues » et « Comment choisir » ne crée pas de contenu mince. Le texte passe de 1 151 à 959 mots, et ce qui part était surtout du remplissage (« à prix bas », redites).

### 2.4 Ancienne page modèle en 410

Elle est propre. Le 410 ne vient pas de #2224 : il existe sur `main` depuis #973 (ADR-084, `7b9fef65af`).

| Contrôle | Résultat |
|---|---|
| `/constructeurs/renault-140/clio-iii-140004.html` (DEV :3000 et mon rendu) | **410 Gone**, sans redirection, title « Page non trouvée » |
| Robots | en-tête `x-robots-tag: noindex, follow` ; meta `noindex, nofollow` |
| Sitemaps DEV (`sitemap-vehicules.xml`, `sitemap-brands.xml`) | 0 occurrence ; aucune URL de niveau modèle |
| Liens internes vers elle | 0 depuis la page R7 Renault (DEV) ; 0 depuis 19052 (avant et après) ; 0 depuis deux pages R2 du type et la page R1 filtre à huile |
| Page R7 Renault | 200, avec 3 liens vers 19052 |

Remarques :
- Google traite tous les 4xx sauf 429 de la même façon : l'URL sort de l'index avec le temps. Le `noindex` est superflu, sans danger.
- L'en-tête dit `follow` et la meta dit `nofollow`. C'est une incohérence mineure et sans effet sur un 410 ; à aligner un jour, hors périmètre.
- Inconnue : les liens externes et les autres pages du site non explorées.

## 3. Accès aux bonnes pièces : la recherche sort du premier écran

### 3.1 Mesures (mon rendu, fenêtres 390 × 844 et 1 440 × 900)

| Position (y, px) | 390 avant | 390 après | 1 440 avant | 1 440 après |
|---|---|---|---|---|
| Fiche technique | 13 818 | **551** | 4 685 | **345** |
| Accès rapide | 688 | 1 404 | 546 | 976 |
| **Champ de recherche** | **757** (visible) | **1 473** (hors écran) | **615** (visible) | **1 045** (hors écran) |
| Catalogue | 1 468 | 1 823 | 919 | 1 192 |
| Premier lien vers une page pièce | 1 990 | 2 345 | 1 353 | 1 626 |
| Hauteur du document | 17 073 | 13 584 | 6 838 | 6 101 |

- DS signale la sortie du premier écran à 390 px. **Elle se produit aussi à 1 440 px** : le champ passe de 615 à 1 045 px, pour une fenêtre de 900 px.
- Aucun lien vers une page pièce n'est dans le premier écran, ni avant ni après.

### 3.2 Est-ce acceptable ?

Non, pour trois raisons mesurées ou sourcées :
- La demande va aux pièces (§2.1). L'identification est rare et le H1 la porte déjà.
- NN/g (2018) : « users spent about 57% of their page-viewing time above the fold », et « Reserve the top of the page for high-priority content: key business and user goals ».
- Baymard : « Users shouldn't have to hunt for search », et « If search is part of your product-finding strategy, the field needs to be prominent and clearly identifiable ».

La fiche technique doit rester tôt et lisible, mais pas en entier avant l'accès aux pièces. Selon Baymard, une fiche plus courte que deux écrans (c'est le cas ici, environ 435 px) n'a pas besoin de résumé. Le problème n'est donc pas sa longueur mais sa place.

### 3.3 Meilleure option (proposée, non appliquée)

1. Fil d'Ariane.
2. H1 inchangé.
3. **Ligne d'identité compacte** sous le H1 : image réduite, période, puissance, carburant, code moteur, types mines ou CNIT. Toutes ces données sont déjà dans le payload. Elle tient en deux lignes à 390 px et répond à « est-ce bien ma voiture ».
4. **Accès aux pièces** : recherche, puis **pièces les plus recherchées** (liens directs vers les pages R2 vendables et indexables, classées par la demande de `__seo_keywords`), puis catalogue. Ce bloc remplace les raccourcis actuels, qui ne font que filtrer.
5. **Fiche technique complète**, dépliée, juste après le catalogue. Elle reste dans le HTML servi et visible sans clic, ce qui évite tout contenu masqué.
6. Erreurs fréquentes, juste après la fiche : les deux blocs d'identification sont ainsi voisins.
7. Points d'usure, spécificités, liens R1 / R5 / outil, FAQ : seulement quand la donnée existe, sinon rien.
8. Réassurance et retour marque, inchangés.

Effet attendu : la recherche et les premiers liens R2 reviennent dans le premier écran aux deux largeurs. Ce n'est pas mesuré, puisque rien n'est appliqué.

Variante plus légère : garder la fiche à sa place, mais repliée (`<details>`) après les 4 premières lignes. Elle est moins bonne : elle laisse l'identité devant la recherche et ajoute un clic pour lire la fiche.

## 4. Accessibilité, titres, vitesse, régressions

### 4.1 Hiérarchie des titres (SSR après)

- h1 : titre du véhicule.
- h2 « Fiche technique ».
- h2 « Acces rapide ».
- h2 « Catalogue de pieces auto », avec 19 h3 de familles.
- h2 « Erreurs fréquentes à éviter ».
- h3 de réassurance, puis titres du pied de page.

Constats :
- Il n'y a pas de saut de niveau.
- Aucun emplacement ne porte de titre. Ils affichent pourtant un libellé en gras qui ressemble à un titre (WCAG 1.3.1 : la structure présentée doit être exprimée dans le code). À traiter si l'un d'eux est gardé.
- « Acces rapide », « Catalogue de pieces auto » et le sous-titre « Trouvez les pieces auto compatibles avec votre vehicule » n'ont pas d'accents. C'était déjà le cas ; le texte est réservé à Marwane.

### 4.2 Accessibilité (axe-core, WCAG 2.0 / 2.1 / 2.2 A et AA)

Les résultats sont **identiques avant et après**. Toutes les violations sont dans des parties communes au site.

| Vue | Violations |
|---|---|
| 390 | `color-contrast` ×10 (dont « Compact », ratio 4,39), `region` ×2 (bandeau haut) |
| 1 440 | `color-contrast` ×6, `region` ×4 |

- DS relève `link-name` ×1 à 390 et un contraste ×7 à 1 440. L'écart vient probablement des états mesurés : DS a aussi mesuré les familles dépliées, pas moi. Aucune violation n'est dans les blocs déplacés.
- Existant, hors #2224 : un champ ramené en haut de fenêtre (par exemple avec Maj+Tab) est entièrement caché par la barre véhicule fixe de 55 px. C'est un écart possible à WCAG 2.2, critère 2.4.11, commun à la route. Capture : [`revue-du/captures/apres-cible-1440.png`](revue-du/captures/apres-cible-1440.png).
- Existant : le champ de recherche n'a ni `<label>` ni `aria-label`. Son texte indicatif lui sert de nom accessible, et axe ne signale rien. Ce texte disparaît pourtant dès la saisie : une étiquette visible serait plus sûre.

### 4.3 Vitesse (laboratoire, 5 passages, mon rendu)

| Vue | Version | LCP (ms) | CLS | INP (ms) |
|---|---|---|---|---|
| 390 | avant | 188–280 | 0 | 48 (geste isolé) |
| 390 | après | 180–344 | 0 | 48 (raccourci), 24 (clic famille isolé) |
| 1 440 | avant | 200–344 | ≤ 0,0002 | 40–56 |
| 1 440 | après | 168–288 | ≤ 0,0002 | 48–56 |

- Tout est très en deçà des seuils de Google (LCP < 2,5 s, INP < 200 ms, CLS < 0,1). Les écarts restent dans le bruit.
- Le DOM passe de 1 491 à 1 140 nœuds, le HTML de 195 127 à 158 051 octets (gzip : 26 469 → 24 605).
- Existant, non causé par #2224 : à 390 px, dans une séquence scriptée (raccourci, saisie, effacement, clic sur une famille), le clic de famille mesure environ 830 ms. Ce chiffre apparaît sur 4 passages sur 5 avant et sur 5 sur 5 après. Le même clic isolé mesure 24 ms. La cause n'est pas identifiée. Ce sont des mesures de laboratoire, pas de terrain.
- Note de méthode : un premier relevé à 1 180 ms à 1 440 px était un artefact. Le champ visé était caché sous la barre fixe et le clic tombait sur la barre. Corrigé en centrant la cible ([`revue-du/scripts/cwv-r8-du14.cjs`](revue-du/scripts/cwv-r8-du14.cjs)).

### 4.4 Diff et contrôles statiques

- Diff `980d371a2 → ddc54efa0` : un seul fichier de code, `frontend/app/routes/constructeurs.$brand.$model.$type.tsx` (+188 / −278) ; le reste est de la documentation et des relevés.
- Ajouts : le composant `EmplacementMaquette` et l'aide `hasR8Block`. La fiche technique est déplacée dans le bloc d'identité.
- Retraits du rendu : `S_BESTSELLERS`, `HowtoSection`, les badges. Le code des composants retirés n'est pas modifié.
- Existant conservé : la surcouche `technical_specs` lue depuis `r8Content`, marquée RAG dans le code. Elle est à vérifier au regard de l'invariant 4 (aucune autorité RAG sur le contenu), hors #2224.

| Contrôle (à `ddc54efa0`, mon worktree) | Résultat |
|---|---|
| `tsc --noEmit` (frontend) | 0 erreur |
| ESLint (route) | 0 erreur |
| vitest, 7 fichiers (`r8-hero-h1-parity`, `r8-mine-codes-country-not-rendered`, `r8-schema`, `constructeurs-html-wrapper-noindex`, `constructeurs-model-410`, `constructeurs-brand-loader-parallel`, `catch-all-data-suffix-redirect`) | **52 / 52** |

### 4.5 CI de `ddc54efa0`

Sur 47 vérifications : 30 succès, 11 ignorées, **6 échecs** ([`revue-du/mesures/ci.tsv`](revue-du/mesures/ci.tsv)).

| Échec | Cause |
|---|---|
| CodeQL | 3 nouvelles alertes dans `docs/audit/maquette-r8-clio-iii-20261120/outils/ssr-r8.cjs`. Deux sont hautes, à la ligne 47 : double déséchappement et filtre `<script>` sensible à la casse. Une est moyenne, à la ligne 84 : donnée réseau écrite dans un fichier. Elles touchent un script de mesure, pas l'application. |
| `check-cart-conversion-r-role.sh` | La garde signale les lignes 147, 318 et 321 du README de DS. Ces lignes citent la page véhicule avec des mots de commande pour dire justement qu'elle n'en porte pas. C'est un faux positif de forme, mais la garde est bloquante. Il faut reformuler, pas contourner. |
| 🧾 DoD self-evaluation present (×2) | Bloc d'auto-évaluation absent du corps de la PR. |
| Registry freshness (warn-only) | Avertissement seulement. |
| 🚦 Circuit de fusion | Conséquence des échecs ci-dessus. |

## 5. Sources de référence et marché

| Source | Ce qu'elle dit (citation) | Application ici |
|---|---|---|
| Google, codes HTTP | « All 4xx errors, except 429, are treated the same » ; « the indexing pipeline removes the URL from the index if it was previously indexed » | Le 410 de la page modèle suffit (§2.4). |
| Google, règles anti-spam | contenu à grande échelle : « many pages are generated for the primary purpose of manipulating search rankings and not helping users » ; doorway : « created to rank for specific, similar search queries » | Aucun emplacement servi (§2.3). Chaque page véhicule doit apporter ses propres données. |
| Google, contenu utile | « Is the content primarily made to attract visits from search engines? » ; « substantial value when compared to other pages » | Le retrait du remplissage est justifié. Pas de texte générique en remplacement. |
| Google, fil d'Ariane | « We recommend providing breadcrumbs that represent a typical user path to a page, instead of mirroring the URL structure. » | Le fil sans niveau modèle est conforme. |
| Google, Core Web Vitals | LCP « within the first 2.5 seconds », INP « less than 200 milliseconds », CLS « less than 0.1 » | Respectés en laboratoire (§4.3). |
| Baymard, recherche | « Users shouldn't have to hunt for search. » | La recherche doit revenir dans le premier écran (§3). |
| Baymard, fiches techniques | « specification sheets that are shorter than two viewports will likely not require a summary » | La fiche n'a pas à être résumée, seulement déplacée. |
| Baymard, référentiel automobile 2026 (extraits) | « clear category access, prominent vehicle-based product finders » | L'accès aux familles et aux pièces passe en premier. |
| NN/g, défilement et attention (2018) | « users spent about 57% of their page-viewing time above the fold » ; « Reserve the top of the page for high-priority content » | Le haut de page doit servir l'objectif principal : trouver la pièce. |
| NN/g, divulgation progressive | « Initially, show users only a few of the most important options. » | Une ligne d'identité compacte d'abord, la fiche complète ensuite. |
| WCAG 2.2 | 1.3.1, 2.4.6, 2.4.11 (« not entirely hidden due to author-created content »), 2.5.8 (« at least 24 by 24 CSS pixels ») | §4.1 et §4.2. |

**Fiches véhicule du marché** :
- Oscaro, Mister-Auto, auto-doc.fr, autodoc.co.uk, piecesauto24, Carter-Cash et Norauto ont toutes répondu 403 aux lectures automatiques. **Leur ordre de blocs n'est donc pas connu**, et je ne le décris pas.
- Seul constat structurel : Oscaro publie une URL par famille de pièces et par type de véhicule (motif `…-1122-17242-0-gt`).
- La concurrence n'est pas une règle ici. Les arguments ci-dessus reposent sur la demande mesurée et sur les sources publiques.

## 6. Couverture, exclusions, inconnues

**Couvert** :
- Page 19052 rendue par moi aux deux têtes (`980d371a2` et `ddc54efa0`), sur un backend et un Redis privés, sans `:3000`. Les images `/img` sont lues sur DEV en GET seulement.
- SSR, positions, axe, CWV de laboratoire à 390 et 1 440 px.
- Base en SELECT seulement : demande, vendabilité, sitemap.
- DEV `:3000` en GET : page modèle, page R7, sitemaps, pages R2 et R1.
- CI de la tête, typecheck, ESLint, vitest.

**Exclu** (mandat) :
- toute correction de #2224 ;
- la page R2, le V-Level, #2210, toute fusion ;
- le worktree et la session de DS, dont la branche locale décrite au §4 de son README, que je n'ai pas lue.

**Inconnues** :
- liens externes vers l'ancienne page modèle ;
- liens internes vers la rotule de suspension depuis d'autres pages ;
- les autres types de page véhicule, rendus par le même code mais non mesurés ;
- les mesures de terrain ;
- l'ordre des blocs chez les concurrents (403) ;
- la cause des 830 ms de la séquence à 390 px.

Je n'ai pas revérifié les chiffres Search Console de DS.

**État en 5 points** :
- **Implémenté** : la revue et ses preuves, dans `revue-du/`.
- **Intégré** : poussé sur la branche de #2211, sans fusion.
- **Vérifié** : mesures reproductibles avec les scripts et requêtes joints.
- **Opérationnel** : sans objet (aucune mise en service).
- **Bloqué** : rien pour ce livrable. La validation de l'ordre, la fusion, le tag et le design commun restent à Marwane.

## Fichiers

- [`revue-du/scripts/`](revue-du/scripts/) : analyse SSR, positions, CWV et INP, résumé axe. axe a été lancé avec `../maquette-r1-filtre-a-huile-20261119/scripts/page-du4.cjs`.
- [`revue-du/requetes/`](revue-du/requetes/) : requêtes SELECT q2 à q6.
- [`revue-du/mesures/`](revue-du/mesures/) : résultats SSR, positions, axe, CWV, base, CI, typecheck, ESLint, vitest.
- [`revue-du/captures/`](revue-du/captures/) : avant et après, à 390 et 1 440 px, plus la capture de la cible cachée par la barre fixe.

Chemins rendus génériques : `<worktree>`, `<scratchpad>`, `<checkout>`, `localhost`.

LIVRABLE COMPLÉMENT N° 14 DU
