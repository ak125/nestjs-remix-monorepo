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
| Badge « 2 min » (10 px) | `#f54900` sur `#fff7ed`, 3,38 | `cta-700` `#C2410C` | 4,88 |
| 4 ancres de « Aller plus loin » (12 px) | `#f97316` sur `#f5f7fa`, 2,61 | `cta-700` | 4,83 |
| « Lire plus » (12 px) | `#f89b5a` sur `#f5f7fa`, 1,99 | `cta-700` | 4,83 |
| **Pied de page, 4 nœuds** | 3,73 ; 2,24 ×2 ; 1,88 (`text-white/40`, `/25`, `/20` sur `#0f1e38`) | non modifié | — |
| **Barre « Navigation mobile », 5 nœuds** | 2,63 ×4 (`#90a1b9`) ; 2,80 (`#f97316`) sur blanc | non modifié | — |

Les 15 nœuds R1 ne sont plus signalés par axe après correction. Aucune couleur
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

Ces scripts chargent Playwright et sharp depuis le `node_modules` d'un worktree
(chemin à adapter).
