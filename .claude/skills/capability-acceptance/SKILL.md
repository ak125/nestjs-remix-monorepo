---
name: capability-acceptance
description: Use when asked whether an AutoMecanik capability really works end to end, to place it on the L0–L4 ladder with dated evidence, or to close a work cycle with a réception report. Triggers — "est-ce vraiment opérationnel", "réception de la capacité", "prouve que X marche", "capability map", "acceptance". Excludes runtime drift audits (runtime-truth-audit), improvement verdicts (continuous-improvement-global), self-review of a diff (code-auto-review), department state (project-state-report) and any deploy, payment or PROD mutation.
type: technique
status: experimental
owners: ["@ak125"]
domain: D15
runtime_class: mutating
llm_safe: true
last_verified: "2026-10-26"
metadata:
  version: "1.1.0"
---

# capability-acceptance

Dire jusqu'où une capacité est prouvée, avec une preuve rejouable, sans confondre
présent, branché, activé et réellement servi (invariant 8 de `CLAUDE.md`). Ce skill
ne crée ni registre ni statut concurrent : le vérificateur se choisit dans le
routage de [agent-method-patterns §9](../../knowledge/agent-method-patterns.md),
la restitution suit le [contrat de sortie](../../canon-mirrors/agent-exit-contract.md).
Il exécute des tests (Vitest, Playwright) et peut écrire des données de test en
DEV ; rien d'autre. Il ne remplace aucune garde exécutable (checks requis de la CI,
contrôle DoD, hooks Claude, contrôles du contrôleur Hermes) : il dit ce qu'elles
prouvent et ce qu'elles ne prouvent pas.

## Échelle

| Niveau | Preuve exigée |
|---|---|
| L0 documentée | un document décrit la capacité ; rien n'est exécuté |
| L1 implémentée | le code existe et est branché (route, import, job) dans le commit observé |
| L2 testée isolément | un test unitaire ou de contrat, vu rouge sans le code puis vert avec |
| L3 intégrée | le parcours complet observé dans un environnement autorisé (DEV, PREPROD) |
| L4 opérationnelle | servie dans l'environnement cible (commit servi prouvé), observable par un signal existant, avec un retour arrière connu, fenêtre de surveillance close |

UNKNOWN et BLOCKED ne sont pas des niveaux : ils accompagnent le dernier niveau
prouvé et visent le suivant, nommé. Exemple : « L3, BLOCKED pour L4 : tag `v*` à
poser par l'owner ». UNKNOWN = aucune preuve dans le mandat ; BLOCKED = accès ou
GO manquant, nommé. Ni l'un ni l'autre n'est un échec ou un succès.

Correspondance des états demandés : DISCOVERED = L0/L1 constaté ; IMPLEMENTING =
branche en cours ; INTEGRATED = L3 ; VERIFIED = L3 avec preuve consignée ;
OPERATIONAL = L4 ; BLOCKED = accès ou GO manquant, nommé ; FAILED = observation
contraire ; DEPRECATED = remplacée (nommer le remplaçant). Un « CERTIFIED » du
Command Center reste ≤ L1 : c'est une projection, pas une mesure du servi.

Rapport en quatre états : **TERMINÉ** = niveau cible prouvé et fenêtre de
surveillance close ; **EN COURS** = niveau cible pas encore atteint, ou fenêtre
ouverte ; **BLOQUÉ** = BLOCKED ; **NON VÉRIFIÉ** = UNKNOWN, ou preuve antérieure
non rejouée (§Réouverture).

Chaque capacité reçoit aussi un verdict : **Vérifié**, **Partiellement vérifié**,
**Non vérifié** ou **Échec confirmé**. Le statut final du cycle reste un statut AEC.

## Preuve

Une preuve tient en sept champs : commit observé (celui qui est servi, pas celui du
checkout s'ils diffèrent), environnement, configuration utile (nom du flag ou de la
variable, jamais une valeur secrète), scénario exact (commande ou parcours), attendu,
observé (sortie brute courte), date UTC. Il en manque un : le niveau n'est pas atteint.
L'attendu est écrit avant l'exécution (étape 2).

Ne sont pas des preuves, quel qu'en soit l'auteur : une case DoD cochée, un
`achieved` déclaré par un exécutant Hermes, le rapport d'un agent, une PR fusionnée,
une CI verte pour un comportement servi. Ils désignent la commande à rejouer.

## Proportion au risque

| Risque | Exemples | Contrôles minimaux |
|---|---|---|
| faible | documentation, test seul, outillage local | L2 ou contrôle statique |
| moyen | runtime DEV ou PREPROD hors zone STOP | L3, vacuité, dépendances vérifiées |
| élevé | zone STOP, données, droits, check CI requis, garde, infra, PROD | L3, vérification indépendante, retour arrière écrit, fenêtre de surveillance ; GO nominatif pour toute action STOP |

Le niveau cible se fixe d'après le risque et l'objectif, jamais d'après la
facilité de la preuve.

## Étapes

1. Délimiter la capacité, l'environnement visé, le mandat et la classe de risque.
   Zone STOP (paiement, prix/stock runtime, panier/commande en PROD, RLS, DB
   destructive, SEO indexé, déploiement PROD) : BLOCKED avec le GO nominatif
   requis, sans contournement.
2. Fixer les critères avant d'exécuter : niveau cible, résultat observable attendu
   à chaque niveau visé, critère d'échec, vérificateur, fenêtre de surveillance si
   L4. Les écrire dans la PR ou `audit/` avant la première observation. Un critère
   changé après coup ouvre un nouveau cycle, signalé comme tel.
3. Recenser les dépendances (service, base, migration, variable ou flag par son
   nom, cron ou file, identité et permission, API externe, image servie) et vérifier
   chacune dans l'environnement cible. Une capacité ne dépasse pas le niveau de sa
   dépendance la moins prouvée.
4. Établir ce qui est servi dans chaque environnement avant de conclure, avec les
   commandes de [evidence-checks](references/evidence-checks.md) §Servi.
5. Choisir le vérificateur existant (§9) ; n'en écrire un que s'il manque, dans le
   répertoire de tests de la surface.
6. Tester le test : rejouer sans le correctif (ou contre le code servi ancien) et
   exiger le rouge attendu. Repérer les tests vides : [evidence-checks](references/evidence-checks.md) §Vacuité.
7. Observer de bout en bout : entrée réelle, effet, puis lecture par le
   consommateur (pour un contenu : RAW → WIKI → projection → consommateur). Un
   composant vert isolément reste L2. Consigner les sept champs, puis classer.
   Code, CI, PREPROD et PROD sont quatre preuves distinctes ; aucune ne remplace
   la suivante.
8. Risque élevé : faire rejouer la preuve par une source indépendante de l'auteur
   du changement (check requis que la PR ne modifie pas, contrôleur Hermes, autre
   session ou agent qui relance les commandes, owner). L'indépendance porte sur la
   preuve rejouée, pas sur un avis.
9. Surveiller après intégration avec un signal existant, une durée et un critère
   d'abandon (DoD7 du modèle de PR) : [evidence-checks](references/evidence-checks.md)
   §Surveillance. OPERATIONAL se déclare à la fin de la fenêtre, après relecture du
   signal ; pendant la fenêtre, la capacité est EN COURS.
10. Ranger la preuve dans la PR ou `audit/` ; jamais seulement en mémoire. Aucune
    donnée personnelle réelle dans un scénario.

## Réouverture

Une observation contraire postérieure (alerte, smoke rouge, `revision` servie
différente de l'attendue, incident, test cassé) rouvre la capacité : le niveau
redescend au dernier niveau encore prouvé, le verdict passe à Échec confirmé,
l'ancienne preuve reste en historique.

Avant de reprendre l'état d'un rapport antérieur, rejouer la preuve la moins
coûteuse qui le fonde, sauf si ses sources, dépendances, configuration et données
sont constatées inchangées (invariant 7). Faute de l'un ou de l'autre, l'état
devient NON VÉRIFIÉ.

## Limites constatées

- PREPROD tourne en `READ_ONLY` avec la clé anon, sans SELECT sur les tables du
  catalogue : recherche et ajout au panier n'y sont pas démontrables (déduit du
  code et des privilèges ; PREPROD n'a pas d'URL publique). Parcours commerce
  strict : `frontend/tests/e2e/commerce-journey.spec.ts` sur DEV.
- Fusion sur `main` ≠ DEV à jour : DEV sert le working tree du checkout principal,
  resynchronisé par cron, qui peut avorter. Vérifier HEAD, état et démarrage du process.
- CI verte ≠ servi ; succès de `deploy-prod.yml` ≠ santé de la PROD.
- Le contrôle `pr-dod-gate` exige les neuf lignes DoD cochées ou N/A ; il ne
  vérifie pas qu'elles sont vraies, et DoD2 (assignation, approbation) y reste
  indicatif.
- Les missions Hermes exécutées par Claude ne chargent ni les skills ni
  `CLAUDE.md` (options de lancement du contrôleur, constaté le 2026-10-26) : une
  mission qui doit suivre cette méthode cite ce fichier dans son objectif. Codex
  liste les skills du dépôt. Détail : [workspaces](../../knowledge/workspaces.md).

## Sorties et arrêt

Par cycle : critères fixés à l'étape 2, tableau (capacité, niveau cible, niveau
prouvé, verdict, preuve, limite), dépendances et leur niveau, défauts confirmés,
corrections, validations exécutées, régressions, risques résiduels, bloquants avec
leur prochaine action, puis le manifeste AEC.

Arrêter et signaler quand la preuve suivante exige un accès, un GO ou un
déploiement hors mandat : la capacité reste au niveau prouvé, marquée BLOCKED ou
UNKNOWN. Ne jamais déployer, muter la PROD ou relâcher une garde pour compléter un
rapport. Reprise : §Réouverture ; un rapport antérieur n'est pas l'état actuel.
