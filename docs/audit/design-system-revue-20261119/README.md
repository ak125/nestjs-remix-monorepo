# Revue du design system en rendu — mandat DZ (05 Brand et design system)

**Nature : mesure en lecture seule.** Rien n'est proposé ni corrigé ici ; aucune règle n'est
créée. Les décisions de goût et de règle (couleurs, tailles, seuils) appartiennent au chat 05.
Rien n'est en vigueur avant l'approbation de l'owner et la fusion.

| | |
|---|---|
| Serveur mesuré | DEV, `http://127.0.0.1:3000`, serveur Vite de développement (pas un build de production) |
| Code lu | `7368d72d051cf2005ed9f07a6e5e1acb718f60fe` (base de la branche) |
| Fenêtre de mesure | 2026-11-20, 00:13:09Z → 01:06:37Z (heure de chaque mesure dans son fichier brut) |
| Outils | Playwright 1.61.1 et axe-core 4.12.1 lus dans `/opt/automecanik/app/node_modules` (aucune installation), Chromium headless, Python 3 (bibliothèque standard), curl, ImageMagick `convert` |
| Tailles | 390×844 et 1440×900 ; 320×640 (6.3) ; 1280×800 à 200 % émulé en 640×400 DSF 2 (6.4) |
| Pages | 16 pages, 32 passages — liste, fichiers de route, statuts et heures : [`pages.md`](pages.md) |
| Non mesurable | `/checkout` (302 → `/cart` sans panier : l'afficher demanderait une écriture) |

## Statut des affirmations

| Libellé | Contenu |
|---|---|
| **Mesuré** | Chiffres lus dans le rendu DEV, avec page, taille, heure UTC et fichier brut `mesures/…` |
| **Déduit du code** | Emplacements `fichier:ligne` lus à `7368d72d051c`, sans preuve de rendu |
| **Non mesurable** | Dit avec sa raison (commande, liste native ouverte, composants non rendus) |
| **Proposé** | Rien. La colonne « jeton existant » est un calcul de ratio sur les jetons présents, pas une proposition |
| **Corrigé** | Rien (aucun fichier hors de ce dossier) |
| **Fusionné** | Non (PR en brouillon) |

## Sources citées

- `AGENTS.md` et `CLAUDE.md` : invariants 1 (inspecter), 7 (preuve adaptée au risque),
  8 (DEV ≠ PREPROD ≠ PROD), 9 (zones STOP : panier et commande, d'où l'absence de mesure de `/checkout`).
- `.claude/rules/frontend.md:18-22` : convention UI (shadcn/ui de `~/components/ui/`, Tailwind
  seul, lucide-react). Les composants partagés comptés ci-dessous suivent cette liste.
- `.claude/governance/journal-des-principes.md` : P1 (lignes 50-57, environnements distincts :
  ce qui est mesuré ici est DEV, pas PROD) ; P33 (ligne 302, « ce qui n'est pas mesuré est écrit
  comme tel »).
- `.spec/00-canon/role-matrix.md` : ligne 64 (R5, « glissement vers R3 ») et ligne 160 (R6
  consolidé dans R3 derrière `SEO_R6_CONSOLIDATION_ENABLED`) — d'où les notes R5/R6 de `pages.md`.
- `.spec/00-canon/canon-distribution/rules-engineering-definition-of-done.md:372-391` : bloc
  d'auto-évaluation repris dans la PR.
- `packages/design-tokens/src/tokens.json` : seule palette consultée pour la colonne « jeton
  existant » (aucune couleur nouvelle).
- `frontend/tests/visual/README.md:27-39` : les références visuelles sont générées dans l'image
  Docker Playwright **1.61.0** contre PREPROD ; nos captures (1.61.1, hors Docker, contre DEV)
  **ne sont pas des références** et ne doivent pas servir de baseline.
- `design-system/UX-CONSTITUTION.md` et `design-system/roles/` n'ont pas été traités comme des
  règles. Aucun concurrent n'a servi de modèle.

## Méthode (résumé)

- Une page par passage, contexte neuf, UA Chrome standard (le motif robot de `root.tsx` contient
  « headless »), chargement puis défilement complet instantané, double rAF.
- **Aucune écriture** : toute requête non-GET est abandonnée par une route Playwright et consignée
  (tableau plus bas). Aucun formulaire soumis, aucun compte, aucun panier.
- Contraste (b) : couleur calculée avec mélange alpha sur la pile de fonds, contrôlée au pixel
  (texte rendu transparent, 10ᵉ centile) ; textes rognés ou recouverts par un élément fixe écartés.
- Bords (c) : champs, listes, cases et boutons sans autre repère visuel, bord contre fond voisin.
- Focus (e) : 40 premiers arrêts au clavier, différence de pixels avant/après, P90 du contraste
  de l'indicateur, recouvrement par un élément fixe, ordre.
- Mouvement (g) : contexte `reducedMotion: "reduce"`, `document.getAnimations()`.
- Sombre (i) : contexte `colorScheme: "dark"`, comparaison des couleurs calculées.
- Détails et seuils : en-tête de chaque script dans `scripts/`.

## Défauts par angle

Tableaux complets générés (aucun chiffre recopié à la main) : [`mesures/tables-readme.md`](mesures/tables-readme.md).
Agrégat : `mesures/synthese.json` (généré à 01:06:37Z). Les extraits ci-dessous en viennent.

### a. axe — WCAG 2.0, 2.1, 2.2, A et AA (32 passages)

| Règle | Impact | Nœuds | Passages | Pages |
|---|---|---|---|---|
| color-contrast | serious | 559 | 32 | toutes |
| nested-interactive | serious | 40 | 2 | r2-produit |
| listitem | serious | 18 | 6 | r2-produit, r5-index, recherche |
| list | serious | 6 | 6 | r2-produit, r5-index, recherche |
| target-size | serious | 4 | 3 | r1-gamme, r2-produit |
| scrollable-region-focusable | serious | 2 | 2 | r3-conseils, r5-diagnostic |
| button-name | critical | 2 | 2 | recherche |
| aria-valid-attr-value | critical | 1 | 1 | r0-accueil |
| link-in-text-block | serious | 1 | 1 | r1-gamme |
| select-name | critical | 1 | 1 | r2-produit |

Fichiers bruts : `mesures/<page>-<390|1440>.json`, clé `axe`.

### b. Contraste des textes (4,5:1, ou 3:1 pour le grand texte) — 249 groupes

Groupes les plus répandus ; la liste entière (249 lignes, avec exemple de texte, taille et graisse)
est dans `mesures/tables-readme.md`, section b. Colonne « jeton existant » : famille du jeton le plus
proche de la couleur fautive, puis, dans cette famille, le jeton le plus proche qui atteint le seuil
sur le même fond ; « hors famille » sinon ; « aucun » si aucun jeton n'y parvient
(`scripts/tables-readme-dz.cjs`). **Ce n'est pas une proposition** : le choix revient au chat 05.

| Couleur / fond peint | Classe rendue | Origine (déduit du code) | Ratio | Pages | Occ. | Jeton existant qui atteint le seuil (ratio) |
|---|---|---|---|---|---|---|
| #f5f6f7 / #13274c | text-white/15 | `Navbar.tsx:512` (« · », `aria-hidden`) et `:516` | 1,59 | 14 | 14 | color.accent.extraLightTurquoise #f3f8f8 (13,78) |
| #f8f8fa / #13264a | text-white/40 | `Navbar.tsx:515` (« Retours 30j ») | 3,55 | 14 | 42 | color.neutral.50 #f5f7fa (13,94) |
| #90a1b9 / #ffffff | text-[10px] text-slate-400 | `layout/BottomNav.tsx:31` | 2,63 | 14 | 65 | color.neutral.400 #6b7280 (4,83) |
| #f97316 / #ffffff | text-[10px] text-cta | `layout/BottomNav.tsx:31` (onglet actif) | 2,80 | 5 | 5 | color.cta.700 #c2410c (5,18) |
| #334056 / #0f1e38 | text-white/15 | `home/Footer.tsx:163,170` | 1,58 | 13 | 26 | color.neutral.300 #9ca3af (6,55) |
| #4b566a / #0f1e38 | text-white/25 | pied de page | 2,26 | 13 | 26 | color.neutral.300 #9ca3af (6,55) |
| #576173 / #0f1e38 | text-white/30, text-[12px] | pied de page (« CGV », « Service client… ») | 2,66 | 13 | 65 | color.neutral.300 #9ca3af (6,55) |
| #6f7888 / #0f1e38 | text-[12px] | pied de page | 3,73 | 13 | 13 | color.neutral.300 #9ca3af (6,55) |
| #3f4b60 / #0f1e38 | text-[10px] | pied de page (« © 2026 AutoMecanik… ») | 1,89 | 12 | 12 | color.neutral.300 #9ca3af (6,55) |
| #f97316 / #ffffff | text-cta | contenu (« Mot de passe oublié ? ») | 2,23 | 3 | 33 | color.cta.700 #c2410c (5,18) |
| #ede9fe / #ffffff | text-violet-100 | contenu R3 (« Diagnostic rapide ») | 1,19 | 3 | 10 | color.primary.400 #4f74b3 (4,69) |
| #99a1af / #ffffff | text-gray-400, hérité, text-[10px] (3 groupes) | contenu | 2,60 | 2 à 3 | 70 | color.neutral.400 #6b7280 (4,83) |
| #99a1af / #f9fafb | text-gray-400 | contenu R3 | 2,49 | 3 | 12 | color.neutral.400 #6b7280 (4,63) |
| #90a1b9 / #ffffff | text-slate-400 | contenu (« (optionnel) ») | 2,58 | 3 | 46 | color.neutral.400 #6b7280 (4,83) |
| #fbfcfc / #ec5e00 | text-white/70 | contenu R3 (« Voir les pièces compatibles → ») | 2,36 | 3 | 3 | color.neutral.900 #212529 (4,53) |
| #0d4473 / #f34d00 | hérité | contenu R3 (« Blog ») | 2,81 | 3 | 3 | color.accent.bleu #031754 (4,68) — hors famille secondary |
| #6a7282 / #f3f4f6 | hérité | 404 (« • Vérifiez l'URL saisie ») | 4,39 | 3 | 11 | color.neutral.500 #4b5563 (6,87) |
| #ffffff / #00a63e | text-[10px] | R7, badge « Essence » | 3,22 | 1 | 4 | color.neutral.800 #1f2937 (4,56) |
| #ffffff / #f54a00 | text-white | 404, bouton « Réessayer » | 3,58 | 1 | 2 | color.neutral.950 #111827 (4,95) |
| #ffffff / #2b7fff | hérité | R1, pastille « 1 » (9 px) | 3,76 | 1 | 10 | color.neutral.950 #111827 (4,72) |
| #ea580c / #fff7ed | text-cta-hover | R5 index (« Sécurité ») | 3,35 | 1 | 16 | color.cta.700 #c2410c (4,88) |
| #62748e / #f1f5f9 | text-[14px], hérité | R0, onglets (« Type Mine », « Moteur ») | 4,35 | 2 | 10 | color.neutral.500 #4b5563 (6,9) |
| #64748b / #f2f5f9 | text-muted-foreground | recherche (« Essayez de modifier vos filtres ») | 4,32 | 1 | 2 | color.neutral.500 #4b5563 (6,91) |

Remarques :

- Les séparateurs « · » de `Navbar.tsx:512` portent `aria-hidden="true"` : décoratifs, ils sortent
  du critère 1.4.3 ; ceux de `:516` et du pied de page n'ont pas cet attribut. Le relevé les compte
  tous ; la zone est notée « contenu » parce que le bandeau de réassurance est hors de `<header>`.
- Le jeton calculé pour un texte clair sur fond sombre est mécaniquement un jeton très clair
  (accent.extraLightTurquoise, neutral.50) : c'est le plus proche en distance RVB, pas un choix.
- **Blanc sur blanc (ratio 1, 6 pages, 111 occurrences ; 3 pages, 49 occurrences)** : le fond calculé
  est faux pour ces groupes. La vérification à la main du cas 8 (« Voir les pièces ») donne 3,76,
  toujours sous 4,5. Ces groupes signalent un défaut probable mais leur ratio n'est pas fiable.

### c. Bords des champs, listes, cases et boutons (3:1) — 29 groupes

| Type et zone | Classes rendues | Origine (déduit du code) | Bord / fond | Ratio | Pages | Jeton existant (ratio) |
|---|---|---|---|---|---|---|
| champ de recherche, en-tête | `border border-white/10` | `Navbar.tsx` | #27354c / #0f1e38 | 1,35 | 14 | color.neutral.400 #6b7280 (3,44) |
| champs (connexion, inscription, recherche, formulaires) | `border border-input ring-offset-background …` | `ui/input.tsx:27` | #e2e8f0 / #ffffff | 1,23 | 5 | color.neutral.400 #6b7280 (4,83) |
| cases (`#newsletterOptIn`, `#acceptTerms`) | `border border-input …` | `ui/checkbox.tsx` | #e2e8f0 / #ffffff | 1,23 | 1 | color.neutral.400 #6b7280 (4,83) |
| listes du sélecteur | `bg-slate-50 border border-slate-200` | `vehicle/VehicleSelector.tsx` | #e2e8f0 / #ffffff | 1,23 | 2 | color.neutral.400 #6b7280 (4,83) |
| liste du sélecteur, état actif | `border-blue-400 ring-1 ring-blue-200` | `vehicle/VehicleSelector.tsx` | #50a2ff / #ffffff | 2,64 | 2 | color.secondary.400 #3387bf (3,92) |
| listes `#brand-v2`, `#year-v2` | `border border-gray-300` | contenu R2 | #d1d5dc / #ffffff | 1,47 | 1 | color.neutral.400 #6b7280 (4,83) |
| liste `#civility` | `border border-slate-200` | inscription | #e2e8f0 / #ffffff | 1,23 | 1 | color.neutral.400 #6b7280 (4,83) |

Liste entière (29 lignes) : `mesures/tables-readme.md`, section c.

### d. Cibles

Sous 24×24 px **sans** exception WCAG 2.5.8 :

| Zone | Texte | Taille | Passages |
|---|---|---|---|
| contenu `#reference` (`a.seo-internal-link`) | (lien) | 135×18 et 63×18 | r1-gamme@1440 |
| contenu (carte d'article) | « Lire notre guide complet… » | 96×20 | r2-produit@390, r2-produit@1440 |

Exceptions appliquées (somme des passages) : espacement (cercle de 24 px libre) 252 ; en ligne 26.

Entre 24 et 44 px dans les zones partagées (liste séparée demandée) :

| Zone | Texte | Taille | Passages |
|---|---|---|---|
| en-tête | AUTOMECANIK | 116,6×24 | 18 |
| en-tête | Catalogue pièces auto, Marques & Constructeurs, Blog | 36,8 de haut | 14 |
| en-tête | Panier, Compte | 39,2 de haut | 14 |
| en-tête | Diagnostic GRATUIT, Inscription | 40 de haut | 14 |
| en-tête | Rechercher une pièce auto | 358×40,8 | 14 |
| pied de page | CGV | 28×44 | 26 |
| sélecteur | Réinitialiser la sélection de véhicule | 42×36 | 2 |

### e. Focus clavier (40 premiers arrêts)

| Zone | Nature | Arrêts | Passages |
|---|---|---|---|
| en-tête | invisible | 26 | 26 |
| contenu | contraste < 3:1 | 96 | 18 |
| contenu | masqué par un élément fixe | 66 | 16 |
| contenu | invisible | 25 | 8 |
| contenu | hors écran (non conclu, voir limites) | 123 | 18 |
| pied de page | < 3:1 / invisible / masqué | 2 / 5 / 6 | 2 / 3 / 3 |
| chat | < 3:1 | 3 | 3 |
| sélecteur | < 3:1 | 2 | 2 |

Pertes de focus (retour sur `body`) : après « Référence » (R0, 390 et 1440) et après « Type Mine »
(R1, 390 et 1440). Mesuré par `sonde-focus-marque-dz.cjs` (`mesures/focus-marque-*.json`, 00:51Z) :
après la tabulation, la liste Marque affiche « Chargement... » et est `disabled` (relevés à 19 et
31 ms), devient active vers 100 ms, mais le focus reste sur `body` jusqu'au dernier relevé
(2,5 s). Cause probable, **déduite du code** : `onFocus={onSelectorInteraction}` déclenche le
chargement et `disabled={loadingBrands}` désactive la liste qui vient de recevoir le focus
(`VehicleSelector.tsx:396-397`). Les autres pertes suivent le
bouton de chat fixe, dernier arrêt du cycle : comportement attendu.

Hors des composants partagés, `focus:ring-blue-500` compte 175 emplois dans 52 fichiers
(**déduit du code**, `mesures/comptes-code.txt`).

### f. Typographie

| Constat | Mesure | Passages |
|---|---|---|
| Textes < 12 px, barre mobile | 5 à chaque passage 390 (« Accueil », « Catalogue »…, 10 px) | 14 |
| Textes < 12 px, en-tête | 1 à 1440 | 14 |
| Textes < 12 px, contenu | jusqu'à 30 (r0-accueil@1440, r2-produit@1440) | — |
| Paragraphes > 3 lignes au-delà de 80 caractères | r5-diagnostic 5/6, r1-gamme 2/5, r3, r4, r5-index, r6, r7 : 1 chacun (1440) | 7 |
| Outfit 900 demandée | non chargée, rendue en 800 | r0, r2, r8 |
| DM Sans 900 demandée | non chargée, rendue en 700 | r2 |
| DM Sans 800 demandée | non chargée, rendue en 700 | r5-index |
| ui-monospace | aucune police web, police de secours | r2, r3, r5-diagnostic et suivants (liste tronquée : `tables-readme.md`, section f) |

Déduit du code : `global.css:24-52` déclare Outfit en 400–800 et DM Sans en 400–700.

### g. Mouvement avec « réduire les animations »

| Passage | Animations en cours | Sans fin | scroll-behavior |
|---|---|---|---|
| r0-accueil (390, 1440) | 2 | ping 1 s (hero) ; marquee 60 s (marques) | smooth |
| r1-gamme (390, 1440) | 4 | ping ; subtle-float 3 s ; shimmer | smooth |
| r7-marque (390, 1440) | 2 | shimmer ×2 | smooth |
| recherche (390, 1440) | 1 | pulse 2 s | smooth |
| autres pages | 0 | — | smooth |

Déduit du code : la règle `prefers-reduced-motion` ne vise que `.shimmer-anim, .marquee-anim`
(`global.css:919-925`) ; `animations.css` est chargé en `media=print` puis basculé (`root.tsx:416-423`) ;
`scroll-behavior: smooth` est posé en style en ligne par `hooks/useScrollBehavior.ts:15`, appelé
depuis `root.tsx:207`, sans condition sur la préférence.

### h. Images et stabilité

| Passage | Images | Sans width/height ni aspect-ratio | Priorité haute | CLS après défilement |
|---|---|---|---|---|
| r7-marque (390 / 1440) | 37 | 25 | 1 | 0 / 0,023 |
| r8-vehicule (390 / 1440) | 28 | 27 | 1 | 0 / 0,0004 |
| r4-reference (390 / 1440) | 1 | 1 | 0 | 0 / 0,0048 |
| r2-produit (390 / 1440) | 52 | 0 | 3 | **0,9179 / 0,5814** |
| r1-gamme (390 / 1440) | 26 | 0 | 1 | 0,0581 / **0,4103** |

CLS au chargement (avant défilement) : au plus 0,0226 sur les 32 passages. LCP de laboratoire :
160 à 1716 ms. Ce sont des mesures de laboratoire sur un serveur de développement, pas des
données terrain. Code : 55 balises `<img>` sur 108 sans dimension dans la balise (heuristique,
`.tsx`, **déduit du code**).

### i. Mode sombre

Avec `colorScheme: "dark"`, aucune couleur calculée ne change sur les 32 passages
(`synthese.json`, clé `sombre`). Déduit du code : aucune activation de thème sombre trouvée
(recherche de `classList` `dark`, `setTheme`, `data-theme` dans `frontend/app`, hors utilitaires
`dark:` ; périmètre et commande dans `scripts/compte-code-dz.sh`).

## 6.3 et 6.4 — 320 px, zoom 200 %, espacements WCAG 1.4.12

| Contrôle | Résultat | Pages |
|---|---|---|
| Défilement horizontal à 320×640 | 0 dépassement | 16 / 16 |
| Zoom 200 % : défilement horizontal, textes coupés | non / 0 | 16 / 16 |
| Zoom 200 % : recouvrements (heuristique) | r2 4, r3 2, r5-diagnostic 5, r6 2, r7 2 | 5 |
| Zoom 200 % : contrôles masqués par un élément fixe | 2 à 23 (r2-produit 23, recherche 14, r0 11, r1 9) | 14 |
| Espacements 1.4.12 : « Diagnostic GRATUIT » de l'en-tête | coupé, 47 px | 14 pages qui l'affichent |
| Espacements 1.4.12 : recouvrements (heuristique) | r0, r1, r2, r3, r5-diagnostic, r7, r8 (contenu) | 7 |

La sonde `sonde-superpositions-dz.cjs` a repris jusqu'à 3 paires par page et par condition sur
r0, r1, r2, r3, r5-diagnostic, r6 et r7 (19 paires) : 11 ont une capture
(`captures/superposition-*.jpg`), 8 n'ont pas été retrouvées au nouveau rendu (r2 : 4 dont une
erreur de sélecteur ; r7 : 2 ; détail dans `mesures/superpositions-<page>.json`) ; l'en-tête avant/après espacements est dans
`captures/entete-1280-espacements-{sans,avec}.jpg` (00:54:57Z).

## 6.5 — Sélecteur de véhicule (R0 et R1)

| État | 390 | 1440 |
|---|---|---|
| Repos (+ champs désactivés) | 4 textes sous le seuil | 0 |
| Survol | sans objet (tactile) | 0 défaut |
| Focus clavier sur Marque (P90 / max de l'indicateur) | R0 2,2 / 2,2 ; R1 1,58 / 9,65 | 18,19 / 18,19 |
| Ouvert | **non mesurable** : `<select>` natif, liste dessinée par le navigateur | idem |
| Désactivé | compris dans « repos » (Modèle, Motorisation) | idem |
| Chargement (réponse retardée 5 s) | aucun `aria-busy`, aucun indicateur ; liste inactive | aucun indicateur |
| Erreur (GET brands abandonné volontairement) | « Erreur de chargement. Cliquez pour réessayer. » — #e7000b sur #fef2f2, 4,36 ; 5 textes sous le seuil | 1 texte sous le seuil |

Bords du sélecteur : 1,23 (repos) et 2,64 (actif, `border-blue-400`). Captures :
`captures/selecteur-<page>-<taille>-<état>.jpg`. Fichiers bruts : `mesures/selecteur-*.json`.

## Composants partagés — pages touchées

Généré par `scripts/composants-dz.cjs` (`mesures/composants.md`, 01:08:36Z), 16 pages.

| Composant | Fichier (déduit du code) | Pages où il est relevé | Texte sous seuil | Bord < 3:1 | Cible < 24 sans exception | Focus en défaut |
|---|---|---|---|---|---|---|
| en-tête | `components/Navbar.tsx` | 16 | 1 | 14 | 0 | 13 |
| pied de page | `components/home/Footer.tsx` | 15 | 15 | 0 | 0 | 6 |
| barre mobile | `components/layout/BottomNav.tsx` | 14 | 14 | 0 | 0 | 0 |
| sélecteur de véhicule | `components/vehicle/VehicleSelector.tsx` | 2 | 2 | 2 | 0 | 2 |
| bouton | `components/ui/button.tsx` | 1 | 0 | 0 | 0 | non attribuable |
| champ | `components/ui/input.tsx` | 5 | 0 | 5 | 0 | non attribuable |
| case à cocher | `components/ui/checkbox.tsx` | 1 | 0 | 1 | 0 | non attribuable |
| carte | `components/ui/card.tsx` | 4 | 3 | 0 | 0 | non attribuable |
| onglets | `components/ui/tabs.tsx` | 0 | — | — | — | non relevé |
| menu déroulant | `components/ui/dropdown-menu.tsx` | 0 | — | — | — | non relevé |

Les primitives `ui/*` sont reconnues par leur jeu de classes rendu ; les arrêts de focus ne gardent
pas les classes, d'où « non attribuable ». Les onglets de R0 sont un composant propre à la page, pas
`ui/tabs` ; le menu déroulant n'apparaît que sur action (non ouvert : aucun clic hors lecture).

## 6.8 — Verdicts sur les affirmations du point 3

| Affirmation (relevé du chat, 21:18–21:21 UTC) | Verdict | Preuve |
|---|---|---|
| Orange de marque en texte sur fond clair : 2,80 (cta.500) | **confirmé** | #f97316 sur blanc : 2,80 (barre mobile, 5 pages) ; 2,23 en 12 px (`text-cta`, 3 pages) |
| … 3,56 (cta.600) | **non observé tel quel** | #ea580c observé seulement sur #fff7ed : 3,35 (r5-index). Aucun #ea580c sur blanc dans le rendu des 16 pages |
| Blanc sur boutons jaune 1,91, vert 3,22, orange 3,59, destructive 3,60 (`ui/button.tsx:13-28`) | **partiellement confirmé** | vert 3,22 confirmé (blanc sur #00a63e, badge r7, hors `ui/button`) ; orange : blanc sur #f54a00 = 3,58 (404 « Réessayer ») ; jaune et destructive **non observables** (aucun rendu sur les 16 pages) |
| Gris 400 en texte 2,60 (452 emplois) | **confirmé** pour le ratio | #99a1af sur blanc 2,60 ; 2,49 sur #f9fafb. Comptage du code : 342 `text-gray-400` + 95 `text-slate-400`, 382 préfixes `gray-400` (déduit, `comptes-code.txt`) |
| Texte atténué sur fond atténué 4,34 (`ui/tabs.tsx:15`) | **confirmé en valeur, non observé sur `ui/tabs`** | 4,32 (`text-muted-foreground`, recherche) et 4,35 (onglets propres à R0) ; `ui/tabs` non rendu |
| Bords des champs 1,23 à 1,47 (`ui/input.tsx:27`) | **confirmé** | 1,23 (`border-input`) à 1,47 (`border-gray-300`) ; 1,35 dans l'en-tête |
| Focus hors composants partagés : `focus:ring-blue-500` (175), `ui/dropdown-menu.tsx` sans anneau | **confirmé pour le contraste faible ; menu non observable** | 96 arrêts < 3:1 dans le contenu, 26 invisibles dans l'en-tête ; 175 emplois comptés (déduit) ; menu déroulant jamais ouvert |
| Graisses 800 et 900 non chargées | **900 confirmé ; 800 réfuté pour Outfit, confirmé pour DM Sans** | Outfit 800 chargée (plage 400–800) ; Outfit 900 → 800 ; DM Sans 800 et 900 → 700 |
| « Réduire les animations » n'arrête que deux animations (`global.css:920-925`) | **confirmé** | ping, marquee, subtle-float, shimmer, pulse restent actifs avec la préférence |
| 57 images sur 110 sans dimension | **confirmé en ordre de grandeur** | comptage du code : 55/108 (heuristique différente, déduit) ; rendu : r7 25/37, r8 27/28, r4 1/1 |
| Aucun code n'active le thème sombre | **confirmé** | aucun changement en `colorScheme: dark` ; aucune activation trouvée dans `frontend/app` |
| DS : pied de page (4 textes) et barre mobile (5 textes) sous 4,5:1 | **confirmé, et davantage** | pied de page : 6 groupes de 1,58 à 3,73, chacun sur 12 à 13 pages ; 15 pages ont au moins un texte du pied de page sous le seuil (`composants.md`) ; barre mobile : 5 textes à 2,63 (actif : 2,80) sur 14 pages |
| DS : règle globale `scroll-behavior: smooth` | **confirmé** ; origine précisée | style en ligne posé par `useScrollBehavior.ts:15` ; aucune règle CSS trouvée (`comptes-code.txt`) |

## Vérifications à la main (point 9)

Recalcul indépendant : captures PNG du texte puis du même cadre texte masqué
(`scripts/verif-manuelle-dz.cjs`), décodage PNG et formule WCAG réécrits en Python standard
(`scripts/verif-manuelle-dz.py`). Fichier : `mesures/verif-manuelle.json` (00:56Z).

| Cas | Nature | Page | Texte | Texte / fond peints | Ratio recalculé | Relevé automatique |
|---|---|---|---|---|---|---|
| 1 | fond uni | r0-accueil@390 | Catalogue | #90a1b9 / #ffffff | 2,63 | 2,63 — identique |
| 2 | fond dégradé | r1-gamme@390 | Accueil | #0e3b68 / #0f1e39 | 1,46 | défaut confirmé |
| 3 | fond semi-transparent | r0-accueil@1440 | 19 | #f97e50 / #fef1e7 | 2,33 | défaut confirmé |
| 4 | texte semi-transparent | r0-accueil@390 | Compatibilité vérifiée | #96acb0 / #1b2f55 | 5,57 | conforme, confirmé |
| 5 | fond translucide sur photo | r0-accueil@1440 | Alternateur | #314158 / #fffeff | 10,29 | conforme, confirmé |
| 6 | texte blanc sur photo | r3-conseils@1440 | 9/2001 - 5/2005 | #ffffff / #f8f9fa | 1,05 | défaut confirmé |
| 7 | fond uni clair | r3-conseils@1440 | Diagnostic rapide | #efe9fe / #ffffff | 1,18 | 1,19 — confirmé |
| 8 | blanc sur fond calculé blanc | r1-gamme@1440 | Voir les pièces | #ffffff / #7b839f | **3,76** | relevé : 1 — **ratio faux**, défaut maintenu sous 4,5 |

Le cas 8 montre la limite du calcul sur ces groupes (fond peint par une image ou un dégradé non
pris en compte) : voir « Limites ».

## Requêtes abandonnées (toutes exécutions)

| Requête | Nombre | Raison |
|---|---|---|
| POST /api/seo/cwv/beacon | 520 | non GET |
| POST /api/attribution/landing | 240 | non GET |
| POST /api/seo/track-impression | 28 | non GET |
| POST /api/seo/funnel/event | 26 | non GET |
| POST /api/seo/runtime-event | 13 | non GET |
| GET /api/vehicles/brands | 4 | abandon volontaire pour provoquer l'état « erreur » du sélecteur |

Les loaders SSR s'exécutent côté serveur sur chaque GET de page (par exemple la lecture du panier
dans le loader racine) : le navigateur ne les voit pas et ne peut pas les filtrer. Aucune écriture
n'a été demandée par ce mandat ; l'absence d'écriture côté serveur n'est pas vérifiable d'ici.

## Limites et inconnues

- **DEV seulement** (serveur Vite de développement). Rien ne dit que PREPROD ou PROD rendent la
  même chose (P1). Aucune donnée terrain (CrUX, Search Console : hors périmètre).
- **Une page par type** : les comptes « pages touchées » portent sur 16 pages, pas sur le site.
- **R5** : l'URL R5 choisie est redirigée (301) vers R3 ; seule la page index R5 est rendue.
- **Commande** : non mesurable sans écriture.
- **Blanc sur blanc** : ratio 1 non fiable (cas 8 : 3,76). Le défaut reste probable, la valeur non.
- **Focus « hors écran »** (123 arrêts) : arrêts dont l'indicateur n'a pas pu être capturé dans la
  fenêtre ; non conclus, ni conformes ni en défaut.
- **Recouvrements** à 200 % et en espacements : heuristique géométrique. 11 paires ont une
  capture, aucune n'a été validée une à une à l'œil ; 8 paires n'ont pas été retrouvées au
  nouveau rendu (r2, r7). La sonde n'a pas été lancée sur r4, r5-index, r8 ni sur les pages hors
  catalogue (r4 : aucun recouvrement relevé ; r5-index ajoutée après la sonde ; r8 : recouvrement
  en espacements non capturé).
- **Liste ouverte du sélecteur** : `<select>` natif, non mesurable en rendu.
- **Onglets `ui/tabs` et menu `ui/dropdown-menu`** : non rendus ou non ouverts sur les 16 pages.
- **Survol** : sans objet à 390 px (tactile) ; mesuré seulement sur la liste Marque à 1440.
- **Captures** : Playwright 1.61.1 hors Docker, contre DEV ; ce ne sont pas des références
  visuelles (`frontend/tests/visual/README.md:27-39`). Les captures pleine page sont des JPEG
  recompressés en qualité 28 pour tenir sous 20 Mo : lisibles, pas exploitables au pixel. Les
  vérifications au pixel ont été faites sur PNG avant recompression (`captures/verif-*.png`).
- **Compactage JSON** : `mesures/*.json` réécrits sans indentation, contenu vérifié identique
  (`assert.deepStrictEqual`).
- **Comptages de code** : heuristiques `rg`/`grep`, périmètre écrit dans `compte-code-dz.sh` ;
  ils ne prouvent pas un rendu.
- **Moteur** : Chromium seul ; ni Safari ni Firefox.
- **Absences affirmées** : toujours limitées à leur périmètre (16 pages × 2 tailles, ou dossier
  de code cité).

## Constats hors périmètre (signalés, non traités)

- La recherche `/search?q=filtre+a+huile` renvoie 0 résultat sur DEV (00:33Z).
- Consolidation R5 → R3 : les 10 URL `/diagnostic-auto/<slug>` liées depuis l'index redirigent
  vers des articles conseils (01:03:49Z).
- `/legal` répond 302 vers `/legal/cgv`.

## Scripts et commandes exactes

Tous les scripts sont écrits pour ce mandat. **Aucun script n'est repris du mandat DU** (branche de
#2211) ni de `frontend/tests/visual/`. Sauf mention, depuis `docs/audit/design-system-revue-20261119/` :

| Script | Rôle | Commande |
|---|---|---|
| `scripts/pages-dz.tsv` | liste des pages (id, chemin) | — |
| `scripts/lib-dz.cjs` | bibliothèque commune (contexte, abandon des non-GET, contraste) | — |
| `scripts/run-dz.sh` | point d'entrée, une mesure à la fois, chacune sous `timeout` | `NODE_PATH=/opt/automecanik/app/node_modules bash scripts/run-dz.sh [mesure\|reflow\|selecteur\|focus-marque\|feuilles\|verif\|synthese\|tout] [motif-id]` |
| `scripts/mesure-dz.cjs` | 6.2 a–i, captures | `timeout 140 node scripts/mesure-dz.cjs <id> <chemin> <390\|1440> <844\|900> .` |
| `scripts/reflow-dz.cjs` | 6.3, 6.4 | `timeout 120 node scripts/reflow-dz.cjs <id> <chemin> .` |
| `scripts/selecteur-dz.cjs` | 6.5 | `timeout 280 node scripts/selecteur-dz.cjs <id> <chemin> <W> <H> .` |
| `scripts/sonde-focus-marque-dz.cjs` | perte de focus du sélecteur | `timeout 150 node scripts/sonde-focus-marque-dz.cjs <id> <chemin> <W> <H> .` |
| `scripts/sonde-feuilles-dz.cjs` | feuilles CSS et animations avec/sans préférence | `timeout 200 node scripts/sonde-feuilles-dz.cjs r0-accueil / <W> <H> .` |
| `scripts/sonde-superpositions-dz.cjs` | captures des recouvrements | `export NODE_PATH=/opt/automecanik/app/node_modules; grep -E "^(r0\|r1\|r2\|r3\|r5\|r6\|r7)" scripts/pages-dz.tsv \| while IFS=$'\t' read -r id route; do timeout 110 node scripts/sonde-superpositions-dz.cjs "$id" "$route" .; done` (exécutée avant l'ajout de r5-index) |
| `scripts/sonde-entete-espacements-dz.cjs` | en-tête avec espacements 1.4.12 | `NODE_PATH=/opt/automecanik/app/node_modules timeout 100 node scripts/sonde-entete-espacements-dz.cjs .` |
| `scripts/verif-manuelle-dz.cjs` + `.py` | point 9 | `timeout 300 node scripts/verif-manuelle-dz.cjs .` puis `timeout 120 python3 -I scripts/verif-manuelle-dz.py .` |
| `scripts/synthese-dz.cjs` | agrégat | `node scripts/synthese-dz.cjs .` |
| `scripts/composants-dz.cjs` | composants partagés | `node scripts/composants-dz.cjs > mesures/composants.md` |
| `scripts/tables-readme-dz.cjs` | tableaux | `node scripts/tables-readme-dz.cjs ../../../packages/design-tokens/src/tokens.json > mesures/tables-readme.md` |
| `scripts/jetons-dz.cjs` | ratio des jetons existants | `node scripts/jetons-dz.cjs ../../../packages/design-tokens/src/tokens.json <fond #rrggbb> <seuil> [famille]` ou `--liste` |
| `scripts/statuts-dz.sh` | statuts HTTP sans redirection (GET) | `bash scripts/statuts-dz.sh > mesures/statuts-pages.tsv` |
| `scripts/compte-code-dz.sh` | comptages dans le code (depuis la racine du worktree) | `bash docs/audit/design-system-revue-20261119/scripts/compte-code-dz.sh > docs/audit/design-system-revue-20261119/mesures/comptes-code.txt` |
| `scripts/recompression-dz.sh` | JPEG pleine page en qualité 28 — **exécuté une fois, ne pas relancer** (chaque passage dégrade) | `bash scripts/recompression-dz.sh` |
| `scripts/compactage-json-dz.cjs` | JSON sans indentation, vérifié | `node scripts/compactage-json-dz.cjs` |

Une relance reproduit la méthode, pas les chiffres : DEV et ses données changent.

## Contenu du dossier

- `README.md` (ce fichier), `pages.md`.
- `mesures/` : un JSON par passage (`<page>-<390|1440>.json`, `<page>-reflow.json`), sondes
  (`selecteur-*`, `focus-marque-*`, `feuilles-*`, `superpositions-*`, `entete-espacements.json`),
  `synthese.json`, `tables-readme.md`, `composants.md`, `statuts-pages.tsv`, `comptes-code.txt`,
  `verif-manuelle*.json`.
- `captures/` : premier écran et page entière par passage, zoom 200 %, états du sélecteur,
  recouvrements, cas de vérification.
- `scripts/` : ci-dessus.
