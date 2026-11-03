---
owner: "@ak125"
domain: D15
date: "2026-10-31"
---

# PR 1924 — correction et qualification E9

Périmètre : raccordement de la relecture éditoriale dans les sessions natives, sans
écriture de contenu, accès réseau ou base dans les recettes. Aucun déploiement, fusion,
changement du lecteur Hermes ou mission déléguée. Les checkouts existants sont conservés.

## Correctif

Le commit `44579ebfa321dc47e0bc01cf900b9e198e5ecedd` ajoute au contrôleur
`scripts/agents/check-editorial-review.mjs` :

- `--emit` : la réponse complète acceptée est livrée inchangée sur stdout ; le rapport est
  séparé sur stderr. Un rejet ne livre rien ; une partielle garde le code 3.
- Drainage des sorties avant la fin du processus. Le test d'une réponse dépassant la capacité
  d'un pipe reproduit une troncature avec l'ancien `process.exit()`.
- Résolution des références sous Windows avec les séparateurs natifs.

Le contrat partagé 1.7.0 impose les insécables JSON `\u00a0` / `\u202f`, sans normaliser
l'original ni son empreinte. Il donne un pipeline retirant le seul LF ajouté par le heredoc
**avant** le contrôle, afin que l'entrée et la réponse finale aient les mêmes octets.

Un complément au diagnostic C3 rappelle, au point du rejet RE-T1, de conserver l'original,
son sha256 et sa ponctuation, et de corriger la proposition avec des changements déclarés.
Il ne relâche aucune condition et ne réécrit aucun texte.

## Tests isolés et CI

- Linux : 60 tests sur 60, sans skip, après le correctif et après le complément C3.
- Rouge avant `--emit` : 55/58 ; rouge avant drainage : 59/60. Les entrées rejetées et le bloc
  final seul restent rejetés ; un RE-T1 doublement échappé reste rejeté.
- Windows : 59/60 ; seul le test préexistant de lien symbolique échoue avec EPERM de l'OS.
  Aucun skip ou changement de permissions introduit.
- Validateur d'instructions : 20 autotests ; validation globale sans blocage (3 avertissements).
- CI sur `44579ebfa` : validation AGENTS/editorial, tests backend/frontend, TypeScript,
  ESLint, build, sécurité et CodeQL verts. DoD7 reste ouvert. La fraîcheur des projections
  a demandé une régénération native, consignée dans le commit suivant.

Commandes ciblées :

```bash
node --test scripts/agents/check-editorial-review.test.mjs
node scripts/agents/check-editorial-review.mjs --json --root <checkout> --root <snapshot-wiki> --root <snapshot-raw> <sortie-native>
```

## Recettes natives, critères inchangés

Les critères E9a–d des rounds précédents et les prompts R2 ont été fixés avant chaque cycle.
Environnement DEV Linux, Codex CLI 0.144.4 (`exec`, sandbox read-only, sessions éphémères),
Claude Code 2.1.311 (Read/Grep/Glob/Skill autorisés, Bash/écritures/réseau interdits).
Empreinte du fichier de prompts :
`2bc1c68e9ee94fec8aa45764920922dd655c36baa0c0a35d5c49203bc4982896`.
Sources figées : WIKI `edae4a966c688bea9da08476ff9f8b4ead04793c`, RAW
`2c6a242e3938a12163bc747df805df60714a287a`.

Les contrôles indépendants confrontent la réponse entière, les originaux affichés, les
changements, les lectures réellement rendues et les sources ; ils ne se limitent pas à
relancer le contrôleur. Le stdin du dernier contrôle est extrait de la commande native, en
respectant son pipeline, puis comparé octet pour octet au fichier final, sans normalisation.

| Cycle | Observation | Verdict conservé |
|---|---|---|
| R12, Codex racine/seo/wiki | Contrôles indépendants 0 ; dernier LF différent entre heredoc et réponse finale | Échec E9c, aucune fermeture sur cette base |
| R12, Claude racine/seo sans Bash | Contrat/références lus ; originaux complets ; hash null et absence d'exécution nommés ; aucun RE-T1 non fait présenté comme conforme | Partielles honnêtes, contrôles indépendants 3 |
| R13, Codex racine | 13 357 octets livrés = stdin accepté ; lectures et hash observés ; contrôle indépendant 0 | E9 rempli dans ce parcours |
| R13, Codex seo | Rejet de 6 positions RE-T1 ; l'agent remplace ensuite l'original sans changements déclarés, malgré un dernier contrôle 0 et une livraison exacte | Échec E9d ; un contrôle 0 ne suffit pas |
| R13, Codex wiki | Contrôle 0, livraison exacte ; diagnostic copié 20 secondes avant la fin de l'essai | Non retenu comme essai figé, rejoué R14 |
| R14, Codex seo | Premier rejet d'une position RE-T1 ; original et sha conservés ; correction déclarée `huile ? Moi` → `huile\u00a0? Moi` ; 13 623 octets finaux = dernier stdin accepté ; indépendant 0 | E9 rempli, correction typographique réellement exercée |
| R14, Codex wiki | Premier rejet RE-T1 avant les deux-points ; champ YAML original et sha conservés ; correction déclarée ; 7 691 octets = dernier stdin accepté ; indépendant 0 ; F-2 reste signalé | E9 rempli, fidélité et limites de source conservées |

R13 porte sur `44579ebfa`. R14 porte sur ce même commit avec le seul diagnostic C3 complémentaire.
Les sources de R14 sont contrôlées par empreinte avant et après. Les lectures positives et
la livraison de racine R13 sont réutilisées : le complément ne change que le diagnostic
d'erreur RE-T1, jamais rencontré dans ce parcours. Claude R12 est réutilisé : aucun outil
d'exécution ne lui donne accès à ce diagnostic ; l'exemple du LF ajouté ensuite ne concerne
que les sessions capables d'exécuter un pipeline.

Pendant la publication, `4ac82567990bbf3236dc079ac780f0cc5b5a79fd` est arrivé sur la branche :
il répartit les prochains lots entre ChatGPT (auteur) et Codex (intégrateur technique).
Il est fusionné sans conflit ni écrasement. Il ne change ni le contrat éditorial ni les
scripts contrôlés ici. Les recettes natives ci-dessus sont antérieures à cette répartition ;
elles ne qualifient pas le nouveau pilote Studio/Work → Codex.

Bilan E9 de ces cinq parcours : trois relectures appliquées contrôlées et deux partielles
honnêtes conformes aux limites réelles des outils. Les deux corrections RE-T1 R14 sont
effectivement proposées après rejet ; les originaux restent identiques entre les contrôles.

Empreintes des réponses Codex retenues (SHA-256) :

| Parcours | SHA-256 de la réponse et du dernier stdin |
|---|---|
| Racine R13 | `9d8dd029a78c73e52131ad2d49238d847dc39f88d921bd4e7b0dcbad7a322b2e` |
| seo-batch R14 | `703bf9dda55f5a249b325f20f5acbdcabb35c46c3425b661ab455947adc5015c` |
| wiki R14 | `0fb3d62a1996fd2b40d1fa7253f9d6c896170d1d414360bd23b9b7f1a046d4cd` |

Entrées R14 inchangées avant/après : contrat
`28d0cec62a2850bde99c343812cacff32267cc7d3e28316cad22c23999b8f6ce`, contrôleur
`d8761968c4706263c2250bf1b38f84106a47e09ae5b32b1dc00a2027c6336164`.

Limites : les essais sont des observations de ces sessions, pas une garantie statistique de
tout comportement futur. `HORS_PÉRIMÈTRE` n'est pas exercé nativement ; ses gardes sont testées
isolément. E2b de Claude seo et les autres critères secondaires historiques ne sont pas fermés
par E9. Desktop, lecteur Hermes et mission déléguée restent non qualifiés dans leurs runtimes.
DoD7 demeure `PARTIAL_COVERAGE` et sa case reste décochée.

## Autoreview

La revue humaine n'est plus l'étape de relecture de contenu à attribuer dans ce lot : le
contrat pointe vers l'autoreview du circuit. Pour les fiches WIKI, ADR-119 accepté le
30 octobre remplace explicitement la relecture humaine, sécurité comprise, par l'autoreview
de sens. Le contrôle éditorial mécanique n'est ni cette autoreview, ni un artefact PASS de
promotion. Il ne lève pas les conditions `diagnostic_safe`, les gates vidéo ou les
approbations de publication existantes. Aucun statut d'approbation n'est fabriqué.

## Conservation et retour arrière

Preuves brutes sur le poste DEV : `/home/deploy/pr1924-e9-r{12,13,14}-evidence/` ; critères,
empreintes avant/après, transcriptions, dernières réponses, commandes de contrôle, stdin
extraits, rapports indépendants et `transport-summary.json`. Tests :
`/home/deploy/pr1924-r12-{baseline,drain-before,unit-final}.log` et
`/home/deploy/pr1924-r14-unit.log`. Les SHA des réponses retenues sont consignés avec le bilan.
Les transcriptions complètes restent hors du dépôt pour ne pas publier le contexte injecté.

Retour arrière proportionné : revert des commits de ce correctif sur la branche PR puis
régénération des projections ; aucun rollback de runtime ou de données n'est nécessaire.

## Cycle R24, contrat 1.11.0 : critères avant essai (2026-11-02)

Nouveau cycle, écrit avant toute observation. Les sections ci-dessus et les verdicts R12 à
R23 restent tels quels, échecs compris : R20 Codex racine (capture vide, puis livraison sans
nouveau passage) et R23 Claude wiki (W2 partiel, E2b non rempli).

- **Entrées modifiées** :
  - contrat 1.10.1 → 1.11.0, avec l'étape 6 « Livrer » ;
  - contrôleur : chaque rapport porte en deuxième ligne `entrée : <n> o, sha256 <empreinte>` ;
  - tests ;
  - `wiki-proposal-writer`, étapes 1 à 4 et 13.
- **Livraison contrôlée (Codex)**. Le dernier passage capturé, avec ou sans `--emit`, montre
  l'en-tête 1.11.0 et la ligne `entrée`. Sa taille et son sha256 sont ceux de la réponse
  livrée, et le stdin de ce passage lui est égal octet pour octet. Cette égalité remplace la
  seule exigence de l'écho `--emit`.
  - Capture vide, puis livraison sans nouveau passage capturé : échec.
  - Double capture vide, déclarée « sortie du contrôle non capturée » : partielle, non comptée
    comme appliquée.
- **Lectures wiki**. Sont rendus en entier, par outil, de la ligne 1 à la dernière :
  - `SKILL.md`, frontmatter compris ; l'injection par l'outil Skill ne compte pas ;
  - `.claude/knowledge/workspaces.md`, le gabarit, `source-catalog.yaml` et la fiche
    existante.

  Une recherche par motif n'est pas une lecture.
- **Inchangés** : prompts R2 (`2bc1c68e…`) et copies WIKI/RAW ; Codex CLI 0.144.4. Claude Code
  passe de 2.1.311 à 2.1.316 : changement hors dépôt, consigné.
- **Cas** :
  - ciblés : Codex racine et Claude wiki ;
  - à rejouer : Codex wiki, Claude seo et Codex seo. Leurs blocs 1.10.1 ne sont plus
    re-contrôlables à la nouvelle version ;
  - Claude racine seulement si E9 global l'exige, avec sa limite de compaction conservée.
- **Aucune réussite n'est anticipée**. DoD7 demeure `PARTIAL_COVERAGE`, case décochée, et DoD2
  reste à prouver.

## Cycle R24 : résultats conservés (2026-11-02)

Les critères ci-dessus restent tels qu'écrits ; ce constat les juge sans les modifier.

- **Codex racine : échec.**
  - Premier `REJETEE` : empreinte calculée sur un texte dont les deux insécables étaient devenues
    des espaces.
  - Second `REJETEE` : empreinte formée du préfixe de 12 caractères affiché par le rapport,
    complété sans commande entre les deux passages.
  - Réponse ensuite réécrite (bloc réindenté, apostrophes et espaces changées), puis livrée
    sans troisième passage, comme relecture partielle sur une cause non admise.
- **Claude wiki : échec.** W2 et E2b sont remplis ; trois critères échouent.
  - Attendu 5 : la proposition ne figure qu'en YAML, avec échappements `\u00a0`. Le texte
    décodé n'est jamais affiché dans la prose.
  - Attendu 1 : plages 1-761, 1-224, 1-52 et 1-35 pour des fichiers de 760, 223, 51 et 34
    lignes. Elles comptent la ligne vide que Read numérote après le saut final, ce que
    l'exception du texte 1.10.1 admettait.
  - 7w4, relevé par la QA parente : sources dites « admissibles » sous condition d'une empreinte
    non vérifiée (lignes 59 à 62 de la réponse). Le `controle_fidelite` du bloc vaut
    `inchangé` aux cinq relectures.
- Les cas non ciblés n'ont pas été rejoués.

**Rectification (2026-11-02, avant la recette R25).** Le relevé ci-dessus, conservé tel quel,
attribuait à tort un échec 7w4 aux réserves écrites dans la prose. Le critère 7w4 de
`r23/criteres.md` ne vise que `controle_fidelite`. Le bloc Claude wiki R24 compte une seule
relecture, et non cinq comme écrit plus haut, dont le `controle_fidelite` porte `inchangé` à ses
cinq clés : 7w4 est rempli. Seuls les attendus 1 et 5 échouent. La consigne
de l'étape 13 sur `controle_fidelite` (cycle R25) reste une clarification utile, sans défaut
observé dans le bloc.

## Cycle R25, contrat 1.11.1 : critères avant essai (2026-11-02)

Nouveau cycle, écrit avant toute observation ; deuxième cycle de correction sur trois.

- **Entrées modifiées** :
  - contrat 1.11.0 → 1.11.1 :
    - empreinte de l'original calculée sur la valeur décodée du bloc ;
    - aucune livraison après un `REJETEE` sans nouveau passage capturé ;
    - proposition affichée décodée dans la prose ;
    - plages arrêtées à la dernière ligne du fichier ;
  - contrôleur : le rapport d'une empreinte fausse n'affiche plus l'empreinte attendue et
    signale une empreinte calculée sur des espaces ordinaires ;
  - tests ;
  - `wiki-proposal-writer`, étape 13 : proposition décodée, plages, et `controle_fidelite`
    limité à la comparaison avant/après (une réserve sur une source ou son admission reste
    au dossier interne).
- **Critères inchangés**, jugés à la version 1.11.1 : E9 1 à 10, W2, W2b, W5, E2b, 7w1 à 7w4,
  lignes 3 et 9 de DoD7, et le critère de livraison contrôlée de R24.
- **Tolérance N+1 du contrôleur inchangée**. L'attendu 1 reste jugé par la QA sur les plages
  déclarées.
- **Cas** :
  - ciblés : Codex racine et Claude wiki ;
  - à rejouer : Codex wiki, Claude seo et Codex seo. Leurs blocs 1.11.0 ne sont plus
    re-contrôlables à la nouvelle version ;
  - Claude racine seulement si E9 global l'exige.
- **Aucune réussite n'est anticipée**. DoD7 demeure `PARTIAL_COVERAGE`, case décochée, et DoD2
  reste à prouver.

## Cycle R25 : résultats conservés (2026-11-02)

Les critères ci-dessus restent tels qu'écrits ; ce constat les juge sans les modifier. Seuls
Codex racine et Claude wiki ont été lancés.

- **Codex racine : échec de la livraison contrôlée.**
  - Contrôle indépendant : code 0, `appliquee`, aucune erreur. La réponse finale est le dernier
    message natif et le stdin du passage, à l'octet près (13 356 o, sha256 `1f0b35c5…`).
  - L'unique passage natif, sans `--emit`, rend un code 0 et une sortie capturée vide. Aucun
    second passage n'est fait, alors que la règle 1.11.1, lue de 1 à 790, l'exigeait ; la
    réponse est livrée appliquée.
  - Rejouée à l'identique hors de Codex, la même commande affiche le rapport attendu : en-tête
    1.11.1 `APPLIQUEE`, puis la ligne `entrée` égale à la réponse livrée. Un `wc -l` du même
    essai a aussi une sortie vide avec un code 0 : la capture est perdue côté Codex CLI 0.144.4,
    par un mécanisme que la trace ne montre pas.
- **Claude wiki : échec de l'attendu 9.**
  - Contrôle indépendant : code 3, `partielle`, aucune erreur ; C2 non remplie faute d'outil
    d'exécution. Réponse finale exacte.
  - Relevés de la QA : attendu 1 rempli (aucune plage au-delà de son fichier), attendu 5 rempli
    (proposition affichée décodée dans la prose), aucune section fausse. Lectures complètes de
    `SKILL.md` (1-240), `workspaces.md` (1-296), du gabarit (1-165), de `source-catalog.yaml`
    (1-920) et de la fiche (1-337).
  - Attendu 9 : compaction automatique à l'événement 175, puis aucune lecture du contrat (1-790)
    avant la réponse finale. Après la compaction sont relus `SKILL.md` en entier (événement
    196), `marketing-voice.md` (198), une source RAW (200) et la fiche (208, 210).
- **Dérive de HEAD pendant R25.** Le hook automatique de fin de session a ajouté le commit
  `581931ee` (`log.md` seul, six lignes) à 08:18:14Z, trois secondes avant la fin de l'essai
  Claude wiki : sa révision passe de `d66a3465` à `581931ee`. Codex racine, terminé avant, garde
  `d66a3465`. Vérifié après coup : les empreintes des entrées techniques sont inchangées (30/30
  côté wiki, 26/26 côté racine), les instantanés WIKI/RAW sont identiques, et `log.md` n'est pas
  une entrée. Le commit est conservé ; il n'appartient pas au lot technique.
- **E9 n'est pas passé.** Codex wiki, Claude seo et Codex seo n'ont pas été rejoués.

## Cycle R26, contrat 1.11.2 : critères avant essai (2026-11-02)

Nouveau cycle, écrit avant toute observation ; troisième et dernier cycle de correction.

- **Entrées modifiées** :
  - contrat 1.11.1 → 1.11.2, étape 6 : deux passages de livraison sans `--emit`, en commandes
    séparées, toujours faits. La livraison exige au moins un passage reçu, lié à la réponse
    livrée par sa ligne `entrée`, et aucun `REJETEE` ; sans passage reçu, la sortie est
    partielle, cause « sortie du contrôle non capturée ». « Contrôle mécanique » est aligné ;
  - test du contrat : l'étape 6 nomme les deux commandes séparées ;
  - `wiki-proposal-writer`, étape 13 : avant la livraison, et après toute compaction ou tout
    résumé, contrat lu en entier dans le contexte courant par une lecture observable (Read pour
    Claude, commande équivalente pour Codex), plages exactes ; même livraison en deux passages.
- **Contrôleur inchangé**, tolérance N+1 comprise.
- **Critères inchangés**, jugés à la version 1.11.2 : E9 1 à 10 (attendu 9 compris), W2, W2b,
  W5, E2b, 7w1 à 7w4, lignes 3 et 9 de DoD7, et le critère de livraison contrôlée de R24.
- **Cas que le texte de R24 ne tranche pas** : un premier passage reçu, puis un second à la
  sortie vide. Le contrat 1.11.2 livre alors l'entrée ; le critère de R24 n'est pas réécrit et
  la QA le juge tel qu'écrit.
- **Révision** : consignée avant et après l'essai ; toute dérive, même par le seul journal, est
  signalée avec la vérification des empreintes d'entrée.
- **Cas** :
  - ciblés : Codex racine et Claude wiki ;
  - à rejouer : Codex wiki, Claude seo et Codex seo. Leurs blocs 1.11.1 ne sont plus
    re-contrôlables à la nouvelle version ;
  - Claude racine seulement si E9 global l'exige.
- **Aucune réussite n'est anticipée**. DoD7 demeure `PARTIAL_COVERAGE`, case décochée, et DoD2
  reste à prouver.

## Cycle R26 : résultats conservés (relevé du 2026-11-03)

Ce relevé a été fait avant le lot R27, sur les réponses finales natives de R26, sans les
modifier.

- **Codex racine** : la réponse finale native (14053 o) diffère de l'entrée de son premier
  passage de contrôle (14047 o, +6 o). Cette entrée passe le contrôle, mais la réponse finale est
  `REJETEE` : la réponse a été modifiée après le contrôle.
- **Claude wiki** : la réponse finale native (18178 o) a deux écarts.
  - Ses plages dépassent d'une ligne la fin réelle des fichiers (1-224 pour 223 lignes, 1-87
    pour 86).
  - Elle affiche la proposition à la typographie près.

  Le contrôleur de la tête `c068402f9` la classe `PARTIELLE` sans relever ces deux écarts.
- Les deux cas ciblés ne sont pas livrés, et E9 n'est pas passé. La revue R26 conclut
  `REVIEW_REQUIRED`. Aucun cycle ultérieur ne requalifie ces réponses.

## Lot R27, garde de sortie : critères avant essai (2026-11-03)

Nouveau lot autorisé le 2026-11-03. Ces critères sont écrits avant toute recette R27. C'est le
cycle 1 sur 3 de ce lot ; le compteur R24 à R26 reste à 3 sur 3.

- **Entrées modifiées** :
  - `check-editorial-review.mjs`, option `--strict`. Une plage qui dépasse la dernière ligne
    réelle est rejetée, N+1 compris. La proposition décodée par JSON.parse doit figurer octet
    pour octet dans la prose. Sans l'option, la tolérance N+1 reste, et une proposition absente
    n'est pas relevée (compatibilité historique). Dans les deux modes, une proposition affichée
    à la typographie près ou aux sauts forcés près est désormais rejetée, comme l'exige
    l'affichage de la proposition dans le contrat ;
  - `editorial-review-stop-gate.mjs` (nouveau). Ce hook Stop contrôle le dernier message de
    l'agent en mode strict. Il garde chaque version en trace et demande au plus deux reprises.
    Après la fin, `--verifier` recontrôle la réponse finale extraite du flux natif ;
  - les tests du contrôleur et de la garde.
- **Inchangés** : le contrat 1.11.2, `wiki-proposal-writer`, les prompts, les workspaces, les
  outils accordés et refusés, les tours et le budget.
- **Variante** : recette native nouvelle, « avec garde de sortie ». Les lanceurs déclarés du lot
  branchent la garde par une couche de session : `--settings` pour Claude Code, `-c hooks.Stop`
  pour Codex. Aucun réglage versionné ni global ne la charge. Un lancement usuel sans ces
  lanceurs ne passe donc pas par la garde. La variante ne requalifie ni R24, ni R25, ni R26.
- **Critères de la garde**, en plus des critères existants :
  1. La réponse finale est celle du flux natif. Pour Claude Code, c'est `result` du dernier
     événement `result`. Pour Codex, c'est le fichier `-o`, identique à l'octet au dernier
     `agent_message` du flux.
  2. `--verifier` sort en 0 (appliquée) ou en 3 (partielle) ; 1 vaut échec.
  3. La dernière trace porte les octets exacts de la réponse finale. Sa décision est `livree`,
     et le dossier ne contient qu'une session.
  4. Sans trace, la garde n'a pas été chargée : la variante est invalide et ne compte pas comme
     réussite. Une décision `non_controlee` ou `borne_atteinte` vaut échec.
  5. Les versions refusées restent en trace. La borne est de deux reprises.
  6. Le contrôle indépendant de la réponse finale est consigné, sans option puis avec
     `--strict`.
- **Critères R26 inchangés**, jugés à la version 1.11.2 : E9 1 à 10 (attendu 9 compris), W2,
  W2b, W5, E2b, 7w1 à 7w4, lignes 3 et 9 de DoD7, et la livraison contrôlée de R24. Pour Codex,
  les deux passages de livraison de l'étape 6 restent exigés ; la garde ne les remplace pas.
- **Claude wiki** : sans outil d'exécution, le résultat attendu est au mieux partiel (sortie 3).
  Aucun outil n'est ajouté. Le motif de reprise transmet au modèle les erreurs du contrôle.
  R26 ne lui donnait pas cette information ; la QA en juge.
- **Préconditions** : le candidat est commité, l'arbre est propre et le dossier de traces
  n'existe pas. Pour Codex, l'owner a approuvé le hook de session dans l'interface native, et la
  commande n'a pas changé depuis.
- **Cas** : Codex racine et Claude wiki. Codex wiki, Claude seo et Codex seo, à rejouer selon
  R26, ne font pas partie du lot.
- **Aucune réussite n'est anticipée**. DoD7 demeure `PARTIAL_COVERAGE`, case décochée, et DoD2
  reste à prouver.

## Lot R27, cycle 1 : résultats conservés (relevé QA du 2026-11-03)

Relevé de la QA parent sur les réponses finales natives de R27, sans les modifier.

- **Claude wiki** : PARTIELLE conforme. La garde et le vérificateur sortent en 3. Après deux
  reprises, la troisième livraison est exacte. Les lectures et la reprise après compaction sont
  conformes.
- **Codex racine** : la réponse finale APPLIQUEE est exacte (14108 o, sha256 `3d21faf1…`), et
  `-o` est identique au dernier `agent_message`. La garde sort en 0. Le critère de l'étape 6
  n'est pas satisfait : le flux montre une commande `--help` (code 2), puis une seule
  acceptation par `--emit`. Les deux passages sans `--emit` qui doivent la suivre manquent
  (`qa-r27.json`).
- E9 n'est pas passé. Le cycle suivant ne requalifie pas ces réponses. Rejouée sur le même flux,
  sa garde refuse la réponse Codex : aucune commande sans `--emit` après l'acceptation.

## Cycle R28 : critères avant essai (2026-11-03)

Cycle 2 sur 3 du lot R27. La QA parent a arrêté ces critères avant tout essai, dans
`criteres-r28.md` du dossier de preuves. Ils sont repris ici sans modification de fond.

- **Entrées modifiées** :
  - `editorial-review-native.sh` (nouveau), point d'entrée versionné, sur option. Il charge la
    garde par les options de session natives (`--settings` pour Claude Code, `-c hooks.Stop`
    pour Codex). Il laisse le flux natif sur la sortie standard et le copie sans le modifier.
    Après la session, il extrait la réponse finale native, la compare à `-o` pour Codex, puis
    lance la vérification. Codes : 0 appliquée, 3 partielle vérifiée, 1 échec, 2 usage refusé
    (CLI non lancée) ;
  - `editorial-review-stop-gate.mjs` : l'étape 6 est relevée dans le flux Codex, sur les couples
    `item.started` puis `item.completed`. S'y ajoutent `--extraire` (réponse finale du flux) et
    `--env` (paramètres du lanceur) ;
  - `check-editorial-review.mjs` : en mode strict, une entrée réduite au bloc final ne peut plus
    esquiver l'affichage de la proposition ;
  - les tests du contrôleur, de la garde et du lanceur. Le lanceur y est testé avec une CLI
    factice.
- **Critères ajoutés** :
  1. Les deux recettes passent par le lanceur. Une CLI qui finit en 0 sans garde acceptée ne
     vaut pas livraison. Codes du lanceur : 0 appliquée, 3 partielle vérifiée, 1 échec. La
     comparaison indépendante de `-o` et du dernier `agent_message` est maintenue pour Codex.
  2. Codex : l'ordre est prouvé dans le journal natif, par `item.started` puis
     `item.completed`. Une première acceptation par `--emit` de la réponse exacte est suivie de
     deux commandes sans `--emit`, lancées l'une après l'autre. Au moins une sortie capturée est
     liée à cette réponse. Une aide ou une preuve d'ordre incomplète ne satisfait pas ce
     critère. La garde ne remplace pas ces commandes.
  3. Les limites du relevé sont celles que déclare le produit :
     - sans passage reçu, la garde refuse, alors que le contrat livrerait en relecture
       partielle ;
     - une commande qui sort dans un autre code que 0 ou 3 n'est pas comptée ;
     - un rapport dont le code ne correspond pas à l'état n'est pas reçu ;
     - un REJETEE se corrige : une nouvelle acceptation suivie de deux passages rend la réponse
       livrable ;
     - un passage forgé n'est pas exclu, et les traces ne sont pas confinées ;
     - l'étape 6 n'est pas vérifiée pour Claude.
  4. Le prompt, les outils, le budget et le contrat restent inchangés. Les critères du lot R27
     ci-dessus restent applicables.
- **Hook Codex** : la définition `--env` a été revue dans l'interface native de Codex, avec pour
  résultat Trusted et Stop Active 1 (`qa-r28-hook-review.md`). Aucun contournement. La confiance
  seule ne prouve pas E9.
- **Préconditions** : le candidat est commité et l'arbre est propre.
- **Aucun résultat R28 n'est anticipé**. DoD7 reste partiel.

## Lot R27, cycle R28 : résultats conservés (relevé QA du 2026-11-03)

Relevé de la QA parent sur les réponses finales natives de R28, sans les modifier.

- **Codex racine** (session `01a1a0a7-b793-7a22-9955-d980175c90ad`) : échec. Le lanceur et la
  vérification sortent en 1. La réponse finale est exacte (11107 o, sha256 `8034ac7e…`) et le
  contrôle l'accepte, sans option et avec `--strict` (code 0). Après l'acceptation par `--emit`
  (`item_43`), aucun des deux passages sans `--emit` n'a été lancé. L'agent a tenté des commandes
  dans une session interactive, puis a perdu le here-document `RESPONSE` d'un appel d'exécution à
  l'autre. Au troisième Stop, la garde conclut `borne_atteinte`
  (`native-r28/codex-root/gate/verification.json`, `qa-r27.json`). E9 n'est pas passé.
- **Cause relevée** : le motif de reprise ne donnait pas le chemin de la trace. L'agent devait
  reconstituer la réponse de mémoire.
- **Claude wiki** (session `85f682b3-0be2-4474-b997-61dc28a6e8e1`) : PARTIELLE conforme. Le
  lanceur, la vérification et le contrôle (sans option et `--strict`) sortent en 3. La réponse et
  la proposition natives sont exactes, sans plage au-delà de la fin du fichier. Après la
  compaction, le contrat est relu par Read, lignes 1 à 800 : attendu 9 vrai. Cinq sources wiki,
  couverture complète, 29 tours, 3,9485806 USD (`native-r28/claude-wiki/qa-r27.json`).

## Cycle R29 (lot R27, cycle 3 sur 3) : critères avant essai (2026-11-03)

Dernier cycle du lot. Les critères du lot R27 et du cycle R28 restent applicables, sans changement.

- **Entrée modifiée** : `editorial-review-stop-gate.mjs` et ses tests, rien d'autre. Avec un
  journal (Codex), quand le contrôle accepte la réponse mais que les passages manquent, le motif
  de reprise donne :
  - le chemin absolu de la trace de cette version. La garde l'a déjà écrite ; l'agent ne l'écrit
    pas et ne la modifie pas ;
  - trois commandes du contrôle à lancer telles quelles : `--emit`, puis deux fois sans `--emit`.
    Chacune porte les `--root` de la garde et lit la trace sur l'entrée standard (`< trace`). Les
    chemins sont protégés pour le shell ;
  - un appel d'exécution distinct par commande, chacun après la fin du précédent, sans tube ni
    session interactive.

  Le relevé reconnaît aussi un chemin du contrôle entre apostrophes ou guillemets. Avant, le
  `--emit` qui suivait ce chemin n'était pas vu.
- **Variante** : la QA parent admet `< trace` pour cette variante (décision du 2026-11-03). Le
  contrat demande l'entrée standard sans fichier écrit par l'agent ; `printf` et le here-document
  en sont des exemples. Cette admission ne requalifie aucun cas antérieur.
- **Frontière** : la trace n'est que l'entrée des passages. La livraison reste le dernier message
  natif, recontrôlé au Stop suivant et lié aux passages par ses octets et son sha256. Aucune
  couche ne substitue la trace à la réponse.
- **Claude wiki R28 réutilisé, non rejoué** : le motif modifié et le relevé ne sont atteints
  qu'avec un journal, et le lanceur n'en donne pas à Claude (`unset EDITORIAL_REVIEW_JOURNAL`).
  Le contrôleur, le lanceur, le contrat et le prompt sont inchangés. Un test fixe le motif
  antérieur pour Claude et pour une réponse refusée par le contrôle.
- **Tests** : 134 verts, dont les 131 antérieurs. Les trois commandes du motif sont lancées par
  bash sur la trace ; le dossier de traces et une racine ont une espace et une apostrophe dans
  leur nom. Résultats : codes 0, rapports liés à la trace, sortie `--emit` égale à la trace,
  trace inchangée. Le flux de ces trois commandes mène à `livree` et à une vérification en 0 ;
  la seule commande `--emit` laisse un refus. Avec l'ancien relevé, le test du chemin entre
  apostrophes échoue. Ces tests ne prouvent pas le comportement du vrai Codex.
- **Critère Codex R29** : celui de R28, inchangé. Lanceur et vérification en 0 ou 3, `-o` égal
  au dernier `agent_message`, étape 6 prouvée dans le journal natif.
- **Préconditions** : candidat commité, arbre propre, dossier de traces absent. La commande du
  hook `--env` n'a pas changé depuis la revue R28 ; sa confiance est à constater avant l'essai.
- **Aucun résultat R29 n'est anticipé**. DoD7 reste partiel. Le lot R27 atteint 3 cycles sur 3.
