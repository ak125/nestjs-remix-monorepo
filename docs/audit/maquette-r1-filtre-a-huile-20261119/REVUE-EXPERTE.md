# Revue experte de la maquette R1 du filtre à huile (PR #2210)

Mandat DU, 19 novembre 2026. Relecture indépendante de la maquette produite par le mandat DS.
Rien n'a été modifié dans #2210, ni dans son code ni dans ses maquettes.

- **Tête de #2210 lue** : `8507eb5b8c64517b4b59001d8dda28b5fcaf3c08` (commit du 19/11 à 16:27 +01:00 ;
  PR brouillon, ouverte ; tête revérifiée avant la publication de ce rapport).
- **Page** : `/pieces/filtre-a-huile-7.html` (rôle R1).
- **Diff relu** : `frontend/app/components/gamme/GammeHero.tsx`, `frontend/app/components/gamme/GammeQuickNav.tsx`,
  `frontend/app/routes/pieces.$slug.tsx`, plus le dossier `docs/audit/maquette-r1-filtre-a-huile-20261119/` de DS.
- **Non lu** : le worktree et la session de DS, en particulier leurs changements non poussés sur la page véhicule.
- Les numéros de ligne cités sont ceux de la tête ci-dessus.
- **Complément n° 3** : la tête de #2210 est passée à `e31d3babe75d36521c0a9f240b2342743f258eec`
  (complément n° 2 de DS, relevée le 19/11 vers 21 h 15). Les trois corrections d'apparence y sont
  revérifiées par mes propres mesures. Le verdict et le §12 sont mis à jour pour cette tête ; les
  autres sections restent celles de `8507eb5b8`.
- **Complément n° 4** : la tête de #2210 est passée à `34bdc1eb36e4120a4ec7769249b4c4ef5f9def95`
  (complément n° 3 de DS). Revérification indépendante de l'apparence de la page R1, hors pied de
  page et barre mobile du bas (revue du design system, 05). Le verdict et le §12 sont mis à jour
  pour cette tête. Liens manquants, titre et règles ne sont pas jugés ici.
- **Complément n° 5** : la tête de #2210 est passée à `06feff9686afa610d5b0363397e2cd2b7ec3fe1d`
  (compléments n° 4 et n° 5 de DS : quatre contrastes, puis une phrase par carte véhicule issue de
  `__seo_item_switch`). Revérification finale : contrastes au pixel, phrases des cartes sur un rendu
  propre de la branche (backend et frontend de `06feff968` sur un port à moi, Redis privé, sans
  proxy), cache, lexique et régressions. Le verdict et le §12 sont mis à jour pour cette tête.
- **Complément n° 6** : contraste du bouton « Lancer le diagnostic » (`GammeDiagnosticCTA`), mesuré
  au pixel sur un rendu propre de la tête `06feff968`, inchangée. Voir le §14 ; les autres sections
  ne changent pas.
- **Complément n° 7** : la tête de #2210 est passée à `06dcea7bc21ede689cb8fd932b0c6973489fac11`
  (complément n° 6 de DS, variante B validée par Marwane : texte noir sur l'orange `cta`). Le bouton
  est revérifié au pixel sur un rendu propre de cette tête : contraste, focus, structure, jetons,
  mouvement réduit et régressions. Voir le §15 ; les autres sections ne changent pas.
- **Complément n° 8** : la tête de #2210 est passée à `f1dbcf2852b0d19575081feb659bfb6b24663adf`
  (complément n° 7 de DS : classe `no-visited` sur le lien). L'état « déjà visité » est revérifié au
  pixel dans Chrome 153 avec un historique réel, au repos et au survol, à 390 et 1440 px, avec un lien
  témoin. L'écart entre 7,49 et 6,89:1 est expliqué, et deux chiffres des §15.1 et §15.6 sont
  rectifiés. Voir le §16 ; les autres sections ne changent pas.

## Verdict final

**L'ordre peut être présenté à Marwane. L'apparence demande des corrections avant d'être validée.**

L'ordre proposé est le bon. Sur mobile, le sélecteur passe en tête, et les liens vers les pages véhicule
(`#reference`) arrivent avant le contenu éditorial. C'est ce que demandent le canon R1 et l'exemple de
référence des skills.

Trois défauts d'accessibilité sont classés « bloquants » par les skills :

1. Le contraste du dégradé des cartes véhicule.
2. Les cibles tactiles de la navigation rapide.
3. Les animations qui ignorent `prefers-reduced-motion`.

Le premier défaut existait déjà, mais l'ordre proposé place ces cartes au deuxième écran mobile. La
décision 57 valide l'apparence une fois, puis l'étend à toutes les gammes. Valider l'apparence
maintenant étendrait donc aussi ces défauts.

Des textes interdits sur une page R1 restent servis : des prix en euros, « livraison » et « en stock ».
Ils ne bloquent pas la décision sur l'ordre. Ils empêchent en revanche de dire que la page est
conforme au rôle R1. Ils relèvent de l'équipe 06 et de Marwane (titres).

**Complément n° 3, tête `e31d3babe` : corrections d'abord, mais il reste peu à faire.**
- Le contraste des cartes véhicule et les cibles de la navigation rapide sont corrigés. Le plus bas
  est 4,72:1 (pastille puissance) ; les boutons de la navigation font 44 px de haut.
- Le mouvement n'est corrigé que sur les éléments touchés par DS. Avec « réduire les animations »,
  trois boucles tournent encore : le point du hero (`GammeHero.tsx:139`) et deux effets du bloc
  diagnostic (`GammeDiagnosticCTA.tsx:15` et `:51`). Le défilement `smooth` de la navigation rapide
  (`GammeQuickNav.tsx:38`) les ignore aussi.
- Le diff ne touche que des classes CSS : aucun texte, titre, ancre ni donnée structurée. axe donne
  les mêmes 24 + 1 + 2 + 1 violations qu'à `8507eb5b8`, nœud pour nœud. Le typecheck et les
  100 tests R1 passent.

**Complément n° 4, tête `34bdc1eb3` : apparence de la page R1 (hors éléments partagés par tout
le site) : corrections d'abord.** Le mouvement est réglé, et le contraste mesuré par axe aussi. Il
reste quatre défauts de contraste propres à R1, qu'axe ne voit pas car il les classe « incomplete ».
Je les ai mesurés au pixel.
- **Mouvement : corrigé.** Avec « réduire les animations », je mesure 0 boucle et 0 animation à 390 et
  1440 px ; à `e31d3babe`, il y avait 3 boucles et 14 animations. La navigation rapide saute
  directement à la section. Ce qui bouge encore vient de la feuille globale, pas de R1 :
  - les 31 déplacements au survol sont instantanés, car `styles/animations.css:175-189` ramène
    toutes les durées à 0,01 ms ;
  - `html` garde `scroll-behavior: smooth`, posé par `hooks/useScrollBehavior.ts`.
- **Contraste vu par axe : corrigé sur R1.** Il passe de 15 violations à 0. Les 9 violations à 390 px
  et les 5 à 1440 px qui restent sont toutes dans le pied de page et la barre du bas. J'ai mesuré
  directement les 15 textes corrigés. Ils sont tous entre 4,51 et 4,83:1, avec les jetons
  `neutral-400`, `cta-700` et `success`, sans valeur en dur ni couleur créée.
- **Restent sur R1** (préexistants, sauf le n° 3) :
  1. Fil d'Ariane du hero, « Accueil » et « Pièces Auto » : 1,6:1 (#0D4473 sur bleu nuit). La règle
     globale `nav a` (`global.css:217`) l'emporte sur `text-white/25` (`GammeHero.tsx:52`).
  2. Onglet inactif « Type Mine », à 1440 px : 4,35:1 (`text-slate-500` sur `bg-slate-100`,
     `GammeHero.tsx:251`).
  3. Badge « 2 min » : `text-cta-700` est sans effet (`GammeDiagnosticCTA.tsx:31`). Le composant
     partagé `Badge` ne fusionne pas les classes, et son `text-foreground` l'emporte : le texte est
     quasi noir (18,8:1), pas orange. Le 4,88:1 annoncé ne correspond donc pas au rendu. À 390 px,
     le badge passe sur deux lignes.
  4. À 1440 px, l'ombre de la carte du hero (`GammeHero.tsx:224`, valeur en dur) déborde sur la bande
     des liens utiles :
     - « Conseils entretien » descend à 3,9 à 4,3:1 ;
     - « Paiement sécurisé » à 4,0:1 ;
     - « Retours 30 jours » à 4,3:1.
- **Cibles : conformes au seuil AA de 24 px (2.5.8).** Il reste 4 cibles sous 24 px à 390 px, contre
  10 avant. Toutes entrent dans une exception de la règle :
  - le lien d'évitement est invisible hors focus, et mesure 221 × 42 px au focus ;
  - les trois autres sont des liens placés dans une phrase.
- **Régressions : aucune.**
  - Le diff ne touche que l'apparence.
  - axe ne relève aucune règle nouvelle.
  - Le typecheck passe, ainsi que les 106 tests de 9 fichiers.
  - La plaquette de frein donne les mêmes résultats.

**Complément n° 5, tête `06feff968`.**
- **Apparence de la page R1 (hors éléments partagés par tout le site) : prête à valider par
  Marwane.** Les quatre contrastes sont corrigés, mesurés au pixel, à 390 et 1440 px :
  - fil d'Ariane : 6,47 et 6,38:1 (1,6:1 avant) ;
  - onglet « Type Mine » : 6,90:1 à 1440 px (4,35:1 avant) ;
  - badge « 2 min » : orange `cta-700` sur `cta-50`, 4,87:1, sur une ligne aux deux largeurs ;
  - bande des liens utiles : 4,51 à 4,55:1, et « Guide d'achat » 5,01:1 (3,9 à 4,3:1 avant).

  axe donne les mêmes nœuds qu'à `34bdc1eb3`. Aucune violation nouvelle, et la plaquette de frein
  donne le même résultat. Une réserve, connue depuis le complément n° 2 et hors des quatre
  corrections demandées : le lien « Conseils : changer un filtre à huile étape par étape » de
  `#reference` reste distingué par sa seule couleur à 390 px (1.4.1, `link-in-text-block`).
  C'est à Marwane de dire s'il le veut corrigé avant validation.
- **Phrases des cartes véhicule : corrections d'abord.** Le builder les sert bien : je l'ai prouvé
  sans proxy, avec 19 phrases distinctes sur 19 cartes et 17 sur 17. Aucun mot interdit R1, aucune
  procédure. Mais :
  - « pour maintenir en bon état » n'a pas de complément ;
  - la phrase redit le modèle, le moteur et les ch déjà affichés sur la carte, sans la marque
    (« compatible 500 1.2 69 ch ») ;
  - 7 bénéfices seulement pour 19 cartes (« protéger le moteur » 6 fois) ;
  - cinq bénéfices génériques reviennent sur 95 à 96 des 101 gammes qui ont des bénéfices.

  Détail et sources au §12, lignes « Phrases des cartes » à « Écart de lexique ».

**Complément n° 6, tête `06feff968` : bouton diagnostic : correction d'abord.** Le texte blanc du
bouton descend à 2,75:1 (seuil 4,5:1). Le défaut est antérieur à #2210. La correction proposée à DS
est locale aux pages R1 et reste dans les jetons `cta` (§14).

**Complément n° 7, tête `06dcea7bc` : bouton diagnostic : correction d'abord.**
- Le texte noir sur l'orange `cta` tient partout : 7,40:1 au pire au passage du reflet et 5,83:1 au
  survol. L'anneau de focus est à 16,62:1 sur la carte. Il reste un seul lien, nommé « Lancer le
  diagnostic », de 54 px de haut au minimum. En mouvement réduit, rien ne bouge. axe, typecheck et
  CI ne montrent rien de nouveau.
- **Mais** le bouton est devenu un lien. La règle commune `a:visited` le recolore en violet après
  une visite de `/diagnostic-auto`, à 2,00:1 mesuré.
- La correction tient en une ligne locale : ajouter `no-visited` au lien. Elle est vérifiée en
  simulation (§15.4).
- Les couleurs sont celles du bouton de l'accueil, mais la forme et le reflet diffèrent (§15.5).

**Verdict global sur l'apparence R1, hors éléments communs au site, à `06dcea7bc`.** L'apparence sera
prête à valider par Marwane une fois `no-visited` ajouté au bouton diagnostic. Aucun autre défaut
nouveau n'est relevé. La réserve du complément n° 5 reste : le lien « Conseils : changer un filtre à
huile étape par étape » de `#reference` n'est distingué que par sa couleur à 390 px (1.4.1).

**Complément n° 8, tête `f1dbcf285` : bouton diagnostic conforme.**
- Après une vraie visite de `/diagnostic-auto`, le libellé reste noir : 7,49:1 au repos et 5,89:1 au
  survol, aux deux largeurs. Le lien témoin passe au violet, ce qui prouve que l'état « visité » est
  actif. En mouvement réduit, le pire est 5,37:1 au survol. Les valeurs sont identiques avant et après
  visite (§16.1).
- L'écart avec les 6,89:1 de DS vient du mouvement réduit. Le reflet immobile pose un voile blanc à
  12 % devant le texte **et** le fond. Les deux chiffres sont justes. Mes chiffres « sous le reflet »
  des §15.1 et §15.6 ignoraient ce voile sur le texte : le pire calculé est 6,60:1 au repos et 5,32:1
  au survol, toujours conforme (§16.2).
- Le diff se limite à la classe et au test. axe, typecheck et tests ne montrent rien de nouveau. La CI
  garde les mêmes échecs qu'avant (§16.3).

**Verdict global sur l'apparence R1, hors éléments communs au site, à `f1dbcf285`.** L'apparence est
prête à valider par Marwane. Aucun défaut ouvert ne reste sur ce qui a été vérifié, et le bouton
diagnostic est conforme dans tous les états mesurés. Seul point en attente : le lien « Conseils :
changer un filtre à huile étape par étape » de `#reference`, que le complément n° 5 signalait à 390 px
(1.4.1). Il attend la décision de Marwane et n'a pas été rejugé ici.

**Conformité au rôle et au contrat (complément n° 1, §8 à §12).** La maquette ne crée aucun nouvel
écart au contrat R1 : le diff déplace des blocs sans changer un seul texte. Elle rapproche la page de
l'intention R1, puisque le sélecteur est désormais entièrement visible. Elle ne corrige pas les écarts
antérieurs. Les sources R1 se contredisent sur six points structurants : volume de texte, liens
autorisés, données structurées, prix, « comment choisir » et intention. Le canon (`role-matrix.md` et
`packages/seo-role-contracts`) prévaut, mais trois sources secondaires doivent être réalignées. Aucun
contrôle automatique ne vérifie l'ordre des blocs ni le rendu R1 sur une PR ; seules les images de
référence `r1-gamme.png` devront être régénérées si l'ordre est validé.

## 1. Sources et règles appliquées

| Règle | Fichier:ligne | Usage |
|---|---|---|
| Sorties R1 autorisées / interdites | `.spec/00-canon/role-matrix.md:95-97` | sélecteur, rappels de compatibilité, renvois R3–R6 ; interdits : prix détaillés, stock, panier, procédure |
| Lexique interdit R1 | `workspaces/seo-batch/.claude/agents/r1-router-validator.md:66-76` | « livraison », « en stock », « promo », etc. |
| Ordre : liens de sortie avant l'éditorial | `.claude/skills/frontend-design/exemplars/antipattern-editorial-sprawl.md:33-38` | hero → accès rapide → grille de liens → éditorial |
| Contrôles bloquants a11y | `.claude/skills/ui-ux-pro-max/SKILL.md:141-147` | contraste ≥ 4,5:1, cibles ≥ 44 px, reduced-motion |
| Pas d'emoji comme icône | `.claude/skills/ui-ux-pro-max/SKILL.md:100`, `.claude/skills/frontend-design/SKILL.md:278` | lucide-react |
| Budget a11y / perf | `.claude/skills/frontend-design/SKILL.md:132`, `:147` | cible 44 × 44 ; CLS 0 |
| Seuils CWV, viewport par défaut | `design-system/UX-CONSTITUTION.md` §1 et §4–5 | LCP ≤ 2 500 ms, CLS ≤ 0,05, INP ≤ 200 ms ; 375 × 800 ; CTA dans les 60 % bas |
| Un champ, une seule source | `.claude/governance/journal-des-principes.md` (P17) | FAQ visible et FAQ des données structurées |
| Pas de constante métier inventée | `CLAUDE.md`, invariant 3 | fourchettes de prix |
| Conventions UI | `.claude/rules/frontend.md` | shadcn, Tailwind, lucide |

Les décisions 45, 55, 57, 81 et 82 sont citées d'après le mandat DU. Elles n'apparaissent pas au journal
des principes (recherche du 19/11 dans `.claude/governance/journal-des-principes.md`). C'est un écart de
gouvernance, signalé et non corrigé ici.

Aucun conflit entre experts ne change un verdict :

- `frontend-design` demande un CLS de 0 (`SKILL.md:147`) ; la constitution UX tolère 0,05. Les mesures
  donnent 0, ce qui satisfait les deux.
- La constitution UX prend 375 × 800 comme viewport par défaut ; DS a mesuré en 412 × 823. J'ai mesuré
  les deux formats.

## 2. L'ordre d'ensemble

Ordre proposé : hero et sélecteur → réassurance → navigation rapide → `#reference` → `#bien-choisir` →
`#qualite-prix` → `#emplacement` → `#faq` → diagnostic → `#aller-plus-loin`.

| Critère | Verdict | Fondement |
|---|---|---|
| SEO | **OK** | Les liens vers les pages véhicule (R2) précèdent l'éditorial (`antipattern-editorial-sprawl.md:33-38`). Le sélecteur est une sortie R1 autorisée (`role-matrix.md:95`). Aucune URL, aucun titre ni H1 n'est modifié par le diff. |
| Performance | **OK, avec une réserve à mesurer** | Le LCP de labo passe de 2,8 s à 1,8 s à 412 × 823, parce que l'élément LCP change (le H1 au lieu de l'image). Sur un écran plus haut (412 × 915), l'image redevient l'élément LCP à 2,7 s (§5). Le gain dépend de la hauteur d'écran ; seul le terrain tranche (décision 81). |
| Mobile, accessibilité | **OK sur l'ordre** | Le sélecteur est entièrement visible au premier écran à 390 px (capture `apres-isole-390-fold.webp` ; avant, il n'en montrait que la moitié). Les défauts relevés plus bas viennent des blocs, pas de l'ordre. |
| Conversion | **OK** | L'action principale (choisir son véhicule) est au premier écran, et la liste des véhicules compatibles suit. Le diagnostic, orange comme l'action d'achat, ne s'intercale plus avant le choix. |

Une réserve vaut pour tout l'ordre : `#reference` mesure 5 255 px sur mobile (relevé de DS). Le premier
bloc éditorial commence donc vers 6 400 px. L'ordre est juste, mais ce bloc doit devenir plus compact
(correction 2).

L'affirmation du README de DS « l'ordre est celui du DOM, et non un ordre CSS » est inexacte pour
l'image du hero : elle reste la première dans le DOM et passe en dernier sur mobile par `order-last`
(`GammeHero.tsx:78`). L'effet est faible, car l'image n'apporte pas d'information indispensable au
lecteur d'écran. La phrase du README est à corriger par DS.

## 3. Tableau bloc × critère

Verdicts : **OK**, **À CORRIGER** (avec la correction), **À MESURER** (avec la mesure).

### 3.1 Hero : H1, sélecteur, image

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | OK | H1 unique « Filtre à huile compatible avec votre véhicule », inchangé par le diff. Le sélecteur est une sortie R1. | `role-matrix.md:95` |
| Performance | À MESURER | L'image reste `loading="eager"` et `fetchPriority="high"` (`GammeHero.tsx:113-114`) alors qu'elle est sous le premier écran sur la plupart des mobiles. À 412 × 915, elle redevient l'élément LCP (2,7 s). Mesure : LCP p75 mobile terrain par hauteur d'écran, après PREPROD, avant et après. Piste : ne garder la priorité haute que sur desktop. | UX-CONSTITUTION §1 ; décision 81 |
| Mobile, a11y | À CORRIGER | (a) Le bouton flottant du chat (`ChatWidget.tsx:210`, `fixed bottom-24 right-4`, 56 px) recouvre le bas droit du sélecteur à 390 × 844 (« Motorisation », « Réinitialiser »). Il faut décaler ou masquer le bouton tant que le sélecteur est à l'écran. (b) Le fil d'Ariane est en `text-white/25` sur fond marine, en 10 px (`GammeHero.tsx:52`), contraste très insuffisant. Ce défaut existait avant #2210. | `ui-ux-pro-max/SKILL.md:141` ; capture `apres-isole-390-fold.webp` |
| Conversion | OK | Le sélecteur est entièrement visible au premier écran mobile ; c'est le principal gain de la maquette. | UX-CONSTITUTION §5 |

### 3.2 Barre de réassurance

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | À CORRIGER | « Livraison 24-48h » (`pieces.$slug.tsx:791`) appartient au lexique interdit R1 (équipe 06 ; « Retours 30 jours », `:795`, est traité par #2143). Le lien « Fiche technique » pointe en dur vers `/reference-auto` (`:822`) : c'est un lien générique écrit à la main. Il faut le générer par règle de rôle, ou le retirer. | `r1-router-validator.md:68` ; décision 82 |
| Performance | OK | Bloc léger, rendu côté serveur. | — |
| Mobile, a11y | À CORRIGER | Textes en 12 px `text-slate-500`, sous les 16 px recommandés. Le lien « Conseils entretien » (#009966 sur #f8fafc) a un contraste de 3,49:1, sous 4,5:1. Les liens « Guide d'achat », « Conseils entretien » et « Fiche technique » ne font que 16 px de haut (§6). | `ui-ux-pro-max/SKILL.md:80`, `:141-142` ; `mesures/apres-axe-390x844.json` |
| Conversion | OK | Placée après le sélecteur, elle rassure sans repousser l'action. | — |

### 3.3 Navigation rapide

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | À CORRIGER | Ce sont des `<button>` avec `scrollIntoView` (`GammeQuickNav.tsx:31-37`), pas des liens `<a href="#reference">`. Les moteurs ne voient aucun lien d'ancre. Correction : des `<a href="#id">` qui gardent les mêmes `id` (aucune URL ne change). Le libellé « Prix & Marques » (`:14`) est à soumettre à Marwane (§7.1). | `frontend-design/SKILL.md:132` ; invariant 6 |
| Performance | OK | Aucun coût mesurable (§5, INP). | — |
| Mobile, a11y | À CORRIGER (bloquant) | Les pastilles font environ 36 px de haut (`px-4 py-2 text-[12px]`, `:39`), sous les 44 px exigés. Le défilement `behavior: "smooth"` ignore `prefers-reduced-motion`. `scrollbar-hide` masque le fait que la barre défile horizontalement. Corrections : hauteur minimale de 44 px, défilement instantané si l'utilisateur réduit les animations, indice visuel de débordement. | `ui-ux-pro-max/SKILL.md:142`, `:146` |
| Conversion | OK | « Compatibilité » en premier oriente vers l'action principale. | — |

### 3.4 `#reference` : texte et cartes véhicule (MotorisationsSection)

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | OK sur la place ; À CORRIGER sur le texte | La place est la bonne : liens vers 19 pages R2, liste `ItemList` des données structurées. Le texte éditorial contient « en stock — livraison rapide » (titre H3) et « avec le prix, la disponibilité ». Ces textes vont à l'équipe 06, et le H3 à Marwane. | `antipattern-editorial-sprawl.md:33-38` ; `role-matrix.md:96` ; `r1-router-validator.md:68,70` |
| Performance | OK (mesuré) | Défilement de 900 px juste après le premier affichage, pendant le chargement différé des véhicules : CLS 0, aucun décalage enregistré (§5). Le squelette `h-96` (`pieces.$slug.tsx:856`) et `content-visibility: auto` (réservation de 700 px, `global.css:402-405`) ne produisent pas de décalage mesuré. En revanche, la barre de défilement saute quand le bloc réel (5 255 px) remplace la réservation de 700 px. | `frontend-design/SKILL.md:147` |
| Mobile, a11y | À CORRIGER (bloquant) | (a) Le dégradé `bg-gradient-to-r from-blue-950` n'a pas de couleur d'arrivée : `familleColor` par défaut (`MotorisationsSection.tsx:49`), que la route ne fournit pas. Le fond s'estompe vers le transparent, donc le texte blanc finit sur du blanc à droite. C'est le cas du bouton « Voir les pièces » (`:260`), de la pastille moteur (`:223`) et du bouton « Voir les N autres compatibilités » (`:277`). Correction : un fond uni issu des jetons (`packages/design-tokens`, décision 45), ou une couleur d'arrivée explicite. (b) Une animation `shimmer` infinie sur l'en-tête (`:93`), ainsi que des effets `hover:scale` et translate sur les cartes, sans garde reduced-motion. (c) Icône emoji « 📅 » (`:234`), à remplacer par l'icône `Calendar` de lucide. | `ui-ux-pro-max/SKILL.md:141`, `:146`, `:100` ; UX-CONSTITUTION §2 (« Gradient card headers ») |
| Conversion | À CORRIGER | 12 cartes d'environ 430 px sur mobile, chacune avec la même phrase « Sélectionnez cette motorisation pour afficher les références compatibles. » (`:253`). Le bloc fait 5 255 px. Correction : des cartes compactes (marque, modèle, moteur, période, flèche), la phrase retirée, et environ 6 cartes visibles sur mobile au lieu de 12 (`VISIBLE_LIMIT`, `:45`). | relevé `releves/apres-isole-blocs.json` de DS |

### 3.5 `#bien-choisir`

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | À CORRIGER (antérieur) | « Bien choisir » et sa liste d'erreurs relèvent de R6 (« comment choisir » est renvoyé à R6 par `role-matrix.md:99-100`). `how_to_choose` et `anti_mistakes` sont `forbidden` pour R1 (`content-section-policy.ts:110`, `:161`). Le bloc doit être ramené à des rappels de compatibilité, avec un renvoi vers le guide d'achat (R6). Les textes vont à l'équipe 06 ; le H2 va à Marwane. Le lien vers le guide d'achat apparaît ici pour la 3e ou 4e fois de la page (voir 3.10). | `role-matrix.md:60` (risque « glissement vers R2/R6 »), `:95`, `:99-100` |
| Performance | OK | `cv-auto`. | — |
| Mobile, a11y | À CORRIGER | Texte #90a1b9 sur blanc : 2,63:1 en 12 px, et 2,58:1 en 10 px sur 5 éléments (§6). Il faut une couleur de texte issue des jetons, d'au moins 4,5:1. | `ui-ux-pro-max/SKILL.md:141` |
| Conversion | OK | — | — |

### 3.6 `#qualite-prix`

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | À CORRIGER | Fourchettes en euros : « 5 € à 30 € », Éco 4-9 €, OES 9-15 €, Premium 15-30 €, OE 30 €+, et 80-150 € en garage. Ce sont des « prix détaillés », interdits en R1, et le signal `detailed_pricing` est listé comme dominant interdit. H2 « Qualité, prix et marques » et H3 « Filtre à huile prix : fourchettes… » : à soumettre à Marwane. | `role-matrix.md:96-97` |
| Performance | OK | — | — |
| Mobile, a11y | À CORRIGER | Contraste de 2,51:1 (§6). | `ui-ux-pro-max/SKILL.md:141` |
| Conversion | À CORRIGER | Des fourchettes qui ne viennent pas du tarif en vigueur peuvent contredire les prix affichés sur la page R2. La source de ces chiffres reste à établir par l'équipe 06. | `CLAUDE.md`, invariant 3 |

### 3.7 `#emplacement`

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | À CORRIGER | Le texte glisse vers R4 et R3 (rôle de la pièce, « se remplace à chaque vidange », « En savoir plus »). R1 n'est ni une page de définition ni une procédure ; l'équipe 06 doit le ramener à un renvoi. Les fautes d'accord du modèle de titre « Où se trouve le {gamme} » sont à soumettre à Marwane. | `role-matrix.md:93`, `:96` |
| Performance | OK | — | — |
| Mobile, a11y | À CORRIGER | Contraste de 2,63:1 (§6). | `ui-ux-pro-max/SKILL.md:141` |
| Conversion | OK | Placé après l'action, il ne gêne pas. | — |

### 3.8 `#faq`

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | À CORRIGER | La FAQ visible compte 5 questions, et la première, « Questions fréquentes sur le filtre à huile », répète le H2. Le `FAQPage` des données structurées en compte 4. Les deux viennent de sources différentes : `purchaseGuideData.faq ?? R1_SELECTOR_FAQ` (`pieces.$slug.tsx:470-471`) et `mergeFaqBlocks(...)` (`:629`). Correction structurelle (hors 05 et 06) : une seule source pour les deux. | P17 du journal |
| Performance | OK | `cv-auto`. | — |
| Mobile, a11y | OK | Aucune violation axe dans `#faq` (§6). | `mesures/apres-axe-390x844.json` |
| Conversion | OK | — | — |

### 3.9 Encart diagnostic

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | À CORRIGER | « Diagnostic gratuit » est un `<h2>` (`GammeDiagnosticCTA.tsx:18`) : un encart d'appel à l'action dans le plan des titres. Correction : un `<p>` mis en forme. Le libellé ne change pas. | `ui-ux-pro-max/SKILL.md:147` (HTML sémantique) |
| Performance | OK | — | — |
| Mobile, a11y | OK | — | — |
| Conversion | OK | Déplacé après la FAQ, il ne concurrence plus le sélecteur. Il reste présent dans la barre basse mobile et l'en-tête desktop. | — |

### 3.10 `#aller-plus-loin`

| Critère | Verdict | Constat et correction | Fondement |
|---|---|---|---|
| SEO | À CORRIGER | Liens en double : « filtre à air » et « filtre à carburant » apparaissent chacun 3 fois (catalogue, « À ne pas confondre », « Pièces souvent associées »). Le guide d'achat est lié 3 à 4 fois sur la page. Les libellés des cartes varient sans règle (« Voir les références », « Trouver la pièce compatible », « Sélectionner par véhicule », « Voir les prix »). « Voir les prix » et « Livraison 24-48h » (4 fois) relèvent du lexique interdit. | décision 82 ; `r1-router-validator.md:68` |
| Performance | OK | — | — |
| Mobile, a11y | À CORRIGER | Orange #f97316 sur #f5f7fa : 2,61:1 sur 4 éléments ; #f89b5a : 1,99:1. Un bouton ne mesure que 48 × 16 px (règle axe `target-size`) (§6). | `ui-ux-pro-max/SKILL.md:141-142` |
| Conversion | OK | En dernier, à sa place. | — |

## 4. Corrections classées par effet attendu

| Rang | Correction | Effet attendu | Équipe |
|---|---|---|---|
| 1 | Fond uni issu des jetons pour les cartes véhicule (`MotorisationsSection.tsx:49`, `:223`, `:260`, `:277`) | Le bouton « Voir les pièces » devient lisible sur toutes les pages R1, au deuxième écran mobile | 05 |
| 2 | Cartes véhicule compactes sur mobile : phrase répétée retirée, environ 6 cartes visibles | `#reference` passe d'environ 5 250 px à environ 1 500 px ; l'éditorial remonte de 3 500 px environ | 05 |
| 3 | Navigation rapide : pastilles de 44 px, liens `<a href="#id">`, défilement selon reduced-motion | Cibles tactiles conformes ; ancres lisibles par les moteurs | 05 |
| 4 | Prix en euros, « livraison », « en stock », « Voir les prix » retirés des blocs R1 | Page conforme au rôle R1 | 06 (textes), Marwane (titres) |
| 5 | Une seule source pour la FAQ visible et le `FAQPage` | Données structurées fidèles à la page | à attribuer par Marwane |
| 6 | Bouton du chat qui ne recouvre plus le sélecteur au premier écran mobile | Sélecteur entièrement utilisable | 05 |
| 7 | Animations : `motion-reduce:` sur `shimmer`, `hover:scale` et translate | Conforme aux contrôles bloquants | 05 |
| 8 | Liens générés par règle : « Fiche technique » et doublons de `#aller-plus-loin` | Conforme à la décision 82 | 05 et règles de liens |
| 9 | Image du hero : priorité haute réservée au desktop | À confirmer par les mesures terrain | 05 |
| 10 | « Diagnostic gratuit » en `<p>`, « 📅 » remplacé par lucide `Calendar`, contraste du fil d'Ariane | Plan des titres et icônes conformes | 05 |

## 5. Mesures

### 5.1 Relecture des mesures de DS

- **Protocole** (`outils/measure.cjs`) : Chromium headless, 412 × 823, DPR 1,75, processeur ralenti
  4 fois, RTT 150 ms, 1,6 Mb/s, cache désactivé, médiane de 3 passages. C'est un bridage de type
  DevTools, pas le bridage simulé de Lighthouse : les chiffres ne se comparent pas à PageSpeed Insights.
- **LCP 2 824 → 1 732 ms** : le chiffre est exact, mais le gain vient du changement d'élément LCP.
  L'image passe sous le premier écran et le H1 devient le plus grand élément visible ; ce n'est pas
  un rendu plus rapide du même élément. Le gain réel pour l'utilisateur est que le sélecteur apparaît
  plus tôt.
- **TBT 26 → 86 ms** : je n'ai pas reproduit l'écart à cette ampleur (46 ms, profil identique). Les deux
  valeurs restent sous 200 ms (« bon » selon UX-CONSTITUTION §1).
- **CLS 0** : confirmé.

### 5.2 Mes mesures

- **Méthode** : mon propre worktree `/home/deploy/worktrees/claude-du-revue-experte-r1-20261119`, à la
  tête `8507eb5b8` de #2210 (version « après »). `node_modules` est local, sans lien vers
  `/opt/automecanik/app` (`readlink -f` vérifié).
- **Build** : `react-router build`, servi par `react-router-serve` sur `127.0.0.1:3028`.
- **Proxy** : celui de DS (`outils/img-proxy.mjs`) sur `127.0.0.1:3027`. Il fait des lectures GET vers
  le DEV `:3000`, répond lui-même aux envois de télémétrie, et refuse toute autre écriture.
- **Profil** : le même que DS ; médiane de 3 passages.
- **Scripts et résultats** : `scripts/` (Playwright, lancés depuis le worktree de relecture) et `mesures/` (JSON bruts) ; deux captures dans `captures/`.

| Série | LCP médian | Élément LCP | CLS | TBT |
|---|---|---|---|---|
| 412 × 823, profil de DS | 1 792 ms | H1 | 0 | 46 ms |
| 375 × 800, viewport par défaut de la constitution UX | 1 784 ms | H1 | 0 | 85 ms |
| 412 × 915, téléphone Android haut | **2 712 ms** | **image du hero** (haut à 761 px) | 0 | 76 ms |
| 412 × 823, défilement de 900 px juste après le premier affichage | non retenu ¹ | — | **0** (aucun décalage) | 50 ms |

¹ Un défilement programmatique ne compte pas comme une action de l'utilisateur ; le navigateur continue
donc d'observer le LCP, ce qui n'arrive pas chez un vrai visiteur. Seul le CLS de cette série est retenu.

La version « avant » à 412 × 915 n'a pas été mesurée : la série n'apporte rien à la décision, puisque l'image est déjà sous le premier écran dans les deux versions à cette hauteur.

### 5.3 Réactivité (INP de labo)

- **Méthode** (`scripts/measure-inp-du.cjs`) : même profil que ci-dessus, 412 × 823. Après le
  chargement et 10 s d'hydratation, quatre touchers réels. Pour chaque interaction, la mesure est la
  durée maximale des entrées Event Timing (seuil 16 ms). Médiane de 3 passages, version « après ».

| Toucher | INP médian (passages) | Taille de la cible |
|---|---|---|
| Onglet « Type Mine » du sélecteur | 96 ms (136, 96, 80) | 174 × 44 |
| Navigation rapide, « Compatibilité » | 24 ms (40, 24, 24) | 132 × **37** |
| « Voir les 7 autres compatibilités » | 64 ms (64, 64, 56) | 320 × 48 |
| Première question de la FAQ | 64 ms (40, 80, 64) | 353 × 64 |

Les quatre interactions restent sous 200 ms (« bon » selon UX-CONSTITUTION §1). Un INP de labo ne
remplace pas l'INP terrain p75, qui reste **à mesurer** après PREPROD et PROD (décision 81).

## 6. Audit d'accessibilité automatique (axe-core)

- **Méthode** (`scripts/audit-a11y-du.cjs`) : axe-core 4.12.1, règles WCAG 2.0, 2.1 et 2.2 A et AA,
  plus les bonnes pratiques. Mobile 390 × 844, DPR 2, page entièrement défilée pour rendre les blocs
  différés. Version « après ». Résultat complet : `mesures/apres-axe-390x844.json`.

| Règle axe | Impact | Nœuds | Où |
|---|---|---|---|
| `color-contrast` | grave | 24 | Réassurance (« Conseils entretien », 3,49:1) ; `#bien-choisir` (2,63:1 et 2,58:1 ×5) ; `#qualite-prix` (2,51:1) ; `#emplacement` (2,63:1) ; badge « 2 min » (#f54900 sur #fff7ed, 3,38:1 en 10 px) ; `#aller-plus-loin` (2,61:1 ×4, 1,99:1) ; pied de page (3,73:1, 2,24:1 ×2, 1,88:1) ; libellés de la barre basse mobile en 10 px (2,63:1 et 2,8:1) |
| `link-in-text-block` | grave | 1 | `#reference` : lien « Conseils : changer un filtre à huile étape par étape », distingué du texte seulement par la couleur (1,44:1) |
| `region` | modéré | 2 | Bandeau « Livraison gratuite dès 150€ » et « Retours 30j » hors de tout repère (landmark) |
| `target-size` | grave | 1 | `#aller-plus-loin` : bouton de 48 × 16 px |

axe n'évalue pas le texte posé sur un dégradé. Le défaut des cartes véhicule (§3.4) a donc été confirmé
sur capture : `captures/du-carte-vehicule-390.png` et `captures/du-bouton-autres-390.png`.

**Cibles tactiles sous 44 × 44 px** (seuil des skills ; WCAG 2.2 AA n'exige que 24 px) :

| Zone | Nombre | Exemples |
|---|---|---|
| Navigation rapide | 6 | boutons de 37 px de haut |
| Réassurance et corps de page | 5 | lien d'évitement (1 × 1 hors focus, normal) ; « Guide d'achat », « Conseils entretien », « Fiche technique » de 16 px de haut |
| Fil d'Ariane | 2 | liens en 10 px |
| `#reference` | 3 | liens dans le texte |
| `#bien-choisir` | 2 | liens dans le texte |
| `#emplacement` | 1 | « En savoir plus » |
| `#aller-plus-loin` | 5 | bouton 48 × 16 |
| Pied de page | 1 | « CGV », 26 × 44 |
| Recherche (en-tête) | 1 | champ de 41 px de haut |

**Ordre de tabulation** (`mesures/apres-tab-390.txt`, 40 appuis sur Tab à 390 px) : en-tête → lien
« Aller au contenu principal » → fil d'Ariane → onglets du sélecteur → « Réinitialiser » → liens de
réassurance → navigation rapide → `#reference` (liens, champ de filtre, 12 cartes, « Voir les 7 autres »)
→ `#bien-choisir`. L'ordre suit l'ordre visuel proposé. Deux réserves :

1. Le lien d'évitement n'arrive qu'en 5e position, après l'en-tête, et non en premier. C'est
   antérieur à #2210.
2. Au 10e appui, le focus passe sur `<body>`, à l'endroit où le champ « Marque » devrait le recevoir.
   Le comportement est identique avant (DEV `:3000`) et après. Il reste **à vérifier** avec un vrai
   clavier et un lecteur d'écran ; c'est peut-être un effet du navigateur sans affichage.

Lors d'un premier passage, sans pause entre les appuis, un écran d'erreur de l'application est apparu
(« Réessayer », « Signaler le problème »). Il ne s'est pas reproduit sur 5 passages suivants, rapides ou
lents, et aucune erreur JavaScript n'a été enregistrée. Fréquence observée : 1 sur 6 ; cause inconnue.
**À mesurer** dans les journaux d'erreurs du client après PREPROD.

Aucun contrôle interactif n'est sans nom accessible. Les champs du sélecteur ont chacun leur libellé
(« Marque », « Année », « Modèle », « Motorisation »), et les champs dépendants restent désactivés
tant que le précédent n'est pas choisi.

## 7. Listes séparées (rien n'a été écrit)

### 7.1 À soumettre à Marwane : titres et H1 (lien avec le mandat DG)

Aucune proposition de formulation : ce sont des constats. La décision revient à Marwane (règle du
19/11, 07:14).

| Élément | Texte actuel | Constat | Fondement |
|---|---|---|---|
| H1 | « Filtre à huile compatible avec votre véhicule » | Aucun changement proposé ; H1 unique | — |
| `<title>` servi | « Filtre à huile \| Trouvez la référence compatible \| AutoMeca… » (60 caractères) | Coupé : les points de suspension font partie du texte servi par le backend (`data.meta.title`). Antérieur, identique avant et après | relevés `avant-head-390.json` et `apres-head-390.json` |
| Meta description servie | « Filtre à huile voiture pas cher dès 5€. […] En stock, livraison 24-48h. » | Prix, « pas cher », « en stock » et « livraison » : interdits en R1. Antérieur, identique avant et après. Ne pas y toucher sans décision (invariant 6) | `role-matrix.md:96` ; `r1-router-validator.md:68,70` |
| H2 `#qualite-prix` | « Qualité, prix et marques » | Contient « prix » ; DS propose « Qualité et marques » | `role-matrix.md:96` |
| H3 `#qualite-prix` | « Filtre à huile prix : fourchettes selon le type et la marque » | Prix détaillés | `role-matrix.md:96` |
| H3 `#reference` | « Commander votre filtre à huile en stock — livraison rapide » | « en stock », « livraison » | `r1-router-validator.md:68,70` |
| Libellé de la navigation rapide | « Prix & Marques » (`GammeQuickNav.tsx:14`) | Doit suivre le H2 retenu | — |
| Titre de repli (meta) | « {gamme} compatible véhicule \| Prix & Livraison rapide » (`pieces.$slug.tsx:457`) | Repli seulement (le titre servi sur le DEV est « Filtre à huile \| Trouvez la référence compatible \| … »), mais il contient le lexique interdit | `r1-router-validator.md:68` |
| H2 `#emplacement` | « Où se trouve le {gamme} » | Fautes d'accord selon la gamme (relevé par DS) | — |
| H2 de l'encart diagnostic | « Diagnostic gratuit » | Rétrograder en simple texte, libellé inchangé | 3.9 |
| 1re question de la FAQ | « Questions fréquentes sur le filtre à huile » | Répète le H2 de la section | 3.8 |

### 7.2 Corrections d'apparence pour l'équipe 05

Ce sont les rangs 1, 2, 3, 6, 7, 8, 9 et 10 du §4, les constats « Mobile, a11y » du §3, les violations axe
et les cibles tactiles du §6, ainsi que les lignes « Jetons de design » et « Mouvement réduit » du §12. Toutes passent par les jetons de `packages/design-tokens` (décision 45),
shadcn et lucide (`.claude/rules/frontend.md`).

### 7.3 Constats de texte pour l'équipe 06

| Bloc | Texte | Règle |
|---|---|---|
| Réassurance | « Livraison 24-48h » | lexique interdit (`r1-router-validator.md:68`) |
| `#reference` | « en stock — livraison rapide », « avec le prix, la disponibilité » | `role-matrix.md:96` ; lexique interdit |
| `#qualite-prix` | fourchettes en euros (5–30 €, Éco 4–9 €, OES 9–15 €, Premium 15–30 €, OE 30 €+, 80–150 € en garage) | prix détaillés interdits ; source à établir (invariant 3) |
| `#emplacement` | rôle de la pièce, périodicité de remplacement | relève de R4 ou R3, pas de R1 |
| `#aller-plus-loin` | « Voir les prix », « Livraison 24-48h » (4 fois) | lexique interdit |
| `#reference` (cartes) | phrase répétée 12 fois | à retirer (voir correction 2) |
| `#emplacement`, `#reference`, réassurance | « quand » (H2 `#emplacement`), « pourquoi », « causes » | mots de `FORBIDDEN_KEYWORDS_R1` (`page-role-validator.service.ts:75-97`). Le H2 va à Marwane |
| `#bien-choisir`, `#aller-plus-loin` | « Ne pas confondre avec » (2 fois) | vocabulaire réservé à R4 (`page-role-validator.service.ts:244`, `:256`) ; voir contradiction C9 |

Le bandeau « Livraison gratuite dès 150€ » n'est pas un texte R1 : il est global, et #2143 le remplace par un seuil venu du backend. Il relève de #2143, pas de l'équipe 06.

## 8. Conformité au rôle et au contrat R1 : avant et après (complément n° 1)

### 8.1 Sources lues

| Source | Rôle dans la hiérarchie | Lignes utilisées |
|---|---|---|
| `.spec/00-canon/role-matrix.md` | canon (CLAUDE.md, invariant 6) | `:60`, `:87-100`, `:204`, `:283`, `:340` |
| `packages/seo-role-contracts/src/contracts/r1.ts` | contrat exécutable (P12, `journal-des-principes.md:137-141`) | `:22-38` |
| `packages/seo-role-contracts/src/compose-indexability.ts` | verdict d'indexabilité | `:9-24`, `:98` |
| `backend/src/config/page-contract-r1.json` et `page-contract-r1.schema.ts` | **forme** d'un contrat R1, sans valeurs (`page-contract-cross-role-policy.json:274`) | `json:7-31`, `:110-115`, `:224-306` ; `schema.ts:2`, `:88-89` |
| `backend/src/config/page-contract-cross-role-policy.json` | porte A (motifs hors rôle) | `:272-285` |
| `backend/src/config/content-section-policy.ts` | sections permises par rôle | `:110`, `:161`, `:203`, `:217-219`, `:315-330` |
| `backend/src/modules/seo/validation/page-role-validator.service.ts` | règles de validation | `:75-97`, `:226-237`, `:244-256`, `:264-273`, `:502-509`, `:926-946` |
| `backend/src/modules/seo/interceptors/page-role-validation.interceptor.ts` | exécution du validateur | `:7`, `:80-86` |
| `backend/src/modules/seo/types/page-role.types.ts` | méta des rôles, liens autorisés | `:33-38`, `:104-108`, `:126` |
| `backend/src/modules/seo/r2/services/r1-gamme-completeness-audit.service.ts` | audit de complétude R1 | `:36-46` |
| `backend/src/config/r1-keyword-plan.constants.ts` | plan de sections S0–S9, règles RG | `:32-43`, `:197-201` |
| `backend/src/config/r1-media-rules.constants.ts` | règles médias | `:6-14` |
| `backend/supabase/migrations/20260322_create_r1_gamme_slots.sql` | emplacements de contenu en base | `:8-49` |
| `frontend/app/types/gamme-page-contract.types.ts` et `utils/gamme-page-contract.utils.ts` | contrat de **données** de la route (niveaux 1 à 3) | `parseGammePageData` |
| `frontend/app/constants/r1-sections.ts` | liste des sections R1 côté frontend | énumération `R1Section` |
| `.spec/00-canon/db-governance/role-implementation-map.md` | état d'implémentation | `:36`, `:77`, `:111` |
| `workspaces/seo-batch/.claude/agents/r1-router-validator.md` | lexique interdit de l'agent | `:60-76` |
| `design-system/roles/R1-router.md` | document de design (dernier commit `8abbc32469`, 08/02/2026) | voir C1 |

L'intercepteur se trouve dans `backend/src/modules/seo/interceptors/`, et non sous `validation/interceptors/`
comme l'indique le mandat. Le chemin du mandat est inexact ; c'est sans effet sur le fond.

### 8.2 Exigence par exigence

Le diff de #2210 ne modifie **aucun texte** : il déplace des blocs, inverse le fond de `#faq` et celui de
`#aller-plus-loin`, et réordonne la navigation rapide. Le texte servi par le DEV (`:3000`, version « avant »)
vaut donc aussi pour la version « après ». Les décomptes ci-dessous viennent de
`mesures/avant-apres-termes-roles.json` : texte visible du `<main>`, 1 883 mots, page entièrement
défilée.

| # | Exigence | Source | Avant | Après | Constat |
|---|---|---|---|---|---|
| 1 | Rôle déclaré R1 | `role-matrix.md:340` ; `pieces.$slug.tsx:90`, `:301` | RESPECTÉ | RESPECTÉ | `pageRole: R1_ROUTER` ; contrat de données `parseGammePageData` inchangé |
| 2 | Intention : trouver la bonne gamme pour le bon véhicule ; le sélecteur domine | `role-matrix.md:89`, `:92` | RESPECTÉ en partie | RESPECTÉ | Avant, le sélecteur n'est qu'à moitié visible au premier écran mobile ; après, il l'est entièrement |
| 3 | Intention informationnelle ou navigationnelle, « pas transactionnel pur » | `r1.ts:36-38` | NON RESPECTÉ | NON RESPECTÉ | La meta description est transactionnelle (« dès 5€ », « En stock », « livraison 24-48h »). Antérieur, identique |
| 4 | Section micro-SEO obligatoire de 1 500 à 3 000 caractères | `r1.ts:22-31` | NON VÉRIFIABLE | NON VÉRIFIABLE | Aucune section servie n'est marquée comme `R1_S4_MICRO_SEO` : l'énumération `R1Section` n'est pas utilisée par la route (voir C10) |
| 5 | Sections obligatoires S0, S1, S4 et S9 du plan de mots-clés | `r1-keyword-plan.constants.ts:32-43` | NON VÉRIFIABLE | NON VÉRIFIABLE | Même cause ; la FAQ (S9) est bien présente |
| 6 | Sorties autorisées : hero, sélecteur, rappels de compatibilité, variantes, FAQ de sélection, renvois R3 à R6 | `role-matrix.md:95` | RESPECTÉ | RESPECTÉ | Toutes présentes. Le « tableau sûr léger » n'existe pas en tant que bloc distinct, mais il est autorisé, pas exigé |
| 7 | Pas de prix détaillés (`detailed_pricing`) | `role-matrix.md:96-97` | NON RESPECTÉ | NON RESPECTÉ | 7 « € » et 5 « prix » dans `#qualite-prix` ; 8 « prix » sur la page |
| 8 | Pas de stock | `role-matrix.md:96` | NON RESPECTÉ | NON RESPECTÉ | « en stock » dans le H3 de `#reference` et dans la meta description |
| 9 | Pas de panier ni d'appel à l'achat dominant (`basket_cta`) | `role-matrix.md:96-98` | RESPECTÉ | RESPECTÉ | Aucun bouton « ajouter au panier » dans les blocs R1. « Commander » y figure 3 fois, sans bouton |
| 10 | Zéro procédure | `role-matrix.md:98` ; `cross-role-policy.json:276-284` | RESPECTÉ | RESPECTÉ | Porte A : 0 occurrence ; vocabulaire R3 : 0. Un lien « Conseils : changer un filtre à huile étape par étape » est un renvoi R3, permis |
| 11 | Zéro symptôme en premier ; pas d'arbre de symptômes | `role-matrix.md:97-98` | RESPECTÉ | RESPECTÉ | « causes » 1 fois, « usure prématurée » 1 fois, sans arbre de symptômes |
| 12 | Pas de « comment choisir » (renvoi R6) | `role-matrix.md:99-100` ; `content-section-policy.ts:110`, `:161` | NON RESPECTÉ | NON RESPECTÉ | `#bien-choisir` et sa liste d'erreurs (§3.5) |
| 13 | Pas de définition ni de glossaire approfondi (renvoi R4) | `role-matrix.md:96`, `:99` ; `content-section-policy.ts:315-330` | NON RESPECTÉ en partie | NON RESPECTÉ en partie | « Ne pas confondre avec » (2 fois) ; `#emplacement` décrit le rôle de la pièce (§3.7) |
| 14 | Mots interdits du validateur R1 | `page-role-validator.service.ts:75-97` | NON RESPECTÉ | NON RESPECTÉ | « quand » (H2 de `#emplacement`), « pourquoi » (`#reference`), « causes » : 1 chacun. La règle compte une sous-chaîne, sans seuil |
| 15 | Vocabulaire réservé à R2 | `page-role-validator.service.ts:226-237` | NON RESPECTÉ | NON RESPECTÉ | « € » 7, « prix » 8, « commander » 3, « en stock » 1 |
| 16 | Lexique interdit de l'agent R1 | `r1-router-validator.md:66-76` | NON RESPECTÉ | NON RESPECTÉ | « livraison » 9 fois, « en stock » 1 fois |
| 17 | Ordre imposé des blocs | aucune source | NON VÉRIFIABLE | NON VÉRIFIABLE | Aucune source R1 n'impose un ordre de rendu. Les sections S0 à S9 sont numérotées sans ordre exigé. Le seul repère est l'exemple des skills (`antipattern-editorial-sprawl.md:33-38`), que l'« après » suit et l'« avant » non |
| 18 | Volume maximal de 150 mots | `page-role.types.ts:36` ; `page-role-validator.service.ts:502-509` | NON RESPECTÉ | NON RESPECTÉ | 1 883 mots. Cette règle contredit `r1.ts:24-27` (voir C3) ; le canon prévaut |
| 19 | Frontière R2 : le sélecteur appartient à R1 | `page-role-validator.service.ts:117-123` | RESPECTÉ | RESPECTÉ | — |
| 20 | Frontière R3 | `cross-role-policy.json:276-282` | RESPECTÉ | RESPECTÉ | Voir 10 |
| 21 | Frontière R5 | `role-matrix.md:99-100` ; `page-role-validator.service.ts:264-273` | RESPECTÉ selon le canon | RESPECTÉ selon le canon | L'encart diagnostic est un renvoi vers R5, permis par le canon. Le validateur classe « diagnostic » (4 fois) comme vocabulaire R5 ; voir C8 |
| 22 | Frontière R6 | `role-matrix.md:99-100` | NON RESPECTÉ | NON RESPECTÉ | Voir 12 |
| 23 | Indexable, canonique vers elle-même | `page-role.types.ts:37` ; `page-role-validator.service.ts:1095-1122` | RESPECTÉ | RESPECTÉ | `index, follow`, canonique `https://www.automecanik.com/pieces/filtre-a-huile-7.html`, aucun en-tête `X-Robots-Tag` |
| 24 | Verdict d'indexabilité (seuil de familles pour R1) | `compose-indexability.ts:98` | NON VÉRIFIABLE | NON VÉRIFIABLE | Les entrées du seuil ne sont pas lisibles depuis la page. Le résultat servi est `index, follow` |
| 25 | Données structurées : `Article` et `BreadcrumbList` seulement | `r1.ts:33` | NON RESPECTÉ | NON RESPECTÉ | Servi : `CollectionPage`, `ItemList` (19), `FAQPage` (4), `Organization`, `BreadcrumbList` imbriqué. Pas d'`Article`. Voir C2 |
| 26 | FAQ visible = FAQ des données structurées | P17 du journal | NON RESPECTÉ | NON RESPECTÉ | 5 questions visibles, 4 en `FAQPage` (§3.8) |
| 27 | Liens sortants selon le canon : R2, et renvois R3 à R6 | `role-matrix.md:95`, `:99-100` | RESPECTÉ | RESPECTÉ | Dans `<main>` : R2 12, R1 13, R3 3, R4 2, R5 3, R6 3. Les 13 liens R1 sont des liens croisés de la même famille, prévus par `page-contract-r1.json:247-269` |
| 28 | Liens sortants selon le validateur : R2 seulement | `page-role.types.ts:126` ; `page-role-validator.service.ts:929-935` | NON RESPECTÉ | NON RESPECTÉ | 24 liens hors R2. Le canon prévaut (voir C4) |
| 29 | Liens écrits à la main (décision 82) | décision 82 | NON RESPECTÉ | NON RESPECTÉ | « Fiche technique » → `/reference-auto` (`pieces.$slug.tsx:822`) ; doublons (§3.10) |
| 30 | Médias : pas de photo de véhicule | `r1-media-rules.constants.ts:12` | NON RESPECTÉ | NON RESPECTÉ | Les 12 cartes de `#reference` portent une image de véhicule de 80 × 80 |
| 31 | Médias : pas de fond décoratif ; texte alternatif descriptif, sans prix | `r1-media-rules.constants.ts:7`, `:13` | RESPECTÉ | RESPECTÉ | Le hero montre la pièce ; alt « Filtre à huile — pièce automobile neuve ». Toutes les images ont un alt |
| 32 | Un seul H1 | aucune règle de contrat ; bonne pratique | RESPECTÉ | RESPECTÉ | « Filtre à huile compatible avec votre véhicule » |
| 33 | Le validateur s'exécute sur la page | `page-role-validation.interceptor.ts:7`, `:80-86` | NON VÉRIFIABLE | NON VÉRIFIABLE | Mode « Monitoring », sans blocage. Il ne valide que si le contrôleur renvoie une chaîne HTML, or le contrôleur SSR écrit directement dans la réponse (`remix.controller.ts:160-163`, `createRequestHandler`). **Déduction non vérifiée en exécution** : il ne se déclenche probablement jamais sur une page R1 servie |

**Synthèse.** Avant et après, les verdicts sont identiques, à deux exceptions près, toutes deux en
faveur de la maquette : l'intention du n° 2 et l'ordre du n° 17. Tous les écarts NON RESPECTÉ sont
**antérieurs** à #2210. Ceux qui relèvent du texte vont à l'équipe 06 (n° 7, 8, 12 à 16), ceux qui relèvent
des titres ou de la meta à Marwane (n° 3, 14), et les autres doivent être attribués (n° 25, 26, 29, 30).

## 9. Contradictions entre sources

Règle de préséance : est en vigueur ce qui est fusionné sur `main` (`journal-des-principes.md:18`). Les
règles d'un rôle vivent dans `packages/seo-role-contracts` et non dans les services (P12,
`journal-des-principes.md:137-141`). `role-matrix.md` est la référence des rôles (CLAUDE.md, invariant 6).
Je n'ai rien corrigé.

| # | Contradiction | Source qui prévaut | Ce qu'il faudrait corriger |
|---|---|---|---|
| C1 | `design-system/roles/R1-router.md` décrit une page R1 de listing : filtres, « Price range », « Availability », cartes de résultats avec prix, bouton qui pulse en continu, URL d'exemple `/pieces/freinage/`. Le canon interdit prix et stock (`role-matrix.md:96-97`), et l'URL R1 est `/pieces/<gamme>-<id>.html` (`:340`) | `role-matrix.md` et `r1.ts` | Réécrire `R1-router.md` d'après le canon, ou le marquer comme historique |
| C2 | `r1.ts:33` n'autorise qu'`Article` et `BreadcrumbList` ; la page sert `CollectionPage`, `ItemList`, `FAQPage` et `Organization`. Le canon autorise une « FAQ de sélection » (`role-matrix.md:95`) | `r1.ts`, contrat exécutable | Décision de Marwane : amender `r1.ts` par PR (ajouter `FAQPage`, `ItemList`, `CollectionPage` si voulu), ou aligner le JSON-LD servi. Ne rien changer à une page indexée sans accord |
| C3 | Maximum de 150 mots (`page-role.types.ts:36`, vérifié en erreur `page-role-validator.service.ts:502-509`, testé par `page-role-validator.test.ts:24-32`) contre une section micro-SEO de 1 500 à 3 000 caractères (`r1.ts:24-27`) et une FAQ de 120 mots minimum (`r1-keyword-plan.constants.ts:172-181`) | `r1.ts` | Retirer ou relever `maxWords` pour R1 dans le validateur et son test |
| C4 | Liens R1 vers R2 seulement (`page-role.types.ts:126`) contre des renvois R3 à R6 (`role-matrix.md:95`, `:99-100`) et des liens croisés de même famille (`page-contract-r1.json:247-269`) | `role-matrix.md` | Mettre `ALLOWED_LINKS[R1]` en accord avec le canon |
| C5 | Intention « transactionnelle » (`page-contract-r1.schema.ts:2` ; RG1 `r1-keyword-plan.constants.ts:197-201`) contre « informationnelle ou navigationnelle, pas transactionnel pur » (`r1.ts:36-38`) | `r1.ts` et `role-matrix.md:92-93` | Corriger le commentaire du schéma et la règle RG1 |
| C6 | Prix interdits (`role-matrix.md:96` ; vocabulaire R2 `page-role-validator.service.ts:226-237` ; `ban_price_push`, `page-contract-r1.json:394`) contre une FAQ R1 dont l'intention inclut `prix` et `livraison` (`content-section-policy.ts:203`), et la porte A de R3/R4 qui renvoie « prix » à R1 (`cross-role-policy.json:286-308`) | `role-matrix.md` | Retirer `prix` et `livraison` de l'intention de la FAQ R1, et renvoyer « prix » à R2 dans la porte A |
| C7 | L'audit de complétude exige S3 « Comment choisir », S5 « Erreurs à éviter » et S6 « Vérification finale » (`r1-gamme-completeness-audit.service.ts:39-45`). Or `how_to_choose` et `anti_mistakes` sont interdits en R1 (`content-section-policy.ts:110`, `:161`), et « vérification finale » est réservé à R3 (`page-role-validator.service.ts:304`) | `role-matrix.md:99-100` | Revoir la liste des sections critiques de l'audit. Elle conditionne aussi le pilote R2 (au-delà de 30 % de gammes incomplètes) |
| C8 | Symptômes en `link_only` et blocs `risk` et `timing` de 60 mots permis en R1 (`content-section-policy.ts:74-76`, `:91-93`, `:217-219`), contre l'interdiction de « quand », « pourquoi », « risques » et « symptôme » par sous-chaîne (`page-role-validator.service.ts:75-97`) | `role-matrix.md:98` (zéro symptôme **en premier**, renvoi R5 permis) | Remplacer la recherche par sous-chaîne par des motifs bornés ; « quand » bloque des titres ordinaires |
| C9 | `confusion_pairs` fait partie du contrat R1 (`page-contract-r1.json:56-86`), mais `confusions` y est interdit (`content-section-policy.ts:315-330`) et « ne pas confondre avec » est réservé à R4 (`page-role-validator.service.ts:256`). Le canon parle pourtant d'« anti-erreur de filtrage » (`role-matrix.md:92`) | ambigu : non tranché par le canon | À trancher par Marwane et à inscrire au journal |
| C10 | `frontend/app/constants/r1-sections.ts` définit les sections R1 et `sectionAttr()`, mais la route ne les utilise pas. Aucune section servie ne peut donc être rattachée au contrat (S0 à S9, `R1_S4_MICRO_SEO`) | — | Marquer les sections servies (`data-section`) avec cette énumération |
| C11 | Le validateur de rôle est décrit comme un garde-fou, mais il est en mode « Monitoring » (`page-role-validation.interceptor.ts:7`) et probablement jamais déclenché sur les pages SSR (n° 33 du §8.2) | — | Lacune, pas contradiction : à vérifier en exécution avant de s'y fier |
| C12 | `role-implementation-map.md:36`, `:111` dit R1 « stable », avec « contrat + pipeline + agent complets ». Or `r1.ts:4-10` indique qu'aucun générateur R1 n'existe et que les producteurs RAG ont été retirés ; le journal parle de « plusieurs services R1 » (`journal-des-principes.md:141`) | `r1.ts` et le journal | Mettre à jour la carte d'implémentation |
| C13 | Le mandat cite les décisions 45, 55, 57, 81 et 82, absentes du journal des principes | le journal | Les inscrire au journal, ou citer leur source |

## 10. Contrôles automatiques qui couvrent R1

**Aucun contrôle exécuté sur une PR ne vérifie l'ordre des blocs ni le rendu d'une page R1.**

| Contrôle | Ce qu'il vérifie pour R1 | Sur #2210 |
|---|---|---|
| 🧪 Frontend Tests (`ci.yml:272-304`, vitest) | `r1-builders`, `r1-faq`, `r1-section-pack` (source de chaque section, pas l'ordre), `r1-images-meta`, et deux tests du `loader` de `pieces.$slug` | réussi |
| 🧪 Backend Tests (`ci.yml:193-246`, jest) | `page-role-validator.test.ts:23` (150 mots, pas de symptômes) ; `r1-gamme-completeness-audit.test.ts:95` | réussi |
| ʦ TypeScript, ⬣ ESLint | compilation et lint de la route et des composants gamme | réussi |
| 🛡️ Deterministic gates (`audit.yml`, ast-grep) | littéraux de rôle (`seo-no-bare-role-literal`) | réussi |
| check-role-purity.ts (`governance-checks.yml:68-88`) | vocabulaire de rôle dans les commentaires | réussi |
| url-immutability | contrat d'URL | réussi |
| 🔍 CWV Performance Check (`perf-gates.yml:43`) | taille des bundles, pas les Web Vitals de la page | réussi |
| 🎭 E2E Smoke (`ci.yml:1390-1394`) | page R1 de référence `/pieces/plaquette-de-frein-402.html` : orientation, pas de défilement horizontal, police ≥ 14 px, `data-section="equipementiers"` présent (`url-validation.spec.ts:152`) | ignoré (`main` seulement) |
| 🔦 Lighthouse (`ci.yml:1567-1577`) | même page R1, contre PREPROD | ignoré (`main` seulement) |
| Régression visuelle (`visual-gate.yml`) | `r1-gamme` à 1 920 × 1 080 et 390 × 844, premier écran seulement (`pages.visual.spec.ts:54`, `:108`), tolérance 2 % (`:110`) | **jamais lancée sur une PR** : déclenchement manuel uniquement (`workflow_dispatch`) |
| Tests de `packages/seo-role-contracts` (`compose-indexability.test.ts`…) | indexabilité, pas la mise en page | non lancés : seul `dependency-family-bump.yml:120` les exécute |
| `scripts/seo/r1-readiness.ts` | rapport de préparation par gamme | appelé par aucun workflow |

Sur les 46 vérifications de #2210 : 31 réussies, 12 ignorées, 3 en échec. Les trois échecs (« Registry
freshness », « 🚦 Circuit de fusion », « 🧾 DoD self-evaluation present ») ne testent pas R1.

**Si l'ordre est validé**, à mettre à jour :

- `frontend/tests/visual/snapshots/{desktop,mobile}/pages.visual.spec.ts/r1-gamme.png`. Ce sont les
  seules références comparées. Elles datent du 26/06/2026 (#1170) et montrent `plaquette-de-frein-402`.
  Le hero et la navigation rapide changent au premier écran mobile, ce qui dépassera très probablement
  la tolérance de 2 %. Pour les régénérer : lancer `visual-gate.yml` avec `capture_baselines=true` contre
  PREPROD après déploiement, puis committer les images dans une PR déclarée `visual-change`.
- `frontend/tests/visual/reference-v3/*/r1-gamme.png` : archive que rien ne lit. Ne pas y toucher.
- Aucun test unitaire ni E2E ne casse : aucun n'affirme l'ordre des sections, ni l'ordre de `SECTIONS`
  (`GammeQuickNav.tsx:11-17`).
- Si C3 est corrigé, il faudra mettre à jour `page-role-validator.test.ts:24-32`.

Lacune à signaler : un changement d'ordre ou d'apparence R1 n'est vérifié par aucun contrôle de PR.
La régression visuelle n'alerte qu'après lancement manuel, et seulement sur `plaquette-de-frein-402`.

## 11. Cohérence avec #1943, #1944, #2143 et le mandat DG

Simulation de fusion (`git merge-tree --write-tree`) entre la tête de #2210 et chaque PR :

| PR | État | Relation avec #2210 | Résultat de la simulation | À décider |
|---|---|---|---|---|
| #1943 (tête `dc7802053`) | ouverte, non brouillon | Change `GammeHero.tsx` exactement comme #2210 (`order-last`, `mt-4`), octet pour octet | aucun conflit | Doublon : garder l'une des deux. Décision de Marwane |
| #1944 (tête `60b8a86b0`) | brouillon | Ajoute à `GammeQuickNav.tsx` une propriété `withPrice` (« Qualité & Marques » quand il n'y a pas de prix), et à `pieces.$slug.tsx` un `priceSectionMentionsPrice` | **conflit** dans `frontend/app/routes/pieces.$slug.tsx` | Même intention que #2210 sur le libellé, mais la seconde à fusionner devra être rebasée |
| #2143 (tête `f369c46a2`) | brouillon (mandat BJ) | Remplace le seuil « Livraison gratuite dès 150€ » par la valeur du backend, et le texte des retours | aucun conflit sur les fichiers de #2210 ; conflits seulement sur des fichiers générés (`REPO_MAP.md`, registres), parce que #2143 est en retard sur `main` | Le bandeau de 150 € visible sur la maquette est l'état d'avant #2143 |
| Mandat DG (#2201) | ouverte | Carte des requêtes et propositions de titres des pages gamme | sans objet (documents) | Les constats du §7.1 lui reviennent |

## 12. Liste de contrôle « rien au hasard »

Mise à jour du complément n° 5 pour la tête `06feff9686afa610d5b0363397e2cd2b7ec3fe1d`
(relevée et revérifiée avant publication ; PR brouillon, ouverte).

- **Lignes remesurées au n° 5** :
  - Contraste, Jetons, Lisibilité, Cohérence des teintes, Diff, Autres gammes et Typecheck ;
  - les quatre nouvelles lignes « Phrases des cartes véhicule », « Langue des phrases »,
    « Répétition entre pages », « Cache des réponses v2 → v3 » et « Écart de lexique ».

  Les autres lignes gardent le verdict du complément n° 4.
- **Rendu propre** : backend et frontend construits depuis `06feff968` dans mon worktree, servis
  sur un port à moi (ni :3000 ni le Redis DEV), avec un Redis privé sans persistance et les tâches
  planifiées désactivées. L'environnement DEV est lu sans copie. Le serveur DEV partagé et le
  checkout `/opt/automecanik/app` n'ont pas été touchés. Les deux serveurs ont été arrêtés après les
  mesures.
- **Preuves n° 5** :
  - `mesures/c5-*` : API, cartes, lexique, switch, contrastes, axe et tests ;
  - les scripts `cartes-du5.cjs`, `lexique-du5.cjs`, `elements-du5.cjs`, `badge-du5.cjs` et
    `captures-du5.cjs`, avec les scripts du n° 4 `page-du4.cjs`, `hero-du4.cjs`, `ariane-du4.cjs` et
    `bande-du4.cjs` ;
  - les captures `captures/c5-06fe-*.png`.

Rappel du complément n° 4, tête `34bdc1eb36e4120a4ec7769249b4c4ef5f9def95` :

- **Lignes remesurées** : Contraste, Cibles tactiles, Jetons, Mouvement réduit, Lisibilité, Diff,
  Autres gammes, Typecheck, et la nouvelle ligne « Cohérence des teintes ». Les autres lignes gardent
  le verdict du complément n° 3 : le diff ne les touche pas, et elles sortent du périmètre du n° 4.
- **Preuves** : `mesures/c4-*.json` et `mesures/c4-*.txt` ; les scripts `page-du4.cjs`,
  `captures-du4.cjs`, `bande-du4.cjs`, `hero-du4.cjs`, `ariane-du4.cjs` et `dis-du4.cjs` ; les
  captures `captures/c4-*.png`.
- **Captures** : le préfixe `c4-e31d` marque l'état avant, `c4-34bd` l'état après, et
  `c4-34bd-plaquette` la seconde gamme. L'en-tête fixe et la barre basse recouvrent parfois une
  zone : c'est un effet de la capture, pas de la page.

| Point | Verdict | Raison |
|---|---|---|
| Rôle et contrat | À CORRIGER | Rôle R1 bien déclaré, aucun écart nouveau. Restent 15 écarts antérieurs (§8.2) et 13 contradictions entre sources (§9) |
| H1 et H2 | À CORRIGER | Un seul H1. « Diagnostic gratuit » est un H2 hors section. La 1re question de la FAQ répète le H2. Un H3 est en double dans `#bien-choisir`. « quand » figure dans le H2 de `#emplacement` |
| Title, description, canonical, robots | À CORRIGER (Marwane) | Canonical et robots corrects. Le title est coupé par « … ». La description contient un prix, « en stock » et « livraison ». Inchangé par #2210 |
| Données structurées | À CORRIGER | Types hors `r1.ts:33` ; `FAQPage` 4 contre 5 questions visibles |
| Maillage interne (décision 82) | À CORRIGER | Lien en dur vers `/reference-auto` ; doublons (`/diagnostic-auto` 6 fois, filtre à air 5 fois, filtre à carburant 4 fois, guide d'achat 3 fois) |
| Images | À CORRIGER | Image du hero en priorité haute alors qu'elle est sous le premier écran sur mobile ; images éditoriales sans `width` ni `height` ; logo WIX FILTERS manquant ; photos de véhicule contraires à `r1-media-rules.constants.ts:12`. Tous les alt sont présents |
| LCP mobile | À MESURER | Labo : 1,8 s à 412 × 823 et 375 × 800, 2,7 s à 412 × 915. Le terrain p75 reste à mesurer après PREPROD |
| CLS | OK | 0 dans toutes les séries, y compris pendant un défilement immédiat |
| INP | À MESURER | Labo : 24 à 96 ms. Le terrain reste à mesurer |
| Contraste | OK sur R1 (1.4.3) ; réserve 1.4.1 | À `06feff968`, mesure au pixel (`elements-du5.cjs`, `badge-du5.cjs`, `ariane-du4.cjs`, `hero-du4.cjs`, `bande-du4.cjs`), à 390 / 1440 px. Fil d'Ariane #9CA3AF sur #101F3A : 6,47 / 6,38:1 (1,6 avant). Onglet « Type Mine » : 6,90:1 à 1440 px (4,35 avant) ; à 390 px, la variante mobile est à 12,0:1. Badge « 2 min » #C2410C sur #FFF7ED : 4,87:1. Bande des liens utiles : 4,51 à 4,55:1 aux deux largeurs, « Guide d'achat » 5,01:1 (3,9 à 4,3 avant à 1440 px). Textes R1 directs : de 4,51 à 4,88:1. axe identique à `34bdc1eb3`, nœud pour nœud : `color-contrast` 9 / 5, tous dans le pied de page et la barre du bas (revue 05). Deux artefacts connus : « Véhicule » à 1,12 (anticrénelage de la capture) et « Rechercher des pièces », désactivé (exempté). Réserve : `link-in-text-block` reste à 390 px sur le lien « Conseils : changer un filtre à huile étape par étape » de `#reference` (1.4.1, niveau A ; introduit à `8507eb5b8`, hors des quatre corrections demandées) |
| Cibles tactiles | OK (AA, 24 px) | À 390 px, 4 cibles sous 24 px, contre 10 à `e31d3babe`. Toutes sont dans une exception de 2.5.8 : le lien d'évitement, masqué hors focus (221 × 42 px au focus), et 3 liens dans une phrase. À 1440 px s'y ajoutent 2 liens dans une phrase et 5 éléments globaux : le téléphone du bandeau et 4 liens du pied de page (revue 05). Le fil d'Ariane et les liens utiles passent de 16 à 24 px de haut, et « Lire plus » aussi. Restent 16 cibles entre 24 et 44 px à 390 px : l'objectif de 44 px n'est pas atteint, mais il n'est pas exigé en AA |
| Ordre de tabulation | À MESURER | Il suit l'ordre visuel. Le focus se perd au champ « Marque » dans le navigateur sans affichage (identique avant et après) ; à vérifier au clavier réel |
| Libellés | OK | Aucun contrôle sans nom accessible ; champs du sélecteur libellés |
| Lisibilité à 390 px | À CORRIGER | Le badge « 2 min » tient sur une ligne aux deux largeurs (`c5-badge-*.json`, une ligne mesurée sur le nœud texte). Restent les textes de 10 à 12 px (réassurance, fil d'Ariane, cartes d'étapes, badge en 10 px) et `#reference` très long, inchangés |
| Parcours d'achat (sélecteur puis page véhicule) | OK, À MESURER | Le sélecteur est au premier écran et les cartes véhicule suivent. Le bouton du chat recouvre le bas du sélecteur. Le taux de passage de R1 à R2 reste à mesurer |
| Éléments de confiance | OK | Réassurance placée juste après le sélecteur. Le seuil de livraison dépend de #2143 |
| Jetons de design sans valeur en dur | OK pour le diff | Le diff `34bdc1eb3` → `06feff968` n'emploie que des jetons : `neutral-300` (#9CA3AF), `neutral-500` (#4B5563), `cta-50`, `cta-200` et `cta-700`. Aucune couleur créée, aucune valeur en dur. La couleur du badge est portée par un `span` interne, ce qui contourne `Badge` sans le modifier. Restent préexistants : `hover:text-emerald-800` (`pieces.$slug.tsx`), `shadow-[0_24px_80px_rgba(0,0,0,0.22)]` (`GammeHero.tsx`) et `text-[12px]` (`GammeQuickNav.tsx`) |
| Mouvement réduit | OK | Avec le réglage : 0 boucle et 0 animation à 390 et 1440 px, contre 3 boucles et 14 animations à `e31d3babe`. La navigation rapide défile sans animation (`GammeQuickNav.tsx:36-44`) : elle est à la cible dès 60 ms. Ce qui bouge encore vient du global, pas de R1. Les 31 déplacements au survol (menu principal, `#bien-choisir`, `#aller-plus-loin`) restent sans garde, mais sont instantanés grâce à la règle de `styles/animations.css:175-189` (0,01 ms). `scroll-behavior: smooth` reste posé sur `html` par `hooks/useScrollBehavior.ts`. Sans le réglage, les 4 boucles tournent, comme prévu |
| Cohérence avec #1943, #1944, #2143 et DG | À CORRIGER | Doublon avec #1943, conflit avec #1944, dépendance du bandeau à #2143 (§11) |
| Couverture par les contrôles | NON VÉRIFIÉ | Aucun contrôle de PR ne couvre l'ordre ni le rendu R1 (§10) |
| Diff `34bdc1eb3` → `06feff968` | OK | 13 fichiers de code (358 + / 143 −). Frontend : 4 fichiers, des `className` (`GammeHero.tsx`, `GammeDiagnosticCTA.tsx`, `pieces.$slug.tsx`) et l'affichage de la description R1 (`MotorisationsSection.tsx:250-263`). Backend : le builder (`gamme-response-builder.service.ts`), la clé de cache (`gamme-rpc.service.ts`), un commentaire du contrôleur et 6 fichiers de test. Aucun title, H1, meta, canonical, ancre, `id` ni donnée structurée : le JSON-LD `ItemList` ne lit que marque, modèle, type et lien (`pieces.$slug.tsx:341-346`). Réponse de l'API comparée à celle de `main` (:3000), pour les deux gammes : seuls `motorisations.items[].description` et `.content` changent, zéro autre ligne (`c5-api-diff-*.txt`). `content` n'est lu par aucun composant. Hors R1, `MotorisationsSection` garde son comportement |
| Effet sur les autres gammes | OK (apparence) | `/pieces/plaquette-de-frein-402.html` à `06feff968` : axe identique à `34bdc1eb3` (9 / 5, tous globaux, 0 sur R1), cibles identiques, textes directs à 4,51:1 au minimum, badge à 4,87:1 sur une ligne, « Type Mine » à 6,9:1 et fil d'Ariane à 6,38:1 (`c5-gamme2-*`). Les phrases des cartes, elles, s'appliquent à toutes les gammes (ligne « Répétition entre pages ») |
| Typecheck et tests à `06feff968` | OK | Frontend : `react-router typegen && tsc`, sortie 0 (`c5-typecheck-front.txt`). Backend : jest sur `src/modules/gamme-rest` et les deux tests unitaires modifiés, 7 fichiers et 67 tests passés, dont le nouveau `gamme-response-builder-r1-motorisation-description.test.ts` (`c5-jest-gamme-rest.txt`). Frontend : vitest, 9 fichiers et 100 tests passés (`r1-*`, `pieces-slug-*`, `catalog-gammes`, `gamme-autolink` et `blog-model-motorisation-links`, `c5-vitest-r1.txt`). Ce n'est pas le même jeu de fichiers qu'au n° 4 : les deux totaux ne se comparent pas |
| Cohérence des teintes (captures à 390 et 1440 px) | OK sur le diff | Le badge « 2 min » est désormais orange, à côté du badge vert « Gratuit » (`captures/c5-06fe-*-haut-*.png`). Le fil d'Ariane gris clair et l'onglet gris foncé restent dans la gamme `neutral`. Restent préexistants : les trois liens utiles de couleurs différentes, et les liens SEO bleus de `#aller-plus-loin` |
| Phrases des cartes véhicule (servies par le builder) | OK | Rendu propre de `06feff968`, sans proxy. Filtre à huile : 19 cartes, 19 phrases distinctes ; plaquette de frein : 17 cartes, 17 distinctes. Les phrases sont identiques dans le DOM, dans l'API et dans le HTML rendu côté serveur ; les clés `gamme:resp:v3:*` sont dans mon Redis privé (`c5-cartes-*.json`, `c5-api-*.json`). Gabarit : « {gamme} compatible {modèle} {moteur} {ch} ch, pour {bénéfice}. » Le builder écarte les fragments mal formés : 2 sur le filtre à huile et 2 sur la plaquette |
| Mots interdits R1 dans les phrases | OK | 0 occurrence sur 36 phrases, contre six listes (`c5-lexique.json`) : le canon `getForbiddenOverlap(R1)`, `FORBIDDEN_KEYWORDS_R1` du backend, `r1-router-validator.md` (interdits absolus et lexique dominant), la liste du mandat (prix, achat, achetez, stock, livraison, promo, pas cher, €) et les verbes de montage. Seule la garde du front relève 2 fois « durée de vie » (plaquette) : voir « Écart de lexique » |
| Langue des phrases | À CORRIGER (06) | Accords corrects. Défauts : « pour maintenir en bon état » sans complément (4 cartes) ; « prolonger la durée de vie » sans dire de quoi (2 cartes). La marque manque, d'où des ambiguïtés : « compatible 500 1.2 69 ch », « compatible 3 II 1.6 MZR CD », « compatible 206 1.4 HDI ». La phrase redit le modèle, le moteur et les ch déjà présents dans le titre et les pastilles de la carte. Variété faible : 7 bénéfices pour 19 cartes (« protéger le moteur » 6 fois) et 8 pour 17. Bénéfices hors sujet pour une plaquette : « optimiser les performances », « maintenir en bon état ». « compatible » sans « avec » est admis en catalogue |
| Répétition entre pages | À CORRIGER (06) | Base en lecture seule, `__seo_item_switch` alias 2 (`c5-switch-alias2-top.tsv`). Cinq bénéfices génériques sont présents sur 95 à 96 des 101 gammes qui ont un alias 2 : « prolonger la durée de vie », « améliorer la fiabilité », « optimiser les performances » (96), « maintenir en bon état », « préserver le véhicule » (95). En moyenne, 47 % des fragments d'une gamme sont génériques. Les mêmes fins de phrase reviendront donc sur presque toutes les pages R1. 96 gammes sur 101 ont aussi au moins un fragment mal formé (double infinitif ou préposition finale), écarté par le builder |
| Cache des réponses v2 → v3 | OK, À SURVEILLER | La clé `gamme:resp:v3:{segment}:{pg}` (`gamme-rpc.service.ts:99-100`) est commune à toutes les gammes. Passer à v3 invalide donc les réponses construites de toutes les pages gamme R1 (232 gammes affichées, `pg_display = 1`, niveaux 1 et 2), et pas d'autres rôles : seuls la route R1 (`gamme-api.service.ts:113`) et `admin.r1-qa.tsx` appellent `page-data-rpc-v2`. Le cache du RPC (`gamme:rpc:v2:*`, 1 h, copie de secours 24 h) n'est pas touché. Au premier passage, seul le builder est refait (pas le RPC), puis la réponse est remise en cache pour 1 h (`RESPONSE_CACHE_TTL = 3600`, contrôleur ligne 50). Le préchauffage au démarrage (`gamme-cache-warming.service.ts`) ne remplit que le cache du RPC. Le pic est donc limité au builder, pendant la première heure. Les clés v2 restent orphelines jusqu'à leur expiration (1 h). La route admin d'invalidation vise bien v3. Sans v3, les réponses v2 en cache auraient servi l'ancienne phrase jusqu'à 1 h : le changement est justifié, même s'il n'était pas demandé |
| Écart de lexique « prolonger la durée de vie » | À TRANCHER (canon) | Le canon écrit n'interdit pas « durée de vie » en R1 : ni `role-matrix.md:87-100`, ni `getForbiddenOverlap(R1)`, ni `r1-router-validator.md`, ni `FORBIDDEN_KEYWORDS_R1`. Le backend suit donc la lettre du canon. La garde du front (`frontend/app/utils/r1-copy-gate.ts`, motif `durée de vie` rangé sous « Entretien ») est plus stricte, sans source canonique, et ne sert qu'à `CatalogueSection.tsx`. Indice en sa faveur : `keyword-plan.constants.ts:490` range « {gamme} durée de vie » dans les intentions informationnelles (R3/R4). Deux règles concurrentes : à réconcilier dans le canon par Marwane. Le fragment est de toute façon trop vague pour être gardé |
| Écran d'erreur observé une fois | NON VÉRIFIÉ | 1 occurrence sur 6 passages, non reproduite, cause inconnue (§6) |

**À part, pour la revue du design system (05)** (partagé par tout le site, hors verdict R1) :

- Pied de page (`components/home/Footer.tsx`) :
  - 4 contrastes faibles à 390 px (de 1,88 à 3,73:1) et 5 à 1440 px (#576174 sur #0F1E38, 2,66:1) ;
  - 4 liens sous 24 px de haut à 1440 px.
- Barre mobile du bas (`components/layout/BottomNav.tsx`) : 5 contrastes faibles (#90A1B9 à 2,63:1,
  et l'orange #F97316 à 2,80:1).
- Bandeau de l'en-tête (`components/Navbar.tsx`) : hors repère (règle `region`), téléphone de 16 px
  de haut, `text-white/40`.
- Règle globale `nav a` (`global.css:217`) : elle impose `text-secondary-600` à tout lien placé dans
  un `nav`, y compris sur fond sombre. C'est la cause du fil d'Ariane à 1,6:1. À `06feff968`, R1
  la contourne localement (`text-neutral-300`, `GammeHero.tsx:59`) ; la règle elle-même reste à
  revoir pour les autres pages.
- Composant `Badge` (`components/ui/badge.tsx`) : il concatène les classes sans les fusionner. Une
  couleur passée en `className` peut donc perdre face à celle de la variante. À `06feff968`, R1 le
  contourne par un `span` interne ; les autres usages de `Badge` restent exposés. Le badge « 2 min »
  reste aussi en police de 10 px, une taille à fixer dans l'échelle typographique.
- `VehicleSelector` en mode `mobile-premium` : les étapes « Année », « Modèle » et « Motorisation »
  sont à 2,63:1 sur blanc. Ce sont des étapes inactives, sans attribut `disabled`.
- Hook `useScrollBehavior` (défilement `smooth` sur `html`), règle globale de mouvement réduit
  (`styles/animations.css:175-189`) et déplacements au survol sans garde dans le menu principal.

**À part, pour les fragments en base (06)** (complément n° 5, rien n'a été écrit) :

- Table `__seo_item_switch`, alias 2 (bénéfices) : cinq fragments génériques (« prolonger la durée
  de vie », « améliorer la fiabilité », « optimiser les performances », « maintenir en bon état »,
  « préserver le véhicule ») sont présents sur 95 à 96 des 101 gammes qui ont un alias 2, soit
  47 % des fragments d'une gamme en moyenne. Ils créent une répétition entre pages R1.
- Même table : 96 gammes sur 101 ont au moins un fragment mal formé (double infinitif ou
  préposition finale). Le builder les écarte, mais ils restent en base.
- Fragments sans complément ou vagues : « maintenir en bon état », « prolonger la durée de vie ».
  Fragments hors sujet selon la pièce, par exemple « optimiser les performances » pour une
  plaquette.
- Gabarit de la phrase : il redit le véhicule déjà affiché sur la carte et omet la marque. Une
  phrase qui apporte une information propre à la motorisation serait plus utile.
- Écart de lexique « durée de vie » : la garde du front (`r1-copy-gate.ts`) l'interdit, le canon
  écrit non. C'est à trancher dans le canon (Marwane), avant d'aligner l'une des deux règles.

## 13. Ce qui n'a pas pu être jugé, et pourquoi

- **Images des marques et des sections** : elles sont vides dans les captures, ce qui est probablement
  dû au chargement différé. Leur rendu n'est pas jugé.
- **Valeurs terrain (RUM)** : #2210 n'est déployée ni en PREPROD ni en PROD. Les chiffres ci-dessus sont
  des mesures de labo. La décision 81 fait foi sur le terrain.
- **Conversion réelle** : aucune donnée avant/après. Mesure à faire après déploiement : taux d'usage du
  sélecteur et clics de R1 vers R2 sur les événements existants, sans en avoir vérifié la présence ici.
- **Structure des concurrents (point 6.2 de DS)** : non faite par DS, ni par moi.
- **Lecteurs d'écran et appareils réels** (TalkBack, VoiceOver) : non testés, faute d'appareil.
- **Desktop** : jugé sur captures seulement, sans mesure de performance (le mandat vise le mobile).
- **Autres gammes** : la décision 57 étend l'apparence à toutes les gammes. La hauteur de `#reference`
  et les textes varient selon la gamme. J'en ai mesuré deux : le filtre à huile entièrement, et la
  plaquette de frein pour l'apparence seulement (complément n° 3).
- **Exécution réelle du validateur de rôle** : sans accès aux journaux du backend, je n'ai pas pu
  vérifier si l'intercepteur se déclenche sur une page R1 servie (§8.2, n° 33).
- **Rattachement des blocs au contrat** : la section micro-SEO et les sections S0 à S9 ne sont pas
  marquées dans la page servie (C10). Leur présence et leur longueur ne sont donc pas vérifiables.
- **Seuil d'indexabilité par familles** : ses entrées ne sont pas lisibles depuis la page.
- **Hors périmètre** : la variante vidéo, la page véhicule (Clio III) et toute page R2.

## 14. Complément n° 6 : contraste du bouton « Lancer le diagnostic »

**Verdict : bouton diagnostic : correction d'abord.**

- **Tête mesurée** : `06feff9686afa610d5b0363397e2cd2b7ec3fe1d` (#2210, PR brouillon ouverte),
  relevée avant les mesures et revérifiée avant la publication. Rien n'a été modifié dans #2210.
- **Composant** : `frontend/app/components/gamme/GammeDiagnosticCTA.tsx`. Le bouton est aux lignes
  51 à 56 et la pastille à la ligne 12.
- **Rendu** : backend et frontend de `06feff968` sur un port à moi, avec un Redis privé. Le service
  DEV n'a pas servi. Navigateur Chromium (Playwright), échelle 1, mouvement non réduit.
- **Méthode** :
  - le texte est rendu transparent, transition coupée, puis le fond est capturé dans la boîte du
    texte (1 px de marge) ;
  - le rapport retenu est celui du blanc contre le pixel de fond **le plus clair**, le pire cas ;
  - le reflet `animate-shimmer` (cycle de 3 s) est mis en pause à 24 positions ;
  - le survol est déclenché à 1440 px ;
  - les rapports sont tronqués au centième, jamais arrondis vers le haut.
- **Seuils** : texte de 15 px (390) et 14 px (1440) gras, donc pas « grand » : 4,5:1 (1.4.3).
  Éléments graphiques : 3:1 (1.4.11). Cible : 24 px en AA, 44 px visés (2.5.8).
- Script `scripts/diag-du6.cjs`. Mesures `mesures/c6-diag-*.json` et `mesures/c6-sim-*.json`.
  Captures `captures/c6-*.png`.

### 14.1 Couleurs réellement servies

| Classe | Valeur calculée dans le CSS construit | Hex |
|---|---|---|
| `orange-500` | `oklch(70.5% .213 47.604)` | `#ff6900` |
| `orange-600` | `oklch(64.6% .222 41.116)` | `#f54a00` |

Ce sont les couleurs **par défaut de Tailwind 4**, pas les jetons du site. `tokens.json` n'a pas de
palette `orange` ; les jetons orange du site sont `cta`, branchés par `tailwind.config.cjs:26`.
Le constat du chat de pilotage partait de `#f97316` et `#ea580c`. Ces valeurs sont celles de Tailwind 3,
reprises par les jetons `cta-500` et `cta-600` ; elles ne sont pas servies ici. Ses estimations
(2,8 et 3,6:1) restent proches des mesures.

### 14.2 Texte blanc du bouton (seuil 4,5:1)

| Mesure | 390 px | 1440 px | 1440 px, survol |
|---|---|---|---|
| Bout gauche du dégradé, sans reflet | 2,90 | 2,90 | 2,88 |
| Bout droit du dégradé, sans reflet | 3,54 | 3,58 | 3,58 |
| Fond sous le texte, sans reflet (pixel le plus clair) | 3,03 | 3,11 | 3,11 |
| Fond sous le texte, au passage du reflet (pire des 24 positions) | **2,75** (t = 0,46) | 2,82 (t = 0,50) | 2,82 |
| Icône loupe du bouton (pire position) | 2,70 | 2,83 | 2,83 |

**Le plus mauvais rapport est 2,75:1**, à 390 px, quand le reflet passe sur le texte. Aucune position
n'atteint 4,5:1 ; le meilleur fond sous le texte reste sous 3,5:1.

Le survol ne change aucune couleur. Il ajoute une ombre et remonte le bouton de 2 px
(`translate: 0 -2px`). L'icône loupe accompagne le libellé : elle est décorative et 1.4.11 ne
s'impose pas à elle. Sa valeur est donnée pour information.

### 14.3 Titre, texte et pastille du bloc

| Élément | Couleur | Fond mesuré | Rapport | Seuil | Résultat |
|---|---|---|---|---|---|
| Titre « Diagnostic gratuit » (17 et 20 px, 800) | `#0f172b` (`slate-900`) | `#ffffff` | 17,83 | 4,5 | conforme |
| Texte « Notre diagnostic identifie… » (13 px, 400) | `#62748e` (`slate-500`) | `#ffffff` | 4,76 | 4,5 | conforme |
| Icône blanche sur la pastille (36 et 40 px) | `#ffffff` | dégradé `#ff6900` → `#f54a00`, pixel le plus clair sous l'icône | 3,01 (390), 3,03 (1440) | 3 | conforme de justesse |

La pastille passe de 0,01 à 0,03 point, et son icône redit le titre voisin. Si DS la passe aux jetons,
`cta-500` ne convient pas : le blanc sur `#F97316` donne 2,80:1, mesuré en simulation. `cta-600` vers
`cta-700` convient : 3,56 à 5,17:1, calculé et non mesuré.

### 14.4 Zone cliquable

| Largeur | Lien `<a>` | Bouton | Seuil |
|---|---|---|---|
| 390 px | 332 × 56 px | 332 × 56 px | 24 px (AA), 44 px visés |
| 1440 px | 1182 × 54 px | 1182 × 54 px | idem |

C'est conforme et au-dessus des 44 px visés.

En aparté, hors verdict : le `<button>` est placé dans le `<a>` (`GammeDiagnosticCTA.tsx:50-53`), alors
que HTML interdit un contenu interactif dans un lien. À traiter par DS en même temps, s'il le juge utile.

### 14.5 Correction proposée à DS (non appliquée)

**La plus simple**, une seule ligne de `GammeDiagnosticCTA.tsx:53` : remplacer
`from-orange-500 to-orange-600` par `from-cta-700 to-cta-800`.
- Texte blanc, reflet et forme sont gardés.
- Couleurs tirées des jetons `cta` (`#C2410C` → `#9A3412`), seule source des jetons (décision 45).
- Aucun composant partagé n'est touché.

Mesures en simulation, par un style posé dans mon seul navigateur :

| Variante | Pire au passage du reflet | Sans reflet (fond sous texte) | Bouts du dégradé | Icône du bouton |
|---|---|---|---|---|
| **A. `from-cta-700 to-cta-800`, texte blanc** | **4,73** (390), 4,90 (1440) | 5,73 et 6,00 | 5,2 à 7,25 | 4,59 et 4,95 |
| B. `bg-cta text-black hover:bg-cta-hover`, comme le bouton de l'accueil | 7,40 | 7,49 | 7,49 | 7,40 |
| C. `cta-700` plein, texte blanc | 4,27 : **non conforme** à cause du reflet | 5,17 | 5,17 | 4,30 |

- **A** passe partout, avec une marge réduite (0,23) sous le reflet.
  - `cta-700` est déjà servi dans ce composant (badge « 2 min », complément n° 5).
  - `cta-800` vient des jetons, mais aucune classe ne l'utilise encore : DS doit vérifier sa valeur
    servie après construction.
- **B** a la plus grande marge et reprend le bouton « Lancer le diagnostic » de l'accueil. Mais il
  change l'apparence, avec un texte noir : c'est une décision de design pour Marwane.
- **C** n'est valable que si le reflet est retiré.

Captures `captures/c6-diag-390-bouton.png` (actuel), `captures/c6-sim-A-cta700-800-390-bouton.png`,
`captures/c6-sim-B-cta-noir-390-bouton.png` et `captures/c6-sim-C-cta700-plein-390-bouton.png`.

### 14.6 Portée : où ce bouton existe

- **`GammeDiagnosticCTA`** n'est importé qu'à un endroit : `routes/pieces.$slug.tsx:1070`, rendu
  sans condition (export `components/gamme/index.ts:3`). Il sert donc **toutes les pages gamme R1**,
  et aucune autre page. La correction A ou B est locale à R1 et ne touche pas le design commun du site.
- **Défaut antérieur à #2210.** Sur ce composant, #2210 ajoute seulement `motion-reduce` et les
  couleurs du badge ; les classes du bouton viennent de `main`. Le même contraste est donc dans le
  code de `main` pour toutes les pages R1. L'état servi en PROD n'est pas vérifié ici.
- **Même libellé, autres composants** (non touchés par la correction) :
  - `components/home/DiagnosticBanner.tsx:48-51` (accueil) : `bg-cta text-black`, soit la variante
    B, à 7,49:1 sur `cta` d'après la simulation ;
  - `components/diagnostic-wizard/DiagnosticWizard.tsx:879-885` (page `/diagnostic-auto`) :
    `bg-blue-600 hover:bg-blue-700`, non mesuré.
- **Même dégradé `from-orange-500 to-orange-600`**, avec d'autres contenus, dans quatre autres
  fichiers : `components/catalog/PurchaseGuide.tsx`, `components/blog/BlogSearchBar.tsx`,
  `components/navbar/CartSidebarSimple.tsx` (panier, zone STOP) et
  `routes/admin.optimization-summary.tsx`. Non mesurés, hors périmètre. Le même écart de jeton peut
  y exister.

## 15. Complément n° 7 : revérification du bouton « Lancer le diagnostic » (variante B)

**Verdict : bouton diagnostic : correction d'abord.**

Une ligne suffit : ajouter `no-visited` au lien. Sinon, une fois `/diagnostic-auto` visité, le texte
et l'icône passent au violet sur l'orange, à 2,00:1 (§15.4). Toutes les autres mesures sont conformes.

- **Tête mesurée** : `06dcea7bc21ede689cb8fd932b0c6973489fac11` (#2210, PR brouillon ouverte,
  mise à jour le 20 nov. 2026 à 00:18 UTC). Relevée par `gh` et `git ls-remote` avant les mesures,
  puis revérifiée avant la publication. Rien n'a été modifié dans #2210.
- **Rendu** : frontend de `06dcea7bc` reconstruit, et backend de la branche (inchangé dans le diff),
  sur un port à moi avec un Redis privé. Le service DEV n'a pas servi.
  - Navigateur : Chromium de Playwright, échelle 1.
  - Pour l'état « visité » seulement : Chrome 153 complet, avec un profil temporaire (§15.4).
- **Méthode** : celle du §14, que j'ai reprise sans utiliser les chiffres de DS.
  - Texte rendu transparent, transition coupée ; fond capturé dans la boîte du texte.
  - Reflet mis en pause à 24 positions du cycle de 3 s.
  - Rapports tronqués au centième.
  - Le texte est noir : le pire cas est donc le pixel de fond **le plus sombre**. Le script prend
    le minimum entre le pixel le plus clair et le plus sombre.
- **Seuils** :
  - texte de 15 px (390) et 14 px (1440) en gras 700 : 4,5:1 (1.4.3) ;
  - anneau de focus et éléments graphiques : 3:1 (1.4.11) ;
  - focus visible (2.4.7) ;
  - cible : 24 px en AA, 44 px visés (2.5.8).
- **Fichiers** :
  - scripts : `scripts/diag-du7.cjs`, `scripts/cmp-accueil-du7.cjs` et `scripts/visite2-du7.cjs` ;
  - mesures : `mesures/c7-*` ;
  - captures : `captures/c7-*`.

### 15.1 Contraste du texte et de l'icône (seuil 4,5:1)

| Mesure | 390 px | 1440 px |
|---|---|---|
| Bouts gauche et droit du bouton, sans reflet | 7,49 / 7,49 | 7,49 / 7,49 |
| Fond sous le texte, sans reflet | 7,49 | 7,49 |
| Fond sous le texte, pire des 24 positions du reflet | **7,40** (t = 0,29) | 7,40 (t = 0,33) |
| Icône loupe, pire position | 7,40 | 7,45 |
| Survol (fond `#ea580c`), sans reflet | 5,89 | 5,89 |
| Survol, pire position du reflet (texte / icône) | **5,83** / 5,83 | 5,83 / 5,86 |
| Focus clavier, pire position du reflet | 7,40 | 7,40 |

Couleurs calculées :
- texte `rgb(0, 0, 0)`, sur une ligne aux deux largeurs ;
- fond `#f97316` au repos, `#ea580c` au survol ;
- aucune image de fond, ni dégradé sur le lien lui-même.

Le pire rapport de toutes les positions et de tous les états est 5,83:1, au survol. Il dépasse le seuil
de 4,5:1 de 1,33 point. Au survol, le bouton monte aussi de 2 px (`translate: 0 -2px`).

Mes valeurs rejoignent celles annoncées par DS (pire 7,40, survol 5,83), mais elles ont été mesurées à
part. Captures : `captures/c7-diag-{390,1440}{,-hover,-focus}-bouton.png`.

### 15.2 Focus clavier (2.4.7 et 1.4.11)

Le focus est donné par la touche Tab, depuis l'élément focalisable qui précède. `:focus-visible` est
vrai aux deux largeurs.

| | 390 px | 1440 px |
|---|---|---|
| Contour calculé | `2px solid #0f1e38`, décalage 2 px | idem |
| Pixels changés autour du lien | 2 601 | 8 408 |
| Étendue de l'anneau | 4 px de chaque côté | 4 px de chaque côté |
| Couleur dominante de l'anneau | `#0f1e38` | `#0f1e38` |
| Anneau / fond voisin (carte `#ffffff`) | **16,62** | 16,62 |
| Anneau / bouton (`#f97316`) | 5,93 | 5,93 |

L'anneau ne vient pas d'une classe du composant. Il vient de la règle commune au site
`a:focus-visible` (`frontend/app/global.css:707-710`, contour et anneau `primary`), qui s'applique
désormais parce que le bouton est un lien. Avant, le `<button>` dans le lien n'était pas atteint par
cette règle.

L'anneau est visible et dépasse 3:1, aussi bien contre le fond voisin que contre le bouton. Capture :
`captures/c7-diag-{390,1440}-focus-anneau.png`.

### 15.3 Un seul élément interactif, nom accessible, cible

- **Élément** : `<a href="/diagnostic-auto">`, sans attribut `role`, focalisable (`tabIndex` 0).
- **Imbrications** :
  - zéro élément interactif dans le lien ;
  - aucun ancêtre interactif ;
  - dans la carte, le lien est le seul élément interactif.
  - Le HTML servi ne contient plus de `<button>` dans ce lien.
  - Le `<div>` du reflet dans le lien est autorisé : un lien peut contenir du contenu de flux non
    interactif.
- **Arbre d'accessibilité** : `link "Lancer le diagnostic"` → `/diagnostic-auto`.
  - `getByRole("link", { name: "Lancer le diagnostic", exact: true })` trouve exactement un élément.
  - La page compte 6 liens vers `/diagnostic-auto`, dont un seul dans cette carte.
- **Remarque mineure, hors verdict** : l'icône `SearchCheck` n'a pas `aria-hidden`. Elle apparaît
  comme une image sans nom dans l'arbre. Le nom du lien reste juste et axe ne relève rien.
- **Cible** : 332 × 56 px à 390 px et 1182 × 54 px à 1440 px. C'est au-dessus des 44 px visés.

### 15.4 Lien déjà visité : texte violet sur orange (défaut)

`frontend/app/global.css:712-715`, règle commune au site :

```css
/* Liens visités (SEO) */
a:visited:not(.no-visited) {
  @apply text-purple-600;
}
```

**Pourquoi elle l'emporte sur `text-black`.**
- Dans le CSS construit, `a:visited:not(.no-visited)` et `.text-black` sont tous deux dans
  `@layer utilities`.
- La règle des liens visités est plus spécifique : (0,2,1) contre (0,1,0).
- Tant que le libellé était dans un `<button>` qui portait sa propre couleur, la règle restait sans
  effet. Depuis que le lien porte lui-même `text-black`, elle s'applique.

**Mesure**, dans Chrome 153 avec un profil temporaire qui garde l'historique, sur la tête et le
port à moi :
1. page R1 chargée ;
2. clic sur le bouton (navigation vers `/diagnostic-auto`) ;
3. page R1 rechargée ;
4. pixels du libellé relevés.

| | 390 px | 1440 px |
|---|---|---|
| Avant toute visite (pixel le plus foncé du texte / fond) | 7,34 | 6,89 |
| **Après la visite** (pixel du texte : `#9d1df9` / `#a128f9`) | **2,00** | **1,98** |
| Lien témoin ajouté sans couleur, après la visite | `#9810fa` (violet) | `#9810fa` |
| Calcul : `purple-600` `#9810fa` sur `#f97316` / sur `#ea580c` (survol) | 1,97 / 1,55 | idem |

- Les valeurs de cette colonne sont lues sur les pixels du texte, anticrénelage compris. Elles ne se
  comparent pas aux 7,49:1 du §15.1, mesurés sur le fond seul.
- Le texte **et** l'icône passent au violet. Captures :
  `captures/c7-visite-390-apres-visite.png` et `captures/c7-visite-1440-apres-visite.png`.
- **Qui est touché** : tout visiteur dont le navigateur marque `/diagnostic-auto` comme visité, par
  exemple après avoir suivi ce lien.
  - Chrome n'enregistre ce statut que pour un lien suivi depuis le même site.
  - Firefox et Safari ne sont pas mesurés.
- **Pourquoi les mesures automatiques ne le voient pas** :
  - Le Chromium réduit de Playwright et ses contextes éphémères n'appliquent pas `:visited`. Mon
    premier essai, comme les captures de DS, ne le montre donc pas (`scripts/visite2-du7.cjs`,
    commentaire d'en-tête).
  - axe ne teste pas cet état.
  - Le test ajouté vérifie les classes, mais pas l'absence de `no-visited`.
- **Introduit par `06dcea7bc`** : à `06feff968`, la couleur du libellé était portée par le `<button>`.

**Correction proposée à DS (non appliquée)** : une ligne dans `GammeDiagnosticCTA.tsx:55`. Ajouter
`no-visited` à la `className` du `<Link>`.
- C'est la convention du site : 30 emplois dans `frontend/app`, dont `GammeHero.tsx:59`, `Footer`,
  `Navbar` et `BottomNav`.
- Aucun fichier partagé n'est touché.
- Le test pourrait vérifier la présence de cette classe.
- **Simulation**, la classe étant posée dans mon seul navigateur, après la même visite : le texte
  reste noir, 7,34 (390) et 6,89:1 (1440), le même rapport qu'avant visite. Le lien témoin, lui,
  reste violet, ce qui prouve que l'état « visité » était bien actif. Fichiers :
  `mesures/c7-sim-novisited-*.json` et `captures/c7-sim-novisited-*`.

La règle `a:visited` elle-même est un élément commun au site. Elle n'est pas en cause ici, et la
modifier relève de Marwane.

### 15.5 Jetons servis et comparaison avec l'accueil

**Jetons dans le CSS construit** (`build/client/assets/global-*.css`, tête `06dcea7bc`) :

| Classe | Valeur servie |
|---|---|
| `bg-cta` | `#f97316` |
| `hover:bg-cta-hover` | `#ea580c` |
| `text-black` | `var(--color-black)`, résolu en `#000` au rendu |
| `shadow-cta/25` | `--tw-shadow-color: #f9731640` |

Ce sont bien les jetons `cta` du site, et non les couleurs `orange-*` par défaut de Tailwind relevées
au §14.1.

**Comparaison avec le bouton de l'accueil** (`DiagnosticBanner`), mesurée sur la même construction
(`mesures/c7-accueil-vs-r1.json`) :

| Propriété calculée | Accueil | R1 |
|---|---|---|
| Élément | `<button>` | `<a>` |
| Fond / survol | `#f97316` / `#ea580c` | `#f97316` / `#ea580c` |
| Texte / survol | noir / noir | noir / noir |
| Taille, graisse | 15 px, 600 | 15 px (390) et 14 px (1440), 700 |
| Hauteur, arrondi | 48 px, 16 px | 56 et 54 px, 12 px |
| Reflet animé | non | oui |

**Couleurs identiques, bouton non identique.** La forme, la graisse et le reflet diffèrent. Ces écarts
existaient déjà et ne sont pas demandés par le complément. L'accueil, qui est un `<button>`, n'est pas
touché par la règle `:visited` du §15.4.

### 15.6 Mouvement réduit

Mesures avec `reducedMotion: "reduce"`, à 390 et 1440 px :
- **reflet** : aucune animation (`getAnimations()` vide, `animation: none`) ;
- **icônes** : celle du bouton n'a pas d'animation, et celle de la pastille n'a plus la sienne ;
- **carte entière** : trois captures, à 0, 900 et 1 600 ms, ne diffèrent d'**aucun** octet.

Le reflet et les icônes restent donc immobiles. Au survol, le soulèvement de 2 px reste, avec une
transition de 0,2 s : c'est un mouvement déclenché par l'utilisateur, non exigé en AA (2.3.3 est AAA).
Sans reflet animé, le texte est à 7,79 (390) et 8,11:1 (1440) (rectifié au §16.2 : à l'écran, 7,34 et 6,89:1). Capture :
`captures/c7-diag-{390,1440}-reduce-carte.png`.

### 15.7 Régressions

| Contrôle | Résultat | Preuve |
|---|---|---|
| Diff `06feff968` → `06dcea7bc` | OK | Un commit, 15 fichiers. Le code se limite aux 2 fichiers annoncés : `GammeDiagnosticCTA.tsx` (17 lignes, le seul bloc du bouton) et `tests/unit/gamme-diagnostic-cta-contrast.test.tsx`. Les 13 autres fichiers sont les preuves de DS dans le dossier de la maquette (`README.md`, `complement-6/`, `outils/`). Lien et libellé inchangés : `to="/diagnostic-auto"`, « Lancer le diagnostic ». Aucun titre, H1, meta, canonical, `id`, donnée structurée ni composant partagé n'est touché |
| Tête de page servie | OK | Title, H1 « Filtre à huile compatible avec votre véhicule », canonical, et 1 bloc JSON-LD. Le diff n'a aucune ligne qui touche à la tête de page |
| axe 390 / 1440 px | OK | Identique à `06feff968`, nœud pour nœud : 390 px `color-contrast` 9, `link-in-text-block` 1, `region` 2 ; 1440 px `color-contrast` 5, `region` 4. Aucun nœud dans la carte (`mesures/c7-page-{390,1440}.json` contre `c5-page-*`) |
| Typecheck frontend | OK | `npm run typecheck`, code de sortie 0 (`mesures/c7-typecheck-front.txt`) |
| Test ajouté | OK, mais incomplet | vitest : 2 tests sur 2 passent (`mesures/c7-vitest.txt`). Il ne couvre pas l'état visité (§15.4) |
| CI du commit `06dcea7bc` | 34 réussis, 11 ignorés, 5 en échec | Les 5 échecs sont **les mêmes qu'à `06feff968`** : Circuit de fusion (brouillon, aucune approbation), Deterministic gates (`depcruise.violations` 170 pour une base de 163, déjà 170 avant), DoD self-evaluation ×2 et Registry freshness (projections du registre en retard sur leurs sources). ESLint, Frontend Tests, Backend Tests et Core Build réussissent ; Build et E2E sont ignorés. Rien de nouveau n'est introduit |

## 16. Complément n° 8 : bouton « Lancer le diagnostic » après visite (classe `no-visited`)

**Verdict : bouton diagnostic conforme.**

Après une vraie visite de `/diagnostic-auto`, le libellé reste noir, au repos comme au survol, aux
deux largeurs. Le lien témoin, lui, passe au violet : l'état « visité » est donc bien actif. Le pire
rapport mesuré est 5,37:1, au survol en mouvement réduit, pour un seuil de 4,5:1.

- **Tête mesurée** : `f1dbcf2852b0d19575081feb659bfb6b24663adf` (#2210, PR brouillon ouverte, mise à
  jour le 20 nov. 2026 à 01:18 UTC). Relevée par `git ls-remote` et `gh` avant les mesures, puis
  revérifiée avant la publication. Rien n'a été modifié dans #2210.
- **Rendu** : frontend de `f1dbcf285` reconstruit, et backend de la branche (absent du diff), sur un
  port à moi avec un Redis privé. Le HTML servi contient bien `no-visited` sur ce lien. Le service DEV
  n'a pas servi.
- **Navigateur** : Chrome 153 complet, avec un profil temporaire qui garde l'historique, à l'échelle 1.
  Le profil est supprimé après chaque passage.
- **Déroulé**, pour chaque largeur (390 × 844 et 1440 × 900) et chaque réglage de mouvement :
  1. état avant visite, au repos puis au survol ;
  2. clic réel sur le bouton depuis R1, arrivée sur `/diagnostic-auto` ;
  3. R1 rechargée, état après visite, au repos puis au survol.
  - Le bouton est centré à l'écran par un défilement immédiat. Le défilement de la page est progressif
    (`scroll-behavior: smooth`) : sans cela, au premier essai, le survol de Playwright avait placé le
    bouton sous l'en-tête collant à 390 px, et la capture montrait l'en-tête. Cet essai est écarté.
    Dans les mesures retenues, l'élément au centre du libellé est bien le lien, dans les 16 états.
  - Le survol se fait en déplaçant réellement la souris sur le bouton.
- **Trois mesures par état** :
  - **au pixel** : pixel du libellé le plus éloigné du fond, contre le fond dominant de la capture,
    anticrénelage compris. C'est la méthode de DS ;
  - **couleur réelle du texte** : le même lien, dans le même état, avec le libellé agrandi (26 px à
    390, 64 px à 1440, sur une ligne). On relève la couleur des pixels pleins du texte, contre le fond
    plein qui l'entoure ;
  - **fond seul** : texte rendu transparent, pixels le plus clair et le plus sombre sous le libellé.
- **Seuils** : texte de 15 px (390) et 14 px (1440) en gras 700, donc 4,5:1 (1.4.3). Rapports tronqués
  au centième.
- **Fichiers** :
  - script : `scripts/visite-du8.cjs` (`MODE=reduce` pour le mouvement réduit) ;
  - mesures : `mesures/c8-visite-{390,1440}{,-reduce}.json` ;
  - captures : `captures/c8-visite-*` (libellé à sa taille, et agrandi).

### 16.1 État « déjà visité » au pixel

**Mouvement non réduit, reflet arrêté et masqué** (le passage du reflet est traité au §16.2) :

| État | 390 px | 1440 px | Lien témoin |
|---|---|---|---|
| Avant visite, repos | 7,49 (`#000000` / `#f97316`) | 7,49 | `#020817` (non visité) |
| Avant visite, survol | 5,89 (`#000000` / `#ea580c`) | 5,89 | `#020817` |
| **Après visite, repos** | **7,49** (`#000000` / `#f97316`) | **7,49** | **`#9810fa`** (violet) |
| **Après visite, survol** | **5,89** (`#000000` / `#ea580c`) | **5,89** | `#9810fa` |

**Mouvement réduit** (`reducedMotion: "reduce"`, reflet immobile et visible, réglage de DS) :

| État | 390 px au pixel | 1440 px au pixel | Couleur réelle, 390 / 1440 | Lien témoin |
|---|---|---|---|---|
| Avant visite, repos | 7,34 (`#0e0e0e` / `#f97d27`) | 6,89 (`#1a1a1a` / `#f98331`) | 7,15 / 6,67 | `#020817` |
| Avant visite, survol | 5,85 (`#0e0e0e` / `#eb641e`) | 5,55 (`#1a1a1a` / `#ec6b28`) | 6,07 / 5,37 | `#020817` |
| **Après visite, repos** | **7,34** | **6,89** | 7,15 / 6,67 | **`#9810fa`** |
| **Après visite, survol** | **5,85** | **5,55** | 6,07 / **5,37** | `#9810fa` |

- Chaque valeur après visite est identique à la valeur avant visite, au pixel près. La classe
  `no-visited` est présente sur le lien dans les 16 états relevés.
- Le lien témoin (ajouté sans couleur, vers `/diagnostic-auto`) passe de `#020817` à `#9810fa`, le
  `purple-600` de la règle `a:visited`. L'état « visité » est donc bien appliqué par le navigateur ;
  seul le bouton y échappe.
- Les colonnes « au pixel » rejoignent exactement les chiffres annoncés par DS (7,34 et 6,89 au repos,
  5,85 et 5,55 au survol). Elles ont été mesurées ici à part, sans reprendre ses fichiers.
- Captures : `captures/c8-visite-{390,1440}-apres-{repos,survol}.png` et leurs versions `-reduce`.

### 16.2 Écart entre 7,49:1 et 6,89:1 à 1440 px au repos

L'écart persiste, et il a une cause unique : **le réglage du mouvement**. Ce n'est pas un effet de
l'état visité, puisque les valeurs avant et après visite sont identiques.

- **Mes 7,49:1** (§15.1 et §16.1) sont mesurés en mouvement non réduit, sans reflet sur le libellé :
  `#000000` sur `#f97316`. Le libellé compte 194 pixels noirs purs à 1440 px.
- **Les 6,89:1 de DS** sont mesurés en mouvement réduit. Dans ce mode, `motion-reduce:animate-none!`
  arrête le reflet mais le laisse affiché. C'est une bande `from-white/0 via-white/[0.12] to-white/0`,
  posée en `absolute inset-0`. Sa partie la plus claire reste au milieu du bouton, donc sur le libellé.
- **Ce voile passe devant le texte**, pas seulement devant le fond. Le calque est positionné et le
  texte ne l'est pas, donc le navigateur le peint après le texte. Preuve : en mouvement réduit, le
  libellé n'a plus **aucun** pixel noir pur (0 contre 194).
  - Le texte devient `#1a1a1a` au pixel le plus sombre, ou `#1d1d1d` dans ses parties pleines.
  - Le fond devient `#f98331`.
- **Calcul** (formule WCAG, tronqué) :

| Couple | Rapport | Ce qu'il représente |
|---|---|---|
| `#000000` / `#f97316` | 7,49 | couleurs déclarées, sans voile |
| `#000000` / `#f98331` | 8,31 | fond voilé seul, texte noir (la méthode « fond seul » du §15.6) |
| `#1a1a1a` / `#f97316` | 6,20 | texte voilé contre fond non voilé : couple impossible à l'écran |
| **`#1a1a1a` / `#f98331`** | **6,89** | texte et fond sous le même voile : la mesure de DS |
| `#1d1d1d` / `#f98331` | 6,67 | partie pleine du texte sous le voile |

- À 390 px, le voile sur le libellé est plus faible (texte `#0e0e0e`), d'où 7,34.
- **Les deux chiffres sont justes**, chacun pour son réglage. Le bon chiffre à retenir pour un
  visiteur en mouvement réduit est celui de DS, ou le mien en couleur réelle (6,67). Tous deux
  dépassent largement 4,5:1.

**Rectification de mes compléments n° 6 et n° 7.** Mes mesures « fond seul » rendaient le texte
transparent. Elles ne voyaient donc pas que le reflet éclaircit aussi le texte.
- Le « 7,79 (390) et 8,11:1 (1440) » du §15.6 compare un texte noir pur au fond voilé. À l'écran, en
  mouvement réduit, le libellé est à 7,34 et 6,89:1 au pixel (§16.1).
- Le pire « au passage du reflet » du §15.1 (7,40 au repos, 5,83 au survol) ne compte pas le voile
  sur le texte. Le pire possible, quand le centre du voile (12 % de blanc) passe sur le libellé, est
  calculé à **6,60:1 au repos** (`#1f1f1f` / `#fa8432`) et **5,32:1 au survol** (`#1f1f1f` /
  `#ed6c29`). C'est un calcul, non mesuré en animation. Il reste au-dessus de 4,5:1.
- Le verdict du §15 ne change pas sur ce point : le contraste tient dans tous les cas.

### 16.3 Régressions

| Contrôle | Résultat | Preuve |
|---|---|---|
| Diff `06dcea7bc` → `f1dbcf285` | OK | Un commit, 27 fichiers. Côté code, 2 fichiers seulement : `GammeDiagnosticCTA.tsx`, avec 1 ligne changée (`no-visited ` ajouté en tête de la `className` du `<Link>`, rien d'autre dans le fichier), et `tests/unit/gamme-diagnostic-cta-contrast.test.tsx`, avec 10 lignes ajoutées (un troisième test). Les 25 autres fichiers sont des documents de DS dans le dossier de la maquette : `README.md`, 23 preuves sous `complement-7/` et `outils/visite-c7.cjs`. Lien, libellé, titre, H1, meta, canonical et composants partagés ne sont pas touchés |
| HTML servi | OK | `no-visited w-full py-4 bg-cta` présent sur le lien. La page répond 200 sur mon port |
| axe 390 / 1440 px | OK | Identique à `06dcea7bc`, nœud pour nœud : 390 px `color-contrast` 9, `link-in-text-block` 1, `region` 2 ; 1440 px `color-contrast` 5, `region` 4 (`mesures/c8-page-{390,1440}.json` contre `c7-page-*`). Aucune nouvelle violation |
| Typecheck frontend | OK | `npm run typecheck`, code de sortie 0 (`mesures/c8-typecheck-front.txt`) |
| Tests du composant | OK | vitest : 3 tests sur 3 passent, dont le nouveau, qui exige `no-visited` (`mesures/c8-vitest.txt`). Le test vérifie la classe, pas le rendu après visite ; le rendu est couvert par la mesure du §16.1 |
| CI du commit `f1dbcf285` | 34 réussis, 11 ignorés, 4 en échec, 1 annulé | Mêmes contrôles en échec qu'à `06dcea7bc` : Circuit de fusion (brouillon), Deterministic gates, DoD self-evaluation et Registry freshness. Le second contrôle DoD est « annulé » au lieu d'« en échec ». Deterministic gates échoue pour la même cause qu'avant : `depcruise` à 170 dépendances signalées pour une base de 163, les mêmes nombres dans les deux journaux. Le diff ne touche aucun import. Rien de nouveau n'est introduit (`mesures/c8-ci.txt`) |

### 16.4 Hors périmètre

- Le lien « Conseils : changer un filtre à huile étape par étape » de `#reference` attend la décision
  de Marwane. Il n'est pas jugé ici.
- Le reste de la page n'est pas remesuré, en dehors de l'audit axe complet du §16.3.
- Firefox et Safari ne sont pas mesurés.
