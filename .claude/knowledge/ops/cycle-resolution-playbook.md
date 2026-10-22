---
scope: Ops / Diagnostic et résolution des cycles
audience: human + agents
sources:
  - package.json
  - .dependency-cruiser.cjs
  - packages/seo-roles/
  - .claude/rules/guardrails.md
last_scan: 2026-10-21
---

# Cycle Resolution Playbook

Un cycle signalé est un point de départ pour le diagnostic, pas une recette de
refactor ni une exemption. Les chiffres d'avril/mai 2026 du
[backlog](cleanup-targets.md#section-4--cycles-historique) sont historiques ; mesurer
le checkout concerné avant de choisir une correction.

## 1. Établir le signal sur le checkout courant

Relever HEAD, modifications locales, versions des outils et périmètre de l'analyse.
Depuis la racine du checkout, avec les dépendances du projet disponibles :

```bash
npm run audit:madge
# Optionnel : écrit/remplace le graphe complet dans audit-reports/dep-graph.json
npm run audit:graph
```

Conserver la sortie et le code de retour, y compris les avertissements de résolution.
Un graphe incomplet ou des dépendances absentes ne permettent pas de conclure à une
amélioration. Comparer avant/après avec les mêmes entrées, versions et configuration.
Madge et dependency-cruiser n'ont pas nécessairement la même granularité de comptage :
ne pas assimiler leurs totaux ni remplacer une mesure par celle d'un autre outil.

Préserver tout export existant avant remplacement. Le JSON suffit pour consulter
les dépendances. Si une visualisation est nécessaire, utiliser les options natives
`--dot` ou `--image` de Madge dans un environnement déjà équipé de Graphviz.
Avec Madge 8.0.0 installé lors de cette revue, même `--dot` exige `gvpr`, absent sur
le VPS DEV vérifié. La visualisation reste optionnelle : ne pas ajouter un convertisseur
maison ou une installation globale pour mener le diagnostic des imports.

## 2. Lire les dépendances réelles avant de choisir une correction

Pour chaque cycle retenu, relever les imports et leurs usages, le propriétaire du
contrat, les consommateurs et les éventuels enregistrements de providers NestJS.

| Signal | Diagnostic et correction à envisager |
|---|---|
| Types partagés | Distinguer imports de types et de valeurs. Chercher d'abord le propriétaire existant ; corriger la dépendance vers cette source avant d'en créer une autre. |
| Modules métier qui s'importent | Examiner les services effectivement consommés et leurs responsabilités. Les noms des modules ne suffisent pas à imposer une direction de dépendance. |
| Orchestrateur et services spécialisés | Examiner la chaîne d'appels et le câblage DI. Réutiliser les contrats et providers existants ; une interface seule ne décrit pas le câblage d'injection. |
| Services du même dossier | La proximité des fichiers ne prouve pas que le cycle est sans risque. Documenter les usages et la décision, comme pour tout autre cycle. |
| Frontend `root` / hook | Examiner l'import exact et le graphe runtime avant de refactorer. Dans `useRootData.ts`, `loader` est importé comme type ; le signal statique seul ne prouve pas une boucle runtime. |

**Exemple vérifié le 2026-10-21** :
[`backend/src/config/role-ids.ts`](../../../backend/src/config/role-ids.ts) réexporte
`@repo/seo-roles`, dont la source est
[`packages/seo-roles/`](../../../packages/seo-roles/). L'ancienne recette qui
redéfinissait `RoleId` dans un nouveau `shared/types/role-ids.types.ts` recréerait une
source concurrente. Vérifier l'état de ce package et de ses consommateurs au moment
réel de l'intervention.

Pour le frontend, l'observation porte sur
[`useRootData.ts`](../../../frontend/app/hooks/useRootData.ts), pas sur une
acceptation générale des cycles SSR. Aucune catégorie de cette table n'impose à elle
seule un refactor, une nouvelle abstraction ou un statut `wontfix`.

## 3. Garder les contrôles actifs

La règle `no-circular` de
[`.dependency-cruiser.cjs`](../../../.dependency-cruiser.cjs) est en `warn` lors de
cette revue ; ce niveau n'accorde pas une exemption. Avant toute modification de
règle ou d'exclusion, suivre les
[passes de diagnostic des gardes](../../rules/guardrails.md).
Ne pas ajouter une exclusion uniquement pour faire disparaître un cycle signalé.
Une décision de conservation doit citer la preuve et ses limites dans le backlog.

## 4. Valider le changement retenu

- Comparer le cycle précis avant/après avec le même outil ; une baisse du total
  ne prouve pas à elle seule sa résolution ni l'absence de régression.
- Exécuter les contrôles adaptés au changement : typage pour les contrats/imports,
  tests des consommateurs et, si le câblage NestJS change, validation de ce câblage.
  Build ou tests plus larges selon le risque ; pas de build applicatif pour la prose seule.
- Utiliser `npm run audit:baseline` pour la comparaison aux compteurs de référence,
  sans la confondre avec les preuves de comportement ci-dessus. Avant tout refresh,
  suivre le [contrôle avant régénération](safe-delete-procedure.md#4-batch--regression-gate).
- Consigner checkout, preuves, décision et limites dans le [backlog](cleanup-targets.md).
  Marquer une PR comme fusionnée seulement après vérification de la fusion.

Toute suppression associée suit la [procédure de suppression](safe-delete-procedure.md).
