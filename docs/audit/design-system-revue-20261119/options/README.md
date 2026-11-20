# Options de couleurs en images — compléments n° 2, n° 3 et n° 4 au mandat DZ

**Maquette par feuille injectée, pas une implémentation.** Rien n'est en vigueur. Les décisions 45, 55
et 57 sont inchangées. Aucun fichier du frontend, des jetons ni de Tailwind n'est modifié : chaque
option est une feuille CSS injectée par Playwright (`page.addStyleTag`) après le chargement de la page
servie par DEV. Le choix entre les options appartient à l'owner et au chat 05.

| | |
|---|---|
| Accord | Marwane, 20 nov. 2026 à 09:37 heure de Tunis (complément n° 2, options A et B) ; 10:13 heure de Tunis (complément n° 3, option C « bouton d'achat vert », page produit seulement) ; 11:06 heure de Tunis (complément n° 4, option A2 : logo orange, action principale de chaque page en orange) |
| AVANT | DEV `http://127.0.0.1:3000`, servant `7f4dded37d068286e467ff69f0c4b2fcdacb0232` (origin/main) ; `frontend/` et `packages/design-tokens/` y sont identiques à la base de la PR `7368d72d` |
| Pages | `r0-accueil` `/`, `r1-gamme` `/pieces/filtre-a-huile-7.html`, `r2-produit` `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html`, `panier-vide` `/cart`, `connexion` `/login` ([`scripts/pages-options-dz.tsv`](scripts/pages-options-dz.tsv)) |
| Tailles | 390×844 (mobile tactile) et 1440×900 |
| Feuilles mesurées | [`option-a.css`](option-a.css) `2e00e790…ead3d`, [`option-b.css`](option-b.css) `2d63b7ca…ea5f570` (SHA-256 complets en fin de page), 63 règles chacune ; [`option-c.css`](option-c.css) `07d5b10d…af0f93`, 63 règles, mesurée sur `r2-produit` seulement ([§ Option C](#option-c--bouton-dachat-vert-complément-n-3)) ; [`option-a2.css`](option-a2.css) `1bef7ff9…630a64`, 67 règles, cinq pages ([§ Option A2](#option-a2--logo-et-action-principale-en-orange-complément-n-4)) |
| Fenêtre | AVANT 08:53Z → 09:03Z ; captures A/B 09:34Z → 09:45Z ; mesures A/B 09:34:33Z → 09:51:47Z (2026-11-20) |
| Garde-fous | toute requête non GET abandonnée (journal dans chaque JSON), aucun clic ni saisie, aucun formulaire envoyé ; traceurs tiers bloqués |

## Les options (jeu réduit)

| Point | AVANT (main) | OPTION A | OPTION B | OPTION C (n° 3, r2 seulement) | OPTION A2 (n° 4) |
|---|---|---|---|---|---|
| 1. Structure | navy `#0F1E38` et dégradés de marque (bandeau R2 noir → jaune) | navy `#0F1E38`, bandeau R2 navy | identique à A | identique à A | identique à A ; logo « MECANIK » garde `#F97316` sur navy (5,93:1) ; fil d'Ariane sur navy (r1) en `#9CA3AF` (6,55:1), page courante blanche |
| 2. Achat seul | « Ajouter » navy, « Panier » collant `#FF6900` texte noir, « Se connecter » `#F97316` texte noir | fond `#F97316`, texte navy, survol `#EA580C` | fond `#C2410C`, texte blanc, survol `#9A3412` | fond `#1E8449` (jeton semantic.success), texte blanc, survol `#196F3D` **(valeur NOUVELLE, absente des jetons : semantic.success n'a pas d'échelle)** | action principale de chaque page : fond `#F97316`, texte navy, survol `#EA580C` ; désactivé fond `#FED7AA` (cta.200), texte navy, opacité 1 |
| 3. Orange ailleurs | orange, ambre, jaune décoratifs sur toutes les pages | retirés ; onglet actif de la barre mobile en navy, graisse 800 | identique à A | identique à A | identique à A, hors logo et action principale |
| 4. Liens, actions secondaires | bleus bruts (`blue-400` à `blue-900`, `semantic-action`) | `#0F4C81` ; bleu de surface → navy | identique à A | identique à A | identique à A |
| 5. Texte | titres et textes de plusieurs gris (`slate-300` à `slate-500`) | titres navy, courant `#1F2937`, secondaire `#4B5563` ; sur navy ≥ `#9CA3AF` | identique à A | identique à A | identique à A |
| 6. Bords de champ | `#E2E8F0` (1,23:1), `#E5E7EB` (1,24:1), `#50A2FF` (2,64:1) ; sur navy `#27354C` (1,35:1) | `#6B7280` (sur navy `#9CA3AF`) | identique à A | identique à A | identique à A |
| 7. États | verts, rouges, ambres variés | succès `#1E8449`, erreur `#C0392B`, avertissement fond `#FEF3C7` **(valeur NOUVELLE, absente des jetons)**, texte `#1F2937` | identique à A | identique à A ; le succès garde `#1E8449`, la même couleur que le bouton d'achat, volontairement | identique à A |
| 8. Focus | contour 1 px auto (ambre `#E59700` sur r2 390) ou absent | 2 px navy ; sur fond navy, 2 px blanc doublés d'un liseré navy | identique à A | identique à A | identique à A |
| 9. Violets, roses, corail, vert vif | présents (dégradés, pastilles, filets au survol) | ramenés à navy, `#0F4C81` ou gris | identique à A | identique à A | identique à A |

Jetons repris de `packages/design-tokens/src/tokens.json` : navy `#0F1E38`, secondary/info `#0F4C81`,
neutral.800 `#1F2937`, neutral.500 `#4B5563`, neutral.300 `#9CA3AF`, neutral.400 `#6B7280`,
neutral.100 `#E5E7EB`, neutral.50 `#F5F7FA`, success `#1E8449`, danger `#C0392B`, cta.500 `#F97316`,
cta.600 `#EA580C`, cta.700 `#C2410C`, cta.800 `#9A3412`. Valeurs nouvelles : `#FEF3C7` (A, B, C) et `#196F3D`
(survol de C seulement). A2 n'ajoute aucune valeur : cta.200 `#FED7AA` est un jeton existant.

## Planches

Une planche par page et par taille : les trois premiers écrans AVANT / A / B côte à côte, étiquetés.

| Page | 390×844 | 1440×900 |
|---|---|---|
| r0-accueil | [planches/r0-accueil-390.webp](planches/r0-accueil-390.webp) | [planches/r0-accueil-1440.webp](planches/r0-accueil-1440.webp) |
| r1-gamme | [planches/r1-gamme-390.webp](planches/r1-gamme-390.webp) | [planches/r1-gamme-1440.webp](planches/r1-gamme-1440.webp) |
| r2-produit | [planches/r2-produit-390.webp](planches/r2-produit-390.webp) | [planches/r2-produit-1440.webp](planches/r2-produit-1440.webp) |
| panier-vide | [planches/panier-vide-390.webp](planches/panier-vide-390.webp) | [planches/panier-vide-1440.webp](planches/panier-vide-1440.webp) |
| connexion | [planches/connexion-390.webp](planches/connexion-390.webp) | [planches/connexion-1440.webp](planches/connexion-1440.webp) |

Bouton d'achat seul de r2-produit, agrandi 4×, AVANT / A / B × repos / survol / focus / désactivé :
[planches/bouton-r2-produit-390-ajouter.webp](planches/bouton-r2-produit-390-ajouter.webp) et
[planches/bouton-r2-produit-1440-ajouter.webp](planches/bouton-r2-produit-1440-ajouter.webp).

Captures : `captures/<page>-<taille>-<avant|a|b>-ecran.webp` (premier écran) et `-page.webp` (page
entière, 1440 réduite à 50 %) ; recadrages de chaque bouton d'achat et de chaque état dans
`captures/boutons/`.

## Défauts mesurés AVANT / A / B

Même outil que la revue DZ (`../scripts/mesure-dz.cjs`, enveloppé par `scripts/mesure-option-dz.cjs`) :
texte sous son seuil WCAG (4,5:1, ou 3:1 pour un grand texte, ratio retenu sur les pixels quand le fond
est une image ou un dégradé), bord de champ ou de bouton contour sous 3:1, focus clavier invisible,
sous 3:1 ou masqué par un élément fixe (20 arrêts de tabulation), règle axe `color-contrast`.
Condensé : [`mesures/synthese-options-dz.json`](mesures/synthese-options-dz.json) et
[`mesures/synthese-options-dz.md`](mesures/synthese-options-dz.md).

| Passage | Textes sous seuil (AVANT / A / B) | Bords sous 3:1 | Focus invisible ou masqué | axe color-contrast |
|---|---|---|---|---|
| r0-accueil-390 | 39 / 3 / 3 | 3 / 0 / 0 | 12 / 4 / 5 | 31 / 0 / 0 |
| r0-accueil-1440 | 41 / 4 / 4 | 3 / 0 / 0 | 3 / 0 / 0 | 26 / 1 / 1 |
| r1-gamme-390 | 79 / 2 / 2 | 3 / 0 / 0 | 14 / 6 / 6 | 25 / 0 / 0 |
| r1-gamme-1440 | 76 / 2 / 2 | 3 / 0 / 0 | 1 / 0 / 0 | 21 / 0 / 0 |
| r2-produit-390 | 97 / 0 / 0 | 22 / 20 / 20 | 25 / 15 / 15 | 9 / 0 / 0 |
| r2-produit-1440 | 105 / 3 / 3 | 21 / 20 / 20 | 5 / 2 / 2 | 5 / 0 / 0 |
| panier-vide-390 | 8 / 0 / 0 | 1 / 0 / 0 | 5 / 3 / 3 | 6 / 0 / 0 |
| panier-vide-1440 | 5 / 0 / 0 | 1 / 0 / 0 | 1 / 0 / 0 | 1 / 0 / 0 |
| connexion-390 | 8 / 0 / 0 | 2 / 0 / 0 | 7 / 3 / 3 | 5 / 0 / 0 |
| connexion-1440 | 8 / 0 / 0 | 2 / 0 / 0 | 2 / 0 / 0 | 5 / 0 / 0 |
| **Total** | **466 / 14 / 14** | **61 / 40 / 40** | **75 / 33 / 34** | **134 / 1 / 1** |

**Aucun défaut introduit par une option.** Chaque défaut A ou B a été rapproché de la liste AVANT
(même sélecteur, même texte) : aucun n'est nouveau. Trois défauts introduits par une première version
de la feuille (texte `slate-300` rendu `#4B5563` sur les onglets sombres de r0 et r1, bandeau véhicule
R2 sombre en mobile mais blanc à partir de 768 px, anneau blanc tracé autour d'un bouton sombre posé sur
fond clair) ont été corrigés avant les mesures publiées ici.

Les ratios ont aussi été comparés, défaut par défaut. Un seul baisse : r0-accueil 390, description
des cartes de famille (« Le système de filtration… », `text-slate-400`), ratio retenu sur les pixels
2,4 → 1,27. C'est un artefact de la mesure par pixels, pas une aggravation : le ratio calculé passe de
2,63 (`#90A1B9` sur blanc) à 7,56 (`#4B5563` sur blanc), la médiane des pixels est 7,04, et la carte
(animée par `animate-reveal-up`) recadrée sans animation montre un texte nettement plus lisible en A :
[`captures/verifications/r0-accueil-390-carte-filtres-avant-a.webp`](captures/verifications/r0-accueil-390-carte-filtres-avant-a.webp)
(gauche AVANT, droite A). Il reste compté dans le tableau, tel que l'outil l'a mesuré. Un défaut
s'améliore sans passer le seuil : « Numéros de pièce d'origine » à 1440 (1,49 → 2,54 ; la surface est
blanche à partir de 768 px alors que la règle la traite comme sombre). Les autres ont le même ratio.

**Ce qui reste en A et B** et que le jeu réduit ne traite pas :

| Nature (classe ou zone) | A | B | Exemple |
|---|---|---|---|
| bord · bouton « Sélectionner Filtre à hui » | 40 | 40 | r2-produit-390 #e2e8f0 sur #ffffff : 1.23 |
| focus masqué par un élément fixe · contenu | 27 | 27 | r1-gamme-390 « FAQ » |
| texte · absolute top-3 right-3 px-2 py-0.5 bg-neutral-900/20 backdro | 4 | 4 | r0-accueil-1440 « 5 min » #ffffff sur #c8cbcf : 1.5 |
| focus masqué par un élément fixe · contenu#radix-_R_1d1 | 4 | 4 | r0-accueil-390 « Courroie d'accessoire » |
| texte · hover:text-white/50 transition-colors | 4 | 4 | r1-gamme-390 « Accueil » #0d4473 sur #f5f7fa : 1.64 |
| focus masqué par un élément fixe · contenu#bien-choisir | 2 | 2 | r1-gamme-390 « 3 Compatibilité huile lon » |
| texte · text-[12px] text-slate-400 mb-3 line-clamp-1 leading-relaxed | 2 | 2 | r0-accueil-390 « Le système de filtration du vé » #4b5563 sur #ffffff : 1.27 |
| texte · text-slate-300 text-sm mt-1 | 1 | 1 | r2-produit-1440 « Numéros de pièce d'origine pou » #9ca3af sur #ffffff : 2.54 |
| texte · text-white font-bold text-xs | 1 | 1 | r2-produit-1440 « 22 » #ffffff sur #ffffff : 3.14 |
| texte · text-white/60 text-[10px] ml-1 | 1 | 1 | r2-produit-1440 « résultat s » #ffffff sur #ffffff : 1.48 |
| texte · absolute top-4 right-4 px-2.5 py-1 bg-neutral-900/20 backdro | 1 | 1 | r0-accueil-390 « 5 min » #ffffff sur #c8cbcf : 1.5 |
| focus sous 3:1 · contenu | 0 | 1 | r0-accueil-390 « Par véhicule » |

## Résidus de couleur hors jeu

Scanner de `scripts/options-captures-dz.cjs` : chaque élément visible (taille et opacité non nulles),
propriétés `color`, `background-color`, dégradés, `border-color`, `outline-color`, `fill`, `stroke`,
ombres ; une couleur saturée hors de navy, `#0F4C81`, `#1E8449`, `#C0392B`, `#FEF3C7` (et, sur le seul
bouton d'achat, les deux couleurs de l'option) est un résidu. Au survol : `:hover` forcé par le
protocole Chrome (`CSS.forcePseudoState`) sur tous les éléments porteurs d'une classe `hover:` et sur
tous les groupes `group`, en même temps, sans clic ni déplacement de souris.

| Passage | Résidus au repos (AVANT / A / B) | Résidus au survol forcé | Éléments survolés |
|---|---|---|---|
| r0-accueil-390 | 243 / 0 / 0 | 319 / 0 / 0 | 469 |
| r0-accueil-1440 | 283 / 0 / 0 | 363 / 0 / 0 | 469 |
| r1-gamme-390 | 252 / 0 / 0 | 248 / 0 / 0 | 236 |
| r1-gamme-1440 | 255 / 0 / 0 | 265 / 0 / 0 | 236 |
| r2-produit-390 | 563 / 0 / 0 | 585 / 0 / 0 | 367 |
| r2-produit-1440 | 620 / 0 / 0 | 663 / 0 / 0 | 367 |
| panier-vide-390 | 32 / 0 / 0 | 100 / 0 / 0 | 54 |
| panier-vide-1440 | 25 / 0 / 0 | 107 / 0 / 0 | 54 |
| connexion-390 | 10 / 4 / 4 | 10 / 4 / 4 | 17 |
| connexion-1440 | 10 / 4 / 4 | 10 / 4 / 4 | 17 |

Les 4 résidus de `connexion` en A et B sont les quatre couleurs du logo Google (SVG en ligne,
`fill` codé en dur : `#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`), non couvert volontairement.

## Bouton d'achat : ratios

Ratio texte / fond du bouton (seuil 4,5:1 pour ce texte de 14 à 16 px), anneau de focus face au fond
de la page (seuil 3:1). « Désactivé » est **simulé** : l'attribut `disabled` est posé dans le DOM sur
le bouton capturé, sans clic ; le bouton n'est jamais désactivé dans le parcours réel mesuré. Quand
la page réduit l'opacité d'un bouton désactivé, le ratio effectif (couleurs composées avec le fond)
est donné ; WCAG n'exige aucun contraste pour un contrôle désactivé.

| Bouton | Variante | Repos (fond, texte, ratio) | Survol | Focus (anneau, ratio anneau/page) | Désactivé simulé |
|---|---|---|---|---|---|
| r2-produit-390 · Ajouter … au panier | AVANT | #0F1E38 / #FFFFFF : 16.63 | #0F1E38 / #FFFFFF : 16.63 | 1px auto #E59700 : 2.4 | #0F1E38 / #FFFFFF : 16.63 |
| r2-produit-390 · Ajouter … au panier | A | #F97316 / #0F1E38 : 5.93 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 |
| r2-produit-390 · Ajouter … au panier | B | #C2410C / #FFFFFF : 5.18 | #9A3412 / #FFFFFF : 7.31 | 2px solid #0F1E38 : 16.63 | #C2410C / #FFFFFF : 5.18 |
| r2-produit-390 · Panier (bouton collant) | AVANT | #FF6900 / #000000 : 7.27 | #F54A00 / #000000 : 5.86 | 1px auto #E59700 : 2.4 | #FF6900 / #000000 : 7.27 |
| r2-produit-390 · Panier (bouton collant) | A | #F97316 / #0F1E38 : 5.93 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 |
| r2-produit-390 · Panier (bouton collant) | B | #C2410C / #FFFFFF : 5.18 | #9A3412 / #FFFFFF : 7.31 | 2px solid #0F1E38 : 16.63 | #C2410C / #FFFFFF : 5.18 |
| r2-produit-1440 · Ajouter … au panier | AVANT | #0F1E38 / #FFFFFF : 16.63 | #0F1E38 / #FFFFFF : 16.63 | 1px auto #101010 : 19.03 | #0F1E38 / #FFFFFF : 16.63 |
| r2-produit-1440 · Ajouter … au panier | A | #F97316 / #0F1E38 : 5.93 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 |
| r2-produit-1440 · Ajouter … au panier | B | #C2410C / #FFFFFF : 5.18 | #9A3412 / #FFFFFF : 7.31 | 2px solid #0F1E38 : 16.63 | #C2410C / #FFFFFF : 5.18 |
| connexion-390 · Se connecter (bouton principal du formulaire) | AVANT | #F97316 / #000000 : 7.49 | #EA580C / #000000 : 5.9 | aucun : — | #F97316 / #000000 : 7.49 (opacité 0.5, effectif #FCB98B / #808080 : 2.34) |
| connexion-390 · Se connecter (bouton principal du formulaire) | A | #F97316 / #0F1E38 : 5.93 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (opacité 0.5, effectif #FCB98B / #878F9C : 1.93) |
| connexion-390 · Se connecter (bouton principal du formulaire) | B | #C2410C / #FFFFFF : 5.18 | #9A3412 / #FFFFFF : 7.31 | 2px solid #0F1E38 : 16.63 | #C2410C / #FFFFFF : 5.18 (opacité 0.5, effectif #E1A086 / #FFFFFF : 2.19) |
| connexion-1440 · Se connecter (bouton principal du formulaire) | AVANT | #F97316 / #000000 : 7.49 | #EA580C / #000000 : 5.9 | aucun : — | #F97316 / #000000 : 7.49 (opacité 0.5, effectif #FCB98B / #808080 : 2.34) |
| connexion-1440 · Se connecter (bouton principal du formulaire) | A | #F97316 / #0F1E38 : 5.93 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (opacité 0.5, effectif #FCB98B / #878F9C : 1.93) |
| connexion-1440 · Se connecter (bouton principal du formulaire) | B | #C2410C / #FFFFFF : 5.18 | #9A3412 / #FFFFFF : 7.31 | 2px solid #0F1E38 : 16.63 | #C2410C / #FFFFFF : 5.18 (opacité 0.5, effectif #E1A086 / #FFFFFF : 2.19) |

## Ce que la feuille ne couvre pas

- images matricielles (photos de pièces, logos de marques, bannières) : leurs couleurs ne sont pas modifiables par une feuille
- SVG en <img> ou en fond (url()) : couleurs figées dans le fichier ; seuls les SVG en ligne en currentColor suivent la couleur du texte
- attributs fill/stroke codés en dur dans des SVG en ligne (par exemple étoiles ou pictogrammes colorés)
- styles en ligne autres que le bandeau R2 à dégradé (style="background-image:…") : non ciblés un par un
- dégradés d'image (radial-gradient décoratifs en style en ligne, voiles opacity-[0.06])
- couleurs posées par JavaScript au rendu (graphiques, canvas) et contenus de tiers
- éléments non rendus pendant la capture (menus fermés, fenêtres modales, toasts, états d'erreur des formulaires)
- le rôle (état, décoratif, lien, surface) a été déduit de la classe et du texte visibles ; voir README, « Rôles déduits »

## Rôles déduits (à valider par le chat 05)

La feuille ne lit pas l'intention du code : le rôle de chaque couleur a été déduit de la classe et du
texte rendus (`mesures/roles-*.json`, `mesures/inventaire-*.json`, `mesures/fonds-sombres-*.json`).

- Le bouton collant « Panier » de r2 en mobile (`button.bg-orange-500.rounded-xl`) est compté comme
  action d'achat, comme « Ajouter … au panier » et le bouton principal du formulaire de connexion
  (seul formulaire POST rendu). Le bouton de recherche désactivé de r0 (« Rechercher des pièces »)
  n'est pas une action d'achat : son fond `bg-cta` devient navy, atténué par l'opacité de son état
  désactivé (gris à l'écran) ; de même « Lancer le diagnostic » et « Retour en haut » (`bg-cta`).
- Les encadrés ambre ou jaune (« Pas sûr de la compatibilité ? ») sont des avertissements (point 7).
- Les teintes claires (bleu, vert, orange 50 à 100) deviennent le neutre `#F5F7FA`.
- Les cartes rouges décoratives deviennent neutres ; seule leur icône garde `#C0392B`.
- Les prix verts deviennent navy (un prix n'est pas un état de succès).
- Sur fond navy, les bords de champ passent à `#9CA3AF` (le seuil sombre du point 5).
- « MECANIK » du logo devient blanc (l'orange disparaît hors achat).
- Une carte claire posée dans une zone sombre revient au contexte clair ; une surface sombre posée dans
  cette carte redevient sombre ; une surface sombre en mobile seulement (`bg-slate-900 md:bg-white/95`)
  est claire à partir de 768 px.
- Focus sur une surface sombre : la feuille ne connaît pas le fond réel autour de l'élément ; l'anneau
  blanc de 2 px est donc doublé d'un liseré navy de 2 px, visible sur les deux fonds.

## Option C : bouton d'achat vert (complément n° 3)

Accord : Marwane, 20 nov. 2026 à 10:13 heure de Tunis, « une option C "bouton d'achat vert" sur les
planches, à côté de A et B, sur la page produit seulement ». **Périmètre : `r2-produit` seulement**, à
390×844 et 1440×900. [`option-c.css`](option-c.css) = jeu réduit de A, sauf le point 2 : fond `#1E8449`
(jeton semantic.success), texte blanc, survol `#196F3D` (**valeur NOUVELLE** : semantic.success n'a pas
d'échelle dans les jetons). La feuille ne diffère de `option-a.css` que par son en-tête et la règle du
point 2. Captures C : 2026-11-20 09:55:26Z → 09:56:39Z ; relevé des verts : 10:06:02Z → 10:06:50Z.

### Planches

| Taille | Premier écran AVANT / A / B / C | Bouton d'achat seul, agrandi 4×, A / B / C (repos, survol, focus, désactivé) |
|---|---|---|
| 390×844 | [`planches/r2-produit-390-abc.webp`](planches/r2-produit-390-abc.webp) | [`planches/bouton-r2-produit-390-ajouter-abc.webp`](planches/bouton-r2-produit-390-ajouter-abc.webp) |
| 1440×900 | [`planches/r2-produit-1440-abc.webp`](planches/r2-produit-1440-abc.webp) | [`planches/bouton-r2-produit-1440-ajouter-abc.webp`](planches/bouton-r2-produit-1440-ajouter-abc.webp) |

Captures C : `captures/r2-produit-<W>-c-ecran.webp`, `-c-page.webp` ; recadrages
`captures/boutons/bouton-r2-produit-<W>-ajouter-c-<état>.webp`.

### Ratios du bouton C

| Bouton | Option | Repos (fond / texte : ratio) | Survol | Focus (anneau : ratio anneau/page) | Bouton / page au repos | Désactivé simulé |
|---|---|---|---|---|---|---|
| r2-produit-390 · Ajouter … au panier | A | `#F97316` / `#0F1E38` : 5,93 | `#EA580C` / `#0F1E38` : 4,67 | 2 px `#0F1E38` : 16,63 | 2,80 | identique au repos : 5,93 |
| | B | `#C2410C` / blanc : 5,18 | `#9A3412` / blanc : 7,31 | 2 px `#0F1E38` : 16,63 | 5,18 | identique au repos : 5,18 |
| | **C** | **`#1E8449` / blanc : 4,72** | **`#196F3D` / blanc : 6,21** | **2 px `#0F1E38` : 16,63** | **4,72** | **identique au repos : 4,72** |
| r2-produit-390 · Panier (bouton collant) | C | `#1E8449` / blanc : 4,72 | `#196F3D` / blanc : 6,21 | 2 px `#0F1E38` : 16,63 | 4,72 | identique au repos : 4,72 |
| r2-produit-1440 · Ajouter … au panier | C | `#1E8449` / blanc : 4,72 | `#196F3D` / blanc : 6,21 | 2 px `#0F1E38` : 16,63 | 4,72 | identique au repos : 4,72 |

Les lignes A et B du bouton collant et du 1440 sont identiques à celles du 390 (tableau complet :
[`mesures/synthese-option-c-dz.md`](mesures/synthese-option-c-dz.md)). Lecture :

- Texte blanc sur `#1E8449` : 4,72:1, au-dessus du seuil de 4,5:1 mais de peu (A 5,93, B 5,18). Le
  survol `#196F3D` monte à 6,21:1.
- Contour du bouton sur la page blanche : 4,72:1 (A 2,80, B 5,18). Sur navy, `#1E8449` ne ferait que
  3,52:1 ; aucun bouton d'achat de r2 n'est posé sur navy dans les captures.
- Désactivé simulé : même rendu que le repos, comme pour A et B (la feuille ne prévoit pas d'état
  désactivé ; le désactivé est simulé par l'attribut `disabled`).
- Couleurs hors jeu en C : 0 au repos et 0 au survol forcé de 367 éléments, aux deux tailles.

### Éléments verts visibles avec le bouton d'achat

Critère : teinte de 75° à 170°, saturation ≥ 0,25, luminosité de 0,12 à 0,85, sur le texte, le fond, le
dégradé, le bord, `fill` ou `stroke` ; élément visible et non recouvert en son centre ; couleurs lues
par le navigateur (oklch de Tailwind 4 compris). Le premier écran de r2 à 1440 ne montre aucun bouton
« Ajouter » ; à 390, seul le « Panier » collant est visible. D'où un second écran : le premier
défilement où « Ajouter » est entier.

| Passage · écran | Verts hors achat, AVANT | Verts hors achat, C | Toute la page, AVANT / C |
|---|---|---|---|
| r2-produit-390 · premier écran (défilement 0) | 2 | **1** | 53 / 1 |
| r2-produit-390 · écran du bouton « Ajouter » (défilement 1079) | 11 | **1** | |
| r2-produit-1440 · premier écran (défilement 0) | 8 | **1** | 56 / 1 |
| r2-produit-1440 · écran du bouton « Ajouter » (défilement 708) | 16 | **1** | |

**En C, le seul élément vert visible en même temps que le bouton d'achat est la pastille de 12×12 px du
bouton de discussion** (`span.bg-green-500`, ramenée à `#1E8449` par le point 7), en bas à droite, aux
deux tailles et sur les deux écrans. Captures annotées (cadres numérotés ; orange = achat, violet =
autre vert) :

| Taille | Premier écran | Écran du bouton « Ajouter » |
|---|---|---|
| 390, C | [`verts-r2-produit-390-c-premier-ecran-annote.webp`](captures/verts-r2-produit-390-c-premier-ecran-annote.webp) : « Panier » (achat), pastille | [`verts-r2-produit-390-c-ecran-du-bouton-ajouter-annote.webp`](captures/verts-r2-produit-390-c-ecran-du-bouton-ajouter-annote.webp) : 2 « Ajouter » et « Panier » (achat), pastille |
| 1440, C | [`verts-r2-produit-1440-c-premier-ecran-annote.webp`](captures/verts-r2-produit-1440-c-premier-ecran-annote.webp) : pastille seule | [`verts-r2-produit-1440-c-ecran-du-bouton-ajouter-annote.webp`](captures/verts-r2-produit-1440-c-ecran-du-bouton-ajouter-annote.webp) : 3 « Ajouter » (achat), pastille |
| 390, AVANT | [`verts-r2-produit-390-avant-premier-ecran-annote.webp`](captures/verts-r2-produit-390-avant-premier-ecran-annote.webp) | [`verts-r2-produit-390-avant-ecran-du-bouton-ajouter-annote.webp`](captures/verts-r2-produit-390-avant-ecran-du-bouton-ajouter-annote.webp) |
| 1440, AVANT | [`verts-r2-produit-1440-avant-premier-ecran-annote.webp`](captures/verts-r2-produit-1440-avant-premier-ecran-annote.webp) | [`verts-r2-produit-1440-avant-ecran-du-bouton-ajouter-annote.webp`](captures/verts-r2-produit-1440-avant-ecran-du-bouton-ajouter-annote.webp) |

Liste détaillée (élément, classes, couleur, position) : [`mesures/synthese-option-c-dz.md`](mesures/synthese-option-c-dz.md)
et [`mesures/verts-r2-produit-<W>-<c|avant>.json`](mesures/).

**Ce que la planche montre, et ce qu'elle ne peut pas montrer.** Sur r2, aucun état positif (« en
stock », « compatible », « validé ») n'est rendu en vert par le jeu A, dont C hérite. Les verts d'AVANT
(« Livré 24-48h » et son icône de camion, prix « 5,00 € », notes et barres de fiabilité, « Livraison
gratuite dès 150€ », icônes euro et cadenas ; 53 éléments à 390, 56 à 1440, sur toute la page) sont ramenés à navy, `#1F2937`, `#0F4C81` ou blanc par les points 3, 4 et 9.
Le bouton vert C se distingue donc sur r2 parce qu'il est le seul aplat vert de la page, à la pastille
près. La confusion possible avec un état positif vert n'est pas observable sur cette page ; elle le
serait sur une page qui affiche un succès `#1E8449` (non mesuré).

**Remarque pour le chat 05 (vaut aussi pour A et B).** « Livré 24-48h » (`text-emerald-600`) devient
`#0F4C81`, la couleur des liens, par la règle du point 4 (« texte bleu brut ») qui liste
`text-emerald-600`. Couleur mesurée dans le navigateur : `rgb(15, 76, 129)` en C, contre
`oklch(0.596 0.145 163)` en AVANT. Une information de livraison prend ainsi l'aspect d'un lien.

### Limites propres à C

- r2-produit seulement, deux tailles. C n'est pas passée par `mesure-option-dz.cjs` : pas de tableau de
  défauts textes, bords, focus et axe pour C. Comme C ne diffère de A que par le point 2, ces défauts
  devraient être ceux de A, sauf le bouton d'achat. C'est une déduction, non mesurée.
- AVANT, A et B sont les captures du complément n° 2 (09:34Z → 09:45Z) ; C a été capturée à 09:55Z sur
  le même DEV (`7f4dded3`), avec la même feuille (SHA-256 vérifié avant et après).
- La pastille de discussion est un indicateur décoratif de 12 px. Le critère « vert » la compte comme
  les autres éléments ; son poids visuel est faible.

## Option A2 : logo et action principale en orange (complément n° 4)

Accord : Marwane, 20 nov. 2026 à 11:06 heure de Tunis, « Oui » à : « refaire les planches de A avec la
règle corrigée : logo orange, action principale de chaque page en orange ». Correction de la règle du
complément n° 2 (« orange réservé à l'achat »), jugée trop stricte : logo éteint, accueil et gamme sans
orange, « Rechercher des pièces » en gris.

[`option-a2.css`](option-a2.css) (`1bef7ff9…630a64`, 67 règles) = `option-a.css` avec ces changements seulement :

1. **Logo** : « MECANIK » garde `#F97316` sur navy (5,93:1), comme sur main.
2. **Action principale de chaque page** : fond `#F97316`, texte navy, survol `#EA580C`, focus 2 px navy ;
   désactivé fond `#FED7AA` (jeton cta.200, existant), texte navy, opacité 1 (au lieu de l'opacité 0,4
   de main et du gris de A). Actions retenues : « Rechercher des pièces » (r0, r1), « Ajouter » et
   « Panier » collant (r2), « Trouver une pièce » (panier vide), « Se connecter » (connexion). L'état
   désactivé `#FED7AA` s'applique aussi aux actions d'achat (A les laissait orange une fois désactivées).
3. **Fil d'Ariane sur navy** (r1, faisable par la même feuille) : liens et séparateurs `#9CA3AF`
   (neutral.300, 6,55:1 sur navy, 5,31:1 sur navy-light `#162D5A`), page courante blanche. Sur main, les
   liens sont `#0D4473` (1,66:1). Sur r2, le fil est sur fond blanc : non concerné.

Tout le reste est identique à A (orange retiré ailleurs, liens `#0F4C81`, gris, bords, états, focus).
Captures A2 : 2026-11-20 10:22:43Z → 10:34:59Z ; mesures A2 10:23:32Z → 10:35:33Z ; actions orange par
écran 10:36:01Z → 10:38:17Z (même DEV `7f4dded3`). Requêtes abandonnées : 44 POST (captures) et 36
(actions orange), toutes consignées dans les JSON ; aucun clic, aucune saisie.

### Planches A2

| Page | 390×844, premier écran AVANT / A / A2 / B | 1440×900, premier écran AVANT / A / A2 / B |
|---|---|---|
| r0-accueil | [`planches/r0-accueil-390-a2.webp`](planches/r0-accueil-390-a2.webp) | [`planches/r0-accueil-1440-a2.webp`](planches/r0-accueil-1440-a2.webp) |
| r1-gamme | [`planches/r1-gamme-390-a2.webp`](planches/r1-gamme-390-a2.webp) | [`planches/r1-gamme-1440-a2.webp`](planches/r1-gamme-1440-a2.webp) |
| r2-produit | [`planches/r2-produit-390-a2.webp`](planches/r2-produit-390-a2.webp) | [`planches/r2-produit-1440-a2.webp`](planches/r2-produit-1440-a2.webp) |
| panier-vide | [`planches/panier-vide-390-a2.webp`](planches/panier-vide-390-a2.webp) | [`planches/panier-vide-1440-a2.webp`](planches/panier-vide-1440-a2.webp) |
| connexion | [`planches/connexion-390-a2.webp`](planches/connexion-390-a2.webp) | [`planches/connexion-1440-a2.webp`](planches/connexion-1440-a2.webp) |

Actions principales A2 seules, agrandies 3×, colonnes repos / survol / focus / désactivé :
[`planches/actions-principales-a2-390.webp`](planches/actions-principales-a2-390.webp),
[`planches/actions-principales-a2-1440.webp`](planches/actions-principales-a2-1440.webp).
Captures A2 : `captures/<page>-<W>-a2-ecran.webp`, `-a2-page.webp` ; recadrages
`captures/boutons/bouton-<page>-<W>-<action>-a2-<état>.webp` (`-desactive-reel` : état désactivé servi).

### Défauts mesurés AVANT / A / A2 / B

Même mesure qu'au n° 2 (`mesure-option-dz.cjs` sur `mesure-dz.cjs` non modifié). Synthèse :
[`mesures/synthese-option-a2-dz.md`](mesures/synthese-option-a2-dz.md) et `.json` (SHA-256 des 40 mesures
brutes hors dépôt dans `sources`).

| Passage | Textes sous seuil (AVANT / A / A2 / B) | Bords sous 3:1 | Focus invisible ou masqué | axe color-contrast |
|---|---|---|---|---|
| r0-accueil-390 | 39 / 3 / 3 / 3 | 3 / 0 / 0 / 0 | 12 / 4 / 5 / 5 | 31 / 0 / 0 / 0 |
| r0-accueil-1440 | 41 / 4 / 4 / 4 | 3 / 0 / 0 / 0 | 3 / 0 / 0 / 0 | 26 / 1 / 1 / 1 |
| r1-gamme-390 | 79 / 2 / 0 / 2 | 3 / 0 / 0 / 0 | 14 / 6 / 6 / 6 | 25 / 0 / 0 / 0 |
| r1-gamme-1440 | 76 / 2 / 0 / 2 | 3 / 0 / 0 / 0 | 1 / 0 / 0 / 0 | 21 / 0 / 0 / 0 |
| r2-produit-390 | 97 / 0 / 0 / 0 | 22 / 20 / 20 / 20 | 25 / 15 / 15 / 15 | 9 / 0 / 0 / 0 |
| r2-produit-1440 | 105 / 3 / 4 / 3 | 21 / 20 / 20 / 20 | 5 / 2 / 2 / 2 | 5 / 0 / 0 / 0 |
| panier-vide-390 | 8 / 0 / 0 / 0 | 1 / 0 / 0 / 0 | 5 / 3 / 3 / 3 | 6 / 0 / 0 / 0 |
| panier-vide-1440 | 5 / 0 / 0 / 0 | 1 / 0 / 0 / 0 | 1 / 0 / 0 / 0 | 1 / 0 / 0 / 0 |
| connexion-390 | 8 / 0 / 0 / 0 | 2 / 0 / 0 / 0 | 7 / 3 / 3 / 3 | 5 / 0 / 0 / 0 |
| connexion-1440 | 8 / 0 / 0 / 0 | 2 / 0 / 0 / 0 | 2 / 0 / 0 / 0 | 5 / 0 / 0 / 0 |
| **Total** | **466 / 14 / 11 / 14** | **61 / 40 / 40 / 40** | **75 / 33 / 34 / 34** | **134 / 1 / 1 / 1** |

- **r1-gamme, textes 2 → 0** : les deux liens du fil d'Ariane (`#0D4473` sur navy) passent à `#9CA3AF`.
- **r2-produit-1440, textes 3 → 4** et **r0-accueil-390, focus 4 → 5** : artefacts d'échantillonnage
  de pixels, pas des effets de A2. Le style calculé est identique à A (« Véhicule sélectionné » :
  `#4B5563` sur blanc, 7,53:1 ; « Par véhicule » : contour 2 px navy, 16,63:1). La mesure a relevé un
  défilement entre ses deux captures (`defilementEntreCaptures`) ; B montre le même écart de focus sur
  « Par véhicule » depuis le n° 2.

| Passage | Résidus hors jeu au repos (AVANT / A / A2 / B) | Au survol forcé | Logo orange exclu (A2) |
|---|---|---|---|
| r0-accueil-390 | 243 / 0 / 0 / 0 | 319 / 0 / 0 / 0 | 1 |
| r0-accueil-1440 | 283 / 0 / 0 / 0 | 363 / 0 / 0 / 0 | 1 |
| r1-gamme-390 | 252 / 0 / 0 / 0 | 248 / 0 / 0 / 0 | 1 |
| r1-gamme-1440 | 255 / 0 / 0 / 0 | 265 / 0 / 0 / 0 | 1 |
| r2-produit-390 | 563 / 0 / 0 / 0 | 585 / 0 / 0 / 0 | 1 |
| r2-produit-1440 | 620 / 0 / 0 / 0 | 663 / 0 / 0 / 0 | 1 |
| panier-vide-390 | 32 / 0 / 0 / 0 | 100 / 0 / 0 / 0 | 1 |
| panier-vide-1440 | 25 / 0 / 0 / 0 | 107 / 0 / 0 / 0 | 1 |
| connexion-390 | 10 / 4 / 4 / 4 | 10 / 4 / 4 / 4 | 1 |
| connexion-1440 | 10 / 4 / 4 / 4 | 10 / 4 / 4 / 4 | 1 |

Le logo orange (1 élément par passage) est hors jeu par construction dans A ; dans A2, il est voulu et
compté à part (`logoOrangeExclu`). Les 4 résidus de connexion sont le logo Google du bouton
« Continuer avec Google » (image SVG à couleurs fixes), comme en A et B.

### Ratios des actions principales A2

| Action | Option | Repos (fond / texte : ratio) | Bouton / page | Survol | Focus (anneau : ratio anneau/page) | Désactivé |
|---|---|---|---|---|---|---|
| r0-accueil-390 · Rechercher des pièces (sélecteur véhicule) ¹ | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (réel) ; bouton/page 1.35 |
| r1-gamme-390 · Rechercher des pièces (sélecteur véhicule) ¹ | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (réel) ; bouton/page 1.35 |
| r2-produit-390 · Ajouter … au panier | A | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) ; bouton/page 2.8 |
| r2-produit-390 · Ajouter … au panier | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) ; bouton/page 1.35 |
| r2-produit-390 · Panier (bouton collant) | A | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) ; bouton/page 2.8 |
| r2-produit-390 · Panier (bouton collant) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) ; bouton/page 1.35 |
| r2-produit-1440 · Ajouter … au panier | A | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) ; bouton/page 2.8 |
| r2-produit-1440 · Ajouter … au panier | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) ; bouton/page 1.35 |
| panier-vide-390 · Trouver une pièce (panier vide) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) ; bouton/page 2.8 |
| panier-vide-1440 · Trouver une pièce (panier vide) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (simulé) ; bouton/page 2.8 |
| connexion-390 · Se connecter (bouton principal du formulaire) | A | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (opacité 0.5, effectif 1.93) (simulé) ; bouton/page 2.8 |
| connexion-390 · Se connecter (bouton principal du formulaire) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) ; bouton/page 1.35 |
| connexion-1440 · Se connecter (bouton principal du formulaire) | A | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #F97316 / #0F1E38 : 5.93 (opacité 0.5, effectif 1.93) (simulé) ; bouton/page 2.8 |
| connexion-1440 · Se connecter (bouton principal du formulaire) | A2 | #F97316 / #0F1E38 : 5.93 | 2.8 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | #FED7AA / #0F1E38 : 12.28 (simulé) ; bouton/page 1.35 |

¹ « Rechercher des pièces » est désactivé tant qu'aucun véhicule n'est choisi : repos, survol et focus sont mesurés après retrait local de l'attribut disabled (aucun clic, aucune saisie). « Trouver une pièce » est un lien : l'attribut `disabled` n'a pas d'effet, sa colonne
« désactivé » est sans objet. Points à décider par le chat 05 :

- **Survol `#EA580C`, texte navy : 4,67:1**, juste au-dessus de 4,5:1 (même valeur qu'en A).
- **Bouton / page au repos : 2,80:1** (`#F97316` sur blanc), sous 3:1 ; le texte navy porte le contraste
  (5,93:1), et le contour du bouton n'a pas d'autre bord. Même valeur qu'en A.
- **Désactivé `#FED7AA` : texte 12,28:1, mais bouton / page 1,35:1** : le bouton désactivé se lit par
  son texte, sa forme se distingue à peine du blanc. Main (opacité 0,4) rendait le texte peu lisible ;
  A le rendait gris.

### Une seule action principale orange par écran ?

Bouton ou lien visible, fond calculé orange, entier dans l'écran et non recouvert en son centre ;
la page est parcourue écran par écran (défilement d'une hauteur d'écran). Script :
[`scripts/actions-orange-a2-dz.cjs`](scripts/actions-orange-a2-dz.cjs).

| Passage | Actions orange entières, premier écran (A2) | Écrans de la page | Écrans à plusieurs actions orange | Maximum par écran | Toute la page |
|---|---|---|---|---|---|
| r0-accueil-390 | 1 (Rechercher des pièces (désactivé) #FED7AA) | 10 | 0 | 1 | 1 |
| r0-accueil-1440 | 0 | 6 | 0 | 0 | 0 |
| r1-gamme-390 | 0 | 19 | 0 | 0 | 1 |
| r1-gamme-1440 | 0 | 10 | 0 | 0 | 0 |
| r2-produit-390 | 1 (Panier (collant) #F97316) | 16 | 4 | 5 | 21 |
| r2-produit-1440 | 0 | 12 | 4 | 3 | 20 |
| panier-vide-390 | 1 (Trouver une pièce #F97316) | 2 | 0 | 1 | 1 |
| panier-vide-1440 | 1 (Trouver une pièce #F97316) | 2 | 0 | 1 | 1 |
| connexion-390 | 1 (Se connecter #F97316) | 2 | 0 | 1 | 1 |
| connexion-1440 | 1 (Se connecter #F97316) | 2 | 0 | 1 | 1 |

- **Plusieurs actions orange dans un même écran : r2-produit seulement.** À 390 px, 4 écrans sur 16 en
  montrent 3 à 5 (« Ajouter » des cartes de la liste, deux par rangée, plus « Panier » collant) ; à
  1440 px, 4 écrans sur 12 en montrent 2 ou 3 (trois cartes par rangée). La page compte 21 (390) et
  20 (1440) actions orange. La règle « une seule par écran » n'est pas tenue par une liste de produits
  dont chaque carte a son bouton d'achat : décision du chat 05 (par exemple « Ajouter » en contour
  sur les cartes, plein sur la fiche seule), non maquettée ici.
- **r0-accueil et r1-gamme à 1440 : aucune action orange**, ni dans le premier écran ni plus bas. Le
  sélecteur de bureau (Marque, Année, Modèle, Motorisation, Réinitialiser) n'a pas de bouton de
  validation : il n'y a pas d'action principale à mettre en orange sans modifier le composant.
  « Inscription » (en-tête) et « Lancer le diagnostic » (r1), orange sur main, restent navy comme en A.
- **r1-gamme à 390** : « Rechercher des pièces » est sous le premier écran (y = 873 pour 844) ; dans le
  découpage écran par écran, il tombe sous la barre collante du haut (écran 2, défilement 846) et n'est
  donc compté entier dans aucun écran. Le défilement réel d'un visiteur le montre.
- **r2-produit, premier écran** : 1 action orange à 390 (« Panier » collant) ; 0 à 1440 (« Ajouter »
  apparaît au deuxième écran).

### Limites propres à A2

- Le choix des actions principales est fait par sélecteur sur les classes servies : un autre composant
  ou une autre page peut avoir une action principale non couverte.
- « Rechercher des pièces » : repos, survol et focus mesurés après retrait local de l'attribut `disabled`
  (aucun véhicule n'est choisi, aucun clic ni saisie) ; l'état désactivé, lui, est l'état servi.
- AVANT, A et B sont les mesures et captures du n° 2 (09:34Z → 09:51Z) ; A2 a été mesurée à 10:22Z →
  10:38Z sur le même DEV, sans rien lancer en parallèle.

## Limites

- **Maquette par feuille injectée, pas une implémentation.** Une feuille à `!important` écrase les
  utilitaires Tailwind ; une implémentation passerait par les jetons et les composants, et donnerait
  des résultats différents (états, variantes, pages non mesurées).
- Cinq pages et deux tailles seulement ; les autres pages (dont le tunnel de commande, non affichable
  sans écriture) ne sont pas vues.
- AVANT = DEV servant `7f4dded3` (serveur de développement Vite, pas un build de production).
- État désactivé simulé (attribut posé dans le DOM). Survol : forcé sur tous les éléments à la fois ;
  le survol d'un seul élément peut composer différemment. Focus : 20 premiers arrêts de tabulation.
- Éléments non rendus pendant la capture (menus fermés, fenêtres modales, toasts, erreurs de
  formulaire) : non mesurés, donc non garantis.
- Les mesures brutes complètes (30 JSON) restent hors dépôt ; leurs SHA-256 sont dans
  `mesures/synthese-options-dz.json` (`sources`). Les journaux d'injection (règles présentes, requêtes
  abandonnées) sont copiés dans `mesures/injection/`.
- Mesures A/B et captures lancées en parallèle sur le même DEV : sans effet sur les couleurs, mais les
  durées de chargement ne sont pas comparables.

## Reproduire

```bash
cd docs/audit/design-system-revue-20261119/options
export NODE_PATH=/opt/automecanik/app/node_modules
node scripts/genere-options-css-dz.cjs .                       # option-a.css, option-b.css, option-c.css, option-a2.css
node scripts/mesure-option-dz.cjs <avant|a|b|a2> <id> <chemin> <L> <H> <sortie>
node scripts/options-captures-dz.cjs <id> <chemin> <L> <H> . <dossier-brut>
bash scripts/planches-options-dz.sh <dossier-brut> .
node scripts/condense-options-dz.cjs <dossier-mesures> .
# Complément n° 3 (option C, r2-produit seulement) :
node scripts/options-captures-dz.cjs r2-produit <chemin> <L> <H> . <dossier-brut> c
node scripts/verts-option-c-dz.cjs r2-produit <chemin> <L> <H> . <dossier-brut> <c|avant>
bash scripts/planches-option-c-dz.sh <dossier-brut> .
node scripts/condense-option-c-dz.cjs .
# Complément n° 4 (option A2, cinq pages) :
node scripts/options-captures-dz.cjs <id> <chemin> <L> <H> . <dossier-brut> a2
node scripts/mesure-option-dz.cjs a2 <id> <chemin> <L> <H> <dossier-mesures>/a2
node scripts/actions-orange-a2-dz.cjs <id> <chemin> <L> <H> . a2
bash scripts/planches-option-a2-dz.sh <dossier-brut> .
node scripts/condense-option-a2-dz.cjs <dossier-mesures> .
```

Inventaire préalable : `scripts/inventaire-options-dz.cjs`, `scripts/roles-options-dz.cjs`,
`scripts/fonds-sombres-options-dz.cjs` (sorties dans `mesures/`).

SHA-256 des feuilles mesurées :

```
2e00e7903af39c8d1aa08616e5356fbc8f0a56d91886196706b6d8c56a9ead3d  option-a.css
2d63b7ca0f7673e429a5d37bd0a27c471504f102e2d26f901eed58f474c5f570  option-b.css
07d5b10de5a3ad538bcda022f455527bb11c6176ed2b5085769f30222aaf0f93  option-c.css
1bef7ff971c110d914355120e44e3e23807e4b160119485fa873251cc0630a64  option-a2.css
```
