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
