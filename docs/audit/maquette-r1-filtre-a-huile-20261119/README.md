# Mandat DS — maquette R1 de `/pieces/filtre-a-huile-7.html`

Date : 2026-11-19. Base : `main` à `2462efde5`. Branche :
`feat/maquette-r1-filtre-a-huile-20261119`. Rien n'est fusionné, déployé ni écrit en
base. Aucun H1, H2, title, meta ni texte de contenu n'est modifié.

Marwane valide l'aspect et l'ordre des blocs (décision 57) sur les captures de
`captures/`. Il a validé l'ordre le 19 nov. 2026 à 19:36 (heure de Tunis).
L'apparence n'est pas encore validée. Le complément n° 2 y apporte trois
corrections (§Complément n° 2).

## En bref

- **Ordre proposé** : sélecteur de véhicule d'abord (sur mobile, l'image passe
  sous le sélecteur, comme dans #1943). Puis la réassurance, puis la compatibilité
  et les motorisations (passage vers R2), puis l'aide au choix, la FAQ, le
  diagnostic et enfin les liens.
- **Code** : 3 fichiers, l'ordre seulement. Aucun texte, aucune couleur, aucun
  composant nouveau.
- **Mesure mobile bridée** (protocole calé sur Lighthouse, pas Lighthouse, voir
  §Limites), médiane de 3 :

  | | LCP | CLS | TBT |
  |---|---|---|---|
  | Avant | 2 824 ms | 0 | 26 ms |
  | Après | 1 732 ms | 0 | 86 ms |

  Le LCP baisse parce que l'élément LCP n'est plus l'image du hero mais le H1. Le
  TBT monte de 60 ms ; sa cause n'est pas isolée (§6.4).
- **Prix et disponibilité : non affichés sur R1.** Sans véhicule choisi, il n'y a
  pas de donnée réelle à afficher, et le canon R1 les interdit
  (`.spec/00-canon/role-matrix.md`). Ils restent en R2.
- **6.2 (structure des pages concurrentes) : non réalisé.** Les 5 sites interrogés
  refusent l'accès automatique (403), et la seconde tentative par curl a été
  refusée par le garde-fou de la session (§6.2).

## Méthode

- **Rendu isolé.** Le build du worktree est servi par `react-router-serve` sur
  :3018. Les loaders lisent le backend DEV partagé en GET
  (`INTERNAL_API_BASE_URL=http://127.0.0.1:3000`). Un proxy local
  (`outils/img-proxy.mjs`, :3017) joue le rôle de Caddy/NestJS :
  - `/img/*` et les GET `/api/*` vont au DEV ;
  - les 3 POST de télémétrie reçoivent 204 sur place et ne partent pas ;
  - toute autre écriture reçoit 405.

  Le service DEV partagé n'a été ni redémarré ni modifié.
- **Captures** (`outils/capture.cjs`, Playwright) : 390×844 en DPR 2 et 1440×900.
  - Toute requête autre que GET/HEAD est bloquée, ainsi que les domaines
    analytiques.
  - Pour la page entière seulement, `.cv-auto` est forcé visible. Sans cela, les
    sections hors écran sont vides (`content-visibility`).
  - Les pages entières sont ramenées à 1x et plafonnées à 16 000 px de haut
    (limite WebP).
- **PROD.** Le navigateur sans tête reçoit un challenge Cloudflare (403), et le
  résoudre exige des POST. Le HTML a donc été pris par `curl` en GET (200), puis
  servi comme document au navigateur. Les sous-ressources sont prises en GET ; les
  POST (balises CWV, attribution, runtime-event, challenge) sont bloqués et
  listés dans `releves/avant-prod-blocs.json`.
- **Relevé des blocs.** Ce sont les enfants du plus proche ancêtre commun du H1 et
  de `section#faq`, avec leur position et leurs titres (`releves/*.json`).

## 6.1 Inventaire de la page actuelle

La structure est identique sur les trois rendus : isolé, DEV et PROD. PROD
diffère de 133 px de haut à 390, dans « Aller plus loin ».

| # | Bloc | Composant | Source de données | 390 (haut/hauteur px) | 1440 |
|---|---|---|---|---|---|
| 1 | Hero : H1, image, sélecteur | `components/gamme/GammeHero.tsx` | `data.hero`, `data.r1Images.HERO` ; sélecteur = API véhicules | 160 / 865 | 113 / 387 |
| 2 | Bandeau de réassurance et 3 liens | inline dans `routes/pieces.$slug.tsx` | texte fixe ; `buyingGuideHref`, `conseilsHref` | 1 025 / 97 | 500 / 49 |
| 3 | Navigation rapide | `components/gamme/GammeQuickNav.tsx` | liste fixe | 1 122 / 62 | 549 / 62 |
| 4 | « Diagnostic gratuit » | `components/gamme/GammeDiagnosticCTA.tsx` | texte fixe → `/diagnostic-auto` | 1 184 / 241 | 611 / 250 |
| 5 | `#bien-choisir` | route ; `GammeChecklist`, `GammeErrors` | `editorialBlocks.chooseSection`, `r1Images.TYPES`, section pack | 1 425 / 2 155 | 860 / 1 263 |
| 6 | `#qualite-prix` | route ; `EquipementiersSection` | `editorialBlocks.priceSection`, `r1Images.PRICE`, `equipementiersSync` | 3 580 / 3 028 | 2 123 / 1 465 |
| 7 | `#emplacement` | route | `editorialBlocks` (emplacement), `r1Images.LOCATION` | 6 608 / 1 278 | 3 588 / 734 |
| 8 | `#reference` | route ; `MotorisationsSection variant="R1"` | `editorialBlocks.referenceSection` ; `data.motorisations` (différé) | 7 886 / 5 255 | 4 322 / 2 550 |
| 9 | `#faq` | `GammeFaq` | `mergedFaq` (FAQ éditoriale et section pack) | 13 141 / 607 | 6 872 / 454 |
| 10 | `#aller-plus-loin` | `CatalogueSection`, `GammeGuideCTA`, `R1RelatedBlocks` | `catalogueMameFamille` (différé), `relatedResources` | 13 748 / 1 819 | 7 326 / 972 |
| — | Pied de page | `LazyFooter` | — | 15 567 | 8 298 |

Tous les blocs sont présents en mobile et en desktop.

**Ce que montrent les captures « avant »** (`captures/avant-*`) :
- **Mobile** : l'image du hero occupe environ 480 px. Le sélecteur commence vers
  560 px, et seul le champ Marque est à peine visible au-dessus de la ligne de
  flottaison. Les blocs de compatibilité (motorisations → R2) arrivent à 7 886 px,
  après trois sections éditoriales.
- **Desktop** : l'image et le sélecteur sont côte à côte. Le bandeau, la
  navigation et le Diagnostic sont visibles d'emblée. La compatibilité arrive à
  4 322 px.

### Écart avec `design-system/roles/R1-router.md`

Ce document (v2.0.0, 2026-01-28) décrit une page de **listing** : barre véhicule,
filtres (dont le prix et la disponibilité), puces de filtres actifs, grille de
résultats avec fourchette de prix, tri, pagination, puis texte SEO.

La page servie et le canon (`.spec/00-canon/role-matrix.md`, R1) décrivent une
page **routeur** : sélecteur, rappels de compatibilité, variantes, FAQ de
sélection et liens, sans prix, stock ni livraison. La grille de produits et les
filtres relèvent de R2.

`R1-router.md` est donc en écart avec le canon. Cette maquette suit le canon.
Restent communs aux deux :
- le sélecteur en premier ;
- « pas de long texte marketing avant la sélection » ;
- pas de vidéo en lecture automatique ;
- LCP ≤ 2 500 ms et CLS ≤ 0,05. Le LCP de l'avant (2 824 ms) manque la cible,
  celui de l'après (1 732 ms) la tient.

### Ce que proposent les PR citées et la maquette 06, par bloc

| Bloc | #1943 | #1944 | #2143 | Maquette 06 |
|---|---|---|---|---|
| Hero | Mobile : sélecteur avant l'image | — | — | Sélecteur sur fond navy foncé |
| Réassurance | — | — | Fenêtre de retour lue dans `useReturnPolicy` ; bandeau dynamique | Bandeau, livraison et badges exclus |
| Navigation rapide | — | Libellé « Prix & Marques » selon `withPrice` | — | Barre de chapitres collante |
| Diagnostic | — | — | — | Descendu |
| `#bien-choisir` | — | — | — | « 4 repères » |
| `#qualite-prix` | — | H2 conditionnel « Qualité et marques » | — | — |
| `#emplacement` | — | 2 colonnes | — | — |
| `#faq` | — | — | — | Accordéon de 5 questions |
| `#aller-plus-loin` | — | — | — | Exclu |
| Hors bloc | — | Migrations de base | — | — |

## 6.2 Structure des pages concurrentes : non réalisé

- **WebSearch** interroge un index américain : ce n'est pas le classement Google
  France. Ses résultats (Carter-Cash, Mister-Auto, ManoMano, Kaufland) ne disent
  rien de la structure des pages.
- **Lecture directe**, une fois chacune : oscaro.com, mister-auto.com,
  carter-cash.com, auto-doc.fr, norauto.fr → **403** pour les 5.
- **Seconde tentative en `curl` GET** depuis le serveur DEV (autre client, autre
  origine réseau) : refusée par le garde-fou de la session. Elle n'a pas été
  contournée.

Aucune structure concurrente n'a été relevée, et l'ordre de 6.3 n'en dépend pas.
Pour le faire, il faudrait un navigateur que ces sites acceptent, par exemple sur
le poste de Marwane, ou un outil de relevé SERP autorisé.

## 6.3 Ordre proposé, bloc par bloc

| # | Bloc | Justification |
|---|---|---|
| 1 | **Hero et sélecteur** (sur mobile, image sous le sélecteur) | Le sélecteur est l'outil d'achat de R1. Sur mobile, il est maintenant entier au-dessus de la ligne de flottaison (`captures/apres-isole-390-fold.webp`). C'est le diff de #1943, repris à l'identique. |
| 2 | **Bandeau de réassurance** (inchangé) | Confiance juste après le sélecteur. Texte non modifié (hors périmètre), mais voir §Constats : « Livraison 24-48h » est hors canon R1, et « Retours 30 jours » est traité par #2143. |
| 3 | **Navigation rapide** (réordonnée) | Suit le nouvel ordre des sections. Libellés inchangés. |
| 4 | **`#reference` — compatibilité et motorisations** (remonté de la 8ᵉ à la 4ᵉ place) | C'est le seul bloc qui mène à des pièces compatibles (cartes motorisation → R2) avec des données réelles (5 232 motorisations). Achat d'abord : il arrive à 1 184 px sur mobile au lieu de 7 886. |
| 5 | **`#bien-choisir`** | Aide au choix, après l'outil d'achat. |
| 6 | **`#qualite-prix`** | Marques et équipementiers (aide au choix). Aucun prix affiché. |
| 7 | **`#emplacement`** | Information d'entretien, moins liée à l'achat. |
| 8 | **Emplacement vidéo** — *variante de capture seulement* | Décision 43. Aucune vidéo n'existe, donc rien n'est livré dans le code. La variante `captures/apres-isole-variante-video-*` montre l'emplacement, étiqueté « Emplacement prévu », avant la FAQ. |
| 9 | **`#faq`** | Questions de sélection, après les contenus d'aide. |
| 10 | **Diagnostic** (descendu) | C'est un lien de sortie vers R5. Il ne passe plus avant l'aide au choix et rejoint la zone de liens (décision 82). |
| 11 | **`#aller-plus-loin`** | Liens générés par règles : même famille (R1), guide (R3), pièces associées. |

**Non affichés** : prix et disponibilité (pas de donnée sans véhicule, interdits
sur R1). Aucun bloc sans donnée réelle n'a été ajouté.

**Alternance des fonds** : `#reference` gris, `#bien-choisir` blanc,
`#qualite-prix` gris, `#emplacement` blanc, `#faq` gris (était blanc), Diagnostic
gris, `#aller-plus-loin` blanc (était gris). Seules des classes déjà présentes
sont utilisées.

## 6.4 Réalisation

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `frontend/app/components/gamme/GammeHero.tsx` | Diff de #1943 à l'identique : `order-last lg:order-none` sur le bloc image, marge `mt-4 lg:mt-0` au lieu de `mb-4 lg:mb-0`. Desktop inchangé. |
| `frontend/app/routes/pieces.$slug.tsx` | `section#reference` déplacée après `<GammeQuickNav />` ; `<GammeDiagnosticCTA />` déplacé après `section#faq` ; fonds de `#faq` et `#aller-plus-loin` échangés ; commentaires « H2 #n » renumérotés. |
| `frontend/app/components/gamme/GammeQuickNav.tsx` | `SECTIONS` réordonné (Compatibilité en tête), libellés inchangés. |

Ce qui ne change pas :
- aucun texte, aucun H1/H2, aucune classe de couleur, police ou espacement
  nouvelle ;
- aucun composant nouveau ;
- les ancres `id` sont inchangées : aucune URL ni ancre ne change ;
- l'ordre est celui du DOM, et non un ordre CSS : titres, lecteurs d'écran et
  tabulation suivent l'ordre visible.

### Après (rendu isolé)

| # | Bloc | 390 (haut/hauteur px) | 1440 |
|---|---|---|---|
| 1 | Hero | 160 / 865 | 113 / 387 |
| 2 | Réassurance | 1 025 / 97 | 500 / 49 |
| 3 | Navigation rapide | 1 122 / 62 | 549 / 62 |
| 4 | `#reference` | 1 184 / 5 255 | 611 / 2 550 |
| 5 | `#bien-choisir` | 6 439 / 2 155 | 3 161 / 1 263 |
| 6 | `#qualite-prix` | 8 594 / 3 028 | 4 424 / 1 465 |
| 7 | `#emplacement` | 11 622 / 1 278 | 5 889 / 734 |
| 8 | `#faq` | 12 900 / 607 | 6 623 / 454 |
| 9 | Diagnostic | 13 507 / 241 | 7 077 / 250 |
| 10 | `#aller-plus-loin` | 13 748 / 1 819 | 7 326 / 972 |

Avec la variante vidéo, un bloc de 649 px s'insère avant `#faq`.

### Captures

- **Avant :**
  - `captures/avant-isole-{390,1440}-{fold,full}.webp` ;
  - `captures/avant-dev-{390,1440}-{fold,full}.webp` ;
  - `captures/avant-prod-{390,1440}-{fold,full}.webp`.
- **Après :**
  - `captures/apres-isole-{390,1440}-{fold,full}.webp` ;
  - `captures/apres-isole-variante-video-{390,1440}-{fold,full}.webp`.

« fold » = premier écran ; « full » = page entière.

### Mesures

Faute de Lighthouse installable (§Limites), `outils/measure.cjs` reproduit le
profil mobile de Lighthouse : écran 412×823 en DPR 1,75, CPU ×4, RTT 150 ms,
1 638,4 kb/s descendant, 675 kb/s montant, cache désactivé.
- **LCP** : `largest-contentful-paint`.
- **CLS** : fenêtres de session.
- **TBT** : longues tâches entre le FCP et un TTI approché.

Trois passages avant, trois après, sur le même rendu isolé (`mesures/*.json`).

| Passage | Avant LCP / CLS / TBT | Après LCP / CLS / TBT |
|---|---|---|
| 1 | 2 824 / 0 / 2 | 1 732 / 0 / 86 |
| 2 | 2 820 / 0 / 32 | 1 732 / 0 / 88 |
| 3 | 2 848 / 0 / 26 | 1 812 / 0 / 56 |
| **Médiane** | **2 824 / 0 / 26** | **1 732 / 0 / 86** |

- **LCP** : avant, l'élément LCP était l'image du hero. Après, c'est le H1, car
  l'image est sortie du premier écran mobile. Le gain est donc mécanique. L'image
  reste `loading="eager"` et `fetchPriority="high"` alors qu'elle est sous la ligne
  de flottaison en mobile : la piste est signalée au §Propositions, sans être
  modifiée ici.
- **TBT** : +60 ms en médiane, 4 à 5 longues tâches contre 3 à 4 avant. Cela reste
  sous 200 ms. La cause n'est pas isolée. Hypothèse non vérifiée : la section
  motorisations (cartes et images), désormais juste sous le premier écran, est
  rendue plus tôt par `content-visibility: auto`.
- INP non mesuré (aucune interaction scriptée).

### Vérifications

- `npm run typecheck` (frontend) : OK.
- **Tests unitaires** liés à la route R1 : 7 fichiers, 86 tests, tous verts.
  Aucun test ne vise directement `GammeHero` ni `GammeQuickNav`.
  - `pieces-slug-conseils-link-gating`
  - `pieces-slug-substitution-lock-strip`
  - `pieces-substitution-data-suffix`
  - `r1-builders`
  - `r1-images-meta`
  - `sanitize-editorial-html`
  - `url-patterns`
- **Ratchet impeccable** (`design:detect:json` puis
  `scripts/audit/impeccable-ratchet-check.mjs`) : 9 ≤ 9, rien de nouveau.
- **Console** : 0 erreur sur les rendus isolés avant et après, et sur PROD avant.
- **Captures relues** : mobile et desktop, premier écran et page entière.

## 6.5 Titres : propositions pour Marwane (rien n'est écrit)

Le mandat DG (#2201, ouvert) traite les titles et H1 R1 (gabarits G1 à G3, §6.5b de
son rapport) et le H2 « Où se trouve… ». Les propositions ci-dessous s'y
rattachent sans les doubler.

1. **H2 « Qualité, prix et marques » → « Qualité et marques ».** La page R1
   n'affiche aucun prix ; c'est aussi la proposition de #1944 (H2 conditionnel).
   **Libellé lié** : le bouton « Prix & Marques » de la navigation rapide devient
   « Marques ».
2. **H2 « Où se trouve le {gamme} et quand le remplacer »** : il vise une question,
   et son gabarit fait des fautes d'accord (« le pompe », « le colonne »). Relevé
   par DG ; décision groupée avec son point 4.
3. **H1 et title R1** : aucune proposition propre. Ce sont les gabarits G1, G2 et
   G3 de DG. G3 (« prix ») exige de lever l'interdiction de `prix` dans
   `R1_FORBIDDEN_TERMS`, ce qui serait une règle SEO à décider.
4. **Première question de la FAQ** : elle reprend le texte du H2 (« Questions
   fréquentes sur le filtre à huile »). Contenu, hors périmètre ; signalé.

## Retenu et écarté

| Source | Retenu | Écarté | Raison |
|---|---|---|---|
| #1943 | Sélecteur avant l'image sur mobile, diff à l'identique | — | Répond à « achat d'abord » sans changer le desktop |
| #1944 | — | Libellé « Prix & Marques » conditionnel, H2 « Qualité et marques » | Ce sont des changements de texte et de H2 : ils vont à la liste de Marwane (§6.5) |
| #1944 | — | Deux colonnes dans `#emplacement` | Change la mise en page d'un bloc d'entretien sans rapport avec l'ordre ; à juger dans #1944 |
| #1944 | — | Migrations de base | Zone STOP ; hors périmètre |
| #2143 | Le principe (fenêtre de retour lue dans la politique, et non écrite en dur) | Pas de recopie ici | Évite un conflit avec la session qui porte #2143 ; doit passer seule |
| 06 | Diagnostic descendu ; accordéon de FAQ (déjà en place) | — | Même conclusion que cette maquette |
| 06 | — | Sélecteur sur fond navy foncé | Changement visuel du composant partagé, hors ordre des blocs |
| 06 | — | « 4 repères » | Bloc nouveau, aucune donnée réelle confirmée pour le nourrir |
| 06 | — | Barre de chapitres collante | Comportement nouveau ; à mesurer à part (INP, CLS) |
| 06 | — | Retrait de la réassurance et de « Aller plus loin » | La réassurance sert l'achat ; « Aller plus loin » porte les liens par règles (décision 82). Aucune suppression automatique de bloc (P13). |

## Constats hors périmètre (signalés, non corrigés)

- **Le bandeau de réassurance affiche « Livraison 24-48h »**, et le texte de
  `#reference` contient « en stock — livraison rapide » et « avec le prix, la
  disponibilité ». Ces termes sont hors canon R1. Ce sont des textes, donc non
  modifiés.
- **DEV partagé (:3000)**, rendu à 390 px :
  - 504 « Outdated Optimize Dep » sur `react-dom_client.js` et
    `react-router_dom.js` ;
  - échec de l'import dynamique de `entry.client.tsx` : pas d'hydratation ;
  - un avertissement d'attributs non concordants à l'hydratation, à 390 et à
    1440 (`releves/avant-dev-blocs.json`).

  Ni le rendu isolé ni PROD ne montrent ces erreurs. Le cache Vite du DEV semble
  périmé ; le service n'a pas été touché.
- **`design-system/roles/R1-router.md`** décrit une page de listing, en écart avec
  le canon R1. À aligner ou à marquer comme obsolète par décision.

## Complément n° 2 — trois corrections d'apparence (19 nov. 2026)

Source : la revue experte du mandat DU (PR #2211, `REVUE-EXPERTE.md` à
`b44400954`, §4 rangs 1, 3 et 7, §6). Marwane a répondu « Oui » à 20:09 (heure de
Tunis). Aucun titre, H1, texte, URL ni ancre n'est changé. Rien n'est écrit en base
ni en PROD. Preuves : `complement-2-apparence/`.

### Fichiers modifiés

| Fichier | Lignes | Changement |
|---|---|---|
| `frontend/app/components/pieces/MotorisationsSection.tsx` | 49-51 | La couleur par défaut des dégradés décoratifs passe de `from-blue-950` à `from-navy` (jeton). |
| | 91-93 | En-tête : un fond uni `bg-navy` remplace le dégradé. Le reflet animé reçoit `motion-reduce:animate-none`. |
| | 160, 182, 263, 277 | Carte, image, flèche et bouton « autres compatibilités » : `motion-reduce:` neutralise la transition, la translation et l'agrandissement. |
| | 223, 227 | Pastille moteur : `bg-navy`. Pastille puissance : `bg-success text-success-foreground`, à la place du dégradé vert codé en dur. |
| | 260 | Bouton « Voir les pièces » : fond uni `bg-navy` et agrandissement neutralisé en reduced-motion. |
| | 277 | Bouton « Voir les N autres compatibilités » : `bg-navy`. |
| `frontend/app/components/gamme/GammeQuickNav.tsx` | 28, 40 | `min-h-11` (44 px) et survol sans déplacement en reduced-motion. Libellés, ids et `scrollIntoView` sont inchangés. |

Les couleurs viennent de `packages/design-tokens` :
- `navy` = `#0F1E38` ;
- `success` = `#1E8449`, avec `success-foreground` = `#FFFFFF`.

Aucune couleur n'est codée en dur.

Les dégradés décoratifs au survol (bordure, fond de carte) sont gardés. Ils ne
portent pas de texte.

**Portée.** Les deux composants n'ont qu'un consommateur :
`frontend/app/routes/pieces.$slug.tsx`, la route gamme R1.
`MotorisationsSection` est aussi réexporté par `components/pieces/index.ts`, sans
autre import. L'effet touche donc **toutes les pages gamme R1**. La page véhicule
R2 et les autres rôles ne sont pas touchés.

La propriété `familleColor` ne colore plus que les décors au survol. L'unique
appelant ne la passe pas.

### Contraste minimal mesuré sur le texte (WCAG 2.x, seuil 4,5:1)

Méthode (`outils/zone.cjs`) :
1. Le texte est rendu transparent et les animations sont arrêtées.
2. Le fond réel est capturé sous les boîtes du texte.
3. Le contraste est calculé pixel par pixel avec la couleur réelle du texte, alpha
   compris. Le pire pixel est retenu.

Les mesures viennent du même serveur isolé. La donnée est servie en GET par le
DEV.

| Élément | Avant 390 | Avant 1440 | Après 390 | Après 1440 |
|---|---|---|---|---|
| En-tête, phrase d'introduction | 1,64 | 1,85 | 10,15 | 10,58 |
| En-tête, compteur « 5232 motorisations » | 1,55 | 1,42 | 7,01 | 6,98 |
| Pastille moteur (cartes 1 et 2) | 1,48 | 1,50 | 16,63 | 16,63 |
| Pastille puissance (cartes 1 et 2) | 2,44 | 2,44 | 4,72 | 4,72 |
| Bouton « Voir les pièces » (cartes 1 et 2) | 1,70 | 1,71 | 16,63 | 16,63 |
| Bouton « Voir les N autres compatibilités » | 1,65 | 1,15 | 16,63 | 16,63 |

Pourquoi l'avant échouait : le dégradé `from-blue-950` n'avait pas de couleur
d'arrivée. Il finissait donc transparent, et le texte blanc se retrouvait sur un
fond presque blanc.

Le compteur de l'en-tête a un fond blanc translucide sur `navy`. Il passe de 1,42
à 6,98 sans changement propre.

### Cibles tactiles de la navigation rapide

Les 6 boutons ont été mesurés à 390 et à 1440 px :
- **avant** : 37,2 px de haut ;
- **après** : 44 px de haut.

Les largeurs vont de 76 à 140 px et ne changent pas.

Le reste du rang 3 n'est pas fait : des liens `<a href>` à la place des boutons,
et un défilement sans animation en reduced-motion.

### Mouvement, avec et sans `prefers-reduced-motion: reduce` (survol à 1440 px)

| Effet | Avant, reduce | Après, sans préférence | Après, reduce |
|---|---|---|---|
| Reflet de l'en-tête | `shimmer` | `shimmer` | `none` |
| Carte | `translate 0 -4px` | `0 -4px` | `0` |
| Image | `scale 1.1` | `1.1` | `1` |
| Bouton « Voir les pièces » | `scale 1.05` | `1.05` | `1` |
| Flèche | `translate 4px` | `4px` | `0` |
| Navigation rapide | `translate 0 -2px` | `0 -2px` | `0` |

Captures du survol en reduced-motion : `avant-` et
`apres-reduced-motion-survol-1440.webp`.

### Captures de la zone touchée

Dans `complement-2-apparence/`, pour `avant` et pour `apres` :
- navigation rapide : `{avant,apres}-nav-{390,1440}.webp` ;
- cartes véhicule : `{avant,apres}-cartes-{390,1440}.webp` ;
- mesures brutes : `{avant,apres}-zone.json`.

### Vérifications

- `npm run -s typecheck` (frontend) : OK.
- Tests R1, 35/35 réussis :
  - `pieces-slug-conseils-link-gating` ;
  - `pieces-slug-substitution-lock-strip` ;
  - `r1-builders` ;
  - `r1-images-meta`.

  Les deux composants n'ont pas de test unitaire dédié.
- Le build contient `min-h-11`, `.bg-navy` (`#0f1e38`) et `.bg-success`
  (`#1e8449`).
- Contrôle anti-patterns (`design:detect:json`, puis
  `impeccable-ratchet-check.mjs`) : OK, 9 ≤ 9, rien d'ajouté.
  - Un constat touche `MotorisationsSection.tsx:213` : `gradient-text`, le titre
    de carte au survol.
  - Il existait déjà sur `main` et n'est pas modifié ici.
- `check-new-files --base origin/main` : 31 nouveaux fichiers sur 31 conformes.

### Non fait (étapes suivantes, à décider par Marwane)

- Rangs 2, 4, 5, 6, 8, 9 et 10 de la revue.
- Le reste du rang 3 (liens et défilement).
- L'emoji 📅 et la phrase répétée des cartes : ce sont des textes, donc hors
  périmètre.

### Page véhicule, mise de côté

Les modifications de la page véhicule Clio III (complément n° 1) ne sont ni
poussées ni dans #2210. Elles sont sur la branche locale
`wip/ds-complement1-vehicule-clio-iii-19052`, au commit `0d3e629f9`, sans
upstream. On y trouve aussi l'annexe vidéo mise de côté.

## Complément n° 3 — fin des corrections d'accessibilité (19 nov. 2026)

Demande : « oui » de Marwane (19 nov. 2026, 21:45 Paris), sur la revérification
du mandat DU (#2211, tête `86aefbe69` : REVUE-EXPERTE §6 et §12,
REFERENTIEL-EXTERNE §3.F, mesures axe à 390×844). Apparence seulement : aucun
titre, H1, texte, ancre, `id`, donnée structurée, base ni PROD.

### Composants touchés : tous propres à R1

Chaque composant modifié n'est importé que par `routes/pieces.$slug.tsx`
(vérifié par `rg`). `components/pieces/CatalogueSection.tsx` n'est pas celui de
l'accueil, qui importe `components/home/CatalogueSection` (via `~/components/home`).

| Fichier | Changement (classes, sauf le défilement) |
|---|---|
| `components/gamme/GammeHero.tsx` | `motion-reduce:animate-none` sur les deux points `animate-ping` (l. 139 et 229) ; liens du fil d'Ariane en `inline-flex items-center min-h-6` |
| `components/gamme/GammeDiagnosticCTA.tsx` | `motion-reduce:animate-none` sur l'icône (l. 15) ; `motion-reduce:animate-none!` sur le reflet (l. 51) ; badge « 2 min » `text-orange-600` → `text-cta-700` |
| `components/gamme/GammeQuickNav.tsx` | `scrollIntoView` : `behavior: "instant"` si `prefers-reduced-motion: reduce`, sinon `"smooth"` |
| `components/gamme/GammeChecklist.tsx` | sous-texte des étapes `text-slate-400` → `text-neutral-400` |
| `components/pieces/R1SlotImage.tsx` | légende `text-slate-400` → `text-neutral-400` |
| `components/pieces/CatalogueSection.tsx` | ancre des cartes `text-semantic-action` → `text-cta-700` (survol `cta-800`) ; « Lire plus » `text-semantic-action/70` → `text-cta-700` + `inline-flex items-center min-h-6` |
| `routes/pieces.$slug.tsx` | trois liens utiles en `inline-flex items-center min-h-6` ; « Conseils entretien » `text-emerald-600` → `text-success` |

Deux causes trouvées en mesurant, pas en lisant :

- **Reflet** : `styles/animations.css` redéfinit `.animate-shimmer` après la
  feuille Tailwind, donc `motion-reduce:animate-none` perdait. Le modificateur
  `!` de Tailwind v4 (`animation: none !important`, seulement sous
  `prefers-reduced-motion: reduce`) règle le cas sans toucher la feuille globale.
- **Défilement** : le hook global `hooks/useScrollBehavior.ts` (monté par
  `root.tsx`) met `scroll-behavior: smooth` sur `<html>`. `behavior: "auto"`
  restait donc animé ; `"instant"` ne l'est pas. Le hook n'est pas modifié.

### axe 4.12.1 à 390×844, avant (`e31d3babe`) et après

| Règle | Avant | Après |
|---|---|---|
| `color-contrast` | 24 | **9** (tous dans le pied de page et la barre mobile, globaux) |
| `target-size` | 1 | **0** |
| `link-in-text-block` | 1 | 1 (non traité) |
| `region` | 2 | 2 (non traité) |

Fichiers : `complement-3-accessibilite/avant-axe-390x844.json` et
`apres-axe-390x844.json` (tous les nœuds, couleurs, ratio, classes).
`color-contrast` « incomplete » : 18 avant, 18 après. axe ne tranche pas ces
nœuds (fond dégradé ou image), notamment le fil d'Ariane du hero en
`text-white/25` sur navy, qui paraît faible à l'œil. Ils ne font pas partie des
24 et ne sont pas traités ici.

### Contraste : les 24 textes signalés

| Nœuds | Avant | Jeton | Après (calculé) |
|---|---|---|---|
| « Conseils entretien » (12 px) | `#009966` sur `#f8fafc`, 3,49 | `success` `#1E8449` | 4,51 |
| 3 légendes d'image (12 px) | `#90a1b9`, 2,51 à 2,63 | `neutral-400` `#6B7280` | 4,62 à 4,83 |
| 5 sous-textes de « Bien choisir » (10 px) | `#90a1b9` sur `#fcfdfe`, 2,58 | `neutral-400` | 4,75 |
| Badge « 2 min » (10 px) | `#f54900` sur `#fff7ed`, 3,38 | `cta-700` `#C2410C` | ~~4,88~~ **faux** : sans effet au rendu, texte quasi noir (18,8) ; voir le complément n° 4 |
| 4 ancres de « Aller plus loin » (12 px) | `#f97316` sur `#f5f7fa`, 2,61 | `cta-700` | 4,83 |
| « Lire plus » (12 px) | `#f89b5a` sur `#f5f7fa`, 1,99 | `cta-700` | 4,83 |
| **Pied de page, 4 nœuds** | 3,73 ; 2,24 ×2 ; 1,88 (`text-white/40`, `/25`, `/20` sur `#0f1e38`) | non modifié | — |
| **Barre « Navigation mobile », 5 nœuds** | 2,63 ×4 (`#90a1b9`) ; 2,80 (`#f97316`) sur blanc | non modifié | — |

Les 15 nœuds R1 ne sont plus signalés par axe après correction. **Correction
(complément n° 4)** : pour le badge, c'était pour une mauvaise raison. La classe
`text-cta-700` ne s'appliquait pas ; le texte est sorti du signalement parce
qu'il était devenu presque noir, pas parce qu'il était orange foncé. Aucune couleur
n'a été créée et aucune valeur n'est écrite en dur.

**Arrêt sur composant partagé (point 4)** : `components/home/Footer.tsx` (via
`LazyFooter`, sur l'accueil et d'autres routes) et `components/layout/BottomNav.tsx`
(monté par `root.tsx`, sur tout le site) ne sont pas propres à R1. Les corriger
changerait toutes les pages. Ils ne sont pas touchés. Il ne manque pas de jeton :
`neutral-400` (4,83 sur blanc) suffit pour la barre mobile, et les blancs
translucides du pied de page peuvent passer à une teinte `neutral` claire. La
décision revient à la revue du design system (05).

### Cibles tactiles : 10 sous 24 px avant, 4 après

Corrigées (hauteur portée à 24 px, `min-h-6`) :

| Cible | Avant | Après |
|---|---|---|
| Fil d'Ariane « Accueil » | 36×16 | 36×24 |
| Fil d'Ariane « Pièces Auto » | 58×16 | 58×24 |
| « Guide d'achat » | 80×16 | 80×24 |
| « Conseils entretien » | 104×16 | 104×24 |
| « Fiche technique » | 92×16 | 92×24 |
| « Lire plus » (Aller plus loin) | 48×16 | 48×24 |

Restent sous 24 px, non touchées (exceptions de WCAG 2.5.8) :

- lien d'évitement « Aller au contenu principal » (1×1) : masqué (`sr-only`),
  visible seulement au focus ;
- liens dans une phrase : « filtre à air » 63×18 dans `#reference` et dans
  `#bien-choisir`, « En savoir plus sur le filtre à huile » 207×18 dans
  `#emplacement`. Ce sont des liens du contenu (classe `seo-internal-link`).
  L'exception « en ligne » s'applique, et les modifier toucherait le contenu.

Entre 24 et 44 px, listées sans y toucher : champ de recherche 358×40,8 ; deux
liens de `#reference` 344×40,8 et 347×40,8 ; un lien de `#bien-choisir`
299×40,8 ; quatre liens « ressources liées » 284×43,6 ; « CGV » 26×44 (pied de
page) ; « Retour en haut » 24×24. S'y ajoutent les six cibles corrigées
ci-dessus, désormais à 24 px de haut.

### Mouvement, avec `prefers-reduced-motion: reduce`

| Mesure | Avant | Après |
|---|---|---|
| Animations infinies actives (`document.getAnimations()`) | `ping`, `subtle-float`, `shimmer` | aucune |
| Navigation rapide → FAQ, position 60 ms après le clic | 791, fin 12 787 (animé) | 12 805, fin 12 805 (instantané) |

Sans la préférence, les animations et le défilement doux restent inchangés.

### Captures (390 et 1440 px, `reducedMotion: reduce`, animations figées)

`complement-3-accessibilite/{avant,apres}-<zone>-{390,1440}.png`, pour sept zones :
`fil-ariane`, `liens-utiles`, `bien-choisir-legende-et-etapes`,
`qualite-prix-legende`, `emplacement-legende`, `diagnostic-badge-2-min` et
`aller-plus-loin-cartes`.

### Vérifications

- `npm run typecheck` (frontend) : OK.
- vitest : 9 fichiers, 107 tests réussis. Ce sont les 7 fichiers R1 de DU
  (`r1-builders`, `r1-faq`, `r1-section-pack`, `r1-images-meta`, deux tests
  `pieces-slug-*`) et 2 fichiers voisins.
- Anti-patterns : `impeccable ratchet OK — total 9 ≤ baseline 9`.
- `check-new-files --base origin/main` : 44 fichiers ok, 0 échec.

### Non fait

- Rangs 2, 4, 5, 6, 8, 9 et 10 de la revue.
- `link-in-text-block` (lien « Conseils : changer un filtre à huile étape par
  étape », `#reference`) et `region` (« Livraison gratuite dès 150€ »,
  « Retours 30j », hors repère) : hors du complément n° 3.
- Pied de page, barre mobile et hook `useScrollBehavior` : globaux, voir
  ci-dessus.

## Complément n° 4 — quatre contrastes propres à R1 (19 nov. 2026)

Demande : « oui » de Marwane (19 nov. 2026, 22:48 Paris), sur le complément n° 4
du mandat DU (#2211, tête `aef4cda09` : REVUE-EXPERTE §12, REFERENTIEL-EXTERNE
§3.F, scripts de mesure directe). Apparence seulement : aucun titre, H1, texte,
ancre, donnée structurée, base ni PROD. axe classe ces quatre points en
« incomplete » ; ils sont donc mesurés sur les pixels rendus.

### Correction de l'erreur du complément n° 3 (badge « 2 min »)

J'avais annoncé 4,88:1. Ce chiffre était **calculé** à partir des jetons
(`cta-700` `#C2410C` sur `#fff7ed`), pas mesuré sur le rendu. Au rendu, le
texte était `#020817`, presque noir (18,8:1). Cause : le composant partagé
`components/ui/badge.tsx` ajoute les classes à la suite sans les fusionner. Sa
variante `outline` impose `text-foreground`, qui l'emportait sur `text-cta-700`
dans la feuille générée. Le badge a quitté la liste d'axe parce qu'il était devenu
presque noir. J'ai pris « plus de violation » pour « classe appliquée », sans
vérifier la couleur calculée.

### Causes et corrections (trois fichiers, tous propres à R1)

| Point | Cause trouvée | Correction |
|---|---|---|
| 1. Fil d'Ariane (`GammeHero.tsx`) | La règle globale `nav a` de `global.css` (`@layer components`) impose `text-secondary-600` (`#0D4473`) au lien, qui n'héritait donc pas de `text-white/25` | `text-neutral-300` sur le lien : une classe utilitaire passe après `@layer components`, sans `!`. `no-visited` est l'exception déjà prévue par la règle globale `a:visited` (violet sur navy une fois le lien visité). Survol `hover:text-white` |
| 2. Onglet « Type Mine » (`GammeHero.tsx`) | `text-slate-500` (palette Tailwind, hors jetons) sur `bg-slate-100` | `text-neutral-500`, survol `neutral-800` |
| 3. Badge « 2 min » (`GammeDiagnosticCTA.tsx`) | Voir ci-dessus. Retour à la ligne à 390 px : le badge rétrécissait dans sa rangée flexible | La couleur passe sur un `span` interne (`text-cta-700`), que la variante ne peut pas écraser. `whitespace-nowrap` sur le badge. Fond et bord sur les jetons de même valeur (`bg-cta-50`, `border-cta-200`) |
| 4. Bande sous le hero, 1440 px (`routes/pieces.$slug.tsx`) | L'ombre de la carte du sélecteur (`shadow-[0_24px_80px_…]`, positionnée) est peinte au-dessus de la bande, qui ne l'est pas | `relative` sur la bande : elle est peinte après la carte et recouvre l'ombre. Pas de `z-index` (l'en-tête collant garde le sien). Pas de ligne de coupure visible : `apres-contexte-bande-1440.png` |

Les composants partagés ne sont pas touchés : `global.css` (`nav a`), `ui/badge.tsx`
et l'en-tête. Tous les jetons employés existent : il n'en manque aucun.

### Mesure directe au pixel, avant (`34bdc1eb3`) et après

Méthode de DU, reprise dans `outils/contraste-c4.cjs`. Pour chaque texte : couleur
calculée composée sur chaque fond qui couvre plus de 3 % de son cadre, et on garde
le pire. Réglages : DPR 2, `reducedMotion: reduce`. Les valeurs avant sont celles de DU
(`mesures/c4-34bd-hero-pixel.txt` dans #2211). Les scripts de DU relancés sur
l'après donnent les mêmes chiffres (`apres-scripts-du.txt`).

| Zone | 390 avant | 390 après | 1440 avant | 1440 après |
|---|---|---|---|---|
| Fil d'Ariane « Accueil », « Pièces Auto » | 1,64 ✗ | **6,47** | 1,61 ✗ | **6,38** |
| Onglet « Type Mine » (inactif) | 12,0 (onglet mobile, autre style) | 12,0 | 4,35 ✗ | **6,90** |
| Badge « 2 min » : couleur rendue | `#020817`, 18,84, **2 lignes** | `#C2410C`, **4,88, 1 ligne** | `#020817`, 18,84 | `#C2410C`, **4,88** |
| Bande : « Conseils entretien » | 4,51 | 4,51 | 3,98 ✗ | **4,51** |
| Bande : « Paiement sécurisé » | 4,55 | 4,55 | 4,02 ✗ | **4,55** |
| Bande : « Retours 30 jours » | 4,55 | 4,55 | 4,28 ✗ | **4,55** |
| Bande : « Guide d'achat » | 5,01 | 5,01 | 4,43 ✗ | **5,01** |

Détail par texte : `complement-4-contrastes/{avant,apres}-contraste.json`. À
1440 px, la bande retrouve un fond uni `#f8fafc`. « Conseils entretien » reste
à 4,51, juste au-dessus du seuil.

### axe 4.12.1 à 390×844

Mêmes résultats qu'après le complément n° 3 : `color-contrast` 9 (pied de page et
barre mobile, globaux), `link-in-text-block` 1, `region` 2. Aucun nœud nouveau
(comparaison nœud à nœud). Cibles et mouvement inchangés : 4 cibles sous 24 px,
toutes des exceptions ; aucune boucle avec reduced-motion ; défilement
instantané. Fichier : `complement-4-contrastes/apres-axe-390x844.json`.

### Captures

`complement-4-contrastes/{avant,apres}-<zone>-{390,1440}.png` pour `fil-ariane`,
`onglet-type-mine`, `badge-2-min` et `bande-sous-hero`, plus
`apres-contexte-bande-1440.png`.

### Vérifications

- `npm run typecheck` (frontend) : OK.
- vitest : les mêmes 9 fichiers, 107 tests réussis.
- Anti-patterns : `impeccable ratchet OK — total 9 ≤ baseline 9`.

### Non fait, signalé

- Badge « GRATUIT » : même cause que « 2 min ». `text-emerald-700` ne s'applique
  pas et le texte est rendu presque noir (18,99, conforme). Il n'est pas dans les
  quatre points.
- Pour la revue du design system (05) :
  - `ui/badge.tsx` ne fusionne pas les classes. Toute couleur passée en
    `className` à un `Badge` dont la variante fixe une couleur peut rester sans
    effet.
  - La règle globale `nav a` colore en `secondary-600` les liens de toute `nav`,
    y compris sur fond sombre.
- Échecs encore mesurés dans le hero à 390 px par le script de DU, déjà présents
  avant et hors des quatre points :
  - étapes du sélecteur véhicule partagé (« Année », « Modèle », « Motorisation » :
    2,63) ;
  - bouton « Rechercher des pièces » (2,68) ;
  - onglet actif « Véhicule » (1,12 selon ce script, 20,16 sur son fond blanc
    selon `contraste-c4.cjs`).

## Complément n° 5 — phrase des cartes véhicule issue du switch (19 nov. 2026)

> Retiré par le complément n° 10 (20 nov. 2026) : la phrase est remplacée par une ligne de faits,
> et la variante R1 du builder, son test et la clé de cache `v3` sont rétablis à l'état de la base.

Demande de Marwane (19 nov., 23:01) : remplacer la phrase identique des cartes
véhicule R1 (« Sélectionnez cette motorisation pour afficher les références
compatibles. », écrite en dur depuis `d604631c2`) par le système de switch
existant, sans nouveau système ni texte écrit en dur.

### Le switch existant et ce qu'il prévoit pour les cartes

- La table `__seo_item_switch` est la famille « R1 catalogue gamme × véhicule »
  (`seo-variant-family.registry.ts`). Ses alias sont définis dans
  `seo-switch-aliases.config.ts` :
  - 1 = action (entretien, signes d'usure) ;
  - 2 = bénéfice ;
  - 3 = variation.
- `get_gamme_page_data_optimized(pg)` renvoie les fragments de la gamme
  (`seo_fragments_1` = alias 1, `seo_fragments_2` = alias 2).
  `GammeRpcService.getSeoFragmentsByTypeId` choisit un fragment par `type_id`
  (hachage tournant). C'est ce qui varie d'une carte à l'autre.
- `gamme-response-builder.service.ts` construisait déjà une `description` par
  carte à partir de ces fragments. Elle était masquée en R1 parce que ses gabarits
  violaient le rôle :
  - « Achetez … » par défaut ;
  - « avant montage » ou « avant installation » sur 9 cartes de pg 7 et 6 de pg 402 ;
  - intervalles d'entretien ;
  - fragments d'alias 1 rédigés en signes d'usure ;
  - fautes : « Assurer purifier l'huile les filtre à huile … ».

### Périmètre : R1 seulement

- `GammeResponseBuilderService` n'est utilisé que par
  `GET /api/gamme-rest/:pgId/page-data-rpc-v2`.
- Ce point d'accès n'est lu que par la page gamme R1 (`pieces.$slug.tsx`) et par
  `admin.r1-qa.tsx`, qui ne lit pas les motorisations.
- `MotorisationsSection` n'est rendu que sur la page R1.
- La page véhicule (R2) et les autres pages ne sont pas touchées.

### Ce qui change

1. **Builder** : le gabarit de la description est corrigé à sa source, dans la
   méthode `buildR1MotorisationDescription`.
   - Forme de la phrase : « {gamme} compatible {modèle motorisation puissance},
     pour {bénéfice}. »
   - Le bénéfice est un fragment **alias 2** du switch, choisi par le même
     `getSeoFragmentsByTypeId`.
   - Un fragment est écarté s'il est trop court, mal formé (deux infinitifs
     collés, fin sur « de », « par »…) ou refusé par les lexiques R1 existants :
     - `PageRoleValidatorService.validateR1Router` ;
     - `getForbiddenOverlap(R1_ROUTER)` de `@repo/seo-roles`.
   - Les fragments écartés sont journalisés (warn, avec leur `sis_id`).
   - S'il ne reste aucun fragment, la description est vide.
   - Aucune constante métier ni lexique nouveau.
2. **Carte** (`MotorisationsSection.tsx`) : en R1, la carte affiche la
   `description` du backend.
   - Si elle est vide, la carte n'a pas de phrase (aucun remplissage).
   - Le rendu hors R1 est inchangé.
3. **Cache de réponse** : la clé passe de `gamme:resp:v2` à `gamme:resp:v3`
   (`gamme-rpc.service.ts`).
   - Pourquoi : sans ce changement, une réponse v2 encore en cache (TTL 1 h)
     afficherait l'ancien gabarit dans la nouvelle carte. Les captures
     `front-seul-*` montrent ce rendu : front après, réponse du DEV sur main.
   - Le cache RPC `gamme:rpc:v2` et le préchauffage ne changent pas.
   - La route d'invalidation admin utilise la même fonction.
   - Seul effet : la réponse est recalculée une fois par gamme.

Titre, H1, meta, ancres, données structurées, base : inchangés.

### Preuve de variété : pg 7 « Filtre à huile » (19 cartes)

Avant : 1 phrase distincte, identique sur les 19 cartes.
Après : 19 phrases distinctes, aucune n'apparaît plus d'une fois.

| n° | Carte | Avant (servi) | Après (servi) |
|---|---|---|---|
| 1 | RENAULT CLIO III 1.5 dCi | « Sélectionnez… » (identique) | Filtre à huile compatible CLIO III 1.5 dCi 86 ch, pour purifier l'huile. |
| 2 | PEUGEOT 206 1.4 HDI | « Sélectionnez… » (identique) | Filtre à huile compatible 206 1.4 HDI 69 ch, pour retenir les particules. |
| 3 | AUDI A3 II 2.0 TDI | « Sélectionnez… » (identique) | Filtre à huile compatible A3 II 2.0 TDI 140 ch, pour optimiser les performances. |
| 4 | ALFA ROMEO 159 1.9 JTDM 8V | « Sélectionnez… » (identique) | Filtre à huile compatible 159 1.9 JTDM 8V 120 ch, pour retenir les particules. |
| 5 | FORD FIESTA V 1.4 TDCI | « Sélectionnez… » (identique) | Filtre à huile compatible FIESTA V 1.4 TDCI 68 ch, pour retenir les particules. |
| 6 | FIAT 500 1.2 | « Sélectionnez… » (identique) | Filtre à huile compatible 500 1.2 69 ch, pour préserver le véhicule. |
| 7 | OPEL CORSA C 1.3 CDTI | « Sélectionnez… » (identique) | Filtre à huile compatible CORSA C 1.3 CDTI 70 ch, pour protéger le moteur. |
| 8 | SEAT IBIZA III 1.4 TDI | « Sélectionnez… » (identique) | Filtre à huile compatible IBIZA III 1.4 TDI 75 ch, pour purifier l'huile. |
| 9 | JEEP CHEROKEE III 2.8 CRD 4x4 | « Sélectionnez… » (identique) | Filtre à huile compatible CHEROKEE III 2.8 CRD 4x4 163 ch, pour protéger le moteur. |
| 10 | DACIA SANDERO I 1.5 dCi | « Sélectionnez… » (identique) | Filtre à huile compatible SANDERO I 1.5 dCi 68 ch, pour protéger le moteur. |
| 11 | BMW Série 3 (E46) 320 d | « Sélectionnez… » (identique) | Filtre à huile compatible Série 3 (E46) 320 d 150 ch, pour maintenir en bon état. |
| 12 | NISSAN QASHQAI+2 (J10) 1.6 dCi | « Sélectionnez… » (identique) | Filtre à huile compatible QASHQAI+2 (J10) 1.6 dCi 130 ch, pour améliorer la fiabilité. |
| 13 | VOLKSWAGEN TOURAN I 1.9 TDI | « Sélectionnez… » (identique) | Filtre à huile compatible TOURAN I 1.9 TDI 105 ch, pour améliorer la fiabilité. |
| 14 | TOYOTA YARIS II 1.4 D4-D | « Sélectionnez… » (identique) | Filtre à huile compatible YARIS II 1.4 D4-D 90 ch, pour protéger le moteur. |
| 15 | MERCEDES CLASSE C (W204) 200 CDI (204.001) | « Sélectionnez… » (identique) | Filtre à huile compatible CLASSE C (W204) 200 CDI (204.001) 136 ch, pour protéger le moteur. |
| 16 | SUZUKI SWIFT IV 1.3 DDIS | « Sélectionnez… » (identique) | Filtre à huile compatible SWIFT IV 1.3 DDIS 75 ch, pour maintenir en bon état. |
| 17 | MAZDA 3 II 1.6 MZR CD | « Sélectionnez… » (identique) | Filtre à huile compatible 3 II 1.6 MZR CD 109 ch, pour retenir les particules. |
| 18 | HONDA CIVIC IX 2.2 DTEC | « Sélectionnez… » (identique) | Filtre à huile compatible CIVIC IX 2.2 DTEC 150 ch, pour protéger le moteur. |
| 19 | KIA PICANTO II 1.2 | « Sélectionnez… » (identique) | Filtre à huile compatible PICANTO II 1.2 85 ch, pour purifier l'huile. |

Usage des bénéfices :
- protéger le moteur : 6 ;
- retenir les particules : 4 ;
- purifier l'huile : 3 ;
- maintenir en bon état : 2 ;
- améliorer la fiabilité : 2 ;
- optimiser les performances : 1 ;
- préserver le véhicule : 1.

Fragments alias 2 écartés : 10185, 10186.

### Preuve de variété : pg 402 « Plaquette de frein » (17 cartes)

Avant : 1 phrase distincte, identique sur les 17 cartes.
Après : 17 phrases distinctes, aucune n'apparaît plus d'une fois.

| n° | Carte | Avant (servi) | Après (servi) |
|---|---|---|---|
| 1 | RENAULT MEGANE III 1.5 dCi | « Sélectionnez… » (identique) | Plaquette de frein compatible MEGANE III 1.5 dCi 95 ch, pour préserver le véhicule. |
| 2 | CITROËN BERLINGO II - BERLINGO MULTISPACE (B9) 1.6 HDi-BlueHDi | « Sélectionnez… » (identique) | Plaquette de frein compatible BERLINGO II - BERLINGO MULTISPACE (B9) 1.6 HDi-BlueHDi 75 ch, pour optimiser les performances. |
| 3 | RENAULT CLIO II 1.5 dCi | « Sélectionnez… » (identique) | Plaquette de frein compatible CLIO II 1.5 dCi 65 ch, pour garantir la sécurité. |
| 4 | RENAULT CLIO II 1.5 dCi CAMPUS | « Sélectionnez… » (identique) | Plaquette de frein compatible CLIO II 1.5 dCi CAMPUS 84 ch, pour dissiper l'énergie. |
| 5 | PEUGEOT 307 1.6 HDI | « Sélectionnez… » (identique) | Plaquette de frein compatible 307 1.6 HDI 90 ch, pour prolonger la durée de vie. |
| 6 | PEUGEOT 307 1.6 HDI | « Sélectionnez… » (identique) | Plaquette de frein compatible 307 1.6 HDI 109 ch, pour maintenir en bon état. |
| 7 | PEUGEOT 307 2.0 HDI | « Sélectionnez… » (identique) | Plaquette de frein compatible 307 2.0 HDI 90 ch, pour améliorer la fiabilité. |
| 8 | AUDI A4 III B7 1.9 TDI | « Sélectionnez… » (identique) | Plaquette de frein compatible A4 III B7 1.9 TDI 116 ch, pour préserver le véhicule. |
| 9 | AUDI A4 III B7 2.0 TDI | « Sélectionnez… » (identique) | Plaquette de frein compatible A4 III B7 2.0 TDI 121 ch, pour prolonger la durée de vie. |
| 10 | AUDI A4 III B7 2.0 TDI | « Sélectionnez… » (identique) | Plaquette de frein compatible A4 III B7 2.0 TDI 126 ch, pour garantir la sécurité. |
| 11 | VOLKSWAGEN GOLF IV 1.9 TDI | « Sélectionnez… » (identique) | Plaquette de frein compatible GOLF IV 1.9 TDI 90 ch, pour préserver le véhicule. |
| 12 | VOLKSWAGEN GOLF IV 1.9 TDI | « Sélectionnez… » (identique) | Plaquette de frein compatible GOLF IV 1.9 TDI 110 ch, pour préserver le véhicule. |
| 13 | VOLKSWAGEN GOLF IV 1.9 TDI | « Sélectionnez… » (identique) | Plaquette de frein compatible GOLF IV 1.9 TDI 115 ch, pour améliorer la fiabilité. |
| 14 | BMW Série 1 (E81) 116 d | « Sélectionnez… » (identique) | Plaquette de frein compatible Série 1 (E81) 116 d 90 ch, pour optimiser les performances. |
| 15 | BMW Série 1 (E81) 116 d | « Sélectionnez… » (identique) | Plaquette de frein compatible Série 1 (E81) 116 d 116 ch, pour maintenir en bon état. |
| 16 | BMW Série 1 (E81) 118 d | « Sélectionnez… » (identique) | Plaquette de frein compatible Série 1 (E81) 118 d 136 ch, pour ralentir le véhicule. |
| 17 | HONDA CIVIC IX 1.6 DTEC | « Sélectionnez… » (identique) | Plaquette de frein compatible CIVIC IX 1.6 DTEC 120 ch, pour ralentir le véhicule. |

Usage des bénéfices :
- préserver le véhicule : 4 ;
- optimiser, garantir la sécurité, prolonger la durée de vie, maintenir,
  améliorer, ralentir : 2 chacun ;
- dissiper l'énergie : 1.

Fragments écartés : 10559, 10684.

### Contrôle R1 sur le rendu

Le validateur est passé sur le texte réellement affiché dans chaque carte (titre
et phrase), relevé par Playwright à 390 px (`outils/valide-rendu-c5.ts`). Il
applique :
- `validateR1Router` ;
- le canon `getForbiddenOverlap(R1_ROUTER)` ;
- les mots du mandat (prix, achat, achetez, stock, livraison, promo, pas cher, €),
  plus montage et installation.

Sortie (`complement-5-switch/validateur-r1-rendu.txt`) :

```
avant-pg7    cartes=19 distinctes=1 répétitionMax=19 violationsValidateur+canon+mandat=0 gateFront=[]
apres-pg7    cartes=19 distinctes=19 répétitionMax=1 violationsValidateur+canon+mandat=0 gateFront=[]
avant-pg402  cartes=17 distinctes=1 répétitionMax=17 violationsValidateur+canon+mandat=0 gateFront=[]
apres-pg402  cartes=17 distinctes=17 répétitionMax=1 violationsValidateur+canon+mandat=0 gateFront=[5,9]
```

- Zéro mot interdit sur les 36 cartes après.
- **Signalé, non corrigé** : la garde front `r1-copy-gate` (`isR3R5Content`,
  utilisée par `CatalogueSection`) classe « prolonger la durée de vie »
  (pg 402, cartes 5 et 9) comme contenu R3/R5. Les deux lexiques du backend
  l'acceptent : les lexiques divergent.
  - La correction n'a pas été faite par un filtre dans le composant (interdit
    par le mandat). Elle relève de l'unification des lexiques.
- **Écart de lexique** : achat, achetez, stock, promo, « pas cher » et « € » ne
  figurent dans aucun des deux lexiques du backend. Ils sont vérifiés par le
  nouveau test, mais le builder ne les refuse pas tant que le canon ne les
  contient pas.

Captures à 390 px (`complement-5-switch/`) :
- `{avant,apres}-pg{7,402}-cartes-390.png` : section entière, toutes les cartes
  après « Voir les N autres compatibilités » ;
- `*-cartes-1a3-390.png` : trois premières cartes ;
- `vide-pg7-cartes-1a3-390.png` : description vide, carte sans phrase.

Les relevés JSON sont à côté. `calcul-phrases-pg7-pg402.json` contient le calcul,
l'ancienne description masquée et le contrôle carte par carte.

**Méthode du rendu après** : le service DEV partagé tourne sur main ; il ne doit
être ni redémarré ni doublé (un backend isolé partagerait son Redis). Le proxy de
mesure `outils/proxy-c5.mjs` (GET seulement) remplace donc dans la réponse
`page-data-rpc-v2` de pg 7 et pg 402 les seuls champs `description` et
`content` des motorisations. Il y met la phrase calculée par la méthode du
builder patché (`outils/calcul-c5.ts`). Le texte rendu est identique au calcul
sur les 36 cartes.

### Vérifications

- Typecheck backend et frontend : OK.
- ESLint (fichiers source touchés) : OK. Deux fichiers de `backend/tests/unit/`
  ne sont dans aucun projet du lint ; c'est déjà le cas sur main.
- Jest :
  - nouveau test `gamme-response-builder-r1-motorisation-description.test.ts`
    (données réelles de pg 7 et pg 402) : 11 tests ; il vérifie une phrase du
    switch par carte, au plus 2 répétitions, le validateur R1 et les mots du
    mandat ;
  - suites du builder et de `gamme-rest`, invalidation du cache : 7 suites,
    67 tests ;
  - `page-role-validator.test.ts` : 50 tests.
- vitest R1 : 9 fichiers, 107 tests réussis.

### Fragments en base à revoir (pour le 06, rien n'a été écrit)

- pg 7, alias 2 :
  - 10185 « garantir filtrer les impuretés de » ;
  - 10186 « assurer purifier l'huile ».
- pg 402, alias 2 :
  - 10559 « assurer ralentir le véhicule » ;
  - 10684 « garantir assurer le freinage par ».
- Alias 2, toutes gammes : 1 000 lignes sur 101 gammes, dont 206 mal formées.
  9 lignes touchent le lexique R1, par exemple :
  - « absorber les vibrations » ;
  - « prévenir du danger » ;
  - « garantir réduire le bruit d'échappement ».

  Les occurrences de « stocker » sont de faux positifs.
- pg 7, alias 1 (3153–3178) : rédigé en signes d'usure et en entretien ;
  3172–3178 répètent 3165–3171. pg 402, alias 1 : signes d'usure.

### Autres contenus R1 qui répètent du texte (signalés, non corrigés)

- Le bénéfice se répète d'une carte à l'autre (jusqu'à 6 fois sur pg 7), même si
  les phrases entières sont toutes distinctes. Cela vient du nombre de fragments
  admis et de la répartition du hachage existant.
- Les champs `title` et `advice` des motorisations reposent toujours sur
  l'alias 1 ; ils sont servis par l'API mais non affichés en R1.
  `seoSwitches.verbs` est exposé mais ignoré en R1.
- « Aller plus loin » (`CatalogueSection`, R1) : ce bloc n'utilise **pas** le
  switch. Ses ancres tournent sur 4 textes écrits en dur (`R1_ANCHORS`), dont
  « Voir les prix », qui contient « prix ».
  - Hors switch, `MICRO_DESC_MAP` sert de description de repli.
- Bloc micro-SEO (`R1ReusableContent`) : son texte vient de
  `r1s_micro_seo_block` (créneaux R1), pas du switch.
- `seo_fragments_3` (alias 3, pg 0) n'est pas utilisé par les cartes.

### Complément n° 6 — bouton « Lancer le diagnostic » : texte noir sur l'orange cta, bouton sorti du lien (20 nov. 2026)

Mandat : variante B validée par Marwane le 20 nov. 2026 à 01:06 (Paris), sur le constat de DU
(§14 de sa revue, #2211, `760532502`). Tête de #2210 relevée avant travail : `06feff968`.

**Ce qui change**, dans `frontend/app/components/gamme/GammeDiagnosticCTA.tsx` seulement :

- couleurs du bouton de l'accueil (`home/DiagnosticBanner.tsx`) : `bg-cta`, `text-black`,
  `hover:bg-cta-hover`. Ce sont des jetons de `packages/design-tokens/src/tokens.json`
  (`cta` = `#F97316`, `cta.hover` = `#EA580C`) ; le noir est `text-black`, comme à l'accueil ;
- l'ombre `shadow-orange-500/25` (orange par défaut de Tailwind 4) devient `shadow-cta/25` ;
- le `<button>` placé dans le `<Link>` est retiré : le lien est stylé en bouton. Même lien
  `/diagnostic-auto`, même texte, même icône, même taille, mêmes classes de forme ;
- reflet `animate-shimmer` gardé (voir mesures), toujours coupé en mouvement réduit.

Hors périmètre, non touchés : la pastille de l'en-tête (dégradé `orange-500` → `orange-600`),
les quatre autres fichiers à ce même dégradé (revue du design system par le 05), les composants
partagés, la place du bouton, le reste de la page.

**Mesures au pixel** (`outils/diag-c6.cjs`, méthode de DU : texte et icône rendus transparents,
pire pixel de fond dans leur boîte avec 1 px de marge, échelle 1, mouvement non réduit, reflet figé
à 24 positions, rapports tronqués au centième). Seuil texte 4,5:1 (15 et 14 px gras).

| Mesure | Avant 390 | Avant 1440 | Après 390 | Après 1440 |
|---|---|---|---|---|
| Couleur du texte | `#ffffff` | `#ffffff` | `#000000` | `#000000` |
| Bout gauche du bouton | 2,90 | 2,88 | 7,49 | 7,49 |
| Bout droit du bouton | 3,54 | 3,56 | 7,49 | 7,49 |
| Fond sous le texte, sans reflet | 3,03 | 3,11 | 7,49 | 7,49 |
| Fond sous le texte, pire passage du reflet | **2,75** | 2,82 | **7,40** | 7,40 |
| Icône du bouton, pire position | 2,70 | 2,83 | 7,40 | 7,45 |
| Survol, sans reflet | — | 3,11 | — | 5,89 |
| Survol, pire passage du reflet | — | 2,82 | — | 5,83 |
| Icône blanche sur la pastille de l'en-tête (seuil 3:1) | 3,01 | 3,01 | 3,01 | 3,01 |
| Élément cliquable | `<button>` 332×56 dans `<a>` | 1182×54 | `<a>` seul 332×56 | `<a>` seul 1182×54 |
| Éléments interactifs dans le lien | 1 | 1 | 0 | 0 |

Les mesures « avant » reproduisent celles de DU (2,75 à 390 px). Le survol se mesure à 1440 px
seulement : il n'y a pas de survol au toucher.

**Reflet.** Gardé : le pire rapport mesuré à son passage est 7,40:1, au-dessus de 4,5:1. Le reflet
est un voile blanc ; sur fond clair et texte noir il éclaircit le fond, donc il ne peut pas faire
baisser le contraste sous celui du fond nu (les 0,09 point d'écart viennent du lissage des bords
du dégradé). `motion-reduce:animate-none!` est inchangé.

**axe-core** (`outils/axe-c6.cjs`, règles WCAG 2.0 à 2.2 A et AA et bonnes pratiques, page entière
et carte, 390 et 1440 px) :

- page entière : violations identiques avant et après (même liste de règles, de nœuds et de
  cibles) ; aucune ne vient de la carte ;
- carte : aucune violation avant ni après. Avant, axe classait le contraste du bouton en
  « incomplete » (fond en dégradé) ; après, rien n'est en suspens.

**Vérifications** : typecheck du frontend OK ; ESLint et Prettier OK sur les deux fichiers ;
nouveau test `frontend/tests/unit/gamme-diagnostic-cta-contrast.test.tsx` (un seul élément
interactif vers `/diagnostic-auto`, jetons `bg-cta`, `hover:bg-cta-hover`, `text-black`, plus de
`text-white` ni d'orange par défaut) : 2 tests passent.

**Rendu.** Build du worktree servi par `react-router-serve` (:3018) derrière `outils/img-proxy.mjs`
(:3017), loaders en GET sur le DEV partagé. « Avant » = build de `06feff968` ; pour axe « avant »,
le composant de `06feff968` a été remis le temps d'un build, puis la version corrigée reconstruite.
Le service DEV n'a été ni redémarré ni modifié. Rien n'est servi en DEV, PREPROD ou PROD.

**Fichiers** (`complement-6/`) : `{avant,apres}-carte-390.png`, `{avant,apres}-carte-1440.png`,
`{avant,apres}-carte-1440-survol.png`, `{avant,apres}-mesures.json` (24 positions du reflet
comprises), `{avant,apres}-axe.json`.

## Complément n° 7 — bouton « Lancer le diagnostic » : texte noir après visite (20 nov. 2026)

Mandat : fin de la variante B (validée par Marwane le 20 nov. 2026 à 01:06, Paris), sur le constat
de DU (§15.4 de sa revue, #2211, `648222c1c`). Tête de #2210 relevée avant travail : `06dcea7bc`.

**Cause.** `frontend/app/global.css` applique `text-purple-600` à `a:visited:not(.no-visited)`, plus
spécifique que `text-black`. Depuis le complément n° 6, le libellé est porté par le lien lui-même :
une fois `/diagnostic-auto` visité, le texte et l'icône passent au violet sur l'orange.

**Correction.** Ajout de la classe `no-visited` au lien de `GammeDiagnosticCTA.tsx`, rien d'autre
dans ce fichier. C'est la convention du site, déjà employée ailleurs. La règle globale `a:visited` et
les styles partagés ne sont pas touchés. Le test `gamme-diagnostic-cta-contrast.test.tsx` vérifie la
présence de la classe : sans elle, il échoue (`complement-7/vitest-sans-no-visited.txt`, 1 échec
sur 3) ; avec elle, 3 tests passent (`vitest-apres.txt`).

**Mesure** (`outils/visite-c7.cjs`, méthode de DU, `scripts/visite2-du7.cjs` de #2211, complétée par
le survol) :
- Chrome 153 complet, profil persistant temporaire, donc historique réel. Le Chromium réduit de
  Playwright n'applique pas `:visited` ;
- page R1 chargée, mesure, clic sur le bouton (navigation vers `/diagnostic-auto`), page R1
  rechargée, mesure ; au repos puis pointeur sur le lien ;
- rapport = pixel du texte le plus éloigné du fond dominant, contre ce fond, tronqué au centième ;
- lien témoin sans classe de couleur vers `/diagnostic-auto` : il passe au violet `#9810fa` après la
  visite, preuve que l'état « visité » est actif ;
- échelle 1, mouvement réduit (reflet arrêté), comme DU. Seuil 4,5:1.

| Mesure | Sans `no-visited` 390 | Sans 1440 | Avec `no-visited` 390 | Avec 1440 |
|---|---|---|---|---|
| Avant visite, repos | 7,34 | 6,89 | 7,34 | 6,89 |
| Avant visite, survol | 5,85 | 5,55 | 5,85 | 5,55 |
| **Après visite, repos** | **2,00** (`#9d1df9`) | **1,98** (`#a128f9`) | **7,34** (`#0e0e0e`) | **6,89** (`#1a1a1a`) |
| **Après visite, survol** | **1,60** | **1,60** | **5,85** | **5,55** |
| Témoin après visite | `#9810fa` | `#9810fa` | `#9810fa` | `#9810fa` |

Les rapports sont lus sur les pixels du texte, lissage compris. Ils ne se comparent donc pas aux
7,49:1 du complément n° 6, mesurés sur le fond seul. Les chiffres « sans » reproduisent ceux de DU
(2,00 et 1,98).

**Vérifications** : typecheck du frontend OK (`typecheck-front.txt`) ; ESLint et Prettier OK sur
les deux fichiers.

**Rendu.** Build du worktree servi par `react-router-serve` (:3018) derrière `outils/img-proxy.mjs`
(:3017), loaders en GET sur le DEV partagé ; « sans » = build de `06dcea7bc`, « avec » = build après
correction. Le service DEV n'a été ni redémarré ni modifié. Rien n'est servi en DEV, PREPROD ou PROD.

**Fichiers** (`complement-7/`) : `{sans,avec}-no-visited-{390,1440}.json` et leurs captures du
libellé `…-{avant,apres}-visite-{repos,survol}.png`.

Hors périmètre : le lien « Conseils : changer un filtre à huile étape par étape » (décision de
Marwane en attente), le reste de la page.

## Complément n° 8 — lien « Conseils » souligné au repos (20 nov. 2026)

Mandat : critère WCAG 1.4.1 (information portée par la seule couleur). Marwane a validé le
soulignement le 20 nov. 2026 à 09:12, heure de Paris. Constat de DU : axe `link-in-text-block`
(#2211). Tête de #2210 relevée avant travail : `f1dbcf285`.

**Où est rendu le lien.** Aucun composant ne porte ce lien. Son texte vient du HTML éditorial de la
gamme : `editorialBlocks.referenceSection`, découpé par `app/utils/editorial-parser.ts`. Ce HTML est
injecté dans le `div.gamme-editorial` de la section `#reference` de `app/routes/pieces.$slug.tsx`.
Cette route ne sert que `/pieces/:slug`, c'est-à-dire les pages R1. La correction s'applique donc au
bloc éditorial `#reference` de toutes les pages R1, puisqu'elles partagent ce gabarit, et à aucune
autre route.

La classe `.gamme-editorial` (`global.css`, lignes 253 à 290) est partagée. Elle sert aussi les trois
autres blocs éditoriaux de la route et `GammeContent.tsx`. Elle n'est pas modifiée.

**Avant.** Le lien était en `#155dfc` et le texte voisin en `#45556c`, soit 1,44:1 entre les deux
couleurs (il faudrait 3:1 pour se passer d'un autre signe). Aucun soulignement au repos, à 390 comme
à 1440 px. Le soulignement n'apparaissait qu'au survol, à la souris, absent sur un écran tactile. La
couleur était donc le seul signe aux deux largeurs : le lien est souligné aux deux largeurs.

**Correction.** Ajout de `[&_a]:underline [&_a]:underline-offset-2` sur ce seul conteneur.
- Ce sont des utilitaires Tailwind existants, avec la syntaxe déjà employée par
  `R6FaqAccordion.tsx:49`.
- Le décalage de 2 px est celui de `.seo-internal-link`. Les deux liens `seo-internal-link` du même
  paragraphe étaient déjà soulignés avec ce décalage : leur rendu ne change pas, et leur
  soulignement atténué est conservé (captures).
- Le texte, la cible et la couleur ne changent pas.
- La règle globale des liens, `a:visited` et les styles partagés ne sont pas touchés.

**Mesures.** Outils `outils/lien-c8.cjs` (Chromium Playwright, mouvement réduit) et
`outils/visite-lien-c8.cjs` (méthode du complément n° 7 : Chrome 153 complet, profil persistant,
visite réelle par clic, lien témoin). Seuil 4,5:1. Rapports tronqués au centième.

| Mesure | Avant 390 | Avant 1440 | Après 390 | Après 1440 |
|---|---|---|---|---|
| Soulignement au repos (`text-decoration-line`) | aucun | aucun | **souligné, décalage 2 px** | **souligné, décalage 2 px** |
| Pixels du soulignement (diff. avec `text-decoration:none` forcé) | 0 | 0 | 1 210 (échelle 2) | 304 (échelle 1) |
| Lien / texte voisin | 1,44 | 1,44 | 1,44 (inchangé, le soulignement porte la différence) | 1,44 |
| Repos, lien sur `#f8fafc` | 5,01 | 5,01 | 5,01 | 5,01 |
| Survol (`#193cb8`) | sans objet (tactile) | 8,43 | sans objet (tactile) | 8,43 |
| Après visite, repos (`#9810fa`) | 5,29 | 5,29 | 5,29 | 5,29 |
| Après visite, survol | 5,29 | 5,29 | 5,29 | 5,29 |
| Témoin après visite | `#9810fa` | `#9810fa` | `#9810fa` | `#9810fa` |

- **État visité.** Le violet vient de la règle globale `a:visited`, maintenue : c'est la
  convention du site pour les liens dans le texte, et elle tient 5,29:1. Le soulignement reste
  après la visite (`apres-historique-390-apres-visite-repos.png`).
- **Focus clavier.** Mesuré par Tab depuis l'élément focalisable précédent. Le lien prend
  `:focus-visible`, avec un contour `2px solid #0f1e38` (15,89:1 sur le fond), avant comme après
  (`apres-focus-{390,1440}.png`).
- **Cible.** Le lien tient sur deux lignes de 18 px : 171×18 + 152×18 à 390 px, 61×18 + 262×18 à
  1440 px. Ces 18 px sont en dessous de 24 px. L'exception « en ligne » du critère 2.5.8
  s'applique : la cible est dans une phrase et sa hauteur est celle de la ligne. Le mandat demande
  la même cible : elle n'est pas modifiée.
- **axe** (`outils/axe-c8.cjs`, mêmes règles qu'au complément n° 6) :
  - Les violations de la page entière sont identiques avant et après : `color-contrast`×9 et
    `region`×2 à 390 px ; `color-contrast`×5, `link-in-text-block`×1 et `region`×4 à 1440 px.
  - Le `link-in-text-block` de 1440 px vise un autre lien, « En savoir plus sur le filtre à
    huile » (`/reference-auto/filtre-a-huile`, section `#emplacement`). Il est hors périmètre et
    signalé ci-dessous.
  - La section `#reference` porte `cv-auto` (`content-visibility:auto`). Elle n'est analysée
    qu'une fois le lien centré à l'écran, sinon elle n'est pas rendue.
  - Résultat sur `#reference` : avant, le lien « Conseils » est classé « à vérifier »
    (`incomplete`) ; après, il **passe** aux deux largeurs. Aucune violation dans la section.
  - DU l'avait relevé comme violation à 390 px. Dans cet environnement, axe le laissait « à
    vérifier » ; la mesure au pixel ci-dessus confirme le défaut.

**Vérifications.**
- Typecheck du frontend OK (`typecheck-front.txt`).
- ESLint et Prettier OK sur la route (`eslint.txt`).
- Vitest : 7 fichiers, 76 tests réussis (`vitest.txt`). Ce sont les tests de `pieces.$slug` et le
  test du complément n° 7.
- Aucun test unitaire ajouté. Le lien vient du HTML éditorial, et les tests de la route ne rendent
  que le loader. La preuve du correctif est le pixel et axe.
- La première mesure de l'état visité à 1440 px s'est arrêtée sur un `TimeoutError` de
  navigation, de cause non établie. La seconde exécution est allée au bout, et ses chiffres sont
  ceux du tableau.

**Rendu.**
- Le build du worktree est servi par `react-router-serve` (:3018) derrière `outils/img-proxy.mjs`
  (:3017), avec des loaders en GET sur le DEV partagé.
- « Avant » est le build de `f1dbcf285`, « après » le build avec la correction. axe « avant » a été
  relancé sur un build reconstruit depuis le fichier de `f1dbcf285`, puis le fichier corrigé a été
  remis.
- Le service DEV n'a été ni redémarré ni modifié. Rien n'est servi en DEV, PREPROD ou PROD.

**Fichiers** (`complement-8/`) :
- `{avant,apres}-lien.json`, `{avant,apres}-paragraphe-{390,1440}.png` et
  `{avant,apres}-focus-{390,1440}.png` ;
- `{avant,apres}-historique-{390,1440}.json` et les captures de la première ligne du lien
  `…-{avant,apres}-visite-{repos,survol}.png` (préfixe = état du correctif, suffixe = état de
  l'historique) ;
- `{avant,apres}-axe.json`, `typecheck-front.txt`, `eslint.txt`, `vitest.txt`.

**Hors périmètre, signalé et non corrigé.** Le lien « En savoir plus sur le filtre à huile » de la
section `#emplacement`, dans un autre bloc `.gamme-editorial` de la même route, n'a lui aussi que la
couleur pour signe (axe `link-in-text-block` à 1440 px). Le traiter relève d'une décision de Marwane
ou de la revue du design system par 05.

## Complément n° 9 — liens soulignés dans #bien-choisir, #qualite-prix et #emplacement (20 nov. 2026)

Mandat : critère WCAG 1.4.1. Marwane a répondu « Oui » le 20 nov. 2026 à 10:23, heure de Paris :
souligner maintenant les liens de ces trois blocs des pages R1, et confier la règle commune à la
revue du design system par 05. Constat de DU : §17 de `REVUE-EXPERTE.md` (#2211, commit
`506004e64`, mesuré sur `dad1abcbc`). Tête de #2210 relevée avant travail : `dad1abcbc`.

**Correction.** `[&_a]:underline [&_a]:underline-offset-2`, la forme du complément n° 8, est
ajoutée aux trois conteneurs éditoriaux de `app/routes/pieces.$slug.tsx`, et à rien d'autre :
- `#bien-choisir` : `editorialBlocks.chooseSection` ;
- `#qualite-prix` : `editorialBlocks.priceSection` ;
- `#emplacement` : `locationSection` et `unmatched`, dans le même conteneur.

Ne sont pas touchés :
- `.gamme-editorial`, partagée dans `global.css` ;
- la règle globale des liens et `a:visited` (règle commune, confiée à 05) ;
- le texte, les cibles et les couleurs.

**Recensement** (`outils/recensement-c9.cjs`). Il porte sur les 123 pages R1 de
`sitemap-categories.xml`. Le HTML servi est lu avec jsdom, en GET seulement.

| Bloc | Pages avec le conteneur | Liens | Déjà `seo-internal-link` | **Liens soulignés par le correctif** | Pages concernées |
|---|---|---|---|---|---|
| `#bien-choisir` | 51 | 30 | 2 | **28** | 21 |
| `#qualite-prix` | 83 | 134 | 53 | **81** | 56 |
| `#emplacement` | 118 | 47 | 3 | **44** | 21 |
| **Trois blocs** | | 211 | 58 | **153** | **72** |

- Ces chiffres sont ceux de DU (153 liens sur 72 pages).
- Les 153 liens n'ont pas de classe et sont tous dans un paragraphe (`<p>`).
- Cibles des 153 liens :
  - `#bien-choisir` : 14 fiches `/reference-auto`, 10 gammes et 4 guides d'achat ;
  - `#qualite-prix` : 48 fiches, 27 gammes et 6 guides ;
  - `#emplacement` : 18 guides d'achat, 15 pages `/diagnostic-auto`, 6 fiches et 5 gammes.
- **Aucun bouton, aucune carte, aucune image.** Le script a cherché :
  - un élément enfant (`img`, `svg`, `picture`, `button`…) ;
  - un `role="button"` ;
  - une classe `btn`, `button`, `card`, `carte` ou `bg-*`.

  Il n'a trouvé aucun cas dans les trois blocs. Rien n'est donc exclu.
- Les 58 liens `seo-internal-link` étaient déjà soulignés avec le même décalage de 2 px. Leurs
  pixels de soulignement sont identiques avant et après, et leur trait atténué est conservé.
- Les liens sont identiques avant et après (diff des deux recensements) : seule la classe des
  conteneurs change. Après correctif, les 252 conteneurs portent le soulignement (51 + 83 + 118).

**Mesures au pixel** (`outils/liens-c9.cjs`).
- Pages : le filtre à huile (`filtre-a-huile-7`), puis `ressort-de-suspension-188`, seule gamme
  du sitemap à avoir des liens sans classe dans les trois blocs.
- Conditions : 390×844 (échelle 2) et 1440×900, mouvement réduit.
- Chaque lien est centré à l'écran avant d'être mesuré, car les sections portent `cv-auto`.
- Fond : la couleur dominante de chaque ligne du lien. Rapports tronqués au centième.

| Lien (bloc) | Pixels du soulignement, avant → après (390 / 1440) | Lien / texte voisin | Repos | Survol 1440 |
|---|---|---|---|---|
| Filtre à huile : « Guide d'achat filtre à huile… » (`#qualite-prix`) | 0 → 1 786 / 0 → 452 | 1,44 | 5,01 sur `#f8fafc` | 8,43 |
| Filtre à huile : « En savoir plus sur le filtre à huile » (`#emplacement`) | 0 → 812 / 0 → 199 | 1,44 | 5,24 sur `#ffffff` | 8,82 |
| Filtre à huile : « filtre à air », « filtre à carburant » (`#bien-choisir`, `seo-internal-link`) | 252 et 428 / 63 et 111, inchangés | 1,44 | 5,24 | 8,82 |
| Ressort : « amortisseur » (`#bien-choisir`) | 0 → 304 / 0 → 76 | 1,44 | 5,24 sur `#ffffff` | 8,82 |
| Ressort : 4 liens de `#qualite-prix` (fiche technique, amortisseurs, butées, guide d'achat) | 0 → 944, 332, 540, 878 / 0 → 240, 83, 135, 219 | 1,44 | 5,01 sur `#f8fafc` | 8,43 |
| Ressort : « amortisseur » (`#emplacement`) | 0 → 304 / 0 → 76 | 1,44 | 5,24 sur `#ffffff` | 8,82 |

- Avant le correctif, `text-decoration-line` valait `none` sur les 8 liens sans classe mesurés.
  Après, il vaut `underline`, avec un décalage de 2 px, aux deux largeurs.
- Le rapport de 1,44 entre le lien et le texte reste le même. C'est le soulignement qui distingue
  désormais le lien du texte.
- Au survol, les couleurs ne changent pas (`#193cb8`). Le soulignement est présent au repos comme
  au survol.
- **État visité** (`outils/visite-lien-c9.cjs`, même méthode qu'aux compléments n° 7 et 8) :
  - Chrome 153 complet, profil persistant, visite réelle par clic sur le lien, puis retour sur la
    page R1 ;
  - un lien témoin prouve que `:visited` est actif : il passe à `#9810fa` après la visite ;
  - liens mesurés :
    - « En savoir plus » (`#emplacement`, filtre à huile) : 5,24 au repos et 8,82 au survol avant
      visite ; 5,54 au repos comme au survol après visite (`#9810fa` sur `#ffffff`) ;
    - « guide d'achat ressort de suspension » (`#qualite-prix`) : 5,01 et 8,43 avant visite ; 5,29
      après visite (`#9810fa` sur `#f8fafc`) ;
  - chiffres identiques avant et après correctif, aux deux largeurs ;
  - le soulignement reste après la visite
    (`apres-historique-*-apres-visite-repos.png`) ;
  - le violet est hors périmètre : c'est la règle commune.
- **Focus clavier.** Mesuré par Tab depuis l'élément focalisable précédent, sur les 10 liens par
  largeur. Tous prennent `:focus-visible`, avec un contour `2px solid #0f1e38`, avant comme après.
- **Cible.** Hauteur de ligne de 18 px, et l'exception « en ligne » du critère 2.5.8 s'applique,
  comme au complément n° 8. Les cibles ne sont pas modifiées.

**axe** (`outils/axe-c9.cjs`, mêmes règles qu'au complément n° 8). axe a tourné sur la page
entière, puis sur chaque section, avec le premier lien du conteneur centré à l'écran.

| | Filtre à huile, avant | Filtre à huile, après | Ressort, avant | Ressort, après |
|---|---|---|---|---|
| Page 390 | `color-contrast`×9, `region`×2 | identique | `color-contrast`×9, `region`×2 | identique |
| Page 1440 | `color-contrast`×5, **`link-in-text-block`×1**, `region`×4 | `color-contrast`×5, `region`×4 | `color-contrast`×5, **`link-in-text-block`×1**, `region`×4, `target-size`×1 | `color-contrast`×5, `region`×4, `target-size`×1 |
| `#bien-choisir` | 2 liens passent | 2 passent | **1 violation** | 1 passe |
| `#qualite-prix` | **1 violation** | 1 passe | **4 violations** | 4 passent |
| `#emplacement` | **1 violation** | 1 passe | **1 violation** | 1 passe |

Les sections ont le même résultat à 390 et à 1440 px.
- **Aucune violation nouvelle.** Les 7 `link-in-text-block` des sections disparaissent : 1 + 1 sur
  le filtre à huile, 1 + 4 + 1 sur le ressort.
- Le `link-in-text-block` de la page entière à 1440 px disparaît aussi. C'était le lien « En
  savoir plus », signalé hors périmètre au complément n° 8.
- Les `color-contrast` « à vérifier » de `#bien-choisir` sont inchangés.
- Le `target-size`×1 du ressort vise `.hover:text-cta-800`, hors des trois blocs. Il est identique
  avant et après.

**Vérifications.**
- Typecheck du frontend OK (`typecheck-front.txt`).
- ESLint et Prettier OK sur la route (`eslint.txt`).
- Vitest : 7 fichiers, 76 tests réussis (`vitest.txt`). Ce sont les mêmes tests qu'au complément
  n° 8.
- Aucun test unitaire ajouté, pour la même raison qu'au complément n° 8 : les liens viennent du
  HTML éditorial et les tests de la route ne rendent que le loader. La preuve est le pixel, axe et
  le recensement du HTML servi.

**Rendu.**
- Le build du worktree est servi par `react-router-serve` (:3018) derrière `outils/img-proxy.mjs`
  (:3017), avec des loaders en GET sur le DEV partagé.
- « Avant » est le build de `dad1abcbc`, « après » le build avec la correction.
- Les captures « avant » ont été refaites sur un build reconstruit depuis le fichier de `dad1abcbc`,
  puis le fichier corrigé a été remis. La première série de captures des conteneurs entiers était
  vide : un conteneur plus haut que la vue n'est pas peint, à cause de `cv-auto`. Elle a été
  remplacée par la capture du paragraphe de chaque lien.
- Le service DEV n'a été ni redémarré ni modifié. Rien n'est servi en DEV, PREPROD ou PROD.

**Fichiers** (`complement-9/`) :
- `{avant,apres}-recensement.json` ;
- `{avant,apres}-{filtre-a-huile-7,ressort-de-suspension-188}-liens.json` ;
- `{avant,apres}-<gamme>-<bloc>-<n° de conteneur>-<n° de lien>-{390,1440}.png`, le paragraphe de
  chaque lien au repos ;
- `{avant,apres}-historique-<gamme>-<bloc>-{390,1440}.json`, avec les captures de la première
  ligne du lien `…-{avant,apres}-visite-{repos,survol}.png` (préfixe = état du correctif, suffixe =
  état de l'historique) ;
- `{avant,apres}-<gamme>-axe.json`, `typecheck-front.txt`, `eslint.txt`, `vitest.txt`.

**Hors périmètre.**
- Le violet des liens visités et la règle `.gamme-editorial a` partagée, qui relèvent de la règle
  commune confiée à 05.
- Le reste de la page.

## Complément n° 10 — ligne de faits sur les cartes véhicule (20 nov. 2026)

Demande de Marwane (20 nov., 13:47, « oui ») : sur les cartes véhicule R1, une
information propre à chaque véhicule remplace la phrase. V-Level hors périmètre.
Décisions 157 (croiser avec les requêtes, rendu conforme aux règles de Google) et
81 (Core Web Vitals avant / après). Tête de départ : `318f405d3a61dbb1b7d7819be5b9431d637117ac`.

### Données disponibles et source

- Années : `get_gamme_page_data_optimized` (`motorisations_enriched`) lit
  `auto_type.type_year_from` et `type_year_to` (colonnes `text`). Le builder les
  renvoie déjà dans chaque élément de `motorisations.items`. Aucune nouvelle requête.
- Nombre de références compatibles par véhicule : **absent** de la fonction SQL et
  de la réponse. `cgcLevelStats` et `technicalCodes` (mines, CNIT) n'en sont pas.
  Il n'est donc pas affiché.
- Borne absente : `type_year_to` est nul pour FIAT 500, DACIA SANDERO I, SUZUKI
  SWIFT IV, HONDA CIVIC IX et CITROËN BERLINGO II. La ligne affiche « dès 2007 »,
  sans affirmer une production en cours (l'ancien « Depuis … » le laissait croire).

### Changement

- `MotorisationsSection.tsx`, R1 seulement : la ligne « 📅 période » et la phrase
  disparaissent ; une ligne `Fabrication : 2005–2012` (ou `dès 2007`,
  `jusqu'en 2012`, une seule année si début = fin) ; aucune ligne si aucune borne.
  Plage insécable (`whitespace-nowrap`) : à 390 px, « 2005–2008 » se coupait
  après le tiret. Hors R1, rendu identique à la base.
- `gamme-page-contract.types.ts` : le schéma zod des motorisations enlevait les
  champs non déclarés ; `type_year_from` et `type_year_to` y sont ajoutés
  (`nullish`). Sans ce point, aucune année n'arrivait au composant.
- Prettier : les deux `div` `bg-navy` de ce fichier (compléments 2 et 3) n'étaient
  pas formatés à la tête 318f405d3 ; formatés ici.

### Retiré (complément n° 5)

Plus rien n'affiche la phrase : `buildR1MotorisationDescription` n'a plus de
consommateur. Les 8 fichiers backend modifiés par le complément n° 5 sont rétablis
à la base de fusion `2462efde5`, et son test est supprimé. Le diff backend
de la branche contre la base est vide.
La clé de cache revient de `gamme:resp:v3` à `gamme:resp:v2` : le complément n° 5
était le seul changement backend de la branche. La réponse redevient celle de
`main`, donc les entrées `v2` en cache restent valides ; garder `v3` forcerait un
recalcul sans objet. Les fragments en base ne sont pas touchés.

### Requêtes (décision 157)

Sur `__seo_keywords` :
- pg 7 : 2002 mots-clés, dont 21 avec un nombre de quatre chiffres, surtout
  « peugeot 2008 », le modèle ; aucun avec « année » ou « fabrication ».
- pg 402 : 1384 mots-clés, dont 12 avec « 2008 » (le modèle) ; aucun avec « année ».

La demande passe par le modèle. La ligne d'années sert à choisir la bonne
motorisation, elle ne vise aucun mot-clé. Elle n'ajoute ni remplissage ni texte
répété entre cartes ; aucun mot du lexique interdit R1 dans les lignes rendues.
Constat hors périmètre : les mots-clés rattachés à pg 402 sont surtout
« disque de frein… ». Rattachement à vérifier, non corrigé.

### Mesures (rendu local, branche, API du DEV en GET)

Avant = tête 318f405d3, phrases du complément n° 5 substituées par le proxy.
Après = état final, proxy sans substitution.

| Gamme | Vue | Cartes | Hauteur min / max / moy. avant | après | Largeur |
|---|---|---|---|---|---|
| pg 7 | 390 | 19 | 264 / 339 / 279 | 184 / 236 / 191 | 308 → 308 |
| pg 7 | 1440 | 19 | 229 / 252 / 251 | 195 / 195 / 195 | 595 → 595 |
| pg 402 | 390 | 17 | 287 / 405 / 301 | 184 / 256 / 200 | 308 → 308 |
| pg 402 | 1440 | 17 | 252 / 275 / 255 | 195 / 195 / 195 | 595 → 595 |

- Titres, liens, badges et largeurs identiques avant / après (comparaison des
  relevés carte par carte) ; la hauteur baisse, puisque la phrase de 3 à 6 lignes
  disparaît.
- Contraste de la ligne : rgb(74,85,101) sur #fff, 7,55:1 à 390 et 1440 px.
- axe : page 390 color-contrast×9, region×2 ; page 1440 color-contrast×5,
  region×4, avant comme après ; section des cartes : aucune violation, avant
  comme après.
- CWV, médiane de 5 passages, cache froid (LCP ms / CLS / INP ms) :

| Gamme | Vue | Avant | Après |
|---|---|---|---|
| pg 7 | 390, CPU ×4 | 3816 / 0 / 64 | 3820 / 0 / 80 |
| pg 7 | 1440 | 3456 / 0,0223 / 48 | 3472 / 0,0223 / 56 |
| pg 402 | 390, CPU ×4 | 372 / 0 / 72 | 408 / 0 / 56 |
| pg 402 | 1440 | 288 / 0,0223 / 40 | 308 / 0,0223 / 40 |

  Les écarts restent dans la dispersion des passages (`*-cwv.json`). Le LCP de
  pg 7 est une image de `figure` hors des cartes (`diagnostic-lcp-apres-filtre-a-huile-7-cwv.json`,
  build attribution, 3 passages).

### Lignes identiques sur une même page

- pg 7 : 2 cartes sur 19 (CLIO III 1.5 dCi et YARIS II 1.4 D4-D : 2005–2012).
  Exemples : « Fabrication : 2005–2012 », « Fabrication : dès 2007 »,
  « Fabrication : 2011–2017 ».
- pg 402 : 4 cartes sur 17, en 2 paires de motorisations sœurs : AUDI A4 III B7
  2.0 TDI 121 et 126 ch (2005–2006), GOLF IV 1.9 TDI 90 et 110 ch (1997–2004) ;
  le titre et la puissance les distinguent. Exemples : « Fabrication : 2013–2015 »,
  « Fabrication : dès 2008 », « Fabrication : 2011 ».

### Fichiers (`complement-10/`)

`avant-*` et `apres-*` pour `filtre-a-huile-7` et `plaquette-de-frein-402` :
`-cartes.json`, `-cartes-390.png`, `-cartes-1a3-390.png`, `-axe.json`, `-cwv.json`.
Contrôles : `typecheck-frontend.txt`, `typecheck-backend.txt`, `eslint.txt`
(eslint et prettier), `vitest.txt`, `jest.txt`. La bulle de discussion fixe
apparaît sur certaines captures (widget de la page, hors cartes).

### Limites

- Mesures de laboratoire sur le rendu local. Rien n'est intégré, activé ni servi
  en DEV, PREPROD ou PROD.
- Deux gammes relevées. Les 7 cartes sans lien, le V-Level, le titre et la
  description de la page ne sont pas traités.

## Complément n° 11 — « Début de fabrication » quand la date de fin manque (20 nov. 2026)

Demande de Marwane (20 nov., 13:47, « oui »), sur le constat de DU (§19 de
REVUE-EXPERTE.md, #2211, commit 45b4b6a99) : 185 cartes sur 891 affichaient
« Fabrication : dès AAAA » alors que la base ne connaît pas la date de fin (exemple :
Sandero I 1.5 dCi 68, « dès 2008 », vendue de 2008 à 2012). Ce complément termine
le changement du complément n° 10 et remplace son « dès AAAA ».
Tête de départ : `31fa098f42ea5642d7aa10755fb842c2b18038a3`.

### Changement

`MotorisationsSection.tsx`, R1 seulement : `r1FabricationYears` renvoie le libellé
et les années ; le rendu affiche `{libellé} : <années insécables>`. Aucune autre
modification des cartes.

| Données (`auto_type`) | Avant (31fa098f4) | Après | Lignes en base |
| --- | --- | --- | --- |
| début et fin | Fabrication : 2005–2012 | Fabrication : 2005–2012 (inchangé) | — |
| années égales | Fabrication : 2011 | Fabrication : 2011 (inchangé) | — |
| début seul | Fabrication : dès 2008 | **Début de fabrication : 2008** | 17 446 |
| fin seule | Fabrication : jusqu'en 2012 | **Fin de fabrication : 2012** | 0 |
| aucune date | pas de ligne | pas de ligne (inchangé) | 0 |

Le cas « fin seule » n'existe pas en base (SELECT sur `auto_type`, début vide et fin
présente : 0 ligne) ; il est traité par symétrie, sans rien affirmer sur le début.

### Test

`frontend/tests/unit/r1-motorisation-fabrication.test.tsx` : rendu réel de la
section R1 avec cinq véhicules (les cinq cas). Sur 31fa098f4 : 2 échecs, 3 réussites
(« Received: "Fabrication : dès 2008" » et « "Fabrication : jusqu'en 2012" »),
`vitest-rouge-31fa098f4.txt`. Après : vert, avec les 5 autres fichiers de tests R1
et cartes (6 fichiers, 59 tests, `vitest.txt`).

### Mesures (390 et 1440 px, `filtre-a-huile-7` et `plaquette-de-frein-402`)

- Titres, liens, badges et largeurs des cartes : identiques avant / après
  (19 et 17 cartes). Aucune carte n'affiche plus « dès » (HTML servi et cartes
  dépliées).
- Cartes changées : FIAT 500, DACIA SANDERO I, SUZUKI SWIFT IV, HONDA CIVIC IX (pg 7) ;
  CITROËN BERLINGO II, HONDA CIVIC IX (pg 402).
- Contraste de la ligne : 7,55:1 sur blanc, inchangé.
- Coupure à 390 px : la colonne de texte fait 168 px ; « Début de fabrication : »
  tient sur la première ligne et l'année passe seule à la ligne suivante
  (`apres-*-coupure.json`, `apres-*-coupure-390.png`). Ces 6 cartes gagnent 20 px
  de hauteur (184 → 204 ; Berlingo 256 → 276). Avant, 2 cartes du pg 7 et 5 du
  pg 402 avaient déjà « Fabrication : » / « AAAA–AAAA » sur deux lignes ; inchangé.
  À 1440 px : une ligne partout, hauteurs inchangées.
- axe : section des cartes sans violation avant comme après ; page inchangée
  (390 : color-contrast ×9, region ×2 ; 1440 : color-contrast ×5, region ×4).

### Bouton flottant de discussion à 390 px (relevé, rien n'est corrigé)

Élément commun au site (`components/rag/ChatWidget.tsx`, `fixed bottom-24
right-4`, cercle de 56 px, x 318–374, y 692–748 dans une vue de 844 px). Il est
fixe : une ligne passe dessous au défilement dès que leurs étendues horizontales se
croisent. Preuve par `elementFromPoint` après avoir amené chaque ligne à la hauteur
du bouton.

| Page | Lignes recouvertes avant | Après | Largeur recouverte |
| --- | --- | --- | --- |
| pg 7 | 11 / 19 | 11 / 19 | 1 à 9 px (fin du dernier chiffre de l'année) |
| pg 402 | 8 / 17 | 8 / 17 | 1 à 9 px |

Les lignes « Début de fabrication : » s'arrêtent à x 305 et ne sont pas recouvertes.
Le bouton « remonter » de `root.tsx` (`fixed bottom-40 right-4`, 48 px, juste
au-dessus) recouvre 1 px de 2 lignes (pg 7) et d'une ligne (pg 402), avant comme
après. Captures : `*-chat-recouvre-390.png` (CLIO III, le « 2 » final de 2012 sous
le bouton), `*-chat-libre-390.png`, `*-remonter-*-390.png`. Toute correction
relève d'une décision de design commune au site (revue du 05).

### Fichiers (`complement-11/`)

`avant-*` et `apres-*` pour les deux gammes : `-cartes.json`, `-cartes-390.png`,
`-cartes-1a3-390.png`, `-axe.json`, `-chat.json`, `-remonter.json` et leurs
captures ; `apres-*-coupure.json` et `-coupure-390.png`. Contrôles :
`typecheck-frontend.txt`, `eslint.txt`, `vitest.txt`, `vitest-rouge-31fa098f4.txt`.
Backend non touché par ce complément : son typecheck du complément n° 10 reste valable.

### Limites

- Mesures de laboratoire sur le rendu local. Rien n'est intégré, activé ni servi en
  DEV, PREPROD ou PROD.
- Hors périmètre : carburant, mois de début et de fin, donnée BMW E81 116d, V-Level,
  les 7 cartes sans lien, toute écriture en base.

## Complément n° 12 — cartes véhicule R1 : un vrai lien dans le HTML servi (20 nov. 2026)

Mandat : chaque carte affichée ou dépliable doit avoir un `<a href>` dans le HTML servi, vers la même cible, sans changer l'apparence validée (premier affichage, bouton « voir plus », ligne « Fabrication »). Constat d'origine : DU, `REFERENTIEL-EXTERNE.md` sur #2211 (7 cartes sur 19 sans lien). Tête de départ : `da7f091b761c2093836319eb49a41953400ecb3a`. Sorties : `complement-12/`.

### Le défaut existait, et sa cause

HTML servi (GET simple, sans JavaScript, `outils/ssr-c12.cjs`) sur la tête de départ :

| Page | Cartes connues (données du loader) | `<a href>` de cartes | Sans lien |
|---|---|---|---|
| pg 7 filtre à huile | 19 | 12 | 7 |
| pg 402 plaquettes de frein | 17 | 12 | 5 |

Cause : ni un affichage différé ni un rendu côté navigateur. Le bouton « Voir les N autres compatibilités » de `MotorisationsSection.tsx` coupait la liste avant le rendu (`filteredItems.slice(0, 12)`) ; les cartes suivantes n'existaient qu'après le clic (`useState`, navigateur seulement).

### Correction

`frontend/app/components/pieces/MotorisationsSection.tsx` : toutes les cartes de `filteredItems` sont rendues ; celles au-delà de la 12ᵉ portent la classe `hidden` (`display:none`) tant que la liste n'est pas dépliée. Le bouton, son libellé, la recherche et la ligne « Fabrication » sont inchangés. Le composant n'a qu'un consommateur, `routes/pieces.$slug.tsx`, qui lui passe `variant="R1"` : aucune autre page n'est touchée.

Pas de lien caché trompeur : une carte repliée est hors de l'ordre de tabulation (`display:none`) et le bouton visible la révèle ; après le clic, toutes les cartes sont visibles et focalisables (`outils/depli-c12.cjs` : 0 carte non atteignable sur les deux pages, à 390 et 1440 px). Sans JavaScript, le bouton ne déplie pas la liste : c'était déjà le cas avant, pour le bouton comme pour la recherche.

### Mesures avant / après (même proxy, même données ; seul le build change)

| Mesure | pg 7 avant | pg 7 après | pg 402 avant | pg 402 après |
|---|---|---|---|---|
| `<a href>` de cartes dans le HTML servi | 12 / 19 | **19 / 19** (12 visibles, 7 repliées) | 12 / 17 | **17 / 17** (12 visibles, 5 repliées) |
| Taille du HTML (gzip) | 219 716 o (39 897) | 238 465 o (40 608) | 227 397 o (38 698) | 240 792 o (39 023) |
| Premier affichage 390 px : cartes visibles, bouton, hauteur de section | 12, « Voir les 7 autres », 2 989 px | identique | 12, « Voir les 5 autres », 3 097 px | identique |
| Capture de la section repliée à 390 px | — | identique à l'octet (sha256) | — | identique à l'octet (sha256) |
| Déplié : cartes visibles / non atteignables | 19 / 0 | 19 / 0 | 17 / 0 | 17 / 0 |
| LCP / CLS / INP 390 px, CPU ×4 (médiane de 5) | 3 856 / 0 / 80 | 3 900 / 0 / 72 | 400 / 0 / 64 | 372 / 0 / 48 |
| LCP / CLS / INP 1440 px (médiane de 5) | 3 448 / 0,0223 / 56 | 3 444 / 0,0223 / 56 | 268 / 0,0223 / 40 | 284 / 0,0223 / 40 |
| axe, section des cartes (390 et 1440) | aucune | aucune | aucune | aucune |

Les écarts de LCP et d'INP restent dans la dispersion des cinq passages (fichiers `*-cwv.json`). Le HTML grossit de 18,7 ko bruts (0,7 ko gzip) sur pg 7 et de 13,4 ko (0,3 ko gzip) sur pg 402 : le balisage des cartes repliées. Leurs images ont `loading="lazy"` : une carte en `display:none` ne télécharge pas son image.

Contrôles : nouveau test `frontend/tests/unit/r1-motorisation-ssr-links.test.tsx` (19 éléments rendus par `renderToString` : 19 `<a href>` dans l'ordre, 12 visibles et 7 repliées, bouton qui déplie puis replie) ; **rouge** sur da7f091b7 (2 échecs sur 3, 12 liens au lieu de 19, `vitest-rouge-da7f091b7.txt`), vert après correction. Tests R1 : 7 fichiers, 62 tests verts (`vitest.txt`) ; typecheck frontend vert (`typecheck-frontend.txt`) ; eslint et prettier verts sur les fichiers touchés (`eslint.txt`).

### Décision 48 : les 36 cibles sont-elles vendables et indexables ?

Règle en code : partiellement. `frontend/app/utils/seo/r2-indexability.ts` porte la règle « au moins 1 produit vendable, sinon `noindex, follow` », avec le prédicat `isSellable` (`price > 0` et disponibilité fournisseur confirmée, `pri_dispo` 1, 2 ou 3 : IN_STOCK, LOW_STOCK, PREORDER). Mais elle est **désactivée par défaut** (`SEO_R2_SELLABLE_NOINDEX_ENABLED`) ; la règle servie reste l'ancienne (`count >= 2`, ou 1 produit avec une qualité de données d'au moins 50). Le sitemap gamme+véhicule se génère encore depuis `__sitemap_p_link` (`sitemap-v10-pieces.service.ts`), pas depuis la règle de la décision 48. Que `pri_dispo` soit exactement la confirmation « par le système fournisseurs » des décisions 19 et 22 n'est pas vérifié ici.

Relevé en SELECT seulement (`rm_get_page_complete_v2`, fonction STABLE, la RPC de la page, en transaction en lecture seule ; `decision-48-cibles.sql`, `decision-48-cibles.txt`) : **les 36 cibles ont au moins 10 produits vendables** (de 10 à 86). Elles sont toutes indexables au sens du prédicat en code, et selon la règle servie aujourd'hui.

À signaler à Marwane (aucun lien créé ni retiré) : deux cibles visibles de pg 402 sont **absentes de `__sitemap_p_link`**, donc du sitemap actuel, bien que vendables : `renault-140/megane-iii-140049/1-5-dci-77310` (54 vendables) et `citroen-46/berlingo-ii-46007/1-6-bluehdi-65057` (39 vendables). Les 34 autres y figurent.

Hors périmètre, non touché : règles de maillage, titre et description, V-Level, page véhicule Clio III, bulle de discussion, base de données.

## Limites propres au complément n° 5

- Le rendu après est mesuré sur la page R1 isolée, avec la substitution
  déclarée ci-dessus. Rien n'est intégré, activé ni servi en DEV, PREPROD ou PROD.
- Seules pg 7 et pg 402 ont été relevées. Une gamme sans fragment alias 2 admis
  aura des cartes sans phrase.

## Limites

- **Lighthouse n'est pas installé.** `npm install lighthouse` est bloqué par le
  hook `pretool-bash-guard.sh` (confirmation explicite requise), qui n'a pas été
  contourné. Les mesures suivent son profil mobile, mais ce ne sont pas des
  scores Lighthouse.
- **6.2 non réalisé** (§6.2).
- **Les mesures sont faites sur le rendu isolé, pas sur PROD** : pas de Caddy, de
  Cloudflare ni de compression identiques. Elles comparent l'avant et l'après dans
  les mêmes conditions ; elles ne prédisent pas les valeurs PROD.
- **Le rendu après n'existe qu'en DEV isolé.** Il n'est ni intégré, ni activé, ni
  servi.

## Outils (reproductibles, hors application)

- `outils/img-proxy.mjs` : proxy :3017, lecture seule vers le DEV.
- `outils/capture.cjs` :
  `node capture.cjs <base> <label> <dossier>`. `SNAPSHOT_HTML=<fichier>` sert un
  HTML pris en GET ; `VIDEO_SLOT=1` insère l'emplacement vidéo, en capture
  seulement.
- `outils/measure.cjs` : `node measure.cjs <url> <label> <sortie.json> [passages]`.
- `outils/zone.cjs` : `node zone.cjs <base> <label> <dossier>` ; cibles, contraste et mouvement de la zone du complément n° 2.
- `outils/axe-c3.cjs` : `node axe-c3.cjs <base> <label> <dossier>` ; axe 4.12.1 à 390×844, cibles sous 44 px, boucles et défilement avec reduced-motion (complément n° 3).
- `outils/zones-c3.cjs` : `node zones-c3.cjs <base> <label> <dossier>` ; captures des zones du complément n° 3 à 390 et 1440 px.
- `outils/contraste-c4.cjs` : `node contraste-c4.cjs <base> <label> <dossier>` ; contraste au pixel et captures des quatre zones du complément n° 4, à 390 et 1440 px.
- `outils/proxy-c5.mjs` : proxy :3017, GET seulement ; `SUBST=1 APRES=<calcul.json>` remplace la description des cartes de pg 7 et 402, `EMPTY=1` la vide (complément n° 5).
- `outils/cartes-c5.cjs` : `URL_PATH=/pieces/... node cartes-c5.cjs <base> <label> <dossier>` ; texte et captures des cartes à 390 px.
- `outils/calcul-c5.ts` et `outils/valide-rendu-c5.ts` : calcul des phrases par la méthode du builder et validateur R1 sur le rendu (tsx, depuis `backend/`).
- `outils/diag-c6.cjs` : `node diag-c6.cjs <base> <label> <dossier>` ; contraste au pixel du bouton « Lancer le diagnostic » (bouts, reflet à 24 positions, survol, icônes, taille, imbrication), à 390 et 1440 px (complément n° 6).
- `outils/axe-c6.cjs` : `node axe-c6.cjs <base> <label> <dossier>` ; axe sur la page et sur la carte « Diagnostic gratuit », à 390 et 1440 px (complément n° 6).
- `outils/visite-c7.cjs` : `CHROME=/usr/bin/google-chrome node visite-c7.cjs <base> <largeur> <hauteur> <profil> <sortie.json>` ; bouton du diagnostic avant et après visite réelle, au repos et au survol (complément n° 7).
- `outils/lien-c8.cjs` : `node lien-c8.cjs <base> <label> <dossier>` ; lien « Conseils » de `#reference` : soulignement, contrastes repos et survol, focus clavier, cible, à 390 et 1440 px (complément n° 8).
- `outils/visite-lien-c8.cjs` : `CHROME=/usr/bin/google-chrome node visite-lien-c8.cjs <base> <largeur> <hauteur> <profil> <sortie.json>` ; même lien avant et après visite réelle (complément n° 8).
- `outils/axe-c8.cjs` : `node axe-c8.cjs <base> <label> <dossier>` ; axe sur la page et sur `#reference`, lien centré (complément n° 8).
- `outils/recensement-c9.cjs` : `node recensement-c9.cjs <base> <sitemap.xml> <sortie.json>` ; liens des conteneurs éditoriaux des pages R1 du sitemap, par bloc, avec la recherche de bouton, carte ou image (complément n° 9).
- `outils/liens-c9.cjs` : `URL_PATH=… node liens-c9.cjs <base> <label> <dossier>` ; chaque lien de `#bien-choisir`, `#qualite-prix` et `#emplacement` : soulignement, contrastes repos et survol, focus clavier, capture du paragraphe, à 390 et 1440 px (complément n° 9).
- `outils/visite-lien-c9.cjs` : `URL_PATH=… SEL=… HREF=… CHROME=/usr/bin/google-chrome node visite-lien-c9.cjs <base> <largeur> <hauteur> <profil> <sortie.json>` ; un lien avant et après visite réelle (complément n° 9).
- `outils/axe-c9.cjs` : `URL_PATH=… node axe-c9.cjs <base> <label> <dossier>` ; axe sur la page et sur chacune des trois sections, lien centré (complément n° 9).
- `outils/cartes-c10.cjs` : `URL_PATH=… node cartes-c10.cjs <base> <label> <dossier>` ; cartes véhicule dépliées : titre, lien, badges, taille, contraste au pixel de chaque paragraphe, lignes identiques, captures à 390 px (complément n° 10).
- `outils/axe-c10.cjs` : `URL_PATH=… node axe-c10.cjs <base> <label> <dossier>` ; axe sur la page et sur la section des cartes dépliée (complément n° 10).
- `outils/cwv-c10.cjs` : `URL_PATH=… N=5 [ATTR=1] node cwv-c10.cjs <base> <label> <dossier>` ; LCP, CLS, INP (web-vitals 5.3.0), 390 CPU ×4 et 1440, parcours scripté ; `ATTR=1` pour le diagnostic des éléments (complément n° 10).
- `outils/cartes-c10.cjs` relève aussi « Début de fabrication : » et « Fin de fabrication : » depuis le complément n° 11.
- `outils/bulle-c11.cjs` : `BULLE=chat|remonter URL_PATH=… node bulle-c11.cjs <base> <label> <dossier>` ; bouton flottant fixe à 390 px : lignes « Fabrication » dont l'étendue croise le bouton, preuve `elementFromPoint` ligne par ligne, captures recouverte / libre (complément n° 11).
- `outils/coupure-c11.cjs` : `URL_PATH=… node coupure-c11.cjs <base> <label> <dossier>` ; lignes « Fabrication » coupées à 390 px, texte de chaque ligne affichée, capture de la carte (complément n° 11).
- `outils/ssr-c12.cjs` : `URL_PATH=… node ssr-c12.cjs <base> <label> <dossier>` ; HTML servi sans JavaScript : cartes connues du loader, `<a href>` de cartes (visibles / repliées), cartes sans lien, taille du HTML (complément n° 12).
- `outils/depli-c12.cjs` : `URL_PATH=… node depli-c12.cjs <base> <label> <dossier>` ; premier affichage, dépliage et repli des cartes à 390 et 1440 px, cartes non atteignables, capture de la section repliée (complément n° 12).
- `outils/band-context.cjs` : `node band-context.cjs <base> <sortie.png>` ; bas du hero et bande à 1440 px.

Ces scripts chargent Playwright et sharp depuis le `node_modules` d'un worktree
(chemin à adapter).
