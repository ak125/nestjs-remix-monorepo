---
name: amk-marketing-validation
description: Use when reviewing AutoMecanik V1/V2 preparation and operations, validating its contracts or explaining observed synthetic campaign performance. Excludes Fafa video analytics, SEO changes, approvals, sending and live provider operations.
type: technique
status: experimental
owners: ["@ak125"]
domain: D12
runtime_class: read-only
llm_safe: true
last_verified: "2026-10-02"
metadata:
  version: "2.0.0"
---

# amk-marketing-validation

Revoir les préparations, parcours J01–J18, mesures et raccordements, avec le même outil que sa préparation. Aucun nouveau moteur de campagne.

## Entrées et préconditions

Sortie JSON du pilote, période, versions, fixture fictive et sources référencées. Charger la compétence pour préparation marketing, arbitrage ou mesure V1/V2 ; les vidéos conservent `fafa-brand-safety-reviewer` et `fafa-performance-analyzer`.

## Outils autorisés

Lecture du JSON et des références ; terminal local : tests Node/tsx, TypeScript, validation des skills. Aucune URL embarquée suivie automatiquement ; aucun secret, SQL ou accès fournisseur. Voir [recette et limites](../amk-reactivation/references/pilot.md).

## Étapes

1. Rejouer le pilote : mêmes entrées = même résultat, annulation = zéro candidat simulé. Contrôler projet, dates, règles et exclusions.
2. Vérifier chaque affirmation : source métier récente pour prix/stock/référence/compatibilité ; WIKI validée pour conseil. Ne jamais certifier un diagnostic ni une compatibilité absente.
3. Exécuter la suite de tests, incluant le sous-processus à réseau piégé et variables d'envoi factices. Un simple lint ne démontre pas l'absence d'effet.
4. Distinguer candidats, remise déclarée au prestataire, livraison, clic, commande confirmée et revenu net. Lire `performance` : montants entiers par devise, pas de fusion de devises ; aucune causalité/attribution déduite.
5. Relever les retours incertains : rapprochement requis, renvoi interdit. Les tests de replay sont ceux d'un calcul pur, pas une garantie de persistance ou de livraison exactement une fois.
6. Présenter `approval_request` au futur mécanisme externe : contenu intégral/version, projet, audience/règles, expéditeur, canal, fenêtre, limites et expiration. Rien n'est approuvé par l'outil ; toute entrée `approval` est rejetée. L'expéditeur et la fenêtre non configurés bloquent.

## Sorties et contrôles

Cinq états AEC séparés : scan, analysis, correction proposée/appliquée dans le mandat, validation, verdict. Inclure le coverage manifest et les limites réelles : outils présents, raccordés, testés, chargés, activés. Proposer un groupe témoin défini et une durée/puissance à calculer avec les données autorisées ; ne pas inventer un gain ou un seuil causal.

## Arrêt

Données privées, calcul incohérent, version modifiée, validation expirée ou non vérifiable : conserver `draft`. Les parcours accueil/après-vente/stock/panier exigent événements et permissions vérifiés ; ils ne sont pas activables avec cette recette. Ne pas faire évoluer un profil Hermes, cron ou outil d'envoi.

## Recette V2 complémentaire

Lire [la recette V2](../amk-marketing-preparation/references/workbench.md) et [les limites opérationnelles](../amk-marketing-operations/references/operations.md). Exécuter les tests `marketing-workbench.test.ts`, `marketing-operations.test.ts`, `marketing-measurement.test.ts`, puis `reactivation-runtime.test.mjs`. Le contrôle TypeScript inclut explicitement ces fichiers, sans les anciens scripts qui importent AppModule. La matrice exhaustive et le résultat des validations sont dans le README du workspace. Les contrôles statiques de frontmatter ne sont pas une évaluation comportementale des runtimes.
