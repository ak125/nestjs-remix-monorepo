# Mandat DG — Pages conseil et pages gamme : quelle page vise quelle requête

Relevé du 2026-11-19, entre 06:00 et 06:41 UTC. Le relevé est en lecture seule : aucun
code, aucun contenu, aucun titre, aucune base ni aucune page n'a été modifié. Ce document
sépare ce qui est **relevé** (mesuré, avec sa source) de ce qui est **proposé** (non
appliqué, à décider par Marwane).

- Base massdoc : SELECT seuls, en transaction en lecture seule, avec un délai
  d'instruction de 30 s. Les fichiers `sql/q01`–`q10` sont rejouables.
- Pages PROD : 38 GET simples, au plus un par seconde, sur un budget de 60. Les heures
  sont dans `data/pages_prod_horodatage.txt`.
- Classement des requêtes : la règle est écrite dans l'en-tête de
  `scripts/classer_requetes.py` et se rejoue avec `python3 -I scripts/classer_requetes.py`.
- Le rapport ne contient aucune donnée client, aucun identifiant de session et aucun secret.

Pour la commande de chaque chiffre, voir `README.md`.

## Ce qu'il faut retenir

1. **Le principe « conseil pour les requêtes nues et les questions, gamme pour l'achat »
   tient pour les deux premières familles, pas pour l'achat.**
   - Requêtes nues : la page conseil est en position 28,5 sur 41 360 impressions. La page
     R1 est en position 62,1 sur 7 661 impressions.
   - Requêtes d'achat : la page R1 a plus d'impressions (2 059), mais en position 38,4
     (page 4 de Google). La page conseil fait mieux sur ces requêtes : position 25,7.
2. **Le passage conseil → gamme n'est pas mesurable aujourd'hui.**
   - Les 5 liens de chaque page conseil vers sa propre page gamme ne sont pas marqués.
   - Ce qui est mesuré : 21 clics en 90 jours vers *d'autres* gammes, pour 1 563 sessions
     GA4 sur les pages conseil, soit environ 1,3 %. C'est un minimum.
   - Les passages conseil → liste R2 et conseil → panier ne sont pas mesurables non plus.
3. **Ce que servent les pages en PROD.**
   - Les 16 pages conseil relevées n'ont aucun sélecteur de véhicule. Elles portent 5 liens
     vers la page R1 de leur gamme, qui viennent de 3 sources différentes :
     - 2 gabarits codés en dur ;
     - 2 champs de la base ;
     - 1 composant.
   - 4 de ces cibles sont fausses sur les 85 pages conseil :
     - 2 pointent vers une gamme non indexable ;
     - 1 pointe vers la page conseil elle-même ;
     - 1 est vide.
4. **Proposition prioritaire** : marquer d'abord les liens (sinon aucun changement ne sera
   mesurable), puis remplacer les 5 liens par un bloc unique généré par la règle
   « indexable ».
   - Les titres R1 d'achat ne gagnent rien avec les règles actuelles : `prix` est interdit
     dans les titres R1.
   - Le seul gabarit qui couvre la moitié des impressions d'achat exige de changer cette
     règle. Cette décision appartient à Marwane.

---

## Point 3 du mandat — recoupement des chiffres du pilotage

**Relevé.**
- `sql/q04-recoupement-faits-pilotage-31j.sql` → `data/q04-recoupement-faits-pilotage-31j.csv`
  (06:40:47Z)
- `sql/q04b-recoupement-fenetre-pilotage-29j.sql` → `data/q04b-…csv` (06:40:48Z)
- `sql/q05-exemples-pilotage-31j.sql` → `data/q05-…csv` (06:40:49Z)

| Fenêtre | Requêtes R1 | Partagées avec une page conseil | Conseil devant | R1 devant |
|---|---|---|---|---|
| Pilotage (cité) | 814 | 287 | 199 | 88 |
| 31 j, 2026-10-17 → 11-16 | 843 | 293 | 205 | 88 |
| **29 j, 2026-10-19 → 11-16** | **814** | **287** | **199** | **88** |

**D'où vient l'écart.**
- Les chiffres du pilotage se reproduisent exactement sur **29 jours**, du 19 octobre au
  16 novembre, et non sur les 31 jours annoncés.
- Le dernier jour disponible est le 16 novembre : la table `__seo_gsc_daily` couvre
  2026-04-01 → 11-16, et sa dernière lecture date du 11-19 à 04:00Z.
- Sur 31 jours, il y a 29 requêtes R1 de plus, et la conclusion ne change pas : la page
  conseil est devant dans 70 % des cas.
- Une « requête partagée » est une requête qui a des impressions à la fois sur une page R1
  et sur au moins une page conseil, de n'importe quelle gamme (variante A). La position
  comparée est la moyenne pondérée par les impressions.

**Exemples cités, sur 31 j** (`q05`) :

| Requête | Conseil : impressions / position | R1 : impressions / position |
|---|---|---|
| arbre a came | 2 546 / 2,7 | 24 / 60,2 |
| corps papillon | 427 / 2,1 | 14 / 23,6 |
| colonne de direction | 337 / 7,5 | 27 / 85,2 |
| cable d'embrayage | 253 / 10,2 | 17 / 45,2 |
| joint cache culbuteur | 227 / 26,2 | 72 / 73,4 |
| support moteur | 227 / 52,8 | 169 / 80,8 |
| alternateur | 179 / 76,4 | 188 / **66,1** (la R1 est devant) |

---

## 6.1 Carte des requêtes

### Données et anonymisation (relevé)

- **Source.** `__seo_gsc_daily` (grain requête), du 2026-08-19 au 2026-11-16 (90 jours),
  avec `sql/q01` → `data/gsc_r1_conseil_90j.csv`. Les totaux par page viennent de
  `__seo_gsc_daily_page_totals` (`sql/q02`).
- **Types de page.**
  - R1 : `/pieces/<alias>-<id>.html`.
  - Conseil : `/blog-pieces-auto/conseils/<alias>`.
- **Part des impressions anonymisées par Google** (`out/anonymisation.csv`). Il s'agit des
  impressions absentes du grain requête. Les tableaux ci-dessous ne portent donc que sur
  la part restante.

| Type | Impressions (grain requête) | Impressions (total page) | Part anonymisée |
|---|---|---|---|
| R1 | 20 008 | 27 689 | **27,7 %** |
| Conseil | 76 149 | 123 875 | **38,5 %** |

### Règle de classement (rejouable)

La règle est recopiée de `scripts/classer_requetes.py`, où elle fait foi. Elle s'applique
dans l'ordre, et la première qui correspond l'emporte. Elle est relative à la gamme de la
page qui reçoit la requête.

0. **exclue** : la requête est synthétique, de la forme `^ai\d+$` (identifiants internes,
   0 clic).
1. **question** : la requête contient un mot de la liste QUESTION (comment, quand,
   symptome, changer, remplacer, panne, bruit, fuite…) ou « c est ».
2. **achat** : la requête contient un mot de la liste ACHAT (prix, cher, acheter, vente,
   neuf, occasion…), une marque d'équipementier (843 marques, `data/vocab_equipementiers.txt`)
   ou une référence. Une référence est un mot de 5 caractères ou plus, dont 3 chiffres ou
   plus, qui n'est pas une année.
3. **véhicule** : la requête contient une marque automobile, le premier mot d'un nom de
   modèle ou un mot de motorisation (hdi, dci, tdi…). Les vocabulaires viennent de la base
   (`sql/q03`).
4. **nue** : tous les mots restants appartiennent au nom ou à l'alias de la gamme. Cette
   famille tolère :
   - les mots génériques (voiture, auto, avant, arrière…) ;
   - une faute d'une lettre ;
   - le synonyme `clim`.
5. **autre** : tout le reste (synonyme, pièce plus une précision, autre pièce).

Un mot qui appartient au nom de la gamme ne déclenche jamais les règles 1 à 3. Par
exemple, « commande » dans « câble de commande » ne fait pas de la requête une requête
d'achat. La normalisation passe en minuscules, retire les accents et la ponctuation, et
retire le pluriel final.

### Familles × type de page, pour les 53 gammes qui ont une page R1 et une page conseil

Sortie : `out/familles_par_type.csv`.

| Famille | Type | Requêtes | Impressions | Clics | Taux de clic | Position |
|---|---|---|---|---|---|---|
| nue | conseil | 735 | **41 360** | 7 | 0,02 % | **28,5** |
| nue | R1 | 319 | 7 661 | 1 | 0,01 % | 62,1 |
| question | conseil | 1 598 | **11 437** | 6 | 0,05 % | 35,1 |
| question | R1 | 24 | 38 | 2 | 5,26 % | 35,6 |
| achat | conseil | 101 | 775 | 2 | 0,26 % | **25,7** |
| achat | R1 | 221 | **2 059** | 2 | 0,10 % | 38,4 |
| véhicule | conseil | 115 | 167 | 4 | 2,40 % | 21,1 |
| véhicule | R1 | 37 | 184 | 1 | 0,54 % | 45,0 |
| autre | conseil | 1 494 | 14 810 | 21 | 0,14 % | 29,7 |
| autre | R1 | 337 | 3 746 | 6 | 0,16 % | 43,2 |

**Duels sur une même requête et une même gamme**, quand R1 et conseil ont toutes deux des
impressions (`out/duels_synthese.csv`) :

| Famille | Requêtes | Conseil devant | R1 devant |
|---|---|---|---|
| nue | 263 | **192** | 71 |
| question | 4 | 3 | 1 |
| achat | 15 | 8 | 7 |
| autre | 165 | 99 | 66 |

### Le principe tient-il ?

**Relevé.**
- **Requêtes nues : oui.** La page conseil reçoit 5,4 fois plus d'impressions que la page
  R1, avec 33 places d'avance, et gagne 192 duels sur 263.
  - Il y a des exceptions : la page R1 est devant sur la requête nue de cardan,
    maitre-cylindre-de-frein, alternateur, thermostat, radiateur-de-refroidissement et
    durite-de-refroidissement (`out/nue_par_gamme_duel.csv`, colonne `devant_pondere`).
  - L'écart sur alternateur est visible dans `q05` : la R1 est en 66,1, la page conseil en
    76,4.
- **Questions : oui.** La page R1 n'apparaît presque pas sur les questions : 38 impressions.
- **Achat : non.**
  - La page R1 reçoit 2,7 fois plus d'impressions, mais à une position moyenne de 38,4 :
    elle n'obtient donc pas de clics.
  - La page conseil est mieux placée sur les mêmes requêtes (25,7) et gagne 8 duels sur 15.
- **Véhicule : volume trop faible** pour conclure (351 impressions au total).

**Pourquoi, avec les faits observés, sans preuve de causalité.**
- **Les titres R1 n'ont aucun mot d'achat.** La règle `R1_FORBIDDEN_TERMS`
  (`backend/src/modules/seo/utils/seo-field-gate.ts`) interdit `prix`, `pas cher`,
  `acheter`… Le gabarit servi est « Gamme | MARQUE, MARQUE, MARQUE | AutoMecanik ».
- **Sur 85 pages conseil, 12 ont « prix » dans leur title** (voir 6.5c). Ces 12 pages
  portent 671 des 890 impressions d'achat de l'ensemble des pages conseil
  (`out/requetes_classees.csv`, y compris les gammes sans R1 en GSC).
- **Le taux de clic est presque nul dans toutes les familles** (0,01 à 0,26 %, hors
  véhicule). Le problème de fond est la position : aucune famille n'atteint en moyenne la
  première page sur la page R1.

---

## 6.2 Taux de clic des pages conseil en positions 1 à 10

**Relevé** (`out/conseil_top10_pages.csv`, `out/conseil_top10_couples.csv`).
- **La courbe attendue est celle du site** (`sql/q06` → `data/ctr_site_par_position_90j.csv`).
  Elle donne le taux de clic par position arrondie, toutes pages, sur 90 j. Ce n'est pas une
  courbe du marché.
- **Volume.** 849 couples (page conseil × requête) sont en position 1 à 10. Ils font
  **28 clics pour 175 attendus**.

Pages les plus en dessous :

| Page conseil | Couples | Impressions | Clics | Attendus | Écart | Taux de clic réel / attendu |
|---|---|---|---|---|---|---|
| arbre-a-came | 51 | 8 708 | 0 | 81,5 | −81,5 | 0 % / 0,94 % |
| corps-papillon | 18 | 1 269 | 0 | 26,7 | −26,7 | 0 % / 2,10 % |
| colonne-de-direction | 33 | 2 416 | 3 | 20,7 | −17,7 | 0,12 % / 0,86 % |
| carter-d-huile | 25 | 2 289 | 2 | 12,4 | −10,4 | 0,09 % / 0,54 % |
| cable-d-embrayage | 42 | 894 | 0 | 7,0 | −7,0 | 0 % / 0,78 % |
| capteur-abs | 56 | 1 448 | 7 | 11,1 | −4,1 | 0,48 % / 0,77 % |
| galet-tendeur-de-courroie-d-accessoire | 62 | 858 | 3 | 6,4 | −3,4 | 0,35 % / 0,75 % |
| cylindre-de-roue | 21 | 1 008 | 1 | 3,8 | −2,8 | 0,10 % / 0,37 % |

**Le cas le plus net** : sur « arbre a came », la page conseil est en position 3,5 avec
5 987 impressions en 90 jours, et n'a obtenu aucun clic.

**Ce que Google affiche (10 requêtes) : non relevé.**
- Notre table GSC ne stocke pas l'apparence dans les résultats (`searchAppearance`).
- Relever la page de résultats demanderait du scraping ou un outil payant, ce que le
  mandat exclut.
- On ne sait donc pas si un bloc Google (extrait optimisé, « Autres questions », images,
  Shopping) passe devant la page conseil. C'est l'hypothèse la plus probable pour
  arbre-a-came, mais elle n'est pas vérifiée.

---

## 6.3 Passage conseil → gamme (R1), liste (R2), panier

**Relevé** (`sql/q10-passage-conseil-gamme-mesures.sql` → `data/passage_conseil_mesures.csv`,
06:39:16–06:39:38Z, agrégats seulement).

| Source | Ce qu'elle couvre | Trou |
|---|---|---|
| `seo_link_clicks` (658 lignes, 2025-12-02 → 2026-11-18) | Les clics sur `<a data-link-type>` dans le HTML injecté (`HtmlContent.tsx`, trackLinks). Depuis les pages conseil : 49 clics `LinkGamme` (45 vers une R1, 4 ailleurs), tous vers **d'autres** gammes. Sur 90 j : **21 clics** conseil → R1, 0 venant d'un robot selon un motif simple sur l'agent utilisateur. | Les 5 liens vers la R1 de la même gamme sont des `<Link>` React **sans** `data-link-type` : ils ne sont pas tracés. La table n'a pas de `traffic_class`. Elle contient 4 lignes de sondes d'injection SQL du 2026-09-22 (hors périmètre, voir plus bas). |
| `seo_link_impressions` (480 021 lignes, jusqu'au 2026-11-19 06:39Z) | Pages conseil : Footer, GammesPopulaires et TopMarques seulement, du 2025-12-04 au **2026-01-06**. | Aucune impression des liens conseil → gamme : pas de dénominateur. Rien sur les pages conseil depuis le 2026-01-06. |
| `__seo_event_log` | `r2_view` (338 776 lignes), `r2_add_to_cart` (492), `r2_order_placed` (25). | `referrer` est une **catégorie** (direct, organic, internal, other), pas une URL : on ne sait pas si une vue R2 vient d'une page conseil. Il n'existe pas d'événement de vue conseil ni de vue R1. `traffic_class` n'existe que depuis le 2026-11-17 06:27Z (r2_view humain : 279 lignes). |
| GA4 `__seo_ga4_daily` (90 j, 2026-08-19 → 11-16) | Sessions par page et par canal. Conseil : **1 563** sessions (organique 1 284, direct 249, referral 27, unassigned 3). R1 : 515. R2 : 46 408. | Ni chemin, ni page suivante, ni humain/robot : la table ne donne pas le passage. |

**Ce qu'on peut dire.**
- Conseil → R1 d'une **autre** gamme : 21 clics pour 1 563 sessions en 90 j, soit **environ
  1,3 %**. C'est un minimum : le dénominateur GA4 ne filtre pas les robots, et le
  numérateur ne compte que les liens marqués.
- Conseil → R1 de la **même** gamme : **non mesuré**.
- Conseil → R2 et conseil → panier : **non mesurables**.

**Ce qui manque précisément** (repris en 6.5d) :
1. un `data-link-type`, ou un traceur de clic, sur les liens conseil → R1 de la même gamme
   (5 liens) ;
2. un événement de vue de page conseil, avec `traffic_class` ;
3. l'URL ou le type de la page d'origine sur `r2_view` et `r2_add_to_cart`, à la place de
   la seule catégorie ;
4. `traffic_class` sur `seo_link_clicks`.

**Écart à signaler.** Un premier relevé exploratoire donnait 1 567 sessions conseil. Le
chiffre de référence est celui de `q10` : 1 563. L'écart de 4 sessions vient du motif
d'URL. Le relevé exploratoire acceptait aussi des chemins conseil terminés par une barre
oblique ou suivis d'un segment, alors que `q10` s'en tient au motif strict
`^/blog-pieces-auto/conseils/[a-z0-9-]+/?$`.

---

## 6.4 Ce que servent les pages en PROD

**Échantillon.** `data/pages_prod_liste.txt` contient :
- les 10 pages conseil les mieux classées ;
- les 5 pages conseil mal classées ;
- leurs 15 pages R1 ;
- 7 pages R1 d'achat et la page conseil corps-papillon, pour 6.5b.

Les pages ont été récupérées entre 06:31:15 et 06:35:08Z. Les 38 pages ont répondu 200
(`data/pages_prod_statuts.txt`). L'agent utilisateur était un Chrome mobile générique.

**Analyse.** `scripts/relever_pages_prod.py` → `out/pages_prod_entetes.csv` (38 pages) et
`out/pages_prod_liens.csv` (329 liens).

### Pages conseil (16 relevées)

- **Robots.** Toutes les pages sont en `index,follow`.
- **Sélecteur de véhicule : absent sur les 16 pages.** Aucune page conseil ne propose de
  choisir le véhicule.
- **Liens vers la R1 de la même gamme : 5 par page.** Il y en a 3 sur cable-d-embrayage et
  4 sur corps-papillon, voir les anomalies plus bas. Le tableau donne la part du texte
  visible lue avant chaque lien. C'est un indicateur de place, faute de pouvoir mesurer le
  pli mobile depuis le HTML.

| Libellé servi | Place (min / médiane / max) | Code qui produit le lien | Tracé ? |
|---|---|---|---|
| « Voir les pièces compatibles → » (hero) | 3,7 / 5,0 / 6,2 % | Gabarit en dur `/pieces/${pg_alias}-${pg_id}.html`, `blog-pieces-auto.conseils.$pg_alias.tsx` ≈ l. 516-523 ; **aucun contrôle « indexable »** | Non |
| « Voir les pièces compatibles » (encart « Besoin de cette pièce ? ») | 16,2 / 20,8 / 24,9 % | **Base** : `__blog_advice.ba_cta_link` (`r3-guide.service.ts:494`), même route ≈ l. 598-618 | Non |
| « Vérifier la compatibilité avec votre véhicule » | 27,6 / 37,3 / 47,4 % | Gabarit en dur, `components/blog/conseil/ConseilSections.tsx:152-156` | Non |
| « Voir toutes les pièces compatibles » | 66,6 / 76,1 / 83,0 % | `components/guide/GuideParts.tsx:131-138` (`gammeUrl`) | Non |
| « pièce compatible avec votre véhicule » (bas de page) | 72,7 / 81,7 / 86,8 % | **Base** : `ba_cta_link`, même route ≈ l. 670-680 | Non |

- **Liens vers d'autres gammes dans le corps du texte.** Ils viennent de la règle
  `processLinkGamme` / `resolveGammeAliasLinks` (`internal-linking.service.ts:967` et
  `:731`, périmètre « catalogue »). Ils portent `data-link-type="LinkGamme"` et sont tracés.
  Ils se placent entre 5 et 53 % du texte.
  - D'autres liens vers des R1 placés vers 72-76 % n'ont pas de `data-link-type`.
    Exemples : « courroie d accessoire », « rotule de direction ».
  - Neuf liens ont un libellé vide.
  - La source de ces deux groupes de liens n'a pas été identifiée.
- **Liens vers d'autres pages conseil** (« Changer un… : guide complet [2026] ») : ils se
  placent entre 84 et 92 %.
- **Title.** Il vient de `__seo_r3_keyword_plan.skp_seo_brief.meta_title`, puis de
  `ba_title` à défaut (`r3-guide.service.ts:467`). Le titre reproduit en base est identique
  à celui servi pour les 15 pages vérifiées (`sql/q09` → `data/titres_conseil.csv`).
- **H1.** Il vient de `ba_h1`, par exemple « Comment changer un cardan ».
- **JSON-LD.** Article, FAQPage, BreadcrumbList, WebPage et HowTo. **HowTo manque** sur
  commande-de-ventilation, vanne-egr et pompe-de-direction-assistee.
- **Corps du texte.** Il vient de `__seo_gamme_conseil` pour les 85 pages. La projection
  WIKI n'est servie qu'aux alias canari placés derrière un feature flag
  (`r3-projection-decision.service.ts`). Source : `sql/q08` → `data/source_corps_conseil.csv`.

### Pages R1 (22 relevées)

- **Sélecteur de véhicule : présent sur les 22 pages.**
- **Liens vers la page conseil de la même gamme : 2 par page** (3 sur cardan, 0 sur
  volant-moteur, qui n'a pas de page conseil) :
  - la pastille « Conseils entretien » (`pieces.$slug.tsx` ≈ l. 812-818,
    `content.conseilsHref`), placée entre 6 et 19 % du texte ;
  - la carte « Guide complet : {gamme} — Critères de choix, budget, marques… »
    (`components/pieces/GuideLinkCard.tsx`), placée entre 50 et 74 %. Son libellé annonce
    un guide d'achat, mais la cible est la page conseil.
- **Title.** Il vient du moteur `seo-title-engine.service.ts` (V1 : « {Gamme} | {3 marques} |
  AutoMecanik », 60 caractères au plus). Le title de filtre-a-huile est tronqué :
  « Filtre à huile | Trouvez la référence compatible | AutoMeca… ».
- **H1.** C'est `sg_h1` ou la formule « {gamme} — trouvez la référence compatible (avec
  votre véhicule) ». Il y a trois variantes : commande-de-ventilation, plaquette-de-frein
  et pompe-de-direction-assistee.
- **H2 « Où se trouve le {gamme} et quand le remplacer ».** Ce H2 vise une question et
  apparaît sur les 15 pages R1 de l'échantillon principal. Il est codé en dur dans
  `pieces.$slug.tsx` ≈ l. 960-966, avec une faute d'accord : « le colonne », « le pompe ».
- **JSON-LD.** CollectionPage, FAQPage, BreadcrumbList et Organization, plus ItemList sur
  14 pages.

### Cible du CTA conseil en base : 85 pages (`sql/q07` → `data/conseil_cta_indexable.csv`)

| Cas | Pages | Détail |
|---|---|---|
| R1 de la même gamme, indexable | 81 | — |
| R1 de la même gamme, **non indexable** | 2 | filtre-de-boite-auto (`pg_relfollow=0`), servo-frein (`pg_display=0`) |
| La page pointe vers **elle-même** | 1 | cable-d-embrayage : `ba_cta_link` vers sa propre page conseil |
| CTA **vide** | 1 | corps-papillon |

---

## 6.5 Propositions (aucune n'est appliquée)

Classement, du plus utile au moins utile :

| Rang | Proposition | Ce qu'elle touche | Chiffre | Risque SEO | Qui décide |
|---|---|---|---|---|---|
| 1 | 6.5d — marquer les liens et ajouter la ligne de suivi | Traceur de clic, événement de vue conseil, origine sur `r2_view` | Rend mesurables 1 563 sessions conseil en 90 j, contre 0 lien même gamme mesuré aujourd'hui | Nul : aucun changement visible | Marwane (priorité) |
| 2 | 6.5a — bloc conseil → gamme généré par règle | 85 pages conseil ; remplace 5 liens issus de 3 sources | Corrige 4 cibles fausses (2 non indexables, 1 vers la page elle-même, 1 vide) ; 617 clics GSC et 1 563 sessions par 90 j arrivent sur ces pages | Faible si la place reste sobre (R3 interdit les CTA agressifs au-dessus du pli) | Marwane : place et maquette (décision 57) |
| 3 | 6.6 — pages conseil manquantes | 5 gammes indexables, chacune à 133 impressions nues ou plus | 1 956 impressions nues en 90 j, aujourd'hui en position R1 | Faible : contenu à produire par la voie WIKI | Département 06, puis Marwane |
| 4 | 6.5c — titles conseil orientés achat et H2 R1 orienté question | 12 titles conseil ; gabarit H2 de toutes les R1 | 671 impressions d'achat sur ces 12 pages conseil ; 17 605 impressions nues sur les mêmes pages, à ne pas perdre | Moyen : un title optimisé ne se touche pas sans accord | Marwane |
| 5 | 6.5b — gabarit de title et de H1 R1 pour l'achat | Moteur de title R1 | Couverture des requêtes d'achat de 13,9 % aujourd'hui ; 50,6 % avec G3, qui exige de lever l'interdiction de `prix` | Moyen à fort ; gain en clics faible tant que la position reste à 38 | Marwane |

### 6.5a — Bloc conseil → gamme généré par règle (proposé)

**Règle de cible**, unique, sans lien écrit à la main :
- Pour la page conseil de la gamme G (`__blog_advice.ba_pg_id`), la cible est la R1 de G
  **si et seulement si** `pg_display = pg_relfollow = pg_level = '1'`.
- C'est la règle du sitemap (Marwane, 18 nov. 22:38), déjà codée dans
  `fetchCatalogueGammes(…, 'indexable')` (`internal-linking.service.ts:916`).
- Sinon, pas de bloc : aucune gamme de remplacement n'est devinée.

**Ce que fait le bloc :**
- l'URL est construite comme aujourd'hui, à partir de `pg_alias` et `pg_id` : aucune URL
  nouvelle ;
- le libellé est fixe et contient `pg_name` ;
- `ba_cta_link` n'est plus utilisé pour la cible ;
- il remplace les 5 liens actuels, ou au minimum les fait tous passer par la même règle.

**Effet relevé sur les 85 pages :**
- pour 81 pages, la cible ne change pas ;
- cable-d-embrayage obtient enfin un lien vers sa R1 ;
- corps-papillon obtient son CTA ;
- filtre-de-boite-auto et servo-frein perdent un lien vers une R1 non indexable.

**Choix du véhicule.** La page conseil n'a pas de sélecteur, la page R1 en a un. Le bloc
peut porter un second libellé, « Choisir mon véhicule », vers la même R1, sans URL
nouvelle. Intégrer le sélecteur lui-même dans R3 est un choix de maquette.

**Marquage.** Le bloc porte un `data-link-type` dédié et un traceur de clic React, car
`HtmlContent` ne trace que le HTML injecté (voir 6.5d).

**Place dans le gabarit R3 (à décider).** Trois emplacements possibles :
- (a) le hero, à la place du lien en dur actuel, vers 5 % du texte ;
- (b) après le résumé, à la place de l'encart « Besoin de cette pièce ? », vers 20 % ;
- (c) en fin d'article.

`design-system/roles/R3-blog.md` prévoit un encart de produits sobre (« Related Products
(soft CTA) ») plus bas dans la page, et interdit les « Aggressive sales CTAs above fold ».

**Ce qui relève de la maquette validée par Marwane (décision 57).** La place, l'apparence,
le nombre de liens conservés et l'éventuel sélecteur relèvent de la maquette. Celle-ci
**n'a pas été trouvée dans le dépôt** : une recherche de « décision 57 » et de « maquette »
dans `docs/`, `.claude/` et `.spec/` ne renvoie rien. Ce point doit donc être comparé par
Marwane à sa maquette. Le présent rapport ne fixe que la règle de cible et le marquage.

### 6.5b — Trois gabarits de title et de H1 R1 pour les requêtes d'achat, sur papier

Aucun title n'est écrit. Le script `scripts/tester_gabarits_titres.py` produit
`out/gabarits_titres_essai.csv`.

**Gammes testées.** Ce sont les 10 gammes qui ont le plus d'impressions R1 d'achat sur
90 j :

| Gamme | Impressions | Clics | Requêtes | Position |
|---|---|---|---|---|
| alternateur | 929 | 0 | 56 | 44,5 |
| filtre-a-huile | 458 | 0 | 14 | 35,6 |
| cardan | 302 | 1 | 28 | 46,7 |
| corps-papillon | 251 | 0 | 8 | 26,4 |
| volant-moteur | 152 | 0 | 13 | 34,3 |
| courroie-d-accessoire | 135 | 0 | 11 | 29,2 |
| plaquette-de-frein | 116 | 0 | 17 | 21,2 |
| catalyseur | 92 | 0 | 5 | 15,6 |
| kit-d-embrayage | 59 | 0 | 15 | 31,4 |
| compresseur-de-climatisation | 33 | 0 | 4 | 27,8 |

**Couverture.** C'est la part des impressions d'achat dont tous les mots utiles figurent
dans le title. « prix » compte comme un mot utile, et seuls les mots vides sont ignorés.

| Gabarit | Title | H1 | Règle actuelle | Couverture (10 gammes) |
|---|---|---|---|---|
| Actuel | `{Gamme} \| {3 marques} \| AutoMecanik` | « {Gamme} — trouvez la référence compatible… » | — | **13,9 %** (351 / 2 527) |
| G1 | `{Gamme} {3 marques} \| AutoMecanik` (sans séparateur, pour lire « alternateur bosch ») | `{Gamme} {3 marques} et autres équipementiers` | Respectée | 13,9 % |
| G2 | `{Gamme} neuf \| {3 marques} \| AutoMecanik` | `{Gamme} neuf pour votre véhicule` | Respectée | 14,1 % |
| G3 | `{Gamme} : prix et références \| {2 marques} \| AutoMecanik` (sans les marques si le title dépasse 60 caractères) | `{Gamme} : comparez prix et références compatibles` | **Enfreinte** (`prix`) | **50,6 %** (1 279 / 2 527) |

**Exemples de la colonne G3** :
- « Alternateur : prix et références | AutoMecanik » (46 caractères) ;
- « Boîtier papillon : prix et références | AutoMecanik » (51) ;
- « Compresseur de climatisation : prix et références | AutoMecanik » (**63, au-delà de
  60**).

Les 40 lignes, avec la longueur de chaque title, sont dans le CSV.

**Risques :**
- **G1 et G2 n'apportent rien de mesurable.** Le gain n'existe qu'entre G2 et l'actuel
  (+6 impressions). G1 ne fait que changer la ponctuation : sur ces gammes, les requêtes
  d'achat dominantes sont « prix X » et non « X marque ».
- **G2 dit « neuf ».** C'est faux si la gamme vend de l'échange standard (alternateur,
  étrier, compresseur…). À vérifier dans le catalogue avant tout usage.
- **G3 exige de modifier `R1_FORBIDDEN_TERMS`**, ce qui revient à changer une règle SEO.
  - Il fait perdre les marques sur 4 gammes où les requêtes d'achat sont des requêtes de
    marque : catalyseur passe de 97,8 à 1,1 %, plaquette-de-frein de 81,9 à 0 %,
    kit-d-embrayage de 74,6 à 1,7 % et compresseur-de-climatisation de 54,5 à 0 %.
  - Il dépasse 60 caractères sur compresseur-de-climatisation.
  - Il fait passer le title R1 sur le terrain des 12 pages conseil qui ont déjà « prix »
    dans leur title, d'où un risque de cannibalisation.
  - Choisir G3 gamme par gamme, selon que la requête d'achat dominante parle de prix ou de
    marque, serait une règle de sélection supplémentaire, à décider.
- **Quel que soit le gabarit, le gain en clics est faible tant que la R1 reste en position
  38 en moyenne** sur ces requêtes. Le title change le taux de clic, pas la position.

### 6.5c — Pages dont le texte vise la mauvaise intention (liste, sans réécriture)

**Pages conseil dont le title vise l'achat (« prix »)** : 12 pages sur 85, toutes titrées
par le brief (`data/titres_conseil.csv`).

| Page conseil | Title servi |
|---|---|
| amortisseur | Amortisseur : symptômes, changement et prix |
| arbre-a-came | Arbre a came : symptomes, remplacement et prix \| Guide |
| cable-d-embrayage | Câble d'embrayage dur ? Réglage, changement et prix |
| colonne-de-direction | Colonne de direction : symptômes d'usure, changement et prix |
| emetteur-d-embrayage | Émetteur d'embrayage : pédale molle, diagnostic et prix |
| etrier-de-frein | Etrier de frein grippe : symptomes, reparation, prix |
| filtre-a-huile | Filtre à huile : symptômes, changement et prix |
| flexible-de-frein | Flexible de frein : symptomes, remplacement et prix |
| joint-de-cache-culbuteurs | Joint cache culbuteur : symptomes, remplacement et prix |
| joint-de-collecteur | Joint de collecteur : symptomes, remplacement et prix |
| kit-de-freins-arriere | Kit freins arriere : symptomes, remplacement et prix |
| machoires-de-frein | Machoires de frein : symptomes, remplacement et prix |

Ces 12 pages portent 671 impressions d'achat, mais aussi **17 605 impressions nues** sur
90 j. arbre-a-came est en position 3,5 sur sa requête nue. Toute retouche de title doit
d'abord vérifier qu'elle ne fait pas perdre cette position. Ces titles sont optimisés :
on n'y touche pas sans l'accord de Marwane.

**Pages R1 dont le texte vise une question.** Le H2 codé en dur « Où se trouve le {gamme}
et quand le remplacer » (`pieces.$slug.tsx` ≈ l. 960-966) est servi sur les 15 pages R1 de
l'échantillon principal. Comme c'est un gabarit, il touche probablement toutes les R1 ;
seules les 15 pages ont été vérifiées. Les requêtes « où se trouve » et « quand
remplacer » relèvent de la famille question, où la page conseil domine déjà (11 437
impressions contre 38).

### 6.5d — Ligne de suivi (proposée, non créée)

**Ligne « passage conseil → gamme », par semaine :**

`clics conseil → R1 même gamme (humains) / vues de pages conseil (humaines)`

Deux sous-lignes la complètent :
- `vues R2 venant d'une page conseil / vues conseil` ;
- `ajouts au panier venant d'une page conseil / vues conseil`.

**Sources :**
- `seo_link_clicks`, avec le `link_type` du bloc 6.5a et `traffic_class` à ajouter ;
- `__seo_event_log`, avec un nouvel événement de vue conseil et l'origine (URL ou type de
  page) à ajouter sur `r2_view` et `r2_add_to_cart` ;
- GA4 `__seo_ga4_daily` pour recouper le dénominateur.

**Valeur de départ, aujourd'hui :**
- clics vers la même gamme : non mesurés ;
- clics vers les autres gammes : 21 / 1 563 sessions GA4, soit environ 1,3 % sur 90 j.

**Où la brancher.** Dans le rapport quotidien du cron `seo-audit`, repris par le Command
Center. Ce cron est en échec depuis le 2026-11-16 03:00 (sitemap indisponible, d'après le
signal de session et le mandat CU) : il faut le réparer d'abord.

---

## 6.6 Pour le département 06

### Gammes sans page conseil dont la requête nue a des impressions R1

Sortie : `out/sans_conseil_nue.csv`.
- **Principe.** Une gamme est retenue si elle est absente des 85 lignes de `__blog_advice`
  et que sa requête nue a des impressions sur sa page R1 en 90 j.
- **Bilan.** 26 gammes, 2 810 impressions nues. Parmi elles, 20 gammes sont indexables, pour
  2 104 impressions.

| Gamme | Impressions nues R1 | Clics | Indexable |
|---|---|---|---|
| capteur-temperature-d-air-admission | 781 | 0 | oui |
| volant-moteur | 585 | 0 | oui |
| capteur-pression-et-temperature-d-huile | 355 | 0 | **non** |
| chaine-de-distribution | 268 | 0 | oui |
| butee-elastique-d-amortisseur | 202 | 0 | **non** |
| soufflet-de-direction | 189 | 1 | oui |
| support-de-boite-vitesse | 140 | 0 | **non** |
| barre-de-direction | 133 | 0 | oui |
| capteur-niveau-d-huile-moteur | 51 | 0 | oui |
| joint-de-carter-d-huile | 21 | 0 | oui |
| (16 autres, 18 impressions ou moins chacune) | | | voir le CSV |

Les 5 premières gammes indexables (781 + 585 + 268 + 189 + 133 = **1 956 impressions**)
sont les candidates. Pour chacune, le contenu doit suivre la voie RAW → WIKI. Le RAG n'a
pas l'autorité pour le produire.

**À noter.** La page conseil filtre-a-huile existe dans `__blog_advice`, mais n'a **aucune**
ligne au grain requête en 90 j : 13 impressions au grain page, position 10,2. Ses requêtes
sont toutes anonymisées ou absentes, alors que la R1 a 941 impressions nues.

### Pages conseil à fort trafic dont le contenu vient du texte manuscrit de Marwane

**L'historique ne permet pas de répondre.**
- **Le corps servi vient de `__seo_gamme_conseil` sur les 85 pages** (`sql/q08`).
  - Ses sections portent une trace `enriched_by` d'agent ou de pipeline :
    conseil-batch-agent, content-gen-skill, pipeline-v5-legacy-enrich…
  - 60 pages ont au moins une section **sans** trace (`enriched_by` nul).
  - Rien ne permet d'attribuer ces sections à un texte manuscrit plutôt qu'à un import
    ancien.
- **Le contenu ancien de `__blog_advice`, rédigé en 2024, n'est pas servi** comme corps de
  page. Les pages ont toutes été créées en 2024, et 84 sur 85 ont été mises à jour en
  février 2026.

Pour répondre, il faudrait une trace d'auteur par section, qui n'existe pas.

---

## Constats hors périmètre (signalés, non corrigés)

1. **Cibles de CTA en base** : cable-d-embrayage pointe vers elle-même, corps-papillon a un
   CTA vide, filtre-de-boite-auto et servo-frein pointent vers une R1 non indexable
   (`data/conseil_cta_indexable.csv`).
2. **Le lien du hero conseil** (`ctaSoft`) et celui de `ConseilSections` construisent la
   cible sans contrôle « indexable ».
3. **`GuideLinkCard`** : le libellé annonce un « Guide complet… Critères de choix, budget,
   marques », mais la cible est la page conseil (« comment changer »).
4. **Le H2 R1 codé en dur** « Où se trouve le {gamme}… » a une faute d'accord : « le
   colonne », « le pompe ».
5. **`seo_link_clicks`** contient 4 lignes de sondes d'injection SQL du 2026-09-22,
   02:17-03:41Z : `waitfor delay`, `sleep(15)` et des URL de destination anormales. Il faut
   vérifier que ces valeurs sont bien paramétrées côté API ; ce point n'a pas été vérifié
   ici.
6. **JSON-LD HowTo absent** sur 3 pages conseil : commande-de-ventilation, vanne-egr et
   pompe-de-direction-assistee.
7. **Title R1 de filtre-a-huile tronqué** : « …| AutoMeca… ».
8. **H1 de la page conseil cable-d-embrayage tout en capitales** : « CHANGEMENT DU CÂBLE
   D'EMBRAYAGE HS ».
9. **Gammes non indexables qui ont des impressions R1** : capteur-pression-et-temperature-d-huile
   (355), butee-elastique-d-amortisseur (202) et support-de-boite-vitesse (140). Leur état
   d'indexation dans Google n'a pas été vérifié.
10. **Des URL conseil mal orthographiées reçoivent des impressions dans GSC** (relevé de
    l'exploration 6.1 ; ces pages ne font pas partie du jeu « conseil » strict).
11. **Liens non marqués.** Des liens de pages conseil vers d'autres R1, placés vers 72-76 %,
    n'ont pas de `data-link-type`, et 9 liens ont un libellé vide. Leur source n'a pas été
    identifiée.
12. **Le cron `seo-audit` est en échec depuis le 2026-11-16 03:00** (sitemap indisponible).

## Couverture, exclusions, inconnues

- **Couvert :**
  - les 53 gammes qui ont une page R1 et une page conseil en GSC sur 90 j ;
  - les 85 pages conseil de la base ;
  - 38 pages PROD.
- **Exclu**, conformément au mandat :
  - toute modification ;
  - le sitemap, `robots.txt` et les images ;
  - la définition de « vendable » (mandat CT) ;
  - le maillage R2 → R2 ;
  - les autres PR et mandats (T, S, BI, CT, DB/DC, CI).
- **Inconnues :**
  - le pli mobile, donné seulement par un indicateur ;
  - l'affichage réel de Google sur les 10 requêtes ;
  - le passage vers la même gamme, vers R2 et vers le panier ;
  - l'auteur des sections sans trace ;
  - la maquette de la décision 57, absente du dépôt.
- **Rien n'a été déployé ni écrit en base.** La PR est un brouillon qui ne contient que des
  documents.
