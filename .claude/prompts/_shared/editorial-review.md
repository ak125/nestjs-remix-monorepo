# RELECTURE ÉDITORIALE (bloc partagé)

> **Version 1.7.0 — 2026-10-31.** Référence opérationnelle commune à Claude, Codex et Hermes
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
> Pilote 1.2.0 : contrat « Lecture, application et déclaration », après un essai où la
> relecture était déclarée appliquée sur une lecture qui s'arrêtait avant « Sortie attendue ».
> Les résultats d'un essai 1.1.0 ne qualifient pas cette version.
> Pilote 1.3.0 : « Contrôle avant déclaration », jugé sur le contenu de chaque champ, après des
> essais où les noms des champs de sortie étaient remplis d'un résumé. Les résultats d'un essai
> 1.2.0 ne qualifient pas cette version.
> Pilote 1.4.0 : bloc de sortie contrôlable et « Contrôle mécanique », après des essais où
> l'empreinte portait sur une autre représentation du texte, où une liste de changements vide
> n'avait pas de raison et où RE-16 et RE-23 ajoutaient ou retiraient de l'information sous une
> fidélité déclarée inchangée. Les résultats d'un essai 1.3.0 ne qualifient pas cette version.
> Pilote 1.5.0 : bloc final dans tous les états, lecture de chaque fichier exigé jusqu'à sa
> dernière ligne, contrôle mécanique permis sous une consigne sans écriture, original reproduit à
> l'identique et conditions confrontées au bloc écrit, après des essais sans bloc final, des
> lectures arrêtées à une plage fixée d'avance, un contrôle cru interdit par une recette sans
> écriture, un original retouché sans changement déclaré et des conditions déclarées remplies
> contre le bloc. Les résultats d'un essai 1.4.0 ne qualifient pas cette version.
> Pilote 1.6.0 : contrôle mécanique dans tous les états et pour tout verdict, repassé après chaque
> correction, conditions tirées du dernier rapport, original complet tel qu'affiché, champ
> structuré reproduit avec son chemin de clés, sources lues sur leur plage et procédure RE-T1
> position par position, après des essais où le contrôle n'était pas lancé en partielle ni sur un
> verdict bloqué, où le bloc final n'était pas repassé après deux rejets, où un manque gardait la
> cause d'un rapport périmé, où l'original était un résumé ou du texte brut à la place du
> Markdown affiché, où un champ YAML était désigné par une plage fausse, et où la typographie
> était dite conforme malgré des espaces ordinaires aux positions RE-T1. Les résultats d'un
> essai 1.5.0 ne qualifient pas cette version.
> Pilote 1.7.0 : transport JSON explicite des insécables et livraison par le contrôle mécanique,
> après les faux succès typographiques et les contrôles d'une autre sortie observés en round 11.
> Les résultats d'un essai 1.6.0 ne qualifient pas cette version.

## 1. Ce que fait la relecture

Elle prend un brouillon déjà rédigé **à partir de sources** et rend une **proposition** plus
lisible, avec la raison de chaque changement. Elle ne publie rien, ne valide rien, n'écrit ni
dans RAW ni dans WIKI, et ne remplace aucun contrôle existant.

- **Position** : côté consommateur, après la rédaction sourcée, avant la validation finale
  (gate de projection, gates R8, 7 gates `fafa-brand-safety-reviewer`, `v5-guardian`,
  auto-review du circuit). Pour les fiches WIKI, l'auto-review de sens remplace la revue humaine
  selon ADR-119 ; cette relecture éditoriale et son contrôle mécanique ne la remplacent pas.
  Le texte relu repasse par ces contrôles comme s'il était neuf.
- **Une reformulation n'est jamais une source.** Elle ne peut rien apprendre au lecteur que le
  brouillon et ses sources ne disaient pas déjà.
- **L'original reste intact.** La sortie est toujours : original référencé + proposition +
  raisons + signalements de fond (§10).
- **Pas de source identifiable ⇒ pas de relecture** : verdict `BLOQUÉ_SOURCE`. Sans source, on
  ne peut pas vérifier qu'une reformulation est fidèle.

### Lecture, application et déclaration

Lire ce fichier n'est pas appliquer sa méthode. La méthode est appliquée quand ses étapes ont
produit leur trace dans la sortie.

1. **Lire les sections opérantes, en entier, avant de relire** : « Ce que fait la relecture »
   avec ce contrat et son « Contrôle avant déclaration », « Ordre de priorité », « Faits
   protégés », « Champs modifiables et champs protégés » avec « Sources et sortie publique »,
   « Ce que la relecture corrige », « Typographie française », « Ton par format », « Sortie
   attendue » et « Règles de Humanizer écartées ou adaptées ».
   S'y ajoute « Fafa, vidéo et social : aucune invention » pour un script ou une copie sociale.
   Les « Exemples AutoMecanik » et l'« Attribution et licence » sont lus en cas de doute.
2. **Lire les références que le périmètre exige** : les sources du brouillon, sur les plages
   citées dans `sources`, chacune couverte par une lecture déclarée dans `lectures` (export,
   fichier de données ou proposition compris : une source non lue ne se cite pas) ; le miroir `.claude/canon-mirrors/marketing-voice.md` en entier, pas
   seulement ses interdits et ses mentions obligatoires ; `fafa-persona-canon` en entier pour un
   script Fafa.
3. **Consigner les lectures** : pour chaque fichier, les sections lues, désignées par leur titre.
   Si un fichier est lu par morceaux, noter aussi les plages réellement lues. Un fichier cité
   dans une liste de lectures ne prouve ni sa lecture complète ni son application. Une sortie
   d'outil marquée tronquée (« truncated », « tokens truncated ») ne prouve pas la lecture du
   passage coupé : relire ce passage par une lecture bornée (un fichier par commande, par plages
   de lignes) avant de le compter comme lu. Une plage fixée d'avance (`sed -n '1,280p'`, `head`)
   laisse non lu ce qui la suit : poursuivre par plages jusqu'à la dernière ligne du fichier
   avant de relire. Ce fichier se lit seul dans sa commande, jusqu'à « Sortie attendue » et
   au-delà. Une lecture encore possible ne se remplace pas par « relecture partielle ».
4. **Exécuter les étapes**, chacune avec sa trace dans la sortie :
   - identifier l'original et ses sources, sinon `BLOQUÉ_SOURCE` ;
   - délimiter les champs modifiables ;
   - appliquer les règles RE-xx et RE-Tx, chaque changement avec sa règle et sa raison ;
   - relever les signalements de fond ;
   - faire le contrôle de fidélité, catégorie par catégorie ;
   - rendre le verdict.
5. **Déclarer l'état** : écrire « relecture appliquée » seulement si le « Contrôle avant
   déclaration » ci-dessous est rempli et si son contrôle mécanique rend `appliquee` sur la
   sortie livrée, bloc final compris. Sinon, écrire « relecture partielle » et nommer les
   sections non lues, les références manquantes, les étapes non exécutées et les conditions non
   remplies. La règle vaut pour toute mention de la relecture dans la sortie, liste d'étapes et
   résumé compris, et pas seulement pour le bloc final.

La sortie suit « Sortie attendue ». Un champ qui ne peut pas être produit est nommé, avec sa
cause ; il n'est ni omis en silence ni remplacé par un résumé.

### Contrôle avant déclaration

Il se fait sur la sortie écrite, champ par champ, après sa rédaction. Le nom d'un champ ne
remplit aucune condition : seul son contenu compte. Chaque condition se confronte au bloc final
écrit, avec ou sans outil d'exécution : C1 aux `lectures`, où chaque fichier exigé est couvert de
sa ligne 1 à sa dernière ligne (une recherche par motif n'est pas une lecture) ; C3 à C5 à
l'`original` reproduit ou désigné. Sans original établi, C3 à C5 sont non remplies : il n'y a
rien à confronter.

- **C1 Lectures** : chaque section et chaque référence exigées (points 1 et 2) ont été rendues
  en entier ; aucune plage tronquée n'est restée sans relecture bornée.
- **C2 Original** : `original` désigne un texte existant (chemin ou table + identifiant, et plage
  pour un extrait) ou le reproduit en entier ; son sha256 est calculé par un outil sur ces
  octets exacts, avec la convention de fins de ligne et de saut final déclarée.
- **C3 Changements** : chaque entrée cite l'avant exact de l'original, l'après exact de la
  proposition, un code RE-xx ou RE-Tx et sa raison ; rejoués dans l'ordre, ils mènent de
  l'original à la proposition. Sinon, la liste est vide, le verdict est
  `AUCUN_CHANGEMENT_UTILE` avec sa raison écrite et la proposition est identique à l'original.
  Dans les deux cas, aucune position RE-T1 de la proposition ne garde une espace ordinaire
  (§6) : une correction typographique nécessaire et non faite laisse C3 non remplie.
- **C4 Signalements** : chaque entrée a son extrait exact, son type F-x, sa source citée (ou
  « aucune ») et sa formulation sourcée ou `null`. Sinon, la liste est `[]`.
- **C5 Fidélité** : une ligne par catégorie du §3, soit cinq, avec `inchangé` ou l'écart exact,
  établie sur ce que chaque changement retire ou ajoute réellement, pas sur son intention.
- **C6 Verdict** : l'une des quatre valeurs de « Sortie attendue ».
- **C7 Étapes** : chaque étape du point 4 a sa trace ; une étape non exécutée est nommée.

Avec `BLOQUÉ_SOURCE` ou `HORS_PÉRIMÈTRE`, C3 à C5 sont « sans objet », avec leur cause. Un
verdict bloqué ne dispense ni de C1, ni de C2, ni du contrôle mécanique : l'original désigné ou
reproduit doit être exact, même quand sa relecture sort du périmètre. Le
résultat de chaque condition (remplie, ou ce qui manque) est écrit dans `conditions` du bloc
final. « Relecture appliquée » exige C1 à C7 remplies ; sinon, « relecture partielle » avec les
conditions non remplies. Aucune condition ne se remplit par un contenu qui n'a pas eu lieu :
changement, avant, empreinte ou lecture. Un manque nommé vaut mieux qu'un champ fabriqué.

**Contrôle mécanique.** Avec un outil d'exécution, passer la sortie, bloc final compris, sur
l'entrée standard (`printf` ou heredoc, sans écrire de fichier) à
`node <racine du dépôt>/scripts/agents/check-editorial-review.mjs --emit --root <dossier de travail>`,
avec un `--root` de plus par copie de sources lue. Il recalcule l'empreinte, rejoue les
changements jusqu'à la proposition, compare les faits protégés retirés ou ajoutés à la fidélité
déclarée, confronte les plages de lecture aux fichiers et recalcule C1 à C7. Il rend `appliquee`,
`partielle` ou `rejetee`. Une sortie rejetée se corrige sur le fond, jamais en ajustant un champ
pour le satisfaire. Il ne lit que l'entrée standard et les fichiers que le bloc désigne ; il
n'écrit rien et n'accède ni au réseau ni à une base. Une consigne qui interdit d'écrire ou de
lancer une commande qui écrit ne l'interdit donc pas ; seuls l'absence d'outil d'exécution ou
l'interdiction de toute commande l'empêchent. Sans outil d'exécution, la relecture reste
partielle et cette cause est nommée.

Le contrôle se fait dans tous les états, « relecture partielle » comprise, et pour tout verdict,
`BLOQUÉ_SOURCE` et `HORS_PÉRIMÈTRE` compris. Il est repassé après chaque correction de la sortie,
jusqu'au dernier passage : la sortie livrée est exactement la dernière entrée contrôlée, bloc
final compris, sans retouche ensuite. Les `conditions` et leurs `manque` reprennent ce dernier
rapport. Un `manque` nomme sa cause réelle : l'écart que ce rapport relève, ou une limite
effective (pas d'outil d'exécution, toute commande interdite par la demande, échec de l'outil
avec son message). La cause d'un rapport antérieur, que la correction a levée, n'est jamais
reprise. Ne pas lancer le contrôle n'est admis que sur une telle limite, nommée dans `lecture`.

Avec `--emit`, le rapport reste sur stderr et stdout est la réponse complète acceptée, exactement
comme reçue, sans correction ni réécriture. Un rejet ne livre rien sur stdout. Livrer cette sortie
stdout sans la recomposer ; conserver le code 3 d'une partielle. Ne jamais passer uniquement le
bloc final si un brouillon ou d'autres champs ont été écrits avant lui. Une sortie d'outil
tronquée ne permet pas de livrer les octets manquants : réduire le livrable puis contrôler de nouveau.

**Saut final du chat.** Un heredoc ajoute un saut de ligne après sa dernière ligne, alors que
la réponse finale peut se terminer juste après les trois accents graves. Pour cette réponse
sans saut final, retirer ce seul saut **avant** l'entrée du contrôleur, pas après son résultat :

```bash
python3 -c 'import sys; sys.stdout.write(sys.stdin.read().removesuffix("\n"))' <<'RESPONSE' | node <racine>/scripts/agents/check-editorial-review.mjs --emit --root <dossier>
<réponse entière, prose et bloc JSON final compris>
RESPONSE
```

Cette préparation ne change aucun texte interne, aucune insécable, ni le `saut_final` de
l'original : ce champ décrit le brouillon, pas l'enveloppe de la réponse. Un `printf '%s'`
correctement cité, sans saut ajouté, convient aussi. Le contrôle porte ainsi sur les mêmes
octets que la réponse finale, y compris sa terminaison.

Le validateur du circuit relance ce contrôle sur la sortie reçue : une déclaration qu'il
ne confirme pas est traitée comme « relecture partielle » ou rejetée. Il ne juge ni la
pertinence d'une règle RE ni la fidélité de sens, et ne voit pas la trace des lectures : ces
points restent au contrôle du contenu.

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
  Procédure : relever dans la proposition chaque position, une par une (chaque « ; : ! ? »
  précédé d'une espace, chaque guillemet « et », chaque nombre suivi d'une unité, chaque nombre
  de plus de trois chiffres groupés), et vérifier que l'espace y est insécable (U+00A0 ou
  U+202F). Une espace ordinaire à l'une de ces positions est un changement RE-T1 de l'original
  vers la proposition. La typographie n'est jamais dite conforme sans ce relevé. Les intertitres,
  les tableaux, le code et les URL gardent leur typographie : un défaut s'y signale, il ne s'y
  corrige pas.
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
  modifié. Un brouillon rédigé dans la session, sans fichier, est reproduit ici en entier,
  séparé de la proposition, octet pour octet tel que la réponse l'affiche : aucune espace
  insécable, apostrophe ou guillemet n'y est ajouté ni retiré. L'original est le brouillon livré
  entier, intertitres, listes, gras et autres balises Markdown compris, dans l'ordre affiché ; un
  résumé, un extrait ou une version en texte brut d'un brouillon affiché en Markdown n'est pas
  l'original. Une correction typographique est
  un changement RE-Tx de l'original vers la proposition. Reproduire n'exige aucun outil ; sans
  outil, seul `sha256` reste `null`. Le sha256 est calculé par un outil sur ce texte exact, jamais
  recopié ni estimé ; s'il ne peut pas l'être, le manque est nommé et la relecture est partielle.
- **`proposition`** : le texte complet proposé, sans références de recherche ni annotations
  internes (§4.1). Son statut de brouillon et ses limites figurent dans la revue séparée.
  Dans le JSON, écrire les insécables sous forme d'échappements `\u00a0` ou `\u202f` :
  `"Attention\u00a0: huile chaude."`. JSON.parse les décode en caractères insécables réels.
  Une seule barre oblique inverse, jamais `"Attention\\u00a0: huile chaude."`, qui insère six
  caractères visibles. Même transport dans `changements[].apres` et les autres chaînes qui
  contiennent une insécable. Ne jamais remplacer les espaces ordinaires de l'original : son
  texte et son empreinte restent ceux du brouillon, et chaque correction est déclarée.
- **`changements`** : la liste `{avant, après, règle, raison}`, avec un code de règle RE-xx ou
  RE-Tx. Une entrée par changement : `avant` cite l'original mot pour mot et `après` la
  proposition. Une phrase de synthèse ou une liste de codes n'est pas une entrée. Les
  corrections RE-Tx d'un même segment peuvent former une seule entrée, `avant` et `après` étant
  ce segment entier, s'il ne porte aucun autre changement ; les entrées ne se chevauchent pas.
  Liste vide seulement avec `AUCUN_CHANGEMENT_UTILE`, `BLOQUÉ_SOURCE` ou `HORS_PÉRIMÈTRE`, et sa
  raison ; `AUCUN_CHANGEMENT_UTILE` suppose qu'aucune position RE-T1 ne reste à corriger (§6).
- **`signalements_de_fond`** : la liste `{extrait, type, source citée, formulation sourcée
  proposée ou null}`, ou `[]` s'il n'y en a aucun. Ces signalements ne sont jamais appliqués
  dans la proposition. Types :
  - F-1 contradiction avec la source ;
  - F-2 affirmation sans source ;
  - F-3 incohérence interne ;
  - F-4 promesse commerciale ou mention obligatoire ;
  - F-5 expérience ou témoignage inventé ;
  - F-6 conflit de ton non tranché.
- **`controle_fidelite`** : une ligne par catégorie du §3, `inchangé` ou l'écart exact. Consigner
  tout déplacement d'attribution prévu au §4.1 et son emplacement interne ; il ne permet
  aucun changement de fait, de portée ou de mention obligatoire. Tout autre écart non
  expliqué par une règle RE-Tx est une **altération critique**, et la proposition est alors
  **rejetée**. Une nouvelle génération ne l'efface pas du relevé.
- **`verdict`** : `PROPOSITION`, `AUCUN_CHANGEMENT_UTILE`, `BLOQUÉ_SOURCE` ou `HORS_PÉRIMÈTRE`.
  Jamais « publié », « validé » ni « opérationnel ».
- **`lecture`** : pour chaque fichier, son chemin, les sections lues par leur titre et les
  plages réellement rendues ; les références consultées ; les étapes exécutées et non
  exécutées ; le résultat de C1 à C7 ; puis « relecture appliquée » ou « relecture partielle »
  avec ce qui manque (« Contrôle avant déclaration »).

**Bloc final.** Dès qu'une relecture est faite ou mentionnée, la sortie se termine par un seul
bloc ```` ```json ```` qui reprend ces champs sous une forme contrôlable, dans tous les états,
« relecture partielle » comprise, et même quand le livrable demandé a un autre format : le bloc
suit ce livrable. La prose peut présenter ces champs, sans les contredire :

```json
{
  "contrat": "editorial-review", "version": "1.7.0", "etat_declare": "partielle",
  "lectures": [{"chemin": "…", "plages": ["1-120"], "masquees": [], "sections": ["…"], "tronque": false}],
  "relectures": [{
    "id": "plan-r3", "format": "prose", "sources": ["chemin/de/la/source.md:10-40"],
    "original": {"texte": "…", "fins_de_ligne": "LF", "saut_final": false, "sha256": null,
                 "provenance": {"chemin": "…", "lignes": "161-166", "champ": "…"}},
    "proposition": "…",
    "changements": [{"avant": "…", "apres": "…", "regle": "RE-10", "raison": "…"}],
    "raison_aucun_changement": null,
    "signalements_de_fond": [{"extrait": "…", "type": "F-2", "source": "aucune", "formulation": null}],
    "controle_fidelite": {"references_identifiants": "inchangé", "nombres_unites": "inchangé",
      "normes_intervalles_commerce": "inchangé", "provenance_certitude": "inchangé",
      "conditions_negations": "inchangé"},
    "verdict": "PROPOSITION",
    "etapes": {"identifier_original": {"executee": true, "trace": "…"}, "delimiter_champs": {},
      "appliquer_regles": {}, "relever_signalements": {}, "controle_fidelite": {}, "rendre_verdict": {}}
  }],
  "conditions": {"C1": {"etat": "remplie"}, "C2": {"etat": "non_remplie", "manque": "…"}}
}
```

- `lectures` : une entrée par fichier lu ; `chemin` absolu ou relatif au dossier de travail, sans
  alias ni abréviation ; `plages` en numéros de ligne du fichier, `masquees`
  pour ce qu'un outil a coupé et qui n'a pas été relu. `tronque: true` sans `masquees` ne compte
  rien comme lu.
- `original` : reproduit (`texte`, `fins_de_ligne` `LF` ou `CRLF`, `saut_final`, `provenance`
  facultative) ou désigné (`chemin`, `lignes`, sans `texte`) ; `sha256` porte sur les octets UTF-8
  du texte reproduit selon cette convention, ou sur les lignes désignées avec leurs fins de
  ligne. Une plage désignée est celle qu'une lecture déclarée a rendue. Un champ d'un fichier
  YAML, JSON ou d'un frontmatter n'est jamais seulement désigné : il est reproduit, avec
  `provenance.chemin`, `provenance.lignes` (les lignes du champ) et `provenance.champ`, son chemin
  de clés depuis la racine du document (par exemple
  `entity_data.editorial.selection_criteria.content_md`). Sans outil, `sha256` vaut `null` et C2 est non remplie.
- `changements` : appliqués dans l'ordre, chaque `avant` apparaît une seule fois dans le texte
  courant ; espaces et retours à la ligne mis à part, le résultat est la proposition. Une
  suppression a `"apres": ""`. Une liste vide a sa `raison_aucun_changement`.
- `signalements_de_fond` : `extrait` vient de l'original (`null` seulement pour une mention
  obligatoire manquante, F-4) et reste dans la proposition, sauf suppression permise au §3.
- `etapes` : les six étapes du point 4, chacune `{"executee": true, "trace": …}` ou
  `{"executee": false, "cause": …}`.
- `conditions` : C1 à C7, chacune `remplie`, `non_remplie` avec `manque`, ou `sans_objet` avec
  `cause` (C3 à C5, `BLOQUÉ_SOURCE` ou `HORS_PÉRIMÈTRE`).

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
