# RELECTURE ÉDITORIALE (bloc partagé)

> **Version 1.1.0 — 2026-10-30.** Référence opérationnelle commune à Claude, Codex et Hermes
> pour relire un brouillon français AutoMecanik. **Non canon** : en cas de conflit, le canon du
> vault prime (`rules-marketing-voice`, miroir `.claude/canon-mirrors/marketing-voice.md` ;
> ADR-031, ADR-046, ADR-086), puis l'état réel du dépôt. Ce fichier pointe vers le canon, il ne
> le recopie pas. Département propriétaire : `content` (n° 6, « Contenu éditorial »,
> `.spec/00-canon/ai-registry/agent-operating-map.yaml`).
>
> Toute modification d'une règle change la version et ouvre une nouvelle version de pilote.
> Une règle modifiée pendant un essai invalide l'essai.
> Pilote 1.1.0 : séparation des sources internes et du texte public, selon le mandat
> utilisateur du 30 octobre. Les résultats d'un essai 1.0.0 ne qualifient pas cette version.

## 1. Ce que fait la relecture

Elle prend un brouillon déjà rédigé **à partir de sources** et rend une **proposition** plus
lisible, avec la raison de chaque changement. Elle ne publie rien, ne valide rien, n'écrit ni
dans RAW ni dans WIKI, et ne remplace aucun contrôle existant.

- **Position** : côté consommateur, après la rédaction sourcée, avant la validation finale
  (gate de projection, gates R8, 7 gates `fafa-brand-safety-reviewer`, `v5-guardian`,
  validation humaine). Le texte relu repasse par ces contrôles comme s'il était neuf.
- **Une reformulation n'est jamais une source.** Elle ne peut rien apprendre au lecteur que le
  brouillon et ses sources ne disaient pas déjà.
- **L'original reste intact.** La sortie est toujours : original référencé + proposition +
  raisons + signalements de fond (§10).
- **Pas de source identifiable ⇒ pas de relecture** : verdict `BLOQUÉ_SOURCE`. Sans source, on
  ne peut pas vérifier qu'une reformulation est fidèle.

## 2. Ordre de priorité

En cas de tension, la règle du rang le plus haut l'emporte :

1. les faits et la sécurité commerciale ;
2. le périmètre autorisé (champs modifiables, §4) ;
3. l'utilité pour le lecteur ;
4. le français et la voix du média ;
5. les préférences de style (§5).

Une règle de style ne justifie jamais une perte d'information.

## 3. Faits protégés

La relecture ne modifie pas, ne retire pas et n'ajoute pas :

- références de pièces, identifiants, motorisations, codes moteur, désignations (« 1.2 16V »
  reste « 1.2 16V »), années, compatibilités ;
- nombres, unités, tolérances, plages, conditions de mesure : aucune conversion, aucun arrondi,
  aucune précision changée (« 12,70 » reste « 12,70 », « plus de 3 000 » ne devient pas
  « 3 000 ») ;
- normes, intervalles, quantités, prix datés, conditions commerciales, mentions obligatoires
  (miroir `marketing-voice.md`, « Obligatoires ») ;
- citations et provenance conservées dans le dossier interne (§4.1), dates, degré de certitude ;
- conditions, négations, exclusions et ordre des vérifications.

**Altération critique** : tout écart sur l'un de ces points. Retirer une condition, élargir une
compatibilité, renforcer ou affaiblir une certitude, ou changer un nombre en est une.

**Diagnostic.** Garder distinctes l'hypothèse, la vérification et la panne confirmée. Conserver
les précautions, les critères d'arrêt et les conditions de remplacement. Ne jamais toucher à
l'arbre de décision ni aux règles de recommandation de pièce.

**Données structurées.** Un tableau de caractéristiques, une liste de libellés venue de la base
ou un bloc généré par gabarit sont des données, pas de la prose. On ne les réécrit pas dans la
page : un défaut s'y signale à sa source (générateur, table), §10.

**Brouillon contraire à ses sources.** On ne corrige pas en silence. La phrase concernée reste
**telle quelle** dans la proposition (« phrase gelée »). Le problème part en signalement de fond,
avec la citation de la source et, si possible, une formulation sourcée que le validateur pourra
reprendre.

**Suppression permise, toujours signalée** : une expérience, un essai, un client, un témoignage
ou un superlatif inventés. Jamais une précaution, une condition, une négation ni un avertissement
de sécurité, même sans source : ceux-là se signalent.

## 4. Champs modifiables et champs protégés

**Modifiable par défaut** : la prose rédigée (paragraphes, phrases d'introduction, réponses de
FAQ, `script_voice` d'un script Fafa).

**Protégé par défaut** :

- URL legacy, slugs, identifiants, liens et leurs cibles, paramètres de suivi ;
- H1, `title`, meta description, intertitres. Une proposition d'intertitre est signalée, pas
  appliquée. Le title et la meta description exigent une **inclusion explicite** dans la demande,
  et des tests. Sur R1, `sg_title_draft` et `sg_descrip_draft` remplacent la version publiée
  dès la lecture : ce sont des champs servis, que la relecture n'écrit jamais ;
- métadonnées techniques, code, frontmatter, données structurées (JSON-LD, tableaux, champs
  JSON), noms propres, citations ;
- script Fafa : `cta`, `disclaimer` et signature sont protégés ; pour `hook`, `hook_variants` et
  `screen_text`, les propositions sont seulement signalées (l'owner a déjà choisi l'accroche).

### 4.1 Sources et sortie publique

Les pages, scripts, sous-titres, légendes et aperçus destinés au visiteur ne nomment
ni ne lient les sources de recherche ou d'inspiration. La traçabilité reste complète
dans le dossier interne : source, passage utilisé, portée, date et statut d'admission.
Les étiquettes par phrase (`admis`, `catalogue`, `éditorial`, `candidat`), les claims
et le journal de relecture appartiennent aussi à ce dossier, pas au texte client.
La présentation de revue identifie le brouillon et ses limites séparément de ce texte.

Dans la proposition publique, déplacer une attribution de recherche vers le dossier
interne est permis et consigné ; l'original reste intact. Ce déplacement n'autorise
aucune altération du fait ni de sa portée : ne pas transformer l'avis d'une source
ou une consigne propre à un véhicule en vérité générale. Si la suppression de
l'attribution change le sens, conserver la phrase gelée et sa source dans la revue
interne (§3), hors de l'aperçu client jusqu'à une formulation validée. Le bloc qui
en dépend reste non admissible ; signaler son absence dans la présentation de revue,
sans supprimer une condition ou une précaution pour faire paraître la page complète.

Préserver les marques, modèles, motorisations et références nécessaires à la
compatibilité ou à la description du produit. Cette règle ne retire ni mention
obligatoire ni attribution exigée par les droits d'un asset ; si cette attribution
est incompatible avec le brief, choisir un autre asset admissible. Elle ne masque
pas les précautions et ne convertit pas une proposition en contenu validé.

## 5. Ce que la relecture corrige

Ces règles sont adaptées de Humanizer v3.1.0 (attribution §12). Le numéro H§ renvoie à sa
section d'origine. **Agit seul** : un seul repérage suffit. **Faible seul** : n'agir que s'il y a
plusieurs signes, ou une gêne réelle de lecture. Chaque règle a son cas « garder ».

### Mise en scène

- **RE-01 Contraste fabriqué** (H§1, §5). « Ce n'est pas X, c'est Y », « pas seulement X, mais
  Y », quand personne n'a soutenu X. *Agit seul.* Garder une négation qui apporte une
  information : « Un symptôme seul ne désigne pas le filtre à huile. »
- **RE-02 Chute en une ligne** (H§2). « Le résultat ? Un moteur protégé. », « Tout simplement. »,
  ou une phrase qui redit ce que l'exemple vient de montrer. *Agit seul.*
- **RE-03 Maxime** (H§3). « La prévention, c'est la clé. » *Agit seul.*
- **RE-04 Préambule** (H§4, et les introductions inutiles). « Voyons ensemble… », « Voici ce
  qu'il faut savoir : », « Vous vous demandez sûrement… ». *Agit seul.*

### Rythme

- **RE-05 Triade réflexe** (H§6). Trois éléments posés par réflexe et non par la source. Jamais
  retirer un élément sourcé pour casser une triade. Garder : « le papier filtrant, le clapet
  de dérivation (by-pass) et le clapet anti-retour ». La source reste dans le dossier interne.
- **RE-06 Débuts répétés** (H§7), en prose seulement. Les listes de symptômes et les étapes
  numérotées gardent leur parallélisme.
- **RE-07 Réserves empilées** (H§9). *Faible seul.* Ne retirer qu'une réserve sans fondement
  dans la source. Une réserve qui porte le degré de certitude (« peut », « hypothèse non
  établie », « selon le moteur ») est un fait protégé.
- **RE-08 Tirets en tic** (H§8, adaptée). *Faible seul.* On ne remplace que les tirets qui se
  substituent par réflexe à toute ponctuation, plusieurs fois par paragraphe. Le tiret d'incise
  français, le tiret de liste après un libellé et le tiret des plages (« 2005–2010 ») restent.
- **RE-09 Passif sans acteur** (H§11). *Faible seul.* La tournure impersonnelle est normale en
  français technique. Ne jamais inventer un acteur que la source ne nomme pas.
- **RE-23 Répétition.** Une information redite d'une phrase ou d'une section à l'autre sans rien
  ajouter. Supprimer la redite, pas l'information.

### Enflure

- **RE-10 Mots d'apparat** (H§12, liste française). « crucial », « essentiel », « incontournable »,
  « véritable », « optimal », « idéal », « parfait », « pièce maîtresse », « joue un rôle clé »,
  « au cœur de », « témoigne de », « révolutionnaire ». Remplacer par le mot simple, ou supprimer.
  Ne jamais remplacer par une précision absente de la source.
- **RE-11 Importance gonflée** (H§13). « un élément essentiel au bon fonctionnement de votre
  véhicule ». Dire ce que fait la pièce, si la source le dit.
- **RE-12 Association vague** (H§14). « lié à », « en lien avec », sans relation précise. Garder
  seulement si la source précise la relation.
- **RE-13 Participe de commentaire** (H§15). « …, garantissant ainsi une longévité accrue ».
  Supprimer le commentaire, ou en faire une phrase si la source le porte.
- **RE-14 Langage commercial et superlatif non sourcé** (H§16). Les interdits du miroir
  `marketing-voice.md` s'appliquent tels quels.
- **RE-15 Autorité vague** (H§17). « les experts recommandent », « selon les spécialistes »,
  « de nombreux mécaniciens ». Si le fait est sourcé, retirer l'autorité vague de la
  proposition publique et consigner la source dans le dossier interne (§4.1), sans
  changer la portée du fait. Ne pas la remplacer par le nom de la source. Sans preuve
  identifiable, signaler l'affirmation (F-2) ; une suppression de style ne la valide pas.
- **RE-16 Détour autour de « est » et « a »** (H§18). « se positionne comme », « s'impose
  comme », « constitue », « dispose de ». Revenir à « est » ou à « a » quand le sens est le
  même.

### Mise en forme

- **RE-17 Gras décoratif** (H§19). Retirer le gras posé sur des mots courants dans un paragraphe.
  Le gras d'un libellé en tête d'élément de liste reste : c'est le style des fiches validées.
- **RE-18 Intertitre décoratif** (H§20). Signalé seulement, puisque les intertitres sont
  protégés (§4).

### Restes de génération

- **RE-19 Résidu de conversation** (H§22). « Bien sûr ! », « J'espère que cela vous aide »,
  « N'hésitez pas à… ». *Agit seul.*
- **RE-20 Avertissement de modèle** (H§23). « À ma connaissance », « selon les informations
  disponibles ». *Agit seul.* Une limite réelle et sourcée reste : « Aucune valeur de pression
  d'ouverture du by-pass n'est donnée ici : elle dépend du moteur. »
- **RE-21 Titre répété en première phrase** (H§24).
- **RE-22 Texte qui parle de lui-même** (H§25). « Dans cet article, nous allons voir… ».
  *Faible seul.* Une phrase qui donne au lecteur une limite du document reste : « Cette fiche ne
  donne pas de durée ni de kilométrage valables pour tous les véhicules. »

**Terminologie.** Une pièce ou un organe garde le même nom d'un bout à l'autre. La consigne G2
« varier le vocabulaire » de `quality-constraints.md` porte sur les angles et les sections,
jamais sur les termes techniques.

## 6. Typographie française

- **RE-T1** Espace insécable avant « ; : ! ? », à l'intérieur des guillemets, entre un nombre et
  son unité (« 3 mm ») et dans les milliers (« 1 090 kg »).
- **RE-T2** Guillemets français « » ; guillemets anglais seulement à l'intérieur d'une citation.
- **RE-T3** Accents, y compris sur les capitales (« État », « À »). Dans un libellé venu de la
  base, le défaut se signale à la source (§3).
- **RE-T4** Notation d'unité (« cm3 » → « cm³ », « Nm » → « N·m ») seulement dans la prose, si
  la valeur et l'unité restent identiques, et toujours listée dans les raisons. Jamais dans un
  tableau de données ni dans une désignation.
- **RE-T5** Une seule forme d'apostrophe par texte. Les fiches validées utilisent l'apostrophe
  droite.

Les tableaux, les listes de symptômes, les étapes numérotées et les intertitres utiles restent.
Les triades, les tirets, les citations et les emojis ne sont pas interdits par principe.

## 7. Ton par format

| Format | Ton | Fondement |
|---|---|---|
| Fiche, guide, page R1/R3/R4/R8 | neutre, informatif, impersonnel ou vouvoiement | ADR-086, fiches WIKI validées |
| Script parlé Fafa | tutoiement, phrases courtes, IA assumée | `fafa-persona-canon` (persona V1 figée) |
| Copie e-commerce et social | vouvoiement, pédagogique et accessible | miroir `marketing-voice.md` |

**Conflits de tutoiement connus, que la relecture signale sans les trancher** (décision owner ou
canon) :

- le script `fafa-plaquettes-frein-001`, en « tu », a un disclaimer en « vous » ;
- `brand-rules-seed.ts` impose le « tu » sur Instagram, alors que le canon dit « vous ».

## 8. Fafa, vidéo et social : aucune invention

Aucun essai, client, atelier, témoignage, expérience vécue ni savoir-faire personnel inventé
(« j'ai vu », « mes clients », « dans mon garage », « je l'ai testé »). Cela découle du canon
existant :

- Fafa est un mécano IA, toujours présenté comme tel (`fafa-persona-canon`, G6) ;
- tout chiffre et toute affirmation doivent être vérifiables (miroir `marketing-voice.md`,
  « Sourcing factuel »).

La relecture n'ajoute jamais une anecdote, une réaction ou une opinion pour « humaniser » un
texte. La section « Voice » de Humanizer est écartée pour cette raison.

## 9. Exemples AutoMecanik (aucun fait ajouté)

Les phrases « après » viennent de la fiche WIKI validée `wiki/gamme/filtre-a-huile.md`, du
script Fafa `fafa-plaquettes-frein-001` ou d'un brouillon R8 réel. Les phrases « avant » sont
construites pour montrer le défaut.

**E1 — Enflure et autorité vague (RE-10, RE-11, RE-15), avec un segment gelé**

- Avant : « Véritable pièce maîtresse du moteur, le filtre à huile joue un rôle crucial. Selon
  les experts, il empêche les impuretés d'entrer dans le circuit de lubrification, garantissant
  ainsi la qualité de l'huile et les performances du moteur. »
- Proposition : « Le filtre à huile empêche les impuretés d'entrer dans le circuit de
  lubrification, garantissant ainsi la qualité de l'huile et les performances du
  moteur. » Le segment « garantissant ainsi… » est gelé.
- Dossier interne : MAHLE figure dans les sources du brouillon ; cette attribution
  n'est pas ajoutée à la proposition publique.
- Signalement F-1 : la source dit « aide à préserver », le brouillon dit « garantissant ». La
  relecture ne corrige pas le verbe, et RE-13 ne s'applique donc pas à ce segment. La
  formulation sourcée est proposée au validateur.

**E2 — Diagnostic : la certitude ne se corrige pas sous couvert de style (RE-19, RE-04)**

- Avant : « Bien sûr ! Voici ce qu'il faut savoir. Le coupable est tout trouvé : un filtre à
  huile colmaté fait perdre de la puissance. »
- Proposition : « Le coupable est tout trouvé : un filtre à huile colmaté fait perdre de la
  puissance. » (phrase gelée)
- Signalement F-1 : la fiche classe la perte de puissance en « hypothèse non établie » et
  précise : « Ce mécanisme ne prouve pas qu'un filtre soit la cause d'une perte de puissance :
  faire établir un diagnostic avant de remplacer une pièce. »

**E3 — Ce qui ne se corrige pas (faux positifs)**

- « Un symptôme seul ne désigne pas le filtre à huile. » : négation informative (pas RE-01).
- « le papier filtrant, le clapet de dérivation (by-pass) et le clapet anti-retour » : triade
  sourcée (pas RE-05).
- « **Clapet anti-retour** — le plus souvent une membrane en caoutchouc… » : libellé en gras et
  tiret de liste validés (pas RE-17, pas RE-08).
- « Cette fiche ne donne pas de durée ni de kilométrage valables pour tous les véhicules. » :
  limite réelle (pas RE-22).

**E4 — Script Fafa : tutoiement, aucune expérience inventée**

- Avant : « Franchement, dans mon atelier je vois cette erreur tous les jours. Même modèle de
  voiture, ça ne veut pas dire mêmes plaquettes. »
- Proposition : « Même modèle de voiture, ça ne veut pas dire mêmes plaquettes. »
- Signalement F-5 : l'atelier et la fréquence « tous les jours » sont inventés. Fafa est une IA
  assumée, et rien ne les source.

**E5 — Brouillon R8 réel : données protégées, défauts signalés**

- « La RENAULT CLIO III 1.2 16V (Phase 2) 103 ch (Essence) est produite de 2010 à 2014. » : rien
  à changer. « 1.2 » est une désignation, pas un nombre décimal à franciser.
- Tableau « Couple | 200 Nm à 1 900 trs/min » : aucune modification dans la page.
  - La notation « trs/min » se signale au générateur.
  - L'incohérence entre « 1.2 16V » essence d'un côté, et « 1 461 cm3 », « 200 Nm », « 3,70 l /
    100 km » de l'autre, part en F-3. Aucune valeur n'est devinée.
- « Toutes les pièces sont garanties et expédiées sous 24-48h. » : condition commerciale
  protégée. Elle part en F-4 (promesse non vérifiée par la relecture, livraison hors rôle R8).

## 10. Sortie attendue

Pour chaque brouillon :

- **`original`** : chemin ou table + identifiant, et sha256 du texte relu. Il n'est jamais
  modifié.
- **`proposition`** : le texte complet proposé, sans références de recherche ni annotations
  internes (§4.1). Son statut de brouillon et ses limites figurent dans la revue séparée.
- **`changements`** : la liste `{avant, après, règle, raison}`, avec un code de règle RE-xx ou
  RE-Tx.
- **`signalements_de_fond`** : la liste `{extrait, type, source citée, formulation sourcée
  proposée ou null}`. Ces signalements ne sont jamais appliqués dans la proposition. Types :
  - F-1 contradiction avec la source ;
  - F-2 affirmation sans source ;
  - F-3 incohérence interne ;
  - F-4 promesse commerciale ou mention obligatoire ;
  - F-5 expérience ou témoignage inventé ;
  - F-6 conflit de ton non tranché.
- **`controle_fidelite`** : pour chaque catégorie du §3, `inchangé` ou l'écart exact. Consigner
  tout déplacement d'attribution prévu au §4.1 et son emplacement interne ; il ne permet
  aucun changement de fait, de portée ou de mention obligatoire. Tout autre écart non
  expliqué par une règle RE-Tx est une **altération critique**, et la proposition est alors
  **rejetée**. Une nouvelle génération ne l'efface pas du relevé.
- **`verdict`** : `PROPOSITION`, `AUCUN_CHANGEMENT_UTILE`, `BLOQUÉ_SOURCE` ou `HORS_PÉRIMÈTRE`.
  Jamais « publié », « validé » ni « opérationnel ».

Une proposition sans altération critique n'est pas acceptée pour autant : elle va au validateur
du circuit concerné (§1).

## 11. Règles de Humanizer écartées ou adaptées

| H§ | Décision | Raison |
|---|---|---|
| 8 tirets | adaptée (RE-08) | le tiret d'incise et le tiret de plage sont du français correct ; les supprimer altère les plages |
| 10 traits d'union | écartée | règle propre à l'anglais |
| 12, 18 listes de mots | adaptées (RE-10, RE-16) | listes anglaises non transposables ; seule l'idée est reprise |
| 21 guillemets droits | écartée | contraire à la typographie française (RE-T2) |
| 26 mauvais lecteur | écartée | vise les réponses dans un fil, pas un texte publié |
| Voice | écartée | invite à ajouter réactions et opinions : contraire au §8 |
| Exemples | aucun repris | 14 sections sur 26 montrent un « après » qui ajoute, retire ou déplace une information ; aucun n'est repris |

Le « 16/16 » souvent cité vient d'un petit banc d'essai jugé par des LLM. Il ne porte pas sur
v3.1.0 mais sur Humanizer v2.8.0, intégré à l'outil humanist. Il ne mesure ni une préférence
humaine, ni un effet SEO, et ses juges ne voient pas si un détail est inventé. Il ne fonde aucune
règle ici.

## 12. Attribution et licence

Les règles RE-01 à RE-22 adaptent, en français, des motifs de **Humanizer v3.1.0**
(https://github.com/blader/humanizer, tag `v3.1.0`, commit
`225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8`), lui-même tiré de l'article Wikipédia (en anglais)
« Signs of AI writing ». Aucun texte ni exemple n'est recopié.

```
MIT License

Copyright (c) 2025 Siqi Chen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
