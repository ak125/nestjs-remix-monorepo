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
