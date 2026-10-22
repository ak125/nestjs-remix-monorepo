---
name: capability-acceptance
description: Use when asked whether an AutoMecanik capability really works end to end, to place it on the L0–L4 ladder with dated evidence, or to close a work cycle with a réception report. Triggers — "est-ce vraiment opérationnel", "réception de la capacité", "prouve que X marche", "capability map", "acceptance". Excludes runtime drift audits (runtime-truth-audit), improvement verdicts (continuous-improvement-global), self-review of a diff (code-auto-review), department state (project-state-report) and any deploy, payment or PROD mutation.
type: technique
status: experimental
owners: ["@ak125"]
domain: D15
runtime_class: mutating
llm_safe: true
last_verified: "2026-10-22"
metadata:
  version: "1.0.0"
---

# capability-acceptance

Dire jusqu'où une capacité est prouvée, avec une preuve rejouable, sans confondre
présent, branché, activé et réellement servi (invariant 8 de `CLAUDE.md`). Ce skill
ne crée ni registre ni statut concurrent : le vérificateur se choisit dans le
routage de [agent-method-patterns §9](../../knowledge/agent-method-patterns.md),
la restitution suit le [contrat de sortie](../../canon-mirrors/agent-exit-contract.md).
Il exécute des tests (Vitest, Playwright) et peut écrire des données de test en
DEV ; rien d'autre.

## Échelle

| Niveau | Preuve exigée |
|---|---|
| L0 documentée | un document décrit la capacité ; rien n'est exécuté |
| L1 implémentée | le code existe et est branché (route, import, job) dans le commit observé |
| L2 testée isolément | un test unitaire ou de contrat, vu rouge sans le code puis vert avec |
| L3 intégrée | le parcours complet observé dans un environnement autorisé (DEV, PREPROD) |
| L4 opérationnelle | servie dans l'environnement cible (commit servi prouvé), observable par un signal existant, avec un retour arrière connu |
| UNKNOWN | aucune preuve dans le mandat ; ce n'est pas un échec |

Correspondance des états demandés : DISCOVERED = L0/L1 constaté ; IMPLEMENTING =
branche en cours ; INTEGRATED = L3 ; VERIFIED = L3 avec preuve consignée ;
OPERATIONAL = L4 ; BLOCKED = accès ou GO manquant, nommé ; FAILED = observation
contraire ; DEPRECATED = remplacée (nommer le remplaçant). Un « CERTIFIED » du
Command Center reste ≤ L1 : c'est une projection, pas une mesure du servi.

Chaque capacité reçoit aussi un verdict : **Vérifié**, **Partiellement vérifié**,
**Non vérifié** ou **Échec confirmé**. Le statut final du cycle reste un statut AEC.

## Preuve

Une preuve tient en sept champs : commit observé (celui qui est servi, pas celui du
checkout s'ils diffèrent), environnement, configuration utile (nom du flag ou de la
variable, jamais une valeur secrète), scénario exact (commande ou parcours), attendu,
observé (sortie brute courte), date UTC. Il en manque un : le niveau n'est pas atteint.

## Étapes

1. Délimiter la capacité, l'environnement visé et le mandat. Zone STOP (paiement,
   prix/stock runtime, panier/commande en PROD, RLS, DB destructive, SEO indexé,
   déploiement PROD) : BLOCKED avec le GO nominatif requis, sans contournement.
2. Établir ce qui est servi dans chaque environnement avant de conclure, avec les
   commandes de [evidence-checks](references/evidence-checks.md) §Servi.
3. Choisir le vérificateur existant (§9) ; n'en écrire un que s'il manque, dans le
   répertoire de tests de la surface.
4. Tester le test : rejouer sans le correctif (ou contre le code servi ancien) et
   exiger le rouge attendu. Repérer les tests vides : [evidence-checks](references/evidence-checks.md) §Vacuité.
5. Observer, consigner les sept champs, puis classer. Code, CI, PREPROD et PROD
   sont quatre preuves distinctes ; aucune ne remplace la suivante.
6. Ranger la preuve dans la PR ou `audit/` ; jamais seulement en mémoire. Aucune
   donnée personnelle réelle dans un scénario.

## Limites constatées

- PREPROD tourne en `READ_ONLY` avec la clé anon, sans SELECT sur les tables du
  catalogue : recherche et ajout au panier n'y sont pas démontrables (déduit du
  code et des privilèges ; PREPROD n'a pas d'URL publique). Parcours commerce
  strict : `frontend/tests/e2e/commerce-journey.spec.ts` sur DEV.
- Fusion sur `main` ≠ DEV à jour : DEV sert le working tree du checkout principal,
  resynchronisé par cron, qui peut avorter. Vérifier HEAD, état et démarrage du process.
- CI verte ≠ servi ; succès de `deploy-prod.yml` ≠ santé de la PROD.
- La case DoD cochée dans une PR est déclarative ; elle ne vaut pas preuve.

## Sorties et arrêt

Par cycle : tableau (capacité, niveau, verdict, preuve, limite), défauts
confirmés, corrections, validations exécutées, régressions, risques résiduels,
bloquants avec leur prochaine action, puis le manifeste AEC.

Arrêter et signaler quand la preuve suivante exige un accès, un GO ou un
déploiement hors mandat : la capacité reste au niveau prouvé, marquée BLOCKED ou
UNKNOWN. Ne jamais déployer, muter la PROD ou relâcher une garde pour compléter un
rapport. Reprise : rejouer les commandes ; un rapport antérieur n'est pas l'état actuel.
