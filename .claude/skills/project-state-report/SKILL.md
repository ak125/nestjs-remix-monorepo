---
name: project-state-report
description: Use when asked for the current AutoMecanik project or department state for Hermes or the owner, read from the Command Center digest or, failing it, from the committed snapshot. Excludes runtime drift audits (runtime-truth-audit), improvement verdicts (continuous-improvement-global), cockpit code changes and any owner-GO decision.
type: technique
status: experimental
owners: ["@ak125"]
domain: D10
runtime_class: read-only
llm_safe: true
last_verified: "2026-10-21"
metadata:
  version: "1.0.0"
---

# project-state-report

Restituer l'état du projet et des 24 départements à partir de la projection
existante du Command Center, sans second calcul ni second registre. Rattachement
proposé : département `strategy` (D10) pour la restitution, `direction` comme
consommateur humain. Le responsable nommé n'est pas renseigné dans la carte
opératoire : écrire « non renseigné », jamais un nom.

## Préconditions et entrées

Nommer la source utilisée dans la sortie. Il y en a trois, exclusives :

- **actuel** : réponse de `GET /api/internal/command-center/digest`
  (`schema_version` = `command-center-digest.v1`) obtenue par un outil dont
  l'appelant dispose déjà. Ne jamais lire, afficher ni recopier la clé interne.
- **historique** : `audit/registry/command-center-snapshot.json` du checkout,
  daté par son dernier commit (`git log -1 --format=%cs -- <fichier>`). Il décrit
  départements, capacités et chaînes ; il ne contient aucune mesure de KPI.
- **indisponible** : ni l'un ni l'autre. Le dire. Ne pas reconstituer l'état
  depuis une mémoire, un journal, un rapport antérieur ou une conversation.

Sémantique champ par champ et exemple : [digest-fields](references/digest-fields.md).

## Outils et étapes

1. Contrôler l'enveloppe : `schema_version`, `mode`, `degraded`. Si `mode` ≠
   `full` ou `degraded` = true, rapports et actions sont vides par construction :
   écrire « détail indisponible » avec la cause lue (`mode` ou `degraded`), sans
   supposer la configuration de l'environnement. HTTP 404 = digest désactivé dans
   cet environnement ; 401/403 = accès refusé. Aucun ne vaut « rien à signaler ».
2. Dater séparément la lecture et les faits : `generated_at` est l'heure de calcul
   de la réponse ; l'âge du référentiel est `stale_status`. `git_sha` null =
   « révision non attribuable ».
3. Reprendre `global_status` (`level`, `verdict`, `reasons`) sans le reformuler.
4. Pour chaque `department_reports[]`, classer la mesure : MESURE, ILLISIBLE
   (source en échec) ou SANS_PRODUCTEUR. Une valeur null n'est jamais 0. Un score
   NON_MESURE n'est ni bon ni mauvais, même avec une valeur lue.
5. Attribuer chaque affirmation à un champ ou à un élément `evidence[]` et à la
   date de lecture. Recopier `gap`, `probable_cause` et `next_evidence`, attribués.
   Si `evidence[]` contredit `kpi.value`, citer les deux et signaler l'écart sans trancher.
6. Lister `owner_go_actions` et `owner_go_actions_total` ; si le total dépasse la
   liste (10 au plus), le dire. Ne pas les classer ni les déclencher.

## Sorties, limites et arrêt

Sortie Markdown, ou JSON si l'appelant le demande : en-tête (source, date de
lecture ou de commit, `stale_status`, `mode`, révision), statut global, une ligne
par département (mesure, valeur et unité ou « non mesuré », score, évolution,
décision, `owner_go_required`, preuve), actions owner-GO, inconnues et accès
manquants. C'est un constat pour l'owner via Hermes, pas une décision.

La machine n'émet que REUSE ou IMPROVE ; CREATE et PAUSE restent humaines. Ne
déduire ni création, ni suspension, ni autonomie d'un département de la
présence de son rapport.

Arrêter et signaler, sans interpréter : `schema_version` inattendu, champ requis
absent, nombre de rapports ≠ 24 en mode `full` non dégradé. Reprise : relire la
source ; une sortie antérieure n'est jamais l'état actuel. Doublon : deux
lectures de `generated_at` différents ne se fusionnent pas dans un même tableau.

Les mesures sont des données métier internes : ne pas les committer dans ce dépôt
public ni les publier ; rédiger dans l'espace inerte de l'appelant.
