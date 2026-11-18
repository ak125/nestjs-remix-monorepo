# Fonctions des départements — modèle (mandat BX)

Proposé le 2026-11-18 (mandat BX). Ce texte décrit le bloc `functions` du
registre existant. Il ne crée ni registre ni tableau de bord : les données vivent
dans `agent-operating-map.yaml`, la forme dans `agent-operating-map.schema.json`,
les règles de cohérence dans `scripts/governance/validate-agent-operating-map.js`.

## Le modèle

- Un département rend des **fonctions**. Chaque fonction est un service avec un
  contrat : ce qu'elle reçoit (`inputs`), ce qu'elle produit (`outputs`), ce
  qu'elle lit (`reads`) et ce qu'elle écrit (`writes`).
- Un **owner** par fonction : le rôle ADR-128 du département (`<id>-lead`) ou un
  sous-agent présent dans le dépôt. Marwane reste le responsable humain.
- Une fonction est **opérationnelle** seulement si elle a un owner, un
  **déclencheur réel** branché sur main (`trigger.wired: true`) et un
  **contrôle automatique** (`check`). Sinon elle est `non_operational`, au
  niveau L0 ou L1, et ses manques sont écrits dans `gaps`.
- **Indicateurs** : le `kpi_primary` du département est le KPI résultat ; chaque
  fonction déclare 1 ou 2 `kpi_input`, `present` avec son producteur, ou
  `absent` avec ce qui manque.
- Un **seuil** ouvre une issue `dept:NN-<id>` (décision 9) ; `wired` dit si
  quelque chose l'ouvre vraiment.
- Un **niveau prouvé** L0 à L4, au sens du journal des principes
  (`.claude/governance/journal-des-principes.md`, lignes 42-43).
- **Droits au moindre privilège** : `rights` reprend les trois capacités des
  surfaces (`can_mutate`, `can_open_pr`, `can_trigger_pipeline`).
- **Capacités partagées** : elles restent au département qui les détient dans
  `declared_capabilities` ; une fonction les consomme par contrat (`uses`).

## Les champs

| Champ | Obligatoire | Contenu |
|---|---|---|
| `id` | oui | `<département>.<nom>`, unique dans tout le registre |
| `name` | oui | intitulé en français |
| `owner` | pour être opérationnelle | rôle `<id>-lead` ou sous-agent du dépôt |
| `status` | oui | `operational` ou `non_operational` |
| `level` | oui | `L0` à `L4` |
| `inputs`, `outputs` | oui | au moins une entrée, une sortie |
| `reads`, `writes` | oui | tables, colonnes, fichiers, files ; liste vide permise |
| `trigger` | pour être opérationnelle | `kind` (workflow, cron, event, issue, mandate, request), `ref` (chemin), `wired`, `detail` |
| `check` | pour être opérationnelle | `kind` (test, ci_gate, workflow), `ref` (chemin), `detail` |
| `kpi_input` | oui, 1 ou 2 | `id`, `state` ; `present` exige `producer` (et `rule` s'il est cité) ; `absent` exige `note` |
| `threshold` | oui | `rule`, `issue_label` (`dept:NN-<id>`), `wired` |
| `rights` | non | les trois capacités, booléennes |
| `uses` | non | `capability`, `from` (département propriétaire) |
| `agents`, `skills` | non | sous-agents et skills rattachés ; leur rattachement relève du mandat AB-2 |
| `evidence` | oui | `path` (+ `lines`), `pr` (+ `state`), ou `run` (+ `workflow`, `conclusion`, `at`) |
| `decisions` | oui | numéros des décisions de Marwane, sans plafond |
| `gaps` | si `non_operational` | ce qui manque, une phrase par manque |

Ajustements par rapport à la liste proposée par le mandat : `status`, `gaps`,
`rights` et `uses` sont ajoutés ; `evidence` est typé (chemin, PR, run) pour que
le contrôle vérifie chaque chemin.

## Règles du contrôle (bloquant en CI)

`node scripts/governance/validate-agent-operating-map.js --contracts` (job requis
« 🛡️ ADR-010 Governance » de `ci.yml`) refuse :

1. **operability** : une fonction sans owner, déclencheur branché et contrôle,
   qui n'est pas `non_operational` au niveau L0 ou L1 ;
2. **path** : un chemin cité par `trigger`, `check` ou `evidence` absent du
   dépôt, ou une plage de lignes au-delà de la fin du fichier ;
3. **kpi** : un `kpi_input` `present` dont le producteur n'existe pas, ou ne
   contient pas la `rule` citée ;
4. **id** : un identifiant de fonction en double, ou non préfixé par son
   département ;
5. **reference** : un owner, un sous-agent, un skill ou une capacité consommée
   qui n'existe pas (sous-agent : `.claude/agents/**/<nom>.md` ou
   `workspaces/*/.claude/agents/**/<nom>.md` ; skill : `<nom>/SKILL.md` sous
   `.claude/skills/` ou `workspaces/*/.claude/skills/`).

`--self-test` vérifie un cas valide (`scripts/governance/__fixtures__/agent-operating-map.functions.valid.yaml`)
et au moins un cas refusé par règle, plus les refus de forme du schéma.

## Remplir un département

1. Partir des décisions de Marwane qui concernent le département. Une fonction
   par décision qui a un objet réel dans le dépôt ; une décision sans code reste
   déclarée, L0, `non_operational`.
2. Pour chaque champ, citer la preuve (chemin et lignes, PR, run) ou écrire
   « absent ». Ne rien déduire : un `@Cron` sous un `ScheduleModule` inactif ou
   un événement que personne n'émet donne `wired: false`.
3. Fixer le niveau sur la preuve la plus faible : code branché = L1, testé = L2,
   observé en service = L3, observé en PROD = L4.
4. Lancer `--contracts` puis `--self-test` ; corriger jusqu'à zéro erreur.

## Départements suivants (décision 1)

Ordre de la décision 1 : « ventes, puis agents, puis trafic, puis catalogue ».

| Ordre | Département | Id | Statut |
|---|---|---|---|
| 1 | 13 Commercial & Ventes | `sales` | pilote, mandat BX |
| 2 | 23 IA, Agents & Automatisation | `ia-agents` | à faire |
| 3 | 07 Production Pages & SEO, et 04 Marketing & Acquisition | `seo`, `marketing` | à faire ; le rattachement de « trafic » à ces deux départements est à valider |
| 4 | 10 Catalogue & Compatibilité | `catalog` | à faire |

Les dix-neuf autres départements ne sont pas ordonnés par la décision 1. La liste
et l'ordre restent à valider par Marwane.
