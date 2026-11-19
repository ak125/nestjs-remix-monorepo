# Référentiel externe : Google, web.dev, WCAG, Baymard et NN/g face à la page R1 du filtre à huile

Complément n° 2 au mandat DU, 19 novembre 2026. Ce document complète `REVUE-EXPERTE.md`, qui
jugeait la maquette selon les règles du dépôt. Ici, l'étalon vient de l'extérieur : Google
Search Central, web.dev, W3C WCAG 2.2, Baymard Institute et Nielsen Norman Group.

- **Page actuelle** : `/pieces/filtre-a-huile-7.html` servie par le service DEV (port 3000,
  branche `main`), relevée le 2026-11-19.
- **Maquette** : tête `8507eb5b8c64517b4b59001d8dda28b5fcaf3c08` de #2210. Elle ne modifie que
  trois fichiers (`GammeHero.tsx`, `GammeQuickNav.tsx`, `pieces.$slug.tsx`). Tout ce qui vient
  d'un autre fichier, `MotorisationsSection.tsx` compris, est donc identique dans les deux versions.
- **Rien n'a été modifié** dans #2210, dans le code, en base ou en PROD. Aucune règle n'a été
  changée : les propositions du §5 passent par une PR sur le journal des principes, approuvée
  par Marwane.
- **Complément n° 3** : le §3.F est remesuré à la tête `e31d3babe75d36521c0a9f240b2342743f258eec`
  de #2210. Les autres sections restent celles de la tête `8507eb5b8`.
- **Complément n° 4** : le §3.F est remesuré à la tête `34bdc1eb36e4120a4ec7769249b4c4ef5f9def95`
  de #2210 (colonne « 34bdc1eb3 »). La colonne porte sur la page R1 seule ; le pied de page et la
  barre mobile du bas relèvent de la revue du design system (05).
- **Complément n° 5** : le §3.F est remesuré à la tête `06feff9686afa610d5b0363397e2cd2b7ec3fe1d`
  de #2210 (colonne « 06feff968 »), sur un rendu propre de la branche (backend et frontend de
  `06feff968`, port et Redis à moi, sans proxy). Même périmètre : la page R1 seule.
- **Concurrents** : aucun n'est utilisé ici (consigne n° 4). Le pilotage fait leur relevé à part.

## 0. En bref

1. **Ce que la maquette améliore, selon ces sources :**
   - le sélecteur de véhicule passe au premier écran sur téléphone ;
   - le LCP de labo passe de 2,8 s à 1,8 s sur les deux tailles d'écran courantes ;
   - la réaction au bouton « Voir les autres » passe de 160 à 64 ms.
2. **Le défaut principal, présent dans les deux versions :** 7 des 19 pages véhicule déclarées
   dans les données structurées n'ont pas de lien `<a href>` dans le HTML. Elles n'apparaissent
   qu'après un clic, et Google ne clique pas. Sa documentation e-commerce, de pagination et de
   chargement différé dit le contraire de ce que fait la page.
3. **Le titre et la description ne suivent pas les recommandations de Google :**
   - le titre est coupé par « … » dans la balise elle-même, si bien que le nom du site devient
     « AutoMeca… » ;
   - la description annonce un prix (« dès 5€ ») et du stock, ce que Google n'exige pas pour une
     catégorie et que la règle R1 interdit.
4. **Le balisage FAQPage n'apporte plus rien dans Google.** Le résultat enrichi FAQ a été retiré :
   la documentation officielle annonce sa disparition à partir du 7 mai 2026, et une mise à jour du
   15 juin 2026 dit qu'il n'est plus affiché. Le contrat `r1.ts:33` autorise `Article`, un type que
   Google réserve aux pages d'actualité, de blog et de sport.
5. **Accessibilité WCAG 2.2 de niveau AA, non atteinte dans les deux versions :**
   - 24 à 25 textes sans contraste suffisant ;
   - une cible de moins de 24 px ;
   - trois animations sans fin, qui ne respectent pas le réglage « réduire les animations » ;
   - la maquette ajoute un lien distingué par sa seule couleur.

   À la tête e31d3babe (complément n° 3, §3.F) : les cartes véhicule et la navigation rapide sont
   corrigées. Les 24 textes hors cartes, la cible de 48×16, le lien et les trois boucles restent.
   À la tête 34bdc1eb3 (complément n° 4, §3.F) :
   - corrigés sur R1 : la cible de 48×16, les trois boucles et les 15 textes R1 relevés par axe ;
   - restent sur R1 le lien distingué par sa seule couleur et quatre contrastes mesurés au pixel :
     le fil d'Ariane, l'onglet « Type Mine », le badge « 2 min » et la bande sous le hero à 1440 px.
   À la tête 06feff968 (complément n° 5, §3.F) : les quatre contrastes sont corrigés (6,38 à
   6,90:1 pour le fil d'Ariane et l'onglet, 4,87:1 pour le badge, 4,51 à 4,55:1 pour la bande), sans
   violation nouvelle. Reste sur R1 le lien distingué par sa seule couleur, à 390 px.
6. **Le partage R1 sans prix / R2 avec prix reste défendable**, à une condition : que R1 soit un
   passage court vers R2. Le §5.3 détaille ce point.
7. **Aucune donnée terrain n'a été consultée.** Les seuils Core Web Vitals portent sur le
   75e centile des visiteurs réels ; tous les chiffres de vitesse ci-dessous sont des mesures de labo.

## 1. Méthode

- **Lecture des sources.** Chaque page du §2 a été ouverte et lue en entier le 2026-11-19, par
  lecture web directe, sans passer par un extrait de moteur de recherche. Les lectures partielles
  et les contenus payants sont signalés.
- **Vocabulaire de la grille.** OUI = exigence respectée ; NON = non respectée ; PARTIEL =
  respectée en partie ; NON VÉRIFIABLE = impossible à établir avec les moyens de ce mandat
  (donnée terrain, parcours humain, autre page du site).
- **Preuves** :
  - les fichiers de `mesures/` ;
  - les lignes de code au commit de la maquette, qui sont identiques sur `main` pour les fichiers
    que #2210 ne modifie pas.
- **Nouveaux relevés de la page actuelle** :
  - `mesures/avant-ssr-liens-et-balises.json` : HTML rendu par le serveur et lu sans JavaScript,
    ce qu'un robot lit avant le rendu ;
  - `mesures/avant-axe-390x844.json` ;
  - `mesures/avant-inp-412x823.json`.
- **Relevés de la maquette** : ceux de la revue (`mesures/apres-*.json`). Le serveur de la
  maquette n'était plus démarré pendant ce complément. Les faits de la maquette sur les liens
  viennent donc du code au commit `8507eb5b8`, où `MotorisationsSection.tsx` n'est pas modifié.
- **Profil de labo** : celui de la revue (§5 de `REVUE-EXPERTE.md`). Processeur ralenti 4 fois,
  latence de 150 ms, 1,6 Mb/s, médiane de 3 passages.

## 2. Sources lues

Toutes ont été lues le 2026-11-19 et ont répondu en HTTP 200, sauf mention contraire. « Date
affichée » = date de mise à jour indiquée par la page elle-même.

| # | Source | URL | Date affichée | Lecture |
|---|---|---|---|---|
| G1 | Google, structure d'un site e-commerce | https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure | aucune | entière |
| G2 | Google, structure d'URL e-commerce | https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites | aucune | entière |
| G3 | Google, données structurées pour l'e-commerce | https://developers.google.com/search/docs/specialty/ecommerce/include-structured-data-relevant-to-ecommerce | aucune | entière |
| G4 | Google, pagination et chargement progressif | https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading | aucune | entière |
| G5 | Google, contenu utile, fiable et pensé pour les personnes | https://developers.google.com/search/docs/fundamentals/creating-helpful-content | aucune | entière |
| G6 | Google, liens explorables | https://developers.google.com/search/docs/crawling-indexing/links-crawlable | aucune | entière |
| G7 | Google, lien de titre | https://developers.google.com/search/docs/appearance/title-link | aucune | entière |
| G8 | Google, extraits et meta description | https://developers.google.com/search/docs/appearance/snippet | aucune | entière |
| G9 | Google, FAQPage | https://developers.google.com/search/docs/appearance/structured-data/faqpage | — | **HTTP 301** vers https://developers.google.com/search/updates#removing-faq-rich-result : la page n'existe plus. Le journal des mises à jour a été lu sur les entrées FAQ, pas en entier |
| G10 | Google, fil d'Ariane | https://developers.google.com/search/docs/appearance/structured-data/breadcrumb | aucune | entière |
| G11 | Google, carrousel (ItemList) | https://developers.google.com/search/docs/appearance/structured-data/carousel | aucune | entière |
| G12 | Google, Product | https://developers.google.com/search/docs/appearance/structured-data/product | aucune | entière |
| G13 | Google, extraits produit | https://developers.google.com/search/docs/appearance/structured-data/product-snippet | aucune | **partielle** : la fin de la page n'a été lue qu'en résumé |
| G14 | Google, règles des données structurées | https://developers.google.com/search/docs/appearance/structured-data/sd-policies | aucune | entière |
| G15 | Google, expérience sur la page | https://developers.google.com/search/docs/appearance/page-experience | aucune | entière |
| G16 | Google, Core Web Vitals dans la recherche | https://developers.google.com/search/docs/appearance/core-web-vitals | aucune | entière |
| G17 | Google, Article | https://developers.google.com/search/docs/appearance/structured-data/article | aucune | entière |
| G18 | Google, navigation à facettes | https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation | aucune | entière |
| G19 | Google, chargement différé | https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading | aucune | entière |
| W1 | web.dev, Web Vitals | https://web.dev/articles/vitals | 31/10/2024 | entière |
| W2 | web.dev, définition des seuils | https://web.dev/articles/defining-core-web-vitals-thresholds | 07/05/2025 | entière |
| W3 | web.dev, LCP | https://web.dev/articles/lcp | 04/09/2025 | entière |
| W4 | web.dev, optimiser le LCP | https://web.dev/articles/optimize-lcp | 31/03/2025 | entière |
| W5 | web.dev, Fetch Priority | https://web.dev/articles/fetch-priority | aucune | entière |
| W6 | web.dev, INP | https://web.dev/articles/inp | 02/09/2025 | entière |
| W7 | web.dev, CLS | https://web.dev/articles/cls | aucune | entière |
| A1 | WCAG 2.2, Understanding 1.4.3 Contraste (AA) | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | 04/10/2026 | entière |
| A2 | WCAG 2.2, Understanding 2.5.8 Taille de cible minimale (AA) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | 02/11/2026 | entière |
| A3 | WCAG 2.2, Understanding 2.5.5 Taille de cible (AAA) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html | — | entière |
| A4 | WCAG 2.2, Understanding 2.3.3 Animation déclenchée (AAA) | https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html | — | entière |
| A5 | WCAG 2.2, Understanding 2.2.2 Pause, arrêt, masquage (A) | https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html | 04/10/2026 | entière |
| A6 | WCAG 2.2, Understanding 2.4.3 Ordre du focus (A) | https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html | — | entière |
| A7 | WCAG 2.2, Understanding 2.4.11 Focus non masqué (AA) | https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html | 15/06/2026 | entière |
| A8 | WCAG 2.2, Understanding 3.3.2 Étiquettes ou instructions (A) | https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html | — | entière |
| A9 | WCAG 2.2, Understanding 1.4.1 Utilisation de la couleur (A) | https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html | — | entière |
| B1 | Baymard, benchmark « Automotive Parts & Specialty » 2026 | https://baymard.com/blog/automotive-parts-benchmark-2026 (page publique de l'annonce) | publié le 06/01/2026 | entière pour la partie publique. **Payant** : scores par site, classement, études de cas (dont la « Intermediary Category Page » d'Advance Auto Parts) |
| B2 | Baymard, recherche « Automotive Parts » | https://baymard.com/research/automotive-parts | — | page publique lue ; **les 390+ recommandations sont payantes** |
| B3 | Baymard, informations dans les listes de produits | https://baymard.com/blog/product-listing-information | 30/05/2023 | **partielle** |
| B4 | Baymard, fonctions de comparaison | https://baymard.com/blog/provide-comparison-features | 06/09/2022 | entière |
| N1 | NN/g, pages de catégorie | https://www.nngroup.com/articles/category-pages/ | 23/01/2022 | entière |
| N2 | NN/g, pages d'accueil et listes e-commerce | https://www.nngroup.com/articles/ecommerce-homepages-listing-pages/ | 12/08/2018 | entière |
| N3 | NN/g, alternatives à la pagination | https://www.nngroup.com/articles/alternatives-pagination/ | 06/03/2022 | entière |

Baymard n'a publié aucun article public sur le garage, la compatibilité (« fitment »), la
plaque d'immatriculation ou le VIN. Sur ces sujets, ses recommandations sont toutes payantes et
n'ont pas été lues.

## 3. Grille d'exigences et comparaison

Les citations sont reprises mot pour mot, en anglais, telles que dans la source.

### 3.A Exploration et liens (référencement)

| ID | Exigence | Source | Actuelle | Maquette | Preuve |
|---|---|---|---|---|---|
| A-1 | « use `<a href>` tags when creating links to other content » ; « Don't use JavaScript events on other HTML DOM elements for navigation » | G1, G6 | OUI | OUI | Les 12 cartes véhicule visibles sont des `<a href>` (`mesures/avant-ssr-liens-et-balises.json`, 12 liens uniques vers `/pieces/filtre-a-huile-7/…`). La navigation rapide est faite de `<button>` avec `scrollIntoView` (`GammeQuickNav.tsx:31-37`), mais elle ne déplace qu'à l'intérieur de la page et ne cache aucune URL : pas d'effet sur l'exploration |
| A-2 | « It's strongly recommended to link to all products that you wish indexed » ; « Google's crawlers don't "click" buttons » ; « don't rely on user actions, such as scrolling or clicking » | G1, G4, G19 | **NON** | **NON** | 7 des 19 URL de l'`ItemList` n'ont aucun `<a href>` dans le HTML (`avant-ssr-liens-et-balises.json`, champ `itemlist_urls_sans_lien_a_href_dans_le_html`). La liste est coupée à `VISIBLE_LIMIT = 12` (`MotorisationsSection.tsx:45`, `:80-84`), et le reste ne s'affiche qu'après un clic sur « Voir les 7 autres compatibilités » (`:276-287`). Fichier non modifié par #2210 |
| A-3 | Les pages filles doivent avoir au moins un lien depuis une autre page (« Every page you care about should have a link from at least one other page ») ; sinon, sitemap ou flux | G4, G6 | NON VÉRIFIABLE | NON VÉRIFIABLE | Il faudrait lire les autres pages et le sitemap pour savoir si les 7 pages véhicule y sont liées. La tâche planifiée `seo-audit` échoue depuis le 2026-11-16 (« sitemap indisponible ») |
| A-4 | Texte d'ancre « descriptive, reasonably concise » ; ne pas enchaîner les liens | G2, G6 | PARTIEL | PARTIEL | L'ancre de chaque carte contient toute la carte, par exemple : « RENAULT CLIO III 1.5 dCi 86 ch 📅 2005 – 2012 Sélectionnez cette motorisation pour afficher les références compatibles. Voir les pièces ». Le texte est descriptif mais pas concis, et la même phrase revient 12 fois |
| A-5 | La même URL dans les liens internes, le sitemap et le canonical ; canonical vers soi-même sur une page indexable | G2 | OUI pour le canonical, sitemap NON VÉRIFIABLE | OUI, idem | `<link rel="canonical" href="https://www.automecanik.com/pieces/filtre-a-huile-7.html"/>` et `robots` à « index, follow » dans le HTML serveur |
| A-6 | Une facette sans URL propre est sans effet sur l'exploration | G18 | OUI | OUI | Le sélecteur de véhicule ne crée aucune URL de facette ; il mène aux pages R2, qui existent |

### 3.B Titre et extrait (référencement, clics)

| ID | Exigence | Source | Actuelle | Maquette | Preuve |
|---|---|---|---|---|---|
| B-1 | « Write descriptive and concise text » ; Google coupe lui-même le titre « to fit the device width » ; pas de mots répétés ; nom du site au début ou à la fin | G7 | **NON** | **NON** | Title : « Filtre à huile \| Trouvez la référence compatible \| AutoMeca… ». Il fait 60 caractères, et les points de suspension sont écrits dans la balise : le nom du site est donc coupé à la source, et Google peut le reprendre tel quel ou réécrire le titre. #2210 ne touche pas au titre, qui est réservé à Marwane |
| B-2 | « putting the title text in the first visible `<h1>` » ; le titre principal doit résumer la page | G5, G7 | OUI | OUI | Un seul H1 : « Filtre à huile compatible avec votre véhicule ». Il est cohérent avec le titre et constitue l'élément LCP de la maquette à 412×823 (`mesures/apres-412x823.json`) |
| B-3 | Description propre à la page, « human-readable and diverse » ; Google tire surtout l'extrait du contenu de la page ; prix et fabricant sont cités pour les **pages produit** | G8 | PARTIEL | PARTIEL | Meta : « Filtre à huile voiture pas cher dès 5€. … En stock, livraison 24-48h. ». Elle est lisible. Mais le « dès 5€ » ne repose que sur des fourchettes sans source (§3.6 de la revue), le stock n'est établi nulle part sur la page, et la règle R1 interdit l'un et l'autre (`role-matrix.md:89-100`). L'unicité sur tout le site est NON VÉRIFIABLE depuis une seule page |

### 3.C Contenu utile

| ID | Exigence | Source | Actuelle | Maquette | Preuve |
|---|---|---|---|---|---|
| C-1 | « substantial value when compared to other pages » ; « Is the content primarily made to attract visits from search engines? » ; aucun nombre de mots préféré (« No, we don't. ») | G5 | PARTIEL | PARTIEL | Des textes génériques et des fourchettes de prix sans source sont relevés aux §3.6 et §7.3 de `REVUE-EXPERTE.md`. La page compte 1 883 mots visibles (`mesures/avant-apres-termes-roles.json`) ; Google ne juge pas ce nombre |
| C-2 | Les fonctions interactives, comme la recherche, font partie du contenu principal | G5 | PARTIEL | OUI | Sur téléphone, la page actuelle montre l'image avant le sélecteur. La maquette place l'image après le sélecteur (`GammeHero.tsx`, diff `order-last lg:order-none`) |
| C-3 | La génération automatique de pages à partir de flux (« automatically generating pages from feeds ») est classée comme effort faible | G5 | NON VÉRIFIABLE | NON VÉRIFIABLE | Le texte de la page vient de gabarits remplis par gamme. Juger son effort exige de comparer plusieurs gammes, ce qui sort de ce mandat |

### 3.D Données structurées

| ID | Exigence | Source | Actuelle | Maquette | Preuve |
|---|---|---|---|---|---|
| D-1 | « Your structured data must be a true representation of the page content » ; « Don't mark up content that is not visible to readers of the page » | G14 | PARTIEL | PARTIEL | `FAQPage` balise 4 questions alors que 5 sont visibles (deux sources de FAQ, `pieces.$slug.tsx:470-471` et `:629`). `ItemList` déclare 19 URL, dont 7 masquées tant que l'on n'a pas cliqué |
| D-2 | BreadcrumbList : au moins 2 éléments ; `position` et `name` obligatoires ; `item` obligatoire sauf pour le dernier ; chemin réel de l'utilisateur | G3, G10 | OUI | OUI | 3 éléments (Accueil, Pièces Auto, Filtre à huile), chacun avec `item`. G10 indique que l'affichage du fil d'Ariane est disponible sur ordinateur |
| D-3 | Résultat enrichi FAQ : « This feature will no longer appear in Google Search starting May 7, 2026 » ; « The FAQ rich result feature is no longer shown in Google Search results » | G9 | OUI | OUI | Garder le balisage ne nuit pas s'il est fidèle (D-1), mais il ne rapporte plus d'affichage enrichi |
| D-4 | Carrousel `ItemList` limité à Course, Movie, Recipe et Restaurant ; liste « complete and contains all the items that are listed on the page » | G11 | OUI | OUI | Notre `ItemList` de pages véhicule n'est éligible à aucun affichage enrichi. Elle reste un balisage descriptif (voir D-1) |
| D-5 | Product : « only support pages that focus on a single product » ; « not category pages or lists » | G12, G13 | OUI | OUI | Aucun `Product` sur la page R1 : types servis `CollectionPage`, `ItemList`, `FAQPage`, `Organization` et `BreadcrumbList` |
| D-6 | `Article` est prévu pour les pages « news, blog, and sports article » | G17 | OUI pour la page | OUI pour la page | La page ne sert pas `Article`. Le contrat `r1.ts:33`, lui, l'autorise : voir le conflit K-1 |

### 3.E Vitesse (Core Web Vitals)

| ID | Exigence | Source | Actuelle | Maquette | Preuve |
|---|---|---|---|---|---|
| E-1 | LCP ≤ 2 500 ms au 75e centile des visiteurs réels, téléphone et ordinateur séparés ; « Only field measurement can accurately capture the complete picture » | W1, W2, G16 | Terrain NON VÉRIFIABLE ; labo NON (2 824 ms) | Terrain NON VÉRIFIABLE ; labo PARTIEL | Actuelle, 412×823 : 2 824 ms, élément = image du hero (relevé de DS, §5.1 de la revue). Maquette : 1 792 ms (H1) à 412×823, 1 784 ms à 375×800, mais 2 712 ms à 412×915, où l'image du hero, placée à 761 px, redevient l'élément LCP (`mesures/apres-*.json`) |
| E-2 | « Never lazy-load your LCP image » ; une ou deux images en priorité haute au plus ; baisser la priorité d'une image chargée tôt mais pas visible | W4, W5 | OUI | PARTIEL | Image du hero en `loading="eager"` et `fetchPriority="high"` (`GammeHero.tsx:113-114`). Dans la maquette, sur téléphone, elle passe sous le sélecteur mais garde la priorité haute. Selon W5, une image démarre en priorité basse et le navigateur la relève si elle est visible : sans l'attribut, il ajusterait seul selon l'écran |
| E-3 | INP ≤ 200 ms au 75e centile ; mesure de terrain recommandée | W6, W2 | Terrain NON VÉRIFIABLE ; labo OUI | Terrain NON VÉRIFIABLE ; labo OUI | Labo, médianes en ms : onglet Type Mine 24 → 96, navigation rapide 32 → 24, « Voir les autres » 160 → 64, FAQ 80 → 64 (`mesures/avant-inp-412x823.json`, `mesures/apres-inp-412x823.json`). Le passage de 24 à 96 ms sur Type Mine est un recul, sous le seuil, sur 3 passages seulement. Donnée interne non revérifiée : « INP mobile 712ms (poor) », mesuré le 06-01 (`audit/automecanik-departments-map.md:59`) |
| E-4 | CLS ≤ 0,1 ; le labo ne voit que le chargement | W2, W7 | Labo OUI (0) | Labo OUI (0) | `mesures/apres-*.json` ; la mesure de la page actuelle vient du relevé de DS |
| E-5 | « If CrUX data is available … concentrate on the real user data first » | W4 | NON VÉRIFIABLE | NON VÉRIFIABLE | Ni CrUX ni la Search Console n'ont été consultés. La collecte interne des mesures réelles est signalée instable (incident `web-vitals-attribution-unstable`) |
| E-6 | Les signaux d'expérience autres que les CWV « don't directly help your website rank higher » ; Google montre la page la plus pertinente « even if the page experience is sub-par » | G15 | — | — | Pas une exigence : ce point fixe le poids de la vitesse, qui compte mais passe après la pertinence |

### 3.F Accessibilité (WCAG 2.2)

Mis à jour par le complément n° 5 pour la tête actuelle de #2210,
`06feff9686afa610d5b0363397e2cd2b7ec3fe1d` (compléments n° 4 et n° 5 du mandat DS). La colonne
« 06feff968 » est remesurée par moi, à 390 et 1440 px, sur un rendu propre de la branche
(`mesures/c5-*`). La colonne « 34bdc1eb3 » reste celle du complément n° 4.

- **8507eb5b8 et e31d3babe** : ces colonnes reprennent les têtes relues aux compléments précédents.
- **34bdc1eb3** : cette colonne est remesurée par moi, sans reprendre les chiffres de DS. Méthodes :
  axe, mesure directe (couleurs calculées et pixels), tailles, animations et survol.
- **Périmètre** : elle porte sur la page R1. Le pied de page, la barre mobile du bas et le bandeau de
  l'en-tête sont partagés par tout le site ; ils sont comptés à part (revue 05).

| ID | Exigence | Source | Actuelle | 8507eb5b8 | e31d3babe | 34bdc1eb3 | 06feff968 | Preuve |
|---|---|---|---|---|---|---|---|---|
| F-1 | 1.4.3 (AA) : contraste de 4,5:1, ou 3:1 pour le grand texte, sans arrondi | A1 | **NON** (25) | **NON** (24) | **NON** (24) ; cartes véhicule **OUI** | axe **OUI** sur R1 (0) ; au pixel **NON** (4 défauts R1) | axe **OUI** sur R1 (0, nœuds identiques à 34bdc1eb3) ; au pixel **OUI** (4 défauts corrigés) | **e31d3babe** : 24 nœuds axe à 390 px, dont 15 sur R1 et 9 globaux (`c4-e31d-page-*-reduce.json`). Cartes au minimum 4,72:1 (`c3-e31d-apparence-*.json`). **34bdc1eb3** : axe 9 nœuds à 390 px et 5 à 1440 px, tous dans le pied de page ou la barre du bas (`c4-34bd-page-*.json`). Mesure directe des 15 textes R1 : « Conseils entretien » #1E8449 sur #F8FAFC, 4,51:1 ; légendes, 4,62 à 4,83:1 ; sous-textes de 10 px, 4,71:1 ; ancres et « Lire plus » #C2410C sur #F5F7FA, 4,83:1. Jetons `success`, `neutral-400` et `cta-700`. Restent au pixel, hors de vue d'axe (« incomplete ») : fil d'Ariane du hero 1,6:1, #0D4473 sur #101F39 (règle `nav a`, `global.css:217`, `c4-34bd-hero-pixel.txt`, `c4-34bd-ariane-origine-couleur.txt`) ; onglet inactif « Type Mine » 4,35:1 à 1440 px ; bande des liens utiles sous l'ombre de la carte du hero à 1440 px, de 3,9 à 4,3:1 (`bande-du4.cjs`). Le badge « 2 min » est rendu en #020817 et non en `cta-700` (18,84:1) : la classe ajoutée est sans effet **06feff968** (`c5-*`) : fil d'Ariane #9CA3AF sur #101F3A, 6,47:1 à 390 px et 6,38:1 à 1440 px ; onglet « Type Mine » 6,90:1 à 1440 px (variante mobile 12,0:1) ; badge « 2 min » #C2410C sur #FFF7ED, 4,87:1, sur une ligne ; bande des liens utiles de 4,51 à 4,55:1, « Guide d'achat » 5,01:1 ; textes R1 directs de 4,51 à 4,88:1. axe 9 / 5 nœuds, tous dans le pied de page et la barre du bas. |
| F-2 | 2.5.8 (AA) : cible d'au moins 24×24 px CSS, sauf exceptions | A2 | **NON** (1) | **NON** (1) | **NON** (1) | **OUI** (0) | **OUI** (0) | **e31d3babe** : le bouton de 48×16 dans `#aller-plus-loin`. **34bdc1eb3** : axe `target-size` 0. Restent 4 cibles sous 24 px à 390 px (10 avant), toutes en exception. Le lien d'évitement mesure 1×1 hors focus et 221×42 au focus. Les liens « filtre à air » (63×18) et « En savoir plus sur le filtre à huile » (207×18) sont dans une phrase. À 1440 px, deux liens en ligne s'y ajoutent, ainsi que des éléments globaux (revue 05) **06feff968** : `target-size` 0 ; 4 cibles sous 24 px à 390 px et 10 à 1440 px, les mêmes qu'à 34bdc1eb3, toutes en exception ou globales. |
| F-3 | 2.5.5 (AAA) : 44×44 px. C'est aussi le seuil des skills du dépôt | A3 | NON | NON | Navigation rapide **OUI** ; reste de la page NON | Navigation rapide **OUI** ; reste de la page NON | Inchangé | **e31d3babe** : les 6 boutons de la navigation rapide font de 76×44 à 140×44 ; 20 cibles restent sous 44 px. **34bdc1eb3** : 16 cibles de 24 à 44 px à 390 px et 25 à 1440 px. Le fil d'Ariane, les liens utiles et « Lire plus » passent de 16 à 24 px de haut **06feff968** : 16 cibles de 24 à 44 px à 390 px et 25 à 1440 px, comme à 34bdc1eb3. |
| F-4 | 1.4.1 (A) : un lien dans un texte ne se distingue pas par sa seule couleur (technique G183 : 3:1 face au texte voisin, plus un repère au survol et au focus) | A9 | OUI (0) | **NON** (1) | **NON** (1) | **NON** (1) | **NON** (1) | Lien « Conseils : changer un filtre à huile étape par étape » dans `#reference`, à 390 px. Inchangé (règle `link-in-text-block`) **06feff968** : toujours présent à 390 px, sur le même lien. |
| F-5 | 2.2.2 (A) : un mouvement qui démarre seul, dure plus de 5 s et côtoie d'autres contenus doit pouvoir être mis en pause, arrêté ou masqué | A5 | PARTIEL | PARTIEL | PARTIEL | **OUI** avec le réglage | **OUI** avec le réglage | **e31d3babe** : 3 boucles continuent avec le réglage « réduire les animations » (`GammeHero.tsx:139` et `:229`, `GammeDiagnosticCTA.tsx:15` et `:51`). **34bdc1eb3** : 0 boucle avec le réglage, à 390 comme à 1440 px (`document.getAnimations()`, `c4-34bd-page-*-reduce.json`). Sans le réglage, 4 boucles tournent : le point du hero, le reflet de `#reference`, le flottement et le reflet du bloc diagnostic. Reste à confirmer par un auditeur humain si un réglage du système suffit comme moyen d'arrêt **06feff968** : avec le réglage, 0 animation et 0 boucle (`c5-page-*.json`). |
| F-6 | 2.3.3 (AAA) et W7 : respecter `prefers-reduced-motion` | A4, W7 | **NON** | **NON** | PARTIEL | **OUI** sur R1 | **OUI** sur R1 | **e31d3babe** : le défilement `smooth` et 14 autres animations restaient. **34bdc1eb3**, avec le réglage : 0 animation. La navigation rapide est à la cible dès 60 ms (à 390 px, 750 → 13 653 px ; à 1440 px, 7 227 px), contre un défilement animé avant (769 px à 60 ms). Restent, hors R1 : `scroll-behavior: smooth` sur `html` (`hooks/useScrollBehavior.ts`) et 31 éléments déplacés au survol sans garde, rendus instantanés par `styles/animations.css:175-189` (`c4-34bd-survol-1440x900.json`) **06feff968** : avec le réglage, 0 animation ; la navigation rapide est à la cible dès 60 ms (750 → 13 516 px à 390 px). `html` garde `scroll-behavior: smooth` (global). |
| F-7 | 2.4.3 (A) : un ordre de focus « that preserves meaning and operability » | A6 | NON VÉRIFIABLE | NON VÉRIFIABLE | NON VÉRIFIABLE | NON VÉRIFIABLE | NON VÉRIFIABLE | Aucun parcours complet au clavier n'a été fait. Constat préexistant : le lien d'évitement n'est que le 23e élément focalisable |
| F-8 | 2.4.11 (AA) : focus non caché par un contenu de l'auteur ; un chat fixe « potentially fail » | A7 | NON VÉRIFIABLE | NON VÉRIFIABLE | NON VÉRIFIABLE | NON VÉRIFIABLE | NON VÉRIFIABLE | Le bouton de chat est fixé à l'écran (`ChatWidget.tsx:210`) ; non testé au clavier |
| F-9 | 3.3.2 (A) : étiquettes pour toute saisie | A8 | OUI (contrôle automatique) | OUI (contrôle automatique) | OUI (contrôle automatique) | OUI (contrôle automatique) | OUI (contrôle automatique) | axe ne relève aucune violation d'étiquette sur le sélecteur **06feff968** : idem. |

**Seconde gamme à 06feff968** : `/pieces/plaquette-de-frein-402.html`, même rendu propre.

- axe : identique à 34bdc1eb3 (9 nœuds à 390 px et 5 à 1440 px, tous globaux), cibles identiques.
- Contraste direct au minimum 4,51:1 ; badge « 2 min » 4,87:1 sur une ligne ; onglet « Type Mine »
  6,9:1 ; fil d'Ariane 6,38:1.
- Fichiers : `c5-gamme2-*`, captures `c5-06fe-plaquette-*`.

**Seconde gamme** : `/pieces/plaquette-de-frein-402.html`, même build 34bdc1eb3.

- axe : 9 nœuds à 390 px et 5 à 1440 px, tous globaux.
- Textes R1 : de 4,51 à 4,83:1, et 4,32:1 au pixel pour « Conseils entretien » à 1440 px.
- Mouvement : 0 boucle et défilement instantané.
- Fichiers : `c4-34bd-gamme2-plaquette-page-*-reduce.json`, captures `c4-34bd-plaquette-*`.

Les 7 composants modifiés ne servent qu'à `pieces.$slug.tsx`, sans couleur propre à la gamme : le
rendu est le même pour toutes les gammes R1.

### 3.G Usage e-commerce (téléphone, ventes)

| ID | Exigence | Source | Actuelle | Maquette | Preuve |
|---|---|---|---|---|---|
| G-1 | Bon point relevé sur les sites de pièces : « prominent vehicle-based product finders » | B1 | PARTIEL | OUI | Sur téléphone, le sélecteur passe au premier écran dans la maquette (C-2). Captures dans `captures/` |
| G-2 | « search and navigation reliably limited results to compatible parts » | B1 | OUI pour R1 | OUI pour R1 | Les cartes et le sélecteur mènent vers la page R2 du véhicule. Le filtrage lui-même se fait en R2, hors de ce mandat |
| G-3 | Faiblesse relevée : « gaps in comparison support and decision-stage clarity » ; « Finding a part that fits is only one step » | B1, B2 | PARTIEL | PARTIEL | La page a un bloc « Bien choisir », mais le canon renvoie le « comment choisir » vers R6 (`role-matrix.md:99-100`). Le lien vers R6 n'est pas mis en avant |
| G-4 | Un bouton « Afficher plus » doit indiquer le total, le nombre affiché et le nombre restant, par exemple « Viewing 40 of 333 » | N3 | PARTIEL | PARTIEL | « 5232 motorisations » en tête de liste, 12 cartes, puis « Voir les 7 autres compatibilités » : le visiteur ne sait pas que les 19 cartes sont une sélection parmi 5 232 |
| G-5 | Prix « permanently visible at all times » dans les listes de produits ; « lack of prices is a huge usability problem » | B3, N2 | — | — | R1 liste des véhicules, pas des produits : l'exigence s'applique à R2. Voir le conflit K-3 |
| G-6 | Les pages de catégorie ne sont pas toujours nécessaires : « they require an extra step » ; à utiliser « only when they are truly necessary » | N1 | PARTIEL | PARTIEL | R1 sert de porte d'entrée aux recherches sans véhicule. Elle reste une étape de plus avant les produits : voir K-3 |
| G-7 | Sur téléphone, « evidence doesn't support » l'ajout de fonctions de comparaison | B4 | — | — | Pas d'exigence pour R1 ; c'est un garde-fou contre l'ajout d'un comparateur sur téléphone |

## 4. Écarts classés par effet attendu

**Référencement**
1. A-2, les 7 pages véhicule sans lien, dans les deux versions. Ces pages R2 dépendent d'autres
   chemins pour être découvertes, chemins qui ne sont pas vérifiés (A-3). C'est l'écart le plus
   direct avec G1, G4 et G19.
2. B-1, le titre tronqué « AutoMeca… » dans la balise. Il touche le titre affiché, donc les clics.
3. D-1, un balisage qui ne correspond pas exactement au contenu visible (FAQ 4/5, liste 19 dont
   7 masquées). G14 prévoit une action manuelle de Google en cas d'abus manifeste ; ici, c'est un
   défaut de fidélité.
4. B-3, une description qui promet un prix et du stock non établis sur la page.
5. A-4, des ancres longues et répétées 12 fois.

**Vitesse**
1. E-5, l'absence de donnée terrain : on ne sait pas si la page passe les seuils pour de vrais
   visiteurs.
2. E-1 et E-2 : la maquette gagne 1 s de LCP de labo sur les écrans de 800 à 823 px. Sur un écran
   de 915 px, l'image en priorité haute redevient l'élément LCP, à 2,7 s.
3. E-3 : labo sous les 200 ms partout ; le seul chiffre interne de terrain (712 ms le 06-01) est
   mauvais et n'a pas été revérifié.

**Usage sur téléphone**
1. G-1 et C-2 : la maquette corrige l'ordre (sélecteur d'abord).
2. F-1 à F-4 : contrastes et cibles, sous le niveau AA dans les deux versions ; la maquette ajoute
   un lien distingué par sa seule couleur.
3. F-5 et F-6 : animations sans fin, sans respect du réglage « réduire les animations ». À
   e31d3babe, cartes et navigation rapide corrigées ; restent trois boucles, le défilement
   `smooth` et 31 déplacements au survol (§3.F).
4. G-4 : compteur trompeur (5 232 contre 19).

**Ventes**
1. G-6 et K-3 : chaque seconde passée en R1 retarde l'arrivée sur les produits et leurs prix. Le
   passage de R1 à R2 est ce qui se vend.
2. G-3 : l'aide au choix, point faible de tout le secteur selon B1, n'est pas reliée à R6.
3. B-3 : une promesse de stock dans la description que la page ne prouve pas expose à une
   déception à l'arrivée en R2 ou à la commande. Effet non mesuré.

## 5. Conflits entre les règles du dépôt et les sources

Aucune règle n'a été modifiée. Chaque proposition passe par une PR sur
`.claude/governance/journal-des-principes.md`, approuvée par Marwane.

| ID | Règle du dépôt | Source externe | Nature | Ce qu'il faudrait changer dans la règle |
|---|---|---|---|---|
| K-1 | `r1.ts:33` : `allowed_schemas` = `Article`, `BreadcrumbList` | G17 réserve `Article` aux pages d'actualité, de blog et de sport ; G3 cite `BreadcrumbList` pour l'e-commerce et ne cite ni `ItemList` ni `CollectionPage` | Règle à l'opposé de la source | Retirer `Article` des types R1. Garder `BreadcrumbList`. Décider explicitement si `CollectionPage` et `ItemList` restent comme balisage descriptif, sans attente de résultat enrichi (D-4), et l'écrire dans le contrat (C2 de la revue) |
| K-2 | « FAQ de sélection » permise (`role-matrix.md:95`) ; règle de source unique P17 appliquée à la FAQ | G9 : résultat enrichi FAQ retiré à partir du 7 mai 2026 ; G14 : balisage fidèle | Règle en retard sur la source, sans contradiction | Noter que `FAQPage` n'apporte plus d'affichage dans Google. La FAQ ne se justifie plus que pour le visiteur, et doit rester identique au balisage (P17, G14). Ne plus compter `FAQPage` comme un gain SEO dans les audits et les skills |
| K-3 | R1 interdit les prix détaillés et le stock (`role-matrix.md:89-100`) ; R2 les porte | Voir l'analyse ci-dessous | Règle défendable sous condition | Écrire la condition dans la règle : R1 est un passage court vers R2. Sélecteur au premier écran, `<a href>` vers toutes les pages R2 mises en avant, et un indicateur suivi : le taux de passage R1 → R2 |
| K-4 | Maximum de 150 mots pour R1 (`page-role.types.ts:36`, `page-role-validator.service.ts:502-509`) ; section de 1 500 à 3 000 caractères (`r1.ts:22-31`) | G5 : aucun nombre de mots préféré ; on juge la valeur apportée face aux autres pages | Règle à l'opposé de la source, et contradictoire en interne (C3 de la revue) | Remplacer les seuils de longueur par des contrôles de valeur : faits propres à la gamme, aucune phrase reprise d'une autre gamme, aucune affirmation sans source. Ne garder une longueur que comme alerte, jamais comme objectif |
| K-5 | Cibles de 44 px dans les skills (`responsive-audit`) | A2 : 24 px suffisent au niveau AA ; A3 : 44 px = AAA | Règle **au-dessus** de la source | Rien à changer. Préciser dans la skill que 44 px est un niveau plus exigeant que AA, pour ne pas classer un écart AAA comme une non-conformité AA |
| K-6 | Aucune règle ne demande que toute URL déclarée en `ItemList`, ou mise en avant, soit un `<a href>` présent dans le HTML serveur | G1, G4, G6, G19 | Règle **absente** | Ajouter cette exigence au contrat R1 et à un test de `packages/seo-role-contracts` : chaque URL de l'`ItemList` est un `<a href>` dans le HTML serveur. Un « Voir plus » peut replier l'affichage, pas retirer le lien |
| K-7 | Aucune règle de dépôt sur `prefers-reduced-motion` ; les skills le recommandent | A4, A5, W7 | Règle absente | Ajouter aux règles du frontend : toute animation sans fin s'arrête avec `prefers-reduced-motion`, et le défilement doux aussi |
| K-8 | Aucune règle sur la priorité de l'image du hero quand elle n'est plus au premier écran | W4, W5 | Règle absente | Mettre la priorité haute seulement sur l'image qui est l'élément LCP mesuré ; sinon, laisser le navigateur décider. À valider sur données terrain |
| K-9 | Description R1 : la règle interdit prix et stock, mais la description servie contient « dès 5€ » et « En stock » | G8 : rien n'exige un prix pour une catégorie | Écart entre la page et la règle, pas entre la règle et Google | Rien à changer dans la règle. Le texte relève de Marwane (§7.1 de la revue) |

### 5.3 R1 sans prix, R2 avec prix : ce que disent les sources

- **Google n'exige aucun prix sur une page de catégorie.**
  - G8 cite le prix pour les pages produit, pas pour les catégories.
  - G12 et G13 demandent de mettre le balisage `Product` sur les pages produit, et non « category
    pages or lists ».
  - Un R1 sans prix est donc conforme à Google.
- **Baymard (B3) et NN/g (N2) exigent le prix dans les listes de produits.** Ils jugent son
  absence très gênante. Mais R1 ne liste pas de produits : elle liste des véhicules, et c'est R2
  qui liste les produits avec leur prix. L'exigence porte sur R2, que ce mandat ne juge pas.
- **NN/g (N1) met en garde contre la page de catégorie inutile**, qui ajoute une étape. C'est le
  vrai risque du partage R1 / R2 : non pas l'absence de prix, mais le temps et les clics avant
  de voir un prix.
- **Baymard (B1) note que les meilleurs sites du secteur mettent en avant le sélecteur de
  véhicule** et la visibilité des prix. Le chemin R1 → sélecteur → R2 avec prix répond aux deux,
  si le passage est immédiat.
- **Conclusion.** Le partage reste défendable si R1 reste un routeur court :
  - le sélecteur au premier écran ;
  - toutes les pages R2 mises en avant reliées en `<a href>` ;
  - aucune promesse de prix ou de stock que R1 ne prouve pas (sa description actuelle en contient) ;
  - une mesure du passage de R1 à R2.

  Le dépôt n'a aujourd'hui ni cet indicateur, ni la règle des liens (K-6).

## 6. Concurrents

Aucun concurrent n'a servi de modèle ni de point de comparaison dans ce document (consigne n° 4).

## 7. Ce qu'il faut pour être au meilleur niveau

Dix actions au plus, dans l'ordre de leur effet attendu. Équipes : 05 Brand & Communication,
06 Contenu éditorial, 07 Production Pages & SEO, 10 Catalogue & Compatibilité, 20 Produit &
Expérience Client. Rien n'est engagé : chaque action demande l'accord de Marwane, et le titre,
le H1 et l'ordre des blocs lui sont réservés.

| # | Action | Source | Effet attendu | Équipe | Mesure après mise en ligne |
|---|---|---|---|---|---|
| 1 | Rendre les 19 pages véhicule présentes en `<a href>` dans le HTML serveur. Le « Voir plus » peut replier l'affichage, pas retirer les liens. Inscrire la règle au contrat R1 et la tester (K-6) | G1, G4, G6, G19 | Découverte et poids interne des 7 pages R2 aujourd'hui sans lien | 07, avec 20 | HTML serveur : 19 liens sur 19. Inspection d'URL de la Search Console : HTML rendu. Couverture d'indexation des 7 URL sur 28 jours |
| 2 | Aligner le balisage sur le visible : FAQ 5 sur 5 depuis une seule source, `ItemList` = liens présents. Retirer `Article` du contrat `r1.ts` et y écrire les types réellement voulus (K-1, K-2) | G14, G17, G9 | Balisage fidèle, aucun risque d'action manuelle, contrat exécutable juste | 07 | Test de résultats enrichis sans erreur ; test de contrat vert ; différence balisé / visible nulle |
| 3 | Proposer à Marwane un titre sans « … » écrit dans la balise, avec le nom du site entier en fin, et une description sans prix ni stock non prouvés | G7, G8 | Titre affiché complet ; promesse exacte ; meilleur taux de clic | 07 prépare, Marwane décide ; 06 pour le texte | Search Console, sur 28 jours avant/après : taux de clic et impressions de l'URL, titre réellement affiché dans les résultats |
| 4 | Garder le sélecteur au premier écran sur téléphone (maquette) et rendre l'arrivée en R2 immédiate (K-3) | B1, N1, G5 | Moins d'étapes avant le prix, donc davantage de passages vers les produits | 20 | GA4 : taux de passage R1 → R2 sur téléphone (clics sur le sélecteur et les cartes ÷ vues R1), puis ajouts au panier depuis ces sessions |
| 5 | Compteur honnête : « 19 motorisations les plus demandées sur 5 232 », et un bouton qui dit combien il en reste | N3 | Le visiteur comprend qu'il peut chercher son véhicule s'il n'est pas dans la liste | 20, avec 10 pour l'exactitude des chiffres | Clics sur « Voir les autres » et usage du sélecteur après ce clic |
| 6 | Retirer la priorité haute de l'image du hero quand elle n'est plus au premier écran sur téléphone (K-8) | W4, W5 | LCP stable sur toutes les hauteurs d'écran, au lieu de 2,7 s à 915 px | 20 | LCP au 75e centile sur téléphone (CrUX ou mesure réelle), élément LCP attribué |
| 7 | Rétablir la mesure réelle des Core Web Vitals par type de page, téléphone et ordinateur séparés, avant la mise en ligne, pour pouvoir comparer avant et après | W1, W2, W4, G16 | Décider sur les visiteurs réels plutôt que sur le labo | 20 | Rapport Core Web Vitals de la Search Console pour les pages `/pieces/*.html` ; au 75e centile : INP < 200 ms, LCP < 2 500 ms, CLS < 0,1 |
| 8 | Contrastes à 4,5:1, cibles d'au moins 24 px (44 px visés), liens soulignés dans le texte | A1, A2, A3, A9 | Lecture en plein soleil, touchers sans erreur, conformité AA | 05 pour les couleurs, 20 pour l'intégration | axe à 390×844 sur la page servie : 0 `color-contrast`, 0 `target-size`, 0 `link-in-text-block` |
| 9 | Animations : arrêt avec `prefers-reduced-motion` (ping, flottement, reflet, défilement doux), et pas de boucle sans fin (K-7) | A4, A5, W7 | Confort des visiteurs sensibles au mouvement, conformité 2.2.2 | 05, avec 20 | Relevé avec le réglage « réduire les animations » activé : aucune animation en boucle |
| 10 | Aide au choix : lien visible vers le guide R6 « comment choisir » depuis R1, sans contenu de procédure en R1 | B1, B2, N1 | Combler le point faible du secteur (« decision-stage clarity ») sans alourdir R1 | 06 pour le guide, 10 pour les critères de compatibilité | Clics de R1 vers R6, puis passages de R6 vers R2 |

## 8. Ce qui n'a pas pu être vérifié

- **Données terrain** : ni CrUX, ni la Search Console, ni GA4 n'ont été consultés (E-1, E-3, E-5).
- **Le reste du site** : liens vers les 7 pages R2 depuis d'autres pages, et sitemap (A-3) ;
  unicité de la description (B-3).
- **Contrôles humains** : parcours au clavier (F-7, F-8) ; interprétation de 2.2.2 pour de petites
  animations décoratives (F-5).
- **Sources partielles ou payantes** :
  - G9, page retirée : seul le journal des mises à jour a été lu ;
  - G13 et B3, lues en partie ;
  - les recommandations payantes de Baymard (B1, B2), non lues.
- **Maquette** : son HTML serveur n'a pas été relu pendant ce complément, car son serveur était
  arrêté. Ses faits de liens viennent du code au commit `8507eb5b8`.
