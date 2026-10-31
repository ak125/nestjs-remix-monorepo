# Dossier éditorial — filtre à huile (pg_id 7)

Lot 1 du programme recadré le 30 octobre 2026 : premier dossier prioritaire. Base `980b2f8a7`, branche
`docs/editorial-filtre-huile-dossier-20261030`, worktree isolé. Lectures seules : site public, base (SQL en lecture
seule), WIKI par l'API GitHub, sources externes. Aucune écriture dans RAW, WIKI ou la base ; aucune publication.

Statut : **REVIEW_REQUIRED**. Textes et scripts proposés ; rien n'est validé, rendu ni publié. Médias :
[MEDIA.md](MEDIA.md). Raccordements pour Claude CLI : [HANDOFF.md](HANDOFF.md). Reprise : [CHECKPOINT.md](CHECKPOINT.md).
Le dossier plaquettes reste en attente (commit `2a63da58a`, branche non poussée, aucune PR).

Révision 3 (30/10) : les textes à intégrer sont dans `integration/r1.json` et `integration/r3.json`, sous les noms des
champs réellement servis ; les faits et blocs encore candidats dans `integration/candidats.json` ; les visuels produits
dans `assets/` (`integration/assets.json`) ; les images et scènes manquantes dans [PROMPTS.md](PROMPTS.md). Les § 1.1
et 1.2 restent la version relue phrase par phrase ; en cas d'écart, les fichiers `integration/` font foi.

Révision 4 (31/10) : chaque champ R1 et chaque section R3 porte une fiche (page et champ cible, question résolue,
preuve interne, portée véhicule, statut d'admission, dépendance, image associée) ; S2_DIAG répond aux cinq intentions R5
consolidées ; parcours par besoin au § 3.1 ; références vidéo complétées au § 4 ; trois pictogrammes vidéo ajoutés.

Statut de chaque phrase proposée :

| Marque | Sens | Servable |
|---|---|---|
| **[admis]** | fait de la fiche WIKI `wiki/gamme/filtre-a-huile.md`, commit `a4783348`, section citée | oui, après relecture humaine |
| **[catalogue]** | mesure en base du 30/10/2026, lecture seule | oui, si la donnée est relue au moment de la mise en ligne |
| **[éditorial]** | orientation ou prudence, sans fait technique nouveau | oui |
| **[candidat]** | sourcé hors WIKI, non admis (§ 6) | **non** : reste dans ce dossier |

## 1. Textes R1 et R3

### 1.1 R1 — `/pieces/filtre-a-huile-7.html`

Rôle (`.spec/00-canon/role-matrix.md`) : orienter vers la gamme et la référence compatible. Zéro procédure, zéro
symptôme, zéro prix ou stock détaillé. Colonnes de `R1_SECTION_CONFIG` (`backend/src/config/r1-keyword-plan.constants.ts`).
S0 (title, meta, H1) n'est pas modifié ; ses promesses sont signalées au § 8.4.

Correction de la révision 3 : les colonnes `sgpg_*` ci-dessous ne sont presque pas lues par la page. Le rendu lit
`__seo_r1_gamme_slots` (champs `r1s_*`) et le contenu de `__seo_gamme.sg_content`, découpé en blocs H2. Les textes de
ce paragraphe sont reportés sur ces champs dans `integration/r1.json`, avec l'ancien texte remplacé pour chaque bloc ;
le bloc micro-SEO y passe à 1 850 caractères (1 663 sans la phrase conditionnée par FH-12) pour respecter le minimum
du contrat. Défauts du rendu R1 relevés à cette occasion : HANDOFF FH-15.

**S1_HERO** — `sgpg_hero_subtitle` (min. 60 caractères) **[catalogue]**

> Sélectionnez votre véhicule : le catalogue affiche les filtres à huile rattachés à sa motorisation, vissés ou
> cartouches.

**S2_SELECTOR** — `sgpg_selector_microcopy` (min. 50) **[catalogue]**

> Marque, modèle, année puis motorisation : deux versions d'un même modèle ne reçoivent pas toujours le même filtre.

**S3_BADGES** — `sgpg_arg1_title` à `sgpg_arg4_title` **[catalogue] [éditorial]**

> Choix par motorisation · Références d'origine sur chaque fiche véhicule · Vissé ou cartouche : selon le moteur ·
> Conseils de remplacement

Les badges servis « Livraison 24-48h », « Retours 30 jours » et « Paiement sécurisé » sont des promesses de service
non vérifiées dans ce lot ; ils ne sont pas repris.

**S4_MICRO_SEO** — `sgpg_micro_seo_block` (contrat `r1.ts` : 1 500 à 3 000 caractères ; constantes : 700 au moins).
1 667 caractères, 245 mots (mesurés hors marques de statut, révision 2).

> Le bon filtre à huile se choisit à partir du véhicule, jamais à partir de l'apparence de l'ancien. Des filtres qui
> se ressemblent peuvent être très différents à l'intérieur selon le moteur : clapet anti-retour présent ou non,
> filetage de raccordement, pression d'ouverture du clapet de dérivation (by-pass), média filtrant, finesse de
> filtration ou surpression admissible. Deux versions d'un même modèle ne reçoivent donc pas toujours la même
> référence. **[admis : Critères de choix 2]**
>
> Filtre vissé ou cartouche : la forme découle du moteur. Le filtre vissé réunit le boîtier et l'élément filtrant en
> un seul bloc. La cartouche est l'élément filtrant d'un boîtier démontable. **[admis : Définition]** Le sélecteur ne
> retient que les références rattachées à la motorisation choisie : renseignez la marque, le modèle, l'année et la
> motorisation exacte. **[catalogue]**
>
> Chaque page véhicule liste les références rattachées à une motorisation précise, avec la référence d'origine quand
> elle est connue. Comparez entre elles les références proposées pour votre motorisation. Certaines fiches précisent
> aussi la présence d'un clapet anti-retour ou d'un by-pass, ou indiquent qu'une cartouche est livrée avec son joint
> torique. **[catalogue : critère Version, affichage à vérifier]**
>
> Pour comparer deux références proposées pour votre véhicule, regardez leurs caractéristiques techniques quand elles
> sont publiées : forme, hauteur, diamètre extérieur, filetage pour un filtre vissé, pression d'ouverture du by-pass.
> **[catalogue : critères présents en base, affichage à vérifier]** Plus l'intervalle de remplacement prévu est long,
> plus la qualité du filtre compte. **[admis : Critères de choix 3]**
>
> Le guide du filtre à huile traite de son remplacement ; sa fiche de référence explique son rôle et ses clapets. Pour
> chercher l'origine d'un défaut avant d'acheter une pièce, commencez par le diagnostic. **[éditorial]**

**S5_COMPAT** — `sgpg_compatibilities_intro` (min. 60) **[catalogue]**

> Exemples de motorisations : chaque page liste les filtres à huile rattachés à cette version précise. Vérifiez la
> motorisation exacte, puissance comprise, avant de choisir.

**S6_SAFE_TABLE** — `sgpg_safe_table_rows` (4 à 6 lignes, éléments de l'énumération du contrat) **[admis] [catalogue]**

| Élément | Comment vérifier |
|---|---|
| Référence / équivalence | Comparez la référence d'origine indiquée sur la page de votre véhicule avec celles proposées pour sa motorisation. |
| Connectique | Filtre vissé : même filetage de raccordement. Cartouche : même boîtier, seul l'élément filtrant change. |
| Dimensions | Hauteur et diamètre extérieur, quand la fiche de la référence les indique ; une dimension proche ne suffit pas. |
| Identifiant | Marque, modèle, année et motorisation exacte du véhicule, puissance comprise. |

Pas de ligne « Norme / homologation » : ISO 4548 a été retiré de la fiche WIKI faute de preuve archivée.

Condition de service : hauteur, diamètre, filetage, by-pass et critère Version existent en base, mais aucun
n'apparaît dans le HTML servi de la page véhicule Clio III 19052 le 30/10 (11:47Z). La ligne « Dimensions » et les
paragraphes 3 et 4 de S4 attendent la vérification de leur affichage sur les fiches produit ([HANDOFF.md](HANDOFF.md),
FH-12) ; sans affichage, ils sont retirés.

**S7_EQUIP** — `sgpg_equipementiers_line` (min. 50) **[catalogue]**

> Les marques présentées proviennent du catalogue : chaque référence est rattachée à des motorisations précises. La
> marque ne remplace pas la vérification de la compatibilité.

La liste des marques reste produite depuis le catalogue (23 marques parmi les références affichées le 30/10). Les
mentions servies « équipementier OE pour Renault, Volkswagen, Mercedes », « certifié ISO 4548-12 », « fournisseur OE
Renault et PSA » et « alternative OES reconnue » n'ont aucune source admise : à retirer.

**S8_CROSS_SELL** — `sgpg_family_cross_sell_intro` (min. 50) **[admis : Définition]**

> Les autres filtres de votre véhicule (à air, à carburant, d'habitacle) filtrent d'autres fluides et ont chacun
> leur propre référence.

**S9_FAQ** — `sgpg_faq` (min. 120 mots, 600 caractères) : 5 questions, 187 mots, 1 186 caractères.

> **Comment trouver le filtre à huile compatible avec ma voiture ?** Renseignez la marque, le modèle, l'année et la
> motorisation dans le sélecteur : seules les références rattachées à cette motorisation s'affichent. Ne partez pas de
> l'apparence de l'ancien filtre : des filtres semblables peuvent différer à l'intérieur selon le moteur.
> **[catalogue] [admis]**
>
> **Filtre vissé ou cartouche, lequel choisir ?** Celui prévu pour votre moteur : la forme ne se choisit pas. Le
> filtre vissé se remplace en bloc ; la cartouche est l'élément filtrant d'un boîtier démontable. **[admis]**
>
> **Deux versions du même modèle ont-elles le même filtre ?** Pas toujours : le filtre dépend du moteur. Vérifiez la
> motorisation exacte, puissance et année comprises, avant de choisir. **[admis] [catalogue]**
>
> **Une autre marque que celle d'origine convient-elle ?** Les références affichées pour votre motorisation lui sont
> rattachées dans notre catalogue, quelle que soit leur marque. En cas de doute, comparez-les avec la référence
> d'origine indiquée sur la page de votre véhicule. **[catalogue]**
>
> **Quand faut-il remplacer le filtre à huile ?** Aux échéances d'entretien fixées par le constructeur de votre
> véhicule. Le guide du filtre à huile détaille ce point. **[admis : Entretien]**

### 1.2 R3 — `/blog-pieces-auto/conseils/filtre-a-huile`

Rôle : conseil et procédure autorisés par le contrat R3 (R6 fusionné, ADR-103). Sections de
`backend/src/config/page-contract-r3.json` ; leur correspondance avec la page servie est déduite de son ordre. H1 servi
conservé (« Comment changer un filtre à huile »). Aucune source n'est nommée dans le texte proposé (garde `anti_source`,
règle du propriétaire). Traçabilité interne : la fiche WIKI cite MAHLE Aftermarket (rôle, choix, intervalle, montage,
qualité), Filtron (clapets) et la notice de la Renault Clio 5 (voyant).

**En bref** (tête de page, réponse directe) **[admis]**

> Le filtre à huile se remplace aux échéances d'entretien fixées par le constructeur de votre véhicule. Il se choisit
> à partir du véhicule, jamais à son apparence. Un filtre vissé se change en entier ; avec une cartouche, seul
> l'élément filtrant est renouvelé.

**S1 — À quoi sert le filtre à huile** **[admis : Rôle technique, Définition, Fonctionnement]**

> Le filtre à huile empêche les impuretés d'entrer dans le circuit de lubrification du moteur. Il aide à préserver la
> qualité de l'huile, les performances et le rendement du moteur. Il existe sous deux formes. Le filtre vissé
> réunit le boîtier et l'élément filtrant en un seul bloc, qui se change en entier. La cartouche s'utilise avec un
> boîtier démontable : seul l'élément filtrant sale est renouvelé. Ne le confondez pas avec le filtre à air, le
> filtre à carburant ou le filtre d'habitacle, qui filtrent d'autres fluides.
>
> *Les clapets d'un filtre vissé.* Selon sa conception, fixée par le constructeur du moteur ou du véhicule, un filtre
> vissé peut comporter trois types de clapets :
>
> - **anti-retour** : le plus souvent une membrane en caoutchouc ; il empêche l'huile de quitter le filtre moteur
>   arrêté, surtout quand le filtre est monté horizontalement ou tête en bas ;
> - **de dérivation (by-pass)** : quand le filtre est colmaté ou que l'huile est froide et épaisse, il s'ouvre pour
>   laisser passer l'huile, afin que le moteur reste alimenté, même avec une huile non filtrée. Sa pression
>   d'ouverture diffère selon le moteur ;
> - **anti-siphon** : placé côté huile propre, il garde le filtre plein ; au démarrage, l'huile arrive vite au moteur,
>   ce qui réduit fortement le frottement à sec.

**S2 — Quand remplacer le filtre à huile** **[admis : Entretien & bonnes pratiques]**

> Aux échéances d'entretien fixées par le constructeur du véhicule : reportez-vous au carnet d'entretien ou à la
> notice. Aucune durée ni aucun kilométrage ne vaut pour tous les véhicules. Un filtre gardé trop longtemps peut se
> colmater : le by-pass s'ouvre alors pour continuer d'alimenter le moteur, avec une huile qui n'est plus filtrée.
> Plus l'intervalle prévu est long, plus la qualité du filtre compte.

Non servi : « le filtre se change à chaque vidange » **[candidat F-C1]**.

**S2_DIAG — Un voyant d'huile s'allume : par où commencer** **[admis : Symptômes & diagnostic]**

> Un symptôme seul ne désigne pas le filtre à huile. Exemple de la Renault Clio 5 phase 1 : le témoin de pression
> d'huile s'allume à la mise du contact, puis s'éteint après quelques secondes. S'il s'allume en roulant, avec le
> témoin d'arrêt impératif et un signal sonore, il faut s'arrêter impérativement, couper le contact et vérifier le
> niveau d'huile. Si le niveau est normal, l'alerte a une autre cause, et la notice demande de faire appel à un
> représentant de la marque. Pour un autre véhicule, suivez sa propre notice.
>
> Pour orienter la recherche avant d'acheter une pièce : diagnostic AutoMecanik. **[éditorial]**

La liste servie « Voyant huile, claquement, huile très noire, baisse du niveau, odeur d'huile brûlée » attribue des
symptômes au filtre sans source : à retirer (§ 8.4).

**S3 — Choisir le bon filtre à huile** **[admis : Critères de choix, Marques & qualité]**

> 1. **Partez du véhicule.** Choisissez le filtre à partir de votre véhicule dans le catalogue, pas à partir de son
>    aspect ni d'une dimension approchée.
> 2. **Prenez la forme prévue** : filtre vissé ou cartouche, selon le moteur.
> 3. **Ne vous fiez pas à l'apparence.** Beaucoup de filtres se ressemblent mais diffèrent à l'intérieur selon le
>    moteur : clapet anti-retour, filetage de raccordement, pression d'ouverture du by-pass, média filtrant, finesse
>    de filtration, surpression admissible.
> 4. **Regardez la qualité.** Le papier filtrant, le by-pass et le clapet anti-retour font partie des
>    caractéristiques de qualité d'un filtre. La qualité du montage et de l'entretien compte aussi.
>
> Deux versions d'un même modèle peuvent recevoir des références différentes : vérifiez la motorisation exacte dans
> le sélecteur. **[catalogue]**

**S4_DEPOSE — Déposer l'ancien filtre**

> Un filtre vissé se change en entier ; avec une cartouche, seul l'élément filtrant est renouvelé. Suivez les
> instructions du constructeur du véhicule et du fabricant du filtre. **[admis : Entretien]**

Prêt à servir après admission, non servi aujourd'hui **[candidat F-C2, F-C3, F-C6]** :

> Filtre vissé : il peut se déposer avec un outil de dépose. Cartouche : le couvercle du boîtier se desserre avec un
> outil, par exemple une douille. Après la dépose, vérifiez que l'ancien joint n'est pas resté sur la portée du
> filtre ; retirez-le et nettoyez la surface d'étanchéité.

**S4_REPOSE — Monter le filtre neuf**

> Même un filtre de qualité ne fonctionne correctement que s'il a été bien monté. Suivez les instructions du
> constructeur du véhicule et du fabricant du filtre : ce guide ne donne pas de consigne de serrage valable pour tous
> les filtres. **[admis : Entretien]** Certaines cartouches sont livrées avec leur joint torique : voyez la fiche de
> la référence. **[catalogue : valeur « O'ring included » du critère Version]**

Prêt à servir après admission **[candidat F-C2 à F-C6]** :

> Filtre vissé : huilez le joint neuf avec de l'huile moteur propre, vissez jusqu'au contact du joint, puis serrez à
> la main selon l'instruction du fabricant du filtre ou du constructeur. Le nombre de tours après contact est propre à
> chaque filtre. Ne serrez pas avec l'outil de dépose : il peut abîmer le revêtement du filtre, qui risque alors de
> rouiller jusqu'à fuir. Cartouche : après remplacement de l'élément, resserrez le couvercle avec le même outil.

**S5 — Erreurs à éviter**

> - Choisir le filtre à son apparence ou à une dimension approchée. **[admis]**
> - Dépasser l'échéance du constructeur : le filtre peut se colmater et laisser passer, par le by-pass, une huile
>   non filtrée. **[admis]**
> - Attribuer un voyant d'huile au filtre sans rechercher la cause. **[admis]**
> - Serrer un filtre vissé avec l'outil de dépose ; laisser l'ancien joint en place. **[candidat F-C2, F-C3]**

**S6 — Vérifier après le remplacement** **[candidat F-C5]** (non servi)

> Remettez l'huile, démarrez le moteur, contrôlez le niveau, puis vérifiez l'absence de fuite.

Servable dès maintenant : « Si le témoin de pression d'huile s'allume, suivez la notice de votre véhicule. »
**[admis]** Les délais servis (5 minutes, 2 minutes, « un quart de tour maximum ») n'ont pas de source : à retirer.

**S_GARAGE — Quand confier l'intervention à un professionnel** **[éditorial]** fondé sur **[admis]**

> Si vous n'avez pas les instructions de montage du constructeur et du fabricant du filtre, confiez l'intervention à
> un professionnel. Si le témoin de pression d'huile s'allume en roulant, suivez la notice du véhicule : celle de la
> Clio 5 phase 1 demande, si le niveau d'huile est normal, de faire appel à un représentant de la marque.

**S7 — Pièces liées** **[admis : `related_parts`]** **[catalogue]**

> Bouchon de vidange · Filtre à air · Filtre à carburant · Filtre d'habitacle.

Huile moteur (pg_id 1862) n'est pas affichée au catalogue ; « joint de vidange carter » n'a pas de gamme. Les six liens
servis vers `/pièces/<slug>` aboutissent tous à un 410 (§ 5).

**S8 — Questions fréquentes** **[admis : FAQ]**

> **Que remplace-t-on lors de l'entretien ?** Un filtre vissé se change en entier, car son boîtier et son élément
> filtrant forment un seul bloc. Avec une cartouche, seul l'élément filtrant est renouvelé.
>
> **Quand remplacer le filtre à huile ?** Aux échéances d'entretien prévues par le constructeur du véhicule.
>
> **Peut-on choisir un filtre à sa taille ou à son apparence ?** Non. Des filtres qui se ressemblent peuvent être très
> différents à l'intérieur selon le moteur. Le choix se fait à partir du véhicule.
>
> **Le voyant de pression d'huile vient-il du filtre ?** Ce voyant ne désigne pas à lui seul le filtre. Suivez la
> notice du véhicule, puis faites rechercher la cause.

**META** — proposition, à n'appliquer qu'avec autorisation (title et description optimisés protégés)

- Title : « Filtre à huile : quand le changer et comment le choisir » (servi : « … symptômes, changement et prix »).
- Description : « Échéances du constructeur, filtre vissé ou cartouche, clapets, montage : les points à vérifier
  avant de remplacer votre filtre à huile. »

## 2. Scripts

Détail, scènes, sous-titres, vignettes et légendes : [MEDIA.md](MEDIA.md).

| Vidéo | Question | Format | État |
|---|---|---|---|
| V1 `fafa-filtre-huile-001` (principal) | Vissé ou cartouche, quand le changer, comment ne pas se tromper ? | `piece-expliquee`, 40 s | script écrit ; dossier `scripts/draft/fafa-filtre-huile-001/` ; validateur en sortie 1 (validation humaine requise) ; non rendu |
| C1 | Voyant d'huile allumé : faut-il changer le filtre ? | court 35 s, sans composition | script écrit ; dépendance : composition |
| C2 | Deux filtres identiques sont-ils interchangeables ? | court 30 s, démonstration | script écrit ; dépendances : composition, prises de vue |
| C3 | À quoi servent les clapets d'un filtre vissé ? | court 35 s, schéma animé | script écrit ; dépendance : schéma (WIKI `function_diagram` DEFERRED) |
| C4 | Comment serrer un filtre vissé ? | court 30 s, démonstration | script écrit, **bloqué** : faits candidats F-C2 à F-C4 |

Aucun format long : la fabrique n'a pas de composition au-delà de 40 s. Non rédigé dans ce lot. État de chaque vidéo au
31/10 (script, visuels, voix, composition, rendu) : MEDIA § 1.

## 3. Choix éditoriaux et justification

| Support | Besoin du visiteur | Obstacle levé | Action suivante | Destination réelle (30/10) | Ce qui se mesure |
|---|---|---|---|---|---|
| R1 | trouver le filtre de son véhicule | croire que l'aspect ou la marque suffit | sélectionner le véhicule | page véhicule `/pieces/filtre-a-huile-7/…` (200 pour 19052 et 19053) | GSC R1 et pages véhicule ; usage du sélecteur non instrumenté à ma connaissance (non vérifié) |
| R3 | savoir quand et comment le remplacer | intervalles contradictoires, peur du mauvais montage | vérifier l'échéance au carnet, puis choisir la référence | R1 (200) ; `/diagnostic-auto` (200) | GSC R3 : aucune ligne sur la période ; clics internes non mesurés |
| V1 | comprendre la pièce avant d'acheter | vissé/cartouche, choix à l'œil | sélectionner le véhicule | R1 | vues et rétention plateforme ; clic vers R1 seulement si lien suivi |
| C1 | savoir quoi faire face au voyant | réflexe « je change le filtre » | suivre la notice, puis diagnostic | `/diagnostic-auto` | idem |
| C2 | savoir si deux filtres se valent | confiance dans l'apparence | sélectionner le véhicule | R1 | idem |
| C3 | comprendre les clapets | pièce opaque | lire le guide | R3 | idem |
| C4 | bien monter un filtre vissé | serrage à l'outil | lire le guide | R3, après admission | idem |

Une impression, une vue ou un clic ne prouve pas une vente.

Choix tranchés :

- **Aucun symptôme attribué au filtre.** La fiche WIKI classe ses deux relations diagnostic en hypothèses non
  établies (`diagnostic_safe: false`). R1 n'en contient aucun ; R3 renvoie au diagnostic et à la notice ; V1 dit
  explicitement qu'aucun symptôme ne désigne le filtre.
- **Réponse directe d'abord** : un bloc « En bref » ouvre R3 ; R1 commence par l'action (sélectionner).
- **Pas de valeur universelle** : ni kilométrage, ni couple, ni nombre de tours. La source WIX montre que le nombre de
  tours dépend du filtre ; la consigne servie « main + 3/4 de tour » est donc retirée, pas corrigée.
- **R1 sans S0 modifié** : les promesses de la meta (« dès 5€ », « En stock, livraison 24-48h ») relèvent du prix et
  du stock, zones STOP ; elles sont seulement signalées.
- **Portée véhicule** : 19052 et 19053 restent distincts (§ 8.3). L'exemple Clio III ne figure dans aucun texte servi.
- **Procédures prêtes mais retenues** : les étapes de dépose et de repose sont rédigées et marquées [candidat] ; elles
  attendent l'admission (§ 6) et une validation humaine (claims `procedure`).
- **Format** : seul `PieceExpliquee` rend V1 sans inventer de cause. `NeChangePasTropVite` exige trois causes et
  `SymptomeTroisCauses` affiche « 3 causes possibles » en dur : la fiche n'en fournit pas trois pour le voyant.

Relecture éditoriale de mes propres textes (`.claude/prompts/_shared/editorial-review.md` v1.0.0, contre la fiche
WIKI ; pour les scripts, MEDIA § 3.1) :

| Section | Avant | Après | Règle |
|---|---|---|---|
| S5 | « un filtre colmaté laisse passer une huile non filtrée » | « le filtre peut se colmater et laisser passer, par le by-pass, une huile non filtrée » | § 3, certitude et mécanisme : la fiche dit « peut se colmater » |
| S_GARAGE | « après le contrôle du niveau, de faire appel… » | « si le niveau d'huile est normal, de faire appel… » | § 3, condition retirée |
| S1 | « Il aide ainsi à préserver la qualité de l'huile, ainsi que… » | « Il aide à préserver la qualité de l'huile, les performances… » | style, répétition ; sens inchangé |
| META | « l'essentiel avant de remplacer » | « les points à vérifier avant de remplacer » | promesse d'exhaustivité retirée |

Révision 2 (30/10) : aucune source nommée dans le texte servi (règle du propriétaire ; garde `anti_source` de
`hard-gates.service.ts`), passe humanizer dans l'adaptation française d'`editorial-review.md` (§ 5, § 11), vocabulaire
R1 de `.claude/prompts/R1_ROUTER/editorial.md`.

| Section | Avant | Après | Règle |
|---|---|---|---|
| R3 S1, S2, S2_DIAG, S3, S4_REPOSE | « (MAHLE) », « (Filtron) », « (Filtron, MAHLE) », « (notice Renault) » | retirés ; traçabilité en annotation interne (§ 1.2) | aucune source nommée |
| R3 S3, point 4 | « MAHLE cite le papier filtrant […] comme caractéristiques importantes ; selon le même fabricant, la qualité du montage et de l'entretien compte autant que celle du filtre » | « … font partie des caractéristiques de qualité d'un filtre. La qualité du montage et de l'entretien compte aussi. » | § 3 : avis d'un seul fabricant ; sans attribution, portée réduite (« importantes », « autant que » retirés), jamais élargie |
| R3 S1, clapet by-pass ; C3 16-25 s | « une huile sale vaut mieux pour le moteur que pas d'huile du tout » | « afin que le moteur reste alimenté, même avec une huile non filtrée » | RE-03, maxime ; fait conservé |
| R1 S4, dernier paragraphe | « Pour savoir… Pour comprendre… Avant d'acheter une pièce pour une panne… » | « Le guide… traite de son remplacement ; sa fiche de référence… Pour chercher l'origine d'un défaut… » | R1 : « panne » (R5) et « comment le monter » (R3) hors rôle ; RE-06 |
| R1 S4, paragraphe 3 | « …, pas celles d'une version voisine du même modèle » | retiré | RE-23 : troisième reprise dans le même bloc |
| R1 S8 | incise entre tirets | parenthèses | RE-08 |

Contrôle de fidélité : statuts [admis]/[catalogue]/[candidat] inchangés ; aucun nombre, référence ni compatibilité
modifié ; seule altération de portée, documentée : R3 S3 point 4 (réduite). Contrôle automatique du texte proposé
(R1, R3, voix et légendes de MEDIA) : 0 nom de source, 0 terme interdit R1, 0 mot de remplissage de la liste RE-10. Le nombre de tirets n'est pas un critère de qualité et n'est plus compté.
Verdict : PROPOSITION. Signalement de fond : aucun texte n'est servi avant d'avoir suivi le chemin d'écriture existant
et gouverné, à identifier (FH-3, HANDOFF § 4). Espaces insécables et guillemets (RE-T) : à poser à la projection.

### 3.1 Parcours par besoin, R1 à R8 (état servi le 31/10)

Statuts relevés le 2026-10-31T05:33Z (`curl`, sans suivre les redirections). Une affirmation non admise ne bloque que
le bloc qui la porte.

| Rôle | Question du client | Page existante | Apport du lot | Connaissance disponible | Manque | Action proposée |
|---|---|---|---|---|---|---|
| R1 | Quel filtre pour mon véhicule ? Vissé ou cartouche ? | `/pieces/filtre-a-huile-7.html` (200) | `integration/r1.json`, fiche par champ et par bloc | WIKI admis : rôle, formes, choix par véhicule ; catalogue : type de filtre par `type_id` | affichage des critères techniques (FH-12) ; champ de la carte grise (F-C7) | sélectionner le véhicule, puis la page de la gamme pour ce type (R2) |
| R2 | Quelle référence est compatible avec mon type ? | `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html` et `…-19053.html` (200) | aucun texte : le catalogue fait foi | références rattachées par `type_id` | filtre qui réduit 74 pièces à 24 sur la page (F-C8) | choisir une référence ; panier et prix (zone STOP) non touchés |
| R3 | Quand et comment le remplacer ? Le voyant s'allume : est-ce le filtre ? | `/blog-pieces-auto/conseils/filtre-a-huile` (200, canonique ; ancre `diagnostic-rapide` présente) | `integration/r3.json` ; blocs en attente dans `integration/candidats.json` | WIKI admis : clapets, by-pass, colmatage possible ; notice Clio 5 phase 1 pour le témoin | F-C1 à F-C6, F-C9 à F-C11 : S4 à S6 restent courts | vérifier l'échéance au carnet, puis sélectionner le véhicule ; diagnostic si un signe persiste |
| R4 | Qu'est-ce qu'un filtre à huile ? | `/reference-auto/filtre-a-huile` (200 ; liens servis vers R3 et R1) | hors du premier livrable ; écarts au § 8.4 | WIKI admis | cinq liens de symptômes en 404 (relevés le 30/10, § 5) | lire le guide R3 ou sélectionner le véhicule |
| R5 | Voyant, fuite, bruit, odeur ou vibration : est-ce le filtre ? | `/diagnostic-auto/{voyant,fuite,bruit,odeur,vibration}-filtre-a-huile` : 301 vers R3 `#diagnostic-rapide` | S2_DIAG réécrit en 4 lignes : consigne du témoin propre à la Clio 5 phase 1, notice pour un autre véhicule, une ligne pour les quatre autres signes, qui ne désigne pas le filtre | notice Clio 5 phase 1 ; fiche WIKI : relations diagnostic non établies (`diagnostic_safe: false`) | tableau servi le 31/10 : 5 lignes qui attribuent chaque signe au filtre, causes sans source, colonne « Action » qui répète le symptôme, vibration absente ; fuite juste après remplacement : candidat (F-C3, F-C4) ; OBD en attente faute de données | `/diagnostic-auto` (200) |
| R6 | Comment choisir sans erreur ? | `/blog-pieces-auto/guide-achat/filtre-a-huile` : 301 vers R3 (consolidation active, ADR-103) | aucune surface recréée ; le choix est traité en R1 et en R3 S3 | WIKI admis : choix par véhicule, pas par aspect | — | sélectionner le véhicule |
| R7 | Explorer une marque | `/constructeurs/renault-140.html` (200) | aucun : page non propre à la gamme | — | — | — |
| R8 | Situer un véhicule précis | `/constructeurs/renault-140/clio-iii-140004/1-5-dci-19052.html` et `…-19053.html` (200) | aucun ; 19052 et 19053 restent distincts | lien servi vers la page filtre à huile du même type (constaté pour 19052, non vérifié pour 19053) | — | ouvrir la page de la gamme pour ce type (R2) |

Les questions viennent de l'export Search Console (§ 8.2 : marque ou moteur, correspondance, vissé ou cartouche,
échéance) et des intentions R5 consolidées. Aucune requête « voyant » n'y figure : la ligne R5 répond à une
redirection servie, pas à une demande mesurée.

## 4. Références réellement analysées

Consultées le 30/10/2026. « Preuve » : peut fonder un fait candidat. « Inspiration » : forme seulement, jamais un fait.

| # | Référence | Type | Réellement consulté | Question traitée | Ce qu'elle explique bien | Limites | Ce qu'on garde | Notre apport |
|---|---|---|---|---|---|---|---|---|
| 1 | [MAHLE Aftermarket, oil filters](https://www.mahle-aftermarket.com/na/en/products-and-services/filters/oil-filters/) | preuve (déjà source WIKI) | texte HTML intégral ; images non vues | rôle, formes, choix, intervalle | filtres identiques dehors, différents dedans ; vissé changé en bloc | page commerciale du fabricant ; « environ 30 000 km en moyenne » et « jusqu'à 50 000 km » sans contexte véhicule | ce que la fiche WIKI admet déjà | choix par véhicule et non par marque |
| 2 | [Filtron, valves in oil filters](https://filtron.eu/en/insights/filter-guide/spin-on-oil-filter-valves.html) | preuve (déjà source WIKI) | texte intégral | clapets | rôle de chaque clapet, lien avec l'orientation du filtre | fabricant ; filtre vissé seulement ; aucune valeur | déjà admis | clapets reliés au choix sur véhicule |
| 3 | [MAHLE Technical Messenger 09/2022](https://www.techtips.ie/MAHLE/corrosion-on-oil-spin-on-filters-due-to-installation-errors.pdf) | preuve | PDF d'une page, texte intégral (pdftotext) | montage vissé et cartouche | serrage à la main, outil de dépose interdit au serrage, corrosion puis fuite, étapes | fabricant ; hébergé par un site tiers ; renvoie aux spécifications constructeur | F-C2, F-C3, F-C5, F-C6 | le « pourquoi » en français, sans valeur inventée |
| 4 | [WIX, spin-on filters product update 02/25/2025](https://static.nhtsa.gov/odi/tsbs/2025/MC-11018208-0001.pdf) | preuve | PDF d'une page, texte intégral | serrage après contact du joint | nombre de tours imprimé sur chaque filtre ; « hand tight » jugé subjectif | marché nord-américain ; références WIX listées seulement | F-C3, F-C4 ; contredit la règle servie « main + 3/4 de tour » | règle générale : suivre l'instruction du filtre |
| 5 | [Cerfa 13749*05](https://www.formulaires.service-public.gouv.fr/gf/cerfa_13749_05.do) | preuve | libellés des champs du formulaire (pdftotext) | où lire l'identifiant du véhicule | D.2 = « Type Variante Version », D.2.1 = CNIT | demande d'immatriculation d'un véhicule neuf, pas le certificat lui-même | F-C7 ; contredit « code moteur … case D.2 » servi en R1 | identifiant fiable sans promesse |
| 6 | [How a Car Works, changing an oil filter](https://www.howacarworks.com/engine/changing-an-oil-filter) | inspiration | texte ; illustrations vues par leur nom de fichier seulement | monter cartouche ou élément | une action par étape, avec la raison (joint huilé, pas de serrage excessif) | britannique, sans date ni source ; « trois quarts de tour » donné comme règle | la forme « geste + pourquoi » | aucune valeur universelle ; renvoi au véhicule |
| 7 | [idGarages, changer son filtre à huile](https://www.idgarages.com/fr-fr/prestations/revision-vidange/changer-filtre-a-huile) | inspiration | texte intégral | signes, rôle, fréquence, intervention | by-pass expliqué simplement ; filtre changé avec la vidange | commercial ; chiffres sans source (15 000-30 000 km, microns, 20-30 %) ; contradictions internes ; ouvre sur les symptômes | l'inventaire des questions des lecteurs | ni chiffres non sourcés ni ouverture sur un symptôme |
| 8 | [MANN-FILTER, HU 9006 z](https://www.youtube.com/watch?v=K20yphlTLg4) (74 s, 03/08/2025) | inspiration vidéo | description lue ; 9 images prélevées entre 3 et 70 s ; piste « [Music] » seulement ; vidéo non regardée en continu | changer un élément à baïonnette | démonstration sans voix sur un boîtier isolé, fond blanc, flèches, pictogramme pour « huiler le joint » | promotion d'un produit précis ; aucun « pourquoi » ; pas de contexte véhicule | la grammaire de démonstration (un geste par plan, pièce isolée, pictogrammes) pour C2 et C4 | la raison de chaque geste et le choix par véhicule |
| 9 | [MOTOR, série MAHLE en 6 vidéos (23/06/2021)](https://www.motor.com/2021/06/mahle-video-warehouse-now-includes-six-part-oil-filter-instructional-video-series/) | contexte | communiqué lu ; une vidéo de la série retrouvée ensuite (n° 10) | — | format en série par question, avec un formateur | promotionnel, 2021 | l'idée d'une série (V1 + C1 à C4) | — |
| 10 | [MAHLE Aftermarket NA, « Spin-On Oil Filter Series: Filters & Anti-Drain Valves »](https://www.youtube.com/watch?v=C1tlkJ_P6ko) (136 s, 26/05/2021) | inspiration vidéo (épisode de la série n° 9) | 70 images de l'aperçu de lecture, une toutes les 2 s (160 × 90 px) ; son non écouté ; vidéo non regardée en continu | faut-il un clapet anti-retour ? | un épisode par question ; la question en bandeau pendant l'explication, la réponse en bandeau à la fin ; présentateur face caméra, pièce en main brièvement | fabricant ; marché nord-américain ; bandeaux à peine lisibles à cette taille | la question à l'écran, puis la réponse à l'écran | réponse rattachée au véhicule ; pas de visage humain : Fafa est une IA |
| 11 | [LSX Filter, « Why Do Some Oil Filters Have Bypass Valves »](https://www.youtube.com/watch?v=lUN7f9mwvxY) (87 s, 04/06/2026, vertical) | inspiration vidéo, format court | 88 images de l'aperçu, une par seconde (101 × 180 px) ; sous-titres incrustés lus en partie ; son non écouté | à quoi sert le by-pass ? | plan fixe en plongée sur une table ; deux mains et des filtres réels ; le doigt appuie sur le clapet pour montrer qu'il s'ouvre ; sous-titres permanents ; aucun habillage graphique | fabricant, promotionnel ; aucun contexte véhicule ; sous-titres bilingues peu lisibles à cette taille | un geste physique visible par idée ; un texte lisible sans le son | le geste exige un filtre réel filmé (P-05), absent : C3 reste sur un schéma de principe |
| 12 | [Oscaro, vidange et filtre à huile sur Citroën C3 II 1.4 HDi](https://www.youtube.com/watch?v=TKkmoN1pzxE) (244 s, 22/01/2025) | inspiration vidéo (distributeur concurrent, jamais cité en public) | 123 images de l'aperçu, une toutes les 2 s (320 × 180 px) ; son non écouté | remplacer le filtre sur un véhicule précis | véhicule et moteur annoncés dès le titre ; carte « outillage » avant les étapes ; sept étapes numérotées en plein écran ; une consigne en bandeau sur chaque plan ; dernière étape : remise à zéro de l'indicateur d'entretien | valable pour ce seul véhicule ; aucune valeur lisible à cette taille | annoncer la portée (véhicule, moteur) avant toute procédure ; outillage, puis étapes numérotées | aucune procédure servie avant admission (F-C2 à F-C6) |

Révision 4 : les n° 10 à 12 sont des pages enregistrées le 30/10, dont les images d'aperçu ont été vues le 31/10.
Ces images sont de vraies images de la vidéo, prélevées à intervalle fixe ; elles ne valent pas un visionnage continu
avec le son, qui n'a été fait pour aucune des vidéos 8 à 12. Sept autres pages enregistrées le 30/10 (clapet by-pass,
260 s ; clapet anti-retour, 205 s et 528 s ; technologies d'un fabricant, 98 s et 165 s ; filtres en général, 711 s ;
tutoriel de 2011, 101 s) : titre et durée lus seulement, non analysées.

Non consultées : Carter-Cash (deux articles : page de vérification anti-robot, non contournée) ; Tomorrow's
Technician (trois vidéos : 403 puis défi Cloudflare) ; recherche YouTube de formats courts en français (résultats non
affichés dans le navigateur). Une seule référence au format court vertical (n° 11), vue par ses images ; aucune en
français.

Techniques retenues et où elles s'appliquent :

| Technique | D'où | Dans le lot |
|---|---|---|
| Regrouper par intention | cinq intentions R5 servies sur une seule ancre (§ 3.1) | S2_DIAG : une ligne par situation ; les quatre signes non spécifiques regroupés |
| Réponse directe d'abord | n° 6, 7, 10 | « En bref » en tête de R3 ; R1 ouvre sur la sélection du véhicule |
| Lien vers le besoin suivant | `role-matrix.md`, `handoff_targets` | une action suivante par rôle (§ 3.1) et par fiche de bloc (`integration/r1.json`, `r3.json`) |
| Validation par lot | pratique du dossier | `integration/candidats.json` : l'admission d'un fait F-C libère tous ses blocs |
| Comparaison avant/après réelle | pratique du dossier | texte servi relevé puis texte proposé dans `integration/*.json` ; `preview/` (simulation) face à `verification-dev/` (DEV, lecture superposée) |
| Question à l'écran, puis réponse | n° 10 | chaque court a une question pour titre (MEDIA § 7) ; texte à l'écran prévu de 0 à 3 s : la question pour C2, la réponse courte pour C1, C3 et C4 |
| Un geste visible par idée | n° 8, 11 | C2 à C4 ; dépend de prises de vue absentes (PROMPTS.md P-04, P-05, P-07, P-08) |
| Texte lisible sans le son | n° 11 | non appliqué : aucune composition n'incruste les sous-titres ; fichier SRT séparé (MEDIA § 2) |
| Portée annoncée avant la procédure | n° 12 | R3 S4 et C4, qui restent candidats |

## 5. Liens et appels à l'action

Statuts HTTP relevés le 30/10/2026 (`curl`, sans suivre les redirections sauf mention).

| De | Ancre ou CTA proposé | Vers | Statut |
|---|---|---|---|
| R1 S4, S9 | « guide du filtre à huile » | `/blog-pieces-auto/conseils/filtre-a-huile` | 200 |
| R1 S4 | « fiche de référence » | `/reference-auto/filtre-a-huile` | 200 (contenu à corriger, § 8.4) |
| R1 S4 | « diagnostic » | `/diagnostic-auto` | 200 |
| R1 S8 | filtres à air, à carburant, d'habitacle | `/pieces/filtre-a-air-8.html`, `filtre-a-carburant-9.html`, `filtre-d-habitacle-424.html` | 200 (×3) ; `filtre-de-boite-auto-416.html` aussi en 200, non cité (absent de la fiche WIKI) |
| R3 haut et S3 | « Sélectionner mon véhicule » | `/pieces/filtre-a-huile-7.html` | 200 |
| R3 S2_DIAG | « diagnostic AutoMecanik » | `/diagnostic-auto` | 200 |
| R3 S7 | bouchon de vidange | `/pieces/bouchon-de-vidange-593.html` | 200 |
| V1, C2 | « sélectionne ton véhicule » | R1 | 200 |
| C1 | « suis ta notice, puis diagnostic » | `/diagnostic-auto` | 200 |
| C3, C4 | guide | R3 | 200 |

Liens servis cassés :

| Page | Lien | Résultat |
|---|---|---|
| R1 | `/pieces/filtre-a-air` (×2), `/pieces/bouchon-de-vidange` | 410 |
| R1 | `/blog-pieces-auto/conseils/comment-changer-un-filtre-a-huile` | 301 vers R3 |
| R3 | `/pièces/<slug>` ×6 (bouchon de vidange, filtres à air, à carburant, d'habitacle, huile moteur, joint de vidange carter) | 301 puis 410 |
| R4 | `/diagnostic-auto/<texte brut du symptôme>` ×5 | 301 puis 404 (vérifié sur « Huile tres noire… ») |

## 6. Faits encore à admettre

Aucun n'est servi. Route : capture RAW de la source, proposition par `wiki-proposal-writer`, relecture humaine,
promotion. Ce dossier n'écrit ni dans RAW ni dans le WIKI.

| Id | Affirmation candidate | Source lue | Portée | Statut | Bloque |
|---|---|---|---|---|---|
| F-C1 | Le filtre se remplace à chaque vidange | aucune lue (Carter-Cash non consultable ; plans d'entretien constructeur à chercher) | par véhicule | à rechercher | rien : R3 S2 dit « échéances du constructeur » |
| F-C2 | Un filtre vissé se serre à la main selon les spécifications du constructeur ; l'outil de dépose ne sert pas au serrage (risque de corrosion puis de fuite) | MAHLE 09/2022 | filtres vissés de ce fabricant ; **non universel** (contre-exemple : notice imprimée d'un autre filtre, 3/4 de tour à l'outil dédié, `integration/candidats.json`) | sourcé, non admis ; à reformuler « selon l'instruction du fabricant du filtre » | R3 S4, S5 ; C4 |
| F-C3 | Retirer l'ancien joint s'il est resté, nettoyer la portée ; huiler le joint neuf | MAHLE 09/2022, WIX 02/2025 (concordants) | filtres vissés | sourcé, non admis | R3 S4 ; C4 |
| F-C4 | Le nombre de tours après contact du joint est propre à chaque filtre (instruction imprimée) | WIX 02/2025 | règle générale ; valeurs WIX limitées aux références listées | sourcé, non admis | R3 S4 ; C4 |
| F-C5 | Après montage : remplir, démarrer, contrôler le niveau, vérifier l'étanchéité | MAHLE 09/2022, WIX 02/2025 | tous filtres | sourcé, non admis ; claim `procedure` | R3 S6 |
| F-C6 | Cartouche : couvercle desserré puis resserré avec le même outil après remplacement de l'élément | MAHLE 09/2022 | cartouches | sourcé, non admis | R3 S4 |
| F-C7 | Certificat d'immatriculation : D.2 = type, variante, version ; D.2.1 = CNIT ; pas de champ code moteur | cerfa 13749*05 | France | sourcé sur le formulaire ; à confirmer sur le modèle du certificat | correction de R1 |
| F-C8 | Forme du filtre de la Clio III 1.5 dCi | catalogue : 24 / 23 pièces affichées « Filtre vissé », 8 non affichées « Cartouche filtrante », 50 affichables sans critère | 19052 et 19053, séparément | données à vérifier par le propriétaire du catalogue | toute mention de la Clio III |
| F-C9 | Remplacement du joint torique de cartouche à chaque échange | non lu dans ce lot | cartouches | à rechercher | R3 S4 |
| F-C10 | L'huile usagée est un déchet dangereux : récipient fermé et étanche, sans mélange, dépôt en déchèterie ou point de collecte | ministère de la Transition écologique (filière REP depuis le 01/01/2022) ; ADEME | France | sourcé, non admis | R3 S6 (bloc prêt dans `integration/candidats.json`) |
| F-C11 | Le filtre usagé ne va pas dans les ordures ménagères ; dépôt en déchèterie ou point de collecte | ADEME ; site de l'éco-organisme de la filière | France | sourcé, non admis ; consigne exacte de l'éco-organisme à vérifier | R3 S6 |

Révision 3 : F-C2 est contredit par la notice imprimée d'un autre filtre (3/4 de tour à l'outil dédié). Il n'est plus
proposé comme règle générale ; les blocs S4_REPOSE, S5 et le court C4 disent « selon l'instruction du fabricant du
filtre ». Blocs prêts après admission : `integration/candidats.json`.

## 7. Assets et raccordements encore nécessaires

| Besoin | Pour | État |
|---|---|---|
| Voix Fafa (`audioUrl`) | V1 | absente : sans elle, le rendu est muet |
| Validation humaine des 3 claims de V1 | V1 | requise (G2) ; décision de l'owner |
| Étape `script_text` approuvée et `stages` dans `approval.json` | V1 | décision de l'owner ; écart de schéma connu |
| Schéma du circuit et des clapets | R3 S1, C3 | WIKI `function_diagram` en DEFERRED |
| Prises de vue : filtre vissé et cartouche neufs, deux filtres semblables, filtre en coupe (membrane anti-retour), boîtier de cartouche, main qui serre | C2, C3, C4, R3 | aucune ; photo hero `filtre-a-huile.webp` disponible (licence `owned`) |
| Pictogrammes : huiler le joint, main | C4 | à créer (PROMPTS.md P-07, S-03) |
| Pictogrammes du témoin de pression d'huile, de l'arrêt impératif, du contact coupé et de la jauge | V1 14-24 s, C1 | livrés : `assets/picto-temoin-pression-huile`, `picto-arret-imperatif`, `picto-contact-coupe`, `picto-niveau-huile` (`.svg`, `.webp`), par `tools/build-pictos.cjs` ; le témoin le 30/10, les trois autres le 31/10 |
| Composition pour C1, C2, C3, C4 | shorts | `SequencesCourtes` proposée dans #1936 (`e3d644a04`, brouillon non fusionné) ; absente de `main` |

Images servies le 30/10 (bucket `uploads/articles/gammes-produits/`, contrat `frontend/app/types/r1-images.types.ts`).
Révision 3 : remplacements produits dans `assets/` et décrits slot par slot dans `integration/assets.json` (fichier,
alt, légende, mécanisme existant, état de vérification). Leur mise en ligne n'est pas faite ici : Claude CLI les
raccorde et vérifie le rendu en DEV sans écriture partagée avec la PROD (HANDOFF § 6).

| Image | Emplacement | Constat | Proposition |
|---|---|---|---|
| `r1/filtre-a-huile.webp` | R1 HERO | marque fictive, texte tronqué sur la pièce | remplacé : `assets/r1-hero-filtre-visse-usage.webp` (photo réelle, filtre usagé) ; filtre neuf : PROMPTS.md P-01 |
| `r1/filtre-a-huile-2.webp` | R1 TYPES | vissé et cartouche, cotes et joint torique repérés ; libellé « (SPIN-ON) » | réutilisable en R1 S4 et R3 S1 après retrait de « (SPIN-ON) », anglicisme interdit en R1 |
| `r1/filtre-a-huile-3.webp` | R1 PRICE | fourchettes de prix | remplacement neutre : `assets/r1-price-caracteristiques-qualite.webp` (aucun prix) |
| `r1/filtre-a-huile-4.webp` | R1 LOCATION | « zone basse moteur » sans source ; personnage généré par IA | à désélectionner ; une photo par motorisation seulement (PROMPTS.md P-06) |
| `r1/filtre-a-huile-og.webp` | R1 og:image | « Dès 5€ — Livraison 24h » | remplacement neutre : `assets/r1-og-filtre-a-huile.webp` (aucun prix ni délai) |
| `catalogue/filtre-a-huile.webp` | R3 hero, og:image R3 | source de 225 × 165 px agrandie, floue | `assets/r3-hero-filtre-visse-usage.webp` (ligne d'image R3 12) |
| logos `equipementiers-automobiles/*.webp` | R1 S7 | réels ; WIX FILTERS sans logo (`default.svg`) | réutilisés |
| vignettes `catalogue/*.webp` de la famille Filtres | R1 S8, R3 S7 | habitacle et boîte auto cassées (FH-14) | réutilisées ; habitacle par `pg_img` |
| — | R3 S1, S2, S3, C3 | schéma des clapets absent | schémas de principe livrés : `assets/r3-s2-filtre-colmate-by-pass.webp`, `assets/r3-s3-coupe-filtre-visse.webp`, `assets/r1-types-visse-cartouche.webp` ; WIKI `function_diagram` toujours en DEFERRED |
| — | R3 S2_DIAG, C1 | pictogramme du témoin de pression d'huile absent | livré : `assets/picto-temoin-pression-huile.webp` |

Aperçu de relecture : `preview/`, simulation non intégrée, recette `tools/build-preview.cjs` (ce n'est pas un rendu
DEV).

Raccordements techniques : [HANDOFF.md](HANDOFF.md).

## 8. Annexes

### 8.1 Environnement et traçabilité

| Élément | Constat |
|---|---|
| Isolation | worktree `nestjs-remix-monorepo-editorial`, branche créée depuis `origin/main` `980b2f8a7`, sans suivi distant |
| Fiche WIKI lue | `wiki/gamme/filtre-a-huile.md`, commit `a47833486352626442939dd04b5a6fd3674cb0a7` (promotion #100, 30/09), blob `c0f7a257f58596b55525dd8efe86f16a87235824` ; WIKI `main` `edae4a96` le 30/10 |
| Mode de promotion | `auto_promoted: true`, `validation_mode: automatic`, sans spot-check humain ; `exportable.seo: true` |
| Pages lues | R1, R3, R4, deux pages véhicule Clio III, `/diagnostic-auto`, le 2026-10-30T11:11:37Z ; sha256 du texte R1 `7adaf365…8564`, R3 `231e6692…b4a8`. R1, R3, R4 et la page 19052 relues à 11:47:47Z, après le tag du jour : écarts du § 8.4 inchangés |
| PR #1924 | lue au commit `6ccff0e8`, puis à la tête `3288b50a` (30/10, ouverte, non fusionnée) : depuis `6ccff0e8`, deux fusions de `main` (#1927, #1928, #1929) et des resynchronisations de projections (registre, inventaire PR-8). Aucun fichier de ce dossier touché ; rien fusionné ici |
| Hermes `automecanik_continuity` | indisponible depuis cette session ; checkpoint préparé dans [CHECKPOINT.md](CHECKPOINT.md) |

### 8.2 Search Console

Tables `__seo_gsc_daily_pages` et `__seo_gsc_daily`, filtre `date between '2026-06-01' and '2026-10-29'` ; données
présentes du 2026-06-01 au 2026-10-27. Position moyenne pondérée par les impressions.

| Périmètre (filtre exact) | Requêtes | Clics | Impressions | Position |
|---|---|---|---|---|
| page = `https://www.automecanik.com/pieces/filtre-a-huile-7.html` | — | 0 | 2 322 | 47,0 |
| page like `https://www.automecanik.com/pieces/filtre-a-huile-7/%` (296 pages) | — | 10 | 1 727 | 12,8 |
| page = R3, page = R4 | — | aucune ligne | — | — |
| query ilike `%filtre%huile%` ou `%filtre%a%huile%` | 305 | 9 | 3 954 | 32,5 |
| … dont marque, modèle ou moteur dans la requête | 180 | 5 | 1 156 | 12,4 |
| … dont `correspond`, `equival`, `tableau` | 5 | 0 | 134 | 31,8 |
| … dont `cartouche`, `viss`, `spin` | 3 | 0 | 21 | 49,1 |
| … dont `quand`, `km`, `changer`, `remplac`, `vidange` | 3 | 0 | 3 | 18,0 |
| … dont `voyant`, `pression`, `sympt`, `bouch`, `colmat` | 0 | — | — | — |

Observations : R1 est vue sans être cliquée ; les pages véhicule se positionnent mieux ; R3 et R4 n'apparaissent pas
dans l'export. Hypothèses, non démontrées : les requêtes d'information sont peu visibles parce que R3 et R4 ne se
positionnent pas, pas parce que la demande manque ; la demande de correspondance est réelle mais faible. Aucun gain de
classement ni de ventes n'est promis.

### 8.3 Catalogue (lecture seule, 30/10/2026)

- `pg_id` 7 confirmé (« Filtre à huile ») : 4 223 références affichées sur 22 171 ; 23 marques parmi les affichées ;
  44 338 types rattachés.
- Critère « Type de filtre » : Cartouche 9 912, Vissé 9 085. Autres critères présents : hauteur, diamètre extérieur,
  filetage, pression d'ouverture du by-pass (1 958 pièces), couple de serrage (411), outil spécialisé (795), Version
  (anti-retour, by-pass, joint torique inclus). Leur affichage sur les fiches n'a pas été vérifié.
- Renault Clio III 1.5 dCi : type_id **19052** (86 ch, K9K 766 ; la page affiche 24 références) et **19053**
  (106 ch, K9K 764 / 774 ; 23 références). Les 23 références de 19053 figurent toutes parmi celles de 19052 ; les deux
  types restent distincts. En base : 74 (19052) et 73 (19053) pièces rattachées ont `piece_display` vrai, dont 24 et 23
  seulement portent le critère « Type de filtre » (id 826), toutes « Filtre vissé » ; 8 pièces non affichées
  rattachées à chaque type portent « Cartouche filtrante » (F-C8). Le filtre qui réduit 74 pièces à 24 sur la page
  n'a pas été identifié.
- Huile moteur (`pg_id` 1862) : `pg_display` 0. Pas de gamme « joint de vidange carter ».

### 8.4 Contenu servi : écarts relevés

| Page | Affirmation servie | Constat |
|---|---|---|
| R1 meta | « pas cher dès 5€ », « En stock, livraison 24-48h » | prix et stock : zone STOP, non vérifié, signalé seulement |
| R1 | « les moteurs diesel modernes (1.5 dCi, 1.6 HDI, 2.0 TDI) utilisent majoritairement des filtres cartouche » | contredit par le catalogue pour 19052 et 19053 (vissé) |
| R1 | « le code moteur figure sur votre carte grise (case D.2) » | D.2 = type, variante, version (F-C7) |
| R1 | réduction de « 30 à 50 % » de la durée de vie ; « à chaque vidange, soit entre 15 000 et 30 000 km… ou au minimum une fois par an » | sans source ; retirés de la fiche WIKI |
| R1 | ISO 4548-12 et 4548-1 pour « tous les filtres proposés » ; VW 502.00 et BMW LL-01 présentées comme une certification du filtre | sans source ; 502.00 et LL-01 sont des normes d'huile |
| R1 | prix (« 5 € à 30 € », « 80 et 150 € »), expédition « le jour même avant 15h », « 2 847 diagnostics ce mois » | promesses non vérifiées ; prix hors rôle R1 |
| R1 | vignettes « Filtre d'habitacle » et « Filtre de boîte auto » | objets absents du stockage (`NoSuchKey`), image cassée (FH-14) |
| R3 | procédure de remplacement composée de texte WIX en anglais extrait brut | contenu RAW servi au public |
| R3 | « 10 000 à 30 000 km », « Diesel moderne 15 000-20 000 km », « Longlife jusqu'à 30 000 km » | sans source |
| R3 | liste de symptômes du filtre ; « couper le moteur et vérifier le serrage du filtre » si le voyant reste allumé | attribution non établie |
| R3 | « serrage à la main + 3/4 de tour », « resserrer d'un quart de tour maximum » | valeur propre à chaque filtre (WIX) |
| R4 | liens de symptômes vers `/diagnostic-auto/<texte brut>` | attribution non établie, liens en 404 |
| Pages véhicule | « montées à l'arrière de votre CLIO III » | corrigé sur `main` par #1854 (`3f7771af2`, 21/10), inclus dans le tag `v2026.10.30-bundle-octobre-980b2f8` (11:12Z) ; encore servi à 11:47Z |
| Pages véhicule | équivalences « (Bosch, TRW, Brembo...) » ; title « à partir de 5.00€ » | marques de freinage sur toutes les gammes (code sur `main`) ; prix : zone STOP, signalé seulement |

### 8.5 Lot plaquettes en attente

Commit `2a63da58a` sur `docs/editorial-plaquettes-dossier-20261030`, non poussé, sans PR. Réutilisable plus tard, dans
son périmètre : la méthode G3 (`FORBIDDEN_PATTERNS_SHORT` appliqués ligne à ligne), l'écart de schéma
`approvalRecord.stages`, la contrainte des fenêtres fixes de `PieceExpliquee`. Ses 13 besoins ne sont pas des
prérequis de ce lot.
