# Option A3 : synthèse (complément n° 5 au mandat DZ)

Décision de Marwane, 20 nov. 2026 à 12:03 heure de Tunis : « A2 mais continue les améliorations ».
**Cette page décrit une maquette par feuille injectée, pas une implémentation. Rien n'est en vigueur.** Les décisions 45, 55 et 57 sont inchangées.

| | |
|---|---|
| Feuille | [`option-a3.css`](../option-a3.css), SHA-256 `b373701378a49d5ce4413138a0bbc6ddc649e737e466e1bfc3b4624ab8dae9f9`, 83 règles (6 blocs `@media`), 264 686 octets. Elle part d'`option-a2.css` (`1bef7ff9…630a64`, 67 règles, inchangée) et est produite par `scripts/genere-options-css-dz.cjs`, fonction `a3()`. |
| Injection | `page.addStyleTag` après le chargement (`scripts/injection-dz.cjs`). Les 10 relevés `mesures/injection/a3-*.json` donnent tous la balise présente avec 83 règles lues par le navigateur. |
| Site mesuré | DEV `http://127.0.0.1:3000`, code frontend de `7f4dded3`. `main` est passé à `b2a6b6eb7`, `f72a75c40` puis `fbefa231b` pendant les passages ; `git diff 7f4dded3..fbefa231b -- frontend packages/design-tokens` est vide. |
| Outils | Playwright (Chromium), axe-core 4.12.1 et `../scripts/mesure-dz.cjs`, inchangé, avec les mêmes réglages que les n° 2 et 4. |
| Garde-fous | Toute requête non GET est abandonnée (`lib-dz.cjs`). Aucun clic, aucune saisie, aucun compte, aucun panier. |
| Comparaison | AVANT = n° 2, A2 = n° 4 : ce sont les mesures déjà livrées, non relancées. A3 a été mesuré le 20 nov. 2026 entre 11:40 et 12:20 UTC. |

Chaque chiffre A3 de cette page vient d'une mesure relancée sous la feuille A3. Les tableaux en fin de page sont générés par `scripts/condense-option-a3-dz.cjs` à partir de `dz-options-mesures/{avant,a2,a3}` et repris tels quels dans `synthese-option-a3-dz.tableaux.md`.

## Bilan AVANT / A2 / A3 (10 passages : 5 pages × 390 et 1440)

| Défaut | AVANT | A2 | A3 |
|---|---|---|---|
| Textes sous seuil (`ratioRetenu`) | 466 | 11 | **2** (faux positif de mesure) |
| Bords sous 3:1 | 61 | 40 | **0** |
| Focus invisible ou masqué | 75 | 34 | **3** (changement de code nécessaire) |
| axe `color-contrast` (nœuds) | 134 | 1 | **0** |

Aucun défaut n'est présent sous A3 et absent sous A2 (§ « Défauts présents sous A3 et absents sous A2 » en fin de page) : il n'y a pas de régression par rapport à A2.

## Point 1 : « Ajouter » des cartes R2 en contour navy, une seule action orange par écran

- **Règle** (`r2-produit`, 390 et 1440). Le sélecteur est `button[aria-label^="Ajouter"][aria-label$="au panier"]`, sur les boutons des cartes de la liste (PiecesGridView.tsx:321–330). L'état AVANT est `bg-primary` navy ; sous A2, ces boutons sont orange.
  - Sous A3 : contour 2 px `#0F1E38`, fond transparent, texte `#0F1E38`. Le navy est le même que celui du texte des actions A2.
- **Ratios mesurés sous A3** (`mesures/captures-r2-produit-{390,1440}-a3.json`). Les états sont capturés sur `captures/boutons/bouton-r2-produit-*-ajouter-a3-*.webp`.

| État | Fond / texte | Ratio texte | Contour ou anneau | Ratio contour/page |
|---|---|---|---|---|
| Repos | `#FFFFFF` / `#0F1E38` | 16,63 | contour 2 px solid `#0F1E38` | 16,63 |
| Survol | `#ECEDEF` (navy à 8 %) / `#0F1E38` | 14,19 | — | — |
| Focus | — | — | anneau 2 px solid `#0F1E38` | 16,63 |
| Désactivé (simulé) | `#F5F7FA` / `#4B5563` | 7,04 | contour 2 px **dashed** `#4B5563` | 7,56 |

  Le désactivé se distingue du repos par trois écarts : fond gris, texte gris et contour en pointillé.
- **Actions orange par écran.** Une action compte si elle est entière dans la fenêtre et non recouverte en son centre ; un écran vaut une hauteur de fenêtre. Fichiers : `mesures/actions-orange-<page>-<largeur>-{avant,a2,a3}.json`.

| Passage | Maximum par écran AVANT → A2 → A3 | Écrans à plusieurs actions orange AVANT → A2 → A3 |
|---|---|---|
| r2-produit 390 | 2 → 5 → **1** (« Panier » de la barre collante, sur chacun des 16 écrans) | 15 → 4 → **0** |
| r2-produit 1440 | 2 → 3 → **0** | 11 → 4 → **0** |
| r0-accueil 390 / 1440 | 1 → 1 → 1 / 3 → 0 → 0 | 0 → 0 → 0 / 5 → 0 → 0 |
| r1-gamme 390 / 1440 | 1 → 0 → 0 / 2 → 0 → 0 | 0 → 0 → 0 / 9 → 0 → 0 |
| panier-vide 390 / 1440 | 0 → 1 → 1 / 1 → 1 → 1 | 0 |
| connexion 390 / 1440 | 1 → 1 → 1 / 1 → 1 → 1 | 0 |

  Sous A3, aucun écran des dix passages ne porte plus d'une action orange.
- La page R2 mesurée est une liste. Elle n'a pas d'« achat principal de fiche » : en 1440, aucun bouton orange n'y reste visible.
- La fiche produit (R3) n'est pas dans les 5 pages du mandat ; le cas « achat principal de la fiche » n'y est donc pas mesuré.

## Point 2 : pas de « Rechercher des pièces » en 1440 (accueil et gamme)

- **Cause, lue dans le code** (base `7f4dded3`, chemins sous `frontend/app/components/`).
  - `home/HeroSection.tsx:77` : le bloc mobile `relative lg:hidden` contient `<VehicleSelector mode="mobile-premium" …>` (:127–129).
  - `home/HeroSection.tsx:206` : le bloc ≥ 1024 px `relative hidden lg:block` contient `<VehicleSelector mode="compact" context="homepage" />` (:262).
  - La gamme suit le même schéma : `gamme/GammeHero.tsx:133` (`lg:hidden`, `mode="mobile-premium"` :174–175) et `:222` (`hidden lg:flex …`, `mode="compact"` :271–272).
  - `vehicle/VehicleSelector.tsx:381–382` : le mode `compact` rend quatre listes (marque, année, modèle, motorisation) et un seul bouton, « Réinitialiser la sélection de véhicule » (:461–467). Il n'a **aucun bouton de recherche** ; la recherche part au choix de la motorisation.
  - « Rechercher des pièces » n'existe que dans le rendu `mobile-premium` (`VehicleSelector.tsx:630–638`, `bg-cta`, `disabled={!canSearch}` :635, `canSearch = !!selectedType` :512).
- **Mesure.** `scripts/sonde-rechercher-1440-a3-dz.cjs` sous A3, 1440×900 (`mesures/rechercher-1440-r0-r1-a3.jsonl`).
  - Sur `/` comme sur `/pieces/filtre-a-huile-7.html`, le seul bouton « Rechercher des pièces » du DOM est celui du bloc mobile. Sa boîte est 0×0 et son ancêtre `div.relative.lg:hidden` est en `display:none`.
  - Les éléments visibles sont les quatre listes et « Réinitialiser ».
- **Conclusion.**
  - Le bouton visible à cette largeur n'existe pas : le seul présent dans le DOM appartient au bloc mobile masqué.
  - Rendre ce bloc par la feuille afficherait un deuxième sélecteur complet. Ce serait une simulation, et elle n'est pas faite.
  - **Changement de code proposé**, non appliqué :
    - Dans `vehicle/VehicleSelector.tsx`, branche `mode === "compact"` (:381–483), ajouter après les listes le même bouton que :630–638. Il serait désactivé tant que `canSearch` est faux et déclencherait `handleTypeSelect(selectedType)`.
    - Il recevrait les classes de l'action principale A2.
    - Appelants concernés : `HeroSection.tsx:262` et `GammeHero.tsx:271`.

## Point 3 : la barre collante masque « Rechercher » (gamme 390)

Sonde : `scripts/sonde-recouvrement-a3-dz.cjs`, 390×844, bouton `button.inline-flex…bg-cta` de 310×48. Fichiers : `mesures/recouvrement-rechercher-r1-gamme-390-{avant,a2,a3}.json`. Planche : `captures/recouvrement-rechercher-r1-gamme-390-avant-a2-a3.webp`.

| Position | AVANT | A2 | A3 |
|---|---|---|---|
| Premier écran (y 873 > 844) | hors fenêtre | hors fenêtre | hors fenêtre |
| `scrollIntoView({block:"end"})` | y 798 : **46 px** couverts sur 310 de large par `nav` fixe « Navigation mobile » ; le centre tombe sur un lien de cette barre | idem, **46 px** | y 582 : **0 px** |
| `block:"center"` | 0 px | 0 px | 0 px |
| `block:"start"` | y 0 : **48 px** couverts par l'en-tête collant (Navbar.tsx:156, `sticky top-0`) | idem, **48 px** | y 131 : **0 px** |

- **Cause.**
  - La barre mobile `BottomNav.tsx:66–68` (`fixed bottom-0`, 63 px) et l'en-tête collant `Navbar.tsx:156` occupent les bords de la fenêtre.
  - Le défilement (navigateur, clavier, `scrollIntoView`) ne les connaît pas : la page n'a pas de `scroll-padding`.
  - Une hauteur existe pourtant déjà dans le code : `--bottom-nav-height: 56px` (`frontend/app/global.css:126–129`), plus basse que les 63 px mesurés.
- **Correction appliquée par la feuille** (< 768 px) :
  - `html { scroll-padding-top: calc(var(--navbar-height, 64px) + 8px); scroll-padding-bottom: 216px }`, avec `--navbar-height` posé par `Navbar.tsx:117`.
  - Quand la barre d'outils collante R2 est présente : `scroll-padding-top: 230px`.
  - Les 216 px du bas couvrent la barre mobile (63 px), la bulle d'aide et le bouton de retour en haut, empilés au-dessus (`ChatWidget.tsx:210` `bottom-24` + 56 px, `root.tsx:363` `bottom-40`).
- **Mesure sous A3** : 0 px dans les trois positions.
  - Le relevé « centre couvert par `div.space-y-3` » sous A3 n'est pas un recouvrement. Le bouton est désactivé, donc `elementFromPoint` le traverse et renvoie son parent ; la liste `fixes` est vide.
- **Correction de code équivalente proposée** : poser le même `scroll-padding` dans `global.css`, à côté de `--bottom-nav-height` (:126–129), en corrigeant cette variable à la hauteur réelle de la barre.

## Point 4 : le petit point devant « Ajouter »

- **Nature.** C'est **l'icône « + » de la carte, écrasée**. Ce n'est ni un pseudo-élément ni un artefact de la feuille.
  - Sonde `scripts/sonde-point-ajouter-a3-dz.cjs`, r2-produit 390, AVANT / A2 / A3 (`mesures/point-ajouter-r2-produit-390.txt`).
  - Planche agrandie 4× : `captures/point-ajouter-r2-produit-390-avant-a2-a3.webp`.
- **Mesures.**
  - `::before` et `::after` du bouton valent `content: none` dans les trois variantes.
  - Le premier enfant est `svg.w-4.h-4` (`PiecesGridView.tsx:354–355`, `className="w-4 h-4"` sans `shrink-0`).
  - Dans un bouton de 75 px de large, le flex le réduit à **2,2 px × 16** (AVANT, A2) ; son `path` « + » ne garde que 1,5 × 1,5 px, d'où le point.
  - Sous A3, le contour de 2 px réduit encore la place : le svg mesure 0,5 px, le point existe toujours mais ne se voit presque plus.
  - Il est blanc en AVANT et navy en A2/A3.
- **Correction.** Ce n'est pas la feuille, donc pas de correction CSS déguisée. **Changement de code proposé** : `PiecesGridView.tsx:355` → `className="w-4 h-4 shrink-0"`.
  - L'icône s'affichera alors à 16 px. Si la largeur manque, on retirera l'icône de la carte ; ce choix revient au design.
  - L'icône sœur de :371 (état « indisponible ») a la même classe et appelle le même ajout.

## Point 5 : défauts restants sous A2, un par un

Les 86 défauts mesurés sous A2 (11 textes, 40 bords, 34 focus, 1 nœud axe) sont listés un par un, avec page, largeur, sélecteur, mesure, cause et devenir sous A3, dans le tableau « Défauts relevés sous A2 » en fin de page. Résumé par cause :

| Défauts sous A2 | Page, largeur | Cause (fichier, ligne) | Sous A3 |
|---|---|---|---|
| 40 bords à 1,23:1 (`#E2E8F0` sur blanc) | r2-produit 390 (20), 1440 (20) | case « Sélectionner » des cartes, `border-slate-200` (PiecesGridView.tsx:263) | corrigé : bord `#6B7280`, 4,83:1 |
| 5 textes + 1 nœud axe à 1,5:1 | r0-accueil 390 (1), 1440 (4 + axe) | badge « 5 min » blanc translucide sur photo (BlogCarousel.tsx:47 et 134) | corrigé : badge navy opaque |
| 2 textes | r2-produit 1440 | pastille de résultats sur l'en-tête sombre du filtre (PiecesFilterSidebar.tsx:115–121) | corrigé : pastille navy |
| 1 texte | r2-produit 1440 | sous-titre `text-slate-300` sur l'en-tête OEM en dégradé (PiecesOemSection.tsx:53/70) | corrigé : en-tête navy, sous-titre blanc |
| 1 texte | r2-produit 1440 | `div.text-xs.text-gray-400` « Véhicule sélectionné » : calculé 7,53, P10 des pixels 3,32 (pictogramme et filet voisins dans la boîte) | absent sous A3 |
| 2 textes | r0-accueil 390 | `p.text-slate-400.mb-3` : calculé 7,56, P10 pixels 1,27 | **restant, faux positif de mesure** : le paragraphe est coupé à une ligne (CatalogueSection.tsx:90, `line-clamp-1`) et la boîte relevée par pixels déborde sur l'image voisine |
| 20 focus | r0-accueil 390 (4), r1-gamme 390 (4), r2-produit 390 (10), panier-vide 390 (2) | arrêt de focus sous la barre mobile fixe (BottomNav.tsx:68) | corrigé : `scroll-padding-bottom` |
| 5 focus | r2-produit 390 | arrêt sous la barre d'actions R2 (MobileBottomBar.tsx:66–67) ou sous la barre d'outils collante (PiecesToolbar.tsx:75) | corrigé : `scroll-padding` haut et bas |
| 5 focus | connexion 390 (3), r1-gamme 390 (2) | arrêt sous la bulle d'aide (ChatWidget.tsx:210) ou le retour en haut (root.tsx:363) | corrigé : `scroll-padding-bottom` ; connexion par l'espace réservé de 160 px en bas de page |
| 1 focus | r0-accueil 390 | défilement entre les deux captures encadrant la prise de focus | absent sous A3 |
| 1 focus | panier-vide 390 | lien « 01 48 47 96 27 » (`div.rounded-xl.border … a.block.text-lg`) : 1 point sur 5 sous `button.fixed.bottom-24` | **restant, changement de code** : ChatWidget.tsx:210 |
| 2 focus | r2-produit 1440 | `nav[aria-label="Gammes similaires"] … a.text-sm.text-blue-700` (« Filtre à air », « Filtre à carburant ») : 5 points sur 5 sous `div.sticky.top-24` | **restant, changement de code** : PiecesVehicleContent.tsx:327 |

**Contrôles de la consigne, sous A3.**
- **Bords de champ** : 0 bord sous 3:1 dans les dix passages.
- **Anneau de focus.**
  - Sur fond clair : navy `#0F1E38`, 16,63:1 sur blanc.
  - Sur fond sombre (en-tête, « Inscription ») : blanc, 16,63:1 sur navy.
  - Les 3 focus restants ne sont pas des anneaux sous le seuil : ce sont des arrêts **recouverts**, avec un P90 à 16,63 quand le point est visible.
- **Textes** : 0 texte sous le seuil hors les 2 faux positifs.

**Défauts non corrigés par la feuille, et pourquoi.**
1. **r0-accueil 390, 2 textes `p.text-slate-400.mb-3`** : faux positif de mesure.
   - La couleur calculée `#4B5563` sur blanc donne 7,56:1.
   - La lecture par pixels compte l'image voisine, parce que `line-clamp-1` (CatalogueSection.tsx:90) coupe la boîte.
   - La planche r0-accueil-390-a3 montre le texte lisible.
2. **r2-produit 1440, 2 focus « Gammes similaires »** : la carte de filtres `sticky top-24` (PiecesVehicleContent.tsx:327) glisse au-dessus des liens de la même colonne quand on y avance au clavier.
   - Le `scroll-padding` ne peut rien : le recouvrement vient d'un élément collant *dans* la colonne, pas d'un bord de la fenêtre.
   - Proposition : que la colonne latérale ne soit collante qu'au-dessus de la liste des gammes (`self-start` + `max-h` avec défilement interne), ou que la liste « Gammes similaires » soit placée hors de la colonne collante.
3. **panier-vide 390, 1 focus « 01 48 47 96 27 »** : la bulle d'aide fixe (ChatWidget.tsx:210, `bottom-24`, 56 px) couvre 1 point sur 5 de l'anneau. Le lien est en bas de page et le défilement ne peut plus le dégager.
   - **Variante écartée** : l'espace réservé de 160 px en bas de page, étendu à toutes les pages à bulle, corrigeait ce lien. Mais la mesure du 20 nov. vers 12:00 UTC sur r1-gamme 390 a donné **+1 focus** (un arrêt masqué par la barre mobile) et **+3 nœuds axe** à 1,87:1. Elle a donc été retirée ; la raison est écrite dans le commentaire de la règle.
   - L'espace réservé est gardé pour les pages sans barre mobile (connexion).
   - Proposition de code : que ChatWidget.tsx:210 réserve sa place (`padding-bottom` du `main` égal à `bottom-24` + 56 px) ou se replie en bas de page.

## Point 6 : « Inscription » en 1440

- **Sélecteur** : `nav a[href="/register"][class~="bg-cta"]` (Navbar.tsx:373–376, AVANT `text-black bg-cta`). Le lien apparaît sur r0-accueil, r1-gamme, r2-produit et panier-vide en 1440 ; il est absent de connexion.
- **Rendu sous A3** : action secondaire, fond transparent sur l'en-tête navy, texte blanc, contour blanc 2 px, **pas d'orange**.
- **Mesures** (`mesures/captures-*-1440-a3.json`, `captures/boutons/bouton-*-1440-inscription-a3-*.webp`), identiques sur les quatre pages :

| État | Fond / texte | Ratio texte | Contour ou anneau | Ratio |
|---|---|---|---|---|
| Repos | `#0F1E38` / `#FFFFFF` | 16,63 | contour 2 px solid `#FFFFFF` | 16,63 |
| Survol | `#2C3950` (blanc à 12 %) / `#FFFFFF` | 11,61 | — | — |
| Focus | — | — | anneau 2 px solid `#FFFFFF` | 16,63 |

- C'est un lien : l'état désactivé est sans objet.
- Texte et contour passent le seuil (4,5:1 et 3:1) dans tous les états.
- En AVANT, « Inscription » était le premier bouton orange de l'écran sur les 4 pages 1440 qui l'affichent.

## Point 7 : verts et rouges d'état

- A3 ne change aucune couleur d'état au-delà d'A2.
- **Mesure** : `scripts/etats-vert-rouge-a3-dz.cjs` (`mesures/etats-vert-rouge-avant-a2-a3.json`), sur les textes de teinte verte ou rouge-orangé, que la teinte soit celle du texte ou du fond :

| Variante | Textes de teinte d'état | Sous le seuil |
|---|---|---|
| AVANT | 156 | 86 |
| A2 | 63 | 0 |
| A3 | 23 | **0** |

  - Exemples AVANT sous le seuil : « Livré 24-48h » `#009966` sur blanc, 3,58 ; prix vert `#00A63E`, 3,06 ; « Lancer un diagnostic gratuit » `#009689`, 3,67.
- **Aucun vert ni rouge d'état ne reste sous le seuil sous A3.**
- Limite : le classement par teinte est une règle simple, et les fonds d'image ne sont pas lus. Les bords et les icônes d'état ne sont pas comptés.

## Constat hors périmètre (signalé, non corrigé)

- **Orange de l'action sur fond blanc.** Le bouton orange `#F97316` contre une page blanche mesure **2,8:1**, sous 3:1 (colonne « Bouton / page »).
  - Ce n'est pas exigé par WCAG 1.4.11 quand le libellé identifie le bouton : le texte navy sur orange est à 5,93.
  - Il est identique sous A2 et A3, donc ce n'est pas une régression.
  - Ce constat ne compte pas dans les défauts.

## Changements de code proposés (non appliqués)

| Fichier, ligne (base `7f4dded3`, sous `frontend/app/`) | Changement proposé | Point |
|---|---|---|
| `components/vehicle/VehicleSelector.tsx:381–483` (appelé par `components/home/HeroSection.tsx:262`, `components/gamme/GammeHero.tsx:271`) | bouton « Rechercher des pièces » dans le mode `compact`, comme :630–638 | 2 |
| `global.css:126–129` | `scroll-padding` haut et bas sous 768 px ; `--bottom-nav-height` à la hauteur réelle (63 px mesurés pour 56 déclarés) | 3, 5 |
| `components/pieces/PiecesGridView.tsx:355` (et :371) | `shrink-0` sur l'icône de « Ajouter » | 4 |
| `components/pieces/PiecesGridView.tsx:321–330` (bouton) | contour navy, fond transparent, texte navy ; désactivé en pointillé gris | 1 |
| `components/Navbar.tsx:376` | « Inscription » : `border-2 border-white text-white bg-transparent`, retrait de `bg-cta` | 6 |
| `components/pieces/PiecesGridView.tsx:263` | bord de la case « Sélectionner » en `#6B7280` | 5 |
| `components/home/BlogCarousel.tsx:47` et `:134` | badge « 5 min » opaque | 5 |
| `components/pieces/PiecesFilterSidebar.tsx:115–121` | pastille de résultats navy | 5 |
| `components/pieces/PiecesOemSection.tsx:53` et `:70` | en-tête OEM navy, sous-titre blanc | 5 |
| `components/pieces/PiecesVehicleContent.tsx:327` | colonne collante qui ne recouvre plus « Gammes similaires » | 5 |
| `components/rag/ChatWidget.tsx:210`, `root.tsx:363` | place réservée en bas de page pour la bulle et le retour en haut | 5 |
| `components/layout/BottomNav.tsx:66–68`, `components/pieces/PiecesToolbar.tsx:75`, `components/layout/MobileBottomBar.tsx:66–67` | hauteur exposée dans une variable unique, reprise par le `scroll-padding` | 3, 5 |
| `components/home/CatalogueSection.tsx:90` | aucun : faux positif de mesure (`line-clamp-1`), signalé pour mémoire | 5 |

Chemins et numéros de ligne relus par `git show 7f4dded3:frontend/app/…` ; ils valent pour ce commit. Dans le corps de la page, les fichiers sont cités par leur nom court : `BottomNav` et `MobileBottomBar` sont sous `components/layout/`, `ChatWidget` sous `components/rag/`, `CatalogueSection` sous `components/home/`, `global.css` à la racine de `frontend/app/`.

## Conduite des passages et limites

- **Redémarrages du DEV** observés pendant les passages : 11:50:31 UTC et 12:10:38 UTC. Le processus `node dist/main.js` est relancé par son nodemon, qui n'est pas un processus de cette session ; aucune action de cette session ne touche le DEV.
  - 11:50:31 : il est tombé pendant les captures r2-produit 1440 ; l'étape a été relancée entière, code 0.
  - 12:10:38 : il est tombé entre deux étapes ; l'attente de disponibilité l'a absorbé.
- **1440.** Les mesures 1440 ont été prises sous la feuille de 11:40 UTC. Ses sélecteurs et déclarations sont identiques à la feuille livrée ; seul le commentaire d'une règle limitée à < 768 px diffère.
- **390.** Les passages 390 ont été relancés sous la feuille livrée après le retrait de la variante « espace réservé partout ».
- **État simulé.** « Rechercher des pièces » est réellement désactivé tant qu'aucun véhicule n'est choisi. Ses repos, survol et focus sont mesurés après retrait local de l'attribut `disabled`. Les états désactivés dits « simulés » posent cet attribut dans le DOM. Aucun clic, aucune saisie.
- **Ce que la feuille ne prouve pas.** Une feuille injectée prouve un rendu ; elle ne prouve pas une implémentation, le thème sombre, ni les autres pages du site. Les ratios sont ceux du navigateur de mesure (Chromium headless).

---

## Tableaux mesurés

Générés par `scripts/condense-option-a3-dz.cjs` (copie : [`synthese-option-a3-dz.tableaux.md`](synthese-option-a3-dz.tableaux.md), données : [`synthese-option-a3-dz.json`](synthese-option-a3-dz.json)).

### Défauts mesurés, AVANT / A2 / A3

| Passage | Textes sous seuil (AVANT / A2 / A3) | Bords sous 3:1 | Focus invisible ou masqué | axe color-contrast (nœuds) |
|---|---|---|---|---|
| r0-accueil-390 | 39 / 3 / 2 | 3 / 0 / 0 | 12 / 5 / 0 | 31 / 0 / 0 |
| r0-accueil-1440 | 41 / 4 / 0 | 3 / 0 / 0 | 3 / 0 / 0 | 26 / 1 / 0 |
| r1-gamme-390 | 79 / 0 / 0 | 3 / 0 / 0 | 14 / 6 / 0 | 25 / 0 / 0 |
| r1-gamme-1440 | 76 / 0 / 0 | 3 / 0 / 0 | 1 / 0 / 0 | 21 / 0 / 0 |
| r2-produit-390 | 97 / 0 / 0 | 22 / 20 / 0 | 25 / 15 / 0 | 9 / 0 / 0 |
| r2-produit-1440 | 105 / 4 / 0 | 21 / 20 / 0 | 5 / 2 / 2 | 5 / 0 / 0 |
| panier-vide-390 | 8 / 0 / 0 | 1 / 0 / 0 | 5 / 3 / 1 | 6 / 0 / 0 |
| panier-vide-1440 | 5 / 0 / 0 | 1 / 0 / 0 | 1 / 0 / 0 | 1 / 0 / 0 |
| connexion-390 | 8 / 0 / 0 | 2 / 0 / 0 | 7 / 3 / 0 | 5 / 0 / 0 |
| connexion-1440 | 8 / 0 / 0 | 2 / 0 / 0 | 2 / 0 / 0 | 5 / 0 / 0 |
| **Total** | **466 / 11 / 2** | **61 / 40 / 0** | **75 / 34 / 3** | **134 / 1 / 0** |

### Actions orange et à contour, A2 / A3

| Action | Option | Repos (fond / texte : ratio) | Bouton / page | Contour / page | Survol | Focus (anneau : ratio anneau/page) | Désactivé |
|---|---|---|---|---|---|---|---|
| r0-accueil-390 · Rechercher des pièces (sélecteur véhicule) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (réel) |
| r0-accueil-390 · Rechercher des pièces (sélecteur véhicule) | A3 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (réel) |
| r0-accueil-1440 · Inscription (en-tête, action secondaire) | A3 | #0F1E38 / #FFFFFF : 16.63 | 1 | 2px solid #FFFFFF : 16.63 | #2C3950 / #FFFFFF : 11.61 | 2px solid #FFFFFF : 16.63 | #0F1E38 / #FFFFFF : 16.63 (simulé) ; contour 2px solid #FFFFFF : 16.63 |
| r1-gamme-390 · Rechercher des pièces (sélecteur véhicule) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (réel) |
| r1-gamme-390 · Rechercher des pièces (sélecteur véhicule) | A3 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (réel) |
| r1-gamme-1440 · Inscription (en-tête, action secondaire) | A3 | #0F1E38 / #FFFFFF : 16.63 | 1 | 2px solid #FFFFFF : 16.63 | #2C3950 / #FFFFFF : 11.61 | 2px solid #FFFFFF : 16.63 | #0F1E38 / #FFFFFF : 16.63 (simulé) ; contour 2px solid #FFFFFF : 16.63 |
| r2-produit-390 · Ajouter … au panier | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) |
| r2-produit-390 · Ajouter … au panier | A3 | #FFFFFF / #0F1E38 : 16.63 | 1 | 2px solid #0F1E38 : 16.63 | #ECEDEF / #0F1E38 : 14.19 | 2px solid #0F1E38 : 16.63 | #F5F7FA / #4B5563 : 7.04 (simulé) ; contour 2px dashed #4B5563 : 7.56 |
| r2-produit-390 · Panier (bouton collant) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) |
| r2-produit-390 · Panier (bouton collant) | A3 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) |
| r2-produit-1440 · Ajouter … au panier | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) |
| r2-produit-1440 · Ajouter … au panier | A3 | #FFFFFF / #0F1E38 : 16.63 | 1 | 2px solid #0F1E38 : 16.63 | #ECEDEF / #0F1E38 : 14.19 | 2px solid #0F1E38 : 16.63 | #F5F7FA / #4B5563 : 7.04 (simulé) ; contour 2px dashed #4B5563 : 7.56 |
| r2-produit-1440 · Inscription (en-tête, action secondaire) | A3 | #0F1E38 / #FFFFFF : 16.63 | 1 | 2px solid #FFFFFF : 16.63 | #2C3950 / #FFFFFF : 11.61 | 2px solid #FFFFFF : 16.63 | #0F1E38 / #FFFFFF : 16.63 (simulé) ; contour 2px solid #FFFFFF : 16.63 |
| panier-vide-390 · Trouver une pièce (panier vide) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) |
| panier-vide-390 · Trouver une pièce (panier vide) | A3 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) |
| panier-vide-1440 · Trouver une pièce (panier vide) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) |
| panier-vide-1440 · Trouver une pièce (panier vide) | A3 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) |
| panier-vide-1440 · Inscription (en-tête, action secondaire) | A3 | #0F1E38 / #FFFFFF : 16.63 | 1 | 2px solid #FFFFFF : 16.63 | #2C3950 / #FFFFFF : 11.61 | 2px solid #FFFFFF : 16.63 | #0F1E38 / #FFFFFF : 16.63 (simulé) ; contour 2px solid #FFFFFF : 16.63 |
| connexion-390 · Se connecter (bouton principal du formulaire) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) |
| connexion-390 · Se connecter (bouton principal du formulaire) | A3 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) |
| connexion-1440 · Se connecter (bouton principal du formulaire) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) |
| connexion-1440 · Se connecter (bouton principal du formulaire) | A3 | #F97316 / #0F1E38 : 5.93 | 2.8 | — | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) |

« Rechercher des pièces » : désactivé réel tant qu'aucun véhicule n'est choisi ; repos, survol et focus mesurés après retrait local de l'attribut disabled. Désactivé « simulé » : attribut disabled posé dans le DOM. Aucun clic, aucune saisie.

### Actions orange par écran, AVANT → A2 → A3

Une action compte si elle est entière dans la fenêtre et non recouverte en son centre ; un écran = une hauteur de fenêtre, du haut au bas de la page.

| Passage | Premier écran AVANT | Premier écran A2 | Premier écran A3 | Par écran AVANT | Par écran A2 | Par écran A3 | Écrans à plusieurs AVANT → A2 → A3 | Maximum par écran AVANT → A2 → A3 |
|---|---|---|---|---|---|---|---|---|
| r0-accueil-390 | 1 (Rechercher des pièces (désactivé) #F97316) | 1 (Rechercher des pièces (désactivé) #FED7AA) | 1 (Rechercher des pièces (désactivé) #FED7AA) | 1 1 1 1 1 1 1 1 1 1 | 1 0 0 0 0 0 0 0 0 0 | 1 0 0 0 0 0 0 0 0 0 | 0 → 0 → 0 | 1 → 1 → 1 |
| r0-accueil-1440 | 1 (Inscription (collant) #F97316) | 0 | 0 | 1 2 3 2 2 2 | 0 0 0 0 0 0 | 0 0 0 0 0 0 | 5 → 0 → 0 | 3 → 0 → 0 |
| r1-gamme-390 | 0 | 0 | 0 | 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | 0 → 0 → 0 | 1 → 0 → 0 |
| r1-gamme-1440 | 1 (Inscription (collant) #F97316) | 0 | 0 | 1 2 2 2 2 2 2 2 2 2 | 0 0 0 0 0 0 0 0 0 0 | 0 0 0 0 0 0 0 0 0 0 | 9 → 0 → 0 | 2 → 0 → 0 |
| r2-produit-390 | 1 (Panier (collant) #FF6900) | 1 (Panier (collant) #F97316) | 1 (Panier (collant) #F97316) | 1 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 | 1 1 4 5 3 5 1 1 1 1 1 1 1 1 1 1 | 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 | 15 → 4 → 0 | 2 → 5 → 1 |
| r2-produit-1440 | 1 (Inscription (collant) #F97316) | 0 | 0 | 1 2 2 2 2 2 2 2 2 2 2 2 | 0 3 3 3 2 0 0 0 0 0 0 0 | 0 0 0 0 0 0 0 0 0 0 0 0 | 11 → 4 → 0 | 2 → 3 → 0 |
| panier-vide-390 | 0 | 1 (Trouver une pièce #F97316) | 1 (Trouver une pièce #F97316) | 0 0 | 1 1 | 1 1 | 0 → 0 → 0 | 0 → 1 → 1 |
| panier-vide-1440 | 1 (Inscription (collant) #F97316) | 1 (Trouver une pièce #F97316) | 1 (Trouver une pièce #F97316) | 1 1 | 1 1 | 1 1 | 0 → 0 → 0 | 1 → 1 → 1 |
| connexion-390 | 1 (Se connecter #F97316) | 1 (Se connecter #F97316) | 1 (Se connecter #F97316) | 1 1 | 1 1 | 1 1 | 0 → 0 → 0 | 1 → 1 → 1 |
| connexion-1440 | 1 (Se connecter #F97316) | 1 (Se connecter #F97316) | 1 (Se connecter #F97316) | 1 1 | 1 1 | 1 1 | 0 → 0 → 0 | 1 → 1 → 1 |

### Défauts restants sous A3, un par un

| Passage | Type | Sélecteur | Texte | Mesure | Statut | Cause |
|---|---|---|---|---|---|---|
| r0-accueil-390 | texte | `div > div.group.flex > div.flex.flex-col > p.text-slate-400.mb-3` | Le système de filtration du véhicule est | #4b5563 sur #ffffff : calculé 7.56, pixels P10 1.27, retenu 1.27 (seuil 4.5) | faux positif de mesure | paragraphe tronqué à une ligne (CatalogueSection.tsx:90, line-clamp-1) : la boîte mesurée par pixels couvre les lignes masquées et le contenu voisin (P10 bas, médiane au seuil) ; couleur calculée au seuil |
| r0-accueil-390 | texte | `div > div.group.flex > div.flex.flex-col > p.text-slate-400.mb-3` | Le système de freinage est l'élément de  | #4b5563 sur #ffffff : calculé 7.56, pixels P10 1.27, retenu 1.27 (seuil 4.5) | faux positif de mesure | paragraphe tronqué à une ligne (CatalogueSection.tsx:90, line-clamp-1) : la boîte mesurée par pixels couvre les lignes masquées et le contenu voisin (P10 bas, médiane au seuil) ; couleur calculée au seuil |
| r2-produit-1440 | focus | `nav[aria-label="Gammes similaires"] > ul.space-y-1 > li > a.text-sm.text-blue-700` | Filtre à air | 5 point(s) sur 5 caché(s) par `div.sticky.top-24` ; P90 16.63, défilement entre captures | changement de code nécessaire | recouvert par la carte de filtres collante de la colonne latérale R2 (div.sticky.top-24) qui glisse sur « Gammes similaires », placé dans la même colonne sous elle |
| r2-produit-1440 | focus | `nav[aria-label="Gammes similaires"] > ul.space-y-1 > li > a.text-sm.text-blue-700` | Filtre à carburant | 5 point(s) sur 5 caché(s) par `div.sticky.top-24` ; P90 16.66 | changement de code nécessaire | recouvert par la carte de filtres collante de la colonne latérale R2 (div.sticky.top-24) qui glisse sur « Gammes similaires », placé dans la même colonne sous elle |
| panier-vide-390 | focus | `div.rounded-xl.border > div.flex.items-start > div.space-y-2 > a.block.text-lg` | 01 48 47 96 27 | 1 point(s) sur 5 caché(s) par `button.fixed.bottom-24` ; P90 16.63 | changement de code nécessaire | recouvert par la bulle d'aide (ChatWidget.tsx:210, fixed bottom-24, 56 px) ou le bouton de retour en haut (root.tsx:363, fixed bottom-40) |

### Défauts relevés sous A2, un par un, et leur devenir sous A3

| Passage | Type | Sélecteur | Texte | Mesure sous A2 | Cause | Sous A3 |
|---|---|---|---|---|---|---|
| r0-accueil-390 | texte | `div > div.group.flex > div.flex.flex-col > p.text-slate-400.mb-3` | Le système de filtration du véhicule est | #4b5563 sur #ffffff : calculé 7.56, pixels P10 1.27, retenu 1.27 | paragraphe tronqué à une ligne (CatalogueSection.tsx:90, line-clamp-1) : la boîte mesurée par pixels couvre les lignes masquées et le contenu voisin (P10 bas, médiane au seuil) ; couleur calculée au seuil | restant (faux positif de mesure) |
| r0-accueil-390 | texte | `div > div.group.flex > div.flex.flex-col > p.text-slate-400.mb-3` | Le système de freinage est l'élément de  | #4b5563 sur #ffffff : calculé 7.56, pixels P10 1.27, retenu 1.27 | paragraphe tronqué à une ligne (CatalogueSection.tsx:90, line-clamp-1) : la boîte mesurée par pixels couvre les lignes masquées et le contenu voisin (P10 bas, médiane au seuil) ; couleur calculée au seuil | restant (faux positif de mesure) |
| r0-accueil-390 | texte | `a.no-style.no-visited > div.bg-card.text-card-foreground > div.relative.overflow-hidden > span.absolute.top-4` | 5 min | #ffffff sur #c8cbcf : calculé 1.63, pixels P10 1.5, retenu 1.5 | badge « 5 min » sur photo (BlogCarousel.tsx:47 et 134) | corrigé |
| r0-accueil-390 | focus | `section.bg-white.border-b > div.mx-auto.px-5 > div.flex.gap-2.5 > button.flex.shrink-0` | Par véhicule | 0 point(s) sur 5 caché(s) ; P90 2.12, défilement entre captures | la page a défilé entre les deux captures qui encadrent la prise de focus (defilementEntreCaptures) : le ratio P90 compare deux vues décalées ; l'anneau posé est navy 2 px (16,63:1 sur blanc) | corrigé |
| r0-accueil-390 | focus | `div.group.flex > div.flex.flex-col > div.flex.flex-col > a.flex.items-center` | Courroie d'accessoire | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r0-accueil-390 | focus | `div.group.flex > div.flex.flex-col > div.flex.flex-col > a.flex.items-center` | Galet tendeur de courroie d'accessoire | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r0-accueil-390 | focus | `div.group.flex > div.flex.flex-col > div.flex.flex-col > a.flex.items-center` | Barre de direction | 3 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 16.63 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r0-accueil-390 | focus | `div.group.flex > div.flex.flex-col > div.flex.flex-col > a.flex.items-center` | Bras de suspension | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r0-accueil-1440 | texte | `a.no-style.no-visited > div.bg-card.text-card-foreground > div.h-36.relative > span.absolute.top-3` | 5 min | #ffffff sur #c8cbcf : calculé 1.63, pixels P10 1.5, retenu 1.5 | badge « 5 min » sur photo (BlogCarousel.tsx:47 et 134) | corrigé |
| r0-accueil-1440 | texte | `a.no-style.no-visited > div.bg-card.text-card-foreground > div.h-36.relative > span.absolute.top-3` | 5 min | #ffffff sur #c8cbcf : calculé 1.63, pixels P10 1.5, retenu 1.5 | badge « 5 min » sur photo (BlogCarousel.tsx:47 et 134) | corrigé |
| r0-accueil-1440 | texte | `a.no-style.no-visited > div.bg-card.text-card-foreground > div.h-36.relative > span.absolute.top-3` | 5 min | #ffffff sur #c8cbcf : calculé 1.63, pixels P10 1.5, retenu 1.5 | badge « 5 min » sur photo (BlogCarousel.tsx:47 et 134) | corrigé |
| r0-accueil-1440 | texte | `a.no-style.no-visited > div.bg-card.text-card-foreground > div.h-36.relative > span.absolute.top-3` | 5 min | #ffffff sur #d3d3d4 : calculé 1.5, pixels P10 1.5, retenu 1.5 | badge « 5 min » sur photo (BlogCarousel.tsx:47 et 134) | corrigé |
| r0-accueil-1440 | axe | `.bg-gradient-to-br.h-36.relative > .rounded.text-\[9px\].bg-neutral-900\/20` | <span class="absolute top-3 right-3 px-2 | #ffffff sur #d3d3d4 : 1.49 | badge « 5 min » sur photo (BlogCarousel.tsx:47 et 134) ; même nœud que le défaut de texte | corrigé |
| r1-gamme-390 | focus | `nav[aria-label="Navigation rapide"] > div.max-w-7xl.mx-auto > div.flex.items-center > button.flex.items-center` | FAQ | 1 point(s) sur 5 caché(s) par `button.fixed.bottom-40` ; P90 16.63 | recouvert par la bulle d'aide (ChatWidget.tsx:210, fixed bottom-24, 56 px) ou le bouton de retour en haut (root.tsx:363, fixed bottom-40) | corrigé |
| r1-gamme-390 | focus | `nav[aria-label="Navigation rapide"] > div.max-w-7xl.mx-auto > div.flex.items-center > button.flex.items-center` | Voir aussi | 1 point(s) sur 5 caché(s) par `button.fixed.bottom-40` ; P90 16.63 | recouvert par la bulle d'aide (ChatWidget.tsx:210, fixed bottom-24, 56 px) ou le bouton de retour en haut (root.tsx:363, fixed bottom-40) | corrigé |
| r1-gamme-390 | focus | `div.relative.mx-auto > div.bg-white.border > div.px-4.pb-4 > a` | Lancer le diagnostic | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r1-gamme-390 | focus | `div.bg-white.border > div.px-4.pb-4 > a > button.w-full.py-4` | Lancer le diagnostic | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r1-gamme-390 | focus | `div.relative.mx-auto > div.grid.grid-cols-2 > div > button.border.p-3.5` | 3 Compatibilité huile longlife Moteurs V | 2 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 16.48 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r1-gamme-390 | focus | `div.relative.mx-auto > div.grid.grid-cols-2 > div > button.border.p-3.5` | 4 Présence clapet anti-retour Certains m | 2 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 15.93 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile BOSCH — 11.00"] > div.relative.aspect-square > butt` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile BOSCH — 13.00"] > div.relative.aspect-square > butt` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MECAFILTER — 5.00"] > div.relative.aspect-square > ` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MANN FILTER — 6.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MANN FILTER — 7.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MGA — 8.00"] > div.relative.aspect-square > button.` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MISFAT — 8.00"] > div.relative.aspect-square > butt` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MISFAT — 9.00"] > div.relative.aspect-square > butt` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MGA — 9.00"] > div.relative.aspect-square > button.` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile COOPERS FIAAM — 9.00"] > div.relative.aspect-square` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile NPS — 9.00"] > div.relative.aspect-square > button.` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile WIX FILTERS — 9.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile COOPERS FIAAM — 10.0"] > div.relative.aspect-square` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile BLUE PRINT — 10.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile WIX FILTERS — 10.00"] > div.relative.aspect-square ` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile BLUE PRINT — 11.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile PURFLUX — 11.00"] > div.relative.aspect-square > bu` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile FEBI — 13.00"] > div.relative.aspect-square > butto` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile PURFLUX — 14.00"] > div.relative.aspect-square > bu` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile FEBI — 16.00"] > div.relative.aspect-square > butto` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-390 | focus | `ol.flex.flex-wrap > span.contents > li.inline-flex.items-center > a.transition-colors.flex` | Accueil | 5 point(s) sur 5 caché(s) par `div.fixed.left-0` ; P90 0 | recouvert par la barre d'actions R2 (div[role=toolbar] « Actions », MobileBottomBar.tsx:66, fixed, 63 px au-dessus de la barre mobile) | corrigé |
| r2-produit-390 | focus | `ol.flex.flex-wrap > span.contents > li.inline-flex.items-center > a.transition-colors.flex` | Filtre à huile | 5 point(s) sur 5 caché(s) par `div.fixed.left-0` ; P90 0 | recouvert par la barre d'actions R2 (div[role=toolbar] « Actions », MobileBottomBar.tsx:66, fixed, 63 px au-dessus de la barre mobile) | corrigé |
| r2-produit-390 | focus | `ol.flex.flex-wrap > span.contents > li.inline-flex.items-center > a.transition-colors.flex` | Pièces RENAULT | 5 point(s) sur 5 caché(s) par `div.fixed.left-0` ; P90 0 | recouvert par la barre d'actions R2 (div[role=toolbar] « Actions », MobileBottomBar.tsx:66, fixed, 63 px au-dessus de la barre mobile) | corrigé |
| r2-produit-390 | focus | `ol.flex.flex-wrap > span.contents > li.inline-flex.items-center > a.transition-colors.flex` | CLIO III 1.5 dCi | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div.space-y-8 > div.animate-in.fade-in > div.grid.grid-cols-2 > div.pieces-product-card.group` | 8 BOSCH / F 026 407 022 11 ,00€ Livré 24 | 2 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 11.89, défilement entre captures | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div.space-y-8 > div.animate-in.fade-in > div.grid.grid-cols-2 > div.pieces-product-card.group` | 7 MECAFILTER / ELH4391 5 ,00€ Livré 24-4 | 2 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 15.49 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div[aria-label="Voir Filtre à huile MECAFILTER — 5.00"] > div.p-2.5.pt-2 > div.flex.items-center > button.flex` | Ajouter | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div.space-y-8 > div.animate-in.fade-in > div.grid.grid-cols-2 > div.pieces-product-card.group` | 7 MANN FILTER / W 75/3 6 ,00€ Livré 24-4 | 2 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 15.49 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div[aria-label="Voir Filtre à huile MANN FILTER — 6.00"] > div.p-2.5.pt-2 > div.flex.items-center > button.fle` | Ajouter | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div.space-y-8 > div.animate-in.fade-in > div.grid.grid-cols-2 > div.pieces-product-card.group` | 7 MANN FILTER / W 79 7 ,00€ Livré 24-48h | 2 point(s) sur 5 caché(s) par `div.fixed.left-0` ; P90 14.36, défilement entre captures | recouvert par la barre d'actions R2 (div[role=toolbar] « Actions », MobileBottomBar.tsx:66, fixed, 63 px au-dessus de la barre mobile) | corrigé |
| r2-produit-390 | focus | `div.space-y-8 > div.animate-in.fade-in > div.grid.grid-cols-2 > div.pieces-product-card.group` | MI 7 MISFAT / Z691 8 ,00€ Livré 24-48h A | 2 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 15.49 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div[aria-label="Voir Filtre à huile MISFAT — 8.00"] > div.p-2.5.pt-2 > div.flex.items-center > button.flex.ite` | Ajouter | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div.space-y-8 > div.animate-in.fade-in > div.grid.grid-cols-2 > div.pieces-product-card.group` | MI 7 MISFAT / Z692 9 ,00€ Livré 24-48h A | 2 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 15.49 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div[aria-label="Voir Filtre à huile MISFAT — 9.00"] > div.p-2.5.pt-2 > div.flex.items-center > button.flex.ite` | Ajouter | 5 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 0 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| r2-produit-390 | focus | `div.space-y-8 > div.animate-in.fade-in > div.grid.grid-cols-2 > div.pieces-product-card.group` | 7 MGA / FH1005 9 ,00€ Livré 24-48h Ajout | 2 point(s) sur 5 caché(s) par `div.fixed.left-0` ; P90 12.57, défilement entre captures | recouvert par la barre d'actions R2 (div[role=toolbar] « Actions », MobileBottomBar.tsx:66, fixed, 63 px au-dessus de la barre mobile) | corrigé |
| r2-produit-1440 | texte | `div.flex.items-center > div.flex.items-center > div > div.text-xs.text-gray-400` | Véhicule sélectionné | #4b5563 sur #feffff : calculé 7.53, pixels P10 3.32, retenu 3.32 | ratio calculé au seuil ; seul le P10 des pixels du cadre est sous le seuil, tiré par des pixels sombres voisins (pictogramme, filet) compris dans la boîte du texte | corrigé |
| r2-produit-1440 | texte | `div.bg-gradient-to-r.from-slate-900 > div.relative.z-10 > div.backdrop-blur-xs.rounded-full > span.text-white.` | 22 | #ffffff sur #ffffff : calculé 1, pixels P10 3.14, retenu 3.14 | pastille de résultats sur l'en-tête sombre du filtre (PiecesFilterSidebar.tsx:115–121, fond blanc à 15 %, « résultats » blanc à 60 %) | corrigé |
| r2-produit-1440 | texte | `div.bg-gradient-to-r.from-slate-900 > div.relative.z-10 > div.backdrop-blur-xs.rounded-full > span.ml-1` | résultat s | #ffffff sur #ffffff : calculé 1, pixels P10 1.48, retenu 1.48 | pastille de résultats sur l'en-tête sombre du filtre (PiecesFilterSidebar.tsx:115–121, fond blanc à 15 %, « résultats » blanc à 60 %) | corrigé |
| r2-produit-1440 | texte | `div.space-y-6.mt-12 > section.bg-white.rounded-xl > div.bg-gradient-to-r.from-slate-800 > p.text-slate-300.tex` | Numéros de pièce d'origine pour votre RE | #9ca3af sur #ffffff : calculé 2.54, pixels P10 —, retenu 2.54 | sous-titre text-slate-300 sur l'en-tête OEM en dégradé slate-800 → slate-700 (PiecesOemSection.tsx:53 et 70) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile BOSCH — 11.00"] > div.relative.aspect-square > butt` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile BOSCH — 13.00"] > div.relative.aspect-square > butt` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MECAFILTER — 5.00"] > div.relative.aspect-square > ` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MANN FILTER — 6.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MANN FILTER — 7.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MGA — 8.00"] > div.relative.aspect-square > button.` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MISFAT — 8.00"] > div.relative.aspect-square > butt` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MISFAT — 9.00"] > div.relative.aspect-square > butt` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile MGA — 9.00"] > div.relative.aspect-square > button.` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile COOPERS FIAAM — 9.00"] > div.relative.aspect-square` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile NPS — 9.00"] > div.relative.aspect-square > button.` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile WIX FILTERS — 9.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile COOPERS FIAAM — 10.0"] > div.relative.aspect-square` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile BLUE PRINT — 10.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile WIX FILTERS — 10.00"] > div.relative.aspect-square ` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile BLUE PRINT — 11.00"] > div.relative.aspect-square >` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile PURFLUX — 11.00"] > div.relative.aspect-square > bu` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile FEBI — 13.00"] > div.relative.aspect-square > butto` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile PURFLUX — 14.00"] > div.relative.aspect-square > bu` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | bord | `div.grid.grid-cols-2 > div[aria-label="Voir Filtre à huile FEBI — 16.00"] > div.relative.aspect-square > butto` | Sélectionner Filtre à huile | bord #e2e8f0 sur #ffffff : 1.23 | case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc) | corrigé |
| r2-produit-1440 | focus | `nav[aria-label="Gammes similaires"] > ul.space-y-1 > li > a.text-sm.text-blue-700` | Filtre à air | 5 point(s) sur 5 caché(s) par `div.sticky.top-24` ; P90 3.98, défilement entre captures | recouvert par la carte de filtres collante de la colonne latérale R2 (div.sticky.top-24) qui glisse sur « Gammes similaires », placé dans la même colonne sous elle | restant (changement de code nécessaire) |
| r2-produit-1440 | focus | `nav[aria-label="Gammes similaires"] > ul.space-y-1 > li > a.text-sm.text-blue-700` | Filtre à carburant | 5 point(s) sur 5 caché(s) par `div.sticky.top-24` ; P90 16.66 | recouvert par la carte de filtres collante de la colonne latérale R2 (div.sticky.top-24) qui glisse sur « Gammes similaires », placé dans la même colonne sous elle | restant (changement de code nécessaire) |
| panier-vide-390 | focus | `div.max-w-2xl.mx-auto > div > div.grid.grid-cols-2 > a.flex.items-center` | Kit d'embrayage | 3 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 15.89 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| panier-vide-390 | focus | `div.max-w-2xl.mx-auto > div > div.grid.grid-cols-2 > a.flex.items-center` | Kit de distribution | 3 point(s) sur 5 caché(s) par `nav.fixed.bottom-0` ; P90 15.89 | recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur | corrigé |
| panier-vide-390 | focus | `div.rounded-xl.border > div.flex.items-start > div.space-y-2 > a.block.text-lg` | 01 48 47 96 27 | 2 point(s) sur 5 caché(s) par `button.fixed.bottom-24` ; P90 16.63, défilement entre captures | recouvert par la bulle d'aide (ChatWidget.tsx:210, fixed bottom-24, 56 px) ou le bouton de retour en haut (root.tsx:363, fixed bottom-40) | restant (changement de code nécessaire) |
| connexion-390 | focus | `div.border.border-slate-200 > div.p-6 > form.space-y-5 > button.inline-flex.items-center` | Se connecter | 1 point(s) sur 5 caché(s) par `button.fixed.bottom-24` ; P90 15.94 | recouvert par la bulle d'aide (ChatWidget.tsx:210, fixed bottom-24, 56 px) ou le bouton de retour en haut (root.tsx:363, fixed bottom-40) | corrigé |
| connexion-390 | focus | `div.relative.z-10 > div.max-w-md.mx-auto > p.text-center.text-xs > a.underline` | conditions d'utilisation | 1 point(s) sur 5 caché(s) par `button.fixed.bottom-24` ; P90 7.16, défilement entre captures | recouvert par la bulle d'aide (ChatWidget.tsx:210, fixed bottom-24, 56 px) ou le bouton de retour en haut (root.tsx:363, fixed bottom-40) | corrigé |
| connexion-390 | focus | `div.relative.z-10 > div.max-w-md.mx-auto > p.text-center.text-xs > a.underline` | politique de confidentialité | 1 point(s) sur 5 caché(s) par `button.fixed.bottom-24` ; P90 15.75 | recouvert par la bulle d'aide (ChatWidget.tsx:210, fixed bottom-24, 56 px) ou le bouton de retour en haut (root.tsx:363, fixed bottom-40) | corrigé |

### Défauts présents sous A3 et absents sous A2

Aucun.

