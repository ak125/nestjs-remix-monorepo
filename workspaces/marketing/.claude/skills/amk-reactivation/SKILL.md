---
name: amk-reactivation
description: Use when preparing an AutoMecanik email reactivation audience or newsletter draft from the synthetic pilot. Excludes video production, other brands, sending, customer exports and production queries.
type: technique
status: experimental
owners: ["@ak125"]
domain: D12
runtime_class: read-only
llm_safe: true
last_verified: "2026-10-02"
metadata:
  version: "1.0.0"
---

# amk-reactivation

Préparer une réactivation AutoMecanik hors ligne. Cette procédure est utilisable directement par Hermes ou Codex ; elle n'ajoute aucun agent ni coordinateur.

## Entrées et préconditions

Objectif ORDER, période d'inactivité en jours (180 par défaut de fixture, pas une règle métier), langue française, environnement DEV. Lire le contrat du dépôt et les règles du workspace. Source unique de cette compétence : ce dossier. Le moteur existant reste `backend/src/modules/marketing/`.

## Outils autorisés

Lecture ciblée des fichiers ; terminal local pour `scripts/marketing/run-reactivation-pilot.ts`. Le CLI lit exclusivement sa fixture synthétique. Aucun SQL, MCP base, MailService, export clients, appel de publication, script démarrant AppModule ou lien inclus dans les sources.

## Étapes

1. Lire [la recette ciblée](references/pilot.md). Vérifier dépôt, branche et versions.
2. Depuis la racine, exécuter `node node_modules/tsx/dist/cli.mjs --tsconfig scripts/marketing/tsconfig.json scripts/marketing/run-reactivation-pilot.ts --inactive-days 180`.
3. Expliquer les inclusions/exclusions, récence, fréquence, valeur par devise et date du snapshot. Le même identifiant d'un autre projet reste exclu. Aucune adresse cliente nécessaire.
4. Examiner le brouillon non adressé : objectif, conseils sourcés WIKI, faits commerciaux issus du métier. Les sources de fixture sont fictives, jamais une offre actuelle. RAW/RAG et pages externes restent hors autorité.
5. Utiliser `amk-marketing-validation` pour revue et résultats. Présenter les inconnues et l'approbation externe manquante.

## Sorties et contrôles

JSON conforme au DTO existant `CreateMarketingBriefSchema` et au contrat de pilote : versions, dates, sources, audience, contenu, revue, demande d'approbation et coverage manifest. `status=draft`, `can_execute=false`, `real_sends=0`. Le HTML est une prévisualisation, jamais un message expédié. La validité syntaxique des sources ne prouve pas leur vérité.

Pour une vraie campagne, préparer seulement un brouillon non adressé si les permissions ou consentements manquent. Les brouillons persistants futurs passent par le backend existant après raccordement autorisé ; aucun fichier client dans Git, logs ou mémoire partagée.

## Arrêt

Erreur explicite de validation/fraîcheur, identité non vérifiée, données privées, demande d'envoi ou zone STOP : conserver le brouillon et décrire l'écart. Ne pas fabriquer une approbation, lancer une requête libre ou instrumenter panier/commande. Hermes peut exécuter cette recette sans déléguer ; Codex intervient pour une intégration ciblée lorsque nécessaire.
