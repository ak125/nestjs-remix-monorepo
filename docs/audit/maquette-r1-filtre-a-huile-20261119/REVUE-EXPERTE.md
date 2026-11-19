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
| Contraste | À CORRIGER | 24 nœuds sous le seuil, plus le dégradé des cartes véhicule |
| Cibles tactiles | À CORRIGER | Navigation rapide à 37 px ; 26 cibles sous 44 px ; un bouton de 48 × 16 |
| Ordre de tabulation | À MESURER | Il suit l'ordre visuel. Le focus se perd au champ « Marque » dans le navigateur sans affichage (identique avant et après) ; à vérifier au clavier réel |
| Libellés | OK | Aucun contrôle sans nom accessible ; champs du sélecteur libellés |
| Lisibilité à 390 px | À CORRIGER | Textes de 10 à 12 px (réassurance, fil d'Ariane, cartes d'étapes) ; `#reference` mesure 5 255 px |
| Parcours d'achat (sélecteur puis page véhicule) | OK, À MESURER | Le sélecteur est au premier écran et les cartes véhicule suivent. Le bouton du chat recouvre le bas du sélecteur. Le taux de passage de R1 à R2 reste à mesurer |
| Éléments de confiance | OK | Réassurance placée juste après le sélecteur. Le seuil de livraison dépend de #2143 |
| Jetons de design sans valeur en dur | À CORRIGER | `text-[12px]` (`GammeQuickNav.tsx:39`), dégradé sans couleur d'arrivée (`MotorisationsSection.tsx:49`), `text-white/25` (`GammeHero.tsx:52`), couleurs `#009966`, `#90a1b9`, `#f97316` relevées par axe |
| Mouvement réduit | À CORRIGER | Défilement `smooth`, `shimmer` infini, `hover:scale` sans garde `prefers-reduced-motion` |
| Cohérence avec #1943, #1944, #2143 et DG | À CORRIGER | Doublon avec #1943, conflit avec #1944, dépendance du bandeau à #2143 (§11) |
| Couverture par les contrôles | NON VÉRIFIÉ | Aucun contrôle de PR ne couvre l'ordre ni le rendu R1 (§10) |
| Écran d'erreur observé une fois | NON VÉRIFIÉ | 1 occurrence sur 6 passages, non reproduite, cause inconnue (§6) |

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
  et les textes varient selon la gamme ; je n'en ai mesuré qu'une.
- **Exécution réelle du validateur de rôle** : sans accès aux journaux du backend, je n'ai pas pu
  vérifier si l'intercepteur se déclenche sur une page R1 servie (§8.2, n° 33).
- **Rattachement des blocs au contrat** : la section micro-SEO et les sections S0 à S9 ne sont pas
  marquées dans la page servie (C10). Leur présence et leur longueur ne sont donc pas vérifiables.
- **Seuil d'indexabilité par familles** : ses entrées ne sont pas lisibles depuis la page.
- **Hors périmètre** : la variante vidéo, la page véhicule (Clio III) et toute page R2.
